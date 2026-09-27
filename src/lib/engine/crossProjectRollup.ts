/**
 * crossProjectRollup — pure module that computes a rollup (sum, count,
 * concat, …) of a target column on records of an EXTERNAL DataFrame,
 * resolved from a relation field on the current frame.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.3 (M0.3)
 * @since 3.4.2 (Stage A / M0.3)
 *
 * Kernel-sharing strategy (R-6 mitigation): re-uses the `aggregate`
 * function exported from `src/lib/engine/aggregate.ts` so the
 * mathematical kernel exists in exactly one place.
 *
 * Result shape `CrossProjectRollupResult` is intentionally distinct from
 * the in-frame `RollupResult { value, formattedValue }` to surface
 * source-count and per-record errors that cross-project consumers need.
 */

import type {
  DataFrame,
  DataRecord,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";
import type { RollupFieldConfig } from "src/settings/base/settings";
import {
  aggregate,
  type RollupConfig,
  type RollupResult,
} from "src/lib/engine/aggregate";
import dayjs from "dayjs";
import { LEGACY_DISPLAY_FALLBACKS, resolveCrossProjectRelations } from "./crossProjectResolver";
import {
  buildRelationTargetIndex,
  resolveRelationValue,
} from "src/lib/relations/relationContract";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { isNumeric } from "src/lib/engine/numeric";

// ── Public types ─────────────────────────────────────────

export interface CrossProjectRollupResult {
  readonly value: RollupResult["value"];
  readonly sourceCount: number;
  readonly errors: readonly string[];
}

// ── Internal helpers ─────────────────────────────────────

function toRollupConfig(config: RollupFieldConfig): RollupConfig {
  // Build a RollupConfig compatible with the shared kernel. The kernel reads
  // only `function`, `relationField`, `targetField`, and optional `separator`.
  const out: RollupConfig = {
    relationField: config.relationField,
    targetField: config.targetField,
    function: config.function,
    ...(config.separator !== undefined ? { separator: config.separator } : {}),
  };
  return out;
}

function isNumericFunction(fn: RollupFieldConfig["function"]): boolean {
  return (
    fn === "sum" ||
    fn === "avg" ||
    fn === "min" ||
    fn === "max" ||
    fn === "median" ||
    fn === "range"
  );
}

function detectTypeMismatch(
  values: Optional<DataValue>[],
  fn: RollupFieldConfig["function"]
): string[] {
  if (!isNumericFunction(fn)) return [];
  const errs: string[] = [];
  for (const v of values) {
    if (v === null || v === undefined) continue;
    // #180a: `!isNaN(parseFloat(v))` accepted `"12abc"` as numeric here while
    // the kernel it warns for has stopped doing so. A mismatch WARNING that
    // disagrees with the aggregate is worse than none — it says the data is
    // fine and then the aggregate ignores the value.
    if (isNumeric(v)) continue;
    errs.push(`Type mismatch: ${fn} expects numeric, got ${typeof v}`);
    break; // single error sufficient (R-6 contract: never throws)
  }
  return errs;
}

// ── Public API ──────────────────────────────────────────

/**
 * Compute a rollup result for a single record on `thisFrame`, aggregating
 * `targetField` from the records of `externalFrame` referenced via the
 * record's `relationField`.
 *
 * Anchored in: §A.3 contract block 1.
 */
export function computeCrossProjectRollup(
  record: DataRecord,
  config: RollupFieldConfig,
  thisFrame: DataFrame,
  externalFrame: DataFrame
): CrossProjectRollupResult {
  // R5-010 — If the relation field declares `targetSubBaseFilter`, restrict
  // the resolution scope before walking targets. Pre-filter the external
  // frame so the resolver index already excludes out-of-scope records.
  const relField = thisFrame.fields.find((f) => f.name === config.relationField);
  const relCfg = relField?.typeConfig?.relation;
  const scopedFrame: DataFrame = relCfg?.targetSubBaseFilter
    ? applyFilter(externalFrame, relCfg.targetSubBaseFilter)
    : externalFrame;

  const targets = orderRecords(
    resolveCrossProjectRelations(record, config.relationField, scopedFrame, relCfg?.displayField),
    config.orderBy
  );
  const rawValues = targets.map((t) => t.values[config.targetField]);
  const errors = detectTypeMismatch(rawValues, config.function);
  if (errors.length > 0) {
    return { value: null, sourceCount: targets.length, errors };
  }
  const result = aggregate(rawValues, toRollupConfig(config));
  return {
    value: result.value,
    sourceCount: targets.length,
    errors: [],
  };
}

/**
 * Compute the rollup column for every record in `thisFrame`. Returns a
 * Map keyed by record id so the consumer can fold the results back into
 * a derived field.
 *
 * Anchored in: §A.3 contract block 2.
 */
export function computeCrossProjectRollupColumn(
  thisFrame: DataFrame,
  config: RollupFieldConfig,
  externalFrame: DataFrame
): Map<string, CrossProjectRollupResult> {
  const out = new Map<string, CrossProjectRollupResult>();
  for (const record of thisFrame.records) {
    out.set(
      record.id,
      computeCrossProjectRollup(record, config, thisFrame, externalFrame)
    );
  }
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Order reached records by `orderBy`, ascending, records without a value
 * last. Numbers compare as numbers, anything else as text — ISO dates, as
 * front matter holds them, sort correctly as text, and Date objects by time.
 * The sort is stable, so equal keys keep the order they were reached in.
 */
function orderRecords(records: DataRecord[], orderBy: string | undefined): DataRecord[] {
  if (!orderBy) return records;
  const key = (r: DataRecord): number | string | null => {
    const v = r.values[orderBy];
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
    if (typeof v === "number") return v;
    // A date written as text is read as ingestion reads it (local time), so
    // "2026-09-01" and a Date for 2026-09-10 compare as the instants they are,
    // not as a timestamp against a string (backlink-review).
    const text = String(v);
    if (ISO_DATE.test(text)) {
      const parsed = dayjs(text);
      if (parsed.isValid()) return parsed.valueOf();
    }
    return text;
  };
  return [...records].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
    if (typeof ka === "number" && typeof kb === "number") return ka - kb;
    return String(ka).localeCompare(String(kb));
  });
}

/**
 * Reverse rollup for every record of `thisFrame`: aggregate `targetField`
 * over the records of `sourceFrame` whose `backlink.relationField` links to
 * it. Links are resolved against `thisFrame` by the relation contract — the
 * same ladder a forward link climbs — so a backlink reaches exactly the
 * records a forward link from them would reach. A source record linking the
 * same record twice counts once. Every record gets a result, so "nobody links
 * here" reads as a count of 0 and an empty average rather than as nothing.
 *
 * @since 3.6.0
 */
export function computeBacklinkRollupColumn(
  thisFrame: DataFrame,
  config: RollupFieldConfig,
  sourceFrame: DataFrame
): Map<string, CrossProjectRollupResult> {
  const out = new Map<string, CrossProjectRollupResult>();
  const relationField = config.backlink?.relationField;
  if (!relationField) return out;

  // The source relation's own configuration decides what it can reach, as it
  // does for a forward link from that record: its display field (or the
  // shared fallbacks) and its targetSubBaseFilter (backlink-review).
  const relCfg = sourceFrame.fields.find((f) => f.name === relationField)?.typeConfig
    ?.relation;
  const reachable = relCfg?.targetSubBaseFilter ? applyFilter(thisFrame, relCfg.targetSubBaseFilter) : thisFrame;
  const index = buildRelationTargetIndex(
    reachable,
    relCfg?.displayField ? [relCfg.displayField] : LEGACY_DISPLAY_FALLBACKS
  );
  const linking = new Map<string, DataRecord[]>();
  for (const source of sourceFrame.records) {
    const reached = new Set<string>();
    for (const resolution of resolveRelationValue(source.values[relationField], index)) {
      if (resolution.status !== "resolved" || !resolution.targetRecordId) continue;
      if (reached.has(resolution.targetRecordId)) continue;
      reached.add(resolution.targetRecordId);
      const list = linking.get(resolution.targetRecordId) ?? [];
      list.push(source);
      linking.set(resolution.targetRecordId, list);
    }
  }

  for (const record of thisFrame.records) {
    const sources = orderRecords(linking.get(record.id) ?? [], config.orderBy);
    const rawValues = sources.map((s) => s.values[config.targetField]);
    const errors = detectTypeMismatch(rawValues, config.function);
    if (errors.length > 0) {
      out.set(record.id, { value: null, sourceCount: sources.length, errors });
      continue;
    }
    out.set(record.id, {
      value: aggregate(rawValues, toRollupConfig(config)).value,
      sourceCount: sources.length,
      errors: [],
    });
  }
  return out;
}

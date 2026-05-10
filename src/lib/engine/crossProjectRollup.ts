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
import type { RelationFieldConfig, RollupFieldConfig } from "src/settings/base/settings";
import {
  aggregate,
  type RollupConfig,
  type RollupResult,
} from "src/lib/engine/aggregate";
import { resolveCrossProjectRelations } from "./crossProjectResolver";
import { applyFilter } from "src/lib/engine/filterEvaluator";

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
    if (typeof v === "number") continue;
    if (typeof v === "string" && !isNaN(parseFloat(v))) continue;
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
  const relCfg = relField?.typeConfig?.relation as RelationFieldConfig | undefined;
  const scopedFrame: DataFrame = relCfg?.targetSubBaseFilter
    ? applyFilter(externalFrame, relCfg.targetSubBaseFilter)
    : externalFrame;

  const targets = resolveCrossProjectRelations(
    record,
    config.relationField,
    scopedFrame,
    undefined
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

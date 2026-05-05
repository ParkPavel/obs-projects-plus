/**
 * crossProjectResolver — pure module that resolves relation fields where
 * the *target* of the wiki-link lives in a DIFFERENT project's DataFrame.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.2 (M0.2)
 * @since 3.4.2 (Stage A / M0.2)
 *
 * Contracts:
 *   resolveCrossProjectRelations  — single record, single field
 *   enrichFrameWithRelations      — derived field on every record of a frame
 *   enrichFrameWithAllRelations   — composes #2 across every relation field
 *
 * This module is **pure**: no Obsidian APIs, no I/O. The caller (datasource
 * or ViewApi layer) owns wiki-link → file path resolution; this module
 * accepts the already-loaded `externalFrame` and works with whatever index
 * key the consumer supplies via `displayField`, falling back to the canonical
 * `file.name` field surfaced by all three datasources.
 */

import type {
  DataField,
  DataFrame,
  DataRecord,
  DataValue,
  Optional,
} from "src/lib/dataframe/dataframe";
import type {
  RelationFieldConfig,
  RollupFieldConfig,
} from "src/settings/base/settings";

// ── Constants ───────────────────────────────────────────

const DERIVED_PREFIX = "__resolved__";
const MAX_LINKS_PER_VALUE = 1000;
// REFACTOR-105: wikilink parsing delegated to canonical kernel.
import { stripToPath as kernelStripToPath } from "src/lib/engine/wikilink";

// ── Per-call memoization for the lookup index ─────────────
// Anchored: §A.2 — index built once per `enrichFrameWithRelations` call,
// memoized by `(externalFrame, displayField)` to avoid rebuild when the
// same target frame appears in multiple relation fields.
const indexCache = new WeakMap<DataFrame, Map<string, Map<string, DataRecord>>>();

function getOrBuildIndex(
  frame: DataFrame,
  displayField: string | undefined
): Map<string, DataRecord> {
  const key = displayField ?? "__file__";
  let perFrame = indexCache.get(frame);
  if (!perFrame) {
    perFrame = new Map();
    indexCache.set(frame, perFrame);
  }
  const cached = perFrame.get(key);
  if (cached) return cached;
  const built = buildIndex(frame, displayField);
  perFrame.set(key, built);
  return built;
}

function buildIndex(
  frame: DataFrame,
  displayField: string | undefined
): Map<string, DataRecord> {
  const idx = new Map<string, DataRecord>();
  for (const record of frame.records) {
    if (displayField) {
      const v = record.values[displayField];
      if (typeof v === "string" && v.length > 0) {
        idx.set(v.toLowerCase(), record);
        continue;
      }
    }
    // Fallback A: canonical "name"/"title" field surfaced by datasources.
    const candidates = ["name", "title", "Name", "Title"];
    let added = false;
    for (const f of candidates) {
      const v = record.values[f];
      if (typeof v === "string" && v.length > 0) {
        idx.set(v.toLowerCase(), record);
        added = true;
        break;
      }
    }
    if (added) continue;
    // Fallback B: file basename derived from record.id.
    const base = extractBaseName(record.id);
    if (base) idx.set(base.toLowerCase(), record);
  }
  return idx;
}

function extractBaseName(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

// ── Wiki-link normalisation ──────────────────────────────

/**
 * Normalize the raw value of a relation field into a list of canonical
 * wiki-link bodies (alias suffix `|...` stripped, brackets stripped,
 * trimmed). Already-normalized strings (no brackets) pass through.
 *
 * Anchored in: §A.2 algorithm step 2.
 */
export function normalizeRelationValue(value: Optional<DataValue>): string[] {
  if (value === null || value === undefined) return [];
  // REFACTOR-105: kernel `stripToPath` already trims, drops alias, and
  // returns body. We then apply the wikilink-aware fast path so that a
  // string of length 0 after stripping is dropped.
  const collect = (raw: string): string => kernelStripToPath(raw);
  if (typeof value === "string") {
    const v = collect(value);
    return v ? [v] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (item === null || item === undefined) continue;
      if (out.length >= MAX_LINKS_PER_VALUE) break;
      const s = typeof item === "string" ? item : String(item);
      const v = collect(s);
      if (v) out.push(v);
    }
    return out;
  }
  return [];
}

// ── Public API ──────────────────────────────────────────

/**
 * Resolve cross-project relation links for a single record's field.
 *
 * Returns the matched DataRecord references in the order encountered in
 * the source value. Unmatched bodies are silently dropped (the caller is
 * expected to log/throttle elsewhere if surface-level diagnostics are
 * needed).
 *
 * Anchored in: §A.2 contract block 1.
 */
export function resolveCrossProjectRelations(
  record: DataRecord,
  fieldName: string,
  externalFrame: DataFrame,
  displayField?: string
): DataRecord[] {
  const value = record.values[fieldName];
  const bodies = normalizeRelationValue(value);
  if (bodies.length === 0) return [];
  const idx = getOrBuildIndex(externalFrame, displayField);
  const out: DataRecord[] = [];
  for (const body of bodies) {
    const hit = idx.get(body.toLowerCase());
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Enrich every record of `frame` with a derived field whose value is the
 * list of resolved DataRecords from `externalFrame`.
 *
 * The derived field is named `__resolved__${fieldName}` and is registered
 * with `derived: true` so it does not round-trip into YAML.
 *
 * Anchored in: §A.2 contract block 2.
 */
export function enrichFrameWithRelations(
  frame: DataFrame,
  fieldName: string,
  config: RelationFieldConfig,
  externalFrame: DataFrame
): DataFrame {
  const derivedName = DERIVED_PREFIX + fieldName;
  const idx = getOrBuildIndex(externalFrame, config.displayField);

  const records: DataRecord[] = frame.records.map((r) => {
    const bodies = normalizeRelationValue(r.values[fieldName]);
    if (bodies.length === 0) {
      return r;
    }
    const resolved: DataRecord[] = [];
    for (const body of bodies) {
      const hit = idx.get(body.toLowerCase());
      if (hit) resolved.push(hit);
    }
    return {
      ...r,
      values: { ...r.values, [derivedName]: resolved as unknown as DataValue },
    };
  });

  // Append derived field if any record carries it (keeps schema stable for
  // empty frames).
  const fields: DataField[] = frame.fields.some((f) => f.name === derivedName)
    ? frame.fields
    : [
        ...frame.fields,
        {
          name: derivedName,
          type: frame.fields.find((f) => f.name === fieldName)?.type ??
            ("relation" as DataField["type"]),
          identifier: false,
          derived: true,
          repeated: true,
          typeConfig: {},
        },
      ];

  return { ...frame, fields, records };
}

/**
 * Compose multiple relation enrichments. Walks `frame.fields`, applies
 * `enrichFrameWithRelations` for every field whose `typeConfig.relation`
 * is set and whose `targetProjectId` is present in `externalFrames`.
 * Missing target frames are skipped without throwing.
 *
 * Anchored in: §A.2 contract block 3.
 */
export function enrichFrameWithAllRelations(
  frame: DataFrame,
  externalFrames: ReadonlyMap<string, DataFrame>
): DataFrame {
  let enriched = frame;
  for (const field of frame.fields) {
    const rel = field.typeConfig?.relation as
      | RelationFieldConfig
      | undefined;
    if (!rel) continue;
    const target = externalFrames.get(rel.targetProjectId);
    if (!target) continue;
    enriched = enrichFrameWithRelations(enriched, field.name, rel, target);
  }
  return enriched;
}

/**
 * Derived-field name helper exported for test ergonomics. Not a
 * re-implementation of any prior helper.
 */
export function derivedFieldName(fieldName: string): string {
  return DERIVED_PREFIX + fieldName;
}

// Re-export the shape of RollupFieldConfig so cross-project rollup callers
// have a single import path.
export type { RelationFieldConfig, RollupFieldConfig };

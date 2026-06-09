/**
 * RollupEngine — aggregate field values from relation targets.
 *
 * Given a record's relation field (wiki-links) and a target field to aggregate,
 * computes a summary value (sum, avg, count, min, max, etc.) from the linked records.
 *
 * v4.0 (REFACTOR-101): the aggregation kernel and its types live in
 * `src/lib/engine/aggregate.ts`. This file orchestrates relation
 * resolution and re-exports the kernel for back-compat. New code should
 * import the kernel directly from `lib/engine/aggregate`.
 */

import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import {
  getRelationTargets,
  getRelationTargetsWithIndex,
  buildRecordIndex,
} from "./relationResolver";
import { aggregate } from "src/lib/engine/aggregate";
import type { RollupConfig, RollupResult } from "src/lib/engine/aggregate";

/**
 * Re-exports — back-compat for callers still importing from this module.
 * @deprecated Import from `src/lib/engine/aggregate` instead.
 */
export { aggregate } from "src/lib/engine/aggregate";
export type {
  RollupFunction,
  RollupConfig,
  RollupResult,
} from "src/lib/engine/aggregate";

// ── Public API ──────────────────────────────────────────

/**
 * Compute a rollup for a single source record.
 */
export function computeRollup(
  record: DataRecord,
  config: RollupConfig,
  df: DataFrame
): RollupResult {
  const targets = getRelationTargets(record, config.relationField, df);
  const rawValues = targets.map((t) => t.values[config.targetField]);
  return aggregate(rawValues, config);
}

/**
 * Compute rollups for all records in the DataFrame, returning a map of recordId → result.
 * Builds the record index ONCE — O(n) instead of O(n²).
 */
export function computeRollupColumn(
  df: DataFrame,
  config: RollupConfig
): Map<string, RollupResult> {
  const index = buildRecordIndex(df);
  const map = new Map<string, RollupResult>();
  for (const record of df.records) {
    const targets = getRelationTargetsWithIndex(
      record,
      config.relationField,
      index
    );
    const rawValues = targets.map((t) => t.values[config.targetField]);
    map.set(record.id, aggregate(rawValues, config));
  }
  return map;
}
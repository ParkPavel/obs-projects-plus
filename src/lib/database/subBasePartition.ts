/**
 * R2.2 — Sub-base partitioning (pure)
 *
 * Given a DataFrame (the "view stream" — records that already passed the
 * outer view filter) and an ordered list of `SubBaseDefinition`s, produce
 * a per-sub-base DataFrame slice.
 *
 * Two responsibilities only:
 *  1. Apply each sub-base's filter to the input frame independently.
 *  2. Optionally apply the sub-base's sort (when present).
 *
 * UI wiring (multi-table tab switcher) consumes the result map.
 */

import type { DataFrame, DataRecord, Optional, DataValue } from "src/lib/dataframe/dataframe";
import { applyFilter } from "src/ui/app/filterFunctions";
import type { SubBaseDefinition, SubBaseId } from "./subBase";

export interface SubBasePartition {
  readonly subBase: SubBaseDefinition;
  readonly frame: DataFrame;
}

export type SubBasePartitionMap = Map<SubBaseId, SubBasePartition>;

/**
 * Partition a DataFrame across all sub-bases. Records may appear in
 * multiple partitions (sub-base filters are independent — a record
 * matching both Budgets and Expenses filters lands in both).
 */
export function partitionBySubBases(
  frame: DataFrame,
  subBases: readonly SubBaseDefinition[],
): SubBasePartitionMap {
  const out: SubBasePartitionMap = new Map();
  for (const sb of subBases) {
    let slice = applyFilter(frame, sb.filter);
    if (sb.sort && sb.sort.criteria.length > 0) {
      slice = sortFrame(slice, sb.sort.criteria);
    }
    out.set(sb.id, { subBase: sb, frame: slice });
  }
  return out;
}

interface SortCriterion {
  readonly field: string;
  readonly order: "asc" | "desc";
  readonly enabled: boolean;
}

function sortFrame(
  frame: DataFrame,
  criteria: readonly SortCriterion[],
): DataFrame {
  const active = criteria.filter((c) => c.enabled);
  if (active.length === 0) return frame;
  const sorted: DataRecord[] = [...frame.records].sort((a, b) => {
    for (const c of active) {
      const av = a.values[c.field];
      const bv = b.values[c.field];
      const aMissing = av === undefined || av === null;
      const bMissing = bv === undefined || bv === null;
      // Missing values always sort after defined ones, regardless of
      // the ascending/descending direction.
      if (aMissing && bMissing) continue;
      if (aMissing) return 1;
      if (bMissing) return -1;
      const cmp = compareValues(av, bv);
      if (cmp !== 0) return c.order === "asc" ? cmp : -cmp;
    }
    return 0;
  });
  return { ...frame, records: sorted };
}

/**
 * Stable, type-aware comparator. Null/undefined sort *after* defined
 * values regardless of direction — matches the legacy Table view.
 */
export function compareValues(
  a: Optional<DataValue>,
  b: Optional<DataValue>,
): number {
  const aMissing = a === undefined || a === null;
  const bMissing = b === undefined || b === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb);
}

/**
 * Return only the partition for the requested sub-base id, or `null`
 * if it isn't in the map. Convenience wrapper to keep callers ergonomic
 * under TypeScript strict mode.
 */
export function getPartition(
  map: SubBasePartitionMap,
  id: SubBaseId,
): SubBasePartition | null {
  return map.get(id) ?? null;
}

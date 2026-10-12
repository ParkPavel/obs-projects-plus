import type { DataRecord } from "src/lib/dataframe/dataframe";

/** The shared predicate; callers normalize the query once per search. */
export function matchesSearch(record: DataRecord, normalizedQuery: string): boolean {
  return record.id.toLowerCase().includes(normalizedQuery) ||
    Object.values(record.values).some((v) => v != null && String(v).toLowerCase().includes(normalizedQuery));
}

export function applySearch(records: readonly DataRecord[], query: string): DataRecord[] {
  const q = query.trim().toLowerCase();
  return q ? records.filter((r) => matchesSearch(r, q)) : [...records];
}

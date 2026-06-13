import type { DataField } from "src/lib/dataframe/dataframe";
import type { TransformStep } from "src/lib/dashboard-engine/transformTypes";

/**
 * Detect array-valued fields in the source data to suggest Unnest.
 * Scans the first few records looking for any field whose value is an array.
 * Fields already targeted by an Unnest step are excluded.
 */
export function detectArrayFields(
  src: { records: Array<{ values: Record<string, unknown> }> } | null,
  fields: DataField[],
  currentSteps: readonly TransformStep[],
): string[] {
  if (!src || src.records.length === 0) return [];
  const alreadyUnnested = new Set(
    currentSteps.filter((s) => s.type === "unnest").map((s) => (s as { field: string }).field),
  );
  const candidates = new Set<string>();
  const sampleSize = Math.min(src.records.length, 50);
  for (let i = 0; i < sampleSize; i++) {
    const rec = src.records[i];
    if (!rec) continue;
    for (const f of fields) {
      if (alreadyUnnested.has(f.name)) continue;
      const v = rec.values[f.name];
      if (Array.isArray(v) && v.length > 0) {
        candidates.add(f.name);
      }
    }
  }
  return [...candidates];
}

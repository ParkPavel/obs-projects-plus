import type { DataFrame, DataField, DataRecord } from "../dataframe/dataframe";

/**
 * Merge multiple DataFrames into one unified DataFrame.
 * - Fields: union of all fields (by name); first occurrence determines type.
 * - Records: concatenated, deduplicated by record id (first wins).
 * - If all frames are empty, returns empty frame.
 */
export function mergeDataFrames(frames: DataFrame[]): DataFrame {
  if (frames.length === 0) return { fields: [], records: [] };
  if (frames.length === 1) return frames[0]!;

  // Union fields by name — first occurrence wins type/config
  const fieldMap = new Map<string, DataField>();
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (!fieldMap.has(field.name)) {
        fieldMap.set(field.name, field);
      }
    }
  }

  // Deduplicate records by id — first occurrence wins
  const recordMap = new Map<string, DataRecord>();
  for (const frame of frames) {
    for (const record of frame.records) {
      if (!recordMap.has(record.id)) {
        recordMap.set(record.id, record);
      }
    }
  }

  return {
    fields: [...fieldMap.values()],
    records: [...recordMap.values()],
  };
}

import type { DataRecord } from "../../dataframe/dataframe";

/**
 * standardizeRecord makes a record of a note's front matter. The YAML values
 * enter as they are; parseRecords types them against the detected schema.
 */
export function standardizeRecord(
  id: string,
  values: Record<string, unknown>
): DataRecord {
  return {
    id,
    values: values as DataRecord["values"],
  };
}

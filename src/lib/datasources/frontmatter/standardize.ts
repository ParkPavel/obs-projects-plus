import type { DataRecord } from "../../dataframe/dataframe";

/**
 * standardizeValues converts front matter YAML data to the common DataValue
 * format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- YAML frontmatter values are dynamically typed
export function standardizeRecord(
  id: string,
  values: Record<string, any>
): DataRecord {
  return {
    id,
    values,
  };
}

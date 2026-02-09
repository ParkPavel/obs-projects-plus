import dayjs from "dayjs";
import type { Link } from "obsidian-dataview";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";

/**
 * standardizeValues converts a Dataview data structure of values to the common
 * DataValue format.
 */
// /skip @typescript-eslint/no-explicit-any - Dataview API returns dynamic data structure
export function standardizeValues(
  values: Record<string, any>
): Record<string, Optional<DataValue>> {
  const res: Record<string, Optional<DataValue>> = {};

  Object.keys(values).forEach((field) => {
    const value = values[field];

    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.map((v) => (typeof v === "object" ? standardizeObject(v) : v));
      res[field] = value;
    } else if (typeof value === "object") {
      res[field] = standardizeObject(value);
    } else {
      res[field] = value;
    }
  });

  return res;
}

// /skip @typescript-eslint/no-explicit-any - Dataview objects can be Link, DateTime, or other types
function standardizeObject(value: any) {
  if ("path" in value && "display" in value) {
    return (value as Link).toString();
  }
  if ("ts" in value) {
    return dayjs(value.ts).format("YYYY-MM-DD");
  }
}

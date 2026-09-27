import dayjs from "dayjs";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { isDataviewLink } from "./api";

/**
 * standardizeValues converts a Dataview data structure of values to the common
 * DataValue format.
 */
export function standardizeValues(
  values: Record<string, unknown>
): Record<string, Optional<DataValue>> {
  const res: Record<string, Optional<DataValue>> = {};

  Object.keys(values).forEach((field) => {
    const value = values[field];

    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      res[field] = value.map((v: unknown) =>
        typeof v === "object" && v !== null ? standardizeObject(v) : v
      ) as DataValue;
    } else if (typeof value === "object") {
      res[field] = standardizeObject(value);
    } else {
      res[field] = value as DataValue;
    }
  });

  return res;
}

/** A Dataview link becomes its text, a Luxon date its ISO date (and time). */
function standardizeObject(value: object): string | undefined {
  if (isDataviewLink(value) && "display" in value) {
    return value.toString();
  }
  if ("ts" in value) {
    const d = dayjs(value.ts as number);
    // Preserve time component if present (non-midnight)
    if (d.hour() !== 0 || d.minute() !== 0 || d.second() !== 0) {
      return d.format("YYYY-MM-DD HH:mm");
    }
    return d.format("YYYY-MM-DD");
  }
  return undefined;
}

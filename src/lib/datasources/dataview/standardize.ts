import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { dateAsText } from "src/lib/helpers/dateShape";
import { isDataviewLink } from "./api";

/**
 * standardizeValues converts a Dataview data structure of values to the common
 * DataValue format.
 *
 * w4-p01 (F05): only an absent value is skipped. `0`, `false` and `""` are
 * values, and an empty property stays `null` (present, empty) — this used to
 * drop every falsy value, so a zero balance or an unticked box vanished before
 * any filter or aggregate saw it.
 */
export function standardizeValues(
  values: Record<string, unknown>
): Record<string, Optional<DataValue>> {
  const res: Record<string, Optional<DataValue>> = {};

  Object.keys(values).forEach((field) => {
    const value = values[field];

    if (value === undefined) {
      return;
    }

    if (value === null) {
      res[field] = null;
    } else if (Array.isArray(value)) {
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
    // Seconds are kept; a value at exact midnight reads as its day (Luxon
    // does not say whether it was written with a time).
    return dateAsText(new Date(value.ts as number));
  }
  return undefined;
}

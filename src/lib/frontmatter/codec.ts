/**
 * Frontmatter codec — type-preserving (de)serialisation of `DataValue`
 * for Obsidian's YAML frontmatter store.
 *
 * After REFACTOR-202 every write goes through `encodeValue` and every
 * read goes through `decodeValue`, so round-trips are stable for the
 * full alphabet enumerated in `DataFieldType`.
 *
 * Contract:
 *  - Primitives (string/number/boolean) are identity.
 *  - `Date` is encoded as ISO-8601 (`YYYY-MM-DD` when time-of-day is
 *    midnight local, otherwise full ISO with `Z`/offset). The decoder
 *    recognises both `YYYY-MM-DD` and full ISO timestamps and returns
 *    a `Date`.
 *  - Arrays of `DataValue` are recursively encoded.
 *  - `null`/`undefined` round-trip as `null`. Callers should `unset`
 *    the key instead of writing `null` for proper YAML hygiene; the
 *    writer side handles that.
 *
 * @since 4.0 (REFACTOR-202)
 */

import type { Optional, DataValue } from "src/lib/dataframe/dataframe";

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Encode a `DataValue` for storage in YAML frontmatter.
 * Returns `null` for nullish inputs so the caller can branch on
 * "should I unset the key?" without re-checking the value.
 */
export function encodeValue(value: Optional<DataValue>): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return encodeDate(value);
  if (Array.isArray(value)) return value.map(encodeValue);
  return value;
}

/**
 * Decode a raw frontmatter value into a `DataValue`. Strings that
 * match an ISO date pattern are upgraded to `Date` so equality
 * comparisons against typed cells round-trip.
 */
export function decodeValue(raw: unknown): Optional<DataValue> {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    if (ISO_DATE_ONLY.test(raw) || ISO_DATETIME.test(raw)) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return raw;
  }
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (Array.isArray(raw)) {
    return raw.map(decodeValue) as DataValue;
  }
  // Unknown shape (e.g. nested object) — coerce to string for safety.
  return String(raw);
}

function encodeDate(d: Date): string {
  const isMidnight =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  if (isMidnight) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return d.toISOString();
}

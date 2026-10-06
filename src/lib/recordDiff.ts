import type { DataRecord } from "./dataframe/dataframe";

/** null and undefined both mean "no value": a key with either is the same as an absent key. */
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Value equality for record values. Dates compare by time, arrays and plain
 * objects structurally, and null/undefined are interchangeable.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (isAbsent(a) || isAbsent(b)) return isAbsent(a) && isAbsent(b);
  if (a === b) return true;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && sameTime(a, b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameValue(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!sameValue(left[key], right[key])) return false;
    }
    return true;
  }
  // NaN is the one value that is not equal to itself.
  return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
}

function sameTime(a: Date, b: Date): boolean {
  const left = a.getTime();
  const right = b.getTime();
  return left === right || (Number.isNaN(left) && Number.isNaN(right));
}

/**
 * The keys of `next` that differ from `prev`, so a write can carry only what
 * the user changed and leave every other frontmatter key exactly as it is on
 * disk. A key present in `prev` and gone from `next` counts as changed.
 *
 * Returns `undefined` when `prev` is not known: the caller then writes the
 * whole record, as it did before. The same object on both sides means nothing
 * was changed (several editors hand the stored record back after a save), so
 * the answer is an empty list, not "write everything".
 */
export function changedKeys(
  prev: DataRecord | undefined,
  next: DataRecord
): string[] | undefined {
  if (prev === undefined) return undefined;
  if (prev === next) return [];

  const keys = new Set([...Object.keys(prev.values), ...Object.keys(next.values)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!sameValue(prev.values[key], next.values[key])) changed.push(key);
  }
  return changed;
}

/**
 * The keys a caller set on a record it built from an earlier copy
 * (`updateRecordValues`). They are what the user changed, whatever the store
 * holds by now: diffing against the store would also "change back" a field
 * another edit wrote meanwhile from a stale base.
 */
const touched = new WeakMap<DataRecord, readonly string[]>();

/** Remember which keys `record` was built to change. */
export function markTouched(record: DataRecord, keys: readonly string[]): DataRecord {
  touched.set(record, keys);
  return record;
}

/** The keys `record` was built to change, when it was built that way. */
export function touchedKeys(record: DataRecord): readonly string[] | undefined {
  return touched.get(record);
}

/**
 * `base` with only `keys` taken from `next`: the store copy an optimistic
 * update should show, so a stale caller does not roll back other fields.
 */
export function patchRecord(base: DataRecord, next: DataRecord, keys: readonly string[]): DataRecord {
  const values = { ...base.values };
  for (const key of keys) values[key] = next.values[key];
  return markTouched({ ...base, values }, keys);
}

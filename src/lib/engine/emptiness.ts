/**
 * emptiness — canonical "is empty" predicates (REFACTOR-106).
 *
 * Two distinct semantics are pinned because both are in active use:
 *
 *  - `isNullish(v)`  — only `null` / `undefined`. Used by sort
 *    comparators that want to keep `""` and `0` as real values.
 *  - `isEmpty(v)`    — `isNullish` ∪ `""` ∪ `[]`. Used by filter
 *    `is-empty` operator, formula `EMPTY()`, transform pipeline, and
 *    agenda filter engine.
 *
 *  - `isNotEmpty(v)` — strict negation of `isEmpty`.
 *
 * Anchored in: docs/PHASE_3_TICKETS.md REFACTOR-106.
 */

/**
 * True when the value is `null` or `undefined`. Numbers (including 0,
 * NaN) and empty strings/arrays are NOT considered nullish.
 */
export function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * True when the value is nullish, an empty string, or an empty array.
 * Whitespace-only strings are NOT considered empty (preserves
 * pre-refactor contract — see filter `is-empty` and tests).
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Strict negation of `isEmpty`. */
export function isNotEmpty(value: unknown): boolean {
  return !isEmpty(value);
}

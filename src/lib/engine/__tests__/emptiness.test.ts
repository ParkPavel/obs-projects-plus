/**
 * emptiness — kernel coverage for canonical empty/nullish predicates.
 *
 * Pins both semantics:
 *  - `isNullish` — null/undefined only
 *  - `isEmpty`   — null/undefined/""/[]
 *  - `isNotEmpty` — strict negation
 *
 * Anchored in: REFACTOR-106 AC.
 */

import { isNullish, isEmpty, isNotEmpty } from "../emptiness";

describe("emptiness — kernel", () => {
  // ── isNullish ────────────────────────────────────────
  describe("isNullish", () => {
    test("null", () => expect(isNullish(null)).toBe(true));
    test("undefined", () => expect(isNullish(undefined)).toBe(true));
    test("empty string is NOT nullish", () => expect(isNullish("")).toBe(false));
    test("empty array is NOT nullish", () => expect(isNullish([])).toBe(false));
    test("zero is NOT nullish", () => expect(isNullish(0)).toBe(false));
    test("false is NOT nullish", () => expect(isNullish(false)).toBe(false));
    test("NaN is NOT nullish", () => expect(isNullish(NaN)).toBe(false));
    test("non-empty string", () => expect(isNullish("hi")).toBe(false));
  });

  // ── isEmpty ──────────────────────────────────────────
  describe("isEmpty", () => {
    test("null", () => expect(isEmpty(null)).toBe(true));
    test("undefined", () => expect(isEmpty(undefined)).toBe(true));
    test("empty string", () => expect(isEmpty("")).toBe(true));
    test("empty array", () => expect(isEmpty([])).toBe(true));
    test("whitespace-only string is NOT empty", () => expect(isEmpty("  ")).toBe(false));
    test("zero is NOT empty", () => expect(isEmpty(0)).toBe(false));
    test("false is NOT empty", () => expect(isEmpty(false)).toBe(false));
    test("non-empty string", () => expect(isEmpty("hi")).toBe(false));
    test("non-empty array", () => expect(isEmpty(["a"])).toBe(false));
    test("array with single null element is NOT empty (length>0)", () => {
      expect(isEmpty([null])).toBe(false);
    });
    test("Date instance is NOT empty", () => expect(isEmpty(new Date())).toBe(false));
    test("plain object is NOT empty", () => expect(isEmpty({})).toBe(false));
  });

  // ── isNotEmpty ───────────────────────────────────────
  describe("isNotEmpty", () => {
    test("inverse of isEmpty for null", () => expect(isNotEmpty(null)).toBe(false));
    test("inverse of isEmpty for empty string", () => expect(isNotEmpty("")).toBe(false));
    test("inverse of isEmpty for non-empty array", () => expect(isNotEmpty(["a"])).toBe(true));
    test("zero is not-empty", () => expect(isNotEmpty(0)).toBe(true));
    test("false is not-empty", () => expect(isNotEmpty(false)).toBe(true));
  });
});

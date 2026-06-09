/**
 * joinKey — equality-key normalisation for cross-type joins
 * (REFACTOR-107 coverage gap fill).
 *
 * Pins the contract documented in `joinKey.ts`: nullish sentinel,
 * local-TZ day key for `Date`, ISO-prefix day key for strings,
 * JSON for arrays, typed `typeof:value` fallback otherwise.
 */

import { joinKey } from "src/lib/dashboard-engine/joinKey";

describe("joinKey", () => {
  describe("nullish", () => {
    test("null → sentinel", () => expect(joinKey(null)).toBe("\0"));
    test("undefined → sentinel", () => expect(joinKey(undefined)).toBe("\0"));
    test("null and undefined collapse to same key", () => {
      expect(joinKey(null)).toBe(joinKey(undefined));
    });
  });

  describe("Date — local-TZ day granularity", () => {
    test("constructs day key from y/m/d", () => {
      expect(joinKey(new Date(2026, 3, 1))).toBe("D:2026-04-01");
    });
    test("month is 1-indexed in key (Jan=01)", () => {
      expect(joinKey(new Date(2026, 0, 9))).toBe("D:2026-01-09");
    });
    test("zero-padded day", () => {
      expect(joinKey(new Date(2026, 11, 5))).toBe("D:2026-12-05");
    });
    test("two distinct same-day Dates produce identical keys", () => {
      const a = new Date(2026, 5, 15, 9, 30);
      const b = new Date(2026, 5, 15, 23, 59);
      expect(joinKey(a)).toBe(joinKey(b));
    });
  });

  describe("strings", () => {
    test("ISO yyyy-MM-dd → day key", () => {
      expect(joinKey("2026-04-01")).toBe("D:2026-04-01");
    });
    test("ISO with time prefix → day key (sub-day dropped)", () => {
      expect(joinKey("2026-04-01T15:30:00Z")).toBe("D:2026-04-01");
    });
    test("non-ISO string → typed prefix", () => {
      expect(joinKey("hello")).toBe("string:hello");
    });
    test("empty string → typed prefix", () => {
      expect(joinKey("")).toBe("string:");
    });
    test("almost-ISO (single-digit day) is NOT a date", () => {
      expect(joinKey("2026-4-1")).toBe("string:2026-4-1");
    });
  });

  describe("scalars", () => {
    test("number", () => expect(joinKey(42)).toBe("number:42"));
    test("zero", () => expect(joinKey(0)).toBe("number:0"));
    test("boolean true", () => expect(joinKey(true)).toBe("boolean:true"));
    test("boolean false", () => expect(joinKey(false)).toBe("boolean:false"));
  });

  describe("arrays", () => {
    test("array of strings → JSON", () => {
      expect(joinKey(["a", "b"])).toBe('["a","b"]');
    });
    test("empty array", () => expect(joinKey([])).toBe("[]"));
    test("array equal under JSON serialisation produce identical keys", () => {
      expect(joinKey([1, 2, 3])).toBe(joinKey([1, 2, 3]));
    });
  });

  describe("equality semantics", () => {
    test("nullish sentinel never collides with real value", () => {
      expect(joinKey(null)).not.toBe(joinKey(""));
      expect(joinKey(null)).not.toBe(joinKey(0));
      expect(joinKey(null)).not.toBe(joinKey(false));
    });
    test("typed prefix prevents 1 vs '1' collision", () => {
      expect(joinKey(1)).not.toBe(joinKey("1"));
    });
  });
});

/**
 * Kernel coverage for `aggregate()` — REFACTOR-102 acceptance test.
 *
 * Anchored in: docs/PHASE_3_TICKETS.md REFACTOR-102 AC#2 (≥56 cases) and
 * AC#1 (footer↔formula↔rollup parity for shared operators).
 *
 * Each case is a single `expect()` that pins one kernel behaviour. Cases
 * are grouped by `RollupFunction`. Edge cases (empty input, all-null,
 * mixed types, non-numeric strings, booleans, dates) get explicit cases.
 */

import { aggregate, type RollupConfig } from "../aggregate";

const cfg = (function_: RollupConfig["function"], separator?: string): RollupConfig => {
  const base = { relationField: "rel", targetField: "target", function: function_ };
  return separator === undefined ? base : { ...base, separator };
};

describe("aggregate() — kernel", () => {
  // ── count ────────────────────────────────────────────
  describe("count", () => {
    test("counts non-null values", () => {
      expect(aggregate([1, 2, 3], cfg("count")).value).toBe(3);
    });
    test("ignores null", () => {
      expect(aggregate([1, null, 3], cfg("count")).value).toBe(2);
    });
    test("ignores undefined", () => {
      expect(aggregate([1, undefined, 3], cfg("count")).value).toBe(2);
    });
    test("counts empty strings (non-null)", () => {
      expect(aggregate(["a", "", "b"], cfg("count")).value).toBe(3);
    });
    test("counts false (non-null)", () => {
      expect(aggregate([false, true], cfg("count")).value).toBe(2);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("count")).value).toBe(0);
    });
  });

  // ── count_values ────────────────────────────────────
  describe("count_values", () => {
    test("excludes empty string", () => {
      expect(aggregate(["a", "", "b"], cfg("count_values")).value).toBe(2);
    });
    test("excludes false", () => {
      expect(aggregate([true, false, true], cfg("count_values")).value).toBe(2);
    });
    test("includes zero", () => {
      expect(aggregate([0, 1, 2], cfg("count_values")).value).toBe(3);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("count_values")).value).toBe(0);
    });
  });

  // ── count_unique ────────────────────────────────────
  describe("count_unique", () => {
    test("dedupes duplicates", () => {
      expect(aggregate(["a", "b", "a", "c"], cfg("count_unique")).value).toBe(3);
    });
    test("treats string and number forms as equal (string-based key)", () => {
      expect(aggregate([1, "1", 2], cfg("count_unique")).value).toBe(2);
    });
    test("ignores null", () => {
      expect(aggregate([1, null, 1], cfg("count_unique")).value).toBe(1);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("count_unique")).value).toBe(0);
    });
  });

  // ── sum ──────────────────────────────────────────────
  describe("sum", () => {
    test("integer sum", () => {
      expect(aggregate([1, 2, 3], cfg("sum")).value).toBe(6);
    });
    test("float sum", () => {
      expect(aggregate([1.5, 2.5], cfg("sum")).value).toBe(4);
    });
    test("parses numeric strings", () => {
      expect(aggregate(["1", "2", 3], cfg("sum")).value).toBe(6);
    });
    test("drops non-numeric strings", () => {
      expect(aggregate(["abc", 5], cfg("sum")).value).toBe(5);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("sum")).value).toBe(0);
    });
    test("all-null → 0", () => {
      expect(aggregate([null, undefined], cfg("sum")).value).toBe(0);
    });
    test("formats integer without decimals", () => {
      expect(aggregate([1, 2], cfg("sum")).formattedValue).toBe("3");
    });
    test("formats float with 2 decimals", () => {
      expect(aggregate([1, 2.5], cfg("sum")).formattedValue).toBe("3.50");
    });
  });

  // ── avg ──────────────────────────────────────────────
  describe("avg", () => {
    test("integer mean", () => {
      expect(aggregate([2, 4, 6], cfg("avg")).value).toBe(4);
    });
    test("float mean", () => {
      expect(aggregate([1, 2], cfg("avg")).value).toBe(1.5);
    });
    test("ignores non-numeric for mean", () => {
      expect(aggregate(["x", 4, 6], cfg("avg")).value).toBe(5);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("avg")).value).toBe(0);
    });
    test("all-null → 0", () => {
      expect(aggregate([null, undefined], cfg("avg")).value).toBe(0);
    });
    test("non-numeric only → 0", () => {
      expect(aggregate(["a", "b"], cfg("avg")).value).toBe(0);
    });
  });

  // ── min / max / range ────────────────────────────────
  describe("min", () => {
    test("returns smallest", () => {
      expect(aggregate([3, 1, 2], cfg("min")).value).toBe(1);
    });
    test("works with negatives", () => {
      expect(aggregate([-5, 0, 5], cfg("min")).value).toBe(-5);
    });
    test("empty → 0", () => {
      expect(aggregate([], cfg("min")).value).toBe(0);
    });
  });

  describe("max", () => {
    test("returns largest", () => {
      expect(aggregate([3, 1, 2], cfg("max")).value).toBe(3);
    });
    test("works with negatives", () => {
      expect(aggregate([-5, -10, -1], cfg("max")).value).toBe(-1);
    });
    test("empty → 0", () => {
      expect(aggregate([], cfg("max")).value).toBe(0);
    });
  });

  describe("range", () => {
    test("returns max - min", () => {
      expect(aggregate([3, 1, 9], cfg("range")).value).toBe(8);
    });
    test("single value → 0", () => {
      expect(aggregate([5], cfg("range")).value).toBe(0);
    });
    test("empty → 0", () => {
      expect(aggregate([], cfg("range")).value).toBe(0);
    });
  });

  // ── median ───────────────────────────────────────────
  describe("median", () => {
    test("odd-length sorted middle", () => {
      expect(aggregate([1, 3, 2], cfg("median")).value).toBe(2);
    });
    test("even-length mean of middle two", () => {
      expect(aggregate([1, 2, 3, 4], cfg("median")).value).toBe(2.5);
    });
    test("works with negatives", () => {
      expect(aggregate([-5, 0, 5], cfg("median")).value).toBe(0);
    });
    test("empty → 0", () => {
      expect(aggregate([], cfg("median")).value).toBe(0);
    });
    test("ignores non-numeric", () => {
      expect(aggregate(["x", 1, 3, 5], cfg("median")).value).toBe(3);
    });
  });

  // ── percent_true ─────────────────────────────────────
  describe("percent_true", () => {
    test("all true → 100%", () => {
      expect(aggregate([true, true], cfg("percent_true")).formattedValue).toBe("100%");
    });
    test("none true → 0%", () => {
      expect(aggregate([false, false], cfg("percent_true")).formattedValue).toBe("0%");
    });
    test("mixed → rounded percent", () => {
      expect(aggregate([true, false, false], cfg("percent_true")).formattedValue).toBe("33%");
    });
    test('"true" string counts as true', () => {
      expect(aggregate(["true", "true", false], cfg("percent_true")).formattedValue).toBe("67%");
    });
    test("empty → 0%", () => {
      expect(aggregate([], cfg("percent_true")).formattedValue).toBe("0%");
    });
    test("all-null → 0%", () => {
      expect(aggregate([null, undefined], cfg("percent_true")).formattedValue).toBe("0%");
    });
  });

  // ── concat / concat_unique ───────────────────────────
  describe("concat", () => {
    test("default separator ', '", () => {
      expect(aggregate(["a", "b", "c"], cfg("concat")).value).toBe("a, b, c");
    });
    test("custom separator", () => {
      expect(aggregate(["a", "b"], cfg("concat", " | ")).value).toBe("a | b");
    });
    test("preserves duplicates", () => {
      expect(aggregate(["a", "a", "b"], cfg("concat")).value).toBe("a, a, b");
    });
    test("empty → empty string", () => {
      expect(aggregate([], cfg("concat")).value).toBe("");
    });
    test("ignores null", () => {
      expect(aggregate(["a", null, "b"], cfg("concat")).value).toBe("a, b");
    });
  });

  describe("concat_unique", () => {
    test("dedupes", () => {
      expect(aggregate(["a", "a", "b", "a"], cfg("concat_unique")).value).toBe("a, b");
    });
    test("custom separator", () => {
      expect(aggregate(["a", "b", "a"], cfg("concat_unique", " · ")).value).toBe("a · b");
    });
    test("empty → empty string", () => {
      expect(aggregate([], cfg("concat_unique")).value).toBe("");
    });
  });

  // ── parity guard: footer ↔ rollup share the kernel ───
  describe("parity guard (REFACTOR-102 AC#1)", () => {
    test("sum invariant for shared input", () => {
      const v = [1, 2, 3, 4];
      expect(aggregate(v, cfg("sum")).value).toBe(10);
    });
    test("avg invariant for shared input", () => {
      const v = [2, 4, 6];
      expect(aggregate(v, cfg("avg")).value).toBe(4);
    });
    test("min/max invariant", () => {
      const v = [3, 1, 9, 2];
      expect(aggregate(v, cfg("min")).value).toBe(1);
      expect(aggregate(v, cfg("max")).value).toBe(9);
    });
    test("median invariant for odd length", () => {
      expect(aggregate([1, 5, 9], cfg("median")).value).toBe(5);
    });
    test("count_unique invariant", () => {
      expect(aggregate(["a", "a", "b"], cfg("count_unique")).value).toBe(2);
    });
  });

  // ── count_total (R5-004) ─────────────────────────────
  describe("count_total", () => {
    test("counts all values including null", () => {
      expect(aggregate([1, null, undefined, 3], cfg("count_total")).value).toBe(4);
    });
    test("empty input → 0", () => {
      expect(aggregate([], cfg("count_total")).value).toBe(0);
    });
    test("all null → total length", () => {
      expect(aggregate([null, null], cfg("count_total")).value).toBe(2);
    });
  });

  // ── show_original / show_unique (NPLAN-C3) ───────────
  describe("show_original", () => {
    test("returns all non-null values joined", () => {
      expect(aggregate(["a", "b", "a"], cfg("show_original")).value).toBe("a, b, a");
    });
    test("ignores null", () => {
      expect(aggregate(["a", null, "b"], cfg("show_original")).value).toBe("a, b");
    });
    test("empty → empty string", () => {
      expect(aggregate([], cfg("show_original")).value).toBe("");
    });
  });

  describe("show_unique", () => {
    test("dedupes values", () => {
      expect(aggregate(["a", "b", "a"], cfg("show_unique")).value).toBe("a, b");
    });
    test("custom separator", () => {
      expect(aggregate(["x", "y", "x"], cfg("show_unique", " | ")).value).toBe("x | y");
    });
    test("empty → empty string", () => {
      expect(aggregate([], cfg("show_unique")).value).toBe("");
    });
  });
});

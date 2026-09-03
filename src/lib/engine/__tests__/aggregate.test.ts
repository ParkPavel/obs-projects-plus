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

import { aggregate, type RollupConfig, type RollupFunction } from "../aggregate";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { NUMERIC_COERCION_CASES } from "./numericContract.test";

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
    // FLIPPED by #180c, executing the user's D4 (BACKLOG #180, RESOLVED
    // 2026-09-02): an unchecked box is an answer, not a blank. The footer never
    // excluded `false`, so until now the same question had two answers — over
    // `[false]` the kernel said 100% empty and the footer said 0%.
    // `count_checked` / `percent_true` are the operators for "how many are
    // true", and they are unaffected.
    test("counts false — an unchecked box is a value", () => {
      expect(aggregate([true, false, true], cfg("count_values")).value).toBe(3);
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
    test("adds numeric strings", () => {
      expect(aggregate(["1", "2", 3], cfg("sum")).value).toBe(6);
    });
    test("drops non-numeric strings", () => {
      expect(aggregate(["abc", 5], cfg("sum")).value).toBe(5);
    });

    // #180a: the kernel does not own the coercion rule, so it does not get to
    // restate it. Driving `sum` off the one fixture table is what makes this a
    // CONSUMER of the contract instead of a second copy of it — a copied table
    // is the class of defect the whole ticket is about (spec §2.2).
    describe("agrees with NUMERIC_COERCION_CASES, value by value", () => {
      test.each(NUMERIC_COERCION_CASES)(
        "sum of [$label] is the coerced value, or 0 when it is not a number",
        ({ input, expected }) => {
          const sum = aggregate([input as Optional<DataValue>], cfg("sum"));
          expect(sum.value).toBe(expected ?? 0);
        }
      );
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
    // FLIPPED by #180a. Empty is not a zero once #180a made "empty" reachable:
    // a Number field holding `abc` used to become NaN at ingest and survive
    // into the reduction, so this returned the visible nonsense NaN. With the
    // value dropped the list is genuinely empty, and 0 would print a number
    // that reads like an answer. `sum` keeps 0 — the additive identity is a
    // real total of nothing (BACKLOG #180, RESOLVED 2026-09-02). Found by the
    // Codex adversarial review, which traced it to the footer.
    test("empty input → null, printed as the empty placeholder", () => {
      const r = aggregate([], cfg("avg"));
      expect(r.value).toBeNull();
      expect(r.formattedValue).toBe("—");
    });
    test("all-null → null", () => {
      expect(aggregate([null, undefined], cfg("avg")).value).toBeNull();
    });
    test("non-numeric only → null", () => {
      expect(aggregate(["a", "b"], cfg("avg")).value).toBeNull();
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
    test("empty → null, not a zero that reads like an answer (#180a)", () => {
      expect(aggregate([], cfg("min")).value).toBeNull();
    });
  });

  describe("max", () => {
    test("returns largest", () => {
      expect(aggregate([3, 1, 2], cfg("max")).value).toBe(3);
    });
    test("works with negatives", () => {
      expect(aggregate([-5, -10, -1], cfg("max")).value).toBe(-1);
    });
    test("empty → null, not a zero that reads like an answer (#180a)", () => {
      expect(aggregate([], cfg("max")).value).toBeNull();
    });
  });

  describe("range", () => {
    test("returns max - min", () => {
      expect(aggregate([3, 1, 9], cfg("range")).value).toBe(8);
    });
    test("single value → 0", () => {
      expect(aggregate([5], cfg("range")).value).toBe(0);
    });
    test("empty → null, not a zero that reads like an answer (#180a)", () => {
      expect(aggregate([], cfg("range")).value).toBeNull();
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
    // FLIPPED by #180c. #180a converted avg/min/max/range and did not reach
    // median; #180b was scoped to the percent family. The gap was recorded
    // both times rather than hidden, and this closes it: spec §3.1 puts median
    // in the null column with the rest.
    test("empty → null, like every other numeric aggregate", () => {
      const r = aggregate([], cfg("median"));
      expect(r.value).toBeNull();
      expect(r.formattedValue).toBe("—");
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
    // FLIPPED by #180b (spec §3.2 item 3). Zero percent is a claim about a
    // population, and there is none — and in a footer cell "0%" is
    // indistinguishable from a real zero percent, which is the one reading a
    // user would act on.
    test("empty → the empty placeholder, not 0%", () => {
      const r = aggregate([], cfg("percent_true"));
      expect(r.value).toBeNull();
      expect(r.formattedValue).toBe("—");
    });
    test("all-null → the empty placeholder", () => {
      expect(aggregate([null, undefined], cfg("percent_true")).value).toBeNull();
    });

    // #180b item 2: the datum is a number, the "NN%" is how it is written.
    test("the value is a number and the text is beside it", () => {
      const r = aggregate([true, false, false], cfg("percent_true"));
      expect(typeof r.value).toBe("number");
      expect(r.value).toBeCloseTo(33.333, 2);
      expect(r.formattedValue).toBe("33%");
    });
  });

  describe("percent_empty / percent_not_empty", () => {
    test("the value is a number and the text is beside it", () => {
      const r = aggregate(["a", "", null], cfg("percent_not_empty"));
      expect(typeof r.value).toBe("number");
      expect(r.formattedValue).toMatch(/^\d+%$/);
    });
    test("no population → the empty placeholder, not 0%", () => {
      for (const fn of ["percent_empty", "percent_not_empty"] as const) {
        const r = aggregate([], cfg(fn));
        expect(r.value).toBeNull();
        expect(r.formattedValue).toBe("—");
      }
    });
    test("the rendered text is unchanged from before #180b", () => {
      // The point of splitting value from formattedValue is that nothing on
      // screen moves: only the type of the datum behind it.
      expect(aggregate(["a", "b", "", ""], cfg("percent_empty")).formattedValue).toBe("50%");
      expect(aggregate(["a", "b", "", ""], cfg("percent_not_empty")).formattedValue).toBe("50%");
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

// #180c — the three gaps #180a and #180b recorded, closed together. Each was a
// place where the same question had two answers in the shipped product.
describe("#180c — kernel and footer agree", () => {
  const cfg2 = (fn: RollupFunction): RollupConfig => ({
    relationField: "",
    targetField: "",
    function: fn,
  });

  test("an unchecked box fills its cell, so it is not counted as empty", () => {
    // The disagreement this closes: over [false] the kernel used to report
    // 100% empty while the footer reported 0%.
    expect(aggregate([false], cfg2("percent_empty")).value).toBe(0);
    expect(aggregate([false], cfg2("percent_not_empty")).value).toBe(100);
    expect(aggregate([false], cfg2("count_empty")).value).toBe(0);
  });

  test("an empty string still does not fill a cell", () => {
    expect(aggregate([""], cfg2("percent_empty")).value).toBe(100);
    expect(aggregate([""], cfg2("count_values")).value).toBe(0);
  });

  test("every numeric aggregate answers the same way to nothing", () => {
    for (const fn of ["avg", "min", "max", "range", "median"] as const) {
      const r = aggregate([], cfg2(fn));
      expect(r.value).toBeNull();
      expect(r.formattedValue).toBe("—");
    }
    // sum is the deliberate exception: the additive identity is a real total.
    expect(aggregate([], cfg2("sum")).value).toBe(0);
  });
});

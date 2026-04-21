// src/ui/views/Database/engine/formulaEngine.test.ts

import {
  evaluateFormulaValue,
  validateFormulaExpression,
  getFormulaFunctions,
  evaluateFormulaWithError,
  isStyledValue,
} from "./formulaEngine";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";

function makeRecord(values: Record<string, unknown>): DataRecord {
  return { id: "test", values: values as DataRecord["values"] };
}

// ── Math functions ───────────────────────────────────────────

describe("formulaEngine — Math", () => {
  test("ROUND with decimals", () => {
    expect(evaluateFormulaValue("ROUND(3.14159, 2)", makeRecord({}))).toBe(3.14);
  });

  test("ROUND without decimals", () => {
    expect(evaluateFormulaValue("ROUND(3.7)", makeRecord({}))).toBe(4);
  });

  test("CEIL", () => {
    expect(evaluateFormulaValue("CEIL(4.1)", makeRecord({}))).toBe(5);
  });

  test("FLOOR", () => {
    expect(evaluateFormulaValue("FLOOR(4.9)", makeRecord({}))).toBe(4);
  });

  test("ABS", () => {
    expect(evaluateFormulaValue("ABS(-5)", makeRecord({}))).toBe(5);
  });

  test("SQRT", () => {
    expect(evaluateFormulaValue("SQRT(16)", makeRecord({}))).toBe(4);
  });

  test("SQRT of negative returns null", () => {
    expect(evaluateFormulaValue("SQRT(-1)", makeRecord({}))).toBeNull();
  });

  test("POWER", () => {
    expect(evaluateFormulaValue("POWER(2, 10)", makeRecord({}))).toBe(1024);
  });

  test("LOG natural", () => {
    const val = evaluateFormulaValue("LOG(1)", makeRecord({}));
    expect(val).toBe(0);
  });

  test("SIGN", () => {
    expect(evaluateFormulaValue("SIGN(-42)", makeRecord({}))).toBe(-1);
    expect(evaluateFormulaValue("SIGN(0)", makeRecord({}))).toBe(0);
    expect(evaluateFormulaValue("SIGN(7)", makeRecord({}))).toBe(1);
  });
});

// ── String functions ─────────────────────────────────────────

describe("formulaEngine — String", () => {
  test("TRIM", () => {
    expect(evaluateFormulaValue('TRIM("  hello  ")', makeRecord({}))).toBe("hello");
  });

  test("LOWER", () => {
    expect(evaluateFormulaValue('LOWER("Hello World")', makeRecord({}))).toBe("hello world");
  });

  test("UPPER", () => {
    expect(evaluateFormulaValue('UPPER("hello")', makeRecord({}))).toBe("HELLO");
  });

  test("LENGTH", () => {
    expect(evaluateFormulaValue('LENGTH("test")', makeRecord({}))).toBe(4);
  });

  test("CONTAINS returns boolean", () => {
    expect(evaluateFormulaValue('CONTAINS("hello world", "world")', makeRecord({}))).toBe(true);
    expect(evaluateFormulaValue('CONTAINS("hello", "xyz")', makeRecord({}))).toBe(false);
  });
});

// ── Date functions ───────────────────────────────────────────

describe("formulaEngine — Date", () => {
  test("YEAR", () => {
    const record = makeRecord({ d: "2024-06-15" });
    expect(evaluateFormulaValue("YEAR(d)", record)).toBe(2024);
  });

  test("MONTH", () => {
    const record = makeRecord({ d: "2024-06-15" });
    expect(evaluateFormulaValue("MONTH(d)", record)).toBe(6);
  });

  test("DAY", () => {
    const record = makeRecord({ d: "2024-06-15" });
    expect(evaluateFormulaValue("DAY(d)", record)).toBe(15);
  });

  test("DATE_BETWEEN in days", () => {
    const record = makeRecord({ start: "2024-01-01", end: "2024-01-10" });
    expect(evaluateFormulaValue('DATE_BETWEEN(start, end, "day")', record)).toBe(9);
  });

  test("FORMAT_DATE", () => {
    const record = makeRecord({ d: "2024-06-15" });
    const val = evaluateFormulaValue('FORMAT_DATE(d, "YYYY/MM/DD")', record);
    expect(val).toBe("2024/06/15");
  });
});

// ── Type conversion ──────────────────────────────────────────

describe("formulaEngine — Type conversion", () => {
  test("TO_NUMBER from string", () => {
    expect(evaluateFormulaValue('TO_NUMBER("42")', makeRecord({}))).toBe(42);
  });

  test("TO_NUMBER from non-numeric returns null", () => {
    expect(evaluateFormulaValue('TO_NUMBER("abc")', makeRecord({}))).toBeNull();
  });

  test("TO_TEXT from number", () => {
    expect(evaluateFormulaValue("TO_TEXT(42)", makeRecord({}))).toBe("42");
  });

  test("TO_DATE from string", () => {
    expect(evaluateFormulaValue('TO_DATE("2024-06-15")', makeRecord({}))).toBe("2024-06-15");
  });
});

// ── Conditional functions ────────────────────────────────────

describe("formulaEngine — Conditional", () => {
  test("IF true branch", () => {
    const record = makeRecord({ x: 10 });
    expect(evaluateFormulaValue('IF(x > 5, "big", "small")', record)).toBe("big");
  });

  test("IF false branch", () => {
    const record = makeRecord({ x: 2 });
    expect(evaluateFormulaValue('IF(x > 5, "big", "small")', record)).toBe("small");
  });

  test("EMPTY", () => {
    expect(evaluateFormulaValue("EMPTY(x)", makeRecord({ x: null }))).toBe(true);
    expect(evaluateFormulaValue("EMPTY(x)", makeRecord({ x: "hello" }))).toBe(false);
  });
});

// ── Field references ─────────────────────────────────────────

describe("formulaEngine — Fields", () => {
  test("arithmetic with field values", () => {
    const record = makeRecord({ a: 10, b: 3 });
    expect(evaluateFormulaValue("a + b", record)).toBe(13);
    expect(evaluateFormulaValue("a * b", record)).toBe(30);
  });

  test("division by zero returns null", () => {
    const record = makeRecord({ a: 10, b: 0 });
    expect(evaluateFormulaValue("a / b", record)).toBeNull();
  });

  test("null field results in 0 (Number(null) = 0)", () => {
    const record = makeRecord({ a: null });
    expect(evaluateFormulaValue("ABS(a)", record)).toBe(0);
  });
});

// ── Validation ───────────────────────────────────────────────

describe("formulaEngine — Validation", () => {
  test("valid expression returns no errors", () => {
    const errors = validateFormulaExpression("a + b", ["a", "b"]);
    expect(errors).toHaveLength(0);
  });

  test("unknown field returns error", () => {
    const errors = validateFormulaExpression("a + unknown", ["a"]);
    expect(errors).toContainEqual(expect.stringContaining("Unknown field"));
  });

  test("syntax error returns error", () => {
    const errors = validateFormulaExpression("((( broken", []);
    expect(errors.length).toBeGreaterThan(0);
  });

  test("getFormulaFunctions returns known functions", () => {
    const fns = getFormulaFunctions();
    expect(fns).toContain("ROUND");
    expect(fns).toContain("IF");
    expect(fns).toContain("TODAY");
    expect(fns).toContain("TO_NUMBER");
  });
});

// ── Error resilience ─────────────────────────────────────────

describe("formulaEngine — Error resilience", () => {
  test("invalid expression returns null", () => {
    expect(evaluateFormulaValue("!!!invalid", makeRecord({}))).toBeNull();
  });

  test("empty expression returns null", () => {
    expect(evaluateFormulaValue("", makeRecord({}))).toBeNull();
  });
});

// ── Wave 2: Financial functions ──────────────────────────────

describe("formulaEngine — Financial", () => {
  test("PMT calculates monthly payment (negative = outflow)", () => {
    // PMT(rate, nper, pv) — standard convention: payments are negative (outflows)
    const result = evaluateFormulaValue("PMT(0.05 / 12, 360, 200000)", makeRecord({}));
    expect(result).toBeCloseTo(-1073.64, 1);
  });

  test("FV calculates future value", () => {
    // FV(rate, nper, pmt) — standard convention: result is negative when pmt is positive
    const result = evaluateFormulaValue("FV(0.01, 12, 100)", makeRecord({}));
    expect(typeof result).toBe("number");
    expect(Math.abs(result as number)).toBeGreaterThan(1200);
  });

  test("PV calculates present value", () => {
    // PV(rate, nper, pmt) — 5%/12 rate, 360 periods, 1073.64 payment
    const result = evaluateFormulaValue("PV(0.05 / 12, 360, 1073.64)", makeRecord({}));
    expect(typeof result).toBe("number");
    expect(Math.abs(result as number)).toBeCloseTo(200000, -2);
  });

  test("NPV calculates net present value", () => {
    // NPV(rate, cf1, cf2, cf3)
    const result = evaluateFormulaValue("NPV(0.1, 100, 200, 300)", makeRecord({}));
    expect(typeof result).toBe("number");
    expect(result as number).toBeGreaterThan(450);
  });

  test("IRR calculates internal rate of return", () => {
    // IRR(-1000, 300, 420, 680)
    const result = evaluateFormulaValue("IRR(-1000, 300, 420, 680)", makeRecord({}));
    expect(typeof result).toBe("number");
    // IRR should be positive since total inflows > outflow
    expect(result as number).toBeGreaterThan(0);
  });

  test("NPER calculates number of periods", () => {
    // NPER(rate=0, pmt=-100, pv=1000) — zero rate = simple division
    const result = evaluateFormulaValue("NPER(0, -100, 1000)", makeRecord({}));
    expect(result).toBe(10);
  });
});

// ── Wave 2: Statistical functions ────────────────────────────

describe("formulaEngine — Statistical", () => {
  test("VARIANCE (population)", () => {
    const result = evaluateFormulaValue("VARIANCE(2, 4, 4, 4, 5, 5, 7, 9)", makeRecord({}));
    expect(result).toBeCloseTo(4.0, 1);
  });

  test("VARIANCE_S (sample)", () => {
    const result = evaluateFormulaValue("VARIANCE_S(2, 4, 4, 4, 5, 5, 7, 9)", makeRecord({}));
    expect(typeof result).toBe("number");
    expect(result as number).toBeCloseTo(4.571, 1);
  });

  test("PERCENTILE", () => {
    const result = evaluateFormulaValue("PERCENTILE(1, 2, 3, 4, 5, 0.5)", makeRecord({}));
    expect(result).toBe(3);
  });

  test("QUARTILE", () => {
    const result = evaluateFormulaValue("QUARTILE(1, 2, 3, 4, 5, 2)", makeRecord({}));
    // Q2 = median
    expect(result).toBe(3);
  });

  test("MODE returns most frequent", () => {
    const result = evaluateFormulaValue("MODE(1, 2, 2, 3, 3, 3, 4)", makeRecord({}));
    expect(result).toBe(3);
  });

  test("RANK returns position", () => {
    const result = evaluateFormulaValue("RANK(3, 1, 2, 3, 4, 5)", makeRecord({}));
    expect(result).toBe(3);
  });

  test("CORREL computes correlation", () => {
    // Perfect positive correlation
    const result = evaluateFormulaValue("CORREL(1, 2, 3, 4, 5, 6)", makeRecord({}));
    expect(typeof result).toBe("number");
  });

  test("STD_DEV_S (sample std dev)", () => {
    const result = evaluateFormulaValue("STD_DEV_S(2, 4, 4, 4, 5, 5, 7, 9)", makeRecord({}));
    expect(typeof result).toBe("number");
    expect(result as number).toBeCloseTo(2.138, 1);
  });
});

// ── Wave 2: Enhanced Math ────────────────────────────────────

describe("formulaEngine — Enhanced Math", () => {
  test("MEDIAN of odd count", () => {
    expect(evaluateFormulaValue("MEDIAN(3, 1, 2)", makeRecord({}))).toBe(2);
  });

  test("MEDIAN of even count", () => {
    expect(evaluateFormulaValue("MEDIAN(1, 2, 3, 4)", makeRecord({}))).toBe(2.5);
  });

  test("PRODUCT", () => {
    expect(evaluateFormulaValue("PRODUCT(2, 3, 4)", makeRecord({}))).toBe(24);
  });

  test("MOD", () => {
    expect(evaluateFormulaValue("MOD(10, 3)", makeRecord({}))).toBe(1);
  });

  test("EVEN rounds up to even", () => {
    expect(evaluateFormulaValue("EVEN(3)", makeRecord({}))).toBe(4);
    expect(evaluateFormulaValue("EVEN(4)", makeRecord({}))).toBe(4);
  });

  test("ODD rounds up to odd", () => {
    expect(evaluateFormulaValue("ODD(2)", makeRecord({}))).toBe(3);
    expect(evaluateFormulaValue("ODD(3)", makeRecord({}))).toBe(3);
  });

  test("PI returns pi", () => {
    expect(evaluateFormulaValue("PI()", makeRecord({}))).toBeCloseTo(3.14159, 4);
  });
});

// ── Wave 2: Enhanced String ──────────────────────────────────

describe("formulaEngine — Enhanced String", () => {
  test("LEFT extracts n chars from left", () => {
    expect(evaluateFormulaValue('LEFT("Hello World", 5)', makeRecord({}))).toBe("Hello");
  });

  test("RIGHT extracts n chars from right", () => {
    expect(evaluateFormulaValue('RIGHT("Hello World", 5)', makeRecord({}))).toBe("World");
  });

  test("MID extracts substring", () => {
    expect(evaluateFormulaValue('MID("Hello World", 6, 5)', makeRecord({}))).toBe("World");
  });

  test("REGEX_MATCH tests pattern", () => {
    expect(evaluateFormulaValue('REGEX_MATCH("abc123", "\\\\d+")', makeRecord({}))).toBe(true);
    expect(evaluateFormulaValue('REGEX_MATCH("abcdef", "\\\\d+")', makeRecord({}))).toBe(false);
  });

  test("JOIN concatenates with separator", () => {
    expect(evaluateFormulaValue('JOIN("-", "a", "b", "c")', makeRecord({}))).toBe("a-b-c");
  });

  test("REPEAT repeats string", () => {
    expect(evaluateFormulaValue('REPEAT("ab", 3)', makeRecord({}))).toBe("ababab");
  });

  test("ENCODE_URL encodes URI component", () => {
    expect(evaluateFormulaValue('ENCODE_URL("hello world")', makeRecord({}))).toBe("hello%20world");
  });
});

// ── Wave 2: Duration functions ───────────────────────────────

describe("formulaEngine — Duration", () => {
  test("DAYS returns numeric value", () => {
    // DAYS is an identity function for day-count values
    expect(evaluateFormulaValue("DAYS(30)", makeRecord({}))).toBe(30);
  });

  test("TO_DAYS returns numeric value", () => {
    // TO_DAYS is an identity/passthrough for day counts
    expect(evaluateFormulaValue("TO_DAYS(48)", makeRecord({}))).toBe(48);
  });

  test("TO_HOURS converts days to hours", () => {
    expect(evaluateFormulaValue("TO_HOURS(2)", makeRecord({}))).toBe(48);
  });
});

// ── Wave 2: Conditional Aggregation ──────────────────────────

describe("formulaEngine — Conditional Aggregation", () => {
  test("SUMIF sums matching values", () => {
    const result = evaluateFormulaValue("SUMIF(10, 20, 30, 20)", makeRecord({}));
    expect(result).toBe(20);
  });

  test("COUNTIF counts matching values", () => {
    // Last arg is criteria: COUNTIF(values..., criteria)
    const result = evaluateFormulaValue("COUNTIF(1, 2, 2, 3, 2)", makeRecord({}));
    expect(result).toBe(2);
  });
});

// ── Wave 2: Aggregate-aware (SUM, AVG, etc.) ────────────────

describe("formulaEngine — Aggregate-aware functions", () => {
  test("SUM adds numbers", () => {
    expect(evaluateFormulaValue("SUM(1, 2, 3, 4)", makeRecord({}))).toBe(10);
  });

  test("AVG computes average", () => {
    expect(evaluateFormulaValue("AVG(2, 4, 6)", makeRecord({}))).toBe(4);
  });

  test("COUNT counts values", () => {
    expect(evaluateFormulaValue("COUNT(1, 2, 3)", makeRecord({}))).toBe(3);
  });

  test("MIN finds minimum", () => {
    expect(evaluateFormulaValue("MIN(5, 3, 8, 1)", makeRecord({}))).toBe(1);
  });

  test("MAX finds maximum", () => {
    expect(evaluateFormulaValue("MAX(5, 3, 8, 1)", makeRecord({}))).toBe(8);
  });

  test("STD_DEV computes population standard deviation", () => {
    const result = evaluateFormulaValue("STD_DEV(2, 4, 4, 4, 5, 5, 7, 9)", makeRecord({}));
    expect(result).toBeCloseTo(2.0, 1);
  });
});

// ── Wave 2: Cross-record @reference ──────────────────────────

describe("formulaEngine — @reference", () => {
  const df = {
    fields: [
      { name: "score", type: DataFieldType.Number, identifier: false, derived: false, repeated: false },
    ],
    records: [
      { id: "r1", values: { score: 10 } },
      { id: "r2", values: { score: 20 } },
      { id: "r3", values: { score: 30 } },
    ],
  };

  test("AVG(@col) computes column average", () => {
    const result = evaluateFormulaValue("AVG(@score)", makeRecord({ score: 10 }), df);
    expect(result).toBe(20);
  });

  test("SUM(@col) computes column sum", () => {
    const result = evaluateFormulaValue("SUM(@score)", makeRecord({ score: 10 }), df);
    expect(result).toBe(60);
  });

  test("MIN(@col) finds column minimum", () => {
    const result = evaluateFormulaValue("MIN(@score)", makeRecord({ score: 10 }), df);
    expect(result).toBe(10);
  });

  test("MAX(@col) finds column maximum", () => {
    const result = evaluateFormulaValue("MAX(@score)", makeRecord({ score: 10 }), df);
    expect(result).toBe(30);
  });

  test("COUNT(@col) counts column values", () => {
    const result = evaluateFormulaValue("COUNT(@score)", makeRecord({ score: 10 }), df);
    expect(result).toBe(3);
  });

  test("@reference without dataFrame returns empty", () => {
    // AVG of empty array → null
    const result = evaluateFormulaValue("AVG(@score)", makeRecord({ score: 10 }));
    expect(result).toBeNull();
  });
});

// ── Wave 2: Conversion & Logic ───────────────────────────────

describe("formulaEngine — Conversion & Logic", () => {
  test("TO_CURRENCY formats number", () => {
    const result = evaluateFormulaValue("TO_CURRENCY(1234.5)", makeRecord({}));
    expect(typeof result).toBe("string");
    expect((result as string)).toContain("1");
  });

  test("TO_PERCENT formats as percentage", () => {
    const result = evaluateFormulaValue("TO_PERCENT(0.75)", makeRecord({}));
    expect(result).toBe("75.00%");
  });

  test("IFBLANK returns fallback when blank", () => {
    const rec = makeRecord({ a: "" });
    // Field references use bare names, not [brackets]
    expect(evaluateFormulaValue('IFBLANK(a, "default")', rec)).toBe("default");
  });

  test("IFBLANK returns value when not blank", () => {
    const rec = makeRecord({ a: "hello" });
    expect(evaluateFormulaValue('IFBLANK(a, "default")', rec)).toBe("hello");
  });
});

// ══════════════════════════════════════════════════════════════
// Wave 6 — Phase 6.1: LET, STYLE, MAP/FILTER/REDUCE, Errors
// ══════════════════════════════════════════════════════════════

describe("formulaEngine — LET (variable binding)", () => {
  test("LET binds variable and uses it in expression", () => {
    expect(evaluateFormulaValue('LET("x", 10, x + 5)', makeRecord({}))).toBe(15);
  });

  test("LET with bare identifier as variable name", () => {
    // Non-function identifiers work as variable names without quotes
    expect(evaluateFormulaValue("LET(myvar, 10, myvar + 5)", makeRecord({}))).toBe(15);
  });

  test("LET with field reference as value", () => {
    const rec = makeRecord({ price: 100, tax: 0.2 });
    expect(evaluateFormulaValue('LET("total", price * (1 + tax), total)', rec)).toBe(120);
  });

  test("nested LET chains", () => {
    const rec = makeRecord({ a: 10, b: 20 });
    // Variable names as string literals to avoid conflict with function names
    const result = evaluateFormulaWithError(
      'LET("total", a + b, LET("doubled", total * 2, doubled + 1))',
      rec
    );
    if (result.error) {
      // eslint-disable-next-line no-console
      console.error("Nested LET error:", result.error);
    }
    expect(result.value).toBe(61);
  });

  test("LET variable shadows field name", () => {
    const rec = makeRecord({ x: 999 });
    // LET("x", 5, ...) should shadow the field x=999
    expect(evaluateFormulaValue('LET("x", 5, x + 1)', rec)).toBe(6);
  });

  test("LET with string variable", () => {
    expect(
      evaluateFormulaValue('LET("label", "Budget", label + ": OK")', makeRecord({}))
    ).toBe("Budget: OK");
  });

  test("LET with too few args returns null", () => {
    expect(evaluateFormulaValue('LET("x", 10)', makeRecord({}))).toBeNull();
  });

  test("LET scope does not leak to sibling expressions", () => {
    const rec = makeRecord({ x: 42 });
    expect(evaluateFormulaValue("x", rec)).toBe(42);
    expect(evaluateFormulaValue('LET("x", 5, x)', rec)).toBe(5);
    // After LET, x should still resolve to field
    expect(evaluateFormulaValue("x", rec)).toBe(42);
  });
});

describe("formulaEngine — STYLE (visual formatting)", () => {
  test("STYLE returns StyledValue object", () => {
    const result = evaluateFormulaValue('STYLE("CRITICAL", "red", "b")', makeRecord({}));
    expect(isStyledValue(result)).toBe(true);
    if (isStyledValue(result)) {
      expect(result.text).toBe("CRITICAL");
      expect(result.cssClass).toContain("ppp-formula-red");
      expect(result.cssClass).toContain("ppp-formula-bold");
    }
  });

  test("STYLE with color only", () => {
    const result = evaluateFormulaValue('STYLE("Warning", "orange")', makeRecord({}));
    expect(isStyledValue(result)).toBe(true);
    if (isStyledValue(result)) {
      expect(result.text).toBe("Warning");
      expect(result.cssClass).toBe("ppp-formula-orange");
    }
  });

  test("STYLE with text only", () => {
    const result = evaluateFormulaValue('STYLE("Plain")', makeRecord({}));
    expect(isStyledValue(result)).toBe(true);
    if (isStyledValue(result)) {
      expect(result.text).toBe("Plain");
      expect(result.cssClass).toBe("");
    }
  });

  test("STYLE rejects unknown color (no injection)", () => {
    const result = evaluateFormulaValue(
      'STYLE("test", "color:red;background:black", "b")',
      makeRecord({})
    );
    expect(isStyledValue(result)).toBe(true);
    if (isStyledValue(result)) {
      // Unknown color should be ignored — no CSS class for it
      expect(result.cssClass).toBe("ppp-formula-bold");
    }
  });

  test("STYLE inside IF for conditional formatting", () => {
    const rec = makeRecord({ balance: -500 });
    const formula = 'IF(balance < 0, STYLE("DEFICIT", "red", "b"), STYLE("OK", "green"))';
    const result = evaluateFormulaValue(formula, rec);
    expect(isStyledValue(result)).toBe(true);
    if (isStyledValue(result)) {
      expect(result.text).toBe("DEFICIT");
      expect(result.cssClass).toContain("ppp-formula-red");
    }
  });
});

describe("formulaEngine — MAP/FILTER/REDUCE (list iteration)", () => {
  test("MAP doubles each element", () => {
    const rec = makeRecord({ scores: [10, 20, 30] });
    const result = evaluateFormulaValue("MAP(scores, x, x * 2)", rec);
    expect(result).toEqual([20, 40, 60]);
  });

  test("MAP with string list", () => {
    const rec = makeRecord({ tags: ["a", "b", "c"] });
    const result = evaluateFormulaValue('MAP(tags, t, t + "!")', rec);
    expect(result).toEqual(["a!", "b!", "c!"]);
  });

  test("FILTER keeps matching elements", () => {
    const rec = makeRecord({ values: [1, 5, 10, 15, 20] });
    const result = evaluateFormulaValue("FILTER(values, v, v > 8)", rec);
    expect(result).toEqual([10, 15, 20]);
  });

  test("FILTER returns empty array when none match", () => {
    const rec = makeRecord({ values: [1, 2, 3] });
    const result = evaluateFormulaValue("FILTER(values, v, v > 100)", rec);
    expect(result).toEqual([]);
  });

  test("REDUCE sums array", () => {
    const rec = makeRecord({ nums: [1, 2, 3, 4, 5] });
    const result = evaluateFormulaValue("REDUCE(nums, x, acc, 0, acc + x)", rec);
    expect(result).toBe(15);
  });

  test("REDUCE concatenates strings", () => {
    const rec = makeRecord({ words: ["hello", "world"] });
    const result = evaluateFormulaValue('REDUCE(words, w, acc, "", acc + w + " ")', rec);
    expect(typeof result).toBe("string");
    expect((result as string).trim()).toBe("hello world");
  });

  test("MAP + FILTER chained via LET", () => {
    const rec = makeRecord({ prices: [10, 25, 50, 75, 100] });
    // Double all prices, then keep only those > 40
    const formula = "LET(doubled, MAP(prices, p, p * 2), FILTER(doubled, d, d > 40))";
    const result = evaluateFormulaValue(formula, rec);
    expect(result).toEqual([50, 100, 150, 200]);
  });

  test("MAP on non-array wraps as single-element list", () => {
    const rec = makeRecord({ single: 42 });
    const result = evaluateFormulaValue("MAP(single, x, x + 1)", rec);
    expect(result).toEqual([43]);
  });

  test("REDUCE with too few args returns null", () => {
    expect(evaluateFormulaValue("REDUCE(nums, x, acc)", makeRecord({ nums: [1] }))).toBeNull();
  });
});

describe("formulaEngine — Error propagation", () => {
  test("evaluateFormulaWithError returns error on parse failure", () => {
    const result = evaluateFormulaWithError("UNKNOWN_FUNC(((", makeRecord({}));
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
  });

  test("evaluateFormulaWithError returns value on success", () => {
    const result = evaluateFormulaWithError("1 + 2", makeRecord({}));
    expect(result.value).toBe(3);
    expect(result.error).toBeUndefined();
  });

  test("evaluateFormulaWithError returns error on bad syntax", () => {
    const result = evaluateFormulaWithError("IF(", makeRecord({}));
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
  });

  test("validation recognizes new functions", () => {
    const fns = getFormulaFunctions();
    expect(fns).toContain("LET");
    expect(fns).toContain("STYLE");
    expect(fns).toContain("MAP");
    expect(fns).toContain("FILTER");
    expect(fns).toContain("REDUCE");
  });

  test("validation accepts STYLE in expression", () => {
    const errors = validateFormulaExpression('STYLE("ok", "green")', []);
    expect(errors).toEqual([]);
  });
});

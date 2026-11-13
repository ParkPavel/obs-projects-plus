/**
 * i3-final: conditional aggregates — oracles.
 *
 * Every expected number in the "oracle" blocks is the result Microsoft's own
 * documentation gives for that worksheet (SUMIF, COUNTIF, AVERAGEIF, SUMIFS,
 * COUNTIFS, AVERAGEIFS, MINIFS, MAXIFS help pages), not a value derived by
 * this code. A worksheet column is a `@column` of the frame; Excel's #DIV/0!
 * is an empty cell (null) here.
 */

import { DataFieldType, type DataFrame, type DataRecord } from "src/lib/dataframe/dataframe";
import { evaluateFormulaValue } from "src/lib/formula/extendedEvaluator";
import { compileCriterion, rowsWhere } from "src/lib/formula/criteria";
import { applyFormulaFields } from "src/lib/dashboard-engine/applyFormulaFields";

type Row = Record<string, unknown>;

function frame(rows: Row[]): DataFrame {
  const names = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return {
    fields: names.map((name) => ({
      name,
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    })),
    records: rows.map((values, i) => ({ id: `r${i}.md`, values })),
  } as unknown as DataFrame;
}

/** Evaluates `expr` the way a table formula column does, on the first row. */
function calc(df: DataFrame, expr: string, record?: DataRecord): unknown {
  return evaluateFormulaValue(expr, record ?? df.records[0] ?? { id: "x", values: {} }, df);
}

// ── SUMIF ────────────────────────────────────────────────────────────────
describe("SUMIF — Excel help oracles", () => {
  const property = frame([
    { value: 100000, commission: 7000 },
    { value: 200000, commission: 14000 },
    { value: 300000, commission: 21000 },
    { value: 400000, commission: 28000 },
  ]);

  it.each([
    ['SUMIF(@value, ">160000", @commission)', 63000],
    ['SUMIF(@value, ">160000")', 900000],
    ["SUMIF(@value, 300000, @commission)", 21000],
  ])("%s = %d", (expr, expected) => {
    expect(calc(property, expr)).toBe(expected);
  });

  const food = frame([
    { category: "Vegetables", food: "Tomatoes", sales: 2300 },
    { category: "Vegetables", food: "Celery", sales: 5500 },
    { category: "Fruits", food: "Oranges", sales: 800 },
    { category: null, food: "Butter", sales: 400 },
    { category: "Vegetables", food: "Carrots", sales: 4200 },
    { category: "Fruits", food: "Apples", sales: 1200 },
  ]);

  it.each([
    ['SUMIF(@category, "Fruits", @sales)', 2000],
    ['SUMIF(@category, "Vegetables", @sales)', 12000],
    ['SUMIF(@food, "*es", @sales)', 4300],
    ['SUMIF(@category, "", @sales)', 400],
  ])("%s = %d", (expr, expected) => {
    expect(calc(food, expr)).toBe(expected);
  });
});

// ── COUNTIF ──────────────────────────────────────────────────────────────
describe("COUNTIF — Excel help oracles", () => {
  const fruit = frame([
    { name: "apples", qty: 32 },
    { name: "oranges", qty: 54 },
    { name: "peaches", qty: 75 },
    { name: "apples", qty: 86 },
  ]);

  it.each([
    ['COUNTIF(@name, "apples")', 2],
    ['COUNTIF(@name, "peaches")', 1],
    ['COUNTIF(@qty, ">55")', 2],
    ['COUNTIF(@qty, "<>75")', 3],
    ['COUNTIF(@qty, ">=32") - COUNTIF(@qty, ">85")', 3],
    ['COUNTIF(@name, "*")', 4],
    ['COUNTIF(@name, "?????es")', 2],
  ])("%s = %d", (expr, expected) => {
    expect(calc(fruit, expr)).toBe(expected);
  });

  it("a criterion built from text and a number, as in \"<>\"&B4", () => {
    expect(calc(fruit, 'COUNTIF(@qty, "<>" + TO_TEXT(75))')).toBe(3);
  });
});

// ── AVERAGEIF ────────────────────────────────────────────────────────────
describe("AVERAGEIF — Excel help oracles", () => {
  const property = frame([
    { value: 100000, commission: 7000 },
    { value: 200000, commission: 14000 },
    { value: 300000, commission: 21000 },
    { value: 400000, commission: 28000 },
  ]);

  it.each([
    ['AVERAGEIF(@commission, "<23000")', 14000],
    ['AVERAGEIF(@value, "<250000")', 150000],
    ['AVERAGEIF(@value, ">250000", @commission)', 24500],
  ])("%s = %d", (expr, expected) => {
    expect(calc(property, expr)).toBe(expected);
  });

  it("#DIV/0! (nothing matches) is an empty cell", () => {
    expect(calc(property, 'AVERAGEIF(@value, "<95000")')).toBeNull();
  });
});

// ── SUMIFS / COUNTIFS / AVERAGEIFS / MINIFS / MAXIFS ─────────────────────
describe("SUMIFS — Excel help oracles", () => {
  const sales = frame([
    { qty: 5, product: "Apples", who: "Tom" },
    { qty: 4, product: "Apples", who: "Sarah" },
    { qty: 15, product: "Artichokes", who: "Tom" },
    { qty: 3, product: "Artichokes", who: "Sarah" },
    { qty: 22, product: "Bananas", who: "Tom" },
    { qty: 12, product: "Bananas", who: "Sarah" },
    { qty: 10, product: "Carrots", who: "Tom" },
    { qty: 33, product: "Carrots", who: "Sarah" },
  ]);

  it.each([
    ['SUMIFS(@qty, @product, "=A*", @who, "Tom")', 20],
    ['SUMIFS(@qty, @product, "<>Bananas", @who, "Tom")', 30],
  ])("%s = %d", (expr, expected) => {
    expect(calc(sales, expr)).toBe(expected);
  });

  it("an even number of arguments is not a SUMIFS", () => {
    expect(calc(sales, 'SUMIFS(@qty, @product, "Apples", @who)')).toBeNull();
    expect(calc(sales, "SUMIFS(@qty)")).toBeNull();
  });
});

describe("COUNTIFS — Excel help oracles", () => {
  const quarters = frame([
    { who: "Davidoski", q1: "Yes", q2: "No", q3: "No" },
    { who: "Burke", q1: "Yes", q2: "Yes", q3: "No" },
    { who: "Sundaram", q1: "Yes", q2: "Yes", q3: "Yes" },
    { who: "Levitan", q1: "No", q2: "Yes", q3: "Yes" },
  ]);

  it.each([
    ['COUNTIFS(@q1, "=Yes", @q2, "=Yes")', 2],
    ['COUNTIFS(@q1, "=Yes", @q2, "=Yes", @q3, "=Yes")', 1],
  ])("%s = %d", (expr, expected) => {
    expect(calc(quarters, expr)).toBe(expected);
  });

  const days = frame([1, 2, 3, 4, 5, 6].map((n) => ({ n, day: new Date(2011, 4, n) })));

  it.each([
    ['COUNTIFS(@n, "<6", @n, ">1")', 4],
    ['COUNTIFS(@n, "<5", @day, "<2011-05-03")', 2],
  ])("%s = %d", (expr, expected) => {
    expect(calc(days, expr)).toBe(expected);
  });

  it("an odd number of arguments is not a COUNTIFS", () => {
    expect(calc(quarters, 'COUNTIFS(@q1, "Yes", @q2)')).toBeNull();
  });
});

describe("AVERAGEIFS — Excel help oracles", () => {
  const quiz = frame([
    { student: "Emilio", first: 75, second: 85, final: 87 },
    { student: "Julie", first: 94, second: 80, final: 88 },
    { student: "Hans", first: 86, second: 93, final: "Incomplete" },
    { student: "Frederique", first: "Incomplete", second: 75, final: 75 },
  ]);

  it("AVERAGEIFS(@first, @first, \">70\", @first, \"<90\") = 80.5", () => {
    expect(calc(quiz, 'AVERAGEIFS(@first, @first, ">70", @first, "<90")')).toBe(80.5);
  });
  it("AVERAGEIFS(@final, @final, \"<>Incomplete\", @final, \">80\") = 87.5", () => {
    expect(calc(quiz, 'AVERAGEIFS(@final, @final, "<>Incomplete", @final, ">80")')).toBe(87.5);
  });
  it("#DIV/0! is an empty cell", () => {
    expect(calc(quiz, 'AVERAGEIFS(@second, @second, ">95")')).toBeNull();
  });
});

describe("MINIFS / MAXIFS — Excel help oracles", () => {
  const grades = frame([
    { grade: 89, weight: 1 },
    { grade: 93, weight: 2 },
    { grade: 96, weight: 2 },
    { grade: 85, weight: 3 },
    { grade: 91, weight: 1 },
    { grade: 88, weight: 1 },
  ]);

  it("MINIFS(@grade, @weight, 1) = 88", () => {
    expect(calc(grades, "MINIFS(@grade, @weight, 1)")).toBe(88);
  });
  it("MAXIFS(@grade, @weight, 1) = 91", () => {
    expect(calc(grades, "MAXIFS(@grade, @weight, 1)")).toBe(91);
  });
  it("no matching row gives 0, as Excel does", () => {
    expect(calc(grades, "MINIFS(@grade, @weight, 9)")).toBe(0);
    expect(calc(grades, "MAXIFS(@grade, @weight, 9)")).toBe(0);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────
describe("conditional aggregates — edge cases", () => {
  it("an empty table: sums and counts are 0, an average is empty", () => {
    const empty = frame([]);
    expect(calc(empty, 'SUMIF(@a, ">0")')).toBe(0);
    expect(calc(empty, 'COUNTIF(@a, ">0")')).toBe(0);
    expect(calc(empty, 'AVERAGEIF(@a, ">0")')).toBeNull();
    expect(calc(empty, 'SUMIFS(@a, @b, "x")')).toBe(0);
    expect(calc(empty, 'COUNTIFS(@a, "x")')).toBe(0);
  });

  it("numbers written as text are numbers; other text is ignored by the sum", () => {
    const mixed = frame([
      { status: "done", amount: "10" },
      { status: "Done", amount: 5 },
      { status: "done", amount: "n/a" },
      { status: "open", amount: 100 },
      { status: "done", amount: null },
      { status: "done", amount: true },
    ]);
    expect(calc(mixed, 'SUMIF(@status, "done", @amount)')).toBe(15);
    expect(calc(mixed, 'COUNTIF(@status, "done")')).toBe(5);
    expect(calc(mixed, 'AVERAGEIF(@status, "done", @amount)')).toBe(7.5);
    expect(calc(mixed, "COUNTIF(@amount, 10)")).toBe(1);
    expect(calc(mixed, 'COUNTIF(@amount, ">=5")')).toBe(3);
  });

  it("blank and non-blank criteria", () => {
    const df = frame([{ a: "" }, { a: null }, { a: "x" }, { a: 0 }, { a: [] }]);
    expect(calc(df, 'COUNTIF(@a, "")')).toBe(3);
    expect(calc(df, 'COUNTIF(@a, "<>")')).toBe(2);
    expect(calc(df, 'COUNTIF(@a, "<>x")')).toBe(4);
  });

  it("text comparison is alphabetical and never matches a number", () => {
    const df = frame([{ a: "apple" }, { a: "Banana" }, { a: "cherry" }, { a: 7 }]);
    expect(calc(df, 'COUNTIF(@a, ">b")')).toBe(2);
    expect(calc(df, 'COUNTIF(@a, "<=apple")')).toBe(1);
  });

  it("~ escapes a wildcard; ? is exactly one character", () => {
    const df = frame([{ a: "a*b" }, { a: "axb" }, { a: "ab" }]);
    expect(calc(df, 'COUNTIF(@a, "a~*b")')).toBe(1);
    expect(calc(df, 'COUNTIF(@a, "a*b")')).toBe(3);
    expect(calc(df, 'COUNTIF(@a, "a?b")')).toBe(2);
  });

  it("logical values, list cells and wikilinks", () => {
    const df = frame([
      { done: true, tags: ["work", "urgent"], owner: "[[people/Ann|Ann]]" },
      { done: false, tags: ["home"], owner: "[[Bob]]" },
      { done: "TRUE", tags: [], owner: "Ann" },
    ]);
    expect(calc(df, "COUNTIF(@done, TRUE)")).toBe(2);
    expect(calc(df, 'COUNTIF(@done, "FALSE")')).toBe(1);
    expect(calc(df, 'COUNTIF(@tags, "urgent")')).toBe(1);
    expect(calc(df, 'COUNTIF(@tags, "<>urgent")')).toBe(2);
    expect(calc(df, 'COUNTIF(@owner, "ann")')).toBe(2);
    expect(calc(df, 'COUNTIF(@owner, "bob")')).toBe(1);
  });

  it("ranges of different lengths: a missing cell is blank", () => {
    const df = frame([{ a: 1, b: "x" }, { a: 2, b: "x" }]);
    const rec = { id: "r", values: { list: [1, 2, 3] } } as unknown as DataRecord;
    expect(evaluateFormulaValue('COUNTIFS(list, ">0", @b, "x")', rec, df)).toBe(2);
  });

  it("a list value works as a range when there is no @column", () => {
    const rec = { id: "r", values: { scores: [3, 8, 12, "x"] } } as unknown as DataRecord;
    expect(evaluateFormulaValue('SUMIF(scores, ">5")', rec)).toBe(20);
    expect(evaluateFormulaValue('COUNTIF(scores, "x")', rec)).toBe(1);
  });

  it("the older variadic form still answers: F(v1, v2, …, criteria)", () => {
    const rec = { id: "r", values: {} } as unknown as DataRecord;
    expect(evaluateFormulaValue("SUMIF(10, 20, 30, 20)", rec)).toBe(20);
    expect(evaluateFormulaValue("COUNTIF(1, 2, 2, 3, 2)", rec)).toBe(2);
    expect(evaluateFormulaValue('COUNTIF(1, 2, 2, 3, ">1")', rec)).toBe(3);
    expect(evaluateFormulaValue("AVERAGEIF(4, 6, 9, 4)", rec)).toBe(4);
    expect(evaluateFormulaValue("SUMIF(1)", rec)).toBeNull();
  });

  it("a column name matches without regard to case", () => {
    const df = frame([{ Amount: 4 }, { Amount: 6 }]);
    expect(calc(df, 'SUMIF(@amount, ">5")')).toBe(6);
  });

  it("per-row criterion: a group total next to every record", () => {
    const df = frame([
      { team: "a", spent: 2 },
      { team: "b", spent: 5 },
      { team: "a", spent: 3 },
    ]);
    const out = applyFormulaFields(df, [{ name: "teamTotal", expression: "SUMIF(@team, team, @spent)" }] as never);
    expect(out.records.map((r) => r.values["teamTotal"])).toEqual([5, 5, 5]);
    const share = applyFormulaFields(df, [{ name: "share", expression: "spent / SUMIF(@team, team, @spent)" }] as never);
    expect(share.records.map((r) => r.values["share"])).toEqual([0.4, 1, 0.6]);
  });
});

describe("rowsWhere — remembered scans", () => {
  it("a frozen range (a pass's column) is scanned once per criteria value", () => {
    const col = Object.freeze(["a", "b", "a"]);
    const first = rowsWhere(col, "a", compileCriterion("a"));
    expect(first).toEqual([0, 2]);
    expect(rowsWhere(col, "a", () => false)).toBe(first);
    expect(rowsWhere(col, "b", compileCriterion("b"))).toEqual([1]);
  });

  it("a range that may change (not frozen) is scanned every time", () => {
    const list = ["a", "b"];
    expect(rowsWhere(list, "a", compileCriterion("a"))).toEqual([0]);
    list[1] = "a";
    expect(rowsWhere(list, "a", compileCriterion("a"))).toEqual([0, 1]);
  });
});

describe("compileCriterion — the criteria language", () => {
  it.each([
    [5, 5, true],
    [5, "5", true],
    ["=5", 5.0, true],
    [">=5", 5, true],
    [">5", 5, false],
    ["<>5", 4, true],
    ["<>5", null, true],
    ["done", "DONE", true],
    ["=done", "done ", false],
    ["d*e", "done", true],
    ["d?ne", "done", true],
    ["*", 12, false],
    ["", null, true],
    ["", "", true],
    ["", 0, false],
    ["<>", "", false],
    [null, undefined, true],
    [true, "true", true],
    ["2026-01-31", new Date(2026, 0, 31, 15, 0), true],
    [">2026-01-31", "2026-02-01", true],
    ["<2026-01-31", "2026-02-01", false],
    [Number.NaN, Number.NaN, false],
  ] as Array<[unknown, unknown, boolean]>)("criterion %p on cell %p → %p", (criterion, cell, expected) => {
    expect(compileCriterion(criterion)(cell)).toBe(expected);
  });
});

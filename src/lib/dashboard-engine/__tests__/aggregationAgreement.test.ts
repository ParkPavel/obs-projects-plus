/**
 * Three vocabularies, one arithmetic.
 *
 * The pipeline (`AggregationFunction`, UPPERCASE, `computeAggFn`), the rollup
 * kernel (`RollupFunction`, `aggregate.ts`) and the table footers / stats
 * cards (`ColumnAggregation`, `computeAggregateValue`) share no code for
 * several functions (transformTypes.ts says so). A user sees the same column
 * summed in a chart, a rollup and a footer, so the three must agree digit for
 * digit, and the properties below must hold in each:
 *
 * - the sum of the parts is the total;
 * - an empty population is empty, not 0;
 * - percentages are on 0..100.
 */

import { DataFieldType, type DataFrame, type DataRecord, type DataValue } from "src/lib/dataframe/dataframe";
import { matchesCondition } from "src/lib/engine/filterEvaluator";
import type { FilterCondition } from "src/settings/base/settings";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type { AggregationFunction } from "src/lib/dashboard-engine/transformTypes";
import { aggregate, type RollupFunction } from "src/lib/engine/aggregate";
import { computeAggregateValue, computeAggregations } from "src/lib/dashboard-engine/aggregation";
import type { ColumnAggregation } from "src/ui/views/Dashboard/types";

function frame(values: Array<DataValue | null>, groups?: string[]): DataFrame {
  return {
    fields: [
      { name: "v", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "g", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records: values.map((v, i) => ({ id: `r${i}.md`, values: { v, g: groups?.[i] ?? "all" } })),
  } as unknown as DataFrame;
}

function pipeline(values: Array<DataValue | null>, fn: AggregationFunction): unknown {
  const out = executeTransform(frame(values), {
    steps: [{ type: "aggregate", columns: [{ sourceField: "v", outputName: "out", function: fn }] }],
  }).data;
  return out.records[0]?.values["out"] ?? null;
}
const kernel = (values: Array<DataValue | null>, fn: RollupFunction) =>
  aggregate(values, { relationField: "", targetField: "", function: fn }).value;
const footer = (values: Array<DataValue | null>, fn: ColumnAggregation) => computeAggregateValue(values, fn);

// Deterministic, awkward data: negatives, a fraction that does not sum
// exactly in binary, a text cell, a missing cell.
const DATA: Array<DataValue | null> = [12.5, -3, 0.1, 0.2, 7, null, "n/a", 40, -0.3, 19];
const NUMS = [12.5, -3, 0.1, 0.2, 7, 40, -0.3, 19];
const SUM = NUMS.reduce((a, b) => a + b, 0);
const SORTED = [...NUMS].sort((a, b) => a - b);

const CASES: Array<[string, AggregationFunction, RollupFunction, ColumnAggregation, number]> = [
  ["sum", "SUM", "sum", "sum", SUM],
  ["average", "AVG", "avg", "avg", SUM / NUMS.length],
  ["median", "MEDIAN", "median", "median", (SORTED[3]! + SORTED[4]!) / 2],
  ["minimum", "MIN", "min", "min", -3],
  ["maximum", "MAX", "max", "max", 40],
  ["range", "RANGE", "range", "range", 43],
];

describe("pipeline, rollup kernel and footer agree on the same numbers", () => {
  test.each(CASES)("%s", (_name, pipe, roll, foot, expected) => {
    expect(Number(pipeline(DATA, pipe))).toBeCloseTo(expected, 12);
    expect(Number(kernel(DATA, roll))).toBeCloseTo(expected, 12);
    expect(Number(footer(DATA, foot))).toBeCloseTo(expected, 12);
  });
});

describe("an empty population is empty, not 0", () => {
  const EMPTY: Array<DataValue | null> = [null, null];
  test.each(CASES.filter(([name]) => name !== "sum"))("%s of no numbers", (_name, pipe, roll, foot) => {
    expect(pipeline(EMPTY, pipe)).toBeNull();
    expect(kernel(EMPTY, roll)).toBeNull();
    expect(footer(EMPTY, foot)).toBeNull();
  });
});

describe("the sum of the parts is the total", () => {
  test("group sums add up to the ungrouped sum", () => {
    const groups = ["a", "b", "a", "c", "b", "a", "c", "b", "a", "c"];
    const grouped = executeTransform(frame(DATA, groups), {
      steps: [
        { type: "group-by", fields: ["g"] },
        { type: "aggregate", columns: [{ sourceField: "v", outputName: "s", function: "SUM" }] },
      ],
    }).data.records.map((r) => Number(r.values["s"]));
    expect(grouped).toHaveLength(3);
    expect(grouped.reduce((a, b) => a + b, 0)).toBeCloseTo(SUM, 12);
  });

  test("group counts add up to the row count", () => {
    const groups = ["a", "b", "a", "c", "b", "a", "c", "b", "a", "c"];
    const counts = executeTransform(frame(DATA, groups), {
      steps: [
        { type: "group-by", fields: ["g"] },
        { type: "aggregate", columns: [{ sourceField: "v", outputName: "n", function: "COUNT" }] },
      ],
    }).data.records.map((r) => Number(r.values["n"]));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(DATA.length);
  });
});

describe("an aggregate without a group-by is a group-by on one shared key", () => {
  // A list held in a record is one element of the group, on both roads:
  // flattening it would make [[1,2], 3] sum to 6 here and 3 everywhere else.
  const LISTY: Array<DataValue | null> = [[1, 2] as unknown as DataValue, 3];
  test.each([["SUM", "sum"], ["COUNT", "count_total"]] as Array<[AggregationFunction, RollupFunction]>)(
    "%s over a list-valued record and a scalar",
    (pipe, roll) => {
      const ungrouped = pipeline(LISTY, pipe);
      const grouped = executeTransform(frame(LISTY), {
        steps: [
          { type: "group-by", fields: ["g"] },
          { type: "aggregate", columns: [{ sourceField: "v", outputName: "out", function: pipe }] },
        ],
      }).data.records[0]!.values["out"];
      expect(ungrouped).toEqual(grouped);
      expect(ungrouped).toEqual(kernel(LISTY, roll));
    }
  );
});

describe("a single record is a population of one", () => {
  test("one empty cell: COUNT 1, 100% empty — the same as a group of one", () => {
    expect(pipeline([null], "COUNT")).toBe(1);
    expect(Number(pipeline([null], "PCT_EMPTY"))).toBeCloseTo(100, 12);
    expect(Number(pipeline([null], "PCT_NOT_EMPTY"))).toBeCloseTo(0, 12);
  });
});

describe("percentages are on 0..100", () => {
  test("one definition of a checked box in the kernel and the footer", () => {
    // true and the quoted word "true" are checked, false and "false" are not;
    // other text is not a box and stays out of the denominator: 2 of 3.
    const cells: Array<DataValue | null> = [true, "true", false, "n/a"];
    expect(Number(kernel(cells, "percent_true"))).toBeCloseTo(200 / 3, 12);
    expect(Number(footer(cells, "percent_checked"))).toBeCloseTo(200 / 3, 12);
    expect(Number(footer(cells, "count_checked"))).toBe(2);
  });

  test("the table footer row reads boxes by the same definition as the stats cards", () => {
    // computeAggregations (the footer row) and computeAggregateValue (stats
    // cards) are two paths; math-recheck found the footer still ignoring the
    // quoted words.
    const cells: Array<DataValue | null> = ["true", "false"];
    const row = (fn: ColumnAggregation) => computeAggregations(frame(cells), { v: fn })["v"]!.value;
    for (const fn of ["count_checked", "count_unchecked", "percent_checked", "percent_unchecked"] as ColumnAggregation[]) {
      expect(row(fn)).toEqual(footer(cells, fn));
    }
    expect(row("count_checked")).toBe(1);
    expect(Number(row("percent_checked"))).toBeCloseTo(50, 12);
  });

  test("1 checked of 100 is 1, in the kernel and the footer", () => {
    const flags: DataValue[] = Array.from({ length: 100 }, (_, i) => i === 0);
    expect(Number(kernel(flags, "percent_true"))).toBeCloseTo(1, 12);
    expect(Number(footer(flags, "percent_checked"))).toBeCloseTo(1, 12);
  });
  test("the pipeline's share of filled cells is on the same scale", () => {
    const cells: Array<DataValue | null> = [1, null, null, null];
    expect(Number(pipeline(cells, "PCT_NOT_EMPTY"))).toBeCloseTo(25, 12);
    expect(Number(kernel(cells, "percent_not_empty"))).toBeCloseTo(25, 12);
    expect(Number(footer(cells, "percent_not_empty"))).toBeCloseTo(25, 12);
  });
});

describe("filtering and counting agree on what a checked box is", () => {
  const rec = (v: DataValue | null) => ({ id: "r.md", values: { v } }) as unknown as DataRecord;
  const cond = (operator: string) => ({ field: "v", operator, enabled: true }) as unknown as FilterCondition;
  test.each([
    [true, true], ["true", true], [" TRUE ", true],
    [false, false], ["false", false], ["n/a", null], [null, null],
  ] as Array<[DataValue | null, boolean | null]>)("%p", (value, box) => {
    const checked = matchesCondition(cond("is-checked"), rec(value));
    const unchecked = matchesCondition(cond("is-not-checked"), rec(value));
    expect(checked).toBe(box === true);
    expect(unchecked).toBe(box === false);
    expect(Number(footer([value], "count_checked"))).toBe(box === true ? 1 : 0);
  });
});

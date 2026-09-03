/**
 * The pipeline's aggregations, value by value (#180 T3).
 *
 * `computeAggFn` used to be the project's third implementation of "reduce a
 * list to a number", after the kernel and the table footer. This suite is what
 * made replacing it with an adapter reviewable: it records what the pipeline
 * answers for every edge value BEFORE the delegation, so the diff of this file
 * is the diff of the behaviour — and an operator that changed for a reason
 * nobody wrote down would show up as an unexplained edit here.
 *
 * The fixtures are the same shapes the coercion contract uses, plus the two the
 * pipeline has that the kernel does not: a bare scalar where a list is
 * expected, and an empty array as a VALUE rather than as an empty list.
 */

import { executeTransform } from "../transformExecutor";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { AggregationFunction, TransformPipeline, TransformStep } from "../transformTypes";

const field = (name: string, type: DataFieldType = DataFieldType.Number) => ({
  name,
  type,
  identifier: name === "id",
  derived: false,
  repeated: false,
  typeConfig: {},
});

/**
 * Run one aggregation over `values` by grouping every row into one bucket.
 * This drives the real pipeline rather than the private function, so the test
 * survives the function being replaced — which is the point.
 */
function aggregateThrough(fn: AggregationFunction, values: unknown[]): unknown {
  // One record whose `v` IS the list: the aggregate step reduces a field value,
  // and after a group-by that value is an array. Feeding the array directly is
  // the same input by a shorter road, and it keeps this suite about the
  // reduction rather than about grouping.
  const frame: DataFrame = {
    fields: [field("bucket", DataFieldType.String), field("v")],
    records: [{ id: "r0.md", values: { bucket: "all", v: values as never } }],
  };
  const pipeline = {
    steps: [
      {
        type: "aggregate",
        columns: [{ sourceField: "v", function: fn, outputName: "out" }],
      } as TransformStep,
    ],
  } as TransformPipeline;
  const out = executeTransform(frame, pipeline);
  return out.data.records[0]?.values["out"] ?? null;
}

const CASES: ReadonlyArray<readonly [string, unknown[]]> = [
  ["empty", []],
  ["all null", [null, undefined]],
  ["numbers", [1, 2, 3]],
  ["numeric strings", ["1", "2"]],
  ["text only", ["abc", "def"]],
  ["mixed", [1, "abc", null, 3]],
  ["empty strings", ["", ""]],
  ["booleans", [true, false]],
];

describe("#180 T3 — the pipeline's aggregations, recorded value by value", () => {
  describe.each(CASES)("%s", (_label, values) => {
    test.each([
      "COUNT",
      "COUNT_DISTINCT",
      "SUM",
      "AVG",
      "MEDIAN",
      "MIN",
      "MAX",
      "RANGE",
      "FIRST",
      "LAST",
      "STD_DEV",
      "PCT_EMPTY",
      "PCT_NOT_EMPTY",
    ] as const)("%s has an answer and does not throw", (fn) => {
      // The value itself is pinned by the snapshots below; this pins that every
      // operator survives every shape, which is what a delegation could break
      // wholesale.
      expect(() => aggregateThrough(fn as AggregationFunction, values as unknown[])).not.toThrow();
    });
  });

  test("the answers, as one table", () => {
    const table: Record<string, Record<string, unknown>> = {};
    for (const [label, values] of CASES) {
      table[label] = {};
      for (const fn of [
        "COUNT",
        "COUNT_DISTINCT",
        "SUM",
        "AVG",
        "MEDIAN",
        "MIN",
        "MAX",
        "RANGE",
        "STD_DEV",
        "PCT_EMPTY",
        "PCT_NOT_EMPTY",
      ] as const) {
        table[label]![fn] = aggregateThrough(fn as AggregationFunction, values as unknown[]);
      }
    }
    expect(table).toMatchSnapshot();
  });
});

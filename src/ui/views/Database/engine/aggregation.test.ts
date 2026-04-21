// src/ui/views/Database/engine/aggregation.test.ts

import { computeAggregations } from "./aggregation";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";

function makeFrame(overrides?: Partial<DataFrame>): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "budget", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "done", type: DataFieldType.Boolean, repeated: false, identifier: false, derived: false },
      { name: "due", type: DataFieldType.Date, repeated: false, identifier: false, derived: false },
    ],
    records: [
      {
        id: "a.md",
        values: { name: "Alpha", budget: 5000, done: true, due: new Date("2026-04-01") },
      },
      {
        id: "b.md",
        values: { name: "Beta", budget: 3000, done: false, due: new Date("2026-05-15") },
      },
      {
        id: "c.md",
        values: { name: "Gamma", budget: 8000, done: true, due: new Date("2026-06-01") },
      },
    ],
    ...overrides,
  };
}

describe("ColumnAggregationEngine", () => {
  const frame = makeFrame();

  test("count returns total number of records", () => {
    const result = computeAggregations(frame, { name: "count" });
    expect(result["name"]?.value).toBe(3);
  });

  test("sum returns correct total", () => {
    const result = computeAggregations(frame, { budget: "sum" });
    expect(result["budget"]?.value).toBe(16000);
  });

  test("avg returns correct average", () => {
    const result = computeAggregations(frame, { budget: "avg" });
    expect(result["budget"]?.value).toBeCloseTo(5333.33, 0);
  });

  test("median returns middle value", () => {
    const result = computeAggregations(frame, { budget: "median" });
    expect(result["budget"]?.value).toBe(5000);
  });

  test("min returns smallest value", () => {
    const result = computeAggregations(frame, { budget: "min" });
    expect(result["budget"]?.value).toBe(3000);
  });

  test("max returns largest value", () => {
    const result = computeAggregations(frame, { budget: "max" });
    expect(result["budget"]?.value).toBe(8000);
  });

  test("range returns max - min", () => {
    const result = computeAggregations(frame, { budget: "range" });
    expect(result["budget"]?.value).toBe(5000);
  });

  test("count_unique returns distinct values", () => {
    const result = computeAggregations(frame, { name: "count_unique" });
    expect(result["name"]?.value).toBe(3);
  });

  test("count_checked counts true booleans", () => {
    const result = computeAggregations(frame, { done: "count_checked" });
    expect(result["done"]?.value).toBe(2);
  });

  test("count_unchecked counts false booleans", () => {
    const result = computeAggregations(frame, { done: "count_unchecked" });
    expect(result["done"]?.value).toBe(1);
  });

  test("percent_checked calculates correctly", () => {
    const result = computeAggregations(frame, { done: "percent_checked" });
    expect(result["done"]?.value).toBeCloseTo(66.67, 0);
    expect(result["done"]?.formattedValue).toBe("67%");
  });

  test("percent_empty with all filled returns 0%", () => {
    const result = computeAggregations(frame, { name: "percent_empty" });
    expect(result["name"]?.value).toBe(0);
  });

  test("percent_not_empty with all filled returns 100%", () => {
    const result = computeAggregations(frame, { name: "percent_not_empty" });
    expect(result["name"]?.value).toBe(100);
  });

  test("earliest returns first date", () => {
    const result = computeAggregations(frame, { due: "earliest" });
    expect(result["due"]?.value).toBe(new Date("2026-04-01").toISOString());
  });

  test("latest returns last date", () => {
    const result = computeAggregations(frame, { due: "latest" });
    expect(result["due"]?.value).toBe(new Date("2026-06-01").toISOString());
  });

  test("date_range returns days between earliest and latest", () => {
    const result = computeAggregations(frame, { due: "date_range" });
    expect(result["due"]?.value).toBe(61);
  });

  test("none aggregation is skipped", () => {
    const result = computeAggregations(frame, { name: "none" });
    expect(result["name"]).toBeUndefined();
  });

  test("empty config returns empty result", () => {
    const result = computeAggregations(frame, {});
    expect(Object.keys(result)).toHaveLength(0);
  });

  test("handles empty records gracefully", () => {
    const empty = makeFrame({ records: [] });
    const result = computeAggregations(empty, { budget: "sum", name: "count" });
    expect(result["budget"]?.value).toBe(0);
    expect(result["name"]?.value).toBe(0);
  });

  test("handles null/undefined values in number aggregation", () => {
    const withNulls = makeFrame({
      records: [
        { id: "a.md", values: { name: "A", budget: 100, done: true, due: null } },
        { id: "b.md", values: { name: "B", budget: undefined, done: false, due: null } },
        { id: "c.md", values: { name: "C", budget: 300, done: true, due: null } },
      ],
    });
    const result = computeAggregations(withNulls, { budget: "sum" });
    expect(result["budget"]?.value).toBe(400);
  });

  test("multiple aggregations at once", () => {
    const result = computeAggregations(frame, {
      name: "count",
      budget: "sum",
      done: "count_checked",
    });
    expect(result["name"]?.value).toBe(3);
    expect(result["budget"]?.value).toBe(16000);
    expect(result["done"]?.value).toBe(2);
  });
});

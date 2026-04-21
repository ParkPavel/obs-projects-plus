// src/ui/views/Database/engine/chartDataPipeline.test.ts

import { buildChartPipeline, computeChartData, computeScatterData, chartHeightPx } from "./chartDataPipeline";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { ChartConfig, ScatterChartConfig } from "../types";

// ── Helpers ──────────────────────────────────────────────────

function makeStatusFrame(): DataFrame {
  return {
    fields: [
      { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "priority", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { status: "Done", priority: 3 } },
      { id: "2", values: { status: "Active", priority: 5 } },
      { id: "3", values: { status: "Done", priority: 2 } },
      { id: "4", values: { status: "Todo", priority: 1 } },
      { id: "5", values: { status: "Active", priority: 4 } },
    ],
  };
}

function makeConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    chartType: "bar",
    xAxis: {
      property: "status",
      sortBy: "label",
      sortOrder: "asc",
      omitZero: false,
    },
    yAxis: {
      property: "count",
      aggregation: "count",
    },
    style: {
      colorScheme: "categorical",
      height: "medium",
      showGrid: true,
      showLabels: true,
      showLegend: false,
      showValues: true,
    },
    ...overrides,
  };
}

// ── buildChartPipeline Tests ─────────────────────────────────

describe("buildChartPipeline", () => {
  test("generates pipeline with group-by step for count", () => {
    const pipeline = buildChartPipeline(makeConfig());

    // Count uses _group_size from GROUP BY, no separate AGGREGATE step
    expect(pipeline.steps.length).toBe(1);
    expect(pipeline.steps[0]?.type).toBe("group-by");
  });

  test("group-by uses xAxis property", () => {
    const pipeline = buildChartPipeline(makeConfig());
    const groupStep = pipeline.steps[0] as { type: "group-by"; fields: string[] };

    expect(groupStep.fields).toEqual(["status"]);
  });

  test("generates pipeline with aggregate step for non-count", () => {
    const config = makeConfig({
      yAxis: { property: "priority", aggregation: "sum" },
    });
    const pipeline = buildChartPipeline(config);

    expect(pipeline.steps.length).toBe(2);
    expect(pipeline.steps[0]?.type).toBe("group-by");
    expect(pipeline.steps[1]?.type).toBe("aggregate");
  });

  test("sum aggregation maps correctly", () => {
    const config = makeConfig({
      yAxis: { property: "priority", aggregation: "sum" },
    });
    const pipeline = buildChartPipeline(config);
    const aggStep = pipeline.steps[1];

    expect(aggStep?.type).toBe("aggregate");
    if (aggStep?.type === "aggregate") {
      expect(aggStep.columns[0]?.function).toBe("SUM");
      expect(aggStep.columns[0]?.sourceField).toBe("priority");
    }
  });
});

// ── computeChartData Tests ───────────────────────────────────

describe("computeChartData", () => {
  test("returns labels and series", () => {
    const data = computeChartData(makeStatusFrame(), makeConfig());

    expect(data.labels).toBeDefined();
    expect(data.series).toBeDefined();
    expect(data.series.length).toBe(1);
  });

  test("count aggregation returns correct groups", () => {
    const data = computeChartData(makeStatusFrame(), makeConfig());

    // 3 groups: Active(2), Done(2), Todo(1) — sorted by label asc
    expect(data.labels).toEqual(["Active", "Done", "Todo"]);
    expect(data.series[0]?.values).toEqual([2, 2, 1]);
  });

  test("sortBy value sorts by aggregated value", () => {
    const config = makeConfig({
      xAxis: {
        property: "status",
        sortBy: "value",
        sortOrder: "desc",
        omitZero: false,
      },
    });
    const data = computeChartData(makeStatusFrame(), config);

    // Active=2, Done=2, Todo=1 → desc: [2, 2, 1]
    expect(data.series[0]?.values[0]).toBeGreaterThanOrEqual(data.series[0]?.values[1] ?? 0);
    expect(data.series[0]?.values[1]).toBeGreaterThanOrEqual(data.series[0]?.values[2] ?? 0);
  });

  test("omitZero filters out zero/null values", () => {
    const frame: DataFrame = {
      fields: [
        { name: "cat", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "val", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { cat: "A", val: 10 } },
        { id: "2", values: { cat: "B", val: 0 } },
        { id: "3", values: { cat: "A", val: 5 } },
      ],
    };

    const config = makeConfig({
      xAxis: {
        property: "cat",
        sortBy: "label",
        sortOrder: "asc",
        omitZero: true,
      },
      yAxis: { property: "val", aggregation: "sum" },
    });

    const data = computeChartData(frame, config);
    // B sums to 0 → omitted
    expect(data.labels).not.toContain("B");
  });

  test("hiddenGroups excludes specified labels", () => {
    const config = makeConfig({
      xAxis: {
        property: "status",
        sortBy: "label",
        sortOrder: "asc",
        omitZero: false,
        hiddenGroups: ["Todo"],
      },
    });

    const data = computeChartData(makeStatusFrame(), config);
    expect(data.labels).not.toContain("Todo");
  });

  test("cumulative applies running total", () => {
    const config = makeConfig({
      yAxis: { property: "count", aggregation: "count", cumulative: true },
    });

    const data = computeChartData(makeStatusFrame(), config);
    const vals = data.series[0]?.values ?? [];

    // Each value should be >= previous
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!);
    }
  });

  test("series name is 'Count' for count aggregation", () => {
    const data = computeChartData(makeStatusFrame(), makeConfig());
    expect(data.series[0]?.name).toBe("Count");
  });

  test("series name is field name for non-count aggregation", () => {
    const config = makeConfig({
      yAxis: { property: "priority", aggregation: "sum" },
    });
    const data = computeChartData(makeStatusFrame(), config);
    expect(data.series[0]?.name).toBe("priority");
  });
});

// ── chartHeightPx Tests ──────────────────────────────────────

describe("chartHeightPx", () => {
  test("returns correct heights", () => {
    expect(chartHeightPx("small")).toBe(200);
    expect(chartHeightPx("medium")).toBe(320);
    expect(chartHeightPx("large")).toBe(480);
  });

  test("defaults to medium for unknown value", () => {
    expect(chartHeightPx("unknown" as never)).toBe(320);
  });
});

// ── computeScatterData Tests ─────────────────────────────────

function makeNumericFrame(): DataFrame {
  return {
    fields: [
      { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "y", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "group", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "size", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "1", values: { x: 1, y: 2, group: "A", size: 5 } },
      { id: "2", values: { x: 2, y: 4, group: "A", size: 3 } },
      { id: "3", values: { x: 3, y: 5, group: "B", size: 7 } },
      { id: "4", values: { x: 4, y: 8, group: "B", size: 4 } },
      { id: "5", values: { x: 5, y: 10, group: "A", size: 6 } },
    ],
  };
}

function makeScatterConfig(overrides: Partial<ScatterChartConfig> = {}): ScatterChartConfig {
  return {
    xAxis: { field: "x" },
    yAxis: { field: "y" },
    showTrendLine: true,
    showR2: true,
    pointRadius: 5,
    opacity: 0.8,
    ...overrides,
  };
}

describe("computeScatterData", () => {
  test("extracts numeric (x, y) pairs from DataFrame", () => {
    const data = computeScatterData(makeNumericFrame(), makeScatterConfig());
    expect(data.points).toHaveLength(5);
    expect(data.points[0]!.x).toBe(1);
    expect(data.points[0]!.y).toBe(2);
  });

  test("skips records with non-numeric values", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "y", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { x: 1, y: 2 } },
        { id: "2", values: { x: "abc", y: 4 } },
        { id: "3", values: { x: 3, y: null } },
      ],
    };
    const data = computeScatterData(frame, makeScatterConfig());
    expect(data.points).toHaveLength(1);
  });

  test("computes trend line (slope and intercept)", () => {
    const data = computeScatterData(makeNumericFrame(), makeScatterConfig());
    expect(data.trendLine).toBeDefined();
    expect(data.trendLine!.slope).toBeGreaterThan(0);
    expect(typeof data.trendLine!.intercept).toBe("number");
  });

  test("computes R² between 0 and 1 for correlated data", () => {
    const data = computeScatterData(makeNumericFrame(), makeScatterConfig());
    expect(data.r2).toBeDefined();
    expect(data.r2!).toBeGreaterThan(0.5);
    expect(data.r2!).toBeLessThanOrEqual(1);
  });

  test("R² ≈ 1.0 for perfectly linear data", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "y", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { x: 1, y: 3 } },
        { id: "2", values: { x: 2, y: 5 } },
        { id: "3", values: { x: 3, y: 7 } },
        { id: "4", values: { x: 4, y: 9 } },
      ],
    };
    const data = computeScatterData(frame, makeScatterConfig());
    expect(data.r2).toBeCloseTo(1.0, 5);
  });

  test("does not include trendLine when showTrendLine is false", () => {
    const data = computeScatterData(
      makeNumericFrame(),
      makeScatterConfig({ showTrendLine: false })
    );
    expect(data.trendLine).toBeUndefined();
  });

  test("does not include r2 when showR2 is false", () => {
    const data = computeScatterData(
      makeNumericFrame(),
      makeScatterConfig({ showR2: false })
    );
    expect(data.r2).toBeUndefined();
  });

  test("groups points by colorBy field", () => {
    const data = computeScatterData(
      makeNumericFrame(),
      makeScatterConfig({ colorBy: "group" })
    );
    const groups = new Set(data.points.map((p) => p.group));
    expect(groups).toContain("A");
    expect(groups).toContain("B");
  });

  test("returns empty points for missing fields", () => {
    const data = computeScatterData(
      makeNumericFrame(),
      makeScatterConfig({ xAxis: { field: "" } })
    );
    expect(data.points).toHaveLength(0);
  });

  test("handles single point (no trend line)", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "y", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [{ id: "1", values: { x: 5, y: 10 } }],
    };
    const data = computeScatterData(frame, makeScatterConfig());
    expect(data.points).toHaveLength(1);
    expect(data.trendLine).toBeUndefined();
  });

  test("clamps sizeBy values to [2, 20]", () => {
    const frame: DataFrame = {
      fields: [
        { name: "x", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "y", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
        { name: "s", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      ],
      records: [
        { id: "1", values: { x: 1, y: 2, s: 0.5 } },
        { id: "2", values: { x: 2, y: 3, s: 50 } },
      ],
    };
    const data = computeScatterData(frame, makeScatterConfig({ sizeBy: "s" }));
    expect(data.points[0]!.size).toBe(2);
    expect(data.points[1]!.size).toBe(20);
  });
});

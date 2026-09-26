/**
 * Codex review of c5cf809 (multi-series charts): one P1, five P2.
 *
 * - P1: bars that are all negative froze the chart — the grid stepped from
 *   0 to a max of 0 in steps of 0.
 * - An extra series ignored the chart's hidden categories and its semantic
 *   (status bucket) grouping, so it added back what the chart excluded and
 *   stopped lining up with the primary.
 * - A value with gaps on both sides drew nothing on a bar chart's line.
 * - A category whose primary value was missing lost its label as well.
 * - A smooth line with a gradient filled its area with straight segments.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { computeMultiSeriesChartData } from "src/lib/dashboard-engine/chartDataPipeline";
import type { ChartConfig, ChartData, ChartStyle } from "../../../types";
import BarChart from "../BarChart.svelte";
import LineChart from "../LineChart.svelte";
import { gridValues, isolatedPoints } from "../chartScale";

const style: ChartStyle = {
  colorScheme: "auto", height: "medium", showGrid: false, showLabels: false,
  showLegend: false, showValues: false, smooth: false, gradient: false,
};

describe("grid", () => {
  test("an all-negative scale has grid lines below zero, and none at 0", () => {
    const g = gridValues({ min: -50, max: 0 }, 5);
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((v) => v < 0 && v >= -50)).toBe(true);
  });

  test("a zero-height or broken scale has no grid, and never loops", () => {
    expect(gridValues({ min: 0, max: 0 }, 5)).toEqual([]);
    expect(gridValues({ min: Number.NaN, max: 1 }, 5)).toEqual([]);
  });

  test("an all-negative bar chart with its grid on renders", () => {
    const data: ChartData = { labels: ["a", "b"], series: [{ name: "s", values: [-50, -10] }] };
    const { container } = render(BarChart, { props: { data, width: 300, height: 200, style: { ...style, showGrid: true } } });
    expect(container.querySelectorAll(".ppp-chart-bar__rect")).toHaveLength(2);
  });
});

describe("bar chart with lines", () => {
  test("a value with gaps on both sides is drawn as a point", () => {
    expect(isolatedPoints([null, 7, null, 8])).toEqual([1, 3]);
    expect(isolatedPoints([1, 2, null, 3])).toEqual([3]);
    const data: ChartData = {
      labels: ["a", "b", "c", "d"],
      series: [{ name: "bars", values: [1, 2, 3, 4] }, { name: "line", values: [null, 7, null, 8] }],
    };
    const { container } = render(BarChart, { props: { data, width: 300, height: 200, style } });
    expect(container.querySelectorAll(".ppp-chart-bar-point")).toHaveLength(2);
  });

  test("a category with no primary value keeps its label", () => {
    const data: ChartData = {
      labels: ["a", "b", "c", "d"],
      series: [{ name: "bars", values: [10, null, 30, null] }, { name: "line", values: [1, 2, 3, 4] }],
    };
    const { container } = render(BarChart, { props: { data, width: 600, height: 200, style: { ...style, showLabels: true } } });
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(["a", "b", "c", "d"]));
  });
});

describe("smooth area", () => {
  test("the area under a smooth line follows its curve", () => {
    const data: ChartData = { labels: ["a", "b", "c"], series: [{ name: "s", values: [1, 5, 2] }] };
    const { container } = render(LineChart, { props: { data, width: 300, height: 200, style: { ...style, smooth: true, gradient: true } } });
    const paths = Array.from(container.querySelectorAll(".ppp-chart-line path")).map((p) => p.getAttribute("d") ?? "");
    const area = paths.find((d) => d.includes("Z"))!;
    expect(area).toContain(" C ");
  });
});

function frame(rows: Array<Record<string, DataValue>>, fields: DataFrame["fields"]): DataFrame {
  return { fields, records: rows.map((values, i) => ({ id: `r${i}.md`, values })) } as unknown as DataFrame;
}
const f = (name: string, type: DataFieldType, typeConfig?: unknown) =>
  ({ name, type, repeated: false, identifier: false, derived: false, ...(typeConfig ? { typeConfig } : {}) });

const base: ChartConfig = {
  chartType: "bar",
  xAxis: { property: "status", sortBy: "label", sortOrder: "asc", omitZero: false },
  yAxis: { property: "hours", aggregation: "sum" },
  style: { colorScheme: "categorical", height: "medium", showGrid: false, showLabels: true, showLegend: true, showValues: false },
};

describe("extra series follow the chart's x axis", () => {
  test("hidden categories stay hidden for every series", () => {
    const src = frame(
      [{ status: "A", hours: 1, cost: 10 }, { status: "B", hours: 2, cost: 20 }],
      [f("status", DataFieldType.String), f("hours", DataFieldType.Number), f("cost", DataFieldType.Number)]
    );
    const cfg: ChartConfig = {
      ...base,
      xAxis: { ...base.xAxis, hiddenGroups: ["A"] },
      series: [{ id: "c", label: "Cost", property: "cost", aggregation: "sum" }],
    };
    const out = computeMultiSeriesChartData(src, cfg, new Map());
    expect(out.labels).toEqual(["B"]);
    expect(out.series[1]!.values).toEqual([20]);
  });

  test("semantic buckets group the extra series too, so the values line up", () => {
    const status = f("status", DataFieldType.String, { statusGroups: { todo: ["open"], inProgress: [], complete: ["closed"] } });
    const src = frame(
      [{ status: "open", hours: 1, cost: 10 }, { status: "closed", hours: 2, cost: 20 }],
      [status, f("hours", DataFieldType.Number), f("cost", DataFieldType.Number)]
    );
    const cfg: ChartConfig = { ...base, groupMode: "semantic", series: [{ id: "c", label: "Cost", property: "cost", aggregation: "sum" }] };
    const out = computeMultiSeriesChartData(src, cfg, new Map());
    expect(out.labels).not.toContain("open");
    expect(out.labels).not.toContain("closed");
    const at = (label: string, s: number) => out.series[s]!.values[out.labels.indexOf(label)];
    const done = out.labels.find((l) => at(l, 0) === 2)!;
    expect(at(done, 1)).toBe(20);
  });
});

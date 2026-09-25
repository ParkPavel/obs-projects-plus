/**
 * 3.6.0 — what the chart draws for gaps, a second axis and negative values
 * (chartScale.ts). Mounted for real: the path and the bars are the claim.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

import LineChart from "../LineChart.svelte";
import BarChart from "../BarChart.svelte";
import type { ChartData, ChartStyle } from "../../../types";

const style: ChartStyle = {
  colorScheme: "auto", height: "medium", showGrid: false, showLabels: false,
  showLegend: false, showValues: false, smooth: false, gradient: false,
};

describe("LineChart", () => {
  test("a missing value breaks the line: two segments, no point at 0", () => {
    const data: ChartData = { labels: ["a", "b", "c", "d"], series: [{ name: "s", values: [5, 10, null, 10] }] };
    const { container } = render(LineChart, { props: { data, width: 300, height: 200, style } });
    const d = container.querySelector(".ppp-chart-line path")!.getAttribute("d")!;
    expect(d.match(/M /g)).toHaveLength(2);
    expect(container.querySelectorAll(".ppp-chart-line__point")).toHaveLength(3);
  });

  test("a series on the right axis gets its own axis and fills the height on it", () => {
    const data: ChartData = {
      labels: ["a", "b"],
      series: [{ name: "kg", values: [80, 79] }, { name: "min", values: [30, 45], axis: "right" }],
    };
    const { container } = render(LineChart, { props: { data, width: 300, height: 200, style } });
    expect(container.querySelector(".ppp-chart-axis-right")).not.toBeNull();
    const cys = Array.from(container.querySelectorAll(".ppp-chart-line__point")).map((c) => Number(c.getAttribute("cy")));
    // 45 is the top of the right axis, 80 the top of the left one.
    expect(cys[0]).toBe(0);
    expect(cys[3]).toBe(0);
  });

  test("a negative value draws a zero line inside the plot", () => {
    const data: ChartData = { labels: ["a", "b"], series: [{ name: "profit", values: [-50, 100] }] };
    const { container } = render(LineChart, { props: { data, width: 300, height: 200, style } });
    expect(container.querySelector(".ppp-chart-zero")).not.toBeNull();
  });
});

describe("BarChart", () => {
  test("a negative bar is drawn downward from the zero line", () => {
    const data: ChartData = { labels: ["Aug", "Sep"], series: [{ name: "profit", values: [-50, 100] }] };
    const { container } = render(BarChart, { props: { data, width: 300, height: 200, style } });
    const bars = Array.from(container.querySelectorAll("rect.ppp-chart-bar__rect")) as SVGRectElement[];
    expect(bars).toHaveLength(2);
    for (const b of bars) expect(Number(b.getAttribute("height"))).toBeGreaterThan(0);
    const [neg, pos] = bars.map((b) => ({ y: Number(b.getAttribute("y")), h: Number(b.getAttribute("height")) }));
    // The negative bar starts where the positive one ends: at the zero line.
    expect(neg!.y).toBeCloseTo(pos!.y + pos!.h, 6);
  });

  test("extra series are drawn as lines over the bars, on their own axis", () => {
    const data: ChartData = {
      labels: ["Aug", "Sep"],
      series: [{ name: "income", values: [1000, 1200] }, { name: "visits", values: [10, 12], axis: "right" }],
    };
    const { container } = render(BarChart, { props: { data, width: 300, height: 200, style } });
    expect(container.querySelectorAll("rect.ppp-chart-bar__rect")).toHaveLength(2);
    expect(container.querySelector("path.ppp-chart-bar-line")).not.toBeNull();
    expect(container.querySelector(".ppp-chart-axis-right")).not.toBeNull();
  });
});

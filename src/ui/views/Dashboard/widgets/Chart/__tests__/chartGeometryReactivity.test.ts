/**
 * chartGeometryReactivity.test.ts — #166 follow-up.
 *
 * ChartWidget's ResizeObserver moves `width` after mount (see chartWidth.ts).
 * The viewBox reads `width` directly and repainted correctly, but every
 * point's cx/cy and the line/bar geometry came from `xPos`/`yPos` — plain
 * functions called from the template (`xPos(i)`) whose closure over
 * stepX/plotH/maxVal/plotW the Svelte compiler cannot see through. A width
 * change therefore patched the viewBox and left the geometry at
 * CHART_WIDTH_FALLBACK forever. Live measurement in OBStests (see the task's
 * accepted decisions) reproduced exactly this: viewBox at the live width,
 * points still plotted for width=480.
 *
 * This mounts a real component, changes `width` after mount, and asserts the
 * viewBox and the geometry move together — the only thing a static read of
 * the source cannot fake.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

import LineChart from "../LineChart.svelte";
import BarChart from "../BarChart.svelte";
import type { ChartData, ChartStyle } from "../../../types";

const baseStyle: ChartStyle = {
  colorScheme: "auto",
  height: "medium",
  showGrid: false,
  showLabels: false,
  showLegend: false,
  showValues: false,
  smooth: false,
  gradient: false,
};

describe("LineChart — geometry follows a changing width, not just the viewBox", () => {
  // Two points, height fixed: with PADDING_LEFT 50 / PADDING_RIGHT 20 and
  // showLabels off (paddingBottom pinned to 16), plotW = width - 70 and
  // plotH = height - 36 stay easy to hand-verify. stepX for two points is
  // plotW itself, so the second circle/path vertex sits at cx = plotW.
  const data: ChartData = {
    labels: ["a", "b"],
    series: [{ name: "s", values: [0, 10] }],
  };

  test("a width update after mount moves the viewBox, the circles and the line together", async () => {
    const { container, component } = render(LineChart, {
      props: { data, width: 300, height: 200, style: baseStyle },
    });

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 200");

    const circlesBefore = Array.from(
      container.querySelectorAll(".ppp-chart-line__point")
    ) as SVGCircleElement[];
    expect(circlesBefore.map((c) => c.getAttribute("cx"))).toEqual(["0", "230"]);
    expect(circlesBefore.map((c) => c.getAttribute("cy"))).toEqual(["164", "0"]);

    const pathBefore = container.querySelector(".ppp-chart-line path")!;
    expect(pathBefore.getAttribute("d")).toBe("M 0,164 L 230,0");

    // The resize the container reports after mount (ChartWidget's ResizeObserver path).
    component.$set({ width: 600 });
    await tick();

    expect(svg.getAttribute("viewBox")).toBe("0 0 600 200");

    const circlesAfter = Array.from(
      container.querySelectorAll(".ppp-chart-line__point")
    ) as SVGCircleElement[];
    expect(circlesAfter.map((c) => c.getAttribute("cx"))).toEqual(["0", "530"]);
    expect(circlesAfter.map((c) => c.getAttribute("cy"))).toEqual(["164", "0"]);

    const pathAfter = container.querySelector(".ppp-chart-line path")!;
    expect(pathAfter.getAttribute("d")).toBe("M 0,164 L 530,0");
  });
});

describe("BarChart — the same closure blindness, in the orientation it actually reaches", () => {
  // Vertical bars (the default) compute their rect geometry inline from
  // barWidth/barGap/plotH — reactive vars named directly in the template, no
  // closured function in the way — so they were never blind. Horizontal
  // bars are: `bW = xPos(val)` runs through the same closured xPos LineChart
  // had, and xPos is what draws the rect's `width`.
  const data: ChartData = {
    labels: ["a", "b"],
    series: [{ name: "s", values: [5, 10] }],
  };

  // Vertical (default) bars get no test here: `bX`/`bH`/`width`/`height` on
  // that rect are `{@const}` arithmetic naming `barWidth`, `barGap`, `plotH`,
  // `maxVal` directly — never routed through xPos/yPos — so a regression
  // test on that path would pass identically before and after this fix and
  // would not be evidence of anything.

  test("horizontal bar rectangles move to the new width, same tick as the viewBox", async () => {
    const { container, component } = render(BarChart, {
      props: { data, width: 300, height: 200, style: baseStyle, horizontal: true },
    });

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 200");

    // plotW = 300 - 70 = 230, maxVal = 10: bW = (val/maxVal)*plotW.
    const rectsBefore = Array.from(
      container.querySelectorAll(".ppp-chart-bar__rect")
    ) as SVGRectElement[];
    expect(rectsBefore.map((r) => r.getAttribute("width"))).toEqual(["115", "230"]);

    component.$set({ width: 600 });
    await tick();

    expect(svg.getAttribute("viewBox")).toBe("0 0 600 200");

    // plotW = 600 - 70 = 530: bW = (val/maxVal)*530.
    const rectsAfter = Array.from(
      container.querySelectorAll(".ppp-chart-bar__rect")
    ) as SVGRectElement[];
    expect(rectsAfter.map((r) => r.getAttribute("width"))).toEqual(["265", "530"]);
  });
});

// src/ui/views/Dashboard/widgets/Chart/chartWidth.test.ts
// #166 Step 2 — the width guard, and the wiring that guard is worth nothing without.

import * as fs from "fs";
import * as path from "path";
import { CHART_WIDTH_FALLBACK, resolveChartWidth } from "./chartWidth";

describe("resolveChartWidth", () => {
  test("an unmeasured first frame renders at the pre-#166 constant", () => {
    expect(resolveChartWidth(undefined, CHART_WIDTH_FALLBACK)).toBe(
      CHART_WIDTH_FALLBACK
    );
    expect(resolveChartWidth(null, CHART_WIDTH_FALLBACK)).toBe(
      CHART_WIDTH_FALLBACK
    );
  });

  test("a measurement replaces the fallback", () => {
    expect(resolveChartWidth(240, CHART_WIDTH_FALLBACK)).toBe(240);
    expect(resolveChartWidth(960.5, 240)).toBe(960.5);
  });

  test("a collapsed widget keeps the last non-zero width", () => {
    // A zero viewBox width divides by zero in every scale function downstream.
    expect(resolveChartWidth(0, 320)).toBe(320);
    expect(resolveChartWidth(-1, 320)).toBe(320);
  });

  test("a non-finite measurement keeps the last non-zero width", () => {
    expect(resolveChartWidth(NaN, 320)).toBe(320);
    expect(resolveChartWidth(Infinity, 320)).toBe(320);
  });
});

/*
 * The guard above is pure arithmetic and stays green whether or not anything
 * calls it. That is exactly how #166 would regress: someone puts the constant
 * back in the template and every unit test still passes, because no jest test in
 * this repo mounts ChartWidget (jsdom lays out no SVG, so mounting would prove
 * nothing anyway).
 *
 * So the wiring is asserted over the source text — the same shape as the R0.x
 * ratchets. Planted-regression proof: change one `width={chartWidth}` back to
 * `width={480}` and this suite fails naming the literal.
 */
describe("#166 — ChartWidget passes the measured width, not a constant", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "ChartWidget.svelte"),
    "utf8"
  );

  test("the wrapper is measured", () => {
    expect(SOURCE).toContain("bind:contentRect");
    expect(SOURCE).toContain(
      "resolveChartWidth(contentRect?.width, chartWidth)"
    );
  });

  test("no chart is handed a numeric width literal", () => {
    const literals = [
      ...SOURCE.matchAll(/width=\{\s*(\d+(?:\.\d+)?)\s*\}/g),
    ].map((m) => m[1]);
    expect(literals).toEqual([]);
  });

  test("every chart that takes a width takes it from the measurement", () => {
    const widths = [...SOURCE.matchAll(/\swidth=\{([^}]*)\}/g)].map((m) =>
      (m[1] ?? "").trim()
    );
    // Pie and donut are square: the container may only shrink them, never let
    // them exceed the configured height (ADR Q2).
    expect(widths.length).toBeGreaterThanOrEqual(8);
    for (const w of widths) {
      expect(w === "chartWidth" || w === "Math.min(chartWidth, heightPx)").toBe(
        true
      );
    }
    expect(
      widths.filter((w) => w === "Math.min(chartWidth, heightPx)")
    ).toHaveLength(2);
  });
});

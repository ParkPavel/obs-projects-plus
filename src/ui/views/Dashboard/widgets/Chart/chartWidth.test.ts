// src/ui/views/Dashboard/widgets/Chart/chartWidth.test.ts
// #166 Step 2 — the width guard, and the wiring that guard is worth nothing without.

import * as fs from "fs";
import * as path from "path";
import { CHART_WIDTH_FALLBACK, resolveChartWidth, tickCountFor } from "./chartWidth";

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
describe("tickCountFor", () => {
  test("a narrow plot gets fewer ticks than a wide one, never fewer than two", () => {
    expect(tickCountFor(90)).toBe(2); // the 160px scatter: 90 units of plot
    expect(tickCountFor(410)).toBe(6); // the pre-#166 480px chart
    expect(tickCountFor(1530)).toBe(8); // 1600px: capped, not a ruler
    expect(tickCountFor(0)).toBe(2);
    expect(tickCountFor(NaN)).toBe(2);
  });

  test("is monotonic in the width", () => {
    let last = 0;
    for (let w = 0; w <= 2000; w += 10) {
      const n = tickCountFor(w);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });
});

describe("#166 — the charts that render every label now size their label count", () => {
  test("Scatter asks tickCountFor for its X ticks instead of a constant", () => {
    const src = fs.readFileSync(path.join(__dirname, "ScatterChart.svelte"), "utf8");
    expect(src).toContain("computeGrid(xLo, xHi, tickCountFor(plotW))");
    expect(src).not.toContain("computeGrid(xLo, xHi, 5)");
  });

  test("Progress truncates its label to the width it has", () => {
    const src = fs.readFileSync(path.join(__dirname, "ProgressChart.svelte"), "utf8");
    expect(src).toContain("truncateLabel(label, ");
    expect(src).toContain(">{shownLabel}</text>");
  });
});

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

/*
 * PieChart computed CX/CY/R as `const` — once, at mount. Nothing exposed it
 * while ChartWidget passed the configured height for both axes, but #166 makes
 * `width` change on every resize, and a stale centre against a live viewBox
 * draws the pie off its own middle. Same source-shape assertion, same reason:
 * the arithmetic is inside a .svelte file that jsdom cannot lay out.
 */
describe("#166 — PieChart's geometry follows a changing width", () => {
  const SOURCE = fs.readFileSync(
    path.join(__dirname, "PieChart.svelte"),
    "utf8"
  );

  test("the centre and radius are reactive, not computed once", () => {
    for (const name of ["CX", "CY", "R", "INNER_R"]) {
      expect(SOURCE).toContain(`$: ${name} =`);
      expect(SOURCE).not.toContain(`const ${name} =`);
    }
  });

  test("the SVG is not stretched to the container — the viewBox width is its width", () => {
    // Codex audit of step 2: the pie viewBox is min(width, height), a square. With
    // `width: 100%` the SVG filled a wide widget anyway and every label scaled
    // back up — the exact effect step 2 exists to remove. The attributes give
    // the intrinsic size; the stylesheet may only cap it, never stretch it.
    expect(SOURCE).toMatch(/<svg[^>]*\swidth=\{width\}[^>]*\sheight=\{height\}/s);
    const style = SOURCE.slice(SOURCE.indexOf("<style>"));
    const pieRule = /\.ppp-chart-pie\s*\{([^}]*)\}/.exec(style)?.[1] ?? "";
    expect(pieRule).toMatch(/max-width:\s*100%/);
    expect(pieRule).not.toMatch(/(^|[^-])width:\s*100%/);
  });

  test("the slice path takes the geometry as arguments", () => {
    // Svelte tracks only the identifiers a reactive statement names, so
    // geometry read from the closure would leave `slices` stale.
    expect(SOURCE).toContain(
      "computeSlices(values, labels, CX, CY, R, INNER_R)"
    );
  });
});

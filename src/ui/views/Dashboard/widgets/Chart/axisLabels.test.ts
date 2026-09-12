// src/ui/views/Dashboard/widgets/Chart/axisLabels.test.ts
// #096.2 — density-based axis-label layout.

import {
  computeAxisLabelLayout,
  shouldRenderLabel,
  truncateLabel,
} from "./axisLabels";
import { CHART_WIDTH_FALLBACK, resolveChartWidth } from "./chartWidth";

describe("computeAxisLabelLayout", () => {
  test("renders all labels horizontally when they fit", () => {
    const layout = computeAxisLabelLayout({ count: 3, plotWidth: 300, maxLabelChars: 7 });
    expect(layout.skipInterval).toBe(1);
    expect(layout.rotate).toBe(false);
    expect(layout.rotationDeg).toBe(0);
  });

  test("rotates without skipping under moderate crowding", () => {
    const layout = computeAxisLabelLayout({ count: 8, plotWidth: 300, maxLabelChars: 10 });
    expect(layout.rotate).toBe(true);
    expect(layout.rotationDeg).toBe(-30);
    expect(layout.skipInterval).toBe(1);
  });

  test("rotates AND skips when heavily crowded", () => {
    const layout = computeAxisLabelLayout({ count: 30, plotWidth: 300, maxLabelChars: 7 });
    expect(layout.rotate).toBe(true);
    expect(layout.skipInterval).toBeGreaterThan(1);
  });

  test("bottom padding grows when labels rotate", () => {
    const flat = computeAxisLabelLayout({ count: 3, plotWidth: 300, maxLabelChars: 7 });
    const rotated = computeAxisLabelLayout({ count: 8, plotWidth: 300, maxLabelChars: 10 });
    expect(rotated.bottomPadding).toBeGreaterThan(flat.bottomPadding);
  });

  test("never returns a skipInterval below 1", () => {
    const layout = computeAxisLabelLayout({ count: 1, plotWidth: 10, maxLabelChars: 50 });
    expect(layout.skipInterval).toBeGreaterThanOrEqual(1);
  });

  test("honours custom truncateAt", () => {
    const layout = computeAxisLabelLayout({ count: 3, plotWidth: 300, maxLabelChars: 7, truncateAt: 20 });
    expect(layout.truncateAt).toBe(20);
  });
});

describe("shouldRenderLabel", () => {
  test("renders everything when interval is 1", () => {
    expect(shouldRenderLabel(3, 10, 1)).toBe(true);
  });

  test("renders only every Nth label otherwise", () => {
    expect(shouldRenderLabel(0, 10, 3)).toBe(true);
    expect(shouldRenderLabel(1, 10, 3)).toBe(false);
    expect(shouldRenderLabel(3, 10, 3)).toBe(true);
  });

  test("always renders the final label", () => {
    // index 9 is not a multiple of 4, but it is the last (count-1).
    expect(shouldRenderLabel(9, 10, 4)).toBe(true);
  });
});

/*
 * #166 Step 2 — the axis now receives the MEASURED container width instead of
 * the constant 480, so the cull decision is the container's. This is arithmetic,
 * not layout, which is the only reason it is safe in jsdom: jsdom lays out no
 * SVG text, so nothing here is evidence about rendering. The rendering half of
 * the claim is measured in `docs/internal/probes/166-chart-viewbox-scale.html`.
 *
 * The chain mirrored below is BarChart.svelte:20-36 verbatim — the same paddings
 * and the same LABEL_FONT — so a change there breaks these numbers rather than
 * quietly diverging from them.
 */
describe("#166 — the container width decides the cull", () => {
  const PADDING_LEFT = 50;
  const PADDING_RIGHT = 20;
  const LABEL_FONT = 11;
  const MIN_LABEL_GAP = 4;
  const CHAR_WIDTH_RATIO = 0.6;

  const MONTHS = 12;
  const LABEL_CHARS = 7; // "2026-01"

  function layoutFor(containerWidth: number) {
    const width = resolveChartWidth(containerWidth, CHART_WIDTH_FALLBACK);
    const plotWidth = width - PADDING_LEFT - PADDING_RIGHT;
    return {
      plotWidth,
      layout: computeAxisLabelLayout({
        count: MONTHS,
        plotWidth,
        fontSize: LABEL_FONT,
        maxLabelChars: LABEL_CHARS,
      }),
    };
  }

  function renderedIndices(skipInterval: number): number[] {
    return [...Array(MONTHS).keys()].filter((i) =>
      shouldRenderLabel(i, MONTHS, skipInterval),
    );
  }

  test("a narrow container culls more labels than the old constant did", () => {
    const narrow = layoutFor(240);
    const old = layoutFor(CHART_WIDTH_FALLBACK);

    expect(narrow.layout.skipInterval).toBeGreaterThan(old.layout.skipInterval);
    expect(renderedIndices(narrow.layout.skipInterval).length).toBeLessThan(
      renderedIndices(old.layout.skipInterval).length,
    );
  });

  test("a wide container stops rotating labels that now fit", () => {
    expect(layoutFor(CHART_WIDTH_FALLBACK).layout.rotate).toBe(true);
    expect(layoutFor(960).layout.rotate).toBe(false);
  });

  test("rendered slots never overlap at any of the three widths", () => {
    for (const containerWidth of [240, CHART_WIDTH_FALLBACK, 960]) {
      const { plotWidth, layout } = layoutFor(containerWidth);
      const slotWidth = plotWidth / MONTHS;
      // A rotated label occupies ~fontSize horizontally; a horizontal one
      // occupies its whole estimated box. Same two numbers axisLabels.ts uses.
      const needed = layout.rotate
        ? LABEL_FONT + MIN_LABEL_GAP
        : Math.min(LABEL_CHARS, layout.truncateAt) * LABEL_FONT * CHAR_WIDTH_RATIO +
          MIN_LABEL_GAP;

      const rendered = renderedIndices(layout.skipInterval);
      // The final label is rendered unconditionally so the axis reads to its
      // end — it may crowd its predecessor by design. Every other pair is
      // interval-driven and must clear.
      const intervalDriven = rendered.filter((i) => i % layout.skipInterval === 0);
      let previous: number | undefined;
      for (const index of intervalDriven) {
        if (previous !== undefined) {
          expect((index - previous) * slotWidth).toBeGreaterThanOrEqual(needed);
        }
        previous = index;
      }
    }
  });

  test("a collapsed widget never reaches the axis with a zero plot width", () => {
    // width 0 would make slotWidth 0 and skipInterval Infinity.
    const { plotWidth, layout } = layoutFor(0);
    expect(plotWidth).toBe(CHART_WIDTH_FALLBACK - PADDING_LEFT - PADDING_RIGHT);
    expect(Number.isFinite(layout.skipInterval)).toBe(true);
  });
});

describe("truncateLabel", () => {
  test("leaves short labels untouched", () => {
    expect(truncateLabel("2024-01", 12)).toBe("2024-01");
  });

  test("truncates long labels with an ellipsis", () => {
    const out = truncateLabel("a-very-long-category-name", 12);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBe(12);
  });
});

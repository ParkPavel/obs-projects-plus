// src/ui/views/Dashboard/widgets/Chart/axisLabels.test.ts
// #096.2 — density-based axis-label layout.

import {
  computeAxisLabelLayout,
  shouldRenderLabel,
  truncateLabel,
} from "./axisLabels";

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

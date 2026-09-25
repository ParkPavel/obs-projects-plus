import { axisScale, gappedPath, scaleOf, scaleY, seriesScales } from "../chartScale";

describe("axisScale", () => {
  test("includes 0, so a negative month stays inside the plot", () => {
    expect(axisScale([-50, 100])).toEqual({ min: -50, max: 100 });
    expect(axisScale([20, 80])).toEqual({ min: 0, max: 80 });
    expect(axisScale([-5, -1])).toEqual({ min: -5, max: 0 });
  });
  test("ignores gaps and never has zero height", () => {
    expect(axisScale([null, null])).toEqual({ min: 0, max: 1 });
    expect(axisScale([0])).toEqual({ min: 0, max: 1 });
  });
});

describe("scaleY", () => {
  test("max at the top, min at the bottom, 0 in between", () => {
    const s = { min: -50, max: 100 };
    expect(scaleY(100, 150, s)).toBe(0);
    expect(scaleY(-50, 150, s)).toBe(150);
    expect(scaleY(0, 150, s)).toBe(100);
  });
});

describe("two axes", () => {
  const series = [
    { name: "weight", values: [80, 79] },
    { name: "minutes", values: [30, 45], axis: "right" as const },
  ];
  test("each axis is scaled by its own series", () => {
    const scales = seriesScales(series);
    expect(scales.left).toEqual({ min: 0, max: 80 });
    expect(scales.right).toEqual({ min: 0, max: 45 });
    expect(scaleOf(series[1]!, scales)).toBe(scales.right);
  });
  test("no right series, no right axis", () => {
    expect(seriesScales([series[0]!]).right).toBeNull();
  });
});

describe("gappedPath", () => {
  const x = (i: number) => i * 10;
  const y = (v: number) => v;
  test("a missing value breaks the line instead of diving to 0", () => {
    expect(gappedPath([1, 2, null, 4, 5], x, y)).toBe("M 0,1 L 10,2 M 30,4 L 40,5");
  });
  test("no values, no path", () => {
    expect(gappedPath([null, null], x, y)).toBe("");
  });
});

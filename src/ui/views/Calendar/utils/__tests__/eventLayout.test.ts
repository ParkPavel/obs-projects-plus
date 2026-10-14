import { layoutOverlapClusters, stackCell } from "../eventLayout";

const m = (h: number, min = 0) => h * 60 + min;

describe("layoutOverlapClusters", () => {
  it("three chained overlaps share three columns of 1/3", () => {
    const slots = layoutOverlapClusters([
      { start: m(10), end: m(11) },
      { start: m(10, 30), end: m(11, 30) },
      { start: m(10, 45), end: m(12) },
    ]);
    expect(slots.map((s) => s.column)).toEqual([0, 1, 2]);
    expect(slots.every((s) => s.totalColumns === 3)).toBe(true);
  });

  it("two disjoint events each take the full width", () => {
    const slots = layoutOverlapClusters([
      { start: m(9), end: m(10) },
      { start: m(11), end: m(12) },
    ]);
    expect(slots).toEqual([
      { column: 0, totalColumns: 1 },
      { column: 0, totalColumns: 1 },
    ]);
  });

  it("width is per cluster, not per day", () => {
    const slots = layoutOverlapClusters([
      { start: m(9), end: m(10) },
      { start: m(9, 30), end: m(10, 30) },
      { start: m(14), end: m(15) },
    ]);
    expect(slots[0]!.totalColumns).toBe(2);
    expect(slots[1]!.totalColumns).toBe(2);
    expect(slots[2]).toEqual({ column: 0, totalColumns: 1 });
  });

  it("short events collide by their minimum visual height", () => {
    const slots = layoutOverlapClusters(
      [
        { start: m(9), end: m(9, 5) },
        { start: m(9, 10), end: m(9, 15) },
      ],
      20,
    );
    expect(slots.map((s) => s.column)).toEqual([0, 1]);
    expect(slots[0]!.totalColumns).toBe(2);
  });

  it("back-to-back events reuse a column", () => {
    const slots = layoutOverlapClusters([
      { start: m(9), end: m(10) },
      { start: m(10), end: m(11) },
    ]);
    expect(slots).toEqual([
      { column: 0, totalColumns: 1 },
      { column: 0, totalColumns: 1 },
    ]);
  });
});

describe("stackCell", () => {
  it("six events with room for three show three and +3", () => {
    expect(stackCell(6, 3)).toEqual({ visible: 3, hidden: 3 });
  });
  it("nothing hidden when everything fits", () => {
    expect(stackCell(2, 3)).toEqual({ visible: 2, hidden: 0 });
  });
});

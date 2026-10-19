import { daySegment, layoutOverlapClusters, MIN_EVENT_VISUAL_MINUTES, stackCell } from "../eventLayout";

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

/**
 * i3-calendar — the time grid's shared geometry: one 15-minute minimum for the
 * bar and the overlap layout, and an overnight event drawn per day.
 */
const MIN = 60_000;
const day = Date.UTC(2026, 9, 20); // a day's midnight, in ms
const at = (dayOffset: number, hh: number, mm = 0) => day + dayOffset * 1440 * MIN + (hh * 60 + mm) * MIN;
const next = day + 1440 * MIN;

describe("daySegment (i3-calendar)", () => {
  it("keeps a same-day event whole", () => {
    expect(daySegment(at(0, 9, 15), at(0, 9, 30), day, next)).toEqual({
      startMin: 555, endMin: 570, continuesBefore: false, continuesAfter: false,
    });
  });

  it("cuts Mon 22:00 → Wed 02:00 into 22:00–24:00, a whole Tuesday, and 00:00–02:00", () => {
    const start = at(0, 22), end = at(2, 2);
    expect(daySegment(start, end, day, next)).toMatchObject({ startMin: 1320, endMin: 1440, continuesAfter: true });
    expect(daySegment(start, end, next, next + 1440 * MIN)).toMatchObject({ startMin: 0, endMin: 1440, continuesBefore: true, continuesAfter: true });
    expect(daySegment(start, end, next + 1440 * MIN, next + 2880 * MIN)).toMatchObject({ startMin: 0, endMin: 120, continuesBefore: true, continuesAfter: false });
  });

  it("an event ending exactly at midnight does not appear on the next day", () => {
    expect(daySegment(at(0, 23), next, next, next + 1440 * MIN)).toBeNull();
  });

  it("an event on another day is not on this one", () => {
    expect(daySegment(at(3, 9), at(3, 10), day, next)).toBeNull();
  });
});

describe("the shared minimum (i3-calendar)", () => {
  it("is one 15-minute step", () => {
    expect(MIN_EVENT_VISUAL_MINUTES).toBe(15);
  });

  it("two back-to-back 15-minute events share one column; a 5-minute one still reserves 15", () => {
    const min = MIN_EVENT_VISUAL_MINUTES;
    expect(layoutOverlapClusters([{ start: 540, end: 555 }, { start: 555, end: 570 }], min).map((s) => s.totalColumns)).toEqual([1, 1]);
    expect(layoutOverlapClusters([{ start: 540, end: 545 }, { start: 550, end: 560 }], min).map((s) => s.totalColumns)).toEqual([2, 2]);
  });
});

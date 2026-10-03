/**
 * cards-g5 — the one reading of saved card frames (cardFrames.ts).
 *
 * Pure functions, so every claim is checked on values: what a config without
 * the keys reads as, what is rejected, clamped and omitted, how an override
 * inherits per dimension, the 500-override cap, the config partials the views
 * and the settings write, and the pointer/grid math the handle and the grid use.
 */

import {
  CARD_FRAME_BOUNDS,
  CARD_FRAME_OVERRIDE_CAP,
  clampGridSpan,
  effectiveSpan,
  gridColumnCount,
  heightAfterDrag,
  normalizeCardFrame,
  normalizeCardFrames,
  resetAllFrames,
  resolveCardFrame,
  sameFrame,
  snapHeightRem,
  spanAfterDrag,
  withOverride,
  withoutOverride,
  withViewHeight,
} from "../cardFrames";

describe("cards-g5 — normalising a config", () => {
  it.each([undefined, null, {}, "frames", 42, []])("%p has no frames at all", (config) => {
    expect(normalizeCardFrames(config)).toEqual({ view: {}, byRecord: {} });
  });

  it("reads own properties only: an inherited dimension is not saved", () => {
    expect(normalizeCardFrame(Object.create({ heightRem: 20, gridSpan: 2 }))).toBeUndefined();
    const mixed = Object.assign(Object.create({ gridSpan: 3 }), { heightRem: 12 });
    expect(normalizeCardFrame(mixed)).toEqual({ heightRem: 12 });
  });

  it("keeps valid values as they are", () => {
    const config = {
      cardFrame: { heightRem: 12, gridSpan: 2 },
      cardFramesByRecord: { "notes/A.md": { heightRem: 20 }, "notes/B.md": { gridSpan: 3 } },
    };
    expect(normalizeCardFrames(config)).toEqual({
      view: { heightRem: 12, gridSpan: 2 },
      byRecord: { "notes/A.md": { heightRem: 20 }, "notes/B.md": { gridSpan: 3 } },
    });
  });

  it("clamps to the bounds: height 6..40 rem, span 1..4 whole columns", () => {
    expect(CARD_FRAME_BOUNDS).toEqual({ heightRem: { min: 6, max: 40 }, gridSpan: { min: 1, max: 4 } });
    expect(normalizeCardFrame({ heightRem: 2, gridSpan: 0 })).toEqual({ heightRem: 6, gridSpan: 1 });
    expect(normalizeCardFrame({ heightRem: 400, gridSpan: 9 })).toEqual({ heightRem: 40, gridSpan: 4 });
    expect(normalizeCardFrame({ gridSpan: 2.6 })).toEqual({ gridSpan: 3 });
    expect(normalizeCardFrame({ heightRem: -5 })).toEqual({ heightRem: 6 });
  });

  it("reads numeric strings through the one coercion module and rejects everything else", () => {
    expect(normalizeCardFrame({ heightRem: "14", gridSpan: " 2 " })).toEqual({ heightRem: 14, gridSpan: 2 });
    for (const bad of ["abc", "", "12abc", NaN, Infinity, -Infinity, null, true, {}, []]) {
      expect(normalizeCardFrame({ heightRem: bad, gridSpan: bad })).toBeUndefined();
    }
  });

  it("drops what is not a frame, and an entry left empty", () => {
    const { byRecord } = normalizeCardFrames({
      cardFramesByRecord: {
        "a.md": { heightRem: 10 },
        "b.md": { heightRem: "tall" },
        "c.md": "big",
        "d.md": null,
        "e.md": [10],
        "": { heightRem: 10 },
        "f.md": { width: 10 },
      },
    });
    expect(byRecord).toEqual({ "a.md": { heightRem: 10 } });
  });

  it("a map that is not an object reads as none", () => {
    expect(normalizeCardFrames({ cardFramesByRecord: ["a.md"] }).byRecord).toEqual({});
    expect(normalizeCardFrames({ cardFramesByRecord: "a.md" }).byRecord).toEqual({});
    expect(normalizeCardFrames({ cardFrame: [12] }).view).toEqual({});
  });

  it("survives a JSON round trip unchanged", () => {
    const config = { cardFrame: { heightRem: 9 }, cardFramesByRecord: { "x/y.md": { heightRem: 15, gridSpan: 2 } } };
    expect(normalizeCardFrames(JSON.parse(JSON.stringify(config)))).toEqual(normalizeCardFrames(config));
  });
});

describe("cards-g5 — inheritance", () => {
  it("the override wins per dimension; a missing one inherits the view value", () => {
    expect(resolveCardFrame({ heightRem: 10, gridSpan: 2 }, { heightRem: 20 })).toEqual({ heightRem: 20, gridSpan: 2 });
    expect(resolveCardFrame({ heightRem: 10, gridSpan: 2 }, { gridSpan: 3 })).toEqual({ heightRem: 10, gridSpan: 3 });
    expect(resolveCardFrame({ heightRem: 10 }, undefined)).toEqual({ heightRem: 10 });
  });

  it("with neither, the frame is empty: the card keeps its existing sizing", () => {
    expect(resolveCardFrame({}, undefined)).toEqual({});
    expect(resolveCardFrame({}, {})).toEqual({});
  });
});

describe("cards-g5 — writing an override", () => {
  const config = { layout: "grid", cardFramesByRecord: { "a.md": { heightRem: 10 } } };

  it("adds and changes one card's override, keeping the others", () => {
    expect(withOverride(config, "b.md", { gridSpan: 2 })).toEqual({
      cardFramesByRecord: { "a.md": { heightRem: 10 }, "b.md": { gridSpan: 2 } },
    });
    expect(withOverride(config, "a.md", { heightRem: 30 })).toEqual({ cardFramesByRecord: { "a.md": { heightRem: 30 } } });
  });

  it("normalises what it writes", () => {
    expect(withOverride({}, "a.md", { heightRem: 99, gridSpan: 1.4 })).toEqual({
      cardFramesByRecord: { "a.md": { heightRem: 40, gridSpan: 1 } },
    });
  });

  it("an empty frame removes the override, as withoutOverride does", () => {
    expect(withOverride(config, "a.md", {})).toEqual({ cardFramesByRecord: undefined });
    expect(withOverride(config, "a.md", undefined)).toEqual({ cardFramesByRecord: undefined });
    expect(withoutOverride(config, "a.md")).toEqual({ cardFramesByRecord: undefined });
    const two = { cardFramesByRecord: { "a.md": { heightRem: 10 }, "b.md": { heightRem: 12 } } };
    expect(withoutOverride(two, "a.md")).toEqual({ cardFramesByRecord: { "b.md": { heightRem: 12 } } });
  });

  it("does not mutate the config it reads", () => {
    const frozen = JSON.parse(JSON.stringify(config));
    withOverride(config, "b.md", { heightRem: 8 });
    withoutOverride(config, "a.md");
    expect(config).toEqual(frozen);
  });
});

describe("cards-g5 — the 500-override cap", () => {
  const full = () => {
    const byRecord: Record<string, { heightRem: number }> = {};
    for (let i = 0; i < CARD_FRAME_OVERRIDE_CAP; i++) byRecord[`n/${i}.md`] = { heightRem: 10 };
    return { cardFramesByRecord: byRecord };
  };

  it("is 500", () => {
    expect(CARD_FRAME_OVERRIDE_CAP).toBe(500);
  });

  it("refuses a NEW override once the map holds 500, and evicts nothing", () => {
    const config = full();
    expect(withOverride(config, "n/new.md", { heightRem: 12 })).toBeNull();
    expect(Object.keys(config.cardFramesByRecord)).toHaveLength(500);
  });

  it("still changes or removes an existing one at the cap", () => {
    const config = full();
    const changed = withOverride(config, "n/7.md", { heightRem: 20 });
    expect(changed?.cardFramesByRecord?.["n/7.md"]).toEqual({ heightRem: 20 });
    expect(Object.keys(changed?.cardFramesByRecord ?? {})).toHaveLength(500);
    const removed = withOverride(config, "n/7.md", undefined);
    expect(Object.keys(removed?.cardFramesByRecord ?? {})).toHaveLength(499);
  });

  it("one under the cap still accepts a new one", () => {
    const config = full();
    delete (config.cardFramesByRecord as Record<string, unknown>)["n/0.md"];
    expect(withOverride(config, "n/new.md", { heightRem: 12 })?.cardFramesByRecord?.["n/new.md"]).toEqual({ heightRem: 12 });
  });
});

describe("cards-g5 — the view-wide frame and reset all", () => {
  it("sets and clears the view height, keeping its span", () => {
    expect(withViewHeight({}, 12)).toEqual({ cardFrame: { heightRem: 12 } });
    expect(withViewHeight({ cardFrame: { heightRem: 12, gridSpan: 2 } }, undefined)).toEqual({ cardFrame: { gridSpan: 2 } });
    expect(withViewHeight({ cardFrame: { heightRem: 12 } }, undefined)).toEqual({ cardFrame: undefined });
  });

  it("reset all removes both keys", () => {
    expect(resetAllFrames()).toEqual({ cardFrame: undefined, cardFramesByRecord: undefined });
    const config = { layout: "grid", cardFrame: { heightRem: 9 }, cardFramesByRecord: { "a.md": { heightRem: 10 } } };
    const after = JSON.parse(JSON.stringify({ ...config, ...resetAllFrames() }));
    expect(after).toEqual({ layout: "grid" });
    expect(normalizeCardFrames(after)).toEqual({ view: {}, byRecord: {} });
  });
});

describe("cards-g5 — snapping and grid math", () => {
  it("heights snap to whole rem within bounds", () => {
    expect(snapHeightRem(12.4)).toBe(12);
    expect(snapHeightRem(12.5)).toBe(13);
    expect(snapHeightRem(1)).toBe(6);
    expect(snapHeightRem(80)).toBe(40);
  });

  it("a vertical drag moves the height in rem of the root font", () => {
    expect(heightAfterDrag(10, 32, 16)).toBe(12);
    expect(heightAfterDrag(10, -40, 16)).toBe(8);
    expect(heightAfterDrag(10, 7, 16)).toBe(10);
    expect(heightAfterDrag(10, 40, 20)).toBe(12);
  });

  it("a horizontal drag moves one column per step, within bounds", () => {
    expect(spanAfterDrag(1, 310, 300)).toBe(2);
    expect(spanAfterDrag(1, 140, 300)).toBe(1);
    expect(spanAfterDrag(2, -300, 300)).toBe(1);
    expect(spanAfterDrag(3, 3000, 300)).toBe(4);
    expect(spanAfterDrag(2, 500, 0)).toBe(2);
    expect(clampGridSpan(0)).toBe(1);
  });

  it("counts the columns an auto-fill grid lays out", () => {
    // 300 wide columns, 24 gap: 3 fit in 948, 2 in 947.
    expect(gridColumnCount(948, 300, 24)).toBe(3);
    expect(gridColumnCount(947, 300, 24)).toBe(2);
    // Narrower than one column: one column of the container's width.
    expect(gridColumnCount(200, 300, 24)).toBe(1);
    expect(gridColumnCount(0, 300, 24)).toBe(1);
  });

  it("caps a span to the columns there are, keeping it when unmeasured", () => {
    expect(effectiveSpan(3, 2)).toBe(2);
    expect(effectiveSpan(2, 4)).toBe(2);
    expect(effectiveSpan(3, undefined)).toBe(3);
    expect(effectiveSpan(undefined, 2)).toBeUndefined();
    expect(effectiveSpan(4, 0)).toBe(1);
  });

  it("compares frames by value", () => {
    expect(sameFrame({ heightRem: 8 }, { heightRem: 8 })).toBe(true);
    expect(sameFrame(undefined, {})).toBe(true);
    expect(sameFrame({ heightRem: 8 }, { heightRem: 8, gridSpan: 2 })).toBe(false);
  });
});

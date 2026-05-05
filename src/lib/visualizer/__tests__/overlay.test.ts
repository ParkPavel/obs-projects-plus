/**
 * R1.2 — Tests for the per-note Visualizer overlay model.
 */

import {
  OVERLAY_KEY,
  applyOverlay,
  compactOverlay,
  isEmptyOverlay,
  moveKey,
  readOverlay,
  toggleHidden,
  togglePinned,
  type NoteOverlay,
} from "../overlay";

const empty = (): NoteOverlay => ({ hidden: [], pinned: [], order: [] });

describe("readOverlay", () => {
  it("returns empty overlay for nullish frontmatter", () => {
    expect(readOverlay(null)).toEqual(empty());
    expect(readOverlay(undefined)).toEqual(empty());
  });

  it("returns empty overlay when key is missing", () => {
    expect(readOverlay({ status: "doing" })).toEqual(empty());
  });

  it("parses well-formed overlay", () => {
    const fm = {
      [OVERLAY_KEY]: { hidden: ["a"], pinned: ["b"], order: ["c", "d"] },
    };
    expect(readOverlay(fm)).toEqual({
      hidden: ["a"],
      pinned: ["b"],
      order: ["c", "d"],
    });
  });

  it("tolerates malformed shapes", () => {
    expect(readOverlay({ [OVERLAY_KEY]: "garbage" })).toEqual(empty());
    expect(readOverlay({ [OVERLAY_KEY]: [1, 2, 3] })).toEqual(empty());
    expect(
      readOverlay({ [OVERLAY_KEY]: { hidden: [1, "ok", null, ""] } }),
    ).toEqual({ hidden: ["ok"], pinned: [], order: [] });
  });
});

describe("applyOverlay", () => {
  const fm = {
    status: "doing",
    priority: "high",
    color: "#607D8B",
    tags: ["a", "b"],
    [OVERLAY_KEY]: { hidden: ["color"] },
    $internal: "drop",
  };

  it("drops reserved keys (pp_overlay, $*)", () => {
    const out = applyOverlay(fm, empty());
    expect(out.map((e) => e.key)).toEqual(["status", "priority", "color", "tags"]);
  });

  it("hides keys listed in overlay.hidden by default", () => {
    const out = applyOverlay(fm, { hidden: ["color"], pinned: [], order: [] });
    expect(out.map((e) => e.key)).toEqual(["status", "priority", "tags"]);
  });

  it("appends hidden keys when showHidden is true", () => {
    const out = applyOverlay(
      fm,
      { hidden: ["color"], pinned: [], order: [] },
      { showHidden: true },
    );
    expect(out.map((e) => e.key)).toEqual(["status", "priority", "tags", "color"]);
    expect(out[3]!.hidden).toBe(true);
  });

  it("floats pinned keys to the top in declared order", () => {
    const out = applyOverlay(fm, {
      hidden: [],
      pinned: ["tags", "priority"],
      order: [],
    });
    expect(out.map((e) => e.key)).toEqual(["tags", "priority", "status", "color"]);
    expect(out[0]!.pinned).toBe(true);
    expect(out[1]!.pinned).toBe(true);
    expect(out[2]!.pinned).toBe(false);
  });

  it("respects overlay.order for non-pinned keys", () => {
    const out = applyOverlay(fm, {
      hidden: [],
      pinned: [],
      order: ["tags", "color"],
    });
    expect(out.map((e) => e.key)).toEqual(["tags", "color", "status", "priority"]);
  });

  it("returns empty for empty frontmatter", () => {
    expect(applyOverlay(null, empty())).toEqual([]);
    expect(applyOverlay({}, empty())).toEqual([]);
  });

  it("ignores pinned keys that are missing or hidden", () => {
    const out = applyOverlay(fm, {
      hidden: ["color"],
      pinned: ["color", "ghost", "status"],
      order: [],
    });
    expect(out.map((e) => e.key)).toEqual(["status", "priority", "tags"]);
  });
});

describe("toggleHidden / togglePinned", () => {
  it("toggleHidden adds and removes the key", () => {
    const o1 = toggleHidden(empty(), "x");
    expect(o1.hidden).toEqual(["x"]);
    const o2 = toggleHidden(o1, "x");
    expect(o2.hidden).toEqual([]);
  });

  it("hiding a pinned key un-pins it", () => {
    const o = togglePinned(empty(), "x");
    const o2 = toggleHidden(o, "x");
    expect(o2.pinned).toEqual([]);
    expect(o2.hidden).toEqual(["x"]);
  });

  it("pinning a hidden key un-hides it", () => {
    const o = toggleHidden(empty(), "x");
    const o2 = togglePinned(o, "x");
    expect(o2.hidden).toEqual([]);
    expect(o2.pinned).toEqual(["x"]);
  });
});

describe("moveKey", () => {
  it("moves a non-pinned key up within the visible order", () => {
    const visible = ["a", "b", "c"];
    const moved = moveKey(empty(), visible, "c", -1);
    expect(moved.order).toEqual(["a", "c", "b"]);
  });

  it("clamps at boundaries (no-op)", () => {
    const visible = ["a", "b"];
    const moved = moveKey(empty(), visible, "a", -1);
    expect(moved).toEqual(empty());
  });

  it("reorders within the pinned region", () => {
    const overlay: NoteOverlay = { hidden: [], pinned: ["a", "b"], order: [] };
    const visible = ["a", "b", "c"];
    const moved = moveKey(overlay, visible, "a", 1);
    expect(moved.pinned).toEqual(["b", "a"]);
  });

  it("does not cross pinned/non-pinned boundary", () => {
    const overlay: NoteOverlay = { hidden: [], pinned: ["a"], order: [] };
    const visible = ["a", "b", "c"];
    const moved = moveKey(overlay, visible, "a", 1);
    expect(moved).toEqual(overlay);
  });
});

describe("compactOverlay / isEmptyOverlay", () => {
  it("compactOverlay returns null for empty input", () => {
    expect(compactOverlay(empty())).toBeNull();
  });

  it("compactOverlay omits empty arrays", () => {
    expect(
      compactOverlay({ hidden: ["a"], pinned: [], order: [] }),
    ).toEqual({ hidden: ["a"] });
  });

  it("isEmptyOverlay reflects emptiness", () => {
    expect(isEmptyOverlay(empty())).toBe(true);
    expect(isEmptyOverlay({ hidden: [], pinned: ["a"], order: [] })).toBe(false);
  });
});

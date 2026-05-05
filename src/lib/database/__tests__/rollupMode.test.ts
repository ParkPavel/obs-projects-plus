import {
  ROLLUP_MODES,
  classifyRollupTarget,
  getRollupMode,
  groupModes,
  modesForTarget,
} from "../rollupMode";

describe("ROLLUP_MODES master list", () => {
  it("has unique ids", () => {
    const ids = ROLLUP_MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the four canonical Notion groups in order", () => {
    const groups = [...new Set(ROLLUP_MODES.map((m) => m.group))];
    expect(groups).toEqual(["show", "count", "percent", "more"]);
  });

  it("uses i18n keys under database.rollup.modes.*", () => {
    for (const m of ROLLUP_MODES) {
      expect(m.i18nKey.startsWith("database.rollup.modes.")).toBe(true);
    }
  });
});

describe("getRollupMode", () => {
  it("resolves known ids", () => {
    expect(getRollupMode("sum")?.fn).toBe("sum");
  });
  it("returns null for unknown ids (does not throw)", () => {
    expect(getRollupMode("ghost")).toBeNull();
  });
});

describe("modesForTarget", () => {
  it("includes any-applicable modes for numeric targets", () => {
    const ids = modesForTarget("numeric").map((m) => m.id);
    expect(ids).toContain("show_original");
    expect(ids).toContain("count_all");
    expect(ids).toContain("sum");
    expect(ids).toContain("median");
  });

  it("excludes numeric-only modes for text targets", () => {
    const ids = modesForTarget("text").map((m) => m.id);
    expect(ids).not.toContain("sum");
    expect(ids).not.toContain("median");
    expect(ids).toContain("count_unique");
  });

  it("includes temporal-only modes (earliest/latest) for temporal", () => {
    const ids = modesForTarget("temporal").map((m) => m.id);
    expect(ids).toContain("earliest");
    expect(ids).toContain("latest");
    expect(ids).not.toContain("sum");
  });

  it("includes percent-per-group only for boolean targets", () => {
    expect(modesForTarget("boolean").map((m) => m.id)).toContain(
      "percent_per_group",
    );
    expect(modesForTarget("text").map((m) => m.id)).not.toContain(
      "percent_per_group",
    );
  });
});

describe("groupModes", () => {
  it("partitions modes into their groups in order", () => {
    const grouped = groupModes(modesForTarget("numeric"));
    expect(grouped.show.map((m) => m.id)).toEqual(["show_original", "show_unique"]);
    expect(grouped.more.map((m) => m.id)).toContain("sum");
  });
});

describe("classifyRollupTarget", () => {
  it.each([
    ["number", "numeric"],
    ["date", "temporal"],
    ["datetime", "temporal"],
    ["boolean", "boolean"],
    ["string", "text"],
    ["select", "text"],
    ["relation", "text"],
    ["unknown-type", "any"],
  ])("classifies %s as %s", (input, expected) => {
    expect(classifyRollupTarget(input)).toBe(expected);
  });
});

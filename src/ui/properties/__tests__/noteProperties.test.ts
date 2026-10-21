/**
 * 3.7.2 B2 — which properties the note-header block shows, in what order,
 * and what a single edit writes.
 */
import {
  isReservedPropertyKey,
  planValueWrite,
  validateNewPropertyName,
  visibleProperties,
  parseStoredDate,
  dateToCellText,
} from "../noteProperties";
import { createFrontmatterWriter } from "src/lib/frontmatter/writer";

const EMPTY = { hidden: [], pinned: [], order: [] };

describe("B2 visibleProperties", () => {
  const fm = {
    title: "A",
    status: "open",
    pp_overlay: { hidden: ["secret"] },
    pp_types: { status: "status" },
    $system: 1,
    secret: "x",
    due: "2026-10-14",
  };

  it("never shows pp_overlay, pp_types or $ keys as ordinary properties", () => {
    const keys = visibleProperties(fm, EMPTY).map((e) => e.key);
    expect(keys).toEqual(["title", "status", "secret", "due"]);
    const all = visibleProperties(fm, EMPTY, { showHidden: true }).map((e) => e.key);
    expect(all).not.toContain("pp_overlay");
    expect(all).not.toContain("pp_types");
  });

  it("pins first, honours order, hides hidden, appends hidden only on request", () => {
    const overlay = { hidden: ["secret"], pinned: ["due"], order: ["status", "title"] };
    expect(visibleProperties(fm, overlay).map((e) => e.key)).toEqual(["due", "status", "title"]);
    const shown = visibleProperties(fm, overlay, { showHidden: true });
    expect(shown.map((e) => e.key)).toEqual(["due", "status", "title", "secret"]);
    expect(shown[3]!.hidden).toBe(true);
  });

  it("is empty for a note without frontmatter", () => {
    expect(visibleProperties(null, EMPTY)).toEqual([]);
  });

  it("treats pp_* and $* as reserved", () => {
    expect(isReservedPropertyKey("pp_overlay")).toBe(true);
    expect(isReservedPropertyKey("$x")).toBe(true);
    expect(isReservedPropertyKey("status")).toBe(false);
  });
});

describe("B2 validateNewPropertyName", () => {
  const fm = { status: "x" };
  it("accepts a fresh trimmed name", () => {
    expect(validateNewPropertyName("  owner ", fm)).toEqual({ ok: true, key: "owner" });
  });
  it("refuses empty, existing and reserved names", () => {
    expect(validateNewPropertyName("  ", fm)).toEqual({ ok: false, reason: "empty" });
    expect(validateNewPropertyName("status", fm)).toEqual({ ok: false, reason: "exists" });
    expect(validateNewPropertyName("pp_overlay", fm)).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("B2 planValueWrite", () => {
  it("skips a commit that did not change the value", () => {
    expect(planValueWrite("open", "open", "string")).toEqual({ kind: "skip" });
    expect(planValueWrite(["a", "b"], "a, b", "list")).toEqual({ kind: "skip" });
    expect(planValueWrite(3, "3", "number")).toEqual({ kind: "skip" });
  });
  it("writes the parsed value when it changed", () => {
    expect(planValueWrite("open", "done", "string")).toEqual({ kind: "write", value: "done" });
    expect(planValueWrite(3, "4.5", "number")).toEqual({ kind: "write", value: 4.5 });
    expect(planValueWrite(["a"], "a, b", "list")).toEqual({ kind: "write", value: ["a", "b"] });
  });
  it("refuses an invalid draft without writing", () => {
    expect(planValueWrite(3, "abc", "number")).toEqual({
      kind: "invalid",
      i18nKey: "database.cell-editor.errors.number",
    });
  });
});

describe("B2 dates", () => {
  it("round-trips a stored day and a stored datetime", () => {
    const d = parseStoredDate("2026-10-14");
    expect(d).not.toBeNull();
    expect(dateToCellText(d!, false)).toBe("2026-10-14");
    const dt = parseStoredDate("2026-10-14T09:30");
    expect(dateToCellText(dt!, true)).toBe("2026-10-14T09:30");
    expect(parseStoredDate("not a date")).toBeNull();
    expect(parseStoredDate(null)).toBeNull();
  });
});

describe("B2 a single-key write leaves every other key untouched", () => {
  it("setField through processFrontMatter changes exactly one key", async () => {
    const fm: Record<string, unknown> = {
      title: "A",
      tags: ["x"],
      pp_overlay: { pinned: ["title"] },
      count: 2,
    };
    const before = JSON.parse(JSON.stringify(fm));
    const app = {
      fileManager: {
        processFrontMatter: async (_f: unknown, fn: (f: Record<string, unknown>) => void) => fn(fm),
      },
    } as never;
    await createFrontmatterWriter(app).setField({ path: "a.md" } as never, "count", 3);
    expect(fm["count"]).toBe(3);
    for (const k of ["title", "tags", "pp_overlay"]) expect(fm[k]).toEqual(before[k]);
    expect(Object.keys(fm)).toEqual(Object.keys(before));
  });
});

describe("i3-props rules", () => {
  const {
    chipItem,
    isNestedValue,
    noteScopeFor,
    planListWrite,
    validateRename,
    valuesForKey,
  } = require("../noteProperties");

  it("treats an object, or a list holding one, as nested", () => {
    expect(isNestedValue({ a: 1 })).toBe(true);
    expect(isNestedValue([{ a: 1 }, "x"])).toBe(true);
    expect(isNestedValue(["a", 1])).toBe(false);
    expect(isNestedValue(null)).toBe(false);
    expect(isNestedValue("x")).toBe(false);
  });

  it("validates a rename like a new property; the same name is nothing to do", () => {
    const fm = { status: "x", owner: "y" };
    expect(validateRename("status", "status", fm)).toEqual({ ok: false, reason: "empty" });
    expect(validateRename("status", "owner", fm)).toEqual({ ok: false, reason: "exists" });
    expect(validateRename("status", "pp_x", fm)).toEqual({ ok: false, reason: "reserved" });
    expect(validateRename("status", "$x", fm)).toEqual({ ok: false, reason: "reserved" });
    expect(validateRename("status", " ", fm)).toEqual({ ok: false, reason: "empty" });
    expect(validateRename("status", " state ", fm)).toEqual({ ok: true, key: "state" });
  });

  it("keeps a comma inside a chip and writes lists as arrays", () => {
    expect(chipItem(" Smith, John ", "list")).toBe("Smith, John");
    expect(chipItem("#a", "tags")).toBe("a");
    expect(chipItem("Note", "relation")).toBe("[[Note]]");
    expect(chipItem("[[Note]]", "relation")).toBe("[[Note]]");
    expect(chipItem("  ", "list")).toBeNull();
    expect(planListWrite(["Smith, John"], ["Smith, John", "Doe"], "list")).toEqual({
      kind: "write",
      value: ["Smith, John", "Doe"],
    });
    expect(planListWrite(["Smith, John"], ["Smith, John"], "list")).toEqual({ kind: "skip" });
  });

  it("scopes values to the deepest folder project, else the note's folder", () => {
    const projects = [
      { dataSource: { kind: "folder", config: { path: "Work", recursive: true } } },
      { dataSource: { kind: "folder", config: { path: "Work/Sub", recursive: false } } },
      { dataSource: { kind: "tag", config: { tag: "x" } } },
    ];
    expect(noteScopeFor("Work/Sub/a.md", projects)).toEqual({ folder: "Work/Sub", recursive: false });
    expect(noteScopeFor("Work/Deep/b/a.md", projects)).toEqual({ folder: "Work", recursive: true });
    expect(noteScopeFor("Home/a.md", projects)).toEqual({ folder: "Home", recursive: false });
  });

  it("collects distinct scalar and list values of a key, skipping objects", () => {
    expect(valuesForKey([{ s: "open" }, { s: ["done", "open"] }, { s: { x: 1 } }, null, { s: 3 }], "s")).toEqual([
      "open",
      "done",
      "3",
    ]);
  });
});

describe("B2 setting default", () => {
  it("replaces Obsidian's properties block by default", () => {
    const { DEFAULT_PREFERENCES } = require("src/settings/v4/settings");
    expect(DEFAULT_PREFERENCES.propertiesInNoteHeader).toBe(true);
  });
});

/**
 * i3-final — the pure halves of two block mechanisms: where a moved row
 * lands (reorderedKeys) and the memo of the values other notes hold
 * (usedValuesCache).
 */
import { reorderedKeys } from "../noteProperties";
import { createUsedValuesCache } from "../usedValuesCache";

const row = (key: string, pinned = false, hidden = false) => ({ key, pinned, hidden });

describe("i3-final reorderedKeys", () => {
  const entries = [row("p1", true), row("p2", true), row("a"), row("b"), row("c"), row("h", false, true)];

  it("moves a row to the slot asked", () => {
    expect(reorderedKeys(entries, "c", 2)).toEqual(["p1", "p2", "c", "a", "b"]);
    expect(reorderedKeys(entries, "a", 4)).toEqual(["p1", "p2", "b", "c", "a"]);
  });

  it("keeps a row inside its region (pinned / unpinned)", () => {
    expect(reorderedKeys(entries, "a", 0)).toBeNull();
    expect(reorderedKeys(entries, "c", 0)).toEqual(["p1", "p2", "c", "a", "b"]);
    expect(reorderedKeys(entries, "p1", 4)).toEqual(["p2", "p1", "a", "b", "c"]);
  });

  it("is null for a hidden row, an unknown row or no move", () => {
    expect(reorderedKeys(entries, "h", 0)).toBeNull();
    expect(reorderedKeys(entries, "zz", 0)).toBeNull();
    expect(reorderedKeys(entries, "b", 3)).toBeNull();
  });
});

describe("i3-final usedValuesCache", () => {
  it("retains every scoped non-template value for search instead of cutting off before the query", () => {
    const notes: Record<string, Record<string, unknown>> = Object.fromEntries(Array.from({ length: 600 }, (_, id) => [`P/${id}.md`, { status: id === 599 ? "Ёлка" : `Value ${id}` }]));
    notes["Q/other.md"] = { status: "wrong scope" }; notes["P/Templates/a.md"] = { status: "template only" };
    const read = jest.fn((f: { path: string }) => notes[f.path]);
    const c = createUsedValuesCache({ files: () => Object.keys(notes).map(path => ({ path })), frontmatterOf: read, templateFolders: () => ["P/Templates"] });
    try {
      const all = c.get("P/own.md", { status: "mine" }, "status", { folder: "P", recursive: true });
      expect(all).toHaveLength(601); expect(all[0]).toBe("mine"); expect(all).toContain("Ёлка");
      expect(all).not.toContain("wrong scope"); expect(all).not.toContain("template only");
      c.get("P/own.md", { status: "new own" }, "status", { folder: "P", recursive: true });
      expect(c.scans()).toBe(1); expect(read).toHaveBeenCalledTimes(600);
    } finally { c.dispose(); }
  });
  it("does not drop values after the first200 items of the current note's list", () => {
    const own = Array.from({ length: 400 }, (_, id) => `Own ${id}`), c = createUsedValuesCache({ files: () => [], frontmatterOf: () => null });
    try { expect(c.get("own.md", { status: own }, "status", { folder: "", recursive: true })).toEqual(own); } finally { c.dispose(); }
  });
  const files = [{ path: "P/a.md" }, { path: "P/b.md" }, { path: "P/c.md" }, { path: "Q/d.md" }];
  const fms: Record<string, Record<string, unknown>> = {
    "P/b.md": { status: "open", color: "#ff0000" },
    "P/c.md": { status: ["done", "open"] },
    "Q/d.md": { status: "elsewhere" },
  };
  const scope = { folder: "P", recursive: false };

  function cache() {
    const frontmatterOf = jest.fn((f: { path: string }) => fms[f.path]);
    const c = createUsedValuesCache({ files: () => files, frontmatterOf }, 300);
    return { c, frontmatterOf };
  }

  afterEach(() => jest.useRealTimers());

  it("scans the vault once per (note, scope, key), the note's own value first", () => {
    const { c } = cache();
    expect(c.get("P/a.md", { status: "mine" }, "status", scope)).toEqual(["mine", "open", "done"]);
    expect(c.get("P/a.md", { status: "changed" }, "status", scope)).toEqual(["changed", "open", "done"]);
    expect(c.scans()).toBe(1);
    c.get("P/a.md", null, "color", scope);
    c.get("P/a.md", null, "status", { folder: "", recursive: true });
    expect(c.scans()).toBe(3);
  });

  it("drops the memo once metadata events stop (debounced)", () => {
    jest.useFakeTimers();
    const { c } = cache();
    c.get("P/a.md", null, "status", scope);
    c.invalidateSoon();
    c.invalidateSoon();
    c.get("P/a.md", null, "status", scope);
    expect(c.scans()).toBe(1);
    jest.advanceTimersByTime(300);
    c.get("P/a.md", null, "status", scope);
    expect(c.scans()).toBe(2);
    c.invalidateSoon();
    c.dispose();
    jest.advanceTimersByTime(1000);
    c.get("P/a.md", null, "status", scope);
    expect(c.scans()).toBe(2);
  });
});

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

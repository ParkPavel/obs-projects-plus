/**
 * i3-props — rename and delete carry the key's own bookkeeping (`pp_overlay`,
 * `pp_types`) with it, keep the YAML order, and never rewrite a value.
 */
import { deleteKeyIn, renameKeyIn, reorderKeysIn } from "../propertyKeys";
import { deleteProperty, renameProperty, reorderProperties } from "../propertyKeysWriter";

function sample(): Record<string, unknown> {
  return {
    title: "A",
    status: "open",
    meta: { owner: { name: "x" } },
    due: "2026-10-21",
    pp_overlay: { pinned: ["status"], hidden: ["due"], order: ["meta", "status"] },
    pp_types: { status: "status", due: "date" },
  };
}

describe("i3-props renameKeyIn", () => {
  it("renames in place, keeps the key's position and moves its overlay and type entries", () => {
    const fm = sample();
    expect(renameKeyIn(fm, "status", "state")).toBe(true);
    expect(Object.keys(fm)).toEqual(["title", "state", "meta", "due", "pp_overlay", "pp_types"]);
    expect(fm["state"]).toBe("open");
    expect(fm["pp_overlay"]).toEqual({ pinned: ["state"], hidden: ["due"], order: ["meta", "state"] });
    expect(fm["pp_types"]).toEqual({ state: "status", due: "date" });
  });

  it("moves a nested value as the same structure, never as text", () => {
    const fm = sample();
    const nested = fm["meta"];
    renameKeyIn(fm, "meta", "info");
    expect(fm["info"]).toBe(nested);
  });

  it("refuses an absent source or a taken name and changes nothing", () => {
    const fm = sample();
    const before = JSON.stringify(fm);
    expect(renameKeyIn(fm, "missing", "x")).toBe(false);
    expect(renameKeyIn(fm, "status", "title")).toBe(false);
    expect(JSON.stringify(fm)).toBe(before);
  });
});

describe("i3-props deleteKeyIn", () => {
  it("removes the key and its overlay and type entries; empty bookkeeping goes too", () => {
    const fm = sample();
    expect(deleteKeyIn(fm, "status")).toBe(true);
    expect("status" in fm).toBe(false);
    expect(fm["pp_overlay"]).toEqual({ hidden: ["due"], order: ["meta"] });
    expect(fm["pp_types"]).toEqual({ due: "date" });
    deleteKeyIn(fm, "due");
    deleteKeyIn(fm, "meta");
    expect("pp_overlay" in fm).toBe(false);
    expect("pp_types" in fm).toBe(false);
    expect(fm).toEqual({ title: "A" });
  });

  it("is false for a key that is not there", () => {
    expect(deleteKeyIn({ a: 1 }, "b")).toBe(false);
  });
});

describe("i3-final reorderKeysIn", () => {
  it("writes the new order into the YAML, nested values untouched, pp_* at the end", () => {
    const nested = { owner: { name: "x" } };
    const fm: Record<string, unknown> = {
      pp_types: { status: "status" },
      title: "A",
      status: "open",
      meta: nested,
      due: "2026-10-21",
    };
    expect(reorderKeysIn(fm, ["due", "title", "meta", "status"])).toBe(true);
    expect(Object.keys(fm)).toEqual(["due", "title", "meta", "status", "pp_types"]);
    expect(fm["meta"]).toBe(nested);
    expect(fm["pp_types"]).toEqual({ status: "status" });
  });

  it("clears the overlay order of the moved keys; hidden keys keep their slot", () => {
    const fm: Record<string, unknown> = {
      a: 1,
      secret: 2,
      b: 3,
      c: 4,
      pp_overlay: { hidden: ["secret"], order: ["c", "a", "secret"] },
    };
    expect(reorderKeysIn(fm, ["c", "b", "a"])).toBe(true);
    expect(Object.keys(fm)).toEqual(["c", "secret", "b", "a", "pp_overlay"]);
    expect(fm["pp_overlay"]).toEqual({ hidden: ["secret"], order: ["secret"] });
  });

  it("orders pinned keys in pp_overlay.pinned and leaves their YAML place alone", () => {
    const fm: Record<string, unknown> = {
      a: 1,
      p: 2,
      q: 3,
      b: 4,
      pp_overlay: { pinned: ["p", "q"] },
    };
    expect(reorderKeysIn(fm, ["q", "p", "b", "a"])).toBe(true);
    expect(Object.keys(fm)).toEqual(["b", "p", "q", "a", "pp_overlay"]);
    expect(fm["pp_overlay"]).toEqual({ pinned: ["q", "p"] });
  });

  it("is false and changes nothing when the order is already the YAML order", () => {
    const fm: Record<string, unknown> = { a: 1, b: 2, pp_types: {} };
    const before = JSON.stringify(fm);
    expect(reorderKeysIn(fm, ["a", "b", "missing", "pp_types"])).toBe(false);
    expect(JSON.stringify(fm)).toBe(before);
  });

  it("writes through one processFrontMatter", async () => {
    const fm: Record<string, unknown> = { a: 1, b: 2 };
    const processFrontMatter = jest.fn(async (_f: unknown, fn: (f: Record<string, unknown>) => void) => fn(fm));
    const app = { fileManager: { processFrontMatter } } as never;
    expect(await reorderProperties(app, { path: "a.md" } as never, ["b", "a"])).toBe(true);
    expect(Object.keys(fm)).toEqual(["b", "a"]);
    expect(processFrontMatter).toHaveBeenCalledTimes(1);
  });
});

describe("i3-props propertyKeysWriter", () => {
  const appFor = (fm: Record<string, unknown>) =>
    ({
      fileManager: {
        processFrontMatter: jest.fn(async (_f: unknown, fn: (f: Record<string, unknown>) => void) => fn(fm)),
      },
    }) as never;

  it("renames and deletes through one processFrontMatter each", async () => {
    const fm = sample();
    const app = appFor(fm);
    expect(await renameProperty(app, { path: "a.md" } as never, "title", "name")).toBe(true);
    expect(await deleteProperty(app, { path: "a.md" } as never, "name")).toBe(true);
    expect("name" in fm).toBe(false);
    expect((app as { fileManager: { processFrontMatter: jest.Mock } }).fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
  });

  it("resolves false on a host without the API", async () => {
    expect(await deleteProperty({ fileManager: {} } as never, { path: "a.md" } as never, "x")).toBe(false);
  });
});

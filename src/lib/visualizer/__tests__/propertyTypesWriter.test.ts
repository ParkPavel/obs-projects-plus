import type { App, TFile } from "obsidian";
import { TYPES_KEY } from "../propertyTypes";
import { setPropertyType } from "../propertyTypesWriter";

function makeApp(processFn?: jest.Mock): App {
  const fileManager: Record<string, unknown> = {};
  if (processFn) fileManager["processFrontMatter"] = processFn;
  return { fileManager } as unknown as App;
}

const file = { path: "Note.md" } as unknown as TFile;

describe("setPropertyType", () => {
  it("returns false when host lacks processFrontMatter", async () => {
    const ok = await setPropertyType(makeApp(), file, "color", "color");
    expect(ok).toBe(false);
  });

  it("creates the map and sets a type", async () => {
    const fm: Record<string, unknown> = {};
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await setPropertyType(makeApp(processFn), file, "color", "color");
    expect(fm[TYPES_KEY]).toEqual({ color: "color" });
  });

  it("merges with existing entries", async () => {
    const fm: Record<string, unknown> = { [TYPES_KEY]: { color: "color" } };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await setPropertyType(makeApp(processFn), file, "priority", "select");
    expect(fm[TYPES_KEY]).toEqual({ color: "color", priority: "select" });
  });

  it("clears a single key with null", async () => {
    const fm: Record<string, unknown> = {
      [TYPES_KEY]: { color: "color", priority: "select" },
    };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await setPropertyType(makeApp(processFn), file, "color", null);
    expect(fm[TYPES_KEY]).toEqual({ priority: "select" });
  });

  it("removes the pp_types key when last entry is cleared", async () => {
    const fm: Record<string, unknown> = { [TYPES_KEY]: { color: "color" } };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await setPropertyType(makeApp(processFn), file, "color", null);
    expect(fm[TYPES_KEY]).toBeUndefined();
  });

  it("is a no-op for unknown types", async () => {
    const fm: Record<string, unknown> = {};
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    // Force an unknown type via cast for the test.
    await setPropertyType(makeApp(processFn), file, "x", "alien" as never);
    expect(fm[TYPES_KEY]).toBeUndefined();
  });
});

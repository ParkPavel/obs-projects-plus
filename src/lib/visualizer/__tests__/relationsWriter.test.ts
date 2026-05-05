import type { App, TFile } from "obsidian";
import {
  appendRelationToFile,
  removeRelationFromFile,
} from "../relationsWriter";

function makeApp(processFn?: jest.Mock): App {
  const fileManager: Record<string, unknown> = {};
  if (processFn) fileManager["processFrontMatter"] = processFn;
  return { fileManager } as unknown as App;
}

const file = { path: "Note.md" } as unknown as TFile;

describe("appendRelationToFile", () => {
  it("returns false when processFrontMatter is missing", async () => {
    const ok = await appendRelationToFile(makeApp(), file, { path: "A" });
    expect(ok).toBe(false);
  });

  it("appends a new wikilink under the default key", async () => {
    const fm: Record<string, unknown> = {};
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    const ok = await appendRelationToFile(makeApp(processFn), file, { path: "A" });
    expect(ok).toBe(true);
    expect(fm["links"]).toEqual(["[[A]]"]);
  });

  it("appends under a custom key", async () => {
    const fm: Record<string, unknown> = { refs: ["[[Old]]"] };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await appendRelationToFile(makeApp(processFn), file, { path: "New" }, "refs");
    expect(fm["refs"]).toEqual(["[[Old]]", "[[New]]"]);
  });

  it("is idempotent for same path", async () => {
    const fm: Record<string, unknown> = { links: ["[[A]]"] };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await appendRelationToFile(makeApp(processFn), file, { path: "A" });
    expect(fm["links"]).toEqual(["[[A]]"]);
  });
});

describe("removeRelationFromFile", () => {
  it("removes one entry but keeps the array", async () => {
    const fm: Record<string, unknown> = { links: ["[[A]]", "[[B]]"] };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await removeRelationFromFile(makeApp(processFn), file, "A");
    expect(fm["links"]).toEqual(["[[B]]"]);
  });

  it("deletes the key when the last entry is removed", async () => {
    const fm: Record<string, unknown> = { links: ["[[A]]"] };
    const processFn = jest.fn(async (_f, mutate: (m: Record<string, unknown>) => void) => mutate(fm));
    await removeRelationFromFile(makeApp(processFn), file, "A");
    expect(fm["links"]).toBeUndefined();
  });
});

/**
 * R1.2 — Tests for `writeOverlay`.
 */

import type { App, TFile } from "obsidian";
import { OVERLAY_KEY } from "../overlay";
import { writeOverlay } from "../overlayWriter";

function makeApp(processFn?: jest.Mock): App {
  const fileManager: Record<string, unknown> = {};
  if (processFn) fileManager["processFrontMatter"] = processFn;
  return { fileManager } as unknown as App;
}

const file = { path: "Note.md" } as unknown as TFile;

describe("writeOverlay", () => {
  it("returns false when host lacks processFrontMatter", async () => {
    const app = makeApp();
    const ok = await writeOverlay(app, file, { hidden: [], pinned: [], order: [] });
    expect(ok).toBe(false);
  });

  it("removes pp_overlay when the overlay is empty", async () => {
    const fm: Record<string, unknown> = { [OVERLAY_KEY]: { hidden: ["x"] } };
    const processFn = jest.fn(async (_f: TFile, mutate: (m: Record<string, unknown>) => void) => {
      mutate(fm);
    });
    const app = makeApp(processFn);
    const ok = await writeOverlay(app, file, { hidden: [], pinned: [], order: [] });
    expect(ok).toBe(true);
    expect(fm[OVERLAY_KEY]).toBeUndefined();
  });

  it("writes a compacted overlay (omits empty arrays)", async () => {
    const fm: Record<string, unknown> = {};
    const processFn = jest.fn(async (_f: TFile, mutate: (m: Record<string, unknown>) => void) => {
      mutate(fm);
    });
    const app = makeApp(processFn);
    const ok = await writeOverlay(app, file, {
      hidden: ["color"],
      pinned: [],
      order: [],
    });
    expect(ok).toBe(true);
    expect(fm[OVERLAY_KEY]).toEqual({ hidden: ["color"] });
  });

  it("preserves all three lists when populated", async () => {
    const fm: Record<string, unknown> = { other: "untouched" };
    const processFn = jest.fn(async (_f: TFile, mutate: (m: Record<string, unknown>) => void) => {
      mutate(fm);
    });
    const app = makeApp(processFn);
    await writeOverlay(app, file, {
      hidden: ["a"],
      pinned: ["b"],
      order: ["c", "d"],
    });
    expect(fm[OVERLAY_KEY]).toEqual({
      hidden: ["a"],
      pinned: ["b"],
      order: ["c", "d"],
    });
    expect(fm["other"]).toBe("untouched");
  });
});

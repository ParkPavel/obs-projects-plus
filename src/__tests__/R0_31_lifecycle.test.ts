/**
 * R0.31 — the plugin holds nothing it does not own (catalogue audit, C3).
 *
 * Obsidian's plugin guidelines: use `this.app`, not the global `app` (a
 * debugging aid that may go away); do not manage references to custom views;
 * clean up what you register. Three shapes broke that:
 *   - `(window as any).app` read in stores, views and modals;
 *   - one module-level `view` store holding the LAST opened Projects view,
 *     used as the owner of every rendered Markdown fragment — with two leaves
 *     open, the first leaf's Markdown belonged to the second and was unloaded
 *     with it, and the store kept a closed view alive;
 *   - window resize and pointer media-query listeners added at import time and
 *     never removed when the plugin unloads.
 */

import * as fs from "fs";
import * as path from "path";
import { collectSourceFiles, SRC_ROOT } from "./support/cssScan";

jest.mock("obsidian", () => {
  class Component {
    loaded = false;
    load() { this.loaded = true; }
    unload() { this.loaded = false; }
  }
  return { Component };
}, { virtual: true });

const SOURCES = collectSourceFiles(SRC_ROOT, [".ts", ".svelte"])
  .filter((f) => !/\.(test|spec)\.ts$/.test(f) && !f.includes(`${path.sep}__tests__${path.sep}`));
const rel = (f: string) => path.relative(SRC_ROOT, f).split(path.sep).join("/");

describe("R0.31 — no global app, no global view", () => {
  test("no source reads the global app object", () => {
    const offenders = SOURCES.filter((f) => /\(window as any\)\.app\b|\bwindow\.app\b/.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(offenders).toEqual([]);
  });

  test("no module keeps a reference to a Projects view", () => {
    const store = fs.readFileSync(path.join(SRC_ROOT, "lib", "stores", "obsidian.ts"), "utf8");
    expect(store).not.toMatch(/export const view\b/);
    const readers = SOURCES.filter((f) => /import\s*\{[^}]*\bview\b[^}]*\}\s*from\s*["']src\/lib\/stores\/obsidian["']/.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(readers).toEqual([]);
  });
});

describe("markdownOwner — rendered Markdown lives as long as its component", () => {
  test("the owner is loaded while the component lives and unloaded when it is destroyed", () => {
    const Probe = require("./support/MarkdownOwnerProbe.svelte").default;
    let owner: { loaded: boolean } | undefined;
    const target = document.createElement("div");
    const component = new Probe({ target, props: { onOwner: (o: { loaded: boolean }) => (owner = o) } });
    expect(owner?.loaded).toBe(true);
    component.$destroy();
    expect(owner?.loaded).toBe(false);
  });
});

describe("watchViewport — listeners belong to the plugin's lifetime", () => {
  test("importing the ui stores adds no window listener; watchViewport adds and removes them", () => {
    const added: string[] = [];
    const removed: string[] = [];
    const addSpy = jest.spyOn(window, "addEventListener").mockImplementation((type: string) => { added.push(type); });
    const removeSpy = jest.spyOn(window, "removeEventListener").mockImplementation((type: string) => { removed.push(type); });
    const mql = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const mqSpy = jest.spyOn(window, "matchMedia").mockImplementation(() => mql as unknown as MediaQueryList);
    jest.isolateModules(() => {
      const ui = require("src/lib/stores/ui");
      expect(added).toEqual([]);
      expect(mql.addEventListener).not.toHaveBeenCalled();
      const stop = ui.watchViewport() as () => void;
      expect(added).toContain("resize");
      expect(mql.addEventListener).toHaveBeenCalled();
      stop();
      expect(removed).toContain("resize");
      expect(mql.removeEventListener.mock.calls.length).toBe(mql.addEventListener.mock.calls.length);
    });
    addSpy.mockRestore();
    removeSpy.mockRestore();
    mqSpy.mockRestore();
  });
});

/**
 * R2.4 — Tests for `createInverseIndexStore`.
 *
 * The store integrates with Obsidian's metadata cache via event
 * subscription. We mock the relevant subset of `App` to validate:
 *   - Initial rebuild is scheduled on creation.
 *   - `rebuild()` produces an index matching the vault state.
 *   - `destroy()` un-subscribes from all three events.
 */

import { get } from "svelte/store";
import type { App, TFile } from "obsidian";
import { createInverseIndexStore } from "../inverseIndexStore";

interface FakeListener {
  event: string;
  cb: (...args: unknown[]) => void;
  ref: object;
}

function makeApp(
  files: { path: string; frontmatter: Record<string, unknown> | null }[],
): { app: App; listeners: FakeListener[] } {
  const listeners: FakeListener[] = [];
  const fileCache = new Map(
    files.map((f) => [
      f.path,
      f.frontmatter ? { frontmatter: f.frontmatter } : null,
    ]),
  );
  const tFiles = files.map((f) => ({ path: f.path } as unknown as TFile));

  const app = {
    vault: {
      getMarkdownFiles: () => tFiles,
    },
    metadataCache: {
      getFileCache: (file: TFile) => fileCache.get(file.path) ?? null,
      getFirstLinkpathDest: () => null,
      on(event: string, cb: (...args: unknown[]) => void) {
        const ref = {};
        listeners.push({ event, cb, ref });
        return ref;
      },
      offref(ref: object) {
        const idx = listeners.findIndex((l) => l.ref === ref);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    },
  } as unknown as App;

  return { app, listeners };
}

describe("createInverseIndexStore", () => {
  it("rebuilds synchronously on rebuild()", () => {
    const { app } = makeApp([
      { path: "A.md", frontmatter: { links: ["[[Target]]"] } },
      { path: "B.md", frontmatter: null },
    ]);
    const store = createInverseIndexStore(app);
    store.rebuild();
    const idx = get(store);
    expect(idx.get("Target")).toEqual([
      { sourcePath: "A.md", viaKey: "links" },
    ]);
    store.destroy();
  });

  it("subscribes to resolved / changed / deleted events", () => {
    const { app, listeners } = makeApp([]);
    const store = createInverseIndexStore(app);
    const events = listeners.map((l) => l.event).sort();
    expect(events).toEqual(["changed", "deleted", "resolved"]);
    store.destroy();
    expect(listeners).toHaveLength(0);
  });

  it("rebuilds when the resolved event fires", () => {
    let frontmatter: Record<string, unknown> | null = null;
    const dynamicFiles = [{ path: "A.md", get frontmatter() { return frontmatter; } }];
    const listeners: FakeListener[] = [];
    const app = {
      vault: { getMarkdownFiles: () => dynamicFiles.map((f) => ({ path: f.path } as unknown as TFile)) },
      metadataCache: {
        getFileCache: (file: TFile) => {
          if (file.path === "A.md" && frontmatter) return { frontmatter };
          return null;
        },
        getFirstLinkpathDest: () => null,
        on(event: string, cb: (...args: unknown[]) => void) {
          const ref = {};
          listeners.push({ event, cb, ref });
          return ref;
        },
        offref() {},
      },
    } as unknown as App;

    const store = createInverseIndexStore(app);
    expect(get(store).size).toBe(0);

    frontmatter = { links: ["[[New]]"] };
    const resolved = listeners.find((l) => l.event === "resolved");
    resolved?.cb();
    expect(get(store).get("New")).toBeDefined();
    store.destroy();
  });

  it("respects the keys option", () => {
    const { app } = makeApp([
      { path: "A.md", frontmatter: { parent: "[[Root]]", links: ["[[Other]]"] } },
    ]);
    const store = createInverseIndexStore(app, { keys: ["parent"] });
    store.rebuild();
    const idx = get(store);
    expect(idx.get("Root")).toBeDefined();
    expect(idx.has("Other")).toBe(false);
    store.destroy();
  });
});

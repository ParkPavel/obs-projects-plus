/**
 * R2.4 — Live inverse-relation index store
 *
 * Wraps the pure `buildInverseIndex` helper in a Svelte store that
 * tracks Obsidian's metadata cache. Consumers (Visualizer pane,
 * Database widgets) subscribe; the store rebuilds lazily after
 * `metadataCache.resolved` and on `changed`.
 *
 * Rebuild strategy:
 *  - Coalesce rapid `changed` events with `requestAnimationFrame` /
 *    fallback `setTimeout`. We never block the event loop with a full
 *    rebuild on every keystroke.
 *  - The index is recomputed from scratch each time. This is O(N · K)
 *    in vault size × keys; for vaults under ~100k notes this is well
 *    below 100ms in practice. Incremental update is a R4 perf concern.
 */

import { writable, type Readable } from "svelte/store";
import type { App, TFile } from "obsidian";
import {
  buildInverseIndex,
  type BuildInverseIndexInput,
  type InverseIndex,
} from "./inverseIndex";

export interface InverseIndexStoreOptions {
  /** Frontmatter keys to scan. Defaults to `["links"]`. */
  keys?: readonly string[];
}

export interface InverseIndexStore extends Readable<InverseIndex> {
  /** Force a synchronous rebuild — useful for tests. */
  rebuild(): void;
  /** Detach all event handlers. */
  destroy(): void;
}

const EMPTY: InverseIndex = new Map();

/**
 * Create an inverse-index store wired to the given Obsidian app.
 *
 * `options.keys` defaults to `["links"]` to mirror the R1.3 manual
 * relations editor. Plugins or future R-phases that introduce extra
 * relation keys (e.g. `parent`, `related`) should pass them in.
 */
export function createInverseIndexStore(
  app: App,
  options: InverseIndexStoreOptions = {},
): InverseIndexStore {
  const keys = options.keys ?? ["links"];
  const inner = writable<InverseIndex>(EMPTY);

  let pending = false;
  let scheduled: number | null = null;

  function gatherInputs(): BuildInverseIndexInput[] {
    const files = app.vault.getMarkdownFiles();
    const out: BuildInverseIndexInput[] = [];
    for (const file of files) {
      const cache = app.metadataCache.getFileCache(file);
      out.push({
        path: file.path,
        frontmatter: (cache?.frontmatter as Record<string, unknown> | null) ?? null,
      });
    }
    return out;
  }

  function rebuildNow(): void {
    pending = false;
    scheduled = null;
    const resolveLinkPath = (linktext: string, sourcePath: string): string | null => {
      const dest = app.metadataCache.getFirstLinkpathDest?.(linktext, sourcePath);
      return dest ? dest.path : null;
    };
    const idx = buildInverseIndex(gatherInputs(), { keys, resolveLinkPath });
    inner.set(idx);
  }

  function schedule(): void {
    if (pending) return;
    pending = true;
    if (typeof requestAnimationFrame === "function") {
      scheduled = requestAnimationFrame(rebuildNow);
    } else {
      scheduled = setTimeout(rebuildNow, 16) as unknown as number;
    }
  }

  // Initial population — wait for `resolved` so we don't capture a
  // half-loaded vault on plugin startup.
  const resolvedRef = app.metadataCache.on("resolved", () => {
    rebuildNow();
  });
  const changedRef = app.metadataCache.on("changed", (_file: TFile) => {
    schedule();
  });
  const deletedRef = app.metadataCache.on("deleted", () => {
    schedule();
  });

  // Best-effort kick-off in case `resolved` already fired before subscription.
  schedule();

  return {
    subscribe: inner.subscribe,
    rebuild: rebuildNow,
    destroy(): void {
      app.metadataCache.offref(resolvedRef);
      app.metadataCache.offref(changedRef);
      app.metadataCache.offref(deletedRef);
      if (scheduled !== null) {
        if (typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(scheduled);
        } else {
          clearTimeout(scheduled);
        }
      }
    },
  };
}

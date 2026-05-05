/**
 * FrontmatterReader runtime implementation (REFACTOR-202).
 *
 * Reads from Obsidian's `metadataCache` (synchronous source of truth
 * for parsed YAML) and exposes a debounced observer for change events.
 *
 * Contract: see `./contracts.ts::FrontmatterReader`.
 *
 * @since 4.0 (REFACTOR-202)
 */

import type { App, EventRef, TFile, CachedMetadata } from "obsidian";
import type { Disposer, FrontmatterReader } from "./contracts";
import { decodeValue } from "./codec";

const DEBOUNCE_MS = 30;

interface MetadataCacheLike {
  getFileCache?: (file: TFile) => CachedMetadata | null;
  on?: (
    event: "changed",
    cb: (file: TFile, data: string, cache: CachedMetadata) => void,
  ) => EventRef;
  offref?: (ref: EventRef) => void;
}

export function createFrontmatterReader(app: App): FrontmatterReader {
  return {
    read: async (file) => readSync(app, file),
    observe: (file, cb) => observeChanges(app, file, cb),
  };
}

function readSync(app: App, file: TFile): Record<string, unknown> {
  const cache = (app.metadataCache as unknown as MetadataCacheLike).getFileCache?.(file);
  const fm = cache?.frontmatter;
  if (!fm || typeof fm !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(fm)) {
    if (key === "position") continue; // Obsidian-internal marker
    out[key] = decodeValue(raw);
  }
  return out;
}

function observeChanges(
  app: App,
  file: TFile,
  cb: (fm: Record<string, unknown>) => void,
): Disposer {
  const cache = app.metadataCache as unknown as MetadataCacheLike;
  if (typeof cache.on !== "function") return () => undefined;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const ref = cache.on("changed", (changedFile) => {
    if (changedFile.path !== file.path) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        cb(readSync(app, file));
      } catch {
        // Swallow callback errors so a single misbehaving subscriber
        // can't blow up the cache event loop.
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    cache.offref?.(ref);
  };
}

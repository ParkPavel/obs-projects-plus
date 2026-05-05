/**
 * R1.2 — Persistence helper for the per-note overlay.
 *
 * Writes go through `app.fileManager.processFrontMatter`, which takes a
 * write-lock and serialises through Obsidian's own YAML pipeline — this
 * is the only sanctioned API to mutate frontmatter without losing
 * comments or breaking quoting (see API 1.5+ contract).
 *
 * Failure modes:
 *  - If `processFrontMatter` is unavailable on the host (very old
 *    Obsidian), the call is a no-op and we resolve `false`.
 *  - All exceptions thrown by user-provided mutators are surfaced.
 */

import type { App, TFile } from "obsidian";
import {
  OVERLAY_KEY,
  compactOverlay,
  type NoteOverlay,
} from "./overlay";

type ProcessFn = (
  file: TFile,
  fn: (frontmatter: Record<string, unknown>) => void,
) => Promise<void>;

function getProcessFrontMatter(app: App): ProcessFn | null {
  const fm = (app.fileManager as unknown as {
    processFrontMatter?: ProcessFn;
  }).processFrontMatter;
  return typeof fm === "function" ? fm.bind(app.fileManager) : null;
}

/**
 * Persist `overlay` into the given file's frontmatter. When the overlay
 * is fully empty, the `pp_overlay` key is removed entirely so we never
 * leave noise behind.
 *
 * Returns `true` on success, `false` when the host doesn't support
 * frontmatter editing.
 */
export async function writeOverlay(
  app: App,
  file: TFile,
  overlay: NoteOverlay,
): Promise<boolean> {
  const processFn = getProcessFrontMatter(app);
  if (!processFn) return false;

  const compact = compactOverlay(overlay);

  await processFn(file, (frontmatter) => {
    if (compact === null) {
      delete frontmatter[OVERLAY_KEY];
      return;
    }
    frontmatter[OVERLAY_KEY] = compact;
  });

  return true;
}

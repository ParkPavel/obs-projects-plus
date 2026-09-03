/**
 * The record-open contract (#168 step (a), ADR_RECORD_OPEN_CONTRACT_2026-09-02 §1).
 *
 * Every place that opens a *record of the current view* routes through
 * `openRecord`. Wikilink navigation to an arbitrary note does not — those sites
 * carry a real `sourcePath` and a target that may not be a record at all, and
 * they stay on `workspace.openLinkText` by declaration in
 * `src/__tests__/R0_17_recordOpenContract.test.ts`.
 *
 * Step (a) changes no behaviour. Its whole purpose is that step (b) — plain
 * click stops leaving the view — becomes a change to `PLAIN_MODE` in this file
 * instead of twenty-four independent flips scattered across five views.
 *
 * ## The modifier convention is reproduced, not redesigned
 *
 * All three shipped implementations were read on 2026-09-03 and they AGREE:
 *
 *   - `EditNote.svelte:458`          `shiftKey ? 'window' : (ctrlKey||metaKey) ? 'tab' : false`
 *   - `AllDayEventStrip.svelte:68`   same expression
 *   - `MultiDayEventStrip.svelte:47` same expression
 *
 * `modeFromEvent` is that expression with `false` replaced by `PLAIN_MODE`.
 */

import type { App, PaneType } from "obsidian";

export type RecordOpenMode = "peek" | "same" | "tab" | "window";

/**
 * What a plain, unmodified activation means.
 *
 * **This is the one constant step (b) flips** (to `"peek"`). It is `"same"` in
 * step (a) because that is exactly what all twenty-four migrated sites did
 * before the migration, which is what makes step (a) a pure refactor and the
 * flip revertible without re-touching a single call site.
 */
export const PLAIN_MODE: RecordOpenMode = "same";

/**
 * The `false | true | "tab" | "window"` third argument of `openLinkText`, as it
 * still arrives from `EditNote`'s `onOpenNote` callback and from the older
 * boolean-form call sites.
 */
export type LegacyNewLeaf = boolean | "tab" | "window";

/** `shift` → window; `ctrl`/`meta` → tab; plain → `PLAIN_MODE`. */
export function modeFromEvent(e: MouseEvent | KeyboardEvent): RecordOpenMode {
  if (e.shiftKey) return "window";
  if (e.ctrlKey || e.metaKey) return "tab";
  return PLAIN_MODE;
}

/**
 * The bridge for a call site that is handed Obsidian's own `newLeaf` argument
 * rather than the originating event — `EditNote`'s `onOpenNote(openMode)` is
 * the only shape of this left after step (a).
 *
 * `true` maps to `"tab"` because that is what Obsidian's boolean form has meant
 * since panes were named: `openLinkText(…, true)` opens a tab. The mapping is
 * an equivalence, not a behaviour change, and it is the ONE place in this
 * migration where the new call is not textually identical to the old one.
 */
export function modeFromNewLeaf(newLeaf: LegacyNewLeaf): RecordOpenMode {
  if (newLeaf === "window") return "window";
  if (newLeaf === "tab" || newLeaf === true) return "tab";
  return PLAIN_MODE;
}

export interface OpenRecordTarget {
  /** `record.id` — a vault path, which is what every migrated site passes. */
  readonly id: string;
  /** Defaults to `id`, matching the call sites that passed it twice. */
  readonly sourcePath?: string;
}

export interface OpenRecordDeps {
  readonly app: App;
  /**
   * Supplied by the hosting view in step (b). Absent → `"peek"` falls back to
   * `"same"`, so the contract is safe to call before any view mounts a peek.
   */
  readonly peek?: (target: OpenRecordTarget) => void;
}

export function openRecord(
  target: OpenRecordTarget,
  mode: RecordOpenMode,
  deps: OpenRecordDeps,
): Promise<void> {
  const sourcePath = target.sourcePath ?? target.id;

  if (mode === "peek") {
    if (deps.peek) {
      deps.peek(target);
      return Promise.resolve();
    }
    return deps.app.workspace.openLinkText(target.id, sourcePath, false);
  }

  const newLeaf: PaneType | false = mode === "same" ? false : mode;
  return deps.app.workspace.openLinkText(target.id, sourcePath, newLeaf);
}

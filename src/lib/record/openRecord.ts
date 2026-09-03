/**
 * The record-open contract (#168 step (a), ADR_RECORD_OPEN_CONTRACT_2026-09-02 §1).
 *
 * Every place that opens a *record of the current view* routes through
 * `openRecord`. Wikilink navigation to an arbitrary note does not — those sites
 * carry a real `sourcePath` and a target that may not be a record at all, and
 * they stay on `workspace.openLinkText` by declaration in
 * `src/__tests__/R0_17_recordOpenContract.test.ts`.
 *
 * Step (a) changed no behaviour. Its whole purpose was that step (b) — a plain
 * click stops leaving the view — became a change to `PLAIN_MODE` in this file
 * instead of twenty-three independent flips across five surfaces. Step (b)
 * landed on 2026-09-03 and was exactly that one line.
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

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

import { openPeek } from "src/lib/stores/recordPeek";

export type RecordOpenMode = "peek" | "same" | "tab" | "window";

/**
 * What a plain, unmodified activation means.
 *
 * **Step (b) flipped this, on 2026-09-03, and it was the whole change.** It was
 * `"same"` through step (a) — exactly what every migrated site did before the
 * migration — which is what made that step a pure refactor. Reverting the
 * behaviour is this line and nothing else; that was the point of doing the
 * migration first.
 *
 * `shift` and `ctrl`/`meta` are untouched, so leaving the view is still one
 * modifier away and nothing became unreachable.
 */
export const PLAIN_MODE: RecordOpenMode = "peek";

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
  /**
   * The record and its fields, when the caller has them. Only the peek uses
   * these, and only because the host view cannot resolve a record that came
   * from an external source — see `stores/recordPeek.ts`.
   */
  readonly record?: DataRecord;
  readonly fields?: DataField[];
}

export interface OpenRecordDeps {
  readonly app: App;
  /**
   * A surface that owns its own panel passes one. Everything else gets the
   * `recordPeek` store, which `View.svelte` renders — so a call site does not
   * need a reference to a component it has never heard of.
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
    // An explicit `peek` wins — a surface that owns its own panel says so. The
    // store is the default, so a call site does not have to be handed a
    // function by a component it has never heard of in order to stop
    // navigating away. Falling through to the workspace is the last resort and
    // is what made step (a) safe to land before any peek existed: with nothing
    // to peek into, "peek" simply means what "same" always meant.
    const peek = deps.peek ?? openPeek;
    peek(target);
    return Promise.resolve();
  }

  const newLeaf: PaneType | false = mode === "same" ? false : mode;
  return deps.app.workspace.openLinkText(target.id, sourcePath, newLeaf);
}

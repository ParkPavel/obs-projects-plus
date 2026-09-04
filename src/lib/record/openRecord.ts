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
 * landed on 2026-09-03 and was exactly that one line; #189 reverted it on
 * 2026-09-04 and that was one line too. The migration paid for itself twice.
 *
 * ## The modifier convention is reproduced, not redesigned
 *
 * All three shipped implementations were read on 2026-09-03 and they AGREE:
 *
 *   - `EditNote.svelte:458`          `shiftKey ? 'window' : (ctrlKey||metaKey) ? 'tab' : false`
 *   - `AllDayEventStrip.svelte:68`   same expression
 *   - `MultiDayEventStrip.svelte:47` same expression
 *
 * `modeFromEvent` is that expression with `false` replaced by `PLAIN_MODE`,
 * plus the `alt` branch #189 added below it.
 */

import type { App, PaneType } from "obsidian";

import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";

import { openPeek } from "src/lib/stores/recordPeek";

export type RecordOpenMode = "peek" | "same" | "tab" | "window";

/**
 * What a plain, unmodified activation means.
 *
 * **`"same"` again, per #189 (user decision 2026-09-04).** Step (b) set this to
 * `"peek"` on 2026-09-03, and the user rejected it in the visual run: opening a
 * record means opening the NOTE, and reading its frontmatter is a different act
 * that must not take the default. Reverting was this line and nothing else,
 * which is exactly what doing the migration first bought.
 *
 * The peek did not go away — it lost the default. It is reachable two ways, and
 * both are deliberate: `alt` in `modeFromEvent` below (fast, for someone who
 * already knows) and a labelled row-menu entry (discoverable, for someone who
 * does not). The user asked for the modifier "but as its own entry", and one
 * without the other is either a hidden feature or a slow one.
 *
 * There is no setting. A third way to configure a two-way choice is a menu that
 * asks the user to do the deciding twice.
 *
 * ## Scope: the dashboard table, and that is the decision
 *
 * Both entrances exist on the dashboard's data table only. Gallery, Board,
 * Calendar and the note editor open the note and offer no peek: they do not
 * forward the raw event, so `alt` does nothing there, and they have no row menu
 * to carry the entry.
 *
 * The adversarial review of 2026-09-04 was right that naming this asymmetry is
 * not the same as deciding it, and the user decided on 2026-09-05: **the peek
 * is a capability of the dashboard table, not a property of opening a record.**
 * So `PLAIN_MODE` above is the contract for every surface — a click opens the
 * note, everywhere — while `"peek"` is a mode those surfaces simply never ask
 * for. Spreading it is a separate ticket with its own architect pass, because
 * each surface has a different activation model.
 */
export const PLAIN_MODE: RecordOpenMode = "same";

/**
 * The `false | true | "tab" | "window"` third argument of `openLinkText`, as it
 * still arrives from `EditNote`'s `onOpenNote` callback and from the older
 * boolean-form call sites.
 */
export type LegacyNewLeaf = boolean | "tab" | "window";

/**
 * `shift` → window; `ctrl`/`meta` → tab; `alt` → peek; plain → `PLAIN_MODE`.
 *
 * ## Why `alt`, and why it is tested last of the three
 *
 * `shift` and `ctrl`/`meta` are spoken for by three shipped surfaces that
 * already agree (see the file header), so the peek needed a modifier that is
 * free in this codebase AND free in the host. `alt` is the only single modifier
 * that is both:
 *
 *   - `ctrl+shift` is not free — Obsidian itself opens a link in a split with
 *     it, so taking it would fight the host on the host's own gesture.
 *   - `alt` has exactly two uses in `src/`, and neither is a click:
 *     `InfiniteHorizontalCalendar.svelte:617` and `TimelineView.svelte:316`
 *     both read `altKey` off a `WheelEvent` to page between periods.
 *
 * It also reads correctly: in host UI convention `alt` means "the other thing
 * this row can do", which is what looking at a record's fields instead of
 * opening it is.
 *
 * The `alt` test comes AFTER the other two on purpose. Testing it first would
 * be tidier but wrong on Windows and on European layouts, where `AltGr` reports
 * `ctrlKey` and `altKey` together — that combination must keep meaning `tab`,
 * the answer `ctrl` has always given, rather than silently becoming a peek.
 */
export function modeFromEvent(e: MouseEvent | KeyboardEvent): RecordOpenMode {
  if (e.shiftKey) return "window";
  if (e.ctrlKey || e.metaKey) return "tab";
  if (e.altKey) return "peek";
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

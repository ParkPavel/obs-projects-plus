/**
 * #200 — memory against disk, when somebody else wrote `data.json`.
 *
 * The plugin writes this file WHOLE from its own state. Until now it never
 * learned that the file had changed underneath it, so the next ordinary save
 * overwrote whatever a second window, a synchroniser or a hand edit had put
 * there. Step 0 of the plan observed exactly that in a live vault: an external
 * rename was gone after the plugin's next write.
 *
 * `Plugin#onExternalSettingsChange` (Obsidian v1.5.7, and this plugin's
 * `minAppVersion` is v1.5.7) says WHEN the file changed. This module says WHAT
 * TO DO about it, and it is deliberately the only place that decides.
 *
 * ## Why the decision is a pure function
 *
 * `main.ts` has no test coverage in this tree at all: `jest.config.js` runs in
 * jsdom and `src/__mocks__/obsidian.ts` does not export `Plugin`. A decision
 * table living in the hook would therefore be believed rather than proven — the
 * same shape of claim #199 cost a day to. So the branch is decided here, on
 * synthetic input, and the hook is left with nothing but the wiring.
 *
 * ## Why disk is adopted whole or not at all
 *
 * A three-way merge is formally available — every project and view carries a
 * UUID, and `confirmedOnDisk` is a base — and it is still refused, because the
 * merge would be wrong per field rather than per tree:
 *
 *   - `uniqueIdCounter` is monotonic and feeds `UniqueId` values written into
 *     NOTES. "Take the side that changed" can move it backwards, and the
 *     plugin then hands out identifiers that already exist on disk. The only
 *     correct operation for it is `max`, which is the proof of the point.
 *   - `preferences.commands` is derived from `projects`; taking projects from
 *     one side and commands from the other breaks an invariant between fields.
 *   - `isDefault` is an invariant across the array, not a property of an item:
 *     merging two lists by id yields two default projects.
 *   - `ViewDefinition.config` is `Record<string, any>` — the widget layout is
 *     inside it. Merging at view level means a widget added here and a widget
 *     added there cannot both survive.
 *
 * So: adopt the disk entirely, or keep memory entirely. The losing side is
 * never destroyed — the caller copies it to a sibling file — which is what
 * makes both branches safe rather than one of them cheap.
 *
 * ## The asymmetry that has to be explicit
 *
 * At load, an unreadable file yields defaults. Mid-session it must NOT: putting
 * defaults over live working state because a synchroniser was caught mid-write
 * is data loss that the mechanism itself would create. Hence `keep`.
 *
 * The user-facing code for a conflict is attached by the caller, not named
 * here: while nothing can display it, the registry marks it `pending`, and a
 * literal in this file would make that marker untrue (R0.21 checks it). This
 * module also imports no i18n, for the reason its neighbours do not —
 * `settingsWriter.ts` is unit-tested in isolation and naming a code must not
 * drag four locale files into that run.
 */

import { canonical } from "src/lib/settings/settingsVerify";

/**
 * What the writer holds that the disk does not.
 *
 * `idle` alone is not "clean": `push` schedules a write and leaves the status
 * at `idle` until the write starts, so the writer answers this question with
 * `hasPending()` rather than the caller inferring it from a status.
 */
export interface ReconcileInput<T> {
  /** The text `data.json` now holds. */
  readonly diskRaw: string;
  /** The settings this session is working with. */
  readonly memory: T;
  /**
   * The canonical form last CONFIRMED on disk, or `null` when that is unknown
   * — a first write, or a write that already diverged. Unknown is treated as a
   * conflict: without a base there is no way to tell an adoption from a loss.
   */
  readonly base: string | null;
  /** `true` when memory holds anything the disk has not confirmed. */
  readonly pending: boolean;
  /** The settings version this build understands. */
  readonly expectedVersion: number;
}

export type ReconcileDecision<T> =
  /**
   * Nothing to do. `echo` — the file is what we last confirmed (the step-0
   * spike showed our own `saveData` does not fire the hook, so this is a
   * safety net rather than a load-bearing part). `same` — the file differs
   * from the base but says exactly what memory already says, so adopting it
   * would redraw every view for no change.
   */
  | { readonly kind: "ignore"; readonly reason: "echo" | "same" }
  /**
   * Take the disk whole. The caller primes the writer BEFORE it sets the store.
   *
   * `carried` is true when the one exception below actually moved a counter,
   * so the caller can write the corrected value back instead of leaving the
   * higher counter alive only in memory.
   */
  | { readonly kind: "adopt"; readonly settings: T; readonly carried: boolean }
  /**
   * Memory wins and the disk copy is preserved beside the file. `pending` —
   * we hold unsaved work; `unknown-base` — nothing to compare against;
   * `unknown-version` — the file is a settings version this build cannot
   * adopt without migrating, and migrating mid-session is not in scope.
   */
  | {
      readonly kind: "conflict";
      readonly reason: "pending" | "unknown-base" | "unknown-version";
    }
  /**
   * Keep memory and say nothing to the user. A half-written file is what a
   * synchroniser looks like from here, and the completed write fires the hook
   * again a moment later; a notice on the first half would be a false alarm.
   *
   * The two reasons part company at the caller. `unparsable` bytes are somebody
   * else's version, mangled — worth preserving if they are still there after
   * the delay. `empty` bytes are nobody's: a writer that is not atomic
   * truncates the file before filling it, and a copy of that instant is a
   * 0-byte file the notice would then send the user to read (#210).
   */
  | { readonly kind: "keep"; readonly reason: "unparsable" | "empty" };

/**
 * The one field that is merged rather than replaced — by the user's explicit
 * decision, 2026-09-07, recorded here because it contradicts the rule above in
 * the letter.
 *
 * `uniqueIdCounter` is monotonic and feeds `UniqueId` values that are written
 * into NOTES. Taking a lower counter from the disk makes the plugin hand out
 * identifiers that already exist in the vault — corruption outside the settings
 * file, and unlike a settings conflict there is no copy to recover from,
 * because the duplicates are spread across notes.
 *
 * `max` is the only correct operation for a counter, which is exactly why this
 * exception does not open the door to merging anything else: every other field
 * named in this module's header has NO correct per-field operation.
 */
interface CounterCarrier {
  readonly id?: unknown;
  readonly uniqueIdCounter?: unknown;
}

interface CounterHolder {
  readonly projects?: unknown;
  readonly archives?: unknown;
}

function counterOf(item: unknown): number | null {
  if (typeof item !== "object" || item === null) return null;
  const value = (item as CounterCarrier).uniqueIdCounter;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function idOf(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const value = (item as CounterCarrier).id;
  return typeof value === "string" ? value : null;
}

/** Highest counter memory holds for each project id, across both lists. */
function countersInMemory(memory: unknown): Map<string, number> {
  const highest = new Map<string, number>();
  if (typeof memory !== "object" || memory === null) return highest;
  for (const key of ["projects", "archives"] as const) {
    const list = (memory as CounterHolder)[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = idOf(item);
      const counter = counterOf(item);
      if (id === null || counter === null) continue;
      highest.set(id, Math.max(highest.get(id) ?? counter, counter));
    }
  }
  return highest;
}

/**
 * The adopted payload with every counter raised to the higher of the two
 * sides. Returns the input untouched — same reference — when nothing moved, so
 * the caller can tell a plain adoption from one that owes the disk a write.
 */
export function carryUniqueIdCounters<T>(
  memory: unknown,
  adopted: T
): { readonly settings: T; readonly carried: boolean } {
  const highest = countersInMemory(memory);
  if (highest.size === 0) return { settings: adopted, carried: false };
  if (typeof adopted !== "object" || adopted === null) {
    return { settings: adopted, carried: false };
  }

  let carried = false;
  const next: Record<string, unknown> = {
    ...(adopted as unknown as Record<string, unknown>),
  };
  for (const key of ["projects", "archives"] as const) {
    const list = (adopted as CounterHolder)[key];
    if (!Array.isArray(list)) continue;
    next[key] = list.map((item) => {
      const id = idOf(item);
      if (id === null) return item;
      const mine = highest.get(id);
      if (mine === undefined) return item;
      const theirs = counterOf(item) ?? 0;
      if (mine <= theirs) return item;
      carried = true;
      return { ...(item as object), uniqueIdCounter: mine };
    });
  }

  return carried
    ? { settings: next as unknown as T, carried: true }
    : { settings: adopted, carried: false };
}

/**
 * Does this text hold ANY version at all?
 *
 * Found by the acceptance re-run (#210): a writer that is not atomic truncates
 * `data.json` before filling it, so for an instant the file is zero bytes — and
 * the plugin can read exactly that instant. Treating those bytes as "the other
 * version" produced a 0-byte conflict copy and a notice sending the user to a
 * file with nothing in it: the broken promise #195 exists to prevent, arriving
 * from the other end.
 *
 * The rule is length, not parsing, and deliberately so — an empty file two
 * seconds later is still a torn write rather than somebody's settings. Nobody
 * means to store nothing.
 */
export function carriesAVersion(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Is `value` a settings payload this build can adopt as it stands?
 *
 * The version alone is not enough, and the adversarial review of this change
 * is what made that concrete: `{ "version": 4 }` passes a version check, and
 * the resolver would then fill it in with an EMPTY project list — so a stub
 * left on disk by a synchroniser would read as a legitimate adoption and empty
 * the user's configuration. The project list is therefore part of the shape
 * this function requires, not part of what the resolver may invent.
 *
 * An empty array is still legal: a vault whose projects have all been deleted
 * is a real state, and it differs from a payload that never had the field.
 */
function adoptableShape(value: unknown, expected: number): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as { version?: unknown; projects?: unknown };
  return record.version === expected && Array.isArray(record.projects);
}

/**
 * Decide what to do with the file that just changed.
 *
 * Order matters and is the table from the plan, read top to bottom: the two
 * no-ops first (they are cheap and they are the common case), then the
 * refusals, then adoption as the remainder. Adoption is last on purpose —
 * every reason not to take the disk is stated before the branch that takes it.
 */
export function reconcileSettings<T>(
  input: ReconcileInput<T>
): ReconcileDecision<T> {
  if (!carriesAVersion(input.diskRaw)) {
    return { kind: "keep", reason: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.diskRaw);
  } catch {
    return { kind: "keep", reason: "unparsable" };
  }

  const onDisk = canonical(parsed);
  if (onDisk !== null && input.base !== null && onDisk === input.base) {
    return { kind: "ignore", reason: "echo" };
  }
  if (onDisk !== null && onDisk === canonical(input.memory)) {
    return { kind: "ignore", reason: "same" };
  }

  if (!adoptableShape(parsed, input.expectedVersion)) {
    return { kind: "conflict", reason: "unknown-version" };
  }
  if (input.pending) {
    return { kind: "conflict", reason: "pending" };
  }
  if (input.base === null) {
    return { kind: "conflict", reason: "unknown-base" };
  }

  const { settings, carried } = carryUniqueIdCounters(
    input.memory,
    parsed as T
  );
  return { kind: "adopt", settings, carried };
}

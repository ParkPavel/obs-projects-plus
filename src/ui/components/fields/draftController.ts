/**
 * draftController — the one text-entry lifecycle (stab-forms, rollout step 1).
 *
 * Every text control in the plugin is the same loop: read the stored value,
 * let the user edit a private draft, validate it, commit it once, and show what
 * the parent persisted. It had been rewritten by hand in each control, and each
 * copy got a different part wrong (a draft pulled from under the user by a
 * re-render, an Enter that accepted an IME candidate, a pick that committed
 * twice, no way back with Escape). The state and its transitions live here as
 * plain data and functions, so a component only wires DOM events to them and
 * the rules are testable without a DOM.
 *
 * ## The model
 *
 * - `baseline` is what the field showed when the interaction began, or the last
 *   committed text; Escape restores it.
 * - `draft` is the text in the control.
 * - `committed` is the last text handed to the consumer.
 * - `focused` is whether the user is in the field. While true, a changed prop is
 *   held back (`refresh`) instead of replacing the draft.
 * - `composing` is an IME composition in progress.
 *
 * ## Commit once
 *
 * An interaction starts at `focus` and re-arms at every `input`. A commit is
 * handed out once per arming, whichever of Enter, selection or blur comes
 * first, so "pick then blur" and "Enter then blur" write once. Enter and
 * selection are explicit and always commit; blur and Tab commit only an edit,
 * unless the consumer says an unchanged blur must still be reported (a cell
 * editor that must leave edit mode).
 *
 * ## Where it is blind
 *
 * It holds text only. Validation and persistence belong to the consumer, which
 * hands the verdict in (`accept`) and decides what a rejected commit means.
 */

/** Why a commit happened. */
export type CommitReason = "enter" | "blur" | "select" | "tab";

/** What a commit hands the consumer. */
export interface CommitResult {
  value: string;
  reason: CommitReason;
}

/** The observable state of one field. */
export interface DraftState {
  baseline: string;
  draft: string;
  committed: string;
  focused: boolean;
  composing: boolean;
}

/** The part of a keyboard event the IME guard reads. */
export interface ImeKeyLike {
  isComposing?: boolean;
  keyCode?: number;
  key?: string;
}

/** Options of one commit. */
export interface CommitOptions {
  /** Commit this text instead of the draft (a picked option). */
  value?: string;
  /** The consumer's verdict; false commits nothing. Default true. */
  accept?: boolean;
  /** Report a commit even when the text equals the committed one (blur and Tab only). */
  unchanged?: boolean;
}

/**
 * Whether a keydown belongs to an IME composition. `isComposing` is the
 * standard flag; keyCode 229 is what some hosts report for the Enter that
 * accepts a candidate, including Safari's keydown after `compositionend`.
 */
export function isImeKey(e: ImeKeyLike, now: number = Date.now()): boolean {
  if (e.isComposing === true) return true;
  if (e.keyCode !== 229) return false;
  // i2-input (D03): iOS Safari also reports keyCode 229 for the plain Return
  // key while the predictive bar is on — «завтра» + Return was dropped as IME
  // and never committed. Return counts as Return unless a composition has
  // just ended: that keydown is the IME accepting its candidate.
  return e.key !== "Enter" || now - lastCompositionEnd < IME_ACCEPT_WINDOW_MS;
}

/** How long after `compositionend` a keyCode-229 Return still belongs to the IME. */
const IME_ACCEPT_WINDOW_MS = 150;
let lastCompositionEnd = -Infinity;
if (typeof document !== "undefined") {
  document.addEventListener("compositionend", () => { lastCompositionEnd = Date.now(); }, true);
}

/** The controller returned by {@link createDraftController}. */
export interface DraftController {
  /** A copy of the current state. */
  getState(): DraftState;
  /** The user entered the field (or the popup opened): seed the draft from the current text. */
  focus(current: string): void;
  /**
   * The parent passed a value. Returns true when the draft was replaced (not
   * focused); while focused the value is held back and false is returned.
   */
  refresh(next: string): boolean;
  /** The user edited the text. */
  input(text: string): void;
  /** Re-arm the commit for a new interaction inside the same focus (a popup reopened). */
  arm(): void;
  /** An IME composition started. */
  compositionStart(): void;
  /** An IME composition ended. */
  compositionEnd(): void;
  /** Whether the key event must be ignored because of composition. */
  isComposing(e?: ImeKeyLike): boolean;
  /** Commit at most once per arming; null when there is nothing to hand out. */
  commit(reason: CommitReason, options?: CommitOptions): CommitResult | null;
  /**
   * Escape: restore the baseline, end the interaction (no commit follows until
   * the next edit or focus) and return the baseline. Null while composing,
   * because Escape then belongs to the IME and nothing may change.
   */
  cancel(): string | null;
  /**
   * The user left the field. Commits an edit (reason blur) when `accept` is
   * true; a rejected draft is restored to the baseline. A prop change held back
   * during focus is adopted when the user touched nothing.
   */
  blur(options?: CommitOptions): CommitResult | null;
  /**
   * The consumer replaces the text outright (a form cleared after its value
   * was applied). Baseline, draft and committed all become `next`; focus is
   * kept, and nothing is reported.
   */
  reset(next: string): void;
}

/** A controller for one text field, starting from `initial`. */
export function createDraftController(initial = ""): DraftController {
  let baseline = initial;
  let draft = initial;
  let committed = initial;
  let focused = false;
  let composing = false;
  // The last prop seen, so only a real change is held back or adopted.
  let seenProp = initial;
  // A prop that changed while the user was in the field.
  let pending: string | null = null;
  // Something was edited or committed during this focus.
  let touched = false;
  // A commit was handed out since the last focus or edit.
  let done = false;

  function commit(reason: CommitReason, options: CommitOptions = {}): CommitResult | null {
    if (options.accept === false || done) return null;
    const value = options.value ?? draft;
    const explicit = reason === "enter" || reason === "select";
    if (!explicit && value === committed && options.unchanged !== true) return null;
    draft = value;
    committed = value;
    baseline = value;
    done = true;
    touched = true;
    return { value, reason };
  }

  return {
    getState: () => ({ baseline, draft, committed, focused, composing }),

    focus(current) {
      focused = true;
      composing = false;
      baseline = current;
      draft = current;
      committed = current;
      pending = null;
      touched = false;
      done = false;
    },

    refresh(next) {
      if (next === seenProp) return false;
      seenProp = next;
      if (focused) {
        // Never pull the text from under the user's fingers.
        pending = next;
        return false;
      }
      baseline = next;
      draft = next;
      committed = next;
      return true;
    },

    input(text) {
      draft = text;
      touched = true;
      done = false;
    },

    arm() {
      done = false;
    },

    compositionStart() {
      composing = true;
    },

    compositionEnd() {
      composing = false;
    },

    isComposing(e) {
      return composing || (e !== undefined && isImeKey(e));
    },

    commit,

    cancel() {
      if (composing) return null;
      draft = baseline;
      // Escape ends the interaction: the blur that follows reports nothing,
      // not even an unchanged blur a cell editor asked for. An edit re-arms.
      done = true;
      return baseline;
    },

    blur(options = {}) {
      focused = false;
      composing = false;
      let result: CommitResult | null = null;
      if (options.accept === false) {
        draft = baseline;
      } else {
        result = commit("blur", options);
      }
      if (pending !== null && !touched) {
        // The parent changed the value while the field was focused and the
        // user edited nothing: show the parent's value now.
        baseline = pending;
        draft = pending;
        committed = pending;
      }
      pending = null;
      return result;
    },

    reset(next) {
      baseline = next;
      draft = next;
      committed = next;
      pending = null;
      touched = false;
      done = false;
    },
  };
}

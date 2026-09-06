/**
 * #202 — the error-code registry. Pure data, and deliberately importing nothing.
 *
 * The user asked for two things: that a message carry a short code they can
 * name, and that hovering it explain the cause. Underneath both is a third
 * thing they described as "упорядочить" — today one event is worded three
 * different ways across the notice, the standing mark and the console line, so
 * nothing can be matched to anything. Diagnosing #199 cost a day for exactly
 * that reason.
 *
 * ## Why this file has no imports at all
 *
 * Not style. `settingsWriter.ts` and the engine modules are unit-tested in
 * isolation and have no i18n dependency; naming a code must not drag the four
 * locale files and i18next into their test runs. That is the hazard
 * `headerChrome.ts` was carved out for, and its header names it precisely:
 * weight, not cycles. So resolution lives in `errorText.ts`, the console
 * formatter in `errorLog.ts`, and this file stays data.
 *
 * ## The code is a promise
 *
 * A code that has been shown to a user is public forever: it can appear in a
 * screenshot, a forum post or a bug report years later. A retired code is
 * therefore marked `status: "retired"` and keeps both its registry entry and
 * its section on the page — the same rule that keeps `DataTableConfig.subBases`
 * alive for data that was written once.
 *
 * ## Areas
 *
 * The area digit groups by what the USER was doing, not by which module threw.
 * Renaming a record fails the same way from three different files, and giving
 * that one event three numbers would recreate the problem this ticket exists
 * to remove.
 *
 *   1xx  settings and their persistence
 *   2xx  writing records
 *   3xx  acting on a record inside a view
 *   4xx  dashboard configuration
 *   5xx  relations
 *   6xx  onboarding and the demo project
 *   7xx  sources and filters
 *   9xx  unexpected — error boundaries
 */

/** What the message is: something broke, something is not ready, or a caution. */
export type ErrorKind = "failure" | "refusal" | "warning";

export interface ErrorCodeEntry {
  /** `PPP-104`. Stable forever once shown. */
  readonly code: string;
  readonly kind: ErrorKind;
  /** i18n key for the short caption shown in the notice and the mark. */
  readonly key: string;
  /** i18n key for the cause, revealed on hover. */
  readonly causeKey: string;
  /** English default for `key`, and the text the console line uses. */
  readonly caption: string;
  /** English default for `causeKey`. */
  readonly cause: string;
  /** Set when the code is no longer issued. The entry and its page section stay. */
  readonly status?: "retired";
}

/**
 * The area digits that may appear in a code, with what each one covers.
 * Pinned by R0.21 so a new area is a deliberate act rather than a typo.
 */
export const ERROR_AREAS: Readonly<Record<string, string>> = {
  "1": "settings and their persistence",
  "2": "writing records",
  "3": "acting on a record inside a view",
  "4": "dashboard configuration",
  "5": "relations",
  "6": "onboarding and the demo project",
  "7": "sources and filters",
  "9": "unexpected — error boundaries",
};

/**
 * Every code the plugin can show.
 *
 * Empty on purpose in step 1: the ratchet that binds this list to
 * `docs/ERROR_CODES.md` is proven to fail on a planted mismatch BEFORE the
 * first code is issued. A mechanism adopted alongside its first user cannot be
 * shown to work — it can only be believed.
 */
export const ERROR_CODES: readonly ErrorCodeEntry[] = [];

/** The entry for `code`, or `undefined`. Callers decide what a miss means. */
export function findErrorCode(code: string): ErrorCodeEntry | undefined {
  return ERROR_CODES.find((entry) => entry.code === code);
}

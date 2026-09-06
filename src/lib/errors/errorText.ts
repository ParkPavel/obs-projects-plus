/**
 * #202 — a code turned into the words a user reads.
 *
 * Separate from `errorCodes.ts` on purpose, and the separation is the whole
 * design. This module imports i18next and the four locale JSONs; the registry
 * imports nothing. So a module that only wants to NAME a code — the settings
 * writer, an engine module — names it without dragging 370 KB of translations
 * into its unit tests. R0.21 pins that edge for `src/lib/settings/**` and
 * `src/lib/engine/**` rather than leaving it to memory.
 *
 * The console has its own formatter in `errorLog.ts`: it stays English, so it
 * must not reach i18n either.
 */

import { get } from "svelte/store";

import { findErrorCode } from "src/lib/errors/errorCodes";
import { i18n } from "src/lib/stores/i18n";

export interface ResolvedError {
  readonly code: string;
  /** The short sentence, in the user's language. */
  readonly caption: string;
  /** Why it happened, in the user's language. Shown on hover. */
  readonly cause: string;
}

export type ErrorParams = Record<string, string | number>;

/**
 * The words for `code` in the current locale.
 *
 * An unknown code resolves to itself with no cause rather than throwing: this
 * runs on the failure path, and a thrown error here would replace a message the
 * user needed with no message at all. R0.21 checks that every `PPP-nnn` written
 * in `src/` is in the registry, so the fallback is a safety net and not a
 * working mode.
 */
export function resolveError(code: string, params?: ErrorParams): ResolvedError {
  const entry = findErrorCode(code);
  if (entry === undefined) return { code, caption: code, cause: "" };
  const store = get(i18n);
  return {
    code,
    caption: store.t(entry.key, { defaultValue: entry.caption, ...params }),
    cause: store.t(entry.causeKey, { defaultValue: entry.cause, ...params }),
  };
}

/**
 * The trailing-token form: `<text> (PPP-101)`.
 *
 * Trailing so the code never displaces the sentence. Exported separately
 * because two settings messages carry literal text that predates the registry,
 * and #202 adds the token to them rather than re-authoring them.
 */
export function withCode(text: string, code: string): string {
  return `${text} (${code})`;
}

/** What a `Notice` shows for `code`: its own sentence plus its token. */
export function noticeFor(code: string, params?: ErrorParams): string {
  return withCode(resolveError(code, params).caption, code);
}

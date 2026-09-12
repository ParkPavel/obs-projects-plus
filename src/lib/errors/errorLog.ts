/**
 * #202 — the console half of a code.
 *
 * The tree used to write five different prefixes, so a user could not search
 * their console for an event: there was no token to search for. Step 6 brought
 * them to one, with the area word kept after it where it carried meaning
 * (`[Projects+] Calendar`), and R0.23 keeps it that way.
 *
 * One prefix, one code, one English sentence — and the sentence is the same one
 * the Notice shows, because both come from the registry.
 *
 * English by design, so this imports the registry and NOT `errorText.ts`. A
 * console line that changes language with the interface cannot be pasted into
 * an issue and read by anyone else.
 */

import { findErrorCode } from "src/lib/errors/errorCodes";

/**
 * #207 — values for a caption's `{{placeholders}}`.
 *
 * Deliberately the same shape as `errorText.ts`'s, and deliberately not
 * imported from it: this module stays English and free of i18n, which is why it
 * reads the registry directly.
 */
export type LogParams = Readonly<Record<string, string | number>>;

const PREFIX = "[Projects+]";

/**
 * Two captions were written before this prefix existed and carry `Projects+:`
 * inside the sentence, where it reads correctly in a Notice. Printing both
 * would say the product name twice on one line.
 */
function sentence(code: string, params?: LogParams): string {
  const entry = findErrorCode(code);
  if (entry === undefined) return code;
  const caption = entry.caption.replace(/^Projects\+:\s*/, "");
  // #207: the registry stores captions with `{{placeholders}}`, and this module
  // printed them raw — a user quoting the console line sent `{{path}}` to an
  // issue while the Notice beside it showed the real one. `resolveError` fills
  // them, but it is i18n and this line must stay English and importless, so the
  // substitution happens here.
  //
  // A placeholder with no value becomes `<path>` rather than staying `{{path}}`:
  // the reader is told the value is unknown instead of being shown a template
  // artifact.
  return caption.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params?.[key];
    return value === undefined ? `<${key}>` : String(value);
  });
}

/** `[Projects+] PPP-101 <caption>` — what every console line looks like. */
export function errorLine(code: string, params?: LogParams): string {
  return `${PREFIX} ${code} ${sentence(code, params)}`;
}

/** The line, plus whatever a developer needs after it (an `Error`, a path). */
export function logError(code: string, ...details: unknown[]): void {
  console.error(errorLine(code), ...details);
}

/** Same line at warning level, for a `kind: "warning"` code. */
export function logWarning(code: string, ...details: unknown[]): void {
  console.warn(errorLine(code), ...details);
}

/**
 * The same two, for the codes whose caption carries placeholders.
 *
 * Separate names rather than an optional second argument: every existing caller
 * passes an `Error` or a string there, and a parameter that changes meaning
 * with its shape is the kind of cleverness that costs a defect later.
 */
export function logErrorAbout(
  code: string,
  params: LogParams,
  ...details: unknown[]
): void {
  console.error(errorLine(code, params), ...details);
}

export function logWarningAbout(
  code: string,
  params: LogParams,
  ...details: unknown[]
): void {
  console.warn(errorLine(code, params), ...details);
}

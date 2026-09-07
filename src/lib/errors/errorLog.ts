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

const PREFIX = "[Projects+]";

/**
 * Two captions were written before this prefix existed and carry `Projects+:`
 * inside the sentence, where it reads correctly in a Notice. Printing both
 * would say the product name twice on one line.
 */
function sentence(code: string): string {
  const entry = findErrorCode(code);
  if (entry === undefined) return code;
  return entry.caption.replace(/^Projects\+:\s*/, "");
}

/** `[Projects+] PPP-101 <caption>` — what every console line looks like. */
export function errorLine(code: string): string {
  return `${PREFIX} ${code} ${sentence(code)}`;
}

/** The line, plus whatever a developer needs after it (an `Error`, a path). */
export function logError(code: string, ...details: unknown[]): void {
  console.error(errorLine(code), ...details);
}

/** Same line at warning level, for a `kind: "warning"` code. */
export function logWarning(code: string, ...details: unknown[]): void {
  console.warn(errorLine(code), ...details);
}

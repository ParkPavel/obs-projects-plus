/**
 * #198 — a note name the host will actually accept.
 *
 * The demo project shipped a note called "Overdue: budget review — Storefront
 * Nimbus". Obsidian refuses a filename containing any of `* " \ / < > : | ?`,
 * so that note was never created, and the first thing a new user saw was a
 * notice saying part of their example could not be written.
 *
 * #156 had already made that failure visible instead of swallowing it, which is
 * why the cause was one line in the console rather than an afternoon. The fix
 * belongs here rather than in the one offending string: a demo set is edited by
 * people writing prose, and prose has colons in it.
 */

/** Exactly the characters Obsidian names in its own error message. */
const FORBIDDEN = /[*"\\/<>:|?]/g;

/**
 * `name` with every character the host forbids replaced by an en dash, and the
 * space around it normalised — "Overdue: budget review" becomes
 * "Overdue – budget review" rather than "Overdue– budget review".
 *
 * Trailing dots and spaces go too: Windows drops them silently, which would
 * make a path lookup miss a file that exists and turn an idempotent re-run into
 * a duplicate.
 */
export function sanitizeNoteName(name: string): string {
  return name
    .replace(FORBIDDEN, "–")
    .replace(/\s*–\s*/g, " – ")
    .replace(/\s{2,}/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
}

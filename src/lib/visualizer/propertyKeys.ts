/**
 * i3-props — rename and delete a property key, as pure mutations of a
 * frontmatter object (persistence lives in `propertyKeysWriter.ts`).
 *
 * The plugin's own bookkeeping for a key lives in the same note: `pp_overlay`
 * (hidden / pinned / order) and `pp_types`. A rename or a delete that left
 * them behind would pin, hide or retype a key that is gone — or, worse, a
 * later key of the same name — so both are carried along in the one write.
 * Nothing outside the note is touched (never `.obsidian/types.json`).
 */

import { OVERLAY_KEY } from "./overlay";
import { TYPES_KEY } from "./propertyTypes";

const OVERLAY_LISTS = ["hidden", "pinned", "order"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Rewrite `fm` in place with `entries`, keeping the object identity. */
function replaceAll(fm: Record<string, unknown>, entries: [string, unknown][]): void {
  for (const k of Object.keys(fm)) delete fm[k];
  for (const [k, v] of entries) fm[k] = v;
}

/** Map every overlay list through `fn`; drops `pp_overlay` once nothing is left in it. */
function rewriteOverlay(fm: Record<string, unknown>, fn: (list: string[]) => string[]): void {
  const raw = fm[OVERLAY_KEY];
  if (!isPlainObject(raw)) return;
  const next: Record<string, unknown> = { ...raw };
  for (const name of OVERLAY_LISTS) {
    const list = next[name];
    if (!Array.isArray(list)) continue;
    const mapped = fn(list.filter((x): x is string => typeof x === "string"));
    if (mapped.length > 0) next[name] = mapped;
    else delete next[name];
  }
  if (Object.keys(next).length === 0) delete fm[OVERLAY_KEY];
  else fm[OVERLAY_KEY] = next;
}

/** Same for the `pp_types` map. */
function rewriteTypes(fm: Record<string, unknown>, from: string, to: string | null): void {
  const raw = fm[TYPES_KEY];
  if (!isPlainObject(raw) || !(from in raw)) return;
  const next: [string, unknown][] = [];
  for (const [k, v] of Object.entries(raw)) {
    if (k !== from) next.push([k, v]);
    else if (to !== null) next.push([to, v]);
  }
  if (next.length === 0) delete fm[TYPES_KEY];
  else fm[TYPES_KEY] = Object.fromEntries(next);
}

/**
 * Rename `from` to `to` in place. The key keeps its position in the YAML and
 * its value untouched (a nested object moves as it is). Returns false — and
 * changes nothing — when `from` is absent or `to` is already taken.
 */
export function renameKeyIn(fm: Record<string, unknown>, from: string, to: string): boolean {
  if (from === to || !Object.prototype.hasOwnProperty.call(fm, from)) return false;
  if (Object.prototype.hasOwnProperty.call(fm, to)) return false;
  const entries = Object.entries(fm).map(([k, v]): [string, unknown] => [k === from ? to : k, v]);
  replaceAll(fm, entries);
  rewriteOverlay(fm, (list) => list.map((k) => (k === from ? to : k)));
  rewriteTypes(fm, from, to);
  return true;
}

/** Delete `key` in place, with its overlay and type entries. False when absent. */
export function deleteKeyIn(fm: Record<string, unknown>, key: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(fm, key)) return false;
  delete fm[key];
  rewriteOverlay(fm, (list) => list.filter((k) => k !== key));
  rewriteTypes(fm, key, null);
  return true;
}

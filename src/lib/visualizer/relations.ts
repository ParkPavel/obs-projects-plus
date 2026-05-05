/**
 * R1.3 — Manual relations editor (model)
 *
 * Per Revision 3 §7 the canonical "manual relation" target is an
 * ad-hoc array-typed YAML key — default `links` — that holds wikilinks
 * to related notes. Inverse relations are derived at runtime in R2.4.
 *
 * Operations here are *pure*: callers compose them with
 * `relationsWriter` to mutate the actual file.
 *
 * Wikilink shape: `[[Path/Without-Ext]]` or `[[Path/Without-Ext|alias]]`.
 *
 * Constraints:
 *  - Existing values under the key must be preserved.
 *  - Idempotency: adding the same target twice is a no-op.
 *  - If the key already exists as a non-array, we promote it to an
 *    array containing the original value plus the new one (loss-free
 *    coercion). Strings get unwrapped from any wikilink quotes first.
 *  - Removing the last entry leaves an empty array (NOT a deleted key);
 *    the caller decides whether to clean up.
 */

export const DEFAULT_RELATION_KEY = "links";

import {
  parseWikilink as kernelParseWikilink,
  formatWikilink as kernelFormatWikilink,
  type WikilinkTarget,
} from "src/lib/engine/wikilink";

export interface RelationTarget {
  /** Vault path **without** extension, e.g. `Projects/Acme`. */
  path: string;
  /** Optional display alias. */
  alias?: string;
}

/** `[[Foo|alias]]` → `{ path: "Foo", alias: "alias" }`. Returns null when not a wikilink. */
export function parseWikilink(raw: string): RelationTarget | null {
  const t: WikilinkTarget | null = kernelParseWikilink(raw);
  return t;
}

export function formatWikilink(target: RelationTarget): string {
  return kernelFormatWikilink(target);
}

/**
 * Read the list of relation paths under `key`. Tolerates string-or-array
 * shapes; unparseable entries are skipped silently.
 */
export function readRelations(
  frontmatter: Record<string, unknown> | null | undefined,
  key: string = DEFAULT_RELATION_KEY,
): RelationTarget[] {
  if (!frontmatter) return [];
  const raw = frontmatter[key];
  if (raw === undefined || raw === null) return [];

  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  const out: RelationTarget[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const parsed = parseWikilink(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Append a relation. Returns the new value to assign to `frontmatter[key]`.
 * Always an array. No-op (returns equivalent array) if `target.path`
 * already present.
 */
export function appendRelation(
  frontmatter: Record<string, unknown> | null | undefined,
  key: string,
  target: RelationTarget,
): string[] {
  const existing = readRelations(frontmatter, key);
  if (existing.some((e) => e.path === target.path)) {
    return existing.map(formatWikilink);
  }
  return [...existing.map(formatWikilink), formatWikilink(target)];
}

/** Remove a relation by path. Returns the new array (possibly empty). */
export function removeRelation(
  frontmatter: Record<string, unknown> | null | undefined,
  key: string,
  path: string,
): string[] {
  const existing = readRelations(frontmatter, key);
  return existing
    .filter((e) => e.path !== path)
    .map(formatWikilink);
}

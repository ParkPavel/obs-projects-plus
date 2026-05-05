/**
 * wikilink — canonical Obsidian wikilink parser/formatter (REFACTOR-105).
 *
 * Single source of truth for `[[Path]]`, `[[Path|alias]]`, and
 * `[[Path#heading]]` parsing across:
 *   - relations (manual link editor, inverse index)
 *   - datasources (frontmatter coercion)
 *   - cross-project resolver
 *   - dashboard relation resolver
 *   - calendar agenda filter
 *   - property type sniffing
 *
 * Two distinct strip semantics are preserved as separate functions
 * because they were both in use:
 *   - `stripToPath` — for canonical target matching (drops alias).
 *   - `stripToDisplay` — for user-facing display (keeps alias if present).
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a S-1; D-013 path
 * convention.
 */

/** Single anchored wikilink: `[[path]]` or `[[path|alias]]`. */
export const WIKILINK_RE_ANCHORED = /^\s*\[\[([^\]]+?)(?:\|([^\]]+))?\]\]\s*$/;

/** Global scanner with optional alias and `#heading`. */
export const WIKILINK_RE_GLOBAL = /\[\[([^\]|#]+)(?:#[^\]|]*)?\|?[^\]]*\]\]/g;

/** Quick predicate — is this a single anchored wikilink string? */
export function isWikilink(raw: string): boolean {
  return WIKILINK_RE_ANCHORED.test(raw);
}

export interface WikilinkTarget {
  /** Vault path without surrounding `[[]]`, alias, or `#heading`. */
  path: string;
  /** Optional display alias (after `|`). */
  alias?: string;
}

/**
 * Parse a single anchored wikilink into `{ path, alias }`. Returns
 * `null` when the input is not a wikilink (or path body is empty).
 */
export function parseWikilink(raw: string): WikilinkTarget | null {
  const m = WIKILINK_RE_ANCHORED.exec(raw);
  if (!m) return null;
  const body = (m[1] ?? "").trim();
  if (body.length === 0) return null;
  // Strip optional `#heading` from path body.
  const hashIdx = body.indexOf("#");
  const path = (hashIdx >= 0 ? body.slice(0, hashIdx) : body).trim();
  if (path.length === 0) return null;
  const alias = m[2]?.trim();
  return alias && alias.length > 0 ? { path, alias } : { path };
}

/** Format a `WikilinkTarget` back to `[[path]]` or `[[path|alias]]`. */
export function formatWikilink(target: WikilinkTarget): string {
  return target.alias
    ? `[[${target.path}|${target.alias}]]`
    : `[[${target.path}]]`;
}

/**
 * Extract every wikilink target from a free-form string. Targets are
 * trimmed; alias and `#heading` are dropped. Order preserved.
 */
export function extractWikilinks(raw: string, max = 500): string[] {
  const out: string[] = [];
  WIKILINK_RE_GLOBAL.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE_GLOBAL.exec(raw)) !== null) {
    const link = m[1]?.trim();
    if (link) out.push(link);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Strip a single anchored wikilink down to its **canonical target
 * path** (drops alias). Non-wikilink input is returned trimmed and
 * unmodified. Used for matching/resolution, not display.
 */
export function stripToPath(value: string): string {
  const trimmed = value.trim();
  const parsed = parseWikilink(trimmed);
  return parsed ? parsed.path : trimmed;
}

/**
 * Strip a single anchored wikilink down to its **display string**:
 * alias when present, otherwise the path. Used for user-visible
 * rendering of frontmatter values stored as wikilinks (e.g. the
 * `name` field per A.5a S-1).
 */
export function stripToDisplay(value: string): string {
  const trimmed = value.trim();
  const parsed = parseWikilink(trimmed);
  if (!parsed) return trimmed;
  return parsed.alias ?? parsed.path;
}

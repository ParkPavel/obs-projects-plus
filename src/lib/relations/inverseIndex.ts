/**
 * R2.4 — Cross-base inverse relation index
 *
 * Per Revision 3 §5.4 inverse relations are derived at runtime, never
 * written back to YAML. This module builds an in-memory
 * `Map<noteId, Set<noteId>>` from a flat collection of `(sourcePath,
 * frontmatter)` entries.
 *
 * Why not reuse `Database/engine/relationResolver`?
 *  - That helper is scoped to a single `DataFrame` (one project's
 *    records) and produces *per-field backlink columns*.
 *  - Here we need a global index spanning all vault notes, queryable
 *    by note path independent of any project schema. The Visualizer
 *    pane consumes it; future R2.4-followups (cross-base relations in
 *    Database widgets) will too.
 *
 * Pure module — no Obsidian APIs. The caller harvests
 * `(sourcePath, frontmatter)` from `metadataCache` (or any other source)
 * and feeds them in.
 */

export type FrontmatterMap = Record<string, unknown>;

export interface InverseIndexEntry {
  /** Path of the *source* note that contains a wikilink targeting this note. */
  sourcePath: string;
  /** Frontmatter key under which the relation lives (e.g. `links`). */
  viaKey: string;
}

/** Strict (forward path → set of inverse entries) mapping. */
export type InverseIndex = Map<string, InverseIndexEntry[]>;

import { parseWikilink as kernelParseWikilink } from "src/lib/engine/wikilink";

/**
 * Strip a `.md` extension from the resolved target so callers can
 * compare against TFile paths consistently. Leaves the path untouched
 * for non-md or already-extension-less targets.
 */
export function normalizeTargetPath(raw: string): string {
  return raw.replace(/\.md$/i, "");
}

/**
 * Extract all wikilink targets from a single frontmatter value.
 *  - String → at most one target.
 *  - String[] → up to N targets, in order, deduped.
 *  - Anything else → none.
 */
export function extractTargets(value: unknown): string[] {
  if (typeof value === "string") {
    const target = parseSingleWikilink(value);
    return target ? [target] : [];
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      if (typeof item !== "string") continue;
      const target = parseSingleWikilink(item);
      if (target && !seen.has(target)) {
        seen.add(target);
        out.push(target);
      }
    }
    return out;
  }
  return [];
}

function parseSingleWikilink(raw: string): string | null {
  const t = kernelParseWikilink(raw);
  return t ? t.path : null;
}

export interface BuildInverseIndexInput {
  /** Source note's vault path (with `.md` extension as Obsidian reports it). */
  path: string;
  /** Note's frontmatter, or null/undefined when missing. */
  frontmatter: FrontmatterMap | null | undefined;
}

export interface BuildInverseIndexOptions {
  /**
   * Frontmatter keys to scan. Defaults to the canonical R1.3 default
   * (`["links"]`). Pass a wider list to include arbitrary user keys
   * such as `parent`, `related`, `references`, etc.
   */
  keys?: readonly string[];
  /**
   * Resolver for ambiguous wikilink targets. Given the textual target
   * (without `.md`), should return the canonical vault path
   * (with extension), or `null` to keep the raw target verbatim.
   *
   * In Obsidian, this is typically backed by
   * `app.metadataCache.getFirstLinkpathDest(linktext, sourcePath)`.
   */
  resolveLinkPath?: (linktext: string, sourcePath: string) => string | null;
}

const DEFAULT_KEYS = ["links"] as const;

/**
 * Build the inverse index. The resulting map's keys are *normalised*
 * vault paths (without extension) so callers can index by either the
 * raw `[[Note]]` text or the actual file's `path.replace(/\.md$/, "")`.
 */
export function buildInverseIndex(
  notes: readonly BuildInverseIndexInput[],
  options: BuildInverseIndexOptions = {},
): InverseIndex {
  const keys = options.keys ?? DEFAULT_KEYS;
  const resolve = options.resolveLinkPath;
  const index: InverseIndex = new Map();

  for (const note of notes) {
    const fm = note.frontmatter;
    if (!fm) continue;
    for (const key of keys) {
      const value = fm[key];
      if (value === undefined) continue;
      for (const rawTarget of extractTargets(value)) {
        const resolved = resolve
          ? resolve(rawTarget, note.path) ?? rawTarget
          : rawTarget;
        const normalised = normalizeTargetPath(resolved);
        const list = index.get(normalised);
        const entry: InverseIndexEntry = {
          sourcePath: note.path,
          viaKey: key,
        };
        if (list) {
          // Avoid duplicate (path, key) pairs from arrays containing
          // the same target multiple times.
          if (!list.some((e) => e.sourcePath === entry.sourcePath && e.viaKey === entry.viaKey)) {
            list.push(entry);
          }
        } else {
          index.set(normalised, [entry]);
        }
      }
    }
  }

  return index;
}

/**
 * Look up inverse relations for a single note. Accepts either the raw
 * vault path (with or without `.md`) and normalises internally.
 */
export function lookupInverse(
  index: InverseIndex,
  notePath: string,
): InverseIndexEntry[] {
  return index.get(normalizeTargetPath(notePath)) ?? [];
}

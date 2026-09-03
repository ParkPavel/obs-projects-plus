/**
 * Addressing one source inside a project's container (#170 step 1).
 *
 * A project has held several sources since v3 — `additionalSources` — and
 * `DataFrameProvider` merges them into a single frame. The merge is the right
 * default and stays the default: "one theme, several record sets" is what a
 * project is. What was missing is the ability to point at ONE of them, and the
 * reason it was missing is that the sources had no names to point at.
 *
 * This is that step and nothing more. No new kind of source, no new entity, no
 * stored key that changes meaning: `sourceId` absent — which it is in every
 * config written before #170 — selects the merge, byte for byte what the block
 * showed before. Step 2 adds the derived source; this makes it addressable
 * when it arrives.
 *
 * See `SAVED_SELECTION_BRIEF_159.md` Revision 3 for why the container level
 * turned out to already exist, and why that made a fourth entity unnecessary.
 */

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { DataSource as StoredDataSource } from "src/settings/v3/settings";

/** One resolved source, with the identity it was stored under. */
export interface IdentifiedFrame {
  /** `undefined` for a source stored before #170, or never named. */
  readonly id: string | undefined;
  readonly frame: DataFrame;
}

/**
 * The frame a block should see.
 *
 * `merged` is what the project resolves to as a whole; `parts` carries the
 * same data with provenance kept. Selecting is a lookup, never a re-query —
 * acquisition happens once, in the provider.
 *
 * An id that names nothing returns the MERGE, not an empty frame: a source
 * deleted from the project while a block still points at it must degrade to
 * "the whole project" rather than to "no records". An empty table looks like
 * a filter that matched nothing, and a user would go looking for the wrong
 * bug. The caller can tell the two apart with `sourceExists`.
 */
export function selectSourceFrame(
  merged: DataFrame,
  parts: readonly IdentifiedFrame[],
  sourceId: string | undefined
): DataFrame {
  if (!sourceId) return merged;
  const part = parts.find((p) => p.id === sourceId);
  return part ? part.frame : merged;
}

/** Whether `sourceId` still names a source of this project. */
export function sourceExists(
  parts: readonly IdentifiedFrame[],
  sourceId: string | undefined
): boolean {
  if (!sourceId) return true;
  return parts.some((p) => p.id === sourceId);
}

/**
 * A name to show for a source, falling back to what it is made of.
 *
 * A source stored before #170 has no name, and inventing "Source 2" would be
 * worse than saying what it reads: the folder path or the tag IS the honest
 * label, and it is the one the user chose when they added it.
 */
export function sourceLabel(source: StoredDataSource): string {
  const named = (source as { name?: string }).name;
  if (typeof named === "string" && named.trim().length > 0) return named.trim();
  switch (source.kind) {
    case "folder":
      return source.config.path || "/";
    case "tag":
      return source.config.tag;
    case "dataview":
      return source.config.query.slice(0, 40);
    case "native-query":
      return "Query";
    default:
      return "Source";
  }
}

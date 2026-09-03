/**
 * The frame a block sees when it points at ONE source (#184).
 *
 * ## What this module is for
 *
 * #170 built the pieces and wired none of them. `selectSourceFrame`,
 * `sourceExists`, `sourceLabel`, `derivedSources` and `resolveDerived` are
 * correct, tested, and — until this file — called by nobody: `sourceId` was
 * declared on `WidgetSourceConfig` and read nowhere, and `frameParts` was
 * written by the provider and read nowhere. So a project could hold three
 * named sources and no block could show one of them, and a saved filter, had
 * anything been able to create one, would have appeared in no block at all.
 *
 * This module calls them. It adds no new resolution rule and rewrites none of
 * theirs; what it adds is the ORDER in which they are asked, which turns out
 * to be load-bearing twice over.
 *
 * ## Order trap 1 — derived must be checked before `sourceExists`
 *
 * `sourceExists` looks only in `parts`, and a derived source is never in
 * `parts`: `DataFrameProvider` excludes it by `isAcquirable`, correctly, since
 * it has no vault query to run. So `sourceExists` answers `false` for every
 * saved filter. Asking it first would report every saved filter as broken —
 * permanently, and with a message pointing at the wrong thing.
 *
 * ## Order trap 2 — the rows come from the ENRICHED frame, never from the part
 *
 * `selectSourceFrame` returns the part's own frame, which is what the vault
 * query produced: no backlinks, no rollups, none of the columns the view
 * added. Rendering that would silently strip a block's derived columns the
 * moment someone pointed it at a source. So the part is used for its record
 * IDS and the rows are taken from the enriched frame — exactly the technique
 * `resolveDerived` already uses internally for the same reason.
 *
 * Passing `enriched` where `selectSourceFrame` expects the merge is what makes
 * its documented fallback ("an id that names nothing returns the MERGE")
 * correct here for free: the intersection then keeps everything.
 *
 * ## What `enriched` actually is, since the name overpromises
 *
 * It is the project frame **as this view sees it** — already narrowed by a
 * filter tab upstream, then backlink-enriched by the widget. It is not the
 * whole project. Intersecting it with a part therefore yields "the rows of
 * this source that also survived the view's own filter", which is right:
 * both are axis A, and axis A composes.
 */

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/base/settings";
import type {
  DataSource as StoredDataSource,
  DerivedDataSource,
} from "src/settings/v3/settings";

import type { ProjectDefinition } from "src/settings/settings";

import { resolveDerived } from "./derivedSource";
import {
  selectSourceFrame,
  sourceExists,
  sourceLabel,
  type IdentifiedFrame,
} from "./sourceSelection";

/**
 * What the block should render.
 *
 * Four cases and not two, because "matched nothing", "cannot be resolved" and
 * "has not arrived" all look like an empty table and need opposite reactions
 * from the user. Collapsing them is the defect `resolveDerived` was written
 * to prevent, and it would come straight back if this type had a `frame` and
 * a boolean.
 */
export type NamedSourceView =
  /** Showing this source, or the whole project when none was named. */
  | { readonly kind: "ok"; readonly frame: DataFrame; readonly label: string | undefined }
  /** Resolved correctly, and nothing is in it. A real answer. */
  | { readonly kind: "empty"; readonly frame: DataFrame; readonly label: string }
  /** Cannot be resolved: what it reads from is gone. */
  | { readonly kind: "broken"; readonly reason: string; readonly label: string };

export interface NamedSourceInput {
  /**
   * The project frame this view sees, enriched.
   *
   * Required, and that is a finding rather than a simplification. `resolveDerived`
   * offers a `pending` case for a frame that has not arrived, and this resolver
   * mirrored it — until adversarial review pointed out it has no producer:
   * `DataFrameProvider` renders the widget tree only inside its `{:then}`, and
   * writes `dataFrame` and `frameParts` in the same synchronous step, so a host
   * never runs with a missing frame. Shipping a state nothing can reach, with a
   * test that reached it by calling this function directly, would have been
   * evidence weaker than the claim. The type now says what is true.
   */
  readonly enriched: DataFrame;
  /** Acquired frames with provenance, from `frameParts`. */
  readonly parts: readonly IdentifiedFrame[];
  /** Every source declared on the project, primary first. */
  readonly sources: readonly StoredDataSource[];
  /** The source this block names, or `undefined` for the merge. */
  readonly sourceId: string | undefined;
}

/** Find a stored source by id, whatever its kind. */
function sourceById(
  sources: readonly StoredDataSource[],
  id: string
): StoredDataSource | undefined {
  return sources.find((s) => (s as { id?: string }).id === id);
}

/** Rows of `enriched` whose ids appear in `subset`, keeping every column. */
function intersect(enriched: DataFrame, subset: DataFrame): DataFrame {
  if (subset === enriched) return enriched;
  const ids = new Set(subset.records.map((r) => r.id));
  return {
    fields: enriched.fields,
    records: enriched.records.filter((r) => ids.has(r.id)),
  };
}

/**
 * Resolve the frame a block should render, and say which of the four cases it is.
 *
 * A block that names no source is served `enriched` **by reference**, which is
 * the whole back-compat claim of #170 step 1 made checkable: every config
 * stored before it has no `sourceId`, and identity proves nothing was copied,
 * filtered or rebuilt on the way through.
 */
export function resolveNamedSource(input: NamedSourceInput): NamedSourceView {
  const { enriched, parts, sources, sourceId } = input;

  // No source named: the merge, untouched, by reference.
  if (!sourceId) return { kind: "ok", frame: enriched, label: undefined };

  const stored = sourceById(sources, sourceId);
  const label = stored ? sourceLabel(stored) : sourceId;

  // Derived FIRST — see "Order trap 1". A saved filter is never in `parts`.
  if (stored && stored.kind === "derived") {
    const resolved = resolveDerived(stored as DerivedDataSource, { enriched, parts });
    switch (resolved.kind) {
      case "ok":
        return { kind: "ok", frame: resolved.frame, label };
      case "empty":
        return { kind: "empty", frame: resolved.frame, label };
      case "pending":
        // Unreachable by construction: `resolveDerived` answers `pending` only
        // for an absent frame, and `enriched` above is required. Kept as a
        // total branch rather than a cast, so that if the precondition ever
        // changes this is where it surfaces instead of silently rendering.
        return { kind: "broken", reason: "the project frame has not resolved", label };
      case "broken":
        return { kind: "broken", reason: resolved.reason, label };
    }
  }

  if (!sourceExists(parts, sourceId)) {
    // Not among the acquired parts and not a saved filter. Either it was
    // deleted from the project, or it never got an id — both are configuration
    // the user can fix, and "0 records" would send them to look at their data.
    return {
      kind: "broken",
      reason: stored
        ? `source "${label}" produced no acquired frame`
        : `no source of this project has the id ${sourceId}`,
      label,
    };
  }

  const frame = intersect(enriched, selectSourceFrame(enriched, parts, sourceId));
  return frame.records.length > 0
    ? { kind: "ok", frame, label }
    : { kind: "empty", frame, label };
}

/**
 * Build the source a saved filter is stored as (#184 step 2).
 *
 * Pure, so the write path can be tested without mounting anything. `from` is
 * always `"project"` here: the filter bar this is invoked from shows the view's
 * whole frame, so that is what the user was looking at when they named it.
 */
export function buildDerivedSource(
  name: string,
  where: FilterDefinition,
  id: string
): DerivedDataSource {
  return { kind: "derived", id, name: name.trim(), config: { from: "project", where } };
}

/** A source a block can actually be pointed at, with the name to show for it. */
export interface SourceOption {
  readonly id: string;
  readonly label: string;
}

export interface ProjectSourceOptions {
  /** Every source the project declares, primary first — what the resolver reads. */
  readonly sources: readonly StoredDataSource[];
  /** Those that can be named in a config, i.e. the ones carrying an `id`. */
  readonly pickable: readonly SourceOption[];
  /** True when the project holds a source no config can point at. */
  readonly hasUnaddressable: boolean;
}

/**
 * What a picker may offer for this project.
 *
 * Sources stored before #170 carry no `id`, so nothing can reference them and
 * they are absent from `pickable`. `hasUnaddressable` exists so the UI can say
 * WHY a source the user can see in the project editor is missing from the list
 * — silently shorter is the version that reads as a bug.
 */
export function projectSourceOptions(
  project: ProjectDefinition | undefined
): ProjectSourceOptions {
  const sources = project ? [project.dataSource, ...(project.additionalSources ?? [])] : [];
  const pickable = sources
    .filter((s): s is StoredDataSource & { id: string } => typeof (s as { id?: string }).id === "string")
    .map((s) => ({ id: s.id, label: sourceLabel(s) }));
  return { sources, pickable, hasUnaddressable: pickable.length < sources.length };
}

/**
 * Whether a source of this project is already called `name` (#184).
 *
 * Compared against `sourceLabel`, not against stored names, because the label
 * is what the picker shows: a saved selection called "Archive" would be
 * indistinguishable from a folder source whose path renders as "Archive", and
 * the user picks from labels. Case- and whitespace-insensitive for the same
 * reason — "Active" and "active " are one name to a reader.
 *
 * This exists because the naming UI tells the user the name is what identifies
 * the selection later. That is only true if names are unique, and adversarial
 * review pointed out it was not enforced anywhere.
 */
export function sourceNameTaken(
  sources: readonly StoredDataSource[],
  name: string
): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  if (!wanted) return false;
  return sources.some((s) => sourceLabel(s).trim().toLocaleLowerCase() === wanted);
}

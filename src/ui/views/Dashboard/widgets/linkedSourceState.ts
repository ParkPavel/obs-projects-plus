// #136/#137 — what a database-call block is actually reading, as one value.
//
// The host used to compute this inline as
//   `sourceConfig?.projectId ? rightFrames.get(id) ?? frame : transformedFrame`
// and that `?? frame` was the defect: when the external project had not
// resolved — still loading, renamed, deleted — the block rendered the PARENT
// project's records, indistinguishably from its own. A fallback is not a
// loading state.
//
// Making it a union forces every consumer to say what it does in each case
// instead of receiving a frame that might be someone else's.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { WidgetDefinition, WidgetDataContext, WidgetSourceConfig, LinkedSelectionConfig } from "../types";
import type { ExternalSourceState } from "../dashboardPreload";

export type BlockSource =
  /** No external source configured: the block reads the host's own frame. */
  | { readonly kind: "parent"; readonly frame: DataFrame }
  | { readonly kind: "loading"; readonly projectId: string }
  | { readonly kind: "ready"; readonly projectId: string; readonly frame: DataFrame }
  | { readonly kind: "unavailable"; readonly projectId: string }
  | { readonly kind: "error"; readonly projectId: string; readonly message: string };

/**
 * Resolve what this block reads.
 *
 * An external source with no entry in `states` is reported as `loading`, not
 * `unavailable`: the preloader publishes `loading` for every referenced id
 * before awaiting, so an absent key means the batch has not started rather than
 * that the project is gone. Guessing "gone" here would put an error in front of
 * the user on every first render.
 */
export function resolveBlockSource(
  projectId: string | undefined,
  states: ReadonlyMap<string, ExternalSourceState>,
  parentFrame: DataFrame
): BlockSource {
  if (!projectId) return { kind: "parent", frame: parentFrame };

  const state = states.get(projectId);
  if (!state || state.status === "loading") return { kind: "loading", projectId };
  if (state.status === "ready") return { kind: "ready", projectId, frame: state.frame };
  if (state.status === "error") {
    return { kind: "error", projectId, message: state.message };
  }
  return { kind: "unavailable", projectId };
}

/** True when the block reads a project other than the dashboard's own. */
export function isExternalSource(source: BlockSource): boolean {
  return source.kind !== "parent";
}

/**
 * The frame to render, or null when there is nothing honest to show.
 *
 * Null is the point: the caller must render a state rather than substitute
 * data. Returning an empty frame here would be the same silent lie in a
 * different costume — an empty table reads as "no records match", which is a
 * claim about the source, not about our failure to load it.
 */
export function blockFrame(source: BlockSource): DataFrame | null {
  if (source.kind === "parent" || source.kind === "ready") return source.frame;
  return null;
}

/**
 * An empty frame standing in for "there is nothing honest to render".
 *
 * Callers that are structurally required to hold a `DataFrame` — a render
 * context assembled before the branch that decides what to draw — use this and
 * then render a state from {@link BlockSource}. It exists so the type system is
 * satisfied without the caller reaching for the parent's frame again, which is
 * the defect this module was written to remove.
 */
const EMPTY_FRAME: DataFrame = { fields: [], records: [] } as unknown as DataFrame;

/** {@link blockFrame}, with the empty stand-in instead of null. */
export function blockFrameOrEmpty(source: BlockSource): DataFrame {
  return blockFrame(source) ?? EMPTY_FRAME;
}

/** Everything the host needs to know about a database-call block's data. */
export interface DbCallView {
  readonly sourceConfig: WidgetSourceConfig | undefined;
  readonly source: BlockSource;
  /** Safe to hand to a render context; render a state when `source` is not ready. */
  readonly frame: DataFrame;
  readonly linkedSelection: LinkedSelectionConfig | undefined;
  readonly isExternal: boolean;
}

/**
 * Derive the block's data view in one step.
 *
 * Assembled here rather than as five reactive statements in the host, so the
 * pieces cannot be updated out of step with one another — `isExternal` and
 * `frame` disagreeing is precisely the shape of the #136 defect.
 */
export function resolveDbCallView(
  widget: WidgetDefinition,
  states: ReadonlyMap<string, ExternalSourceState>,
  transformedFrame: DataFrame
): DbCallView {
  const isDbCall = widget.type === "database-call";
  const sourceConfig = isDbCall ? widget.sourceConfig : undefined;
  const source = resolveBlockSource(sourceConfig?.projectId, states, transformedFrame);
  return {
    sourceConfig,
    source,
    frame: blockFrameOrEmpty(source),
    linkedSelection: isDbCall
      ? (widget.config as unknown as WidgetDataContext).linkedSelection
      : undefined,
    isExternal: isExternalSource(source),
  };
}

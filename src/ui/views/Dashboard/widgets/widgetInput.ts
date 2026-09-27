// widgetInput.ts — which records a widget starts from (the head of axis A).
//
// Split out of hostFrames.ts when 3.6.0 let a chart or stats block read
// another project: hostFrames sits at its R0.6 ceiling, and "which frame is
// the input" is one question with one answer, so it lives here whole.

import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";
import type { DataSource as StoredDataSource } from "src/settings/v3/settings";
import type { IdentifiedFrame } from "src/lib/datasources/sourceSelection";
import { resolveNamedSource, type NamedSourceView } from "src/lib/datasources/namedSource";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
import type { ExternalSourceState } from "../dashboardPreload";
import type { WidgetDefinition } from "../types";
import { blockFrameOrEmpty, otherProjectSource, type BlockSource } from "./linkedSourceState";

/** Backlink-enrich `frame` when any field of the widget is a stored Relation. */
export function enrichForWidget(frame: DataFrame, fields: readonly DataField[]): DataFrame {
  const names = fields.filter((f) => f.type === DataFieldType.Relation && !f.derived).map((f) => f.name);
  return names.length > 0 ? enrichWithBacklinks(frame, names) : frame;
}

export interface WidgetInput {
  /** #184: which source this block shows, and whether it resolved at all. */
  readonly namedSource: NamedSourceView;
  /** After enrichment and source selection, before axis A. */
  readonly enrichedFrame: DataFrame;
  /**
   * 3.6.0: the other project a chart or stats block reads, or null. Not ready
   * → the frames are empty and the block shows the state; never this
   * project's rows.
   */
  readonly otherProject: BlockSource | null;
}

export function resolveWidgetInput(input: {
  readonly widget: WidgetDefinition;
  readonly frame: DataFrame;
  readonly fields: readonly DataField[];
  readonly sourceStates: ReadonlyMap<string, ExternalSourceState>;
  readonly parts: readonly IdentifiedFrame[];
  readonly sources: readonly StoredDataSource[];
}): WidgetInput {
  const { widget } = input;
  // 3.6.0: another project's frame (enriched by its own view) replaces this
  // one's, and this project's enrichment and named sources do not apply.
  const otherProject = otherProjectSource(widget, input.sourceStates);
  const projectEnriched = otherProject
    ? blockFrameOrEmpty(otherProject)
    : enrichForWidget(input.frame, input.fields);
  // #184. Source selection heads axis A: it decides WHICH records the widget is
  // about, before any filter narrows them. Over the ENRICHED frame, because a
  // saved filter may name a rollup (#170's Gate 0 refutation). A block naming
  // no source gets the same frame object back — a no-op for everything shipped.
  const namedSource = resolveNamedSource({
    enriched: projectEnriched,
    parts: otherProject ? [] : input.parts,
    sources: otherProject ? [] : input.sources,
    sourceId: otherProject ? undefined : widget.sourceConfig?.sourceId,
  });
  const enrichedFrame = "frame" in namedSource ? namedSource.frame : projectEnriched;
  return { namedSource, enrichedFrame, otherProject };
}

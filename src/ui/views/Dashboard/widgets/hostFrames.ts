// hostFrames.ts — #184.
//
// Every frame the host derives from the data it is handed, in one pure
// function: enrichment, source selection, axis A, and the transform pipeline.
// `WidgetHost` keeps the reactive plumbing and owns none of the arithmetic.
//
// It moved out of the host to make room, and paid for itself: the canonical
// order (invariant 3) used to be pinned by searching the host's TEXT for
// `applyWidgetScope(enrichedFrame` ahead of `executeTransform(scope.frame`,
// which proves two calls sit in an order in a file and cannot prove that
// swapping them changes an answer. As a composition it is provable, and
// `__tests__/hostFrames.test.ts` proves it on a frame where the orders
// disagree. The substrings stay spelled as the invariant reads them, and
// `R_filterOrder` now reads this file — as #169 established for the context.

import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";
import type { DataSource as StoredDataSource } from "src/settings/v3/settings";
import type { IdentifiedFrame } from "src/lib/datasources/sourceSelection";
import { resolveNamedSource, type NamedSourceView } from "src/lib/datasources/namedSource";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { ExternalSourceState } from "../dashboardPreload";
import type { ChartConfig, StatsConfig, WidgetDefinition } from "../types";
import { applyWidgetScope, type WidgetScopeResult } from "./widgetScope";
import {
  asChartConfig,
  asStatsConfig,
  chartRightFrameOf,
  resolveDbCallView,
  type DbCallView,
} from "./linkedSourceState";

export interface HostFramesInput {
  readonly widget: WidgetDefinition;
  /** The project frame as this VIEW sees it — already narrowed by a filter tab. */
  readonly frame: DataFrame;
  readonly fields: DataField[];
  readonly pipeline: TransformPipeline;
  readonly rightFrames: ReadonlyMap<string, DataFrame>;
  readonly sourceStates: ReadonlyMap<string, ExternalSourceState>;
  /** Acquired frames with provenance (`frameParts`), for #184 source selection. */
  readonly parts: readonly IdentifiedFrame[];
  /** Every source declared on the project. */
  readonly sources: readonly StoredDataSource[];
}

export interface HostFrames {
  /** #184: which source this block shows, and whether it resolved at all. */
  readonly namedSource: NamedSourceView;
  /** After enrichment and source selection, before axis A. */
  readonly enrichedFrame: DataFrame;
  readonly scope: WidgetScopeResult;
  readonly transformedFrame: DataFrame;
  readonly pipelineInputRowCount: number;
  readonly chartConfig: ChartConfig | null;
  readonly statsConfig: StatsConfig | null;
  readonly chartRightFrame: DataFrame | null;
  readonly dbCall: DbCallView;
  /** #137: the pipeline editor is configured against what the pipeline receives. */
  readonly pipelineSource: DataFrame;
}

/** Backlink-enrich `frame` when any field of the widget is a stored Relation. */
export function enrichForWidget(frame: DataFrame, fields: readonly DataField[]): DataFrame {
  const names = fields.filter((f) => f.type === DataFieldType.Relation && !f.derived).map((f) => f.name);
  return names.length > 0 ? enrichWithBacklinks(frame, names) : frame;
}

/**
 * Every derived frame, in canonical order.
 *
 * `enrich → A (scope) → C (transform)`. Axes B, sort and render happen further
 * down, in the block and the view.
 */
export function computeHostFrames(input: HostFramesInput): HostFrames {
  const { widget, frame, fields, pipeline, rightFrames, sourceStates } = input;

  const projectEnriched = enrichForWidget(frame, fields);
  // #184. Source selection heads axis A: it decides WHICH records the widget is
  // about, before any filter narrows them. Over the ENRICHED frame, because a
  // saved filter may name a rollup (#170's Gate 0 refutation). A block naming
  // no source gets the same frame object back — a no-op for everything shipped.
  const namedSource = resolveNamedSource({
    enriched: projectEnriched,
    parts: input.parts,
    sources: input.sources,
    sourceId: widget.sourceConfig?.sourceId,
  });
  const enrichedFrame = "frame" in namedSource ? namedSource.frame : projectEnriched;
  const scope = applyWidgetScope(enrichedFrame, widget.config); // #118: A before C when evaluable
  const transformResult =
    pipeline.steps.length > 0 ? executeTransform(scope.frame, pipeline, { rightFrames }) : null;
  const transformedFrame = transformResult ? transformResult.data : scope.frame;
  const pipelineInputRowCount = transformResult
    ? transformResult.meta.inputRowCount
    : scope.frame.records.length;

  const chartConfig = widget.type === "chart" ? asChartConfig(widget.config) : null;
  const statsConfig = widget.type === "stats" ? asStatsConfig(widget.config) : null;

  // NPLAN-V7.1 / #136: per-widget independent source, resolved as one value.
  const dbCall = resolveDbCallView(widget, sourceStates, transformedFrame);

  return {
    namedSource,
    enrichedFrame,
    scope,
    transformedFrame,
    pipelineInputRowCount,
    chartConfig,
    statsConfig,
    chartRightFrame: chartRightFrameOf(widget.type, chartConfig, rightFrames),
    dbCall,
    pipelineSource: dbCall.isExternal ? dbCall.frame : scope.frame,
  };
}

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
import type { NamedSourceView } from "src/lib/datasources/namedSource";
import { executeTransform } from "src/lib/dashboard-engine/transformExecutor";
import type { TransformPipeline } from "src/lib/dashboard-engine/transformTypes";
import type { ExternalSourceState } from "../dashboardPreload";
import type { ChartConfig, StatsConfig, WidgetDefinition } from "../types";
import { applyWidgetScope, type WidgetScopeResult } from "./widgetScope";
import {
  chartFramesOf,
  widgetConfigsOf,
  resolveDbCallView,
  type BlockSource,
  type DbCallView,
} from "./linkedSourceState";
import { resolveWidgetInput } from "./widgetInput";
export { enrichForWidget } from "./widgetInput";

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
  readonly chartSeriesFrames: ReadonlyMap<string, DataFrame>;
  readonly dbCall: DbCallView;
  /** #137: the pipeline editor is configured against what the pipeline receives. */
  readonly pipelineSource: DataFrame;
  /** 3.6.0: another project a chart or stats block reads (widgetInput.ts), or null. */
  readonly otherProject: BlockSource | null;
}

/**
 * Every derived frame, in canonical order.
 *
 * `enrich → A (scope) → C (transform)`. Axes B, sort and render happen further
 * down, in the block and the view.
 */
export function computeHostFrames(input: HostFramesInput): HostFrames {
  const { widget, pipeline, rightFrames, sourceStates } = input;

  // Enrichment and #184 source selection (or 3.6.0 another project): widgetInput.ts.
  const { namedSource, enrichedFrame, otherProject } = resolveWidgetInput(input);
  const scope = applyWidgetScope(enrichedFrame, widget.config); // #118: A before C when evaluable
  const runs = pipeline.steps.length > 0 && (!otherProject || otherProject.kind === "ready"); // unresolved: no rows
  const transformResult = runs ? executeTransform(scope.frame, pipeline, { rightFrames }) : null;
  const transformedFrame = transformResult ? transformResult.data : scope.frame;
  const pipelineInputRowCount = transformResult
    ? transformResult.meta.inputRowCount
    : scope.frame.records.length;

  const { chartConfig, statsConfig } = widgetConfigsOf(widget);

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
    ...chartFramesOf(widget.type, chartConfig, rightFrames),
    dbCall,
    pipelineSource: dbCall.isExternal ? dbCall.frame : scope.frame,
    otherProject,
  };
}

// hostFrames.ts — #184.
//
// Every frame the host derives from the data it is handed, in one pure
// function: enrichment, axis A, the transform pipeline, and the per-widget
// source view. `WidgetHost` keeps the reactive plumbing and owns none of the
// arithmetic.
//
// It moved out of the host for two reasons, and the second is the one that
// matters. The first is ordinary: the host was one line from its R0.6 ceiling
// and #184 needs room. The second is that the canonical filter order
// (`docs/internal/FILTER_ORDER_ADR.md`, invariant 3) was pinned by searching
// the host's TEXT for `applyWidgetScope(enrichedFrame` and
// `executeTransform(scope.frame`. That proves the two calls appear in that
// order in a file; it cannot prove that running them the other way round would
// produce a different answer. As a composition of pure functions the order is
// testable for real — see `__tests__/hostFrames.test.ts`, which feeds it a
// frame where A-before-C and C-before-A disagree.
//
// The substrings stay spelled exactly as the invariant reads them, and
// `R_filterOrder.invariant.test.ts` now reads this file. Following the wiring
// to where it lives is what #169 established when the render context moved.

import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";
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
}

export interface HostFrames {
  /** After enrichment, before axis A. */
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
  const relationFieldNames = fields
    .filter((f) => f.type === DataFieldType.Relation && !f.derived)
    .map((f) => f.name);
  return relationFieldNames.length > 0 ? enrichWithBacklinks(frame, relationFieldNames) : frame;
}

/**
 * Every derived frame, in canonical order.
 *
 * `enrich → A (scope) → C (transform)`. Axes B, sort and render happen further
 * down, in the block and the view.
 */
export function computeHostFrames(input: HostFramesInput): HostFrames {
  const { widget, frame, fields, pipeline, rightFrames, sourceStates } = input;

  const enrichedFrame = enrichForWidget(frame, fields);
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

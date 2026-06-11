// widgetComponentRegistry.ts — #067 F1 (UT2026-F).
//
// The routing table that replaced 34 if-branches in WidgetHost.svelte:
// WidgetType → content component + pure props builder (+ optional render
// guard + zero-config wizard descriptor), and WidgetType → config-panel
// component + props builder. Builders are pure functions of a
// WidgetRenderContext assembled reactively by the host, so routing is
// unit-testable without mounting Svelte.
//
// Event wiring stays in WidgetHost (Svelte event forwarding cannot live in
// a TS table); the host attaches one unified listener set to every
// component — extra listeners on components that never dispatch them are
// inert by design.

import type { ComponentType } from "svelte";
import type { DataFrame, DataRecord, DataField } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import type {
  WidgetDefinition,
  WidgetType,
  ChartConfig,
  StatsConfig,
  WidgetSourceConfig,
  DataTableConfig,
  FieldPreset,
  LinkedSelectionConfig,
} from "../types";

import DataTableWidget from "src/archive/dashboard-v1/DataTable/DataTableWidget.svelte";
import ChartWidget from "./Chart/ChartWidget.svelte";
import ChartConfigPanel from "./Chart/ChartConfig.svelte";
import StatsWidget from "./Stats/StatsWidget.svelte";
import StatsConfigPanel from "./Stats/StatsConfig.svelte";
import ComparisonWidget from "src/archive/dashboard-v1/Comparison/ComparisonWidget.svelte";
import ComparisonConfigPanel from "src/archive/dashboard-v1/Comparison/ComparisonConfig.svelte";
import ChecklistWidget from "./Checklist/ChecklistWidget.svelte";
import ChecklistConfigPanel from "./Checklist/ChecklistConfig.svelte";
import ViewPortWidget from "src/archive/dashboard-v1/ViewPort/ViewPortWidget.svelte";
import ViewPortConfigPanel from "src/archive/dashboard-v1/ViewPort/ViewPortConfig.svelte";
import FilterTabsWidget from "./FilterTabs/FilterTabsWidget.svelte";
import FilterTabsConfigPanel from "./FilterTabs/FilterTabsConfig.svelte";
import SummaryRowWidget from "src/archive/dashboard-v1/SummaryRow/SummaryRowWidget.svelte";
import SummaryRowConfigPanel from "src/archive/dashboard-v1/SummaryRow/SummaryRowConfig.svelte";
import DataListWidget from "src/archive/dashboard-v1/DataList/DataListWidget.svelte";
import DataListConfigPanel from "src/archive/dashboard-v1/DataList/DataListConfig.svelte";
import SubBaseCanvasWidget from "src/archive/dashboard-v1/SubBaseCanvas/SubBaseCanvasWidget.svelte";
import SubBaseCanvasConfigPanel from "src/archive/dashboard-v1/SubBaseCanvas/SubBaseCanvasConfig.svelte";
import YamlVisualizerWidget from "src/archive/dashboard-v1/YamlVisualizer/YamlVisualizerWidget.svelte";
import DatabaseCallBlock from "./DatabaseCall/DatabaseCallBlock.svelte";
import TimelineWidget from "src/archive/dashboard-v1/Timeline/TimelineWidget.svelte";
import TimelineConfigPanel from "src/archive/dashboard-v1/Timeline/TimelineConfig.svelte";
import CoverBannerWidget from "./CoverBanner/CoverBannerWidget.svelte";
import CoverBannerConfigPanel from "./CoverBanner/CoverBannerConfig.svelte";
import TextWidget from "./TextWidget/TextWidget.svelte";
import DividerWidget from "./DividerWidget/DividerWidget.svelte";

/** Everything a props builder may need; assembled reactively by WidgetHost. */
export interface WidgetRenderContext {
  readonly widget: WidgetDefinition;
  readonly frame: DataFrame;
  readonly transformedFrame: DataFrame;
  readonly api: ViewApi;
  readonly readonly: boolean;
  readonly getRecordColor: (record: DataRecord) => string | null;
  readonly fields: DataField[];
  readonly fieldPresets: FieldPreset[];
  readonly activeFieldPresetId: string | undefined;
  readonly availableSources: Array<{ id: string; name: string }>;
  readonly project: ProjectDefinition | undefined;
  readonly effectiveTableConfig: DataTableConfig | undefined;
  readonly pipelineStepCount: number;
  readonly chartConfig: ChartConfig | null;
  readonly statsConfig: StatsConfig | null;
  readonly chartRightFrame: DataFrame | null;
  readonly dbCallFrame: DataFrame;
  readonly dbCallFields: DataField[];
  readonly dbCallSourceConfig: WidgetSourceConfig | undefined;
  readonly dbCallLinkedSelection: LinkedSelectionConfig | undefined;
}

type Props = Record<string, unknown>;

export interface ContentEntry {
  readonly component: ComponentType;
  readonly props: (ctx: WidgetRenderContext) => Props;
  /** When false, the host renders the wizard (if any) or the placeholder. */
  readonly canRender?: (ctx: WidgetRenderContext) => boolean;
  /** Zero-config prompt shown when `canRender` is false. */
  readonly wizard?: { readonly icon: string; readonly messageKey: string; readonly messageDefault: string };
}

export const WIDGET_CONTENT: Partial<Record<WidgetType, ContentEntry>> = {
  "data-table": {
    component: DataTableWidget,
    props: (c) => ({
      frame: c.transformedFrame, api: c.api, readonly: c.readonly,
      getRecordColor: c.getRecordColor, fields: c.transformedFrame.fields,
      config: c.effectiveTableConfig, fieldPresets: c.fieldPresets,
      activeFieldPresetId: c.activeFieldPresetId, project: c.project,
      widgetId: c.widget.id,
    }),
  },
  chart: {
    component: ChartWidget,
    canRender: (c) => c.chartConfig !== null,
    wizard: { icon: "bar-chart-2", messageKey: "views.dashboard.widget.chart-not-configured", messageDefault: "Chart is not configured" },
    props: (c) => ({ config: c.chartConfig, source: c.transformedFrame, rightFrame: c.chartRightFrame, widgetId: c.widget.id }),
  },
  stats: {
    component: StatsWidget,
    canRender: (c) => c.statsConfig !== null,
    wizard: { icon: "trending-up", messageKey: "views.dashboard.widget.stats-not-configured", messageDefault: "Stats widget is not configured" },
    props: (c) => ({ config: c.statsConfig, source: c.transformedFrame, widgetId: c.widget.id }),
  },
  comparison: {
    component: ComparisonWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame }),
  },
  checklist: {
    component: ChecklistWidget,
    props: (c) => ({
      config: c.widget.config, source: c.transformedFrame, api: c.api,
      readonly: c.readonly, fields: c.transformedFrame.fields,
      pipelineSteps: c.pipelineStepCount,
    }),
  },
  "view-port": {
    component: ViewPortWidget,
    props: (c) => ({ config: c.widget.config }),
  },
  "filter-tabs": {
    component: FilterTabsWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame }),
  },
  "summary-row": {
    component: SummaryRowWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame, pipelineSteps: c.pipelineStepCount }),
  },
  "data-list": {
    component: DataListWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame, pipelineSteps: c.pipelineStepCount }),
  },
  "sub-base-canvas": {
    component: SubBaseCanvasWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame }),
  },
  "yaml-visualizer": {
    component: YamlVisualizerWidget,
    canRender: (c) => c.project !== undefined,
    props: (c) => ({
      config: c.widget.config, source: c.transformedFrame,
      project: c.project, api: c.api, readonly: c.readonly,
    }),
  },
  "database-call": {
    component: DatabaseCallBlock,
    props: (c) => ({
      frame: c.dbCallFrame, api: c.api, readonly: c.readonly,
      getRecordColor: c.getRecordColor, fields: c.dbCallFields,
      fieldPresets: c.fieldPresets, activeFieldPresetId: c.activeFieldPresetId,
      project: c.project, config: c.widget.config, widgetId: c.widget.id,
      widgetTitle: c.widget.title, linkedSelection: c.dbCallLinkedSelection,
    }),
  },
  timeline: {
    component: TimelineWidget,
    props: (c) => ({ source: c.transformedFrame, config: c.widget.config }),
  },
  "cover-banner": {
    component: CoverBannerWidget,
    props: (c) => ({ config: c.widget.config }),
  },
  text: {
    component: TextWidget,
    props: (c) => ({ config: c.widget.config, readonly: c.readonly }),
  },
  divider: {
    component: DividerWidget,
    props: (c) => ({ config: c.widget.config, readonly: c.readonly }),
  },
};

/**
 * Config panels routed generically (on:change → widget config replace,
 * on:close → hide). `database-call` is NOT here: its settings panel has a
 * distinct event contract (source/linkedSelection) and stays an explicit
 * branch in WidgetHost.
 */
export const WIDGET_PANELS: Partial<Record<WidgetType, { component: ComponentType; props: (ctx: WidgetRenderContext) => Props }>> = {
  chart: { component: ChartConfigPanel, props: (c) => ({ config: c.chartConfig, fields: c.fields, availableSources: c.availableSources }) },
  checklist: { component: ChecklistConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  stats: { component: StatsConfigPanel, props: (c) => ({ config: c.statsConfig, fields: c.transformedFrame.fields }) },
  "summary-row": { component: SummaryRowConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  "data-list": { component: DataListConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  "sub-base-canvas": { component: SubBaseCanvasConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields, source: c.transformedFrame }) },
  comparison: { component: ComparisonConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  "filter-tabs": { component: FilterTabsConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields, source: c.transformedFrame }) },
  "view-port": { component: ViewPortConfigPanel, props: (c) => ({ config: c.widget.config }) },
  timeline: { component: TimelineConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  "cover-banner": { component: CoverBannerConfigPanel, props: (c) => ({ config: c.widget.config }) },
};

/** Types whose header shows the transform-pipeline button. */
export function hasPipelineButton(type: WidgetType): boolean {
  return type !== "data-table" && type !== "text" && type !== "divider";
}

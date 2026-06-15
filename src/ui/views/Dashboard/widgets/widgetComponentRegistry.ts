// widgetComponentRegistry.ts — #067 F1 + #074 F3 (UT2026-A/F).
//
// The routing table that replaced 34 if-branches in WidgetHost.svelte:
// WidgetType → content component + pure props builder (+ optional render
// guard + zero-config wizard descriptor), and WidgetType → config-panel
// component + props builder. Builders are pure functions of a
// WidgetRenderContext assembled reactively by the host.
//
// F3 (UT2026-A L1): ZERO imports from src/archive — enforced by
// R0_4_archiveContainment.test.ts. `data-table` renders THROUGH
// DatabaseCallBlock with an on-the-fly single-Table-tab config (the V2 fate
// table successor); the remaining archived types fall through to the
// LegacyWidgetPlaceholder branch in WidgetHost.
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
import { tableTabConfig } from "./legacyMigration";

import ChartWidget from "./Chart/ChartWidget.svelte";
import ChartConfigPanel from "./Chart/ChartConfig.svelte";
import StatsWidget from "./Stats/StatsWidget.svelte";
import StatsConfigPanel from "./Stats/StatsConfig.svelte";
import ChecklistWidget from "./Checklist/ChecklistWidget.svelte";
import ChecklistConfigPanel from "./Checklist/ChecklistConfig.svelte";
import FilterTabsWidget from "./FilterTabs/FilterTabsWidget.svelte";
import FilterTabsConfigPanel from "./FilterTabs/FilterTabsConfig.svelte";
import DatabaseCallBlock from "./DatabaseCall/DatabaseCallBlock.svelte";
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
  // F3: legacy data-table renders through its V2 successor on the fly.
  // The stored config keeps its legacy shape (table overlay) until the
  // user grows the block beyond one Table tab — see WidgetHost unwrap.
  "data-table": {
    component: DatabaseCallBlock,
    props: (c) => ({
      frame: c.transformedFrame, api: c.api, readonly: c.readonly,
      getRecordColor: c.getRecordColor, fields: c.transformedFrame.fields,
      fieldPresets: c.fieldPresets, activeFieldPresetId: c.activeFieldPresetId,
      project: c.project,
      config: tableTabConfig((c.effectiveTableConfig ?? {}) as Record<string, unknown>),
      widgetId: c.widget.id, widgetTitle: c.widget.title,
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
  checklist: {
    component: ChecklistWidget,
    props: (c) => ({
      config: c.widget.config, source: c.transformedFrame, api: c.api,
      readonly: c.readonly, fields: c.transformedFrame.fields,
      pipelineSteps: c.pipelineStepCount,
    }),
  },
  "filter-tabs": {
    component: FilterTabsWidget,
    props: (c) => ({ config: c.widget.config, source: c.transformedFrame }),
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
 * branch in WidgetHost. Archived types have no panels (F3).
 */
export const WIDGET_PANELS: Partial<Record<WidgetType, { component: ComponentType; props: (ctx: WidgetRenderContext) => Props }>> = {
  chart: { component: ChartConfigPanel, props: (c) => ({ config: c.chartConfig, fields: c.fields, availableSources: c.availableSources }) },
  checklist: { component: ChecklistConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields }) },
  stats: { component: StatsConfigPanel, props: (c) => ({ config: c.statsConfig, fields: c.transformedFrame.fields }) },
  "filter-tabs": { component: FilterTabsConfigPanel, props: (c) => ({ config: c.widget.config, fields: c.transformedFrame.fields, source: c.transformedFrame }) },
  "cover-banner": { component: CoverBannerConfigPanel, props: (c) => ({ config: c.widget.config }) },
};

/** Types whose header shows the transform-pipeline button. */
export function hasPipelineButton(type: WidgetType): boolean {
  return type !== "data-table" && type !== "text" && type !== "divider";
}

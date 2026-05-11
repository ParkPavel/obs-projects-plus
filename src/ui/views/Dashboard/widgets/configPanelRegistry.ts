import type { DataField } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type {
  WidgetType,
  ChartConfig,
  StatsConfig,
  SummaryColumnConfig,
} from "../types";

/**
 * Phase 2a — INTERFACE RECLAMATION.
 *
 * Single source of truth for widget configuration behavior: whether the
 * cog button is visible, whether the widget already has a config, and
 * how to seed a sensible default on first cog-click.
 *
 * Rendering of individual panels remains in `WidgetHost.svelte` because
 * panel prop shapes vary per widget; the registry normalises the
 * behavioral contract, not the component type.
 */
export interface ConfigPanelDescriptor {
  /** When true, the cog icon is rendered in widget header. */
  readonly hasCog: boolean;
  /** Returns true when widget.config already carries a usable config. */
  isConfigured(config: Record<string, unknown>): boolean;
  /** Build a default config keyed on available fields. */
  initDefaults(fields: DataField[]): Record<string, unknown>;
}

const DEFAULT_CHART_CONFIG: ChartConfig = {
  chartType: "bar",
  xAxis: { property: "", sortBy: "label", sortOrder: "asc", omitZero: false },
  yAxis: { property: "count", aggregation: "count_total" },
  style: {
    colorScheme: "auto",
    height: "medium",
    showGrid: true,
    showLabels: true,
    showLegend: false,
    showValues: true,
  },
};

const DEFAULT_STATS_CONFIG: StatsConfig = {
  cards: [],
  columns: 2,
};

const PANELS = {
  "data-table": {
    // DataTable settings live in the right-click column menu; no cog.
    hasCog: false,
    isConfigured: () => true,
    initDefaults: () => ({}),
  },
  chart: {
    hasCog: true,
    isConfigured: (c) =>
      !!c && typeof c === "object" && "chartType" in c && "xAxis" in c,
    initDefaults: (fields) => ({
      ...DEFAULT_CHART_CONFIG,
      xAxis: { ...DEFAULT_CHART_CONFIG.xAxis, property: fields[0]?.name ?? "" },
    }),
  },
  stats: {
    hasCog: true,
    isConfigured: (c) => !!c && typeof c === "object" && "cards" in c,
    initDefaults: () => ({ ...DEFAULT_STATS_CONFIG }),
  },
  comparison: {
    hasCog: true,
    isConfigured: (c) => Object.keys(c ?? {}).length > 0,
    initDefaults: (fields) => {
      const numericField =
        fields.find((f) => f.type === DataFieldType.Number)?.name ??
        fields[0]?.name ??
        "";
      return {
        metrics: numericField ? [{ field: numericField }] : [],
        mode: "absolute",
        orientation: "horizontal",
        showDelta: false,
      };
    },
  },
  checklist: {
    hasCog: true,
    isConfigured: (c) => Object.keys(c ?? {}).length > 0,
    initDefaults: (fields) => {
      const boolField =
        fields.find((f) => f.type === DataFieldType.Boolean)?.name ??
        "completed";
      return {
        field: boolField,
        labelField: "name",
        sortField: "name",
        sortOrder: "asc",
        showMode: "all",
        limit: 0,
      };
    },
  },
  "view-port": {
    // Phase 2a: the view-port widget finally gets a cog panel.
    hasCog: true,
    isConfigured: (c) => !!c && typeof c === "object" && !!c["viewId"],
    initDefaults: () => ({ viewId: "", viewLabel: "", headerVisible: true }),
  },
  "filter-tabs": {
    hasCog: true,
    isConfigured: (c) => Object.keys(c ?? {}).length > 0,
    initDefaults: (fields) => ({
      field: fields[0]?.name ?? "",
      tabs: [] as unknown[],
      showAll: true,
    }),
  },
  "summary-row": {
    hasCog: true,
    isConfigured: (c) => Object.keys(c ?? {}).length > 0,
    initDefaults: (fields) => ({
      columns: [
        {
          field: fields[0]?.name ?? "*",
          aggregation: "count_total",
          format: "number",
        } satisfies SummaryColumnConfig,
      ],
    }),
  },
  "data-list": {
    hasCog: true,
    isConfigured: (c) => !!c && typeof c === "object" && Array.isArray((c as { fields?: unknown }).fields),
    initDefaults: (fields) => ({
      titleField: "",
      fields: fields.slice(0, 3).map((f) => f.name),
      sortField: "",
      sortOrder: "asc",
      limit: 0,
    }),
  },
  "sub-base-canvas": {
    hasCog: true,
    isConfigured: (c) =>
      !!c && typeof c === "object" && Array.isArray((c as { subBases?: unknown }).subBases),
    initDefaults: (fields) => ({
      subBases: [],
      titleField: "",
      fields: fields.slice(0, 2).map((f) => f.name),
      limit: 0,
    }),
  },
  "yaml-visualizer": {
    // Properties widget owns its own toolbar (sort/show/hide/layout); no host cog.
    hasCog: false,
    isConfigured: () => true,
    initDefaults: () => ({}),
  },
  "database-call": {
    // NPLAN-V7.1: cog opens DatabaseCallSettings (source picker).
    hasCog: true,
    isConfigured: () => true,
    initDefaults: () => ({
      viewTabs: [
        {
          id: `tab-${Date.now()}`,
          label: "Table",
          viewType: "table",
          config: {},
        },
      ],
      activeTabId: `tab-${Date.now()}`,
    }),
  },
  timeline: {
    hasCog: true,
    isConfigured: (c) =>
      !!c && typeof c === "object" && "startField" in c && !!(c as { startField?: string }).startField,
    initDefaults: (fields) => {
      const dateField =
        fields.find((f) => f.type === DataFieldType.Date)?.name ??
        fields[0]?.name ??
        "";
      return { startField: dateField, endField: dateField, labelField: "", zoom: "month" };
    },
  },
  "cover-banner": {
    hasCog: true,
    isConfigured: (c) =>
      !!c && typeof c === "object" && typeof (c as { src?: unknown }).src === "string" && !!(c as { src?: string }).src,
    initDefaults: () => ({
      src: "",
      widthMode: "full",
      fitStyle: "cover",
      position: "center",
    }),
  },
  text: {
    // Content is edited inline (click-to-edit); no external cog panel.
    hasCog: false,
    isConfigured: () => true,
    initDefaults: () => ({ content: "" }),
  },
  divider: {
    // Label is edited inline; no external cog panel.
    hasCog: false,
    isConfigured: () => true,
    initDefaults: () => ({ label: "" }),
  },
} as const satisfies Record<WidgetType, ConfigPanelDescriptor>;

export const configPanelRegistry: Record<WidgetType, ConfigPanelDescriptor> =
  PANELS;

export function getConfigPanel(type: WidgetType): ConfigPanelDescriptor {
  return configPanelRegistry[type];
}

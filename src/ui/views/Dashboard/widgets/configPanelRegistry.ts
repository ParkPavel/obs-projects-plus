import type { DataField } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { WidgetType, ChartConfig, StatsConfig } from "../types";

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
  "filter-tabs": {
    hasCog: true,
    isConfigured: (c) => Object.keys(c ?? {}).length > 0,
    initDefaults: (fields) => ({
      field: fields[0]?.name ?? "",
      tabs: [] as unknown[],
      showAll: true,
    }),
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
} as const satisfies Partial<Record<WidgetType, ConfigPanelDescriptor>>;

/**
 * #120 — descriptor for a type that owns no config panel: the retired legacy
 * types, which render `LegacyWidgetPlaceholder` instead of content.
 *
 * They used to carry full entries above, but those were unreachable: the cog is
 * gated on `WIDGET_PANELS[type]` existing (WidgetHost), and no retired type has
 * a panel component — so `hasCog`, `isConfigured` and `initDefaults` were dead
 * weight that still had to be maintained. Keeping the *lookup* total, rather
 * than the table, is what actually protects the caller.
 */
const NO_PANEL: ConfigPanelDescriptor = {
  hasCog: false,
  isConfigured: () => true,
  initDefaults: () => ({}),
};

export const configPanelRegistry: Partial<Record<WidgetType, ConfigPanelDescriptor>> =
  PANELS;

/** Total over `WidgetType`: a type without an entry gets {@link NO_PANEL}. */
export function getConfigPanel(type: WidgetType): ConfigPanelDescriptor {
  return configPanelRegistry[type] ?? NO_PANEL;
}

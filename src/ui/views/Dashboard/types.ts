import type { TransformPipeline } from "./engine/transformTypes";
import type { FilterOperator, FilterDefinition } from "src/settings/base/settings";
import type { DataSource } from "src/settings/v3/settings";

// ── Widget Types ──────────────────────────────────────────────

export type WidgetType =
  | "data-table"
  | "chart"
  | "stats"
  | "comparison"
  | "checklist"
  | "view-port"
  | "filter-tabs"
  | "summary-row"
  | "data-list"
  | "sub-base-canvas"
  | "yaml-visualizer"
  /**
   * Dashboard V2 (DG-2) — independent database-call block.
   *
   * Unlike legacy widgets which share a single project-level frame,
   * database-call owns its source (folder/tag/dataview) and renders
   * multiple view tabs (Table/Board/Calendar/...) inside one block.
   * Each block is a self-contained query → display pipeline.
   */
  | "database-call"
  | "timeline"
  | "cover-banner"
  /** C8 — static content widgets (no data source, no pipeline). */
  | "text"
  | "divider";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  /**
   * Dashboard V2 (DG-1): when true, drag/resize callbacks are disabled
   * for this widget. Default false.
   */
  locked?: boolean;
  /**
   * Dashboard V2 (DG-1): explicit stacking order on free-placement
   * canvas. Auto-placed widgets ignore this; free-positioned widgets
   * use it to resolve overlap order.
   */
  zIndex?: number;
}

/**
 * Per-widget data source override (NPLAN-V7.1).
 *
 * When present on a `database-call` widget, the widget loads its frame from
 * the specified project rather than inheriting the canvas's parent frame.
 * Empty `projectId` string is treated as "inherit from parent view".
 */
export interface WidgetSourceConfig {
  readonly projectId: string;
}

export interface WidgetDefinition {
  readonly id: string;
  readonly type: WidgetType;
  readonly title: string;
  readonly layout: WidgetLayout;
  readonly config: Record<string, unknown>;
  readonly collapsed?: boolean;
  readonly transform?: TransformPipeline;
  /** NPLAN-V7.1: optional independent data source for `database-call` widgets. */
  readonly sourceConfig?: WidgetSourceConfig;
}

// ── Database-Call Context (DG-2) ─────────────────────────────

/**
 * Dashboard V2 — data context for `database-call` widgets.
 *
 * Unlike legacy widgets which inherit a shared project frame,
 * database-call blocks own their source (folder/tag/dataview) and
 * render multiple view tabs inside one block. Each tab persists its
 * own config (sort/filter/group/etc.) without leaking into siblings.
 */
export interface WidgetDataContext {
  /** Independent data source — folder, tag, or Dataview query. */
  readonly sourceConfig: DataSource;
  /**
   * Optional global filter layered on top of source results. Applied
   * before per-tab filters (so tabs can further narrow, not widen).
   */
  readonly subFilter?: FilterDefinition;
  /** View tabs (Table/Board/Calendar/...) rendered inside this block. */
  readonly viewTabs: ViewTab[];
}

/**
 * Single view tab inside a database-call block. Stores view type +
 * per-view settings (columns, groupBy, filters, etc.) so switching
 * tabs doesn't lose state.
 */
export interface ViewTab {
  readonly id: string;
  readonly label: string;
  readonly viewType:
    | "table"
    | "board"
    | "calendar"
    | "gallery"
    | "list"
    | "timeline"
    | "chart"
    | "stats";
  /** View-specific settings (DataTableConfig | BoardConfig | ...). */
  readonly config: Record<string, unknown>;
}

// ── DataTable Config ──────────────────────────────────────────

export interface DataTableFieldConfig {
  readonly [key: string]: {
    /**
     * @deprecated since Phase 3 — use `widthRem` for Zero-Pixels
     * compliance. Legacy px value kept for backward compatibility with
     * pre-v3.5.0 settings; migrated lazily on first read.
     */
    readonly width?: number;
    /** Column width in `rem` — survives root-font-size changes. */
    readonly widthRem?: number;
    readonly hide?: boolean;
    readonly pinned?: boolean;
  };
}

export interface GroupConfig {
  readonly field: string;
  readonly sortOrder: "asc" | "desc" | "manual";
  readonly hiddenGroups: string[];
  readonly collapsedGroups: string[];
  readonly showEmptyGroups: boolean;
  /** Optional second-level grouping field */
  readonly subGroupField?: string;
  readonly subGroupSortOrder?: "asc" | "desc" | "manual";
  /**
   * #045.6 — Group-by display strategy.
   * - `"values"` (default): one column per unique field value (existing
   *   behaviour, identical to Notion's default group-by).
   * - `"semantic"`: 3-tier bucket overlay using `statusGroups` below.
   *   Records whose value matches a bucket roll into that bucket; the
   *   rest fall through to a transient "No Status" group. Matches the
   *   Board view's `groupMode === "semantic"` so a Status field
   *   behaves the same whether viewed in DataTable or Board.
   */
  readonly mode?: "values" | "semantic";
  /**
   * #045.6 — Snapshot of the field's `statusGroups` taken from
   * `FieldConfig`. Passed in by the widget so `groupRecords` stays a
   * pure function with no `ProjectDefinition` dependency. Ignored
   * unless `mode === "semantic"`.
   */
  readonly statusGroups?: {
    readonly todo?: ReadonlyArray<string>;
    readonly inProgress?: ReadonlyArray<string>;
    readonly complete?: ReadonlyArray<string>;
  };
  /**
   * #045.6 — Localised semantic labels (To Do / In Progress / Done /
   * No Status). Optional — falls back to English when omitted so the
   * pure module can be exercised without an i18n store hookup.
   */
  readonly semanticLabels?: {
    readonly todo?: string;
    readonly inProgress?: string;
    readonly complete?: string;
    readonly none?: string;
  };
}

export interface ConditionalFormatRule {
  readonly operator: FilterOperator;
  readonly value?: string;
  readonly style: CellStyle;
}

export interface CellStyle {
  readonly backgroundColor?: string;
  readonly textColor?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export interface ConditionalFormat {
  readonly id: string;
  readonly field: string;
  readonly conditions: ConditionalFormatRule[];
}

export interface DataTableConfig {
  readonly fieldConfig?: DataTableFieldConfig;
  readonly sortField?: string;
  readonly sortAsc?: boolean;
  readonly sortCriteria?: DataTableSortCriteria[];
  readonly orderFields?: string[];
  readonly aggregations?: AggregationConfig;
  readonly showAggregationRow?: boolean;
  readonly groupBy?: GroupConfig;
  readonly freezeUpTo?: string;
  readonly conditionalFormats?: ConditionalFormat[];
  readonly rowHeight?: "compact" | "default" | "expanded";
  readonly wrapText?: boolean;
  /** S8 — When true, columns where every record has an empty/null value are hidden. */
  readonly hideEmptyFields?: boolean;
  /** NPLAN-D2 — page-level icon field rendered in the row header. */
  readonly iconField?: string;
  /** Default property values applied when creating a new record */
  readonly defaultValues?: Record<string, string>;
  /** User dismissed the "right-click header" discoverability hint */
  readonly hintDismissed?: boolean;
  /**
   * R2.2 — sub-bases of this Database view. Each entry partitions the
   * widget's frame by its own filter/sort, rendered as a tabbed
   * multi-table when length > 0. Stored as plain JSON-friendly objects
   * so settings round-trip via `processFrontMatter` / settings.json.
   */
  readonly subBases?: import("src/lib/database/subBase").SubBaseDefinition[];
  /** Currently active sub-base id; missing → first one. */
  readonly activeSubBaseId?: string;
}

/** Per-widget multi-key sort criterion (stored in DataTableConfig) */
export interface DataTableSortCriteria {
  readonly field: string;
  readonly order: "asc" | "desc";
}

// ── Aggregation (footer) ─────────────────────────────────────

export type ColumnAggregation =
  | "none"
  | "count"
  | "count_total"
  | "count_values"
  | "count_unique"
  | "sum"
  | "avg"
  | "median"
  | "min"
  | "max"
  | "range"
  | "count_checked"
  | "count_unchecked"
  | "percent_checked"
  | "percent_unchecked"
  | "percent_empty"
  | "percent_not_empty"
  | "earliest"
  | "latest"
  | "date_range";

export interface AggregationConfig {
  readonly [fieldName: string]: ColumnAggregation;
}

export interface AggregationResult {
  readonly [fieldName: string]: {
    readonly function: ColumnAggregation;
    readonly value: string | number | null;
    readonly formattedValue: string;
  };
}

// ── Database View Config ─────────────────────────────────────

export interface FormulaFieldDef {
  readonly name: string;
  readonly expression: string;
  readonly resultType?: "string" | "number" | "date" | "boolean";
}

export interface ApplyTemplateQuickAction {
  readonly id: string;
  readonly label: string;
  readonly labelKey?: string;
  readonly kind: "apply-template";
  readonly templateId: string;
}

export interface ToggleFormulaQuickAction {
  readonly id: string;
  readonly label: string;
  readonly labelKey?: string;
  readonly kind: "toggle-formula-bar";
}

export type QuickActionConfig = ApplyTemplateQuickAction | ToggleFormulaQuickAction;

export interface DatabaseViewConfig {
  readonly widgets: WidgetDefinition[];
  readonly layoutMode: "free" | "stack";
  readonly layoutVersion: number;
  readonly table: DataTableConfig;
  readonly showWidgetToolbar: boolean;
  readonly compactMode: boolean;
  readonly formulaFields?: FormulaFieldDef[];
  readonly quickActions?: QuickActionConfig[];
  /**
   * User-saved column-layout snapshots for the DataTable inside this view.
   * Phase 2b — a preset captures only field-scoped state (visibility,
   * order, width, pinning, sort, freeze, group-by). It intentionally does
   * NOT carry `view.filter` or `config.widgets` — those are view-level
   * concerns owned elsewhere. Applying a preset mutates only
   * `config.table` and `activeFieldPresetId`.
   */
  readonly fieldPresets?: FieldPreset[];
  readonly activeFieldPresetId?: string;
}

// ── Field Preset ─────────────────────────────────────────────

/**
 * Phase 2b — a user-saved snapshot of a DataTable column layout within a
 * single Database view. Presets are scoped to `config.table`; they do not
 * touch filter, widgets, or anything outside the DataTable.
 */
export interface FieldPreset {
  readonly id: string;
  readonly label: string;
  /** Snapshot of per-column state (hide/pinned/width). */
  readonly fieldConfig?: DataTableFieldConfig;
  /** Column order snapshot. */
  readonly orderFields?: string[];
  /** Multi-key sort snapshot. */
  readonly sortCriteria?: DataTableSortCriteria[];
  /** Freeze-up-to field snapshot. */
  readonly freezeUpTo?: string;
  /** Group-by snapshot. */
  readonly groupBy?: GroupConfig;
  /** Row-height mode snapshot. */
  readonly rowHeight?: "compact" | "default" | "expanded";
  /** Wrap-text toggle snapshot. */
  readonly wrapText?: boolean;
}

// ── Chart Types ──────────────────────────────────────────────

export type ChartType =
  | "bar"
  | "horizontal-bar"
  | "stacked-bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "number"
  | "progress"
  | "scatter";

export interface ChartConfig {
  readonly chartType: ChartType;
  readonly xAxis: ChartAxisX;
  readonly yAxis: ChartAxisY;
  readonly style: ChartStyle;
}

export interface ChartAxisX {
  readonly property: string;
  readonly sortBy: "value" | "label" | "manual";
  readonly sortOrder: "asc" | "desc";
  readonly omitZero: boolean;
  readonly hiddenGroups?: string[];
}

export interface ChartAxisY {
  readonly property: string | "count";
  readonly aggregation: ColumnAggregation;
  readonly groupBy?: string;
  readonly cumulative?: boolean;
}

export interface ChartStyle {
  readonly colorScheme: "auto" | "accent" | "categorical" | "sequential";
  readonly height: "small" | "medium" | "large";
  readonly showGrid: boolean;
  readonly showLabels: boolean;
  readonly showLegend: boolean;
  readonly showValues: boolean;
  readonly smooth?: boolean;
  readonly gradient?: boolean;
  readonly showCenter?: boolean;
}

/** Normalized data for chart rendering */
export interface ChartData {
  readonly labels: string[];
  readonly series: ChartSeries[];
}

export interface ChartSeries {
  readonly name: string;
  readonly values: (number | null)[];
  readonly color?: string;
}

// ── Stats Types ──────────────────────────────────────────────

export interface StatsConfig {
  readonly cards: StatsCardConfig[];
  readonly columns: 2 | 3 | 4;
}

export interface StatsCardConfig {
  readonly id: string;
  readonly label: string;
  readonly field: string;
  readonly aggregation: ColumnAggregation;
  readonly format?: "number" | "percent" | "currency" | "duration";
  readonly currencySymbol?: string;
  readonly showTrend?: boolean;
  readonly color?: string;
  readonly sparkline?: boolean;
}

// ── Scatter Chart Config ─────────────────────────────────────

export interface ScatterChartConfig {
  readonly xAxis: { readonly field: string };
  readonly yAxis: { readonly field: string };
  readonly colorBy?: string;
  readonly sizeBy?: string;
  readonly showTrendLine: boolean;
  readonly showR2: boolean;
  readonly pointRadius: number;
  readonly opacity: number;
  /**
   * Optional cross-source correlation (Pillar 5).
   * When set, the scatter takes X from the primary frame and Y from the
   * right-hand frame, joined on `correlation.on`.
   */
  readonly correlation?: {
    readonly rightSourceId: string;
    readonly on: { readonly leftKey: string; readonly rightKey: string };
  };
}

// ── Scatter Data ─────────────────────────────────────────────

export interface ScatterPoint {
  readonly x: number;
  readonly y: number;
  readonly label?: string;
  readonly group?: string;
  readonly size?: number;
}

export interface ScatterData {
  readonly points: ScatterPoint[];
  readonly trendLine?: { readonly slope: number; readonly intercept: number };
  readonly r2?: number;
  /**
   * Populated only when `config.correlation` was active during compute.
   * Exposes left/right record counts and how many left records found a
   * matching right-frame row, so UI can surface "0 matches" / "mostly
   * unmatched" warnings instead of silently rendering an empty chart.
   */
  readonly correlationStats?: {
    readonly leftCount: number;
    readonly rightCount: number;
    readonly matched: number;
  };
}

// ── Comparison Config ────────────────────────────────────────

export interface ComparisonMetric {
  readonly field: string;
  readonly label?: string;
  readonly color?: string;
}

export interface ComparisonConfig {
  readonly metrics: ComparisonMetric[];
  readonly mode: "absolute" | "percentage" | "normalized";
  readonly orientation: "horizontal" | "vertical";
  readonly showDelta: boolean;
}

// ── FilterTabs Config ────────────────────────────────────────

export interface FilterTabConfig {
  readonly id: string;
  readonly label: string;
  readonly field: string;
  readonly value: string;
}

export interface FilterTabsConfig {
  readonly tabs: FilterTabConfig[];
  readonly field: string;
  readonly showAll: boolean;
}

// ── SummaryRow Config ────────────────────────────────────────

export interface SummaryColumnConfig {
  readonly field: string;
  readonly aggregation: ColumnAggregation;
  readonly format?: "number" | "percent" | "currency";
  readonly currencySymbol?: string;
}

export interface SummaryRowConfig {
  readonly columns: SummaryColumnConfig[];
}

// ── DataList Config ──────────────────────────────────────────

/** MPLAN-008 — Minimalist list view rendering one row per record:
 * a title plus a small set of secondary fields shown inline. Reuses
 * the Dashboard pipeline (filter / sort / pipelineSteps) — it is the
 * render layer that differs from `DataTableWidget`. */
export interface DataListConfig {
  /** Field used as the row title (note name when empty). */
  readonly titleField?: string;
  /** Inline secondary fields rendered after the title. */
  readonly fields: string[];
  /** Soft cap on rendered rows; 0 = no limit. */
  readonly limit?: number;
  /** Optional sort field; falls back to title order when omitted. */
  readonly sortField?: string;
  readonly sortOrder?: "asc" | "desc";
}

// ── SubBaseCanvas Config ──────────────────────────────────────

/** R5-009 — Standalone sub-base widget. Renders a tab strip of
 * sub-base partitions; the active tab shows its filtered records as
 * a list (titleField + secondary fields). Sub-base definitions are
 * stored on the widget itself, decoupled from any DataTable widget. */
export interface SubBaseCanvasConfig {
  readonly subBases: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly filter: import("src/settings/base/settings").FilterDefinition;
  }>;
  readonly activeSubBaseId?: string;
  readonly titleField?: string;
  readonly fields: string[];
  readonly limit?: number;
  /**
   * R5-010 inverse mode: when both fields are set, the widget shows source
   * records that reference `inverseTargetId` via `inverseRelationField`,
   * partitioned by SubBase filters instead of showing the raw source frame.
   *
   * Use case: "all tasks referencing this project, grouped by status SubBase".
   * The target record is looked up from the `source` DataFrame by its id.
   */
  readonly inverseTargetId?: string;
  readonly inverseRelationField?: string;
}

// ── Timeline Config ───────────────────────────────────────────

/** S5 — Gantt/Timeline widget. Renders records as horizontal bars on a
 * shared time axis. Uses the 4-param date model (startDate/startTime/endDate/endTime). */
export interface TimelineConfig {
  /** Field supplying bar start (Date or String YYYY-MM-DD). */
  readonly startField: string;
  /** Field supplying bar end. If omitted, bar is a single-day marker. */
  readonly endField?: string;
  /** Field used as the row label. Defaults to record id/name. */
  readonly labelField?: string;
  /** Optional field to colour-code bars (Select/Status/String). */
  readonly colorField?: string;
  /** Time axis zoom level. */
  readonly zoom: "day" | "week" | "month" | "quarter" | "year";
  /** ISO date string for the left edge of the visible window (default today-7d). */
  readonly windowStart?: string;
}

// ── Cover Banner Config (D2-cover) ───────────────────────────

/** NPLAN-D2 cover — Hero/banner block placed inside the Dashboard canvas
 *  alongside other widgets. Not a per-record cover image. */
export interface CoverBannerConfig {
  /** Vault-relative path or external URL of the image. */
  readonly src: string;
  /** Width preset; `custom` uses `widthRem`. Layout grid still controls span. */
  readonly widthMode?: "full" | "half" | "custom";
  /** Custom width in rem when `widthMode === "custom"`. */
  readonly widthRem?: number;
  /** Image fit inside the banner box. */
  readonly fitStyle?: "cover" | "contain";
  /** Vertical alignment of the image inside the box. */
  readonly position?: "top" | "center" | "bottom";
  /** Optional overlay caption rendered on top of the image. */
  readonly overlay?: string;
}

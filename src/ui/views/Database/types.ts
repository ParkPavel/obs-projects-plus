import type { TransformPipeline } from "./engine/transformTypes";
import type { FilterOperator } from "src/settings/base/settings";

// ── Widget Types ──────────────────────────────────────────────

export type WidgetType =
  | "data-table"
  | "chart"
  | "stats"
  | "comparison"
  | "checklist"
  | "view-port"
  | "filter-tabs"
  | "summary-row";

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface WidgetDefinition {
  readonly id: string;
  readonly type: WidgetType;
  readonly title: string;
  readonly layout: WidgetLayout;
  readonly config: Record<string, unknown>;
  readonly collapsed?: boolean;
  readonly transform?: TransformPipeline;
}

// ── DataTable Config ──────────────────────────────────────────

export interface DataTableFieldConfig {
  readonly [key: string]: {
    readonly width?: number;
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
  /** Default property values applied when creating a new record */
  readonly defaultValues?: Record<string, string>;
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

export interface DatabaseViewConfig {
  readonly widgets: WidgetDefinition[];
  readonly layoutMode: "free" | "stack";
  readonly layoutVersion: number;
  readonly table: DataTableConfig;
  readonly showWidgetToolbar: boolean;
  readonly compactMode: boolean;
  readonly formulaFields?: FormulaFieldDef[];
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

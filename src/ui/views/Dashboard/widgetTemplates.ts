/**
 * Widget Templates — pre-configured widget layouts for common use cases.
 *
 * Each template provides a set of WidgetDefinitions that can be applied
 * to a DatabaseViewConfig to quickly set up a dashboard.
 */

import type { WidgetDefinition } from "./types";

export interface WidgetTemplate {
  readonly id: string;
  readonly label: string;
  readonly labelKey: string;
  readonly description: string;
  readonly descriptionKey: string;
  readonly widgets: WidgetDefinition[];
  /**
   * Marks this template as an "industry vertical" — a domain-specific
   * dashboard preset (Fitness / Finance / CRM, ...). Vertical templates
   * are surfaced in the Database view's VerticalSwitcher toolbar as
   * first-class one-click presets, separate from the generic template
   * dropdown used for ad-hoc scaffolding.
   */
  readonly isVertical?: boolean;
  /**
   * Optional icon glyph for the VerticalSwitcher tab. Falls back to a
   * generic icon when not set.
   */
  readonly icon?: string;
}

let nextId = 1;
function wid(): string {
  return `tpl-${nextId++}`;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: "database-v2-starter",
    label: "Database V2",
    labelKey: "views.dashboard.templates.database-v2-starter",
    description: "V2 dashboard: KPI stats + multi-view database block (Table / Board / Calendar / Gallery)",
    descriptionKey: "views.dashboard.templates.database-v2-starter-desc",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "KPI",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            { id: "s1", label: "Records",      field: "name",      aggregation: "count" },
            { id: "s2", label: "Open",         field: "completed", aggregation: "count_unchecked", format: "number" },
            { id: "s3", label: "Avg Progress", field: "progress",  aggregation: "avg", format: "percent" },
          ],
          columns: 3,
        },
      },
      {
        id: wid(),
        type: "database-call",
        title: "Records",
        layout: { x: 0, y: 2, w: 12, h: 8 },
        config: { activeTab: "table" },
      },
    ],
  },
  {
    id: "overview-finance",
    label: "Overview Finance",
    labelKey: "views.dashboard.templates.overview-finance",
    description: "Quick finance overview with KPI, summary, chart and table",
    descriptionKey: "views.dashboard.templates.overview-finance-desc",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "Finance KPI",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            { id: "f1", label: "Records", field: "name", aggregation: "count" },
            { id: "f2", label: "Open", field: "completed", aggregation: "count_unchecked", format: "number" },
            { id: "f3", label: "Avg Progress", field: "progress", aggregation: "avg", format: "percent" },
          ],
          columns: 3,
        },
      },
      {
        id: wid(),
        type: "summary-row",
        title: "Summary",
        layout: { x: 0, y: 2, w: 12, h: 1 },
        config: {
          columns: [
            { field: "estimate", aggregation: "sum", format: "number" },
            { field: "progress", aggregation: "avg", format: "percent" },
            { field: "name", aggregation: "count", format: "number" },
          ],
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "By Category",
        layout: { x: 0, y: 3, w: 6, h: 4 },
        config: {
          chartType: "bar",
          xAxis: { property: "category", sortBy: "value", sortOrder: "desc", omitZero: true },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "categorical",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "data-table",
        title: "Journal",
        layout: { x: 6, y: 3, w: 6, h: 4 },
        config: {},
      },
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    labelKey: "views.dashboard.templates.dashboard",
    description: "Stats overview + chart + data table",
    descriptionKey: "views.dashboard.templates.dashboard-desc",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "Key Metrics",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            { id: "c1", label: "Total", field: "name", aggregation: "count" },
            { id: "c2", label: "Open", field: "completed", aggregation: "count_unchecked" },
            { id: "c3", label: "Average", field: "progress", aggregation: "avg", format: "percent" },
          ],
          columns: 3,
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Overview Chart",
        layout: { x: 0, y: 2, w: 6, h: 4 },
        config: {
          chartType: "bar",
          xAxis: { property: "status", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "auto",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "data-table",
        title: "Data",
        layout: { x: 6, y: 2, w: 6, h: 4 },
        config: {},
      },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    labelKey: "views.dashboard.templates.analytics",
    description: "Multiple charts for data analysis",
    descriptionKey: "views.dashboard.templates.analytics-desc",
    widgets: [
      {
        id: wid(),
        type: "chart",
        title: "Distribution",
        layout: { x: 0, y: 0, w: 6, h: 4 },
        config: {
          chartType: "pie",
          xAxis: { property: "status", sortBy: "value", sortOrder: "desc", omitZero: true },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "categorical",
            height: "medium",
            showGrid: false,
            showLabels: true,
            showLegend: true,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Trend",
        layout: { x: 6, y: 0, w: 6, h: 4 },
        config: {
          chartType: "line",
          xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "auto",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: false,
            smooth: true,
          },
        },
      },
      {
        id: wid(),
        type: "comparison",
        title: "Comparison",
        layout: { x: 0, y: 4, w: 6, h: 3 },
        config: {},
      },
      {
        id: wid(),
        type: "stats",
        title: "Summary",
        layout: { x: 6, y: 4, w: 6, h: 3 },
        config: {
          cards: [
            { id: "c1", label: "Total", field: "name", aggregation: "count" },
            { id: "c2", label: "Completed", field: "completed", aggregation: "count_checked" },
          ],
          columns: 2,
        },
      },
    ],
  },
  {
    id: "kanban-plus",
    label: "Kanban+",
    labelKey: "views.dashboard.templates.kanban-plus",
    description: "Data table + checklist + progress tracker",
    descriptionKey: "views.dashboard.templates.kanban-plus-desc",
    widgets: [
      {
        id: wid(),
        type: "data-table",
        title: "Tasks",
        layout: { x: 0, y: 0, w: 8, h: 6 },
        config: {},
      },
      {
        id: wid(),
        type: "checklist",
        title: "Checklist",
        layout: { x: 8, y: 0, w: 4, h: 3 },
        config: { field: "completed" },
      },
      {
        id: wid(),
        type: "chart",
        title: "Status Split",
        layout: { x: 8, y: 3, w: 4, h: 3 },
        config: {
          chartType: "donut",
          xAxis: { property: "status", sortBy: "value", sortOrder: "desc", omitZero: true },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "categorical",
            height: "small",
            showGrid: false,
            showLabels: true,
            showLegend: true,
            showValues: true,
          },
        },
      },
    ],
  },
  // ── Vertical: Fitness / Gym — demonstrates nested data unnest ──────────
  // Notes contain `sets: [{reps, weight, restSec}, ...]` arrays in frontmatter.
  // Unnest pipeline expands each set into its own row so charts can plot
  // weight progression and count total volume across workouts.
  {
    id: "fitness-workout",
    label: "Fitness — Workout Log",
    labelKey: "views.dashboard.templates.fitness-workout",
    description: "Workout notes with nested sets[]: reps, weight, rest. Uses Unnest pipeline + volume stats.",
    descriptionKey: "views.dashboard.templates.fitness-workout-desc",
    isVertical: true,
    icon: "🏋️",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "Workout KPI",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        transform: { steps: [{ type: "unnest", field: "sets" }] },
        config: {
          cards: [
            { id: "g1", label: "Total sets", field: "reps", aggregation: "count" },
            { id: "g2", label: "Total reps", field: "reps", aggregation: "sum", format: "number" },
            { id: "g3", label: "Avg weight", field: "weight", aggregation: "avg", format: "number" },
            { id: "g4", label: "Max weight", field: "weight", aggregation: "max", format: "number" },
          ],
          columns: 4,
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Weight progression",
        layout: { x: 0, y: 2, w: 8, h: 4 },
        transform: { steps: [{ type: "unnest", field: "sets" }] },
        config: {
          chartType: "line",
          xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "weight", aggregation: "max" },
          style: {
            colorScheme: "auto",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: false,
            smooth: true,
          },
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Exercise split",
        layout: { x: 8, y: 2, w: 4, h: 4 },
        config: {
          chartType: "donut",
          xAxis: { property: "exercise", sortBy: "value", sortOrder: "desc", omitZero: true },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "categorical",
            height: "small",
            showGrid: false,
            showLabels: true,
            showLegend: true,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "data-table",
        title: "Workouts",
        layout: { x: 0, y: 6, w: 12, h: 6 },
        config: {},
      },
    ],
  },
  // ── Vertical: Finance / Accounting — tax, rate, credit line ────────────
  {
    id: "finance-accounting",
    label: "Finance — Accounting",
    labelKey: "views.dashboard.templates.finance-accounting",
    description: "Multi-currency dashboard: gross, tax, net with FX rates and credit line tracking.",
    descriptionKey: "views.dashboard.templates.finance-accounting-desc",
    isVertical: true,
    icon: "💰",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "Financial KPI",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            { id: "fa1", label: "Gross", field: "amount", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { id: "fa2", label: "Tax", field: "tax", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { id: "fa3", label: "Net", field: "net", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { id: "fa4", label: "Credit used", field: "creditLine", aggregation: "sum", format: "percent" },
          ],
          columns: 4,
        },
      },
      {
        id: wid(),
        type: "comparison",
        title: "Gross vs Net",
        layout: { x: 0, y: 2, w: 6, h: 3 },
        config: {
          metrics: [
            { field: "amount", label: "Gross" },
            { field: "net", label: "Net" },
          ],
          mode: "absolute",
          orientation: "horizontal",
          showDelta: true,
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Monthly trend",
        layout: { x: 6, y: 2, w: 6, h: 3 },
        config: {
          chartType: "bar",
          xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "net", aggregation: "sum" },
          style: {
            colorScheme: "auto",
            height: "small",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "summary-row",
        title: "Totals",
        layout: { x: 0, y: 5, w: 12, h: 1 },
        config: {
          columns: [
            { field: "amount", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { field: "tax", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { field: "net", aggregation: "sum", format: "currency", currencySymbol: "$" },
            { field: "rate", aggregation: "avg", format: "number" },
          ],
        },
      },
      {
        id: wid(),
        type: "data-table",
        title: "Transactions",
        layout: { x: 0, y: 6, w: 12, h: 6 },
        config: {},
      },
    ],
  },
  // ── Vertical: CRM / Clients — sessions history ─────────────────────────
  {
    id: "crm-clients",
    label: "CRM — Clients",
    labelKey: "views.dashboard.templates.crm-clients",
    description: "Clients roster with session history, filter tabs by stage, and conversion funnel.",
    descriptionKey: "views.dashboard.templates.crm-clients-desc",
    isVertical: true,
    icon: "👥",
    widgets: [
      {
        id: wid(),
        type: "filter-tabs",
        title: "By stage",
        layout: { x: 0, y: 0, w: 12, h: 1 },
        config: {
          field: "stage",
          showAll: true,
          tabs: [],
        },
      },
      {
        id: wid(),
        type: "stats",
        title: "Pipeline KPI",
        layout: { x: 0, y: 1, w: 12, h: 2 },
        config: {
          cards: [
            { id: "c1", label: "Clients", field: "name", aggregation: "count" },
            { id: "c2", label: "Active", field: "active", aggregation: "count_checked" },
            { id: "c3", label: "Avg sessions", field: "sessionsCount", aggregation: "avg", format: "number" },
            { id: "c4", label: "MRR", field: "mrr", aggregation: "sum", format: "currency", currencySymbol: "$" },
          ],
          columns: 4,
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Conversion funnel",
        layout: { x: 0, y: 3, w: 6, h: 4 },
        config: {
          chartType: "horizontal-bar",
          xAxis: { property: "stage", sortBy: "value", sortOrder: "desc", omitZero: true },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "categorical",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: true,
          },
        },
      },
      {
        id: wid(),
        type: "chart",
        title: "Session volume (unnested)",
        layout: { x: 6, y: 3, w: 6, h: 4 },
        transform: { steps: [{ type: "unnest", field: "sessions" }] },
        config: {
          chartType: "line",
          xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "duration", aggregation: "sum" },
          style: {
            colorScheme: "auto",
            height: "medium",
            showGrid: true,
            showLabels: true,
            showLegend: false,
            showValues: false,
            smooth: true,
          },
        },
      },
      {
        id: wid(),
        type: "data-table",
        title: "Clients",
        layout: { x: 0, y: 7, w: 12, h: 6 },
        config: {},
      },
    ],
  },
];

/**
 * Get a template by ID.
 */
export function getWidgetTemplate(id: string): WidgetTemplate | undefined {
  return WIDGET_TEMPLATES.find((t) => t.id === id);
}

/**
 * Return templates flagged as industry verticals (Fitness / Finance / CRM ...).
 * Used by the Database view's VerticalSwitcher toolbar to expose one-click
 * preset tabs. Order of declaration in WIDGET_TEMPLATES is preserved.
 */
export function getVerticalTemplates(): WidgetTemplate[] {
  return WIDGET_TEMPLATES.filter((t) => t.isVertical === true);
}

/**
 * Apply a template — returns fresh widget definitions with new unique IDs.
 */
export function applyWidgetTemplate(templateId: string): WidgetDefinition[] | null {
  const template = getWidgetTemplate(templateId);
  if (!template) return null;

  let counter = Date.now();
  return template.widgets.map((w) => ({
    ...w,
    id: `w-${counter++}`,
  }));
}


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
}

let nextId = 1;
function wid(): string {
  return `tpl-${nextId++}`;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    labelKey: "views.database.templates.dashboard",
    description: "Stats overview + chart + data table",
    descriptionKey: "views.database.templates.dashboard-desc",
    widgets: [
      {
        id: wid(),
        type: "stats",
        title: "Key Metrics",
        layout: { x: 0, y: 0, w: 12, h: 2 },
        config: {
          cards: [
            { id: "c1", label: "Total", field: "name", aggregation: "count" },
            { id: "c2", label: "Sum", field: "value", aggregation: "sum" },
            { id: "c3", label: "Average", field: "value", aggregation: "avg" },
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
    labelKey: "views.database.templates.analytics",
    description: "Multiple charts for data analysis",
    descriptionKey: "views.database.templates.analytics-desc",
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
            { id: "c2", label: "Completed", field: "done", aggregation: "count_checked" },
          ],
          columns: 2,
        },
      },
    ],
  },
  {
    id: "kanban-plus",
    label: "Kanban+",
    labelKey: "views.database.templates.kanban-plus",
    description: "Data table + checklist + progress tracker",
    descriptionKey: "views.database.templates.kanban-plus-desc",
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
        config: { field: "done" },
      },
      {
        id: wid(),
        type: "chart",
        title: "Progress",
        layout: { x: 8, y: 3, w: 4, h: 3 },
        config: {
          chartType: "progress",
          xAxis: { property: "done", sortBy: "label", sortOrder: "asc", omitZero: false },
          yAxis: { property: "count", aggregation: "count" },
          style: {
            colorScheme: "auto",
            height: "small",
            showGrid: false,
            showLabels: true,
            showLegend: false,
            showValues: true,
          },
        },
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

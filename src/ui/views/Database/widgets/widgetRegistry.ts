// src/ui/views/Database/widgets/widgetRegistry.ts
// Central registry mapping WidgetType → metadata (component routing done in WidgetHost.svelte)

import type { WidgetType, WidgetLayout } from "../types";

export interface WidgetMeta {
  readonly type: WidgetType;
  readonly label: string;
  readonly labelKey: string;
  readonly icon: string;
  readonly defaultLayout: WidgetLayout;
  readonly minW: number;
  readonly minH: number;
  readonly maxCount?: number;
}

export const WIDGET_REGISTRY: readonly WidgetMeta[] = [
  {
    type: "data-table",
    label: "Data Table",
    labelKey: "views.database.types.data-table",
    icon: "table",
    defaultLayout: { x: 0, y: 0, w: 12, h: 6 },
    minW: 4,
    minH: 3,
    maxCount: 1,
  },
  {
    type: "chart",
    label: "Chart",
    labelKey: "views.database.types.chart",
    icon: "bar-chart-2",
    defaultLayout: { x: 0, y: 0, w: 6, h: 4 },
    minW: 3,
    minH: 3,
  },
  {
    type: "stats",
    label: "Stats",
    labelKey: "views.database.types.stats",
    icon: "hash",
    defaultLayout: { x: 0, y: 0, w: 6, h: 2 },
    minW: 3,
    minH: 2,
  },
  {
    type: "comparison",
    label: "Comparison",
    labelKey: "views.database.types.comparison",
    icon: "git-compare",
    defaultLayout: { x: 0, y: 0, w: 6, h: 3 },
    minW: 3,
    minH: 2,
  },
  {
    type: "checklist",
    label: "Checklist",
    labelKey: "views.database.types.checklist",
    icon: "check-square",
    defaultLayout: { x: 0, y: 0, w: 4, h: 4 },
    minW: 3,
    minH: 2,
  },
  {
    type: "view-port",
    label: "View Port",
    labelKey: "views.database.types.view-port",
    icon: "layout",
    defaultLayout: { x: 0, y: 0, w: 6, h: 4 },
    minW: 3,
    minH: 3,
    maxCount: 4,
  },
  {
    type: "filter-tabs",
    label: "Filter Tabs",
    labelKey: "views.database.types.filter-tabs",
    icon: "filter",
    defaultLayout: { x: 0, y: 0, w: 12, h: 1 },
    minW: 6,
    minH: 1,
    maxCount: 1,
  },
  {
    type: "summary-row",
    label: "Summary Row",
    labelKey: "views.database.types.summary-row",
    icon: "sigma",
    defaultLayout: { x: 0, y: 0, w: 12, h: 1 },
    minW: 4,
    minH: 1,
    maxCount: 1,
  },
] as const;

export function getWidgetMeta(type: WidgetType): WidgetMeta | undefined {
  return WIDGET_REGISTRY.find((m) => m.type === type);
}

export function canAddWidget(
  type: WidgetType,
  currentWidgets: { type: WidgetType }[]
): boolean {
  const meta = getWidgetMeta(type);
  if (!meta) return false;
  if (meta.maxCount == null) return true;
  const count = currentWidgets.filter((w) => w.type === type).length;
  return count < meta.maxCount;
}

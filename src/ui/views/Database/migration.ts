// src/ui/views/Database/migration.ts

import type { DatabaseViewConfig, DataTableConfig } from "./types";

interface LegacyTableConfig {
  readonly fieldConfig?: Record<
    string,
    { readonly width?: number; readonly hide?: boolean; readonly pinned?: boolean }
  >;
  readonly sortField?: string;
  readonly sortAsc?: boolean;
  readonly orderFields?: string[];
}

function generateId(): string {
  return `widget_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Migrate legacy TableConfig (v3.2.x) → DatabaseViewConfig (v3.3.0).
 * Creates a single DataTable widget with the old table settings.
 */
export function migrateTableConfig(
  old: LegacyTableConfig
): DatabaseViewConfig {
  const tableConfig: DataTableConfig = {
    ...(old.fieldConfig != null && { fieldConfig: old.fieldConfig }),
    ...(old.sortField != null && { sortField: old.sortField }),
    ...(old.sortAsc != null && { sortAsc: old.sortAsc }),
    ...(old.orderFields != null && { orderFields: old.orderFields }),
    aggregations: {},
    showAggregationRow: false,
  };

  return {
    widgets: [
      {
        id: generateId(),
        type: "data-table",
        title: "Table",
        layout: { x: 0, y: 0, w: 12, h: 8 },
        config: {},
        collapsed: false,
      },
    ],
    layoutMode: "stack",
    layoutVersion: 1,
    table: tableConfig,
    showWidgetToolbar: true,
    compactMode: false,
  };
}

/**
 * Check if a config object looks like a legacy TableConfig.
 */
export function isLegacyTableConfig(
  config: Record<string, unknown>
): boolean {
  // DatabaseViewConfig always has 'widgets' array and 'layoutVersion'
  if (Array.isArray(config["widgets"]) && typeof config["layoutVersion"] === "number") {
    return false;
  }
  // LegacyTableConfig has fieldConfig/sortField/orderFields at top level
  return (
    config["fieldConfig"] !== undefined ||
    config["sortField"] !== undefined ||
    config["orderFields"] !== undefined ||
    Object.keys(config).length === 0
  );
}

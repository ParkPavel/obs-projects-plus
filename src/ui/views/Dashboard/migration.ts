// src/ui/views/Dashboard/migration.ts

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
    quickActions: [
      {
        id: "qa-overview",
        label: "Overview Preset",
        labelKey: "views.dashboard.quick.overview",
        kind: "apply-template",
        templateId: "overview-finance",
      },
      {
        id: "qa-formula",
        label: "Formula Builder",
        labelKey: "views.dashboard.quick.formula",
        kind: "toggle-formula-bar",
      },
    ],
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

/**
 * R5-004 — Rename footer aggregation `"count"` → `"count_total"` so its
 * semantic ("total records incl. nulls") no longer collides with the
 * kernel's `count` (non-null). Walks any nested object/array and rewrites:
 *   - `aggregation: "count"`  →  `aggregation: "count_total"`
 *   - `aggregations: { f: "count" }`  →  `{ f: "count_total" }`
 *
 * Idempotent. Pure (returns new value when migration applies, original
 * reference otherwise).
 *
 * Other `"count"` literals — e.g. `ChartAxisY.property === "count"` (the
 * "count records" mode sentinel) and `RollupFunction === "count"` (kernel
 * non-null count) — are NOT touched.
 */
export function migrateAggregationCount<T>(value: T): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((v) => {
      const m = migrateAggregationCount(v);
      if (m !== v) changed = true;
      return m;
    });
    return (changed ? (next as unknown as T) : value);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "aggregation" && v === "count") {
        next[k] = "count_total";
        changed = true;
      } else if (k === "aggregations" && v && typeof v === "object" && !Array.isArray(v)) {
        const inner = v as Record<string, unknown>;
        const innerNext: Record<string, unknown> = {};
        let innerChanged = false;
        for (const [fk, fv] of Object.entries(inner)) {
          if (fv === "count") {
            innerNext[fk] = "count_total";
            innerChanged = true;
          } else {
            innerNext[fk] = fv;
          }
        }
        next[k] = innerChanged ? innerNext : v;
        if (innerChanged) changed = true;
      } else {
        const m = migrateAggregationCount(v);
        next[k] = m;
        if (m !== v) changed = true;
      }
    }
    return (changed ? (next as unknown as T) : value);
  }
  return value;
}

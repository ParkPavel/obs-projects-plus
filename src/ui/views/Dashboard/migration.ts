// src/ui/views/Dashboard/migration.ts

import type {
  DatabaseViewConfig,
  DataTableConfig,
  WidgetDefinition,
} from "./types";
import { migrateTransformToViewLevel } from "./widgets/legacyMigration";

interface LegacyTableConfig {
  readonly fieldConfig?: Record<
    string,
    {
      readonly width?: number;
      readonly hide?: boolean;
      readonly pinned?: boolean;
    }
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
export function migrateTableConfig(old: LegacyTableConfig): DatabaseViewConfig {
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
    // #191 — this list used to open with an `apply-template` action pointing at
    // the `overview-finance` preset. The presets are gone, and a generator that
    // emits a button to a mechanism the tree no longer has is the defect this
    // ticket removes. The row does not empty: the formula toggle is live
    // (`DashboardCanvas` → `showFormulaBar`) and still says "there are actions
    // here", so nothing is replaced to fill a hole.
    quickActions: [
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
 * #191 — remove a stored `apply-template` quick action.
 *
 * The mechanism it invoked was deleted with this function's arrival, and the
 * button was not hand-written by anyone: `migrateTableConfig` above generated
 * one for every dashboard it migrated, so real vaults carry it. Leaving it
 * would leave a visible promise with nothing behind it, and disabling it would
 * be the same defect explaining itself.
 *
 * Dropped at READ time rather than by a forced rewrite of every view: the
 * existing `saveConfig`-on-`migrated` path in `dashboardView.ts` then cleans
 * the file naturally, without touching the #145 restore-point path for the
 * sake of one button.
 *
 * The filter is on `kind`, never on a list of known `templateId`s — a vault's
 * actual ids cannot be enumerated statically (`CX-MAP-191.md`, UNKNOWN), so an
 * id-based filter would silently keep every id we never saw.
 *
 * Idempotent, and returns the ORIGINAL reference when nothing matched, which is
 * the contract `migrateAggregationCount` and `migrateDashboardTransforms` share
 * — a caller uses it to decide whether to write to disk.
 */
export function dropTemplateQuickActions(config: DatabaseViewConfig): {
  readonly config: DatabaseViewConfig;
  readonly migrated: boolean;
} {
  // Persisted JSON, not a typed value: an older or hand-edited config can carry
  // a non-array `quickActions` or none at all, and `.filter` on it would take
  // the dashboard down on open — the same hole cross-model review found in
  // `migrateDashboardTransforms`' `widgets`.
  if (!Array.isArray(config?.quickActions)) return { config, migrated: false };

  // The union no longer HAS an `apply-template` member, so the stored shape has
  // to be read raw. One local `as` over persisted JSON — the technique
  // `isLegacyTableConfig` already uses — never a suppression pragma, which
  // invariant 1 forbids outright.
  const kept = config.quickActions.filter(
    (action) => (action as { kind?: unknown }).kind !== "apply-template"
  );

  if (kept.length === config.quickActions.length)
    return { config, migrated: false };

  return { config: { ...config, quickActions: kept }, migrated: true };
}

/**
 * Check if a config object looks like a legacy TableConfig.
 */
export function isLegacyTableConfig(config: Record<string, unknown>): boolean {
  // DatabaseViewConfig always has 'widgets' array and 'layoutVersion'
  if (
    Array.isArray(config["widgets"]) &&
    typeof config["layoutVersion"] === "number"
  ) {
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
    return changed ? (next as unknown as T) : value;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === "aggregation" && v === "count") {
        next[k] = "count_total";
        changed = true;
      } else if (
        k === "aggregations" &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      ) {
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
    return changed ? (next as unknown as T) : value;
  }
  return value;
}

/**
 * #118 — lift ordinary scope/grouping out of every widget's transform pipeline
 * so the canonical A→C→B order (FILTER_ORDER_ADR.md) applies to stored
 * dashboards, not just new ones.
 *
 * Idempotent: once every widget is split it reports `migrated: false`, so
 * reopening a dashboard writes nothing.
 */
export function migrateDashboardTransforms(config: DatabaseViewConfig): {
  readonly config: DatabaseViewConfig;
  readonly migrated: boolean;
} {
  // Persisted JSON, not a typed value: an older or hand-edited config can carry
  // a non-array `widgets` (or none), and `.map` on it takes the dashboard down
  // on open — in a code path that then writes to disk. Found by cross-model
  // review (Codex, 2026-08-25).
  if (!Array.isArray(config?.widgets)) return { config, migrated: false };

  let migrated = false;

  const widgets: WidgetDefinition[] = config.widgets.map((widget) => {
    const result = migrateTransformToViewLevel(widget);
    if (!result.migrated) return widget;
    migrated = true;

    // Spreading the original would carry the consumed pipeline back in.
    const { transform: _consumed, ...rest } = widget;
    void _consumed;
    return {
      ...rest,
      config: result.config,
      ...(result.transform !== undefined && { transform: result.transform }),
    };
  });

  return migrated
    ? { config: { ...config, widgets }, migrated }
    : { config, migrated };
}

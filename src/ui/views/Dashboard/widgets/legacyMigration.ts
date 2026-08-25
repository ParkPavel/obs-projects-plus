// legacyMigration.ts — F3 (#074, UT2026-A/F): the V2 fate table as code.
//
// data-table renders THROUGH database-call on the fly (no data loss, config
// stays legacy until the user grows it past one table tab — then it converts
// permanently). The other archived types stop rendering archive code: where
// the fate table defines a successor, `convertLegacyWidget` produces a
// one-click conversion patch; where it doesn't, the placeholder explains the
// archival and the stored config is left untouched.

import type { WidgetDefinition, WidgetType, StatsConfig, SummaryColumnConfig } from "../types";
import type { TransformPipeline, TransformStep, FilterStep } from "src/lib/dashboard-engine/transformTypes";
import type { FilterDefinition } from "src/settings/settings";
import { andComposeFilters } from "src/lib/engine/filterCompose";

/** Build a single-Table-tab database-call config (the data-table successor). */
export function tableTabConfig(
  tableConfig: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    viewTabs: [{ id: "table", label: "Table", viewType: "table", config: tableConfig }],
    activeTabId: "table",
  };
}

/**
 * #112 F1: build the on-the-fly single-Table-tab config for a data-table
 * widget rendered through DatabaseCallBlock, re-merging the block-level
 * `subFilter` that lives on `widget.config` (NOT inside the table overlay) so
 * the block can apply it through the canonical filterEvaluator. Restore-side
 * mirror of `persistDataTableSubFilter`.
 */
export function restoreDataTableConfig(
  tableConfig: Record<string, unknown> = {},
  widgetConfig: Record<string, unknown> | undefined = {}
): Record<string, unknown> {
  const config = tableTabConfig(tableConfig);
  const subFilter = widgetConfig?.["subFilter"];
  if (subFilter !== undefined) config["subFilter"] = subFilter;
  return config;
}

/** summary-row → stats: each footer column becomes a stats card. */
export function summaryRowToStatsConfig(config: Record<string, unknown>): StatsConfig {
  const columns = (config["columns"] as SummaryColumnConfig[] | undefined) ?? [];
  return {
    cards: columns.map((col, i) => ({
      id: `m-${i}`,
      label: `${col.field} ${col.aggregation}`,
      field: col.field,
      aggregation: col.aggregation,
      ...(col.format !== undefined && { format: col.format }),
      ...(col.currencySymbol !== undefined && { currencySymbol: col.currencySymbol }),
    })),
    columns: columns.length >= 4 ? 4 : columns.length >= 3 ? 3 : 2,
  };
}

/**
 * One-click conversion patch per fate table, or null when the type has no
 * successor (comparison / timeline / yaml-visualizer / sub-base-canvas —
 * their configs stay stored, rendering is retired).
 */
export function convertLegacyWidget(
  widget: WidgetDefinition
): Partial<WidgetDefinition> | null {
  switch (widget.type) {
    case "data-table":
      return {
        type: "database-call",
        config: tableTabConfig((widget.config["table"] as Record<string, unknown>) ?? {}),
      };
    case "summary-row":
      return {
        type: "stats",
        config: summaryRowToStatsConfig(widget.config) as unknown as Record<string, unknown>,
      };
    case "data-list":
    case "view-port":
      return { type: "database-call", config: tableTabConfig() };
    default:
      return null;
  }
}

/**
 * F3 routing for a legacy data-table widget rendered through
 * DatabaseCallBlock: while the block stays a single Table tab, edits unwrap
 * back into legacy table-config storage; the moment the user grows the
 * block (extra tabs / non-table view) it converts to database-call
 * permanently — the natural upgrade path.
 */
export function unwrapDataTableConfigChange(
  detail: Record<string, unknown>
):
  | { kind: "convert"; config: Record<string, unknown> }
  | { kind: "table"; tableConfig: Record<string, unknown> } {
  const tabs = (detail["viewTabs"] as Array<{ viewType: string; config: Record<string, unknown> }> | undefined) ?? [];
  if (tabs.length === 1 && tabs[0]?.viewType === "table") {
    return { kind: "table", tableConfig: tabs[0].config };
  }
  return { kind: "convert", config: detail };
}

/**
 * #112 F1: fold a block-level `subFilter` from a data-table configChange
 * detail back onto `widget.config` (the unwrap keeps only the single table
 * tab's config, so the subFilter would otherwise be lost). Returns the next
 * `widget.config` with subFilter added or removed. Pure — no dispatch.
 */
export function persistDataTableSubFilter(
  detail: Record<string, unknown>,
  currentConfig: Record<string, unknown> | undefined,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(currentConfig ?? {}), ...extra };
  const subFilter = detail["subFilter"];
  if (subFilter !== undefined) next["subFilter"] = subFilter;
  else delete next["subFilter"];
  return next;
}

/** True when the type renders a retirement placeholder instead of content. */
export function isRetiredLegacyType(type: WidgetType): boolean {
  return [
    "summary-row",
    "data-list",
    "view-port",
    "comparison",
    "timeline",
    "yaml-visualizer",
    "sub-base-canvas",
  ].includes(type);
}

// ── #118: transform pipeline split (axis A ← pipeline) ───────
//
// The canonical order is A (scope) → C (advanced transform) → B (reactive)
// per FILTER_ORDER_ADR.md. Ordinary `filter` / `group-by` steps predate that
// split and sit on axis C, where they now run after scope instead of before.
// This migration lifts the ones that provably mean the same thing on axis A
// out of the pipeline; everything else stays put, because a step that cannot
// be moved safely is a step that must not move at all.
//
// `group-by` is NOT migrated, and the design brief that asked for it was wrong.
// A pipeline `group-by` is an AGGREGATION: `executeGroupBy` collapses the frame
// to one record per group and adds `_group_size`. A view-level
// `DataTableConfig.groupBy` is presentation only — it sections the original
// records and changes no row count. Three records in two groups render as two
// aggregated rows before the migration and three rows in two sections after,
// persisted to disk on open. No target slot preserves the meaning, so the step
// stays on axis C. Found by cross-model review (Codex, 2026-08-25) after this
// migration had shipped behind four green gates.

/**
 * A leading `filter` step reads exactly the frame `subFilter` reads, so moving
 * it onto axis A cannot change which records survive. Any other step may add,
 * drop or rename fields, so a filter standing behind one is a post-transform
 * filter and belongs to axis C.
 *
 * Disabled steps stop the scan: `subFilter` has no disabled state, so moving a
 * disabled step would silently switch it on.
 */
function countLeadingMigratableFilters(steps: readonly TransformStep[]): number {
  let count = 0;
  for (const step of steps) {
    if (step.type !== "filter" || step.disabled === true) break;
    // An empty filter step is a step the user started and has not finished.
    // It contributes no conditions, so migrating it would delete it from the
    // pipeline and write nothing — their half-built step would just vanish.
    if ((step.conditions?.conditions?.length ?? 0) === 0) break;
    count++;
  }
  return count;
}


export interface TransformMigrationResult {
  /** Pipeline with the remaining advanced steps; absent when nothing is left. */
  readonly transform?: TransformPipeline;
  /** `widget.config` with `subFilter` / view-level group folded in. */
  readonly config: Record<string, unknown>;
  /** False when the widget was already migrated — drives no-op provenance. */
  readonly migrated: boolean;
}

/**
 * #118 — split ordinary scope out of the transform pipeline.
 *
 * Never loses data: a step that cannot be proven equivalent on axis A stays in
 * the pipeline. Idempotent by construction — a migrated widget has no leading
 * `filter` left to move, so a second pass finds nothing.
 */
export function migrateTransformToViewLevel(
  widget: WidgetDefinition
): TransformMigrationResult {
  const steps = widget.transform?.steps ?? [];
  const config: Record<string, unknown> = { ...widget.config };

  if (steps.length === 0) {
    return {
      config,
      migrated: false,
      ...(widget.transform !== undefined && { transform: widget.transform }),
    };
  }

  const filterCount = countLeadingMigratableFilters(steps);
  const remaining = steps.slice(filterCount);
  let migrated = false;

  if (filterCount > 0) {
    const moved = steps
      .slice(0, filterCount)
      .map((step) => (step as FilterStep).conditions);
    const merged = andComposeFilters([
      ...((config["subFilter"] as FilterDefinition | undefined) !== undefined
        ? [config["subFilter"] as FilterDefinition]
        : []),
      ...moved,
    ]);
    if (merged !== undefined) config["subFilter"] = merged;
    migrated = true;
  }

  return {
    config,
    migrated,
    ...(remaining.length > 0 && { transform: { steps: remaining } }),
  };
}

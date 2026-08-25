// legacyMigration.ts — F3 (#074, UT2026-A/F): the V2 fate table as code.
//
// data-table renders THROUGH database-call on the fly (no data loss, config
// stays legacy until the user grows it past one table tab — then it converts
// permanently). The other archived types stop rendering archive code: where
// the fate table defines a successor, `convertLegacyWidget` produces a
// one-click conversion patch; where it doesn't, the placeholder explains the
// archival and the stored config is left untouched.

import type { WidgetDefinition, WidgetType, StatsConfig, SummaryColumnConfig, DataTableConfig } from "../types";
import type { TransformPipeline, TransformStep, FilterStep, GroupByStep } from "src/lib/dashboard-engine/transformTypes";
import type { FilterDefinition } from "src/settings/settings";
import { applyGroupPatch } from "./DatabaseCall/tableHeaderOps";

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

/**
 * AND-compose filter definitions. Plain AND definitions are flattened into one
 * condition list — nesting them as groups would be equivalent for the engine
 * but produces a `conditions: []` shape that every "is this filter empty?"
 * guard in the UI reads as no filter at all. Only an `or` definition (whose
 * semantics nesting must preserve) becomes a group.
 */
function andComposeFilters(
  defs: readonly FilterDefinition[]
): FilterDefinition | undefined {
  const meaningful = defs.filter(
    (d) => d.conditions.length > 0 || (d.groups?.length ?? 0) > 0
  );
  if (meaningful.length === 0) return undefined;
  if (meaningful.length === 1) return meaningful[0] as FilterDefinition;

  const flattenable = meaningful.every(
    (d) => d.conjunction !== "or" && (d.groups?.length ?? 0) === 0
  );
  if (flattenable) {
    return {
      conjunction: "and",
      conditions: meaningful.flatMap((d) => [...d.conditions]),
    };
  }
  return { conjunction: "and", conditions: [], groups: [...meaningful] };
}

/**
 * A `group-by` is ordinary view-level grouping only when it is the entire
 * remaining pipeline: one enabled step, one field, no date bucketing. With an
 * `aggregate` or `pivot` behind it, it is the input of an advanced chain and
 * moving it would break that chain.
 */
function terminalGroupField(steps: readonly TransformStep[]): string | null {
  if (steps.length !== 1) return null;
  const step = steps[0];
  if (!step || step.type !== "group-by" || step.disabled === true) return null;
  const groupStep = step as GroupByStep;
  if (groupStep.dateGrouping !== undefined) return null;
  if (groupStep.fields.length !== 1) return null;
  return groupStep.fields[0] ?? null;
}

/**
 * Write a view-level group into the one slot that is certain to be read back:
 * a lone `table` view tab. Returns false for anything else, and the caller then
 * leaves the step in the pipeline rather than guessing.
 *
 * The `viewType` check is the whole point. `applyGroupPatch` produces a
 * `DataTableConfig.groupBy`, which only the table view reads — `BoardConfig`
 * groups by a plain `groupByField` string and `GalleryConfig` cannot group at
 * all. Writing the patch into a board or gallery tab would delete the step from
 * the pipeline and store it where nothing looks, losing the setting silently.
 *
 * The data-table `config.table` overlay is deliberately not a target: a primary
 * data-table renders the *view-level* table config, not `widget.config.table`
 * (`WidgetHost.svelte`), and the migration cannot tell primary from non-primary.
 * A group written there would vanish for exactly half the cases, so it is not
 * written at all.
 */
function applyViewLevelGroup(
  config: Record<string, unknown>,
  field: string
): boolean {
  const tabs = config["viewTabs"];
  if (!Array.isArray(tabs) || tabs.length !== 1) return false;

  const tab = tabs[0] as
    | { viewType?: string; config?: Record<string, unknown> }
    | undefined;
  if (!tab || typeof tab !== "object") return false;
  if (tab.viewType !== "table") return false;

  const tabConfig = (tab.config ?? {}) as DataTableConfig;
  if (tabConfig.groupBy !== undefined) return false;

  config["viewTabs"] = [{ ...tab, config: applyGroupPatch(tabConfig, field) }];
  return true;
}

/** Outcome of {@link migrateTransformToViewLevel}. */
export interface TransformMigrationResult {
  /** Pipeline with the remaining advanced steps; absent when nothing is left. */
  readonly transform?: TransformPipeline;
  /** `widget.config` with `subFilter` / view-level group folded in. */
  readonly config: Record<string, unknown>;
  /** False when the widget was already migrated — drives no-op provenance. */
  readonly migrated: boolean;
}

/**
 * #118 — split ordinary scope/grouping out of the transform pipeline.
 *
 * Never loses data: a step that cannot be proven equivalent on axis A stays in
 * the pipeline. Idempotent by construction — a migrated widget has no leading
 * `filter` and no lone `group-by`, so a second pass finds nothing to move.
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
  let remaining = steps.slice(filterCount);
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

  const groupField = terminalGroupField(remaining);
  if (groupField !== null && applyViewLevelGroup(config, groupField)) {
    remaining = [];
    migrated = true;
  }

  return {
    config,
    migrated,
    ...(remaining.length > 0 && { transform: { steps: remaining } }),
  };
}

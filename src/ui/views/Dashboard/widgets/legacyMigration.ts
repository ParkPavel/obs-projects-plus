// legacyMigration.ts — F3 (#074, UT2026-A/F): the V2 fate table as code.
//
// data-table renders THROUGH database-call on the fly (no data loss, config
// stays legacy until the user grows it past one table tab — then it converts
// permanently). The other archived types stop rendering archive code: where
// the fate table defines a successor, `convertLegacyWidget` produces a
// one-click conversion patch; where it doesn't, the placeholder explains the
// archival and the stored config is left untouched.

import type { WidgetDefinition, WidgetType, StatsConfig, SummaryColumnConfig } from "../types";

/** Build a single-Table-tab database-call config (the data-table successor). */
export function tableTabConfig(
  tableConfig: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    viewTabs: [{ id: "table", label: "Table", viewType: "table", config: tableConfig }],
    activeTabId: "table",
  };
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

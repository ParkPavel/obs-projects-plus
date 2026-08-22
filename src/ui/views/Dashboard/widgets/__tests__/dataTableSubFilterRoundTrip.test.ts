import "@testing-library/jest-dom";

// #112 F1 — legacy data-table subFilter round-trip.
//
// A data-table widget renders THROUGH DatabaseCallBlock via an on-the-fly
// single-Table-tab config. Its block-level `subFilter` must survive the
// save/restore cycle:
//   - RESTORE (`restoreDataTableConfig`): re-merge `widget.config.subFilter`
//     into the config handed to DatabaseCallBlock, which reads config.subFilter
//     and applies it through the canonical filterEvaluator.
//   - PERSIST (`persistDataTableSubFilter`): on a configChange the unwrap keeps
//     only the single table tab's config and drops subFilter; the helper folds
//     it back onto widget.config (block-level, NOT inside the table overlay)
//     for both primary and non-primary data-table widgets.

import {
  unwrapDataTableConfigChange,
  persistDataTableSubFilter,
  restoreDataTableConfig,
  tableTabConfig,
} from "../legacyMigration";

const SUB_FILTER = {
  conjunction: "and",
  conditions: [{ field: "status", operator: "is", value: "done" }],
} as const;

// A DatabaseCallBlock configChange for a still-single-table-tab block carries
// {viewTabs:[{viewType:"table",config}], activeTabId, subFilter?}.
function tableChangeDetail(
  tableConfig: Record<string, unknown>,
  subFilter?: unknown
): Record<string, unknown> {
  const detail = tableTabConfig(tableConfig);
  if (subFilter !== undefined) detail["subFilter"] = subFilter;
  return detail;
}

describe("#112 F1 — data-table subFilter round-trip", () => {
  test("unwrap keeps the table tab config and drops the block-level subFilter", () => {
    const detail = tableChangeDetail({ properties: ["name"] }, SUB_FILTER);
    const result = unwrapDataTableConfigChange(detail);
    expect(result.kind).toBe("table");
    if (result.kind !== "table") throw new Error("expected table");
    expect(result.tableConfig).toEqual({ properties: ["name"] });
    expect(result.tableConfig["subFilter"]).toBeUndefined();
  });

  test("persist folds subFilter onto widget.config for the primary path", () => {
    const detail = tableChangeDetail({ properties: ["name"] }, SUB_FILTER);
    const next = persistDataTableSubFilter(detail, { existing: 1 });
    expect(next).toEqual({ existing: 1, subFilter: SUB_FILTER });
  });

  test("persist folds subFilter AND table onto widget.config for the non-primary path", () => {
    const detail = tableChangeDetail({ properties: ["name"] }, SUB_FILTER);
    const next = persistDataTableSubFilter(detail, { existing: 1 }, { table: { properties: ["name"] } });
    expect(next).toEqual({
      existing: 1,
      table: { properties: ["name"] },
      subFilter: SUB_FILTER,
    });
  });

  test("persist removes a stale subFilter when the change clears it", () => {
    const detail = tableChangeDetail({ properties: ["name"] });
    const next = persistDataTableSubFilter(detail, { existing: 1, subFilter: SUB_FILTER });
    expect(next).toEqual({ existing: 1 });
    expect(next["subFilter"]).toBeUndefined();
  });

  test("restore re-injects widget.config.subFilter into the DatabaseCallBlock config", () => {
    const config = restoreDataTableConfig({ properties: ["name"] }, { subFilter: SUB_FILTER });
    expect(config["subFilter"]).toEqual(SUB_FILTER);
    // The single table tab is still present alongside the restored subFilter.
    const tabs = config["viewTabs"] as Array<{ viewType: string; config: unknown }>;
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.viewType).toBe("table");
    expect(tabs[0]!.config).toEqual({ properties: ["name"] });
  });

  test("restore omits subFilter when widget.config has none", () => {
    const config = restoreDataTableConfig({ properties: ["name"] }, {});
    expect("subFilter" in config).toBe(false);
  });

  test("full cycle: persist onto widget.config then restore into block config", () => {
    // 1. User edits subFilter → DatabaseCallBlock dispatches a configChange.
    const detail = tableChangeDetail({ properties: ["name"] }, SUB_FILTER);
    // 2. WidgetHost persists it onto widget.config (primary path).
    const persistedConfig = persistDataTableSubFilter(detail, {});
    // 3. Unwrap yields the table config that WidgetHost round-trips upstream.
    const unwrapped = unwrapDataTableConfigChange(detail);
    if (unwrapped.kind !== "table") throw new Error("expected table");
    // 4. Re-props through the restore helper reunites table + subFilter.
    const restored = restoreDataTableConfig(unwrapped.tableConfig, persistedConfig);
    expect(restored["subFilter"]).toEqual(SUB_FILTER);
    const tabs = restored["viewTabs"] as Array<{ config: unknown }>;
    expect(tabs[0]!.config).toEqual({ properties: ["name"] });
  });
});

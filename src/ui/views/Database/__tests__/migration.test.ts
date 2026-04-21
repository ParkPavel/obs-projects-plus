// src/ui/views/Database/__tests__/migration.test.ts

import { migrateTableConfig, isLegacyTableConfig } from "../migration";

describe("isLegacyTableConfig", () => {
  test("identifies empty config as legacy", () => {
    expect(isLegacyTableConfig({})).toBe(true);
  });

  test("identifies config with fieldConfig as legacy", () => {
    expect(
      isLegacyTableConfig({ fieldConfig: { name: { width: 200 } } })
    ).toBe(true);
  });

  test("identifies config with sortField as legacy", () => {
    expect(isLegacyTableConfig({ sortField: "name" })).toBe(true);
  });

  test("identifies DatabaseViewConfig as NOT legacy", () => {
    expect(
      isLegacyTableConfig({
        widgets: [{ id: "w1", type: "data-table" }],
        layoutVersion: 1,
      })
    ).toBe(false);
  });
});

describe("migrateTableConfig", () => {
  test("creates DatabaseViewConfig with single DataTable widget", () => {
    const result = migrateTableConfig({
      fieldConfig: { name: { width: 200 } },
      sortField: "date",
      sortAsc: true,
      orderFields: ["name", "date", "status"],
    });

    expect(result.widgets).toHaveLength(1);
    expect(result.widgets[0]?.type).toBe("data-table");
    expect(result.widgets[0]?.layout.w).toBe(12);
    expect(result.layoutMode).toBe("stack");
    expect(result.layoutVersion).toBe(1);
    expect(result.showWidgetToolbar).toBe(true);
    expect(result.compactMode).toBe(false);
  });

  test("preserves table config fields", () => {
    const result = migrateTableConfig({
      fieldConfig: { budget: { width: 150, pinned: true } },
      sortField: "budget",
      sortAsc: false,
      orderFields: ["budget", "name"],
    });

    expect(result.table.fieldConfig).toEqual({
      budget: { width: 150, pinned: true },
    });
    expect(result.table.sortField).toBe("budget");
    expect(result.table.sortAsc).toBe(false);
    expect(result.table.orderFields).toEqual(["budget", "name"]);
  });

  test("handles empty legacy config", () => {
    const result = migrateTableConfig({});

    expect(result.widgets).toHaveLength(1);
    expect(result.table.aggregations).toEqual({});
    expect(result.table.showAggregationRow).toBe(false);
    // No fieldConfig/sortField/sortAsc/orderFields keys
    expect(result.table.fieldConfig).toBeUndefined();
    expect(result.table.sortField).toBeUndefined();
  });

  test("widget has unique id", () => {
    const result1 = migrateTableConfig({});
    const result2 = migrateTableConfig({});
    expect(result1.widgets[0]?.id).not.toBe(result2.widgets[0]?.id);
  });
});

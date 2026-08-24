// src/ui/views/Dashboard/__tests__/migration.test.ts

import { migrateTableConfig, isLegacyTableConfig, migrateAggregationCount, migrateDashboardTransforms } from "../migration";

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
    expect(result.quickActions).toHaveLength(2);
    expect(result.quickActions?.[0]).toMatchObject({
      id: "qa-overview",
      kind: "apply-template",
      templateId: "overview-finance",
    });
    expect(result.quickActions?.[1]).toMatchObject({
      id: "qa-formula",
      kind: "toggle-formula-bar",
    });
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

describe("migrateAggregationCount (R5-004)", () => {
  test("renames DataTable aggregations 'count' -> 'count_total'", () => {
    const out = migrateAggregationCount({
      table: { aggregations: { name: "count", budget: "sum" } },
    });
    expect(out.table.aggregations).toEqual({ name: "count_total", budget: "sum" });
  });

  test("renames Stats card aggregation 'count' -> 'count_total'", () => {
    const out = migrateAggregationCount({
      cards: [
        { id: "a", aggregation: "count", field: "*" },
        { id: "b", aggregation: "sum", field: "x" },
      ],
    });
    expect(out.cards[0]?.aggregation).toBe("count_total");
    expect(out.cards[1]?.aggregation).toBe("sum");
  });

  test("renames Chart yAxis aggregation but preserves yAxis.property='count' sentinel", () => {
    const out = migrateAggregationCount({
      yAxis: { property: "count", aggregation: "count" },
    });
    expect(out.yAxis.property).toBe("count");
    expect(out.yAxis.aggregation).toBe("count_total");
  });

  test("recurses into nested widgets array", () => {
    const out: any = migrateAggregationCount({
      widgets: [
        { id: "w1", type: "data-table", config: { aggregations: { f: "count" } } },
        { id: "w2", type: "stats", config: { cards: [{ id: "c", aggregation: "count" }] } },
      ],
    });
    expect(out.widgets[0].config.aggregations.f).toBe("count_total");
    expect(out.widgets[1].config.cards[0].aggregation).toBe("count_total");
  });

  test("does not touch RollupFunction-shaped 'count' (no aggregation key)", () => {
    const input = { rollup: { relationField: "r", targetField: "t", function: "count" } };
    const out = migrateAggregationCount(input);
    expect(out.rollup.function).toBe("count");
  });

  test("idempotent: second pass is a no-op (returns same reference)", () => {
    const once = migrateAggregationCount({
      table: { aggregations: { name: "count" } },
    });
    const twice = migrateAggregationCount(once);
    expect(twice).toBe(once);
  });

  test("returns same reference when nothing to migrate", () => {
    const input = { table: { aggregations: { name: "sum" } } };
    expect(migrateAggregationCount(input)).toBe(input);
  });
});

describe("migrateDashboardTransforms (#118)", () => {
  const widget = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    type: "database-call" as const,
    title: id,
    layout: { x: 0, y: 0, w: 4, h: 4 },
    config: {},
    ...extra,
  });

  const filterStep = {
    type: "filter" as const,
    conditions: {
      conjunction: "and" as const,
      conditions: [{ field: "status", operator: "is", value: "done" }],
    },
  };

  const pivotStep = {
    type: "pivot" as const,
    categoryField: "cat",
    valueField: "val",
    aggregation: "SUM" as const,
  };

  const dashboard = (widgets: unknown[]) =>
    ({ widgets }) as unknown as Parameters<typeof migrateDashboardTransforms>[0];

  it("lifts a leading pipeline filter onto the widget subFilter", () => {
    const result = migrateDashboardTransforms(
      dashboard([widget("w1", { transform: { steps: [filterStep] } })])
    );

    expect(result.migrated).toBe(true);
    const migrated = result.config.widgets[0];
    expect(migrated?.transform).toBeUndefined();
    expect(migrated?.config["subFilter"]).toEqual(filterStep.conditions);
  });

  it("leaves a dashboard with nothing to split untouched", () => {
    const input = dashboard([widget("w1", { transform: { steps: [pivotStep] } })]);
    const result = migrateDashboardTransforms(input);

    expect(result.migrated).toBe(false);
    expect(result.config).toBe(input);
  });

  it("is idempotent — a second pass writes nothing", () => {
    const once = migrateDashboardTransforms(
      dashboard([widget("w1", { transform: { steps: [filterStep] } })])
    );
    const twice = migrateDashboardTransforms(once.config);

    expect(twice.migrated).toBe(false);
    expect(twice.config).toBe(once.config);
  });

  it("migrates only the widgets that need it, preserving the rest by identity", () => {
    const untouched = widget("keep", { transform: { steps: [pivotStep] } });
    const result = migrateDashboardTransforms(
      dashboard([widget("move", { transform: { steps: [filterStep] } }), untouched])
    );

    expect(result.migrated).toBe(true);
    expect(result.config.widgets[1]).toBe(untouched);
  });
});

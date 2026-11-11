// src/ui/views/Dashboard/__tests__/migration.test.ts

import { migrateTableConfig, isLegacyTableConfig, migrateAggregationCount, migrateDashboardTransforms, dropObsoleteQuickActions, markFormulaFieldsCurrent } from "../migration";
import type { DatabaseViewConfig } from "../types";

describe("isLegacyTableConfig", () => {
  test("i2-model (D10): an empty config is a new page, not a legacy table", () => {
    expect(isLegacyTableConfig({})).toBe(false);
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
    // #191: one, not two. The "Overview Preset" action applied a dashboard
    // template and went with that mechanism; migrating a dashboard must not
    // mint a button pointing at something that no longer exists.
    expect(result).not.toHaveProperty("quickActions");
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

describe("migrateDashboardTransforms — malformed persisted config (Codex review)", () => {
  const malformed = (widgets: unknown) =>
    ({ widgets }) as unknown as Parameters<typeof migrateDashboardTransforms>[0];

  it.each([
    ["an object", {}],
    ["a string", "widgets"],
    ["a number", 7],
    ["null", null],
    ["undefined", undefined],
  ])("returns the config untouched when widgets is %s", (_name, value) => {
    const input = malformed(value);
    const result = migrateDashboardTransforms(input);

    expect(result.migrated).toBe(false);
    expect(result.config).toBe(input);
  });

  it("does not throw for a config with no widgets key at all", () => {
    expect(() =>
      migrateDashboardTransforms({} as unknown as Parameters<typeof migrateDashboardTransforms>[0])
    ).not.toThrow();
  });
});

describe("dropObsoleteQuickActions — a vault that still carries duplicate controls", () => {
  const stored = () =>
    ({
      widgets: [{ id: "w1", type: "database-call" }],
      layoutMode: "stack",
      layoutVersion: 1,
      table: {},
      quickActions: [
        { id: "qa-overview", kind: "apply-template", label: "Overview Preset", templateId: "overview-finance" },
        { id: "qa-formula", kind: "toggle-formula-bar", label: "Formula Builder" },
      ],
    }) as unknown as DatabaseViewConfig;

  it("removes both the dead template action and the duplicate formula toolbar action", () => {
    const r = dropObsoleteQuickActions(stored());
    expect(r.migrated).toBe(true);
    expect(r.config.quickActions).toEqual([]);
  });

  it("touches nothing else — by reference, not by equality", () => {
    // A migrator that rebuilds the widgets array would re-render every widget
    // and lose object identity the canvas keys on. `toBe`, deliberately.
    const before = stored();
    const r = dropObsoleteQuickActions(before);
    expect(r.config.widgets).toBe(before.widgets);
    expect(r.config.table).toBe(before.table);
  });

  it("drops a templateId this codebase has never heard of", () => {
    // CX-MAP-191 recorded that quick actions hold the id as a string and that
    // static reading cannot enumerate what real vaults contain. Filtering on a
    // list of known ids would leave that unknown as a hole.
    const alien = {
      widgets: [],
      quickActions: [{ id: "x", kind: "apply-template", label: "?", templateId: "whatever-user-had" }],
    } as unknown as DatabaseViewConfig;
    expect(dropObsoleteQuickActions(alien).config.quickActions).toHaveLength(0);
  });

  it("is idempotent, and says so by returning the same object", () => {
    // Otherwise the view saves on every single open.
    const once = dropObsoleteQuickActions(stored());
    const twice = dropObsoleteQuickActions(once.config);
    expect(twice.migrated).toBe(false);
    expect(twice.config).toBe(once.config);
  });

  it("survives a config with no quickActions at all", () => {
    const bare = { widgets: [] } as unknown as DatabaseViewConfig;
    const r = dropObsoleteQuickActions(bare);
    expect(r.migrated).toBe(false);
    expect(r.config).toBe(bare);
  });

  it("survives quickActions that are not an array", () => {
    // Persisted JSON: a hand-edited or older vault can hold anything here, and
    // throwing would take the whole dashboard down rather than one button.
    const broken = { widgets: [], quickActions: "nope" } as unknown as DatabaseViewConfig;
    expect(() => dropObsoleteQuickActions(broken)).not.toThrow();
    expect(dropObsoleteQuickActions(broken).migrated).toBe(false);
  });

  it("preserves actions with kinds it does not recognize", () => {
    const future = {
      widgets: [],
      quickActions: [{ id: "future", kind: "future-action" }],
    } as unknown as DatabaseViewConfig;
    const result = dropObsoleteQuickActions(future);
    expect(result.migrated).toBe(false);
    expect(result.config).toBe(future);
  });
});

describe("markFormulaFieldsCurrent — one rule set for saved calculated fields", () => {
  const withFormulas = (formulaFields: unknown): DatabaseViewConfig =>
    ({ widgets: [], layoutMode: "stack", layoutVersion: 1, table: {}, showWidgetToolbar: true, compactMode: false, formulaFields } as unknown as DatabaseViewConfig);

  it("stamps a formula saved before the version mark and keeps its source", () => {
    const r = markFormulaFieldsCurrent(withFormulas([{ name: "Net", expression: 'IF(type = "expense", 0 - amount, paid)' }]));
    expect(r.migrated).toBe(true);
    expect(r.config.formulaFields).toEqual([{ name: "Net", expression: 'IF(type = "expense", 0 - amount, paid)', formulaVersion: "unified-v1" }]);
  });

  it("leaves a marked formula, an unparsable one and a foreign shape alone, and is idempotent", () => {
    const stored = withFormulas([
      { name: "A", expression: "1 + 1", formulaVersion: "unified-v1" },
      { name: "B", expression: "1 +" },
      { name: "C", expression: "1", formulaVersion: "future-v9" },
      null,
    ]);
    const r = markFormulaFieldsCurrent(stored);
    expect(r.migrated).toBe(false);
    expect(r.config).toBe(stored);
    expect(markFormulaFieldsCurrent(withFormulas(undefined)).migrated).toBe(false);
    const once = markFormulaFieldsCurrent(withFormulas([{ name: "N", expression: "2 * 3" }]));
    expect(markFormulaFieldsCurrent(once.config).migrated).toBe(false);
  });
});

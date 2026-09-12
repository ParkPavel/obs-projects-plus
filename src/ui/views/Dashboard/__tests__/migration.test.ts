// src/ui/views/Dashboard/__tests__/migration.test.ts

import {
  migrateTableConfig,
  isLegacyTableConfig,
  migrateAggregationCount,
  migrateDashboardTransforms,
  dropTemplateQuickActions,
} from "../migration";
import type { DatabaseViewConfig } from "../types";

describe("isLegacyTableConfig", () => {
  test("identifies empty config as legacy", () => {
    expect(isLegacyTableConfig({})).toBe(true);
  });

  test("identifies config with fieldConfig as legacy", () => {
    expect(isLegacyTableConfig({ fieldConfig: { name: { width: 200 } } })).toBe(
      true
    );
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
    // #191 — the migrator used to generate an `apply-template` action beside
    // this one, pointing at a mechanism that no longer exists. It now emits the
    // formula toggle alone; `dropTemplateQuickActions` below removes the other
    // from configs written before this change.
    expect(result.quickActions).toHaveLength(1);
    expect(result.quickActions?.[0]).toMatchObject({
      id: "qa-formula",
      kind: "toggle-formula-bar",
    });
    expect(result.quickActions?.map((a) => a.kind)).not.toContain(
      "apply-template"
    );
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
    expect(out.table.aggregations).toEqual({
      name: "count_total",
      budget: "sum",
    });
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
        {
          id: "w1",
          type: "data-table",
          config: { aggregations: { f: "count" } },
        },
        {
          id: "w2",
          type: "stats",
          config: { cards: [{ id: "c", aggregation: "count" }] },
        },
      ],
    });
    expect(out.widgets[0].config.aggregations.f).toBe("count_total");
    expect(out.widgets[1].config.cards[0].aggregation).toBe("count_total");
  });

  test("does not touch RollupFunction-shaped 'count' (no aggregation key)", () => {
    const input = {
      rollup: { relationField: "r", targetField: "t", function: "count" },
    };
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
    ({ widgets }) as unknown as Parameters<
      typeof migrateDashboardTransforms
    >[0];

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
    const input = dashboard([
      widget("w1", { transform: { steps: [pivotStep] } }),
    ]);
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
      dashboard([
        widget("move", { transform: { steps: [filterStep] } }),
        untouched,
      ])
    );

    expect(result.migrated).toBe(true);
    expect(result.config.widgets[1]).toBe(untouched);
  });
});

describe("migrateDashboardTransforms — malformed persisted config (Codex review)", () => {
  const malformed = (widgets: unknown) =>
    ({ widgets }) as unknown as Parameters<
      typeof migrateDashboardTransforms
    >[0];

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
      migrateDashboardTransforms(
        {} as unknown as Parameters<typeof migrateDashboardTransforms>[0]
      )
    ).not.toThrow();
  });
});

// ── #191 — a vault carrying the retired template button opens ────────────
//
// The mechanism went in this commit; the button it generated is already on
// disk in real vaults. `migration.ts` produced it for EVERY dashboard it
// migrated, so "nobody will have one" is not available as an argument. These
// are the tests that get forgotten: they assert such a config still opens,
// that only the dead action leaves, and that everything else comes back by
// reference so no widget is rewritten on the way past.

describe("dropTemplateQuickActions (#191)", () => {
  const widgets = [
    {
      id: "w1",
      type: "data-table",
      title: "T",
      layout: { x: 0, y: 0, w: 12, h: 6 },
      config: {},
    },
  ];
  const table = { aggregations: {}, showAggregationRow: false };
  const fieldPresets = [{ id: "p1", name: "Wide", fieldConfig: {} }];

  const storedConfig = (quickActions: unknown): DatabaseViewConfig =>
    ({
      widgets,
      layoutMode: "stack",
      layoutVersion: 1,
      table,
      showWidgetToolbar: true,
      compactMode: false,
      fieldPresets,
      quickActions,
    }) as unknown as DatabaseViewConfig;

  it("drops the stored apply-template action and keeps the formula toggle", () => {
    // The exact pair `migrateTableConfig` used to write, which is what a real
    // vault carries — the button a user sees as «Обзорный пресет».
    const config = storedConfig([
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
    ]);

    const result = dropTemplateQuickActions(config);

    expect(result.migrated).toBe(true);
    expect(result.config.quickActions).toHaveLength(1);
    expect(result.config.quickActions?.[0]?.id).toBe("qa-formula");
    expect(result.config.quickActions?.[0]?.kind).toBe("toggle-formula-bar");
  });

  it("touches nothing but quickActions, by reference", () => {
    // Reference equality, not deep equality: this runs on a path that then
    // writes to disk (#145), so a migration that rebuilds widgets it had no
    // reason to change is a rewrite of user data wearing a no-op's clothes.
    const config = storedConfig([
      {
        id: "qa-overview",
        label: "x",
        kind: "apply-template",
        templateId: "overview-finance",
      },
    ]);

    const result = dropTemplateQuickActions(config);

    expect(result.migrated).toBe(true);
    expect(result.config).not.toBe(config);
    expect(result.config.widgets).toBe(config.widgets);
    expect(result.config.table).toBe(config.table);
    expect(result.config.fieldPresets).toBe(config.fieldPresets);
    expect(result.config.quickActions).toEqual([]);
  });

  it("drops a templateId that never existed in this codebase", () => {
    // The usage map's UNKNOWN: which ids actually sit in users' vaults cannot
    // be enumerated statically, because a quick action stores one as a plain
    // string. So the filter is on `kind` — a list of known ids would leave
    // every id we never saw behind, still rendering, still doing nothing.
    const config = storedConfig([
      {
        id: "qa-legacy",
        label: "Legacy",
        kind: "apply-template",
        templateId: "never-shipped-2019",
      },
      { id: "qa-formula", label: "Formula", kind: "toggle-formula-bar" },
    ]);

    const result = dropTemplateQuickActions(config);

    expect(result.migrated).toBe(true);
    expect(result.config.quickActions?.map((a) => a.id)).toEqual([
      "qa-formula",
    ]);
  });

  it("is idempotent — a second open writes nothing", () => {
    const config = storedConfig([
      {
        id: "qa-overview",
        label: "x",
        kind: "apply-template",
        templateId: "overview-finance",
      },
      { id: "qa-formula", label: "Formula", kind: "toggle-formula-bar" },
    ]);

    const first = dropTemplateQuickActions(config);
    const second = dropTemplateQuickActions(first.config);

    expect(second.migrated).toBe(false);
    expect(second.config).toBe(first.config);
  });

  it.each([
    ["absent", undefined],
    ["an object", {}],
    ["a string", "qa-overview"],
    ["a number", 7],
    ["null", null],
  ])("does not throw when quickActions is %s", (_name, value) => {
    const config = storedConfig(value);

    expect(() => dropTemplateQuickActions(config)).not.toThrow();

    const result = dropTemplateQuickActions(config);
    expect(result.migrated).toBe(false);
    expect(result.config).toBe(config);
  });

  it("does not throw on a config that is not an object at all", () => {
    expect(() =>
      dropTemplateQuickActions(undefined as unknown as DatabaseViewConfig)
    ).not.toThrow();
  });
});

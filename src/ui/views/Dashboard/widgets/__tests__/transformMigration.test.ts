// #118 — transform pipeline split. The contract is "never loses data": a step
// that cannot be proven equivalent on axis A must survive in the pipeline, so
// most cases here assert that nothing moved.

import { migrateTransformToViewLevel } from "../legacyMigration";
import type { WidgetDefinition } from "../../types";
import type { TransformStep } from "src/lib/dashboard-engine/transformTypes";
import type { FilterDefinition } from "src/settings/settings";

const cond = (field: string, value: string) =>
  ({ field, operator: "is", value } as unknown as FilterDefinition["conditions"][number]);

const filterDef = (field: string, value: string): FilterDefinition => ({
  conjunction: "and",
  conditions: [cond(field, value)],
});

const widget = (
  steps: TransformStep[],
  config: Record<string, unknown> = {}
): WidgetDefinition => ({
  id: "w1",
  type: "database-call",
  title: "W",
  layout: { x: 0, y: 0, w: 4, h: 4 },
  config,
  ...(steps.length > 0 && { transform: { steps } }),
});

const filterStep = (field: string, value: string): TransformStep => ({
  type: "filter",
  conditions: filterDef(field, value),
});

const pivotStep: TransformStep = {
  type: "pivot",
  categoryField: "cat",
  valueField: "val",
  aggregation: "SUM",
};

const groupStep = (...fields: string[]): TransformStep => ({
  type: "group-by",
  fields,
});

const tabsConfig = (tabConfig: Record<string, unknown> = {}, viewType = "table") => ({
  viewTabs: [{ id: "t1", label: "Tab", viewType, config: tabConfig }],
  activeTabId: "t1",
});

describe("#118 migrateTransformToViewLevel — filter to axis A", () => {
  it("moves a leading filter step into subFilter and drops it from the pipeline", () => {
    const result = migrateTransformToViewLevel(widget([filterStep("status", "done")]));

    expect(result.migrated).toBe(true);
    expect(result.transform).toBeUndefined();
    expect(result.config["subFilter"]).toEqual(filterDef("status", "done"));
  });

  it("AND-composes a moved filter with an existing subFilter, keeping both", () => {
    const existing = filterDef("owner", "ann");
    const result = migrateTransformToViewLevel(
      widget([filterStep("status", "done")], { subFilter: existing })
    );

    const merged = result.config["subFilter"] as FilterDefinition;
    expect(merged.conjunction).toBe("and");
    expect(merged.conditions).toEqual([cond("owner", "ann"), cond("status", "done")]);
    expect(merged.groups).toBeUndefined();
  });

  it("moves a run of leading filters in order", () => {
    const result = migrateTransformToViewLevel(
      widget([filterStep("a", "1"), filterStep("b", "2")])
    );

    const merged = result.config["subFilter"] as FilterDefinition;
    expect(merged.conditions).toEqual([cond("a", "1"), cond("b", "2")]);
    expect(result.transform).toBeUndefined();
  });

  it("nests an or-definition as a group instead of flattening it", () => {
    const existing: FilterDefinition = {
      conjunction: "or",
      conditions: [cond("owner", "ann"), cond("owner", "bob")],
    };
    const result = migrateTransformToViewLevel(
      widget([filterStep("status", "done")], { subFilter: existing })
    );

    const merged = result.config["subFilter"] as FilterDefinition;
    expect(merged.conjunction).toBe("and");
    expect(merged.groups).toEqual([existing, filterDef("status", "done")]);
  });

  it("leaves a merged filter visible to conditions-only emptiness guards", () => {
    const result = migrateTransformToViewLevel(
      widget([filterStep("a", "1"), filterStep("b", "2")])
    );

    // A groups-only shape would read as "no filter" to every UI guard that
    // checks conditions.length alone — the merge must not produce one.
    const merged = result.config["subFilter"] as FilterDefinition;
    expect(merged.conditions.length).toBeGreaterThan(0);
  });

  it("keeps a filter that stands behind a reshape step (post-transform filter)", () => {
    const steps = [pivotStep, filterStep("cat", "x")];
    const result = migrateTransformToViewLevel(widget(steps));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual(steps);
    expect(result.config["subFilter"]).toBeUndefined();
  });

  it("moves only the leading filter when a second one sits behind a reshape", () => {
    const trailing = filterStep("cat", "x");
    const result = migrateTransformToViewLevel(
      widget([filterStep("status", "done"), pivotStep, trailing])
    );

    expect(result.config["subFilter"]).toEqual(filterDef("status", "done"));
    expect(result.transform?.steps).toEqual([pivotStep, trailing]);
  });

  it("never moves a disabled filter — subFilter has no disabled state", () => {
    const disabled: TransformStep = { ...filterStep("status", "done"), disabled: true };
    const result = migrateTransformToViewLevel(widget([disabled]));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([disabled]);
    expect(result.config["subFilter"]).toBeUndefined();
  });
});

describe("#118 migrateTransformToViewLevel — group-by to view level", () => {
  it("moves a lone group-by into the single view tab config", () => {
    const result = migrateTransformToViewLevel(widget([groupStep("status")], tabsConfig()));

    expect(result.migrated).toBe(true);
    expect(result.transform).toBeUndefined();
    const tabs = result.config["viewTabs"] as Array<{ config: { groupBy?: { field: string } } }>;
    expect(tabs[0]?.config.groupBy?.field).toBe("status");
  });

  it("keeps a group-by that feeds an aggregate — that is an advanced chain", () => {
    const steps: TransformStep[] = [
      groupStep("status"),
      { type: "aggregate", columns: [{ sourceField: "v", outputName: "sum", function: "SUM" }] },
    ];
    const result = migrateTransformToViewLevel(widget(steps, tabsConfig()));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual(steps);
  });

  it("keeps a date-bucketing group-by — view-level grouping cannot express it", () => {
    const steps: TransformStep[] = [
      { type: "group-by", fields: ["due"], dateGrouping: { field: "due", granularity: "month" } },
    ];
    const result = migrateTransformToViewLevel(widget(steps, tabsConfig()));

    expect(result.transform?.steps).toEqual(steps);
  });

  it("keeps a multi-field group-by — the view slot holds one field", () => {
    const result = migrateTransformToViewLevel(widget([groupStep("a", "b")], tabsConfig()));

    expect(result.transform?.steps).toEqual([groupStep("a", "b")]);
  });

  it("keeps the step when the view tab already groups by something", () => {
    const config = tabsConfig({
      groupBy: {
        field: "owner",
        sortOrder: "asc",
        hiddenGroups: [],
        collapsedGroups: [],
        showEmptyGroups: false,
      },
    });
    const result = migrateTransformToViewLevel(widget([groupStep("status")], config));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([groupStep("status")]);
  });

  it("keeps the step when there is no unambiguous target slot", () => {
    const twoTabs = {
      viewTabs: [
        { id: "a", label: "A", viewType: "table", config: {} },
        { id: "b", label: "B", viewType: "board", config: {} },
      ],
    };
    const result = migrateTransformToViewLevel(widget([groupStep("status")], twoTabs));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([groupStep("status")]);
  });

  it("migrates a leading filter and a trailing group-by together", () => {
    const result = migrateTransformToViewLevel(
      widget([filterStep("status", "done"), groupStep("owner")], tabsConfig())
    );

    expect(result.transform).toBeUndefined();
    expect(result.config["subFilter"]).toEqual(filterDef("status", "done"));
    const tabs = result.config["viewTabs"] as Array<{ config: { groupBy?: { field: string } } }>;
    expect(tabs[0]?.config.groupBy?.field).toBe("owner");
  });
});

describe("#118 migrateTransformToViewLevel — idempotence and no-op", () => {
  const rerun = (w: WidgetDefinition) => {
    const once = migrateTransformToViewLevel(w);
    // Drop the original pipeline before re-applying: a spread would carry it
    // back in whenever the first pass emptied it.
    const { transform: _consumed, ...rest } = w;
    void _consumed;
    const twice = migrateTransformToViewLevel({
      ...rest,
      config: once.config,
      ...(once.transform !== undefined ? { transform: once.transform } : {}),
    } as WidgetDefinition);
    return { once, twice };
  };

  it.each([
    ["filter only", [filterStep("status", "done")], {} as Record<string, unknown>],
    ["filter before pivot", [filterStep("s", "d"), pivotStep], {}],
    ["filter after pivot", [pivotStep, filterStep("s", "d")], {}],
    [
      "group then aggregate",
      [groupStep("status"), { type: "aggregate", columns: [] } as TransformStep],
      {},
    ],
    ["terminal group-by", [groupStep("status")], tabsConfig()],
  ])("migrate(migrate(w)) equals migrate(w) — %s", (_name, steps, config) => {
    const { once, twice } = rerun(
      widget(steps as TransformStep[], config as Record<string, unknown>)
    );

    expect(twice.config).toEqual(once.config);
    expect(twice.transform).toEqual(once.transform);
    expect(twice.migrated).toBe(false);
  });

  it("reports migrated=false and preserves config for a widget with no pipeline", () => {
    const config = { subFilter: filterDef("a", "1") };
    const result = migrateTransformToViewLevel(widget([], config));

    expect(result.migrated).toBe(false);
    expect(result.transform).toBeUndefined();
    expect(result.config).toEqual(config);
  });

  it("leaves an all-advanced pipeline untouched", () => {
    const steps = [pivotStep, { type: "unnest", field: "tags" } as TransformStep];
    const result = migrateTransformToViewLevel(widget(steps));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual(steps);
  });
});

// Audit 2026-08-25 (P1) — applyViewLevelGroup wrote a DataTableConfig.groupBy
// into whatever single tab it found. Only the table view reads that shape:
// BoardConfig groups by a plain `groupByField` string and GalleryConfig cannot
// group at all, so a board/gallery tab swallowed the step and lost the setting.
describe("#118 group-by migration — only a table tab is a valid target", () => {
  it.each(["board", "gallery", "calendar"])(
    "keeps the step when the single tab is a %s tab",
    (viewType) => {
      const result = migrateTransformToViewLevel(
        widget([groupStep("status")], tabsConfig({}, viewType))
      );

      expect(result.migrated).toBe(false);
      expect(result.transform?.steps).toEqual([groupStep("status")]);
      const tabs = result.config["viewTabs"] as Array<{ config: Record<string, unknown> }>;
      expect(tabs[0]?.config["groupBy"]).toBeUndefined();
    }
  );

  it("still migrates into a table tab", () => {
    const result = migrateTransformToViewLevel(
      widget([groupStep("status")], tabsConfig({}, "table"))
    );

    expect(result.migrated).toBe(true);
    const tabs = result.config["viewTabs"] as Array<{ config: { groupBy?: { field: string } } }>;
    expect(tabs[0]?.config.groupBy?.field).toBe("status");
  });

  it("never writes a group into the data-table overlay — a primary table reads the view-level config", () => {
    const result = migrateTransformToViewLevel(widget([groupStep("status")], { table: {} }));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([groupStep("status")]);
    expect((result.config["table"] as Record<string, unknown>)["groupBy"]).toBeUndefined();
  });
});

// Audit 2026-08-25 (P2) — an unfinished filter step carries no conditions, so
// migrating it deleted it from the pipeline and wrote nothing back.
describe("#118 filter migration — an empty step is not migratable", () => {
  const emptyFilter: TransformStep = {
    type: "filter",
    conditions: { conjunction: "and", conditions: [] },
  };

  it("leaves a half-built filter step in the pipeline", () => {
    const result = migrateTransformToViewLevel(widget([emptyFilter]));

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([emptyFilter]);
    expect(result.config["subFilter"]).toBeUndefined();
  });

  it("stops the scan at the empty step, keeping what follows", () => {
    const result = migrateTransformToViewLevel(
      widget([emptyFilter, filterStep("status", "done")])
    );

    expect(result.migrated).toBe(false);
    expect(result.transform?.steps).toEqual([emptyFilter, filterStep("status", "done")]);
  });

  it("still migrates a filled step that precedes an empty one", () => {
    const result = migrateTransformToViewLevel(
      widget([filterStep("status", "done"), emptyFilter])
    );

    expect(result.config["subFilter"]).toEqual(filterDef("status", "done"));
    expect(result.transform?.steps).toEqual([emptyFilter]);
  });
});

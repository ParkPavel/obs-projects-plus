// #117 — dashboardFilters routed through the canonical filter engine.
//
// Locks down `deriveTabCondition` (type-directed by DataFieldType) and the
// resulting `applyFilterTab` end-to-end behavior via `filterByLinkedSelection`
// / `matchesCondition`, replacing the old `String(raw) === value` comparator.

import { DataFieldType, type DataField, type DataFrame, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  applyFilterTab,
  deriveTabCondition,
  promoteFilterTabToGlobal,
  type ActiveFilterTab,
} from "../dashboardFilters";
import { matchesFilterConditions } from "src/lib/engine/filterEvaluator";
import type { FilterCondition, FilterDefinition } from "src/settings/base/settings";

const cond = (f: string, value: string): FilterCondition =>
  ({ field: f, operator: "is", value, enabled: true } as unknown as FilterCondition);

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false };
}

function record(id: string, values: DataRecord["values"]): DataRecord {
  return { id, values };
}

describe("deriveTabCondition", () => {
  const active: ActiveFilterTab = { field: "status", value: "Done" };

  it("String field -> default 'is'", () => {
    expect(deriveTabCondition(field("status", DataFieldType.String), active)).toEqual({
      field: "status",
      operator: "is",
      value: "Done",
      enabled: true,
    });
  });

  it("Select field -> default 'is'", () => {
    expect(deriveTabCondition(field("status", DataFieldType.Select), active)).toEqual({
      field: "status",
      operator: "is",
      value: "Done",
      enabled: true,
    });
  });

  it("Status field -> default 'is'", () => {
    expect(deriveTabCondition(field("status", DataFieldType.Status), active)).toEqual({
      field: "status",
      operator: "is",
      value: "Done",
      enabled: true,
    });
  });

  it("Relation field (bare-name tab) -> default 'is'", () => {
    const rel: ActiveFilterTab = { field: "client", value: "Acme Studio" };
    expect(deriveTabCondition(field("client", DataFieldType.Relation), rel)).toEqual({
      field: "client",
      operator: "is",
      value: "Acme Studio",
      enabled: true,
    });
  });

  it("Number field -> 'eq'", () => {
    const num: ActiveFilterTab = { field: "score", value: "42" };
    expect(deriveTabCondition(field("score", DataFieldType.Number), num)).toEqual({
      field: "score",
      operator: "eq",
      value: "42",
      enabled: true,
    });
  });

  it("Boolean field, value 'true' -> 'is-checked'", () => {
    const bool: ActiveFilterTab = { field: "archived", value: "true" };
    expect(deriveTabCondition(field("archived", DataFieldType.Boolean), bool)).toEqual({
      field: "archived",
      operator: "is-checked",
      enabled: true,
    });
  });

  it("Boolean field, value 'false' -> 'is-not-checked'", () => {
    const bool: ActiveFilterTab = { field: "archived", value: "false" };
    expect(deriveTabCondition(field("archived", DataFieldType.Boolean), bool)).toEqual({
      field: "archived",
      operator: "is-not-checked",
      enabled: true,
    });
  });

  it("Date field -> 'is-on'", () => {
    const date: ActiveFilterTab = { field: "due", value: "2026-08-24" };
    expect(deriveTabCondition(field("due", DataFieldType.Date), date)).toEqual({
      field: "due",
      operator: "is-on",
      value: "2026-08-24",
      enabled: true,
    });
  });

  it("List field -> 'has-any-of' with JSON-encoded single-value array", () => {
    const list: ActiveFilterTab = { field: "tags", value: "urgent" };
    expect(deriveTabCondition(field("tags", DataFieldType.List), list)).toEqual({
      field: "tags",
      operator: "has-any-of",
      value: JSON.stringify(["urgent"]),
      enabled: true,
    });
  });

  it("undefined field (lookup miss) -> default 'is'", () => {
    expect(deriveTabCondition(undefined, active)).toEqual({
      field: "status",
      operator: "is",
      value: "Done",
      enabled: true,
    });
  });
});

describe("applyFilterTab", () => {
  it("active === null returns frame unchanged", () => {
    const frame: DataFrame = {
      fields: [field("status", DataFieldType.String)],
      records: [record("1", { status: "Done" })],
    };
    expect(applyFilterTab(frame, null)).toBe(frame);
  });

  it("String field: exact match only", () => {
    const frame: DataFrame = {
      fields: [field("status", DataFieldType.String)],
      records: [record("1", { status: "Done" }), record("2", { status: "Todo" })],
    };
    const result = applyFilterTab(frame, { field: "status", value: "Done" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("Select field: exact match, no case-insensitive matching introduced", () => {
    const frame: DataFrame = {
      fields: [field("priority", DataFieldType.Select)],
      records: [record("1", { priority: "High" }), record("2", { priority: "high" })],
    };
    const result = applyFilterTab(frame, { field: "priority", value: "high" });
    // Only the lowercase-cell record matches; "High" must NOT match "high".
    expect(result.records.map((r) => r.id)).toEqual(["2"]);
  });

  it("Status field: exact match", () => {
    const frame: DataFrame = {
      fields: [field("stage", DataFieldType.Status)],
      records: [record("1", { stage: "In Progress" }), record("2", { stage: "Done" })],
    };
    const result = applyFilterTab(frame, { field: "stage", value: "Done" });
    expect(result.records.map((r) => r.id)).toEqual(["2"]);
  });

  it("Relation field: bare-name tab matches wikilink cell (regression fix)", () => {
    const frame: DataFrame = {
      fields: [field("client", DataFieldType.Relation)],
      records: [
        record("1", { client: "[[Acme Studio]]" }),
        record("2", { client: "[[Other Co]]" }),
      ],
    };
    const result = applyFilterTab(frame, { field: "client", value: "Acme Studio" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("Relation field: full-wikilink tab matches wikilink cell", () => {
    const frame: DataFrame = {
      fields: [field("client", DataFieldType.Relation)],
      records: [
        record("1", { client: "[[Acme Studio]]" }),
        record("2", { client: "[[Other Co]]" }),
      ],
    };
    const result = applyFilterTab(frame, { field: "client", value: "[[Acme Studio]]" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("Relation field: array-of-wikilinks cell matches", () => {
    const frame: DataFrame = {
      fields: [field("clients", DataFieldType.Relation)],
      records: [
        record("1", { clients: ["[[Acme Studio]]", "[[Other Co]]"] }),
        record("2", { clients: ["[[Other Co]]"] }),
      ],
    };
    const result = applyFilterTab(frame, { field: "clients", value: "Acme Studio" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("List field: match", () => {
    const frame: DataFrame = {
      fields: [field("tags", DataFieldType.List)],
      records: [
        record("1", { tags: ["urgent", "bug"] }),
        record("2", { tags: ["chore"] }),
      ],
    };
    const result = applyFilterTab(frame, { field: "tags", value: "urgent" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("List field: no match", () => {
    const frame: DataFrame = {
      fields: [field("tags", DataFieldType.List)],
      records: [record("1", { tags: ["chore"] })],
    };
    const result = applyFilterTab(frame, { field: "tags", value: "urgent" });
    expect(result.records).toEqual([]);
  });

  it("Number field: match (regression-guard — must not return zero results)", () => {
    const frame: DataFrame = {
      fields: [field("score", DataFieldType.Number)],
      records: [record("1", { score: 42 }), record("2", { score: 7 })],
    };
    const result = applyFilterTab(frame, { field: "score", value: "42" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("Number field: no match", () => {
    const frame: DataFrame = {
      fields: [field("score", DataFieldType.Number)],
      records: [record("1", { score: 7 })],
    };
    const result = applyFilterTab(frame, { field: "score", value: "42" });
    expect(result.records).toEqual([]);
  });

  it("Boolean field: true-tab vs true-cell matches (regression-guard)", () => {
    const frame: DataFrame = {
      fields: [field("archived", DataFieldType.Boolean)],
      records: [record("1", { archived: true }), record("2", { archived: false })],
    };
    const result = applyFilterTab(frame, { field: "archived", value: "true" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });

  it("Boolean field: true-tab vs false-cell no match", () => {
    const frame: DataFrame = {
      fields: [field("archived", DataFieldType.Boolean)],
      records: [record("1", { archived: false })],
    };
    const result = applyFilterTab(frame, { field: "archived", value: "true" });
    expect(result.records).toEqual([]);
  });

  it("field absent from frame.fields falls back gracefully without throwing", () => {
    const frame: DataFrame = {
      fields: [],
      records: [record("1", { status: "Done" }), record("2", { status: "Todo" })],
    };
    expect(() => applyFilterTab(frame, { field: "status", value: "Done" })).not.toThrow();
    const result = applyFilterTab(frame, { field: "status", value: "Done" });
    expect(result.records.map((r) => r.id)).toEqual(["1"]);
  });
});

// #123 — promoting a tab to the global filter used to emit a bare `"is"`
// regardless of the field type. `"is"` is a StringFilterOperator only, so for a
// Number/Boolean/Date/List field no typed branch in matchesCondition fires and
// every record is dropped. Each case below asserts the promoted condition still
// matches the record the tab itself selected.
describe("promoteFilterTabToGlobal (#123)", () => {
  const promoteAndMatch = (
    f: DataField,
    active: ActiveFilterTab,
    values: DataRecord["values"]
  ) => {
    const { conditions: [condition] } = promoteFilterTabToGlobal(active, undefined, [f]);
    expect(condition).toBeDefined();
    return matchesFilterConditions(
      { conjunction: "and", conditions: [condition as never] },
      record("r1", values)
    );
  };

  it("keeps the record for a Number field (regression: was operator 'is')", () => {
    const f = field("estimate", DataFieldType.Number);
    const { conditions: [condition] } = promoteFilterTabToGlobal({ field: "estimate", value: "3" }, undefined, [f]);

    expect(condition?.operator).toBe("eq");
    expect(promoteAndMatch(f, { field: "estimate", value: "3" }, { estimate: 3 })).toBe(true);
  });

  it("keeps the record for a Boolean field", () => {
    const f = field("done", DataFieldType.Boolean);
    const { conditions: [condition] } = promoteFilterTabToGlobal({ field: "done", value: "true" }, undefined, [f]);

    expect(condition?.operator).toBe("is-checked");
    expect(promoteAndMatch(f, { field: "done", value: "true" }, { done: true })).toBe(true);
  });

  it("keeps the record for a Date field", () => {
    const f = field("due", DataFieldType.Date);
    const { conditions: [condition] } = promoteFilterTabToGlobal({ field: "due", value: "2026-08-25" }, undefined, [f]);

    expect(condition?.operator).toBe("is-on");
    expect(
      promoteAndMatch(f, { field: "due", value: "2026-08-25" }, { due: new Date("2026-08-25") })
    ).toBe(true);
  });

  it("keeps the record for a List field", () => {
    const f = field("tags", DataFieldType.List);
    const { conditions: [condition] } = promoteFilterTabToGlobal({ field: "tags", value: "alpha" }, undefined, [f]);

    expect(condition?.operator).toBe("has-any-of");
    expect(promoteAndMatch(f, { field: "tags", value: "alpha" }, { tags: ["alpha", "beta"] })).toBe(
      true
    );
  });

  it("still emits 'is' for a String field", () => {
    const f = field("status", DataFieldType.String);
    const { conditions: [condition] } = promoteFilterTabToGlobal({ field: "status", value: "done" }, undefined, [f]);

    expect(condition?.operator).toBe("is");
    expect(condition?.value).toBe("done");
  });

  it("appends to the existing conditions instead of replacing them", () => {
    const existing: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("owner", "ann")],
    };
    const next = promoteFilterTabToGlobal(
      { field: "status", value: "done" },
      existing,
      [field("status", DataFieldType.String)]
    );

    expect(next.conditions).toHaveLength(2);
    expect(next.conditions[0]).toEqual(cond("owner", "ann"));
  });

  it("suppresses a duplicate of the derived condition", () => {
    const f = field("estimate", DataFieldType.Number);
    const once = promoteFilterTabToGlobal({ field: "estimate", value: "3" }, undefined, [f]);
    const twice = promoteFilterTabToGlobal({ field: "estimate", value: "3" }, once, [f]);

    expect(twice.conditions).toHaveLength(1);
  });

  it("does not confuse a Boolean true tab with a false one (neither carries a value)", () => {
    const f = field("done", DataFieldType.Boolean);
    const afterTrue = promoteFilterTabToGlobal({ field: "done", value: "true" }, undefined, [f]);
    const afterBoth = promoteFilterTabToGlobal({ field: "done", value: "false" }, afterTrue, [f]);

    expect(afterBoth.conditions).toHaveLength(2);
    expect(afterBoth.conditions.map((c) => c.operator)).toEqual([
      "is-checked",
      "is-not-checked",
    ]);
  });

  it("falls back to 'is' when the field is not in the frame", () => {
    const next = promoteFilterTabToGlobal({ field: "ghost", value: "x" }, undefined, []);

    expect(next.conditions[0]?.operator).toBe("is");
  });
});

// #125 — promoting a tab used to rebuild view.filter as a flat
// { conjunction: "and", conditions } from the ENABLED conditions only. Three
// separate losses in one click, one test each.
describe("promoteFilterTabToGlobal (#125) — preserves the stored filter", () => {
  const statusField = [field("status", DataFieldType.String)];
  const tab: ActiveFilterTab = { field: "status", value: "done" };

  it("keeps nested groups instead of erasing them", () => {
    const current: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("owner", "ann")],
      groups: [{ conjunction: "or", conditions: [cond("tier", "a"), cond("tier", "b")] }],
    };
    const next = promoteFilterTabToGlobal(tab, current, statusField);

    const preserved = JSON.stringify(next).includes('"tier"');
    expect(preserved).toBe(true);
  });

  it("does not force an 'or' filter into 'and' — that inverts what it means", () => {
    const current: FilterDefinition = {
      conjunction: "or",
      conditions: [cond("owner", "ann"), cond("owner", "bob")],
    };
    const next = promoteFilterTabToGlobal(tab, current, statusField);

    // The or-set must survive as a nested group, narrowed by the promoted
    // condition — never flattened into one and-list.
    expect(next.conjunction).toBe("and");
    expect(next.groups?.[0]).toEqual(current);
  });

  it("keeps disabled conditions that the caller never rendered", () => {
    const disabled = { ...cond("archived", "true"), enabled: false } as typeof current.conditions[number];
    const current: FilterDefinition = {
      conjunction: "and",
      conditions: [cond("owner", "ann"), disabled],
    };
    const next = promoteFilterTabToGlobal(tab, current, statusField);

    expect(next.conditions).toContainEqual(disabled);
  });

  it("dedups against a disabled condition too, instead of adding a second copy", () => {
    const current: FilterDefinition = {
      conjunction: "and",
      conditions: [{ ...cond("status", "done"), enabled: false } as typeof current.conditions[number]],
    };
    const next = promoteFilterTabToGlobal(tab, current, statusField);

    expect(next.conditions).toHaveLength(1);
  });

  it("returns a usable definition when there was no stored filter at all", () => {
    const next = promoteFilterTabToGlobal(tab, undefined, statusField);

    expect(next.conjunction).toBe("and");
    expect(next.conditions).toHaveLength(1);
    expect(next.groups).toBeUndefined();
  });
});

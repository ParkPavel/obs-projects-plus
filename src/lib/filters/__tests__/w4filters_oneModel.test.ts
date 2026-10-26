/**
 * w4-filters (N11) — one condition model: the agenda's stored groups bridge
 * to the view filter's definition without loss, the operator catalog is one,
 * and a date formula means the same day in the view's filter as in the agenda.
 *
 * Why these fail on the old code: there was no bridge module (the agenda had
 * its own editor), the agenda's catalog had `regex` and the select/status/
 * relation/formula/rollup sets the view's lacked, and the view's filter
 * compared "today" as text — nothing matched.
 */

import dayjs from "dayjs";
import { DataFieldType, type DataRecord } from "src/lib/dataframe/dataframe";
import { matchesFilterConditions } from "src/lib/engine/filterEvaluator";
import type { AgendaFilterGroup } from "src/settings/v3/settings";
import { getOperatorsForField } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";
import { getOperatorsForFieldType } from "src/ui/views/Calendar/agenda/operatorHelpers";
import { agendaGroupToDefinition, definitionToAgendaGroup } from "../agendaFilterModel";

const stored: AgendaFilterGroup = {
  id: "root",
  conjunction: "OR",
  filters: [
    { id: "a", field: "status", operator: "equals" as never, value: "Done" },
    { id: "b", field: "price", operator: "gt", value: 100 },
    { id: "c", field: "tags", operator: "has-any-of", value: ["x", "y"], enabled: false },
    { id: "d", field: "paid", operator: "is-checked", value: null, enabled: true },
  ],
  groups: [{ id: "inner", conjunction: "AND", filters: [{ id: "e", field: "due", operator: "is-today", value: null }], groups: [] }],
};

let n = 0;
const newId = () => `new-${++n}`;

describe("w4-filters — the agenda group and the condition model", () => {
  test("to the model: conjunction, legacy operator names, value texts, switched-off conditions kept", () => {
    const def = agendaGroupToDefinition(stored);
    expect(def.conjunction).toBe("or");
    expect(def.conditions.map((c) => c.operator)).toEqual(["is", "gt", "has-any-of", "is-checked"]);
    expect(def.conditions.map((c) => c.value)).toEqual(["Done", "100", '["x","y"]', undefined]);
    expect(def.conditions.map((c) => c.enabled)).toEqual([true, true, false, true]);
    expect(def.groups?.[0]?.conjunction).toBe("and");
  });

  test("an untouched round trip gives the stored group back (ids, value types, explicit enabled)", () => {
    const back = definitionToAgendaGroup(agendaGroupToDefinition(stored), stored, newId);
    expect(back.id).toBe("root");
    expect(back.conjunction).toBe("OR");
    expect(back.filters.map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
    expect(back.filters[1]!.value).toBe(100);
    expect(back.filters[2]!.value).toEqual(["x", "y"]);
    expect(back.filters[2]!.enabled).toBe(false);
    expect(back.filters[3]!.enabled).toBe(true);
    expect(back.filters[0]!.enabled).toBeUndefined();
    expect(back.groups[0]!.id).toBe("inner");
    expect(back.groups[0]!.filters[0]!.id).toBe("e");
  });

  test("an edit changes what was edited; a new condition and group get new ids", () => {
    const def = agendaGroupToDefinition(stored);
    const edited = {
      ...def,
      conditions: [
        { ...def.conditions[0]!, value: "Open" },
        def.conditions[1]!,
        { ...def.conditions[2]!, enabled: true },
        def.conditions[3]!,
        { field: "title", operator: "contains" as const, value: "x", enabled: true },
      ],
      groups: [...(def.groups ?? []), { conjunction: "and" as const, conditions: [], groups: [] }],
    };
    const back = definitionToAgendaGroup(edited, stored, newId);
    expect(back.filters[0]!.value).toBe("Open");
    expect(back.filters[2]!.enabled).toBeUndefined();
    expect(back.filters[4]!.id).toMatch(/^new-/);
    expect(back.groups[1]!.id).toMatch(/^new-/);
  });
});

describe("w4-filters — one operator catalog", () => {
  test("the agenda's names are the view filter's for every field type", () => {
    for (const type of Object.values(DataFieldType)) {
      expect(getOperatorsForFieldType(type)).toEqual(getOperatorsForField(type));
      expect(getOperatorsForField(type).length).toBeGreaterThan(0);
    }
  });

  test("the merged sets: text has regex, a choice has is/is-not, a rollup compares numbers", () => {
    expect(getOperatorsForField("string")).toContain("regex");
    expect(getOperatorsForField("select")).toEqual(["is-empty", "is-not-empty", "is", "is-not"]);
    expect(getOperatorsForField("status")).toEqual(["is-empty", "is-not-empty", "is", "is-not"]);
    expect(getOperatorsForField("relation")).toEqual(expect.arrayContaining(["contains", "not-contains"]));
    expect(getOperatorsForField("rollup")).toEqual(expect.arrayContaining(["eq", "gte", "is"]));
  });
});

describe("w4-filters — a date formula in the view's filter", () => {
  const record = (due: Date): DataRecord => ({ id: "n.md", values: { due } });

  test("'today' is today without a pinned day, as in the agenda", () => {
    const def = { conjunction: "and" as const, conditions: [{ field: "due", operator: "is-on" as const, value: "today", enabled: true }] };
    expect(matchesFilterConditions(def, record(dayjs().startOf("day").toDate()))).toBe(true);
    expect(matchesFilterConditions(def, record(dayjs().add(3, "day").toDate()))).toBe(false);
  });

  test("'today+7d' is a week ahead", () => {
    const def = { conjunction: "and" as const, conditions: [{ field: "due", operator: "is-on" as const, value: "today+7d", enabled: true }] };
    expect(matchesFilterConditions(def, record(dayjs().add(7, "day").toDate()))).toBe(true);
  });

  test("a plain date is still a plain date", () => {
    const day = dayjs("2026-03-12");
    const def = { conjunction: "and" as const, conditions: [{ field: "due", operator: "is-on" as const, value: "2026-03-12", enabled: true }] };
    expect(matchesFilterConditions(def, record(day.toDate()))).toBe(true);
  });
});

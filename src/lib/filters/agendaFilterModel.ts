// w4-filters (N11) — the agenda's list filter in the one condition model.
//
// An agenda list stores its conditions as an AgendaFilterGroup (ids on every
// condition and group, `AND`/`OR`, values of any type, operator names from
// v3.0.4 in old lists). The view's filter, the colour rules and now the
// agenda's editor all edit a FilterDefinition, and the filter engine evaluates
// one. These two functions are the whole bridge, and the stored format stays
// as it is: ids are kept by position, a value whose text did not change keeps
// its stored type, a condition switched off is written `enabled: false`.

import type { FilterCondition, FilterDefinition, FilterOperator } from "src/settings/base/settings";
import type { AgendaFilter, AgendaFilterGroup, AgendaFilterOperator } from "src/settings/v3/settings";

/** Operator names saved by v3.0.4, and their names now. */
export const LEGACY_AGENDA_OPERATORS: Readonly<Record<string, FilterOperator>> = {
  equals: "is", not_equals: "is-not", is_empty: "is-empty", is_not_empty: "is-not-empty",
  greater_than: "gt", less_than: "lt", greater_or_equal: "gte", less_or_equal: "lte",
  is_today: "is-today", is_this_week: "is-this-week", is_overdue: "is-overdue",
  is_upcoming: "is-upcoming", not_contains: "not-contains",
};

export function agendaOperator(op: string): FilterOperator {
  return LEGACY_AGENDA_OPERATORS[op] ?? (op as FilterOperator);
}

/** A stored agenda value as the condition's text (lists as JSON, as the engine reads them). */
export function agendaValueText(value: AgendaFilter["value"]): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

/** The condition model of an agenda group; switched-off conditions stay (the editor shows them). */
export function agendaGroupToDefinition(group: AgendaFilterGroup): FilterDefinition {
  return {
    conjunction: group.conjunction === "OR" ? "or" : "and",
    conditions: (group.filters ?? []).map((f): FilterCondition => {
      const value = agendaValueText(f.value);
      const base = { field: f.field, operator: agendaOperator(f.operator), enabled: f.enabled !== false };
      return value === undefined ? base : { ...base, value };
    }),
    groups: (group.groups ?? []).map(agendaGroupToDefinition),
  };
}

/**
 * The agenda group for an edited definition. `previous` is the group it was
 * made from: ids, value types and an explicit `enabled` are taken from the
 * condition or group at the same place; new ones get ids from `newId`.
 */
export function definitionToAgendaGroup(
  def: FilterDefinition,
  previous: AgendaFilterGroup | undefined,
  newId: () => string,
): AgendaFilterGroup {
  const filters = def.conditions.map((c, i): AgendaFilter => {
    const prev = previous?.filters?.[i];
    const sameText = prev !== undefined && agendaValueText(prev.value) === c.value;
    const value = sameText ? prev.value : c.value ?? null;
    const filter: AgendaFilter = {
      id: prev?.id ?? newId(),
      field: c.field,
      operator: c.operator as AgendaFilterOperator,
      value,
    };
    if (!c.enabled) return { ...filter, enabled: false };
    return prev?.enabled === true ? { ...filter, enabled: true } : filter;
  });
  return {
    id: previous?.id ?? newId(),
    conjunction: def.conjunction === "or" ? "OR" : "AND",
    filters,
    groups: (def.groups ?? []).map((g, i) => definitionToAgendaGroup(g, previous?.groups?.[i], newId)),
  };
}

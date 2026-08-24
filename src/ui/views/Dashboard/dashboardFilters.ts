// src/ui/views/Dashboard/dashboardFilters.ts
//
// R5-013 — Pure filter helpers extracted from DashboardCanvas.svelte.

import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/base/settings";
import { filterByLinkedSelection } from "./widgets/DatabaseCall/relationFilterAdapter";

export interface ActiveFilterTab {
  field: string;
  value: string;
}

/**
 * Derive the canonical `FilterCondition` for an active filter-tab
 * selection, dispatched by `DataFieldType` (never by field name) so the
 * comparison always matches the semantics `matchesCondition` applies
 * elsewhere for the same field type. #117.
 */
export function deriveTabCondition(
  field: DataField | undefined,
  active: ActiveFilterTab
): FilterCondition {
  switch (field?.type) {
    case DataFieldType.Number:
      return { field: active.field, operator: "eq", value: active.value, enabled: true };
    case DataFieldType.Boolean:
      return {
        field: active.field,
        operator: active.value === "true" ? "is-checked" : "is-not-checked",
        enabled: true,
      };
    case DataFieldType.Date:
      return { field: active.field, operator: "is-on", value: active.value, enabled: true };
    case DataFieldType.List:
      return {
        field: active.field,
        operator: "has-any-of",
        value: JSON.stringify([active.value]),
        enabled: true,
      };
    default:
      return { field: active.field, operator: "is", value: active.value, enabled: true };
  }
}

/** Narrow a frame by an active FilterTabs selection. Pure. */
export function applyFilterTab(
  frame: DataFrame,
  active: ActiveFilterTab | null
): DataFrame {
  if (!active) return frame;
  const field = frame.fields.find((f) => f.name === active.field);
  const cond = deriveTabCondition(field, active);
  return {
    ...frame,
    records: filterByLinkedSelection(frame.records, cond, frame.fields),
  };
}

/**
 * Append a local FilterTabs selection to the existing global filter list as
 * an `is` condition. Suppresses duplicates (same field+value+is). Returns
 * the next condition list to persist via `onViewFilterChange`.
 */
export function promoteFilterTabToGlobal(
  active: ActiveFilterTab,
  globalFilters: FilterCondition[]
): FilterCondition[] {
  const exists = globalFilters.some(
    (c) =>
      c.field === active.field &&
      c.operator === "is" &&
      String(c.value ?? "") === active.value
  );
  if (exists) return [...globalFilters];
  return [
    ...globalFilters,
    { field: active.field, operator: "is", value: active.value, enabled: true },
  ];
}

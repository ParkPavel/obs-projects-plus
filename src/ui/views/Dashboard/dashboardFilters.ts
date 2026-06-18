// src/ui/views/Dashboard/dashboardFilters.ts
//
// R5-013 — Pure filter helpers extracted from DashboardCanvas.svelte.

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/base/settings";

export interface ActiveFilterTab {
  field: string;
  value: string;
}

/** Narrow a frame by an active FilterTabs selection. Pure. */
export function applyFilterTab(
  frame: DataFrame,
  active: ActiveFilterTab | null
): DataFrame {
  if (!active) return frame;
  return {
    ...frame,
    records: frame.records.filter((r) => {
      const raw = r.values[active.field];
      return raw != null && String(raw) === active.value;
    }),
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

// src/ui/views/Dashboard/dashboardFilters.ts
//
// R5-013 — Pure filter helpers extracted from DashboardCanvas.svelte.

import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterCondition, FilterDefinition } from "src/settings/base/settings";
import { andComposeFilters } from "src/lib/engine/filterCompose";
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
 * Narrow the stored view filter by a local FilterTabs selection.
 *
 * #123: the condition is built by {@link deriveTabCondition}, so promoting a
 * tab keeps the exact semantics the tab itself applied. Emitting a bare `"is"`
 * here — as this did before — was silent data loss: `"is"` is a
 * `StringFilterOperator` only, so for a Number/Boolean/Date/List field no typed
 * branch in `matchesCondition` fires and every record is dropped.
 *
 * #125: takes and returns the whole {@link FilterDefinition} rather than a
 * condition array. Rebuilding a flat `{ conjunction: "and", conditions }` threw
 * away three things at once — nested `groups`, an `or` conjunction (which
 * inverts what the filter means, not merely how it is shaped), and every
 * disabled condition, because the caller only ever received the enabled ones.
 * Composition goes through {@link andComposeFilters}, so an `or` filter is
 * nested rather than appended to, and promoting always narrows.
 *
 * Duplicates are suppressed on the derived condition (field + operator +
 * value), not on the raw tab value: a Boolean tab carries no `value` at all.
 *
 * Resolves the field itself from `fields`, mirroring `applyFilterTab`, so the
 * caller cannot promote a tab with the wrong field descriptor.
 */
export function promoteFilterTabToGlobal(
  active: ActiveFilterTab,
  current: FilterDefinition | undefined,
  fields: readonly DataField[]
): FilterDefinition {
  const promoted = deriveTabCondition(
    fields.find((f) => f.name === active.field),
    active
  );

  // Dedup against every stored condition, including disabled ones. Matching
  // only the enabled set would append a second copy of a condition the user
  // had deliberately switched off.
  const stored = current?.conditions ?? [];
  const exists = stored.some(
    (c) =>
      c.field === promoted.field &&
      c.operator === promoted.operator &&
      String(c.value ?? "") === String(promoted.value ?? "")
  );
  if (exists) return current as FilterDefinition;

  return andComposeFilters([
    current,
    { conjunction: "and", conditions: [promoted] },
  ]) as FilterDefinition;
}

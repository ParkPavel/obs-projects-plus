/**
 * Phase 2b — pure helpers for FieldPreset snapshots on `DataTableConfig`.
 *
 * Scope is **strictly field-level**: a preset captures column-layout state
 * (visibility, order, width, pinning, sort, freeze, group-by, row-height,
 * wrap-text). It never touches `view.filter` or `config.widgets` — those
 * belong to the enclosing Database view, not to a per-table snapshot.
 */

import type {
  DataTableConfig,
  DataTableFieldConfig,
  DataTableSortCriteria,
  FieldPreset,
  GroupConfig,
} from "../../types";

/** Fields snapshotted from `DataTableConfig` into a `FieldPreset`. */
export const PRESETTABLE_KEYS = [
  "fieldConfig",
  "orderFields",
  "sortCriteria",
  "freezeUpTo",
  "groupBy",
  "rowHeight",
  "wrapText",
] as const;

/**
 * Build a `FieldPreset` payload from the current `DataTableConfig`.
 * Only field-scoped keys are copied. Returns the bare snapshot shape
 * (no id/label) so callers assign their own.
 */
export function snapshotFromTable(
  table: DataTableConfig,
): Omit<FieldPreset, "id" | "label"> {
  const snap: {
    fieldConfig?: DataTableFieldConfig;
    orderFields?: string[];
    sortCriteria?: DataTableSortCriteria[];
    freezeUpTo?: string;
    groupBy?: GroupConfig;
    rowHeight?: "compact" | "default" | "expanded";
    wrapText?: boolean;
  } = {};
  if (table.fieldConfig !== undefined) snap.fieldConfig = cloneFieldConfig(table.fieldConfig);
  if (table.orderFields !== undefined) snap.orderFields = [...table.orderFields];
  if (table.sortCriteria !== undefined)
    snap.sortCriteria = table.sortCriteria.map((c) => ({ ...c }));
  if (table.freezeUpTo !== undefined) snap.freezeUpTo = table.freezeUpTo;
  if (table.groupBy !== undefined) snap.groupBy = cloneGroupBy(table.groupBy);
  if (table.rowHeight !== undefined) snap.rowHeight = table.rowHeight;
  if (table.wrapText !== undefined) snap.wrapText = table.wrapText;
  return snap;
}

/**
 * Apply a `FieldPreset` onto a `DataTableConfig`, returning a new config.
 *
 * Semantics: the preset is an **exact layout**, not a diff. All
 * presettable keys on the returned config match the preset (absent in
 * preset ⇒ cleared in result). Non-presettable fields (aggregations,
 * conditionalFormats, defaultValues, hintDismissed, legacy sortField /
 * sortAsc) are preserved unchanged.
 */
export function applyPresetToTable(
  table: DataTableConfig,
  preset: FieldPreset,
): DataTableConfig {
  const stripped = stripPresettableKeys(table);
  const result: Record<string, unknown> = { ...stripped };
  if (preset.fieldConfig !== undefined)
    result["fieldConfig"] = cloneFieldConfig(preset.fieldConfig);
  if (preset.orderFields !== undefined) result["orderFields"] = [...preset.orderFields];
  if (preset.sortCriteria !== undefined)
    result["sortCriteria"] = preset.sortCriteria.map((c) => ({ ...c }));
  if (preset.freezeUpTo !== undefined) result["freezeUpTo"] = preset.freezeUpTo;
  if (preset.groupBy !== undefined) result["groupBy"] = cloneGroupBy(preset.groupBy);
  if (preset.rowHeight !== undefined) result["rowHeight"] = preset.rowHeight;
  if (preset.wrapText !== undefined) result["wrapText"] = preset.wrapText;
  return result as DataTableConfig;
}

/** Returns a shallow copy of `table` with all presettable keys removed. */
function stripPresettableKeys(table: DataTableConfig): DataTableConfig {
  const out: Record<string, unknown> = { ...table };
  for (const key of PRESETTABLE_KEYS) delete out[key];
  return out as DataTableConfig;
}

function cloneFieldConfig(fc: DataTableFieldConfig): DataTableFieldConfig {
  const out: Record<string, DataTableFieldConfig[string]> = {};
  for (const [k, v] of Object.entries(fc)) out[k] = { ...v };
  return out as DataTableFieldConfig;
}

function cloneGroupBy(g: GroupConfig): GroupConfig {
  return {
    ...g,
    hiddenGroups: [...g.hiddenGroups],
    collapsedGroups: [...g.collapsedGroups],
  };
}

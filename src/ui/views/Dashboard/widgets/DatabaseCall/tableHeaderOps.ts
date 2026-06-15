// tableHeaderOps.ts — F2.4 (#074, TABLE_V2_CANON §3): the column header menu
// and its config patches. Pure functions — the menu is data, patches are
// (config, action) → config; the Svelte layer only dispatches.

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { ContextMenuEntry } from "src/lib/contextMenu";
import type { ColumnAggregation, DataTableConfig, DataTableSortCriteria } from "../../types";

export type SortOrder = "asc" | "desc";

const NUMERIC_TYPES = new Set<DataFieldType>([
  DataFieldType.Number,
  DataFieldType.Formula,
  DataFieldType.Rollup,
]);

const BASE_CALCS: ReadonlyArray<ColumnAggregation> = ["count_total", "count_values", "percent_not_empty"];
const NUMERIC_CALCS: ReadonlyArray<ColumnAggregation> = ["sum", "avg", "median", "min", "max"];

export function calculateOptions(field: DataField): ColumnAggregation[] {
  return NUMERIC_TYPES.has(field.type) ? [...BASE_CALCS, ...NUMERIC_CALCS] : [...BASE_CALCS];
}

// ── Config patches (single-sort Notion semantics from the column menu) ──

export function applySortPatch(
  config: DataTableConfig | undefined,
  field: string,
  order: SortOrder | null
): DataTableConfig {
  const { sortField: _f, sortAsc: _a, ...rest } = config ?? {};
  void _f; void _a;
  const criteria: DataTableSortCriteria[] = order ? [{ field, order }] : [];
  return { ...rest, sortCriteria: criteria } as DataTableConfig;
}

export function applyHidePatch(config: DataTableConfig | undefined, field: string): DataTableConfig {
  return {
    ...config,
    fieldConfig: { ...config?.fieldConfig, [field]: { ...config?.fieldConfig?.[field], hide: true } },
  } as DataTableConfig;
}

export function applyWidthPatch(
  config: DataTableConfig | undefined,
  field: string,
  widthRem: number
): DataTableConfig {
  const rounded = Math.max(4, Math.round(widthRem * 4) / 4);
  return {
    ...config,
    fieldConfig: { ...config?.fieldConfig, [field]: { ...config?.fieldConfig?.[field], widthRem: rounded } },
  } as DataTableConfig;
}

export function applyGroupPatch(
  config: DataTableConfig | undefined,
  field: string | null
): DataTableConfig {
  const { groupBy: _omit, ...rest } = config ?? {};
  void _omit;
  if (field === null) return rest as DataTableConfig;
  return {
    ...rest,
    groupBy: { field, sortOrder: "asc", hiddenGroups: [], collapsedGroups: [], showEmptyGroups: false },
  } as DataTableConfig;
}

export function toggleGroupCollapsed(
  config: DataTableConfig | undefined,
  key: string
): DataTableConfig {
  const groupBy = config?.groupBy;
  if (!groupBy) return (config ?? {}) as DataTableConfig;
  const collapsed = new Set(groupBy.collapsedGroups ?? []);
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);
  return { ...config, groupBy: { ...groupBy, collapsedGroups: [...collapsed] } } as DataTableConfig;
}

export function applyCalculatePatch(
  config: DataTableConfig | undefined,
  field: string,
  fn: ColumnAggregation | null
): DataTableConfig {
  const aggregations: Record<string, ColumnAggregation> = { ...config?.aggregations };
  if (fn === null) delete aggregations[field];
  else aggregations[field] = fn;
  return {
    ...config,
    aggregations,
    showAggregationRow: Object.keys(aggregations).length > 0,
  } as DataTableConfig;
}

/** Pointer-driven column resize: live preview per move, commit on release. */
export function startColumnResize(
  e: PointerEvent,
  startRem: number,
  onLive: (rem: number) => void,
  onCommit: (rem: number) => void
): void {
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  let lastRem = startRem;
  const onMove = (ev: PointerEvent) => {
    lastRem = Math.max(4, startRem + (ev.clientX - startX) / 16);
    onLive(lastRem);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    onCommit(lastRem);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// ── Menu (canon §3: everything about a column lives in its header menu) ──

export function buildHeaderMenuEntries(opts: {
  field: DataField;
  isPrimary: boolean;
  currentSort: SortOrder | null;
  currentCalc: ColumnAggregation | undefined;
  groupedBy: boolean;
  t: (key: string, defaultValue: string) => string;
  onSort: (order: SortOrder | null) => void;
  onHide: () => void;
  onCalculate: (fn: ColumnAggregation | null) => void;
  onGroup: (group: boolean) => void;
}): ContextMenuEntry[] {
  const { field, isPrimary, currentSort, currentCalc, groupedBy, t, onSort, onHide, onCalculate, onGroup } = opts;
  const entries: ContextMenuEntry[] = [
    { title: t("views.dashboard.table-v2.sort-asc", "Sort ascending"), icon: "arrow-up", onClick: () => onSort("asc"), disabled: currentSort === "asc" },
    { title: t("views.dashboard.table-v2.sort-desc", "Sort descending"), icon: "arrow-down", onClick: () => onSort("desc"), disabled: currentSort === "desc" },
  ];
  if (currentSort) {
    entries.push({ title: t("views.dashboard.table-v2.sort-clear", "Clear sort"), icon: "x", onClick: () => onSort(null) });
  }
  entries.push({ separator: true });
  entries.push(
    groupedBy
      ? { title: t("views.dashboard.table-v2.ungroup", "Ungroup"), icon: "x", onClick: () => onGroup(false) }
      : { title: t("views.dashboard.table-v2.group-by", "Group by this field"), icon: "layers", onClick: () => onGroup(true) }
  );
  entries.push({
    title: t("views.dashboard.table-v2.calculate", "Calculate"),
    icon: "sigma",
    onClick: () => { /* submenu container */ },
    submenu: [
      { title: t("views.dashboard.table-v2.calc-none", "None"), icon: "x", disabled: currentCalc === undefined, onClick: () => onCalculate(null) },
      ...calculateOptions(field).map((fn) => ({
        title: fn.replace(/_/g, " "),
        icon: fn === currentCalc ? "check" : "sigma",
        onClick: () => onCalculate(fn),
      })),
    ],
  });
  if (!isPrimary) {
    entries.push({ separator: true });
    entries.push({ title: t("views.dashboard.table-v2.hide-field", "Hide in view"), icon: "eye-off", onClick: onHide });
  }
  return entries;
}

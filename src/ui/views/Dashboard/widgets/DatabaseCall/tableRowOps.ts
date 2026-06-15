// tableRowOps.ts — F2.3 (#074, TABLE_V2_CANON §3): row operations behind
// Table V2. Kept out of the orchestrator so DataTableContent stays within
// its canon budget and the operations are unit-testable.

import type { App } from "obsidian";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import { createDataRecord } from "src/lib/dataApi";
import type { ContextMenuEntry } from "src/lib/contextMenu";
import {
  dataTableSourceId,
  type SelectionState,
  type SelectionStore,
} from "../../canvasSelectionStore";

export function recordBaseName(record: DataRecord): string {
  const file = record.id.split("/").pop() ?? record.id;
  return file.replace(/\.md$/, "");
}

export function duplicateRecord(
  record: DataRecord,
  project: ProjectDefinition,
  fields: DataField[],
  api: ViewApi
): void {
  const copy = createDataRecord(`${recordBaseName(record)} (copy)`, project, { ...record.values });
  api.addRecord(copy, fields, "");
}

export function createNamedRecord(
  name: string,
  project: ProjectDefinition,
  fields: DataField[],
  api: ViewApi
): void {
  api.addRecord(createDataRecord(name, project), fields, "");
}

// ── Selection Bus driver (R3 — Table V2 finally drives linked blocks) ──
// V1 resolution kept: the driver is a labeled row-menu entry (toggle), so
// click-to-edit stays untouched. Publishes the row's identity value under
// the primary field — linked blocks filter their relationField by it.

export function rowSelectionValue(record: DataRecord): string {
  return recordBaseName(record);
}

export function isRowDriving(
  selection: SelectionState,
  widgetId: string,
  record: DataRecord
): boolean {
  return (
    selection.source === dataTableSourceId(widgetId) &&
    selection.values.length === 1 &&
    selection.values[0] === rowSelectionValue(record)
  );
}

export function toggleRowSelection(opts: {
  store: SelectionStore;
  selection: SelectionState;
  widgetId: string;
  primaryField: string;
  record: DataRecord;
}): void {
  const { store, selection, widgetId, primaryField, record } = opts;
  if (isRowDriving(selection, widgetId, record)) {
    store.clearSelection();
    return;
  }
  store.setSelection({
    source: dataTableSourceId(widgetId),
    field: primaryField,
    values: [rowSelectionValue(record)],
  });
}

export function buildRowMenuEntries(opts: {
  record: DataRecord;
  project: ProjectDefinition | undefined;
  fields: DataField[];
  api: ViewApi;
  app: App | undefined;
  t: (key: string, defaultValue: string) => string;
  /** Selection Bus driver entry (omitted when the canvas has no store). */
  selectionEntry?: { driving: boolean; onToggle: () => void } | undefined;
}): ContextMenuEntry[] {
  const { record, project, fields, api, app, t, selectionEntry } = opts;
  const selectionEntries: ContextMenuEntry[] = selectionEntry
    ? [
        {
          title: selectionEntry.driving
            ? t("views.dashboard.table-v2.unfilter-canvas", "Stop filtering canvas by this row")
            : t("views.dashboard.table-v2.filter-canvas", "Filter linked blocks by this row"),
          icon: selectionEntry.driving ? "filter-x" : "filter",
          onClick: selectionEntry.onToggle,
        },
        { separator: true },
      ]
    : [];
  return [
    ...selectionEntries,
    {
      title: t("views.dashboard.table-v2.open", "Open note"),
      icon: "arrow-up-right",
      onClick: () => app?.workspace.openLinkText(record.id, record.id, false),
    },
    {
      title: t("views.dashboard.table-v2.open-new-tab", "Open in new tab"),
      icon: "external-link",
      onClick: () => app?.workspace.openLinkText(record.id, record.id, true),
    },
    { separator: true },
    {
      title: t("views.dashboard.table-v2.duplicate", "Duplicate"),
      icon: "copy",
      disabled: !project,
      onClick: () => { if (project) duplicateRecord(record, project, fields, api); },
    },
    {
      title: t("views.dashboard.table-v2.delete", "Delete note"),
      icon: "trash",
      danger: true,
      onClick: () => api.deleteRecord(record.id),
    },
  ];
}

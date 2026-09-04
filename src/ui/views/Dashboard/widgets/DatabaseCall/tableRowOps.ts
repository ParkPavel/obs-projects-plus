// tableRowOps.ts — F2.3 (#074, TABLE_V2_CANON §3): row operations behind
// Table V2. Kept out of the orchestrator so DataTableContent stays within
// its canon budget and the operations are unit-testable.

import type { App } from "obsidian";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import { createDataRecord } from "src/lib/dataApi";
import { openRecord, PLAIN_MODE } from "src/lib/record/openRecord";
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

/**
 * The row menu, including on a READ-ONLY table (#189 follow-up).
 *
 * `{#if !readonly}` used to hide the ⋯ button entirely, making "Show fields"
 * unreachable on the very table it was written for — an external source, whose
 * rows the host frame cannot resolve and the peek is the only way to read.
 * `alt` still worked, so the feature was hidden rather than gone, and hidden is
 * what the user's decision rules out. So `readonly` narrows the menu instead of
 * removing it, and does so HERE: what is safe on a table you cannot write to is
 * one judgement, and it gets one home.
 *
 *   - Read (Open, Open in new tab, Show fields) — always.
 *   - Mutating (Duplicate, Delete) — absent when `readonly`, not disabled. A
 *     greyed-out Delete still says the row is deletable, which is the untruth.
 *   - Selection Bus (Filter linked blocks) — kept: it writes to a per-canvas
 *     in-memory store, never the vault, so it READS the canvas, and it is most
 *     useful on exactly a source the reader cannot edit.
 */
export function buildRowMenuEntries(opts: {
  record: DataRecord;
  project: ProjectDefinition | undefined;
  fields: DataField[];
  api: ViewApi;
  app: App | undefined;
  /** Writes are not offered when true; reads still are. */
  readonly: boolean;
  t: (key: string, defaultValue: string) => string;
  /** Selection Bus driver entry (omitted when the canvas has no store). */
  selectionEntry?: { driving: boolean; onToggle: () => void } | undefined;
}): ContextMenuEntry[] {
  const { record, project, fields, api, app, readonly, t, selectionEntry } = opts;
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
      onClick: () => { if (app) void openRecord({ id: record.id }, PLAIN_MODE, { app }); },
    },
    {
      title: t("views.dashboard.table-v2.open-new-tab", "Open in new tab"),
      icon: "external-link",
      onClick: () => { if (app) void openRecord({ id: record.id }, "tab", { app }); },
    },
    // #189 — the peek's discoverable entrance. `alt`+activation reaches the
    // same mode, but a modifier nobody is told about is not a feature, and the
    // user asked for both. `record` and `fields` go with it because this table
    // may read an EXTERNAL source whose rows the host view's frame cannot
    // resolve — without them those rows would open a panel showing nothing.
    {
      title: t("views.dashboard.table-v2.peek", "Show fields"),
      icon: "panel-right-open",
      onClick: () => { if (app) void openRecord({ id: record.id, record, fields }, "peek", { app }); },
    },
    // The separator belongs to the group it introduces, so a read-only menu
    // ends on its last real entry instead of a rule with nothing under it.
    ...(readonly
      ? []
      : ([
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
        ] as ContextMenuEntry[])),
  ];
}

// tableRowOps.ts — F2.3 (#074, TABLE_V2_CANON §3): row operations behind
// Table V2. Kept out of the orchestrator so DataTableContent stays within
// its canon budget and the operations are unit-testable.

import type { App } from "obsidian";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import { createDataRecord } from "src/lib/dataApi";
import type { ContextMenuEntry } from "src/lib/contextMenu";

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

export function buildRowMenuEntries(opts: {
  record: DataRecord;
  project: ProjectDefinition | undefined;
  fields: DataField[];
  api: ViewApi;
  app: App | undefined;
  t: (key: string, defaultValue: string) => string;
}): ContextMenuEntry[] {
  const { record, project, fields, api, app, t } = opts;
  return [
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

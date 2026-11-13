import type { DataField, DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { ProjectDefinition } from "src/settings/settings";
import { get } from "svelte/store";
import { settings } from "src/lib/stores/settings";
import { openContextMenu } from "src/lib/contextMenu";
import { createRelationSetupController } from "../../relationSetupController";
import { buildRowMenuEntries, isRowDriving, toggleRowSelection } from "./tableRowOps";
import type { SelectionStore, SelectionState } from "../../canvasSelectionStore";

/** UI glue belongs with the operations, not the table's render pipeline. */
export function openTableRowMenu(
  detail: { record: DataRecord; event: MouseEvent },
  context: Omit<Parameters<typeof buildRowMenuEntries>[0], "record" | "selectionEntry"> & {
    primaryField: string;
    selection: SelectionState;
    selectionStore: SelectionStore | undefined;
    widgetId: string | undefined;
  },
): void {
  const { selectionStore: store, selection, widgetId, primaryField, ...menuContext } = context;
  const record = detail.record;
  openContextMenu(buildRowMenuEntries({
    ...menuContext, record,
    selectionEntry: store && widgetId ? {
      driving: isRowDriving(selection, widgetId, record),
      onToggle: () => toggleRowSelection({ store, selection, widgetId, primaryField, record }),
    } : undefined,
  }), detail.event);
}

export function setupTableRelation(field: DataField, context: {
  app: Parameters<typeof createRelationSetupController>[0]["app"];
  api: ViewApi;
  project: ProjectDefinition | undefined;
  frame: DataFrame;
  t: Parameters<typeof createRelationSetupController>[0]["t"];
}): void {
  const { app, api, project, frame, t } = context;
  if (!project?.id) return;
  const rel = field.typeConfig?.relation;
  const displayField = rel?.displayField;
  void createRelationSetupController({
    app, api, getProjectId: () => project.id, getFrame: () => frame,
    getProjects: () => get(settings).projects, t,
  }).open({
    fieldName: field.name, targetProjectId: rel?.targetProjectId ?? "", createSourceField: false,
    ...(displayField !== undefined ? { displayField } : {}),
  });
}

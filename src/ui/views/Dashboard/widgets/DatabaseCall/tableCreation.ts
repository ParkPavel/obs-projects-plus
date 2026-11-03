import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";
import { createDataRecord } from "src/lib/dataApi";
import { getFilterValuesFromConditions } from "src/lib/helpers";
import { noteNameProblem } from "src/ui/modals/createNoteModal";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { FilterCondition, ProjectDefinition } from "src/settings/settings";

export function tableCreationContext(project: ProjectDefinition | undefined, sourceId: string | undefined, fields: DataField[], conditions: FilterCondition[], readonly: boolean): string {
  return JSON.stringify([project?.id, project?.dataSource, project?.newNotesFolder, sourceId, fields, conditions, readonly]);
}

export async function createNamedRecord(name: string, project: ProjectDefinition, fields: DataField[], api: ViewApi, values?: DataRecord["values"]): Promise<void> {
  const problem = noteNameProblem(get(app), project, name);
  if (problem) throw new Error(problem);
  await api.addRecord(createDataRecord(name, project, values), fields, "");
}

/** Capture the writer, destination and defaults, rather than reading a later source. */
export function bindTableCreation(project: ProjectDefinition | undefined, fields: DataField[], api: ViewApi, conditions: FilterCondition[]) {
  const values = getFilterValuesFromConditions(conditions);
  const schema = JSON.parse(JSON.stringify(fields)) as DataField[];
  const destination = project ? { ...project, dataSource: JSON.parse(JSON.stringify(project.dataSource)) as ProjectDefinition["dataSource"] } : undefined;
  return async (name: string): Promise<void> => {
    if (!destination) throw new Error("A project is required to create a table record");
    await createNamedRecord(name, destination, schema, api, values);
  };
}

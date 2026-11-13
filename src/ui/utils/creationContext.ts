import type { DataField } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import type { FilterCondition, ProjectDefinition } from "src/settings/settings";
import { getFilterValuesFromConditions } from "src/lib/helpers";
const identities = new WeakMap<object, number>();
let nextIdentity = 0;
function identity(value: object): number {
  if (!identities.has(value)) identities.set(value, ++nextIdentity);
  return identities.get(value)!;
}

/** A wrapper refresh with the same source/writer preserves the original input. */
export function creationContextKey(project: ProjectDefinition | undefined, sourceId: string | undefined, fields: readonly DataField[], conditions: FilterCondition[], readonly: boolean, api?: ViewApi): string {
  return JSON.stringify([
    project?.id, project?.dataSource, project?.newNotesFolder, project?.templates, sourceId,
    fields, getFilterValuesFromConditions(conditions), readonly,
    api && [identity(api.dataSource ?? api), identity(api.dataApi ?? api)],
  ]);
}

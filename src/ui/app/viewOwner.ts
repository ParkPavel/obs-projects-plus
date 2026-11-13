import type { ProjectId, ViewId } from "src/settings/settings";

/** A deferred view callback keeps the owner it was given, across navigation. */
export function bindViewOwner<T>(
  projectId: ProjectId,
  viewId: ViewId,
  save: (projectId: ProjectId, viewId: ViewId, value: T) => void
): (value: T) => void {
  return (value) => save(projectId, viewId, value);
}

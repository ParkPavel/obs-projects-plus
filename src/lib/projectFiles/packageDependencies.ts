import type { LatestProjectsPluginSettings, ProjectDefinition } from "src/settings/settings";
import { extractRelationTargetIds } from "src/lib/relations/relationTargets";
import { blockAt, dashboardsOf, parseBlockRef, refsReadBy } from "src/lib/relations/blockRefs";
import { parseBaseRef } from "src/lib/relations/baseRef";
import { checkProject, projectFileError } from "./document";

export interface PackageDependency { from: string; reference: string; target: string; resolved: boolean }
export interface PackageProject { project: ProjectDefinition; archived: boolean }

/** Known typed runtime references only. Opaque custom configs are preserved, never rewritten. */
export function packageDependencies(settings: LatestProjectsPluginSettings, rootId: string): { projects: PackageProject[]; dependencies: PackageDependency[] } {
  const all = [...settings.projects.map(project => ({ project, archived: false })), ...settings.archives.map(project => ({ project, archived: true }))];
  const byId = new Map<string, PackageProject>();
  for (const item of all) {
    checkProject(item.project);
    if (byId.has(item.project.id)) throw projectFileError("duplicate package project identity");
    byId.set(item.project.id, item);
  }
  if (!byId.has(rootId)) throw projectFileError("package project missing");
  const pending = [rootId], visited = new Set<string>(), projects: PackageProject[] = [], dependencies: PackageDependency[] = [];
  while (pending.length) {
    const id = pending.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const item = byId.get(id)!;
    projects.push(item);
    if (projects.length > 100) throw projectFileError("too many package dependencies");
    const references = new Set(extractRelationTargetIds(id, item.project.fieldConfig));
    for (const dashboard of dashboardsOf(item.project)) for (const widget of dashboard.widgets) {
      for (const reference of refsReadBy(widget)) references.add(reference);
    }
    for (const reference of references) {
      const ref = parseBaseRef(reference), target = byId.get(ref.projectId);
      const block = parseBlockRef(reference);
      const resolved = !!target && (block ? !!blockAt(all.map(item => item.project), block)
        : !ref.sourceId || (target.project.dataSource as { id?: string }).id === ref.sourceId || target.project.additionalSources?.some(source => (source as { id?: string }).id === ref.sourceId) === true);
      dependencies.push({ from: id, reference, target: ref.projectId, resolved });
      if (target && !visited.has(ref.projectId)) pending.push(ref.projectId);
    }
  }
  return { projects, dependencies };
}

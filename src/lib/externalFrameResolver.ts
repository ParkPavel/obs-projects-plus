// src/lib/externalFrameResolver.ts
// Pillar 5 (Phase 5 UI): resolve DataFrame for a sibling project by id.
// Used by DatabaseViewCanvas to preload right-hand frames for JoinStep /
// ScatterConfig.correlation without every widget owning a DataSource.

import type { App } from "obsidian";
import type { DataviewApi } from "obsidian-dataview";
import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { ProjectDefinition, ProjectsPluginPreferences } from "src/settings/settings";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { TagDataSource } from "src/lib/datasources/tag/datasource";
import { DataviewDataSource } from "src/lib/datasources/dataview/datasource";

export interface ResolverDeps {
  readonly fileSystem: IFileSystem;
  readonly preferences: ProjectsPluginPreferences;
  readonly projects: ReadonlyArray<ProjectDefinition>;
  readonly dataviewApi?: DataviewApi | undefined;
  /** Reserved for future use (e.g. vault event subscriptions). */
  readonly app?: App | undefined;
}

// Throttle repeat warnings for the same project id so a cascade of reactive
// invalidations (e.g. after a sibling-project file rename) does not flood the
// console. The window is intentionally short — just enough to collapse the
// synchronous burst from vault events.
const WARN_THROTTLE_MS = 5_000;
const recentWarnings = new Map<string, number>();

function warnThrottled(projectId: string, err: unknown): void {
  const now = Date.now();
  const last = recentWarnings.get(projectId) ?? 0;
  if (now - last < WARN_THROTTLE_MS) return;
  recentWarnings.set(projectId, now);
  // eslint-disable-next-line no-console
  console.warn(`[obs-projects-plus] resolveExternalFrame(${projectId}) failed`, err);
}

/**
 * Resolve a DataFrame for the given project id. Returns `null` when the
 * project is not found or when its DataSource cannot be constructed (e.g.
 * Dataview not installed but requested). Errors are captured and throttled
 * so correlation widgets degrade gracefully without spamming the console.
 */
export async function resolveExternalFrame(
  projectId: string,
  deps: ResolverDeps
): Promise<DataFrame | null> {
  const project = deps.projects.find((p) => p.id === projectId);
  if (!project) return null;

  try {
    switch (project.dataSource.kind) {
      case "dataview": {
        if (!deps.dataviewApi) return null;
        const ds = new DataviewDataSource(
          deps.fileSystem,
          project,
          deps.preferences,
          deps.dataviewApi
        );
        return await ds.queryAll();
      }
      case "tag": {
        const ds = new TagDataSource(deps.fileSystem, project, deps.preferences);
        return await ds.queryAll();
      }
      case "folder":
      default: {
        const ds = new FolderDataSource(deps.fileSystem, project, deps.preferences);
        return await ds.queryAll();
      }
    }
  } catch (err) {
    warnThrottled(projectId, err);
    return null;
  }
}

// src/lib/externalFrameResolver.ts
// Pillar 5 (Phase 5 UI): resolve DataFrame for a sibling project by id.
// Used by DatabaseViewCanvas to preload right-hand frames for JoinStep /
// ScatterConfig.correlation without every widget owning a DataSource.

import type { App } from "obsidian";
import type { DataviewApi } from "obsidian-dataview";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
import type { ProjectDefinition, ProjectsPluginPreferences } from "src/settings/settings";
import type { IFileSystem } from "src/lib/filesystem/filesystem";
import { createDataSource } from "src/lib/datasources";

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

/** Non-derived Relation fields, the ones backlink enrichment is defined over. */
function relationFieldNames(frame: DataFrame): string[] {
  return frame.fields
    .filter((f) => f.type === DataFieldType.Relation && !f.derived)
    .map((f) => f.name);
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
    const resolution = createDataSource(project, {
      fileSystem: deps.fileSystem,
      preferences: deps.preferences,
      dataviewApi: deps.dataviewApi,
    });
    if (resolution.kind === "unavailable") {
      return null;
    }
    const frame = await resolution.source.queryAll();

    // #138: enrich here, so every frame reaching a widget has the same shape
    // regardless of origin. Previously only the parent frame got backlinks
    // (WidgetHost did it per widget), so a relation view over an external
    // source was missing derived fields the identical view over the parent
    // project had — and a block could tell where its records came from by
    // which fields existed.
    //
    // This point rather than the canvas preloader or the widget host: App
    // already caches this promise per project id, so the work happens once per
    // source instead of once per canvas or once per widget.
    return enrichWithBacklinks(frame, relationFieldNames(frame));
  } catch (err) {
    warnThrottled(projectId, err);
    return null;
  }
}

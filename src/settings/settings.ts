import { either } from "fp-ts";

import type { ViewDefinition, ProjectsPluginPreferences } from "./base/settings";
import type { ProjectDefinition as V1ProjectDefinition, ProjectsPluginSettings as V1ProjectsPluginSettings } from "./v1/settings";
import { resolve as v1Resolve } from "./v1/settings";
import type { ProjectDefinition as V2ProjectDefinition, ProjectsPluginSettings as V2ProjectsPluginSettings } from "./v2/settings";
import { resolve as v2Resolve } from "./v2/settings";

export * from "./base/settings";

// These types are backwards-compatible and does not yet need versioning.
export type ProjectPreferences = ProjectsPluginPreferences;

// This defines the latest version of the project definition.
export type ProjectDefinition = V2ProjectDefinition<ViewDefinition>;

// Defines the latest version of the plugin settings.
export type LatestProjectsPluginSettings = V2ProjectsPluginSettings<
  ProjectDefinition,
  ProjectPreferences
>;

export const DEFAULT_SETTINGS = v2Resolve({ version: 2 });
export const DEFAULT_PROJECT = {
  fieldConfig: {},
  defaultName: "",
  templates: [],
  excludedNotes: [],
  isDefault: false,
  dataSource: {
    kind: "folder" as const,
    config: {
      path: "",
      recursive: false,
    },
  },
  newNotesFolder: "",
  views: [],
};

/**
 * migrateSettings accepts the value from Plugin.loadData() and returns the most
 * recent settings. If needed, it applies any necessary migrations.
 */
export function migrateSettings(
  settings: any
): either.Either<Error, LatestProjectsPluginSettings> {
  if (!settings) {
    return either.right(Object.assign({}, v2Resolve({ version: 2 })));
  }

  if ("version" in settings && typeof settings.version === "number") {
    if (settings.version === 1) {
      return either.right(migrate(v1Resolve(settings)));
    } else if (settings.version === 2) {
      return either.right(v2Resolve(settings));
    } else {
      return either.left(new Error("Unknown settings version"));
    }
  }

  return either.left(new Error("Missing settings version"));
}

export function migrate(
  v1settings: V1ProjectsPluginSettings<V1ProjectDefinition<ViewDefinition>>
): LatestProjectsPluginSettings {
  return {
    version: 2,
    projects: v1settings.projects.map(migrateProject),
    archives: [],
    preferences: v1settings.preferences,
  };
}

function migrateProject(
  v1project: V1ProjectDefinition<ViewDefinition>
): V2ProjectDefinition<ViewDefinition> {
  const {
    name,
    id,
    fieldConfig,
    templates,
    defaultName,
    excludedNotes,
    isDefault,
    views,
  } = v1project;

  const common = {
    name,
    id,
    fieldConfig,
    defaultName,
    templates,
    excludedNotes,
    isDefault,
    views,
  };

  return {
    ...common,
    newNotesFolder: "",
    dataSource: migrateDataSource(v1project),
  };
}

function migrateDataSource(
  project: V1ProjectDefinition<ViewDefinition>
): { kind: "dataview" | "folder"; config: any } {
  if (project.dataview) {
    return {
      kind: "dataview",
      config: {
        query: project.query,
      },
    };
  }

  return {
    kind: "folder",
    config: {
      path: project.path,
      recursive: project.recursive,
    },
  };
}

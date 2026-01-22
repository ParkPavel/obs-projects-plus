import { either } from "fp-ts";

import type { ViewDefinition, ProjectsPluginPreferences } from "./base/settings";
import type { ProjectDefinition as V1ProjectDefinition, ProjectsPluginSettings as V1ProjectsPluginSettings } from "./v1/settings";
import { resolve as v1Resolve } from "./v1/settings";
import type { ProjectDefinition as V2ProjectDefinition, ProjectsPluginSettings as V2ProjectsPluginSettings } from "./v2/settings";
import { resolve as v2Resolve } from "./v2/settings";
import type { ProjectDefinition as V3ProjectDefinition, ProjectsPluginSettings as V3ProjectsPluginSettings } from "./v3/settings";
import { resolve as v3Resolve } from "./v3/settings";

export * from "./base/settings";

// These types are backwards-compatible and does not yet need versioning.
export type ProjectPreferences = ProjectsPluginPreferences;

// This defines the latest version of the project definition.
export type ProjectDefinition = V3ProjectDefinition<ViewDefinition>;

// Defines the latest version of the plugin settings.
export type LatestProjectsPluginSettings = V3ProjectsPluginSettings<
  ProjectDefinition,
  ProjectPreferences
>;

export const DEFAULT_SETTINGS = v3Resolve({ version: 3 });
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
  dateFormat: {
    writeFormat: "YYYY-MM-DD",
    preset: "iso" as const,
  },
};

/**
 * migrateSettings accepts the value from Plugin.loadData() and returns the most
 * recent settings. If needed, it applies any necessary migrations.
 */
export function migrateSettings(
  settings: any
): either.Either<Error, LatestProjectsPluginSettings> {
  if (!settings) {
    return either.right(Object.assign({}, v3Resolve({ version: 3 })));
  }

  if ("version" in settings && typeof settings.version === "number") {
    if (settings.version === 1) {
      return either.right(migrate(v1Resolve(settings)));
    } else if (settings.version === 2) {
      return either.right(migrateV2ToV3(v2Resolve(settings)));
    } else if (settings.version === 3) {
      return either.right(v3Resolve(settings));
    } else {
      return either.left(new Error("Unknown settings version"));
    }
  }

  return either.left(new Error("Missing settings version"));
}

export function migrate(
  v1settings: V1ProjectsPluginSettings<V1ProjectDefinition<ViewDefinition>>
): LatestProjectsPluginSettings {
  const v2settings = migrateV1ToV2(v1settings);
  return migrateV2ToV3(v2settings);
}

function migrateV1ToV2(
  v1settings: V1ProjectsPluginSettings<V1ProjectDefinition<ViewDefinition>>
): V2ProjectsPluginSettings<V2ProjectDefinition<ViewDefinition>, ProjectPreferences> {
  return {
    version: 2,
    projects: v1settings.projects.map(migrateProjectFromV1),
    archives: [],
    preferences: v1settings.preferences,
  };
}

function migrateProjectFromV1(
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

function migrateV2ToV3(
  v2settings: V2ProjectsPluginSettings<
    V2ProjectDefinition<ViewDefinition>,
    ProjectPreferences
  >
): LatestProjectsPluginSettings {
  return {
    version: 3,
    projects: v2settings.projects.map(migrateProjectFromV2),
    archives: v2settings.archives.map(migrateProjectFromV2),
    preferences: v2settings.preferences,
  };
}

function migrateProjectFromV2(
  project: V2ProjectDefinition<ViewDefinition>
): ProjectDefinition {
  return {
    ...project,
    views: project.views.map(migrateViewDefinition),
  };
}

function migrateViewDefinition(view: ViewDefinition): ViewDefinition {
  if (view.type === "calendar") {
    return {
      ...view,
      config: {
        // New v3.0.0 fields
        displayMode: "headers", // default grid; timeline bars auto-enabled in non-month intervals
        startDateField: "startDate",
        endDateField: "endDate",
        startTimeField: "startTime",
        endTimeField: "endTime",
        eventColorField: "eventColor",
        agendaOpen: false,
        timeFormat: "24h",
        timezone: "local",
        ...view.config,
      },
    };
  }

  if (view.type === "board") {
    return {
      ...view,
      config: {
        freezeAll: false,
        freezeColumns: false,
        ...view.config,
      },
    };
  }

  return view;
}

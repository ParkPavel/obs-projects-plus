import type {
  FieldConfig,
  ProjectId,
  ProjectsPluginPreferences,
  ShowCommand,
  ViewDefinition,
} from "../base/settings";
import { DEFAULT_VIEW } from "../base/settings";
import { defaultModeForFunction } from "src/lib/database/rollupMode";
import { migrateAggregationCount } from "src/ui/views/Dashboard/migration";

// Re-use v3 date/agenda types — no structural changes in v4.
export type {
  DateFormatPreset,
  DateFormatConfig,
  AgendaMode,
  AgendaIcon,
  AgendaFilterMode,
  AgendaFilterOperator,
  AgendaFilter,
  AgendaFilterGroup,
  AgendaCustomList,
  AgendaConfig,
  DataSource,
  FolderDataSource,
  TagDataSource,
  DataviewDataSource,
  NativeQueryDataSource,
} from "../v3/settings";

export {
  DEFAULT_DATE_FORMAT,
  DEFAULT_AGENDA_CONFIG,
  DATE_FORMAT_PRESETS,
} from "../v3/settings";

import type { DateFormatConfig, AgendaConfig } from "../v3/settings";
import { DEFAULT_DATE_FORMAT } from "../v3/settings";

export type ProjectDefinition<ViewDef> = {
  readonly name: string;
  readonly id: ProjectId;

  readonly fieldConfig: { [field: string]: FieldConfig };
  readonly views: ViewDef[];
  readonly defaultName: string;
  readonly templates: string[];
  readonly excludedNotes: string[];
  readonly isDefault: boolean;
  readonly dataSource: import("../v3/settings").DataSource;
  readonly additionalSources?: import("../v3/settings").DataSource[];
  readonly newNotesFolder: string;
  readonly dateFormat?: DateFormatConfig;
  readonly autosave?: boolean;
  readonly agenda?: AgendaConfig;
  /**
   * NPLAN-A2 — Per-project monotonic counter feeding `UniqueId`
   * fields. Incremented on `createDataRecord`. Optional for
   * back-compat: undefined → treat as 0 on first read.
   */
  readonly uniqueIdCounter?: number;
};

export type UnsavedProjectDefinition = Omit<
  ProjectDefinition<ViewDefinition>,
  "name" | "id"
>;

export type ProjectsPluginSettings<T, P> = {
  readonly version: 4;
  readonly projects: T[];
  readonly archives: T[];
  readonly preferences: P;
};

export const DEFAULT_PROJECT: UnsavedProjectDefinition = {
  fieldConfig: {},
  defaultName: "",
  templates: [],
  excludedNotes: [],
  isDefault: false,
  dataSource: {
    kind: "folder",
    config: {
      path: "",
      recursive: false,
    },
  },
  newNotesFolder: "",
  views: [],
  dateFormat: DEFAULT_DATE_FORMAT,
  autosave: true,
};

export const DEFAULT_SETTINGS: ProjectsPluginSettings<
  ProjectDefinition<ViewDefinition>,
  ProjectsPluginPreferences
> = {
  version: 4,
  projects: [],
  archives: [],
  preferences: {
    projectSizeLimit: 1000,
    frontmatter: { quoteStrings: "PLAIN" },
    locale: { firstDayOfWeek: "default" },
    commands: [],
    linkBehavior: "open-editor",
    mobileCalendarView: "month",
    showViewTitles: true,
    animationBehavior: "smooth",
    disableHapticFeedback: false,
    replaceObsidianProperties: false,
  },
};

export type UnresolvedSettings = {
  readonly version: 4;
} & Partial<
  ProjectsPluginSettings<
    Partial<ProjectDefinition<Partial<ViewDefinition>>>,
    Partial<ProjectsPluginPreferences>
  >
>;

export function resolve(
  unresolved: UnresolvedSettings
): ProjectsPluginSettings<
  ProjectDefinition<ViewDefinition>,
  ProjectsPluginPreferences
> {
  const projects = unresolved.projects?.map(resolveProject) ?? [];
  const archives = unresolved.archives?.map(resolveProject) ?? [];
  const preferences = resolvePreferences(unresolved.preferences ?? {});

  const commands = cleanUpCommands(preferences.commands, [
    ...projects,
    ...archives,
  ]);

  return {
    version: 4,
    projects,
    archives,
    preferences: { ...preferences, commands },
  };
}

function resolveProject(
  unresolved: Partial<ProjectDefinition<Partial<ViewDefinition>>>
): ProjectDefinition<ViewDefinition> {
  const { name, id } = unresolved;

  if (name && id) {
    return {
      ...DEFAULT_PROJECT,
      ...unresolved,
      name,
      id,
      fieldConfig: migrateFieldConfig(unresolved.fieldConfig),
      views: unresolved.views?.map(resolveView) ?? [],
      dateFormat: unresolved.dateFormat ?? DEFAULT_DATE_FORMAT,
    };
  }

  throw new Error("Invalid project definition");
}

function migrateFieldConfig(
  fieldConfig: { [field: string]: FieldConfig } | undefined
): { [field: string]: FieldConfig } {
  if (!fieldConfig) return {};
  const out: { [field: string]: FieldConfig } = {};
  for (const [name, fc] of Object.entries(fieldConfig)) {
    if (fc.rollup && fc.rollup.function && !fc.rollup.mode) {
      const mode = defaultModeForFunction(fc.rollup.function);
      out[name] = mode ? { ...fc, rollup: { ...fc.rollup, mode } } : fc;
    } else {
      out[name] = fc;
    }
  }
  return out;
}

function resolveView(unresolved: Partial<ViewDefinition>): ViewDefinition {
  const { name, id, type } = unresolved;

  // By v4 all legacy types ("table", "database") have been migrated to
  // "dashboard" by migrateV3ToV4 in settings.ts. No runtime remap needed.
  if (name && id && type) {
    const merged = { ...DEFAULT_VIEW, ...unresolved, name, id, type };
    // R5-004: rename legacy footer aggregation "count" -> "count_total"
    // inside opaque view.config (DataTable.aggregations, Stats/Summary
    // cards.aggregation, Chart yAxis.aggregation, nested widgets).
    const config = migrateAggregationCount(merged.config);
    return config === merged.config ? merged : { ...merged, config };
  }

  throw new Error("Invalid view definition");
}

export const DEFAULT_PREFERENCES: ProjectsPluginPreferences = {
  projectSizeLimit: 1000,
  frontmatter: { quoteStrings: "PLAIN" },
  locale: { firstDayOfWeek: "default" },
  commands: [],
  linkBehavior: "open-editor",
  mobileCalendarView: "month",
  showViewTitles: true,
  animationBehavior: "smooth",
  disableHapticFeedback: false,
  replaceObsidianProperties: false,
};

export function resolvePreferences(
  unresolved: Partial<ProjectsPluginPreferences>
): ProjectsPluginPreferences {
  return { ...DEFAULT_PREFERENCES, ...unresolved };
}

const cleanUpCommands = (
  commands: ShowCommand[],
  allProjects: ProjectDefinition<ViewDefinition>[]
): ShowCommand[] => {
  const uniquified = removeDuplicateCommands(commands);
  return removeOrphanCommands(allProjects)(uniquified);
};

const removeDuplicateCommands = (commands: ShowCommand[]): ShowCommand[] =>
  commands.filter(
    (cmd, index, self) =>
      index ===
      self.findIndex(
        (other) => other.project === cmd.project && other.view === cmd.view
      )
  );

const removeOrphanCommands = (
  allProjects: ProjectDefinition<ViewDefinition>[]
): ((commands: ShowCommand[]) => ShowCommand[]) =>
  (commands) =>
    commands.filter((cmd) =>
      allProjects.some(
        (p) =>
          p.id === cmd.project &&
          (cmd.view === undefined
            ? true
            : p.views.some((v) => v.id === cmd.view))
      )
    );

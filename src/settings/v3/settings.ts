import type {
  FieldConfig,
  ProjectId,
  ProjectsPluginPreferences,
  ShowCommand,
  ViewDefinition,
} from "../base/settings";
import { DEFAULT_VIEW } from "../base/settings";

/**
 * Date format preset types for convenient configuration
 */
export type DateFormatPreset = 
  | "iso"           // YYYY-MM-DD (default)
  | "us"            // MM/DD/YYYY
  | "eu"            // DD.MM.YYYY
  | "uk"            // DD/MM/YYYY
  | "japan"         // YYYY年MM月DD日
  | "custom";       // User-defined format

/**
 * Configuration for date formatting in a project
 */
export type DateFormatConfig = {
  // Format used when WRITING dates to frontmatter
  readonly writeFormat: string;              // e.g., "YYYY-MM-DD", "MM/DD/YYYY", "DD.MM.YYYY"
  
  // Optional: Format for DISPLAY (if different from write)
  readonly displayFormat?: string;           // If not set, uses writeFormat
  
  // Optional: Include time component
  readonly includeTime?: boolean;            // If true, appends time: "YYYY-MM-DD HH:mm"
  
  // Preset name (for UI convenience)
  readonly preset?: DateFormatPreset;
};

/**
 * Default date format configuration (ISO 8601)
 */
export const DEFAULT_DATE_FORMAT: DateFormatConfig = {
  writeFormat: "YYYY-MM-DD",
  preset: "iso",
};

/**
 * Predefined date format presets for common regional formats
 */
export const DATE_FORMAT_PRESETS: Record<DateFormatPreset, DateFormatConfig> = {
  iso: {
    writeFormat: "YYYY-MM-DD",
    preset: "iso",
  },
  us: {
    writeFormat: "MM/DD/YYYY",
    preset: "us",
  },
  eu: {
    writeFormat: "DD.MM.YYYY",
    preset: "eu",
  },
  uk: {
    writeFormat: "DD/MM/YYYY",
    preset: "uk",
  },
  japan: {
    writeFormat: "YYYY年MM月DD日",
    preset: "japan",
  },
  custom: {
    writeFormat: "YYYY-MM-DD", // User must override
    preset: "custom",
  },
};

export type ProjectDefinition<ViewDef> = {
  readonly name: string;
  readonly id: ProjectId;

  readonly fieldConfig: { [field: string]: FieldConfig };
  readonly views: ViewDef[];
  readonly defaultName: string;
  readonly templates: string[];
  readonly excludedNotes: string[];
  readonly isDefault: boolean;
  readonly dataSource: DataSource;
  readonly newNotesFolder: string;
  
  // Date format configuration for this project
  readonly dateFormat?: DateFormatConfig;  // Optional: defaults to ISO 8601
};

export type DataSource = FolderDataSource | TagDataSource | DataviewDataSource;

export type FolderDataSource = {
  readonly kind: "folder";
  readonly config: {
    readonly path: string;
    readonly recursive: boolean;
  };
};

export type TagDataSource = {
  readonly kind: "tag";
  readonly config: {
    readonly tag: string;
    readonly hierarchy: boolean;
  };
};

export type DataviewDataSource = {
  readonly kind: "dataview";
  readonly config: {
    readonly query: string;
  };
};

export type UnsavedProjectDefinition = Omit<
  ProjectDefinition<ViewDefinition>,
  "name" | "id"
>;

export type ProjectsPluginSettings<T, P> = {
  readonly version: 3;
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
};

export const DEFAULT_SETTINGS: ProjectsPluginSettings<
  ProjectDefinition<ViewDefinition>,
  ProjectsPluginPreferences
> = {
  version: 3,
  projects: [],
  archives: [],
  preferences: {
    projectSizeLimit: 1000,
    frontmatter: {
      quoteStrings: "PLAIN",
    },
    locale: {
      firstDayOfWeek: "default",
    },
    commands: [],
    linkBehavior: "open-editor",
    mobileCalendarView: "month",
    showViewTitles: true,
    animationBehavior: "smooth",
  },
};

export type UnresolvedSettings = {
  readonly version: 3;
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
    version: 3,
    projects,
    archives,
    preferences: {
      ...preferences,
      commands,
    },
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
      views: unresolved.views?.map(resolveView) ?? [],
      // Ensure dateFormat has a default value (backward compatibility)
      dateFormat: unresolved.dateFormat ?? DEFAULT_DATE_FORMAT,
    };
  }

  throw new Error("Invalid project definition");
}

function resolveView(unresolved: Partial<ViewDefinition>): ViewDefinition {
  const { name, id, type } = unresolved;

  if (name && id && type) {
    return {
      ...DEFAULT_VIEW,
      ...unresolved,
      name,
      id,
      type,
    };
  }

  throw new Error("Invalid view definition");
}

export const DEFAULT_PREFERENCES: ProjectsPluginPreferences = {
  projectSizeLimit: 1000,
  frontmatter: {
    quoteStrings: "PLAIN",
  },
  locale: {
    firstDayOfWeek: "default",
  },
  commands: [],
  linkBehavior: "open-editor",
  mobileCalendarView: "month",
  showViewTitles: true,
  animationBehavior: "smooth",
};

export function resolvePreferences(
  unresolved: Partial<ProjectsPluginPreferences>
): ProjectsPluginPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...unresolved,
  };
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
      allProjects.some((p) => p.id === cmd.project &&
        cmd.view === undefined ? true : p.views.some((v) => v.id === cmd.view)
      )
    );

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

// ============================================================================
// Agenda 2.0 Types (v3.1.0+)
// ============================================================================

/**
 * Agenda display mode
 * - 'standard': Inherits calendar view filters
 * - 'custom': User-defined lists with custom filters (future)
 */
export type AgendaMode = 'standard' | 'custom';

/**
 * Agenda icon configuration
 */
export type AgendaIcon = {
  readonly type: 'lucide' | 'emoji' | 'obsidian-icon';
  readonly value: string;
};

/**
 * Filter mode: visual (UI) or advanced (formulas)
 */
export type AgendaFilterMode = 'visual' | 'advanced';

/**
 * Filter operators for agenda custom lists
 * Comprehensive set covering all field types
 */
export type AgendaFilterOperator = 
  // Base (for all types)
  | 'is-empty'
  | 'is-not-empty'
  // String
  | 'is'
  | 'is-not'
  | 'contains'
  | 'not-contains'
  | 'starts-with'
  | 'ends-with'
  | 'regex'
  // Number
  | 'eq'
  | 'neq'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  // Boolean
  | 'is-checked'
  | 'is-not-checked'
  // Date
  | 'is-on'
  | 'is-not-on'
  | 'is-before'
  | 'is-after'
  | 'is-on-and-before'
  | 'is-on-and-after'
  | 'is-today'
  | 'is-this-week'
  | 'is-this-month'
  | 'is-overdue'
  | 'is-upcoming'
  // List/Tags
  | 'has-any-of'
  | 'has-all-of'
  | 'has-none-of'
  | 'has-keyword';

/**
 * Single filter condition for agenda custom list
 */
export type AgendaFilter = {
  readonly id: string;
  readonly field: string;
  readonly operator: AgendaFilterOperator;
  readonly value: string | number | boolean | string[] | null;
  /** Whether this filter condition is active. Defaults to true if omitted (backward compat). */
  readonly enabled?: boolean;
};

/**
 * Filter group with nested filters and groups
 * Supports complex logical structures: (A AND B) OR (C AND D)
 */
export type AgendaFilterGroup = {
  readonly id: string;
  readonly conjunction: 'AND' | 'OR';
  readonly filters: AgendaFilter[];
  readonly groups: AgendaFilterGroup[];
};

/**
 * Custom agenda list definition
 * Supports both visual (UI) and advanced (formula) filter modes
 */
export type AgendaCustomList = {
  readonly id: string;
  readonly name: string;
  readonly icon: AgendaIcon;
  readonly filterMode: AgendaFilterMode;
  // Visual mode: structured filter groups
  readonly filterGroup?: AgendaFilterGroup;
  // Advanced mode: formula string
  readonly filterFormula?: string;
  readonly order: number;
  readonly collapsed?: boolean;
  readonly color?: string;
};

/**
 * Agenda configuration for a project
 */
export type AgendaConfig = {
  readonly mode: AgendaMode;
  
  // Standard mode settings
  readonly standard?: {
    readonly inheritCalendarFilters: boolean;
  };
  
  // Custom mode settings (future)
  readonly custom?: {
    readonly lists: AgendaCustomList[];
  };
};

/**
 * Default agenda configuration
 */
export const DEFAULT_AGENDA_CONFIG: AgendaConfig = {
  mode: 'standard',
  standard: {
    inheritCalendarFilters: true,
  },
};

// ============================================================================
// Date Format Presets
// ============================================================================

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
  
  // Autosave mode for note editing modal (v3.0.4)
  // true = automatic save on change (default)
  // false = manual save with button
  readonly autosave?: boolean;
  
  // Agenda configuration (v3.1.0+)
  // Controls agenda display mode and custom lists
  readonly agenda?: AgendaConfig;
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
  autosave: true, // v3.0.4: Enable autosave by default
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

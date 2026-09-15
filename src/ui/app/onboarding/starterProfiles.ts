// ============================================================
// Starter profiles — scene 7 «Интуитивный первый опыт»
//
// Three ready-made project shapes a brand-new user can pick from the
// onboarding modal instead of facing an empty vault: «Клиенты»,
// «Тренировки», «Дневник проекта». Each writes one folder, one Markdown
// template and one `ProjectDefinition` with exactly two views (an
// «Обзор» dashboard with a record counter + table, and one subject
// view — Board or Calendar). No relations, rollups or additional
// sources — the smallest shape that lets a first note show up
// somewhere immediately after the user names it.
//
// Deliberately separate from `demoProject.ts`: the demo seeds many
// example notes across a fixed B2B domain and is a secondary, optional
// path. A starter profile seeds NO example record — the user's own
// first note is the first result — and takes Vault access / project
// registration as injected dependencies so it is unit-testable without
// a live Obsidian instance or the global `settings` store.
// ============================================================

import type { Vault } from "obsidian";
import { normalizePath } from "obsidian";
import { v4 as uuidv4 } from "uuid";

import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import type { FieldConfig, ProjectDefinition } from "src/settings/settings";
import type { BoardConfig } from "src/ui/views/Board/types";
import type { CalendarConfig } from "src/ui/views/Calendar/types";
import type { DatabaseViewConfig, StatsConfig } from "src/ui/views/Dashboard/types";
import { tableTabConfig } from "src/ui/views/Dashboard/widgets/legacyMigration";

// ── Public identifiers ──────────────────────────────────────

export type StarterProfileId = "clients" | "workouts" | "project-journal";

export const STARTER_PROFILE_IDS: readonly StarterProfileId[] = [
  "clients",
  "workouts",
  "project-journal",
];

/**
 * Vault surface this module needs, expressed as a `Pick` of the real
 * `obsidian.Vault` interface rather than a hand-rolled shape — a real
 * `Vault` satisfies it with no cast, and a test fake only has to
 * implement three methods.
 */
export type StarterProfileVault = Pick<
  Vault,
  "getAbstractFileByPath" | "createFolder" | "create"
>;

export interface StarterProfileDeps {
  readonly vault: StarterProfileVault;
  readonly addProject: (project: ProjectDefinition) => void;
}

/**
 * Thrown when any of the folder/template writes fails. Carries the exact
 * path that could not be written so the calling UI can name it in an
 * alert. `settings.addProject` is never reached when this is thrown —
 * see `createStarterProfile`.
 */
export class StarterProfileWriteError extends Error {
  constructor(readonly path: string, cause?: unknown) {
    super(
      cause instanceof Error
        ? `Could not write "${path}": ${cause.message}`
        : `Could not write "${path}"`
    );
    this.name = "StarterProfileWriteError";
  }
}

// ── Display metadata (Russian data, not UI chrome) ──────────
//
// The profile name, the one-line example row and every field/view name
// below are Russian domain data written into the vault and into
// `data.json` — not localizable UI strings. `Onboarding.svelte` reads
// `name`/`example` to render its three buttons regardless of interface
// locale, exactly like the field names in the generated front matter.

export interface StarterProfileDisplay {
  readonly id: StarterProfileId;
  readonly name: string;
  /** One line previewing a future row — no record is created from this. */
  readonly example: string;
}

export const STARTER_PROFILE_DISPLAY: Record<StarterProfileId, StarterProfileDisplay> = {
  clients: {
    id: "clients",
    name: "Клиенты",
    example: "«ООО Север» · В работе · 120 000",
  },
  workouts: {
    id: "workouts",
    name: "Тренировки",
    example: "«Бег 5 км» · Кардио · 30 мин",
  },
  "project-journal": {
    id: "project-journal",
    name: "Дневник проекта",
    example: "«Итоги недели» · В работе · Написать план",
  },
};

// ── Internal descriptor ──────────────────────────────────────

interface StarterProfileDescriptor {
  readonly folderName: string;
  readonly templateFileName: string;
  readonly templateBody: string;
  readonly fieldConfig: { [field: string]: FieldConfig };
  /** Label for the Stats card AND the dashboard's stats widget title. */
  readonly statsLabel: string;
  readonly secondViewName: string;
  readonly secondViewType: "board" | "calendar";
  readonly secondViewConfig: BoardConfig | CalendarConfig;
}

const CLIENTS_FIELD_CONFIG: { [field: string]: FieldConfig } = {
  статус: {
    options: ["Новый", "В работе", "Завершён"],
    statusGroups: {
      todo: ["Новый"],
      inProgress: ["В работе"],
      complete: ["Завершён"],
    },
  },
  следующийКонтакт: { time: false },
};

const WORKOUTS_FIELD_CONFIG: { [field: string]: FieldConfig } = {
  дата: { time: false },
  тип: { options: ["Сила", "Кардио", "Растяжка"] },
};

const JOURNAL_FIELD_CONFIG: { [field: string]: FieldConfig } = {
  дата: { time: false },
  статус: {
    options: ["В работе", "На паузе", "Завершено"],
    statusGroups: {
      todo: ["На паузе"],
      inProgress: ["В работе"],
      complete: ["Завершено"],
    },
  },
};

const CLIENTS_TEMPLATE_BODY = `---
статус: Новый
следующийКонтакт: {{date:YYYY-MM-DD}}
сумма: 0
---

# {{title}}
`;

const WORKOUTS_TEMPLATE_BODY = `---
дата: {{date:YYYY-MM-DD}}
тип: Сила
минуты: 30
---

# {{title}}
`;

const JOURNAL_TEMPLATE_BODY = `---
дата: {{date:YYYY-MM-DD}}
статус: В работе
следующийШаг: ""
---

# {{title}}
`;

/**
 * #087-style honesty: `groupByField` uses the exact Cyrillic front-matter
 * key, so the Board's columns are the profile's own status options —
 * no separate English-keyed shadow field.
 */
const CLIENTS_BOARD_CONFIG: BoardConfig = {
  groupByField: "статус",
  includeFields: ["следующийКонтакт", "сумма"],
};

const WORKOUTS_CALENDAR_CONFIG: CalendarConfig = {
  startDateField: "дата",
};

/**
 * «Хронология» — there is no distinct "timeline" project-level view type
 * in this codebase (Dashboard/Board/Calendar/Gallery are the only
 * registered project views; `timeline` only exists as a legacy/retired
 * Dashboard widget type and as a `database-call` view-tab kind, neither
 * of which is a project view). Reusing Calendar with `startDateField`
 * gives the diary a date-ordered read of its own entries without adding
 * a new registered view type — the architecture pass accepted this
 * substitution explicitly.
 */
const JOURNAL_CALENDAR_CONFIG: CalendarConfig = {
  startDateField: "дата",
};

const DESCRIPTORS: Record<StarterProfileId, StarterProfileDescriptor> = {
  clients: {
    folderName: "Клиенты",
    templateFileName: "Шаблон — клиент.md",
    templateBody: CLIENTS_TEMPLATE_BODY,
    fieldConfig: CLIENTS_FIELD_CONFIG,
    statsLabel: "Клиентов",
    secondViewName: "Статусы",
    secondViewType: "board",
    secondViewConfig: CLIENTS_BOARD_CONFIG,
  },
  workouts: {
    folderName: "Тренировки",
    templateFileName: "Шаблон — тренировка.md",
    templateBody: WORKOUTS_TEMPLATE_BODY,
    fieldConfig: WORKOUTS_FIELD_CONFIG,
    statsLabel: "Тренировок",
    secondViewName: "Календарь",
    secondViewType: "calendar",
    secondViewConfig: WORKOUTS_CALENDAR_CONFIG,
  },
  "project-journal": {
    folderName: "Дневник проекта",
    templateFileName: "Шаблон — запись.md",
    templateBody: JOURNAL_TEMPLATE_BODY,
    fieldConfig: JOURNAL_FIELD_CONFIG,
    statsLabel: "Записей",
    secondViewName: "Хронология",
    secondViewType: "calendar",
    secondViewConfig: JOURNAL_CALENDAR_CONFIG,
  },
};

// ── Dashboard config builder ──────────────────────────────────

const widgetId = (() => {
  let n = Date.now();
  return () => `w-${n++}`;
})();

/**
 * «Обзор»: a Stats counter over the WHOLE (still empty) source —
 * `field: "*"` + `count_total` is the pair `StatsWidget` treats as a
 * plain record count (see its own default "Total" card), so it reads 0
 * before the first note and 1 right after, unlike counting a field that
 * does not exist yet in an empty folder — plus one `database-call`
 * block with a single Table tab (the current V2 shape; `data-table` is
 * retired — see `legacyMigration.ts`).
 */
function buildOverviewConfig(statsLabel: string): DatabaseViewConfig {
  const statsConfig: StatsConfig = {
    cards: [{ id: "count", label: statsLabel, field: "*", aggregation: "count_total" }],
    columns: 2,
  };

  return {
    widgets: [
      {
        id: widgetId(),
        type: "stats",
        title: statsLabel,
        layout: { x: 0, y: 0, w: 12, h: 2 },
        // Same cast `legacyMigration.ts` needs for the same reason: a named
        // `StatsConfig` (no index signature) is not directly assignable to
        // `WidgetDefinition.config: Record<string, unknown>`.
        config: statsConfig as unknown as Record<string, unknown>,
      },
      {
        id: widgetId(),
        type: "database-call",
        title: "Таблица",
        layout: { x: 0, y: 2, w: 12, h: 8 },
        config: tableTabConfig(),
      },
    ],
    layoutMode: "stack",
    layoutVersion: 1,
    table: {},
    showWidgetToolbar: true,
    compactMode: false,
  };
}

function buildProjectDefinition(
  descriptor: StarterProfileDescriptor,
  projectName: string,
  profileFolder: string,
  templatePath: string
): ProjectDefinition {
  return Object.assign({}, DEFAULT_PROJECT, {
    name: projectName,
    id: uuidv4(),
    dataSource: {
      kind: "folder" as const,
      config: { path: profileFolder, recursive: false },
    },
    newNotesFolder: profileFolder,
    templates: [templatePath],
    excludedNotes: [templatePath],
    fieldConfig: descriptor.fieldConfig,
    views: [
      Object.assign({}, DEFAULT_VIEW, {
        id: uuidv4(),
        name: "Обзор",
        type: "dashboard",
        config: buildOverviewConfig(descriptor.statsLabel),
      }),
      Object.assign({}, DEFAULT_VIEW, {
        id: uuidv4(),
        name: descriptor.secondViewName,
        type: descriptor.secondViewType,
        config: descriptor.secondViewConfig,
      }),
    ],
  });
}

// ── Root-folder collision handling ────────────────────────────

const ROOT_FOLDER_BASE = "Projects Plus — Профили";

/**
 * Picks a root name with nothing already at that path — a file OR a
 * folder — trying suffixes `2`, `3`, … A freshly resolved root is
 * therefore always empty, so the profile subfolder and template inside
 * it never need their own collision handling: nothing pre-existing can
 * be there. This also makes a re-run of the SAME profile safe: the
 * previous run's root is occupied, so the next run gets its own root
 * rather than assuming it may write into what is already there.
 */
function resolveFreeRootFolder(vault: StarterProfileVault): string {
  const base = normalizePath(ROOT_FOLDER_BASE);
  if (!vault.getAbstractFileByPath(base)) return ROOT_FOLDER_BASE;

  let n = 2;
  while (vault.getAbstractFileByPath(normalizePath(`${ROOT_FOLDER_BASE} ${n}`))) {
    n++;
  }
  return `${ROOT_FOLDER_BASE} ${n}`;
}

async function writeStep(step: () => Promise<unknown>, path: string): Promise<void> {
  try {
    await step();
  } catch (cause) {
    throw new StarterProfileWriteError(path, cause);
  }
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Writes the profile's folder, subfolder and template, then registers
 * the project — in that order. On any write failure the project is
 * NOT registered (`deps.addProject` is never called) and a
 * `StarterProfileWriteError` naming the failed path is thrown instead;
 * no partial write is ever presented as success. Existing files are
 * never modified or overwritten — `Vault.createFolder`/`Vault.create`
 * already refuse to do that, and `resolveFreeRootFolder` keeps every
 * write inside a root that was empty at the moment it was chosen.
 */
export async function createStarterProfile(
  profileId: StarterProfileId,
  deps: StarterProfileDeps
): Promise<ProjectDefinition> {
  const descriptor = DESCRIPTORS[profileId];
  const display = STARTER_PROFILE_DISPLAY[profileId];

  const root = resolveFreeRootFolder(deps.vault);
  const rootPath = normalizePath(root);
  const profileFolder = normalizePath(`${root}/${descriptor.folderName}`);
  const templatePath = normalizePath(`${profileFolder}/${descriptor.templateFileName}`);

  await writeStep(() => deps.vault.createFolder(rootPath), rootPath);
  await writeStep(() => deps.vault.createFolder(profileFolder), profileFolder);
  await writeStep(
    () => deps.vault.create(templatePath, descriptor.templateBody),
    templatePath
  );

  const project = buildProjectDefinition(descriptor, display.name, profileFolder, templatePath);
  deps.addProject(project);
  return project;
}

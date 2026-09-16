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

import type { TAbstractFile, Vault } from "obsidian";
import { normalizePath, TFolder } from "obsidian";
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
 * implement five methods. `delete` is the rollback primitive: it is the
 * method a real `Vault` exposes for removing a file OR a folder it
 * created, with no cast needed (see `Vault.delete` in
 * `node_modules/obsidian/obsidian.d.ts`). `getRoot` returns the vault's
 * own root `TFolder` (same file, `Vault.getRoot(): TFolder`) — its
 * `children` are how root-level case-only collisions are found, since
 * `getAbstractFileByPath` is documented case-sensitive there ("case
 * sensitive" on the `path` parameter) while Windows/macOS file systems
 * commonly are not.
 */
export type StarterProfileVault = Pick<
  Vault,
  "getAbstractFileByPath" | "createFolder" | "create" | "delete" | "getRoot"
>;

export interface StarterProfileDeps {
  readonly vault: StarterProfileVault;
  readonly addProject: (project: ProjectDefinition) => void;
  /**
   * Whether the project with this id is registered in settings, asked only
   * after `addProject` threw. `settings.addProject` writes the new value
   * into the store BEFORE notifying subscribers (Svelte's `writable`), so a
   * subscriber that throws leaves the project registered and the exception
   * still reaching us — rolling the files back then would delete the
   * folders of a project the user now has. Optional: a caller that cannot
   * answer gets the conservative old behaviour (roll back), which is right
   * when `addProject` itself is what failed.
   */
  readonly isProjectRegistered?: (projectId: string) => boolean;
}

/**
 * Thrown when any of the folder/template writes fails. Carries the exact
 * path that could not be written so the calling UI can name it in an
 * alert, AND the paths (if any) that this run created but could not
 * remove again during rollback — `leftovers` is empty when cleanup fully
 * undid this run's writes, and non-empty when something had to be left
 * behind (because it was no longer empty, or because removing it itself
 * failed). `settings.addProject` is never reached when this is thrown —
 * see `createStarterProfile`.
 */
export class StarterProfileWriteError extends Error {
  constructor(
    readonly path: string,
    readonly leftovers: readonly string[],
    cause?: unknown
  ) {
    super(
      cause instanceof Error
        ? `Could not write "${path}": ${cause.message}`
        : `Could not write "${path}"`
    );
    this.name = "StarterProfileWriteError";
  }
}

/**
 * Thrown when every folder/template write succeeded but `deps.addProject`
 * itself threw while registering the finished project. This run's own
 * writes are rolled back exactly like a `StarterProfileWriteError` (see
 * `leftovers`), but nothing failed to WRITE — the vault holds exactly what
 * this run intended — so the message never names a path or claims a write
 * failed. `Onboarding.svelte`'s `catch` only special-cases
 * `StarterProfileWriteError`; anything else (this included) falls through
 * to its generic "could not create the profile" message, which is honest
 * for a registration failure.
 */
export class StarterProfileRegistrationError extends Error {
  constructor(
    readonly leftovers: readonly string[],
    cause?: unknown
  ) {
    super(
      cause instanceof Error
        ? `Could not register the starter profile: ${cause.message}`
        : "Could not register the starter profile"
    );
    this.name = "StarterProfileRegistrationError";
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
 * block with a single «Таблица» tab (the current V2 shape; `data-table`
 * is retired — see `legacyMigration.ts`). The tab is labelled in
 * Russian, like every other name this profile writes — `tableTabConfig`
 * defaults its label to "Table" for its other (locale-less) callers, so
 * this is the one call site that overrides it.
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
        config: tableTabConfig({}, "Таблица"),
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

// ── Root-folder / subfolder collision handling ──────────────────
//
// One shared root for every profile, forever: `resolveRootFolder` REUSES
// an existing root FOLDER rather than suffixing past it, so a second (or
// third) profile lands next to the first one instead of growing its own
// numbered root. Only a FILE occupying the root path forces a suffixed
// root — that is the one case where writing "into" the existing thing is
// not an option. Collision handling therefore moves to the profile
// SUBFOLDER: `resolveFreeSubfolder` suffixes the folder name itself
// («Клиенты», «Клиенты 2», …) whenever anything — file or folder — is
// already at that path, which is exactly what a re-run of the SAME
// profile needs (the first run's subfolder is taken, so the second gets
// its own next to it, under the SAME root). The template is always
// created inside a subfolder this run just created, so it can never
// collide with anything.
//
// `getAbstractFileByPath` is explicitly case-sensitive (see its doc
// comment in `node_modules/obsidian/obsidian.d.ts`), but Windows and
// macOS vaults commonly sit on a case-insensitive file system: a folder
// named `клиенты` is invisible to a case-sensitive probe for `Клиенты`,
// and `createFolder("Клиенты")` then fails against the on-disk name it
// never saw coming. Both resolvers therefore also compare candidate names
// against the relevant parent's existing children with
// `toLocaleLowerCase()`. A case-only match is treated as taken, not as
// something to reuse: for the root, reuse is still restricted to an EXACT
// name match on a FOLDER (a case-only root match forces the numbered
// suffix, same as a file at that path); for a subfolder, any
// case-insensitive match — exact or not — forces the suffix, matching the
// existing "anything here forces a suffix" subfolder rule.

const ROOT_FOLDER_BASE = "Projects Plus — Профили";

interface RootResolution {
  readonly path: string;
  /**
   * The existing root `TFolder` when one is being reused at `path`
   * (returned directly from the `instanceof TFolder` narrowing below —
   * never cast), or `null` when `path` is free and this run has to create
   * it itself.
   */
  readonly folder: TFolder | null;
}

function resolveRootFolder(vault: StarterProfileVault): RootResolution {
  const rootChildren = vault.getRoot().children;
  let candidate = ROOT_FOLDER_BASE;
  let n = 2;
  for (;;) {
    const path = normalizePath(candidate);
    const existing = vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) return { path: candidate, folder: existing };
    if (existing === null) {
      const caseOnlyMatch = rootChildren.some(
        (child) => child.name.toLocaleLowerCase() === candidate.toLocaleLowerCase()
      );
      if (!caseOnlyMatch) return { path: candidate, folder: null };
    }
    // A file occupies this path, or something with the same name modulo
    // case does (which is not eligible for reuse either way) — never
    // written into or reused. Try the next numbered root.
    candidate = `${ROOT_FOLDER_BASE} ${n}`;
    n++;
  }
}

function resolveFreeSubfolder(
  vault: StarterProfileVault,
  root: string,
  rootFolder: TFolder,
  folderName: string
): string {
  let name = folderName;
  let n = 2;
  for (;;) {
    const candidate = normalizePath(`${root}/${name}`);
    const exact = vault.getAbstractFileByPath(candidate) !== null;
    const caseOnlyMatch = rootFolder.children.some(
      (child) => child.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (!exact && !caseOnlyMatch) return candidate;
    name = `${folderName} ${n}`;
    n++;
  }
}

/**
 * One thing this run created. `file` is the exact object `createFolder`/
 * `create` returned, used during cleanup to guard against deleting a
 * same-path REPLACEMENT — something else removed this run's own entry and
 * put a new, unrelated file or folder at the same path before cleanup ran.
 * `file` is `null` for exactly one case: the failing step's own target
 * when it turns out to have been materialized despite its promise
 * rejecting (see `writeStep`). That rejection means no object was ever
 * returned to record, so cleanup falls back to comparing by path alone for
 * that one entry — accepted because the path was verified absent
 * immediately before this run's own attempt at it, and nothing else in
 * this flow writes to a path this run is still in the middle of claiming.
 */
interface CreatedEntry {
  readonly path: string;
  readonly file: TAbstractFile | null;
}

/**
 * Removes exactly what this run created, in reverse order, stopping at
 * the first entry that can no longer be safely removed — because
 * something else has since put content into it (a folder this run
 * created is no longer empty), because something else now occupies its
 * path instead (a same-path replacement, identified by object identity —
 * see `CreatedEntry`), or because the removal itself failed. Everything
 * from that entry outward (its parents, which by construction still
 * contain it) is left in place and returned as `leftovers`, in the order
 * this run created them. Never touches anything not in `created`, and
 * never deletes an object this run did not itself create.
 */
async function cleanupCreated(
  vault: StarterProfileVault,
  created: readonly CreatedEntry[]
): Promise<readonly string[]> {
  let leftoverFrom = created.length;

  for (let i = created.length - 1; i >= 0; i--) {
    const entry = created[i]!;
    const current = vault.getAbstractFileByPath(entry.path);
    if (current === null) {
      // Already gone — nothing to do, keep unwinding toward the root.
      leftoverFrom = i;
      continue;
    }
    if (entry.file !== null && current !== entry.file) {
      // Something else now lives at this path — not the object this run
      // created. Leave it untouched and report it, same as "no longer
      // empty": everything from here outward has to stay too.
      leftoverFrom = i + 1;
      break;
    }
    if (current instanceof TFolder && current.children.length > 0) {
      // No longer empty — do not delete, and stop: everything from here
      // outward (this path and its parents) has to stay too.
      leftoverFrom = i + 1;
      break;
    }
    try {
      await vault.delete(current);
      leftoverFrom = i;
    } catch {
      leftoverFrom = i + 1;
      break;
    }
  }

  return created.slice(0, leftoverFrom).map((entry) => entry.path);
}

async function writeStep<T extends TAbstractFile>(
  step: () => Promise<T>,
  path: string,
  vault: StarterProfileVault,
  created: CreatedEntry[]
): Promise<T> {
  try {
    return await step();
  } catch (cause) {
    // The step may have materialized its target before rejecting (e.g. an
    // adapter that writes the file/folder and only fails on a later,
    // separate part of the same operation). `path` was confirmed absent
    // immediately before this call, so if it exists now it is this run's
    // own — fold it into cleanup (and, if it cannot be removed, into
    // `leftovers`) instead of silently leaving it unreported.
    if (vault.getAbstractFileByPath(path) !== null) {
      created.push({ path, file: null });
    }
    const leftovers = await cleanupCreated(vault, created);
    throw new StarterProfileWriteError(path, leftovers, cause);
  }
}

// ── Main entry point ───────────────────────────────────────────

/**
 * Writes the profile's folder, subfolder and template, then registers
 * the project — in that order. On any write failure the project is NOT
 * registered (`deps.addProject` is never called); this run's own writes
 * are rolled back in reverse order (see `cleanupCreated`), and the
 * thrown `StarterProfileWriteError` carries both the path that failed
 * and any paths cleanup could not remove, so the caller can tell the
 * user exactly what — if anything — is still in the vault. Existing
 * files and folders are never modified, overwritten or deleted: the
 * root is only reused when it is already a folder (an exact-name match,
 * not merely a case-insensitive one — see `resolveRootFolder`), the
 * subfolder is suffixed whenever its plain name is taken (including a
 * case-only match — see `resolveFreeSubfolder`), and cleanup only ever
 * touches paths this same run created, verified by object identity where
 * one is available.
 *
 * `deps.addProject` is called inside its own try/catch: a synchronous
 * registration failure — every file already written, only the settings
 * update itself throwing — rolls back this run's writes exactly like a
 * write failure would, but is reported as `StarterProfileRegistrationError`
 * rather than `StarterProfileWriteError`, since no path failed to write.
 */
export async function createStarterProfile(
  profileId: StarterProfileId,
  deps: StarterProfileDeps
): Promise<ProjectDefinition> {
  const descriptor = DESCRIPTORS[profileId];
  const display = STARTER_PROFILE_DISPLAY[profileId];
  const created: CreatedEntry[] = [];

  const root = resolveRootFolder(deps.vault);
  const rootPath = normalizePath(root.path);
  let rootFolder: TFolder;
  if (root.folder !== null) {
    rootFolder = root.folder;
  } else {
    rootFolder = await writeStep(() => deps.vault.createFolder(rootPath), rootPath, deps.vault, created);
    created.push({ path: rootPath, file: rootFolder });
  }

  const profileFolder = resolveFreeSubfolder(deps.vault, root.path, rootFolder, descriptor.folderName);
  const subfolder = await writeStep(
    () => deps.vault.createFolder(profileFolder),
    profileFolder,
    deps.vault,
    created
  );
  created.push({ path: profileFolder, file: subfolder });

  const templatePath = normalizePath(`${profileFolder}/${descriptor.templateFileName}`);
  const templateFile = await writeStep(
    () => deps.vault.create(templatePath, descriptor.templateBody),
    templatePath,
    deps.vault,
    created
  );
  created.push({ path: templatePath, file: templateFile });

  const project = buildProjectDefinition(descriptor, display.name, profileFolder, templatePath);
  try {
    deps.addProject(project);
  } catch (cause) {
    // The project may be registered already: Svelte's store assigns the new
    // value and only then calls subscribers, so a throwing subscriber (a
    // settings writer, a view rebuilding) surfaces here with the project in
    // place. Its files must stay — the profile the user asked for exists —
    // and reporting the failure is that subscriber's own job. Only a
    // registration that did NOT land is rolled back.
    if (deps.isProjectRegistered?.(project.id) === true) return project;
    const leftovers = await cleanupCreated(deps.vault, created);
    throw new StarterProfileRegistrationError(leftovers, cause);
  }
  return project;
}

// ============================================================
// Demo projects — Projects Plus
//
// 3.6.1: the demo is THREE new projects of one person's story, each at least
// the size of the single demo it replaces, reading each other:
// - «Демо: Кабинет» (demoCabinet.ts) — a private massage practice: clients,
//   services, half a year of visits and expenses, profit by month;
// - «Демо: Трекер» (demoTracker.ts) — three clients' daily log of weight,
//   sleep, mood, pain and training, linked to the practice's clients;
// - «Демо: Финансы» (demoFinance.ts) — the personal budget, with the
//   practice read as a second income.
// The practice's client cards compute visits, payments, debt, wellbeing,
// weight, training and sleep from the notes of this and the tracker project;
// the tracker and the finances chart series read from the practice.
//
// Idempotency: createDemoProject is safe to re-run. It writes only the notes
// that are missing and registers only the projects missing by name.
// ============================================================

import { Notice, normalizePath, stringifyYaml, type Vault } from "obsidian";
import { v4 as uuidv4 } from "uuid";
import { get } from "svelte/store";

import { settings } from "src/lib/stores/settings";
import { noticeFor } from "src/lib/errors/errorText";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import type { ViewDefinition } from "src/settings/base/settings";
import type { WidgetDefinition } from "src/ui/views/Dashboard/types";
import { sanitizeNoteName } from "./noteName";
import {
  CABINET_FOLDER,
  DEMO_FOLDER,
  DEMO_NAMES,
  FINANCE_FOLDER,
  TRACKER_FOLDER,
  type DemoFile,
  type DemoIds,
} from "./demoShared";
import { COVERS_SUBFOLDER, buildCabinetCovers, buildCabinetNotes, cabinetFieldConfig, cabinetViews } from "./demoCabinet";
import { buildTrackerNotes, trackerFieldConfig, trackerViews } from "./demoTracker";
import { buildFinanceNotes, financeFieldConfig, financeViews } from "./demoFinance";

export { DEMO_FOLDER, DEMO_NAMES } from "./demoShared";

/** #202 — the codes the demo can raise. */
const DEMO_FOLDER_FAILED = "PPP-601";
const DEMO_PARTIAL = "PPP-602";

/**
 * #156 — "already exists" (an idempotent re-run) is silent; "could not be
 * written" (permissions, disk, an illegal name) is reported back.
 */
async function writeFiles(vault: Vault, folder: string, files: Record<string, DemoFile>): Promise<string[]> {
  const failed: string[] = [];
  for (const [name, file] of Object.entries(files)) {
    // #198: the host refuses `* " \ / < > : | ?` in a filename.
    const path = normalizePath(`${folder}/${sanitizeNoteName(name)}.md`);
    const body = `---\n${stringifyYaml(file.frontmatter)}---\n\n${file.content}`;
    if (vault.getAbstractFileByPath(path)) continue; // idempotent re-run
    try {
      await vault.create(path, body);
    } catch (error) {
      failed.push(path);
      console.error("[Projects+] demo note could not be created", path, error);
    }
  }
  return failed;
}

/** Non-note files (the clients' cover images), with the same idempotency. */
async function writeRaw(vault: Vault, folder: string, files: Record<string, string>): Promise<string[]> {
  const failed: string[] = [];
  for (const [name, body] of Object.entries(files)) {
    const path = normalizePath(`${folder}/${sanitizeNoteName(name.replace(/\.svg$/, ""))}.svg`);
    if (vault.getAbstractFileByPath(path)) continue;
    try {
      await vault.create(path, body);
    } catch (error) {
      failed.push(path);
      console.error("[Projects+] demo file could not be created", path, error);
    }
  }
  return failed;
}

/**
 * Write every seed note that is not already there, and return the paths that
 * could not be written. Separate from `createDemoProject` (#198) so a repair
 * can re-run it on its own.
 */
export async function seedDemoNotes(vault: Vault): Promise<string[]> {
  for (const folder of [DEMO_FOLDER, CABINET_FOLDER, TRACKER_FOLDER, FINANCE_FOLDER]) {
    if (!vault.getAbstractFileByPath(folder)) {
      try {
        await vault.createFolder(folder);
      } catch (error) {
        console.error("[Projects+] demo folder could not be created", folder, error);
      }
    }
  }
  const covers = normalizePath(`${CABINET_FOLDER}/${COVERS_SUBFOLDER}`);
  if (!vault.getAbstractFileByPath(covers)) {
    try {
      await vault.createFolder(covers);
    } catch (error) {
      console.error("[Projects+] demo folder could not be created", covers, error);
    }
  }
  return [
    ...(await writeRaw(vault, covers, buildCabinetCovers())),
    ...(await writeFiles(vault, CABINET_FOLDER, buildCabinetNotes())),
    ...(await writeFiles(vault, TRACKER_FOLDER, buildTrackerNotes())),
    ...(await writeFiles(vault, FINANCE_FOLDER, buildFinanceNotes())),
  ];
}

/** The three projects, as the generator registers them. */
export function demoProjects(ids: DemoIds): ProjectDefinition[] {
  const project = (name: string, id: string, path: string, fieldConfig: unknown, views: ViewDefinition[]) =>
    Object.assign({}, DEFAULT_PROJECT, {
      name,
      id,
      path,
      dataSource: { kind: "folder", config: { path, recursive: false } },
      fieldConfig,
      views,
    }) as ProjectDefinition;
  return [
    project(DEMO_NAMES.cabinet, ids.cabinetId, CABINET_FOLDER, cabinetFieldConfig(ids), cabinetViews(ids)),
    project(DEMO_NAMES.tracker, ids.trackerId, TRACKER_FOLDER, trackerFieldConfig(ids), trackerViews(ids)),
    project(DEMO_NAMES.finance, ids.financeId, FINANCE_FOLDER, financeFieldConfig(ids), financeViews(ids)),
  ];
}

/**
 * Exported for `configProvenance.test.ts`: generated widget configs must pass
 * all migrations as a no-op — a generator emitting a pre-migration schema is
 * how the demo once shipped broken stats cards (#072).
 */
export function demoGeneratedWidgets(): WidgetDefinition[] {
  const ids = { cabinetId: "cabinet", trackerId: "tracker", financeId: "finance" };
  return demoProjects(ids).flatMap((p) =>
    p.views.flatMap((v) => ((v.config as { widgets?: WidgetDefinition[] }).widgets ?? []))
  );
}

export interface DemoResult {
  /** Names of the projects registered now. */
  readonly created: string[];
  /** Notes that could not be written. */
  readonly failed: number;
  /** Where to take the user: the practice's overview. */
  readonly open?: { readonly projectId: string; readonly viewId: string };
  /** Nothing could be written (the demo folder is missing); already reported. */
  readonly aborted?: true;
}

/**
 * Create the demo — or, when some of it exists, restore what is missing.
 * Each project is found by name first, so a repair run registers just the
 * missing ones against the ids already in use.
 */
export async function createDemoProject(vault: Vault): Promise<DemoResult> {
  if (!vault.getAbstractFileByPath(DEMO_FOLDER)) {
    try {
      await vault.createFolder(DEMO_FOLDER);
    } catch (error) {
      // #156 — without the folder nothing below can land.
      console.error("[Projects+] demo folder could not be created", error);
      new Notice(noticeFor(DEMO_FOLDER_FAILED, { folder: DEMO_FOLDER }));
      return { created: [], failed: 0, aborted: true };
    }
  }

  const failed = await seedDemoNotes(vault);
  if (failed.length > 0) {
    // A partial demo is more useful than none, but the gaps are reported.
    new Notice(noticeFor(DEMO_PARTIAL, { count: failed.length }));
  }

  // The three ids first: the projects name each other.
  const existing = get(settings).projects;
  const idOf = (name: string) => existing.find((p) => p.name === name)?.id;
  const ids: DemoIds = {
    cabinetId: idOf(DEMO_NAMES.cabinet) ?? uuidv4(),
    trackerId: idOf(DEMO_NAMES.tracker) ?? uuidv4(),
    financeId: idOf(DEMO_NAMES.finance) ?? uuidv4(),
  };

  const created: string[] = [];
  for (const project of demoProjects(ids)) {
    if (existing.some((p) => p.name === project.name)) continue;
    settings.addProject(project);
    created.push(project.name);
  }

  const cabinet = get(settings).projects.find((p) => p.id === ids.cabinetId);
  const first = cabinet?.views[0];
  return { created, failed: failed.length, ...(cabinet && first ? { open: { projectId: cabinet.id, viewId: first.id } } : {}) };
}

// ============================================================
// Demo projects — Projects Plus
//
// 3.6.1: the demo is THREE new projects of one person's story, each at least
// the size of the single demo it replaces, reading each other:
// - «Демо: Массажный кабинет» (demoCabinet.ts) — a private massage practice: clients,
//   services, half a year of visits and expenses, profit by month;
// - «Демо: Трекер» (demoTracker.ts) — three clients' daily log of weight,
//   sleep, mood, pain and training, linked to the practice's clients;
// - «Демо: Личный бюджет» (demoFinance.ts) — the personal budget, with the
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

/**
 * The ids the registered demo projects still use for missing siblings. A
 * surviving project names a sibling by an id that is no longer registered;
 * which sibling it is follows from what the generated project reads (the
 * tracker and the budget read only the practice, the practice only the
 * tracker), so moving or editing views does not lose it.
 */
export function referencedDemoIds(registered: readonly ProjectDefinition[]): Partial<DemoIds> {
  const marks: DemoIds = { cabinetId: "\u0000cabinet", trackerId: "\u0000tracker", financeId: "\u0000finance" };
  const keys = Object.keys(marks) as (keyof DemoIds)[];
  const taken = new Set(registered.map((p) => p.id));
  const refKey = /^(?:projectId|targetProjectId|dataProjectId)$/;
  const idsIn = (node: unknown, out: Set<string>): Set<string> => {
    if (Array.isArray(node)) node.forEach((v) => idsIn(v, out));
    else if (node && typeof node === "object")
      for (const [k, v] of Object.entries(node)) {
        if (refKey.test(k) && typeof v === "string" && v) out.add(v);
        else idsIn(v, out);
      }
    return out;
  };
  const found: { -readonly [K in keyof DemoIds]?: string } = {};
  for (const template of demoProjects(marks)) {
    const actual = registered.find((p) => isDemoProject(p, template));
    if (!actual) continue;
    const reads = idsIn({ f: template.fieldConfig, v: template.views }, new Set());
    const siblings = keys.filter((k) => reads.has(marks[k]) && marks[k] !== template.id);
    const dangling = [...idsIn({ f: actual.fieldConfig, v: actual.views }, new Set())].filter((id) => !taken.has(id));
    // One sibling read, one id that no registered project answers to.
    const [sibling] = siblings;
    const [id] = dangling;
    if (siblings.length === 1 && dangling.length === 1 && sibling && id && !found[sibling]) found[sibling] = id;
  }
  return found;
}

/** The folder a project reads its notes from. */
function folderOf(project: ProjectDefinition): string | undefined {
  const config = (project.dataSource as { config?: { path?: unknown } } | undefined)?.config;
  return typeof config?.path === "string" ? config.path : undefined;
}

/** A registered project is this generated one: same name and same folder. */
export function isDemoProject(registered: ProjectDefinition, generated: ProjectDefinition): boolean {
  return registered.name === generated.name && folderOf(registered) === folderOf(generated);
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

  // The three ids first: the projects name each other. A project restored
  // after being deleted takes the id its surviving siblings still name, so
  // their rollups and chart series find it again.
  // A project is the demo's by name AND folder, so the 3.6.0 demo (same
  // names, older folder) and a user's own «Демо: …» are left alone.
  const existing = get(settings).projects;
  const [cabinetT, trackerT, financeT] = demoProjects({ cabinetId: "", trackerId: "", financeId: "" });
  const idOf = (template: ProjectDefinition | undefined) =>
    template ? existing.find((p) => isDemoProject(p, template))?.id : undefined;
  const named = referencedDemoIds(existing);
  const ids: DemoIds = {
    cabinetId: idOf(cabinetT) ?? named.cabinetId ?? uuidv4(),
    trackerId: idOf(trackerT) ?? named.trackerId ?? uuidv4(),
    financeId: idOf(financeT) ?? named.financeId ?? uuidv4(),
  };

  const created: string[] = [];
  for (const project of demoProjects(ids)) {
    if (existing.some((p) => isDemoProject(p, project))) continue;
    settings.addProject(project);
    created.push(project.name);
  }

  const cabinet = get(settings).projects.find((p) => p.id === ids.cabinetId);
  const first = cabinet?.views[0];
  return { created, failed: failed.length, ...(cabinet && first ? { open: { projectId: cabinet.id, viewId: first.id } } : {}) };
}

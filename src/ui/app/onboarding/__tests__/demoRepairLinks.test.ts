/**
 * Codex review of ccc13ee (demo rebuild):
 * - deleting «Демо: Трекер» and creating the demo again gave the tracker a
 *   new id while the practice's rollups and chart series still named the old
 *   one; the restored project now takes the id its siblings name;
 * - two quick clicks on «Создать демо» started two generators racing on the
 *   same paths, which reported hundreds of failed writes for a demo that was
 *   in fact created; a second run now joins the first.
 */

import { get } from "svelte/store";
import type { Vault } from "obsidian";
import { settings } from "src/lib/stores/settings";
import { DEMO_NAMES } from "../demoShared";
import { createDemoProject } from "../demoProject";
import { createDemoWithNotices } from "../demoRun";

function fakeVault() {
  const files = new Map<string, string>();
  const create = jest.fn(async (p: string, body: string) => {
    // Let the other run interleave, as the real vault's writes do.
    await Promise.resolve();
    if (files.has(p)) throw new Error(`File already exists: ${p}`);
    files.set(p, body);
    return { path: p };
  });
  const vault = {
    getAbstractFileByPath: (p: string) => (files.has(p) ? { path: p } : null),
    create,
    createBinary: create,
    createFolder: async (p: string) => { files.set(p, ""); },
  };
  return { vault: vault as unknown as Vault, files, create };
}

function clearProjects() {
  for (const p of get(settings).projects) settings.deleteProject(p.id);
}

beforeEach(clearProjects);

test("a restored tracker takes the id the practice still reads it by", async () => {
  const { vault } = fakeVault();
  await createDemoProject(vault);
  const tracker = get(settings).projects.find((p) => p.name === DEMO_NAMES.tracker)!;
  settings.deleteProject(tracker.id);

  const result = await createDemoProject(vault);

  expect(result.created).toEqual([DEMO_NAMES.tracker]);
  const projects = get(settings).projects;
  expect(projects.find((p) => p.name === DEMO_NAMES.tracker)!.id).toBe(tracker.id);
  // Every id the three projects name is a registered project.
  const registered = new Set(projects.map((p) => p.id));
  for (const p of projects) {
    const named = [...JSON.stringify({ f: p.fieldConfig, v: p.views }).matchAll(/"(?:projectId|targetProjectId|dataProjectId)":"([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const id of named) expect(registered.has(id)).toBe(true);
  }
});

test("a restored practice takes the id the tracker and the budget read it by", async () => {
  const { vault } = fakeVault();
  await createDemoProject(vault);
  const cabinet = get(settings).projects.find((p) => p.name === DEMO_NAMES.cabinet)!;
  settings.deleteProject(cabinet.id);

  await createDemoProject(vault);

  expect(get(settings).projects.find((p) => p.name === DEMO_NAMES.cabinet)!.id).toBe(cabinet.id);
});

// Codex review 3: the id was read by array position, so moving a view lost it.
test("the practice's id is recovered after the budget's views were reordered", async () => {
  const { vault } = fakeVault();
  await createDemoProject(vault);
  const byName = (n: string) => get(settings).projects.find((p) => p.name === n)!;
  const cabinet = byName(DEMO_NAMES.cabinet);
  const finance = byName(DEMO_NAMES.finance);
  settings.updateProject({ ...finance, views: [...finance.views.slice(1), finance.views[0]!] });
  settings.deleteProject(cabinet.id);
  settings.deleteProject(byName(DEMO_NAMES.tracker).id);

  await createDemoProject(vault);

  expect(byName(DEMO_NAMES.cabinet).id).toBe(cabinet.id);
});

test("a second click while the demo is being created joins the first run", async () => {
  const { vault, files, create } = fakeVault();
  const open = jest.fn();

  const [a, b] = await Promise.all([createDemoWithNotices(vault, open), createDemoWithNotices(vault, open)]);

  expect(a).toBe(b);
  expect(a!.failed).toBe(0);
  // Each note written once: folders are the empty entries.
  expect(create).toHaveBeenCalledTimes([...files.values()].filter((v) => v !== "").length);
  expect(open).toHaveBeenCalledTimes(1);
  expect(get(settings).projects).toHaveLength(3);
});

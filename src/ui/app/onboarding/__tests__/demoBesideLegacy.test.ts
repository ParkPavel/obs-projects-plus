/**
 * Codex review 3 of the demo rebuild: the 3.6.0 demo («Демо-проект»,
 * «Демо: Кабинет», «Демо: Финансы» in «Projects Plus - Демо») was taken for
 * the rebuilt one by name, so its owner got a mix of old projects and one new
 * tracker. The rebuilt demo lives in its own folder under its own names and
 * knows its projects by name and folder: the old demo is left as it is.
 */

import { get } from "svelte/store";
import type { Vault } from "obsidian";
import { settings } from "src/lib/stores/settings";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import { DEMO_FOLDER, DEMO_NAMES } from "../demoShared";
import { createDemoProject } from "../demoProject";

const LEGACY_FOLDER = "Projects Plus - Демо";

function legacy(name: string, id: string, sub: string): ProjectDefinition {
  const path = sub ? `${LEGACY_FOLDER}/${sub}` : LEGACY_FOLDER;
  return Object.assign({}, DEFAULT_PROJECT, {
    name,
    id,
    path,
    dataSource: { kind: "folder", config: { path, recursive: false } },
    views: [],
  }) as ProjectDefinition;
}

function fakeVault() {
  const files = new Map<string, string>();
  const vault = {
    getAbstractFileByPath: (p: string) => (files.has(p) ? { path: p } : null),
    create: async (p: string, body: string) => { files.set(p, body); return { path: p }; },
    createFolder: async (p: string) => { files.set(p, ""); },
  };
  return { vault: vault as unknown as Vault, files };
}

beforeEach(() => {
  for (const p of get(settings).projects) settings.deleteProject(p.id);
});

test("the rebuilt demo neither reuses nor collides with the 3.6.0 demo", () => {
  expect(DEMO_FOLDER).not.toBe(LEGACY_FOLDER);
  for (const name of Object.values(DEMO_NAMES)) expect(["Демо-проект", "Демо: Кабинет", "Демо: Финансы"]).not.toContain(name);
});

test("next to the 3.6.0 demo all three projects are created and the old ones stay", async () => {
  const old = [legacy("Демо-проект", "old-studio", ""), legacy("Демо: Кабинет", "old-cab", "Кабинет"), legacy("Демо: Финансы", "old-fin", "Финансы")];
  old.forEach((p) => settings.addProject(p));
  const { vault, files } = fakeVault();

  const result = await createDemoProject(vault);

  expect(result.created).toEqual([DEMO_NAMES.cabinet, DEMO_NAMES.tracker, DEMO_NAMES.finance]);
  const projects = get(settings).projects;
  expect(projects).toHaveLength(6);
  for (const p of old) expect(projects).toContainEqual(p);
  expect([...files.keys()].every((path) => path === DEMO_FOLDER || path.startsWith(`${DEMO_FOLDER}/`))).toBe(true);
});

test("a user's own project named like the demo is not taken for it", async () => {
  const mine = Object.assign({}, DEFAULT_PROJECT, {
    name: DEMO_NAMES.tracker,
    id: "mine",
    path: "Мои заметки",
    dataSource: { kind: "folder", config: { path: "Мои заметки", recursive: false } },
    views: [],
  }) as ProjectDefinition;
  settings.addProject(mine);

  const result = await createDemoProject(fakeVault().vault);

  expect(result.created).toContain(DEMO_NAMES.tracker);
  expect(get(settings).projects.find((p) => p.id === "mine")).toEqual(mine);
});

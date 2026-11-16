import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { createProjectConfiguration } from "src/lib/projectFiles/projectConfiguration";
import { textDigest } from "src/lib/projectFiles/document";
import { ProjectConfigurationService } from "./configurationService";
type State = import("src/settings/settings").LatestProjectsPluginSettings;
type Plugin = import("obsidian").Plugin;

jest.mock("obsidian", () => ({ TFile: class { path: string; text: string; constructor(path: string, text: string) { this.path = path; this.text = text; } get stat() { return { size: new (require("node:util").TextEncoder)().encode(this.text).length, mtime: this.text.length }; } }, TFolder: class {} }));
const { TFile, TFolder } = require("obsidian");
const saved = { crypto: window.crypto, TextEncoder: window.TextEncoder };
beforeAll(() => { for (const [key, value] of Object.entries({ crypto: webcrypto, TextEncoder })) Object.defineProperty(window, key, { value, configurable: true }); });
afterAll(() => { for (const [key, value] of Object.entries(saved)) Object.defineProperty(window, key, { value, configurable: true }); });
async function fixture() {
  const project = { ...DEFAULT_PROJECT, id: "p", name: "Before", uniqueIdCounter: 5 }, path = "Project/Project settings/p.json";
  const text = await createProjectConfiguration(project, "owner-1"), descriptor = { projectId: "p", path, owner: "owner-1", baseRevision: await textDigest(JSON.stringify(project)), sha256: await textDigest(text) };
  let current: State = { ...DEFAULT_SETTINGS, projects: [project], archives: [], preferences: { ...DEFAULT_SETTINGS.preferences, projectFiles: { root: "Copies", autoSync: false, installations: [{ id: "i", archiveHash: "a".repeat(64), journal: "Copies/journal.json", configurations: [descriptor] }] } } };
  const files = new Map<string, { path: string; text: string }>([[path, new TFile(path, text)]]), folders = new Map<string, unknown>();
  const create = jest.fn(async (filePath: string, content: string) => { if (files.has(filePath)) throw Error("occupied"); const file = new TFile(filePath, content); files.set(filePath, file); return file; });
  const host = { app: { vault: { configDir: "AppConfig", getAbstractFileByPath: (filePath: string) => files.get(filePath) ?? folders.get(filePath) ?? null,
    read: async (file: { text: string }) => file.text, create,
    createFolder: async (filePath: string) => { folders.set(filePath, new TFolder()); },
    process: async (file: { text: string }, transform: (text: string) => string) => { file.text = transform(file.text); },
  } } } as unknown as Plugin;
  const commit = jest.fn(async (expected: State, candidate: State, guard?: () => boolean) => { if (current !== expected || guard && !guard()) return "stale" as const; current = candidate; return "confirmed" as const; });
  const service = new ProjectConfigurationService(host, { read: async () => current, commit }, () => true);
  const editDraft = (name: string, counter = 1) => { const doc = JSON.parse(files.get(path)!.text); doc.project.name = name; doc.project.uniqueIdCounter = counter; files.get(path)!.text = JSON.stringify(doc); };
  return { service, files, path, create, commit, editDraft, current: () => current, changePrimary: (name: string, counter = 5) => { current = { ...current, projects: [{ ...current.projects[0]!, name, uniqueIdCounter: counter }] }; } };
}
test("explicit draft application backs up the old project, preserves counter and rebases the visible config", async () => {
  const f = await fixture(); f.editDraft("After");
  const preview = await f.service.preview(f.path, "draft");
  expect(preview.changes).toContainEqual({ location: ["name"], before: '"Before"', after: '"After"' });
  expect(f.current().projects[0]!.name).toBe("Before");
  const receipt = await f.service.apply(preview);
  expect(receipt.copyUpdated).toBe(true); expect(f.files.has(receipt.backup)).toBe(true);
  expect(f.current().projects[0]).toMatchObject({ name: "After", uniqueIdCounter: 5 });
  const doc = JSON.parse(f.files.get(f.path)!.text);
  expect(doc.baseRevision).toBe(await textDigest(JSON.stringify(f.current().projects[0])));
  expect(f.current().preferences.projectFiles!.installations![0]!.configurations[0]!.sha256).toBe(await textDigest(f.files.get(f.path)!.text));
});
test("a source edit after preview refuses before any backup or primary write", async () => {
  const f = await fixture(); f.editDraft("After"); const preview = await f.service.preview(f.path, "draft");
  f.files.get(f.path)!.text += " ";
  await expect(f.service.apply(preview)).rejects.toThrow("stale");
  expect(f.commit).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled();
});
test("outbound sync preserves an external draft and rejects a stale incoming base", async () => {
  const f = await fixture(); f.editDraft("Draft"); f.changePrimary("Concurrent");
  await expect(f.service.syncOwned()).rejects.toThrow("external edits");
  await expect(f.service.preview(f.path, "draft")).rejects.toThrow("stale base");
  expect(JSON.parse(f.files.get(f.path)!.text).project.name).toBe("Draft"); expect(f.commit).not.toHaveBeenCalled();
});
test("a verified snapshot restores settings with a fresh backup and never decreases the counter", async () => {
  const f = await fixture(); f.editDraft("After"); const first = await f.service.apply(await f.service.preview(f.path, "draft"));
  f.changePrimary("After", 12);
  // Sync a confirmed local change before restoring, so the source copy remains owned.
  await f.service.syncOwned();
  const receipt = await f.service.apply(await f.service.preview(first.backup, "restore"));
  expect(f.current().projects[0]).toMatchObject({ name: "Before", uniqueIdCounter: 12 });
  expect(f.files.has(receipt.backup)).toBe(true); expect(receipt.backup).not.toBe(first.backup);
});
test("unconfirmed application keeps the backup and draft, and cannot claim success", async () => {
  const f = await fixture(); f.editDraft("After");
  f.commit.mockResolvedValueOnce("stale");
  await expect(f.service.apply(await f.service.preview(f.path, "draft"))).rejects.toThrow("unconfirmed");
  expect(f.current().projects[0]!.name).toBe("Before"); expect(f.create).toHaveBeenCalledTimes(2);
  expect(JSON.parse(f.files.get(f.path)!.text).project.name).toBe("After");
});

import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, DEFAULT_VIEW } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { canonical } from "src/lib/settings/settingsVerify";
import { refreshPendingImportIsolation } from "src/lib/projectFiles/pendingImportIsolation";
type Plugin = import("obsidian").Plugin;
type State = import("src/settings/settings").LatestProjectsPluginSettings;

jest.mock("src/lib/stores/settings", () => {
  const store = require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS);
  return { settings: Object.assign(store, { updatePreferences: jest.fn((preferences: unknown) => store.update((value: object) => ({ ...value, preferences }))) }) };
});
jest.mock("obsidian", () => ({
  TFile: class { path: string; stat: { size: number; mtime: number }; constructor(path: string, stat: { size: number; mtime: number }) { this.path = path; this.stat = stat; } },
  TFolder: class { path: string; constructor(path: string) { this.path = path; } },
}));
const { TFile, TFolder } = require("obsidian");
const { ProjectPackageService } = require("./packageService") as typeof import("./packageService");
const beforeCrypto = window.crypto, beforeEncoder = window.TextEncoder, beforeDecoder = window.TextDecoder;
beforeAll(() => {
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true });
  Object.defineProperty(window, "TextDecoder", { value: TextDecoder, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, "crypto", { value: beforeCrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: beforeEncoder, configurable: true });
  Object.defineProperty(window, "TextDecoder", { value: beforeDecoder, configurable: true });
});
let disk: State, confirmed: string | null, service: import("./packageService").ProjectPackageService;
let files: Map<string, { path: string; stat: { size: number; mtime: number }; bytes: Uint8Array }>;
let folders: Map<string, unknown>, create: jest.Mock, read: jest.Mock, flush: jest.Mock, mkdir: jest.Mock, primaryMissing: boolean;
let host: Plugin;
function persist(state: State) { disk = state; confirmed = canonical(state); settings.set(state); }
beforeEach(() => {
  jest.mocked(settings.updatePreferences).mockClear();
  primaryMissing = false;
  persist({ ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Project" }],
    preferences: { ...DEFAULT_SETTINGS.preferences, projectFiles: { root: "Copies", autoSync: false } } });
  files = new Map(); folders = new Map(); flush = jest.fn(async () => undefined);
  const source = new TFile("Note.md", { size: 3, mtime: 1 }); source.bytes = new Uint8Array([1, 2, 3]); files.set(source.path, source);
  read = jest.fn(async file => new Uint8Array(file.bytes as Uint8Array).buffer);
  create = jest.fn(async (path: string, buffer: ArrayBuffer) => {
    if (files.has(path)) throw Error("exists");
    const file = new TFile(path, { size: buffer.byteLength, mtime: 1 }); file.bytes = new Uint8Array(buffer); files.set(path, file); return file;
  });
  mkdir = jest.fn(async (path: string) => { folders.set(path, new TFolder(path)); });
  host = { manifest: { dir: "AppConfig/plugins/projects" }, app: { vault: {
    configDir: "AppConfig", adapter: { read: async () => { if (primaryMissing) throw Error("ENOENT: no data.json yet"); return JSON.stringify(disk); } },
    getAbstractFileByPath: (path: string) => files.get(path) ?? folders.get(path),
    getAllLoadedFiles: () => [...files.values(), ...folders.values()],
    readBinary: read, createBinary: create, createFolder: mkdir,
    read: async (file: { bytes: Uint8Array }) => new TextDecoder().decode(file.bytes),
    create: async (path: string, text: string) => create(path, new TextEncoder().encode(text).buffer),
    rename: async (file: { path: string }, destination: string) => { const value = files.get(file.path); if (!value || files.has(destination)) throw Error("rename conflict"); files.delete(file.path); value.path = destination; files.set(destination, value); },
    process: async (file: { bytes: Uint8Array; stat: { size: number; mtime: number } }, transform: (text: string) => string) => {
      file.bytes = new TextEncoder().encode(transform(new TextDecoder().decode(file.bytes)));
      file.stat.size = file.bytes.length; file.stat.mtime++;
    },
  } } } as unknown as Plugin;
  service = new ProjectPackageService(host, flush, () => confirmed, () => true);
});
afterEach(() => service.dispose());

test("configuration-only package reaches verified visible JSON and confirmed new project through the real service", async () => {
  service.dispose();
  const commits = jest.fn(async (expected: State, candidate: State, guard?: () => boolean) => {
    if (get(settings) !== expected || guard && !guard()) return "stale" as const;
    persist(candidate); return "confirmed" as const;
  });
  service = new ProjectPackageService(host, flush, () => confirmed, () => true, { read: async () => get(settings), commit: commits });
  const saved = await service.save(await service.prepare("p", []));
  const choice = { projectId: "p", location: ["dataSource", "config", "path"], root: "Imported", source: "", kind: "folder" as const, target: "Imported", origin: "planned" as const };
  const preview = await service.previewFiles(saved.path, saved.sha256, "Imported", [choice]);
  const scopes = preview.scopeReview.rows.map(row => ({ projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" as const }));
  const receipt = await service.install(saved.path, saved.sha256, "Imported", [choice], scopes);
  expect(receipt.configurations).toHaveLength(1); expect(commits).toHaveBeenCalledTimes(2);
  expect(disk.projects).toHaveLength(2); expect(disk.projects[1]!.id).not.toBe("p");
  expect(disk.projects[1]!.dataSource.config).toMatchObject({ path: "Imported" });
  const config = files.get(receipt.configurations[0]!.path)!;
  expect(JSON.parse(new TextDecoder().decode(config.bytes)).project.id).toBe(disk.projects[1]!.id);
  expect(disk.preferences.projectFiles?.pendingImport).toBeUndefined();
  expect(files.has(saved.path)).toBe(true);
  const trash = jest.fn(async (file: { path: string }) => { files.delete(file.path); });
  Object.defineProperty(host.app, "fileManager", { configurable: true, value: { trashFile: trash } });
  await service.trashSource(saved.path, receipt);
  expect(trash).toHaveBeenCalledTimes(1); expect(files.has(saved.path)).toBe(false); expect(disk.projects).toHaveLength(2);
});

test("native preparation unlocks a note package and preserves original bytes until verified activation", async () => {
  service.dispose();
  let changed: ((file: unknown, text: string, cache: unknown) => void) | undefined;
  Object.defineProperty(host.app, "metadataCache", { configurable: true, value: { on: (_name: string, callback: typeof changed) => { changed = callback; return {}; }, offref: () => { changed = undefined; } } });
  const createText = host.app.vault.create.bind(host.app.vault);
  host.app.vault.create = async (path, text) => { const file = await createText(path, text); changed?.(file, text, {}); return file; };
  service = new ProjectPackageService(host, flush, () => confirmed, () => true, { read: async () => get(settings), commit: async (expected, candidate, guard) => {
    if (expected !== get(settings) || guard && !guard()) return "stale"; persist(candidate); return "confirmed";
  } });
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported")).configuration.issues.some(issue => issue.code === "note-inspection-required")).toBe(true);
  await service.stage(saved.path, saved.sha256, "Copies");
  const preview = await service.previewFiles(saved.path, saved.sha256, "Imported");
  expect(preview.configuration.issues.map(issue => issue.code)).toEqual(["scope-choice-required"]);
  const scopes = preview.scopeReview.rows.map(row => ({ projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" as const }));
  await service.install(saved.path, saved.sha256, "Imported", [], scopes);
  expect(files.get("Imported/Note.md")!.bytes).toEqual(new Uint8Array([1, 2, 3]));
  expect(disk.projects).toHaveLength(2); expect(disk.preferences.projectFiles?.pendingImport).toBeUndefined();
});

test("native inspection pauses acquisition before Markdown creation and waits for Dataview index cleanup", async () => {
  service.dispose();
  const indexed = new Set<string>(); let changed: ((file: unknown, text: string, cache: unknown) => void) | undefined;
  Object.defineProperty(host.app, "plugins", { configurable: true, value: { enabledPlugins: new Set(["dataview"]), plugins: { dataview: { api: { pagePaths: () => ({ array: () => [...indexed] }) } } } } });
  Object.defineProperty(host.app, "metadataCache", { configurable: true, value: { on: (_name: string, callback: typeof changed) => { changed = callback; return {}; }, offref: () => { changed = undefined; } } });
  const createText = host.app.vault.create.bind(host.app.vault), rename = host.app.vault.rename.bind(host.app.vault);
  const observed: string[] = [];
  host.app.vault.create = async (path, text) => {
    const file = await createText(path, text);
    if (path.endsWith(".md") && changed) {
      expect(get(settings).preferences.projectFiles?.pendingImport?.phase).toBe("note-inspection");
      indexed.add(path.toLowerCase()); observed.push(path); changed(file, text, {});
    }
    return file;
  };
  host.app.vault.rename = async (file, destination) => { const old = file.path.toLowerCase(); await rename(file, destination); window.setTimeout(() => indexed.delete(old), 10); };
  service = new ProjectPackageService(host, flush, () => confirmed, () => true, { read: async () => get(settings), commit: async (expected, candidate, guard) => {
    if (expected !== get(settings) || guard && !guard()) return "stale";
    if (!candidate.preferences.projectFiles?.pendingImport && get(settings).preferences.projectFiles?.pendingImport?.phase === "note-inspection") expect(indexed.size).toBe(0);
    persist(candidate); return "confirmed";
  } });
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  await service.stage(saved.path, saved.sha256, "Copies");
  expect(observed).toHaveLength(1); expect(indexed.size).toBe(0);
  expect(files.has(observed[0]!)).toBe(false); expect(files.has(observed[0]!.slice(0, -3) + ".bin")).toBe(true);
  expect(get(settings).preferences.projectFiles?.pendingImport).toBeUndefined();
});

test("interrupted native preparation remains fenced and cleanup preserves its bytes before clearing the flag", async () => {
  service.dispose();
  Object.defineProperty(host.app, "metadataCache", { configurable: true, value: { on: () => ({}), offref: () => {} } });
  const createText = host.app.vault.create.bind(host.app.vault);
  host.app.vault.create = async (path, text) => { const file = await createText(path, text); if (path.includes("Note inspection/") && path.endsWith(".md")) throw Error("parser interrupted"); return file; };
  service = new ProjectPackageService(host, flush, () => confirmed, () => true, { read: async () => get(settings), commit: async (expected, candidate, guard) => { if (expected !== get(settings) || guard && !guard()) return "stale"; persist(candidate); return "confirmed"; } });
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  await expect(service.stage(saved.path, saved.sha256, "Copies")).rejects.toThrow("parser interrupted");
  const pending = get(settings).preferences.projectFiles!.pendingImport!;
  expect(pending.phase).toBe("note-inspection"); expect(files.has(pending.paths[0]!)).toBe(true);
  await expect(service.recover("rollback", "another-operation")).rejects.toThrow("intent changed");
  expect(files.has(pending.paths[0]!)).toBe(true);
  expect(await service.recover("rollback", pending.id)).toEqual({ preparationReset: true });
  expect(files.get(pending.paths[0]!.slice(0, -3) + ".bin")!.bytes).toEqual(new Uint8Array([1, 2, 3]));
  expect(get(settings).preferences.projectFiles?.pendingImport).toBeUndefined(); expect(get(settings).projects).toHaveLength(1);
});

test("preview performs no writes; save creates one visible ZIP and verifies actual bytes", async () => {
  const prepared = await service.prepare("p", ["Note.md"]);
  expect(create).not.toHaveBeenCalled(); expect(folders.size).toBe(0);
  const saved = await service.save(prepared);
  expect(saved.path).toMatch(/^Copies\/Packages\/[a-f0-9]{64}-[a-f0-9]{64}\.zip$/);
  expect(saved.bytes).toBe(files.get(saved.path)?.bytes.length);
  expect(create).toHaveBeenCalledTimes(1);
  expect(disk).toEqual(get(settings));
  await expect(service.save(prepared)).resolves.toEqual(saved);
  expect(create).toHaveBeenCalledTimes(1);
});

test("pending payloads cannot be selected or exported even by a service created before quarantine", async () => {
  const hash = "a".repeat(64), before = JSON.stringify(disk);
  refreshPendingImportIsolation({ root: "Copies", autoSync: false, pendingImport: { format: "obs-projects-plus/pending-import", schemaVersion: 1, id: "attempt", archiveHash: hash, journal: `Copies/Incoming/${hash}/Installations/attempt.json`, paths: ["Note.md"] } }, "AppConfig");
  try {
    expect(service.eligible("Note.md")).toBe(false); expect(service.eligible("Other.md")).toBe(true);
    await expect(service.prepare("p", ["Note.md"])).rejects.toThrow("excluded");
    expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(JSON.stringify(disk)).toBe(before);
  } finally { refreshPendingImportIsolation(undefined, "AppConfig"); }
});

test("file placement preview checks a fresh archive and current inventory without flush or writes", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  const occupied = new TFile("Imported/Note.md", { size: 3, mtime: 1 }); files.set(occupied.path, occupied);
  const before = JSON.stringify(disk); create.mockClear(); mkdir.mockClear(); flush.mockClear();
  confirmed = null; // Read-only planning does not acquire primary-write authority.
  const result = await service.previewFiles(saved.path, saved.sha256, "Imported");
  expect(result.files[0]?.destination).toBe("Imported/Note.md");
  expect(result.conflicts).toContainEqual({ code: "file-exists", destination: "Imported/Note.md", existing: "Imported/Note.md" });
  expect(result.configuration.projects[0]!.project.dataSource.config).toMatchObject({ path: "Imported" });
  expect(result.configuration.scopes[0]!.existingCandidates).toBe(1);
  expect(result.configuration.issues.map(issue => issue.code)).toEqual(["scope-choice-required", "note-inspection-required"]);
  expect(JSON.stringify(disk)).toBe(before); expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
  files.delete(occupied.path);
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported")).conflicts).toEqual([]);
});

test("file preview rejects stale hash and protected destination without changing settings", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  await expect(service.previewFiles(saved.path, "0".repeat(64), "Imported")).rejects.toThrow("stale");
  await expect(service.previewFiles(saved.path, saved.sha256, "Copies/Incoming")).rejects.toThrow("reserved");
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("manual choices are captured before an archive read and cannot change while awaiting it", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  folders.set("Other", new TFolder("Other"));
  const choice = { projectId: "p", location: ["newNotesFolder"], root: "Imported", source: "", kind: "folder" as const, target: "Other", origin: "existing" as const };
  const bytes = new Uint8Array(files.get(saved.path)!.bytes).buffer;
  let finish!: (value: ArrayBuffer) => void;
  read.mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  const pending = service.previewFiles(saved.path, saved.sha256, "Imported", [choice]);
  choice.target = "AppConfig"; choice.location[0] = "templates";
  finish(bytes);
  const result = await pending;
  expect(result.configuration.projects[0]!.project.newNotesFolder).toBe("Other");
  expect(result.configuration.choices[0]).toMatchObject({ target: "Other", location: ["newNotesFolder"] });
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("scope confirmation is read-only and is invalidated by current inventory, settings paths or archive changes", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  const first = await service.previewFiles(saved.path, saved.sha256, "Imported"), row = first.scopeReview.rows[0]!;
  const choice = { projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" as const };
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  const confirmed = await service.previewFiles(saved.path, saved.sha256, "Imported", [], [choice]);
  expect(confirmed.scopeReview.rows[0]!.status).toBe("confirmed"); expect(confirmed.configuration.issues.map(issue => issue.code)).toEqual(["note-inspection-required"]);
  files.get("Note.md")!.stat.mtime++;
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported", [], [choice])).scopeReview.rows[0]!.status).toBe("invalid");
  files.get("Note.md")!.stat.mtime--;
  folders.set("Unrelated", new TFolder("Unrelated"));
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported", [], [choice])).scopeReview.rows[0]!.status).toBe("invalid");
  folders.delete("Unrelated");
  persist({ ...disk, preferences: { ...disk.preferences, projectFiles: { root: "Copies", autoSync: false, previousRoots: ["Old"] } } });
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported", [], [choice])).scopeReview.rows[0]!.status).toBe("invalid");
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("scope choices are captured before reading, and changing metadata during hashing refuses stale results", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  const first = await service.previewFiles(saved.path, saved.sha256, "Imported"), row = first.scopeReview.rows[0]!;
  const choice = { projectId: row.projectId, location: [...row.location], revision: row.revision, mode: "keep-rule" as const };
  let finish!: (value: ArrayBuffer) => void;
  read.mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  const pending = service.previewFiles(saved.path, saved.sha256, "Imported", [], [choice]);
  choice.revision = "e".repeat(64); choice.location[0] = "unknown"; finish(new Uint8Array(files.get(saved.path)!.bytes).buffer);
  expect((await pending).scopeReview.rows[0]!.status).toBe("confirmed");
  const original = window.crypto.subtle.digest.bind(window.crypto.subtle);
  const spy = jest.spyOn(window.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
    const digest = await original(algorithm, data);
    const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
    if (new TextDecoder().decode(bytes).startsWith('[{"path":')) files.get("Note.md")!.stat.mtime++;
    return digest;
  });
  try { await expect(service.previewFiles(saved.path, saved.sha256, "Imported")).rejects.toThrow("scope preview changed"); } finally { spy.mockRestore(); }
});

test("core schema errors remain visible and block a malformed source's scope confirmation without writes", async () => {
  persist({ ...disk, projects: [{ ...disk.projects[0]!, dataSource: { kind: "dataview", config: { query: "not executed", filter: { conditions: [{ field: "done", operator: ["is"], enabled: false, value: "yes" }] } } } } as unknown as State['projects'][number]] });
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  const first = await service.previewFiles(saved.path, saved.sha256, "Imported"), row = first.scopeReview.rows[0]!;
  expect(first.coreChecks[0]!.check).toMatchObject({ complete: false, issues: [expect.objectContaining({ code: "invalid-type", location: ["dataSource", "config", "filter", "conditions", 0, "operator"] })] });
  expect(row.status).toBe("blocked");
  const result = await service.previewFiles(saved.path, saved.sha256, "Imported", [], [{ projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" }]);
  expect(result.configuration.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["schema-invalid", "scope-choice-required", "invalid-scope-choice"]));
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test.each([false, true])("read-only ZIP preview diagnoses a dangling local source or a block loop (loop=%s)", async loop => {
    const block = { id: "w", type: "database-call", title: "W", layout: { x: 0, y: 0, w: 12, h: 8 }, config: {}, sourceConfig: loop ? { projectId: "p::block:v:w" } : { projectId: "", sourceId: "missing" } };
    persist({ ...disk, projects: [{ ...disk.projects[0]!, views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets: [block] } }] }] });
    const saved = await service.save(await service.prepare("p", ["Note.md"]));
    create.mockClear(); mkdir.mockClear(); flush.mockClear();
    const result = await service.previewFiles(saved.path, saved.sha256, "Imported");
    expect(result.coreChecks[0]!.check.issues).toEqual([]);
    expect(result.configuration.issues).toContainEqual({ projectId: "p", location: loop ? ["views", 0, "config", "widgets", 0] : ["views", 0, "config", "widgets", 0, "sourceConfig", "sourceId"], code: "schema-invalid" });
    expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("invalid Agenda is reported without waiving its validation or blocking unrelated source intent", async () => {
  persist({ ...disk, projects: [{ ...disk.projects[0]!, fieldConfig: { Done: {} }, agenda: {} } as unknown as State['projects'][number]] });
  const saved = await service.save(await service.prepare("p", ["Note.md"])), first = await service.previewFiles(saved.path, saved.sha256, "Imported"), row = first.scopeReview.rows[0]!;
  expect(first.coreChecks[0]!.check.issues).toEqual([{ location: ["agenda", "mode"], code: "missing-field" }]);
  expect(first.configuration.issues).toEqual(expect.arrayContaining([expect.objectContaining({ location: ["agenda", "mode"], code: "schema-invalid" })]));
  expect((await service.previewFiles(saved.path, saved.sha256, "Imported", [], [{ projectId: row.projectId, location: row.location, revision: row.revision, mode: "keep-rule" }])).scopeReview.rows[0]!.status).toBe("confirmed");
  expect(first.coreChecks[0]!.check.complete).toBe(false);
});

test("property errors and unsupported formula versions remain blocking configuration diagnostics without writes", async () => {
  persist({ ...disk, projects: [{ ...disk.projects[0]!, fieldConfig: { Invalid: { richText: "false" }, Future: { formulaVersion: "next" }, BadRollup: { rollup: { relationField: "R", targetField: "X", function: "avg", mode: "sum" } } } } as unknown as State['projects'][number]] });
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  const result = await service.previewFiles(saved.path, saved.sha256, "Imported");
  expect(result.coreChecks[0]!.check).toMatchObject({ coverage: "root-fields-agenda-sources-and-supported-view-configs", complete: false });
  expect(result.configuration.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ location: ["fieldConfig", "Invalid", "richText"], code: "schema-invalid" }),
    expect.objectContaining({ location: ["fieldConfig", "Future", "formulaVersion"], code: "schema-unsupported" }),
    expect.objectContaining({ location: ["fieldConfig", "BadRollup", "rollup", "function"], code: "schema-invalid" }),
  ]));
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("unconfirmed primary state and stale previews cannot write packages", async () => {
  confirmed = null;
  await expect(service.prepare("p", ["Note.md"])).rejects.toThrow("not confirmed");
  expect(read).not.toHaveBeenCalled();
  confirmed = canonical(disk);
  const prepared = await service.prepare("p", []);
  persist({ ...disk, projects: disk.projects.map(project => ({ ...project, name: "Changed" })) });
  await expect(service.save(prepared)).rejects.toThrow("stale");
  expect(create).not.toHaveBeenCalled();
});

test.each(["project", "destination"])("a %s change during folder creation blocks the stale host write", async change => {
  const prepared = await service.prepare("p", []);
  let finish!: () => void, started!: () => void;
  const creating = new Promise<void>(resolve => { started = resolve; });
  mkdir.mockImplementationOnce((path: string) => new Promise<void>(resolve => {
    finish = () => { folders.set(path, new TFolder(path)); resolve(); }; started();
  }));
  const pending = service.save(prepared);
  await creating;
  if (change === "project") persist({ ...disk, projects: disk.projects.map(project => ({ ...project, name: "New project revision" })) });
  else persist({ ...disk, preferences: { ...disk.preferences, projectFiles: { root: "Other destination", autoSync: false, previousRoots: ["Copies"] } } });
  finish();
  await expect(pending).rejects.toThrow("stale");
  expect(create).not.toHaveBeenCalled();
});

test("a revision changed during an already started host write cannot report current success", async () => {
  const prepared = await service.prepare("p", []), originalCreate = create.getMockImplementation()!;
  create.mockImplementationOnce(async (...args: unknown[]) => {
    const file = await originalCreate(...args);
    persist({ ...disk, projects: disk.projects.map(project => ({ ...project, name: "Changed while saving" })) });
    return file;
  });
  await expect(service.save(prepared)).rejects.toThrow("stale");
  expect(create).toHaveBeenCalledTimes(1);
  expect(files.size).toBe(2);
});

test("corrupt read-back is an error and never rewrites the archive or primary settings", async () => {
  const prepared = await service.prepare("p", []);
  read.mockImplementation(async file => file.path.endsWith(".zip") ? new Uint8Array([0]).buffer : new Uint8Array(file.bytes as Uint8Array).buffer);
  await expect(service.save(prepared)).rejects.toThrow("read-back");
  expect(create).toHaveBeenCalledTimes(1);
  expect(files.size).toBe(2); // Failed verification preserves the artifact for diagnosis.
  expect(disk.projects[0]?.name).toBe("Project");
});

test("an existing changed ZIP is preserved", async () => {
  const prepared = await service.prepare("p", []), saved = await service.save(prepared);
  files.get(saved.path)!.bytes[0] = 0;
  await expect(service.save(prepared)).rejects.toThrow("read-back");
  expect(create).toHaveBeenCalledTimes(1);
  expect(files.get(saved.path)?.bytes[0]).toBe(0);
});

test("a ZIP disappearing during verification cannot report success", async () => {
  const prepared = await service.prepare("p", []);
  read.mockImplementation(async file => {
    const buffer = new Uint8Array(file.bytes as Uint8Array).buffer;
    if (file.path.endsWith(".zip")) files.delete(file.path);
    return buffer;
  });
  await expect(service.save(prepared)).rejects.toThrow("read-back");
});

test("mid-capture source changes and missing files cannot yield a preview", async () => {
  read.mockImplementationOnce(async file => { file.stat.mtime++; return new Uint8Array(file.bytes as Uint8Array).buffer; });
  await expect(service.prepare("p", ["Note.md"])).rejects.toThrow("changed during capture");
  await expect(service.prepare("p", ["Missing.md"])).rejects.toThrow("missing");
  expect(create).not.toHaveBeenCalled();
});

test("closing the operation while a read is pending retires it without writes", async () => {
  let finish!: (value: ArrayBuffer) => void, started!: () => void;
  const reading = new Promise<void>(resolve => { started = resolve; });
  read.mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; started(); }));
  const pending = service.prepare("p", ["Note.md"]);
  await reading; service.dispose(); finish(new Uint8Array([1, 2, 3]).buffer);
  await expect(pending).rejects.toThrow("retired");
  expect(create).not.toHaveBeenCalled();
});

test("picker excludes hidden configuration, generated copies and ZIP files", () => {
  expect(service.eligible(".hidden/data.json")).toBe(false);
  expect(service.eligible("AppConfig/data.json")).toBe(false);
  expect(service.eligible(`Copies/Projects/${"a".repeat(64)}/Project.md`)).toBe(false);
  expect(service.eligible("Copies/Packages/template.zip")).toBe(false);
  expect(service.eligible("Files/Note.md")).toBe(true);
});

test("inspection works without local projects or confirmed settings and never flushes or writes", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  persist({ ...DEFAULT_SETTINGS, projects: [] }); confirmed = null;
  const initial = get(settings), result = await service.inspect(saved.path);
  expect(result.manifest.rootProjectId).toBe("p");
  expect(get(settings)).toBe(initial);
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("oversized incoming archive is rejected before reading", async () => {
  const huge = new TFile("Incoming/Huge.zip", { size: 20 * 1024 * 1024 + 1, mtime: 1 }); files.set(huge.path, huge);
  await expect(service.inspect(huge.path)).rejects.toThrow("size-limit");
  expect(read).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
});

test("an archive changed while reading cannot be inspected as current", async () => {
  const saved = await service.save(await service.prepare("p", [])); create.mockClear(); mkdir.mockClear(); flush.mockClear();
  read.mockImplementationOnce(async file => { file.stat.mtime++; return new Uint8Array(file.bytes as Uint8Array).buffer; });
  await expect(service.inspect(saved.path)).rejects.toThrow("changed during capture");
  expect(flush).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
});

test("closing an incoming inspection during a read retires it", async () => {
  const saved = await service.save(await service.prepare("p", [])); create.mockClear(); flush.mockClear();
  let finish!: (value: ArrayBuffer) => void;
  read.mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  const pending = service.inspect(saved.path);
  await expect(service.prepare("p", [])).rejects.toThrow("busy");
  service.dispose(); finish(new Uint8Array(files.get(saved.path)!.bytes).buffer);
  await expect(pending).rejects.toThrow("retired");
  expect(flush).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
});

test("explicit staging writes only reserved blobs and journal, retaining archive and active projects", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  const archive = new Uint8Array(files.get(saved.path)!.bytes), note = new Uint8Array(files.get("Note.md")!.bytes), before = JSON.stringify(disk);
  create.mockClear();
  const receipt = await service.stage(saved.path, saved.sha256, "Copies");
  expect(receipt.folder).toBe(`Copies/Incoming/${saved.sha256}`);
  expect(JSON.parse(new TextDecoder().decode(files.get(receipt.journal)!.bytes)).state).toBe("ready");
  expect(create.mock.calls.every(([path]) => path.startsWith("Copies/Incoming/") && /\.(json|bin)$/.test(path))).toBe(true);
  expect(files.get(saved.path)?.bytes).toEqual(archive); expect(files.get("Note.md")?.bytes).toEqual(note);
  expect(JSON.stringify(disk)).toBe(before); expect(settings.updatePreferences).not.toHaveBeenCalled();
  create.mockClear(); await expect(service.stage(saved.path, saved.sha256, "Copies")).resolves.toMatchObject({ resumed: true, created: 0 });
  expect(create).not.toHaveBeenCalled();
});

test("first staging in an empty vault binds the default reserved root through the primary writer", async () => {
  const saved = await service.save(await service.prepare("p", []));
  persist({ ...DEFAULT_SETTINGS, projects: [] });
  flush.mockImplementation(async () => { persist(get(settings)); });
  await expect(service.stage(saved.path, saved.sha256, "Projects Plus")).resolves.toMatchObject({ resumed: false });
  expect(disk.projects).toEqual([]);
  expect(disk.preferences.projectFiles).toEqual({ root: "Projects Plus", autoSync: false });
  expect(settings.updatePreferences).toHaveBeenCalledTimes(1);
});

test("a genuinely fresh vault with no data.json performs its first checked preference save before staging", async () => {
  const saved = await service.save(await service.prepare("p", []));
  persist({ ...DEFAULT_SETTINGS, projects: [] }); primaryMissing = true; confirmed = canonical(null);
  create.mockClear(); mkdir.mockClear();
  // Model the primed writer: no dirty settings means no write. A real preference
  // update queues the ordinary first save and establishes its confirmed base.
  flush.mockImplementation(async () => {
    if (get(settings).preferences.projectFiles) { primaryMissing = false; persist(get(settings)); }
  });
  await expect(service.stage(saved.path, saved.sha256, "Projects Plus")).resolves.toMatchObject({ resumed: false });
  expect(primaryMissing).toBe(false); expect(disk.projects).toEqual([]);
  expect(disk.preferences.projectFiles).toEqual({ root: "Projects Plus", autoSync: false });
  expect(settings.updatePreferences).toHaveBeenCalledTimes(1);
});

test("a writer refusing a newly replaced fresh base still blocks staging and preserves the disk version", async () => {
  const saved = await service.save(await service.prepare("p", []));
  const foreign = { ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "foreign", name: "Other device" }] };
  persist(foreign); settings.set({ ...DEFAULT_SETTINGS, projects: [] }); confirmed = canonical(null);
  create.mockClear(); mkdir.mockClear();
  // The existing checked writer refuses the competing first write; flush does
  // not establish confirmation. No direct adapter write is available here.
  await expect(service.stage(saved.path, saved.sha256, "Projects Plus")).rejects.toThrow("not confirmed");
  expect(disk).toBe(foreign); expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
});

test("a known settings file resolved with additional defaults can initialize its first staging root", async () => {
  const saved = await service.save(await service.prepare("p", []));
  disk = { version: 4 } as State; confirmed = canonical(disk); settings.set({ ...DEFAULT_SETTINGS, projects: [] });
  flush.mockImplementation(async () => { if (get(settings).preferences.projectFiles) persist(get(settings)); });
  await expect(service.stage(saved.path, saved.sha256, "Projects Plus")).resolves.toMatchObject({ resumed: false });
  expect(disk.projects).toEqual([]); expect(disk.preferences.projectFiles?.root).toBe("Projects Plus");
});

test("an unknown primary base cannot queue automatic first-root initialization", async () => {
  const saved = await service.save(await service.prepare("p", []));
  persist({ ...DEFAULT_SETTINGS, projects: [] }); confirmed = null;
  create.mockClear(); mkdir.mockClear();
  await expect(service.stage(saved.path, saved.sha256, "Projects Plus")).rejects.toThrow("not confirmed");
  expect(settings.updatePreferences).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
});

test("a different valid ZIP at the selected path requires a fresh preview before any staging writes", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"]));
  const replacement = await service.save(await service.prepare("p", []));
  const target = files.get(saved.path)!; target.bytes = new Uint8Array(files.get(replacement.path)!.bytes); target.stat.size = target.bytes.length; target.stat.mtime++;
  create.mockClear(); mkdir.mockClear(); flush.mockClear();
  await expect(service.stage(saved.path, saved.sha256, "Copies")).rejects.toThrow("preview is stale");
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled(); expect(flush).not.toHaveBeenCalled();
});

test("changed destination and unconfirmed settings block preparation", async () => {
  const saved = await service.save(await service.prepare("p", []));
  create.mockClear(); mkdir.mockClear();
  persist({ ...disk, preferences: { ...disk.preferences, projectFiles: { root: "Other", autoSync: false, previousRoots: ["Copies"] } } });
  await expect(service.stage(saved.path, saved.sha256, "Copies")).rejects.toThrow("destination changed");
  confirmed = null;
  await expect(service.stage(saved.path, saved.sha256, "Other")).rejects.toThrow("not confirmed");
  expect(create).not.toHaveBeenCalled(); expect(mkdir).not.toHaveBeenCalled();
});

test("a partial Vault preparation resumes from the same original ZIP", async () => {
  const saved = await service.save(await service.prepare("p", ["Note.md"])), originalCreate = create.getMockImplementation()!;
  let payloads = 0;
  create.mockImplementation(async (path: string, buffer: ArrayBuffer) => {
    if (path.endsWith(".bin") && ++payloads === 2) throw Error("storage interruption");
    return originalCreate(path, buffer);
  });
  await expect(service.stage(saved.path, saved.sha256, "Copies")).rejects.toThrow("storage interruption");
  create.mockImplementation(originalCreate);
  await expect(service.stage(saved.path, saved.sha256, "Copies")).resolves.toMatchObject({ resumed: true, created: 2 });
  expect(files.has(saved.path)).toBe(true); expect(disk.projects.map(project => project.id)).toEqual(["p"]);
});

test("a primary update during folder creation retires the staging write boundary", async () => {
  const saved = await service.save(await service.prepare("p", [])); create.mockClear();
  mkdir.mockImplementationOnce(async (path: string) => {
    folders.set(path, new TFolder(path));
    persist({ ...disk, projects: disk.projects.map(project => ({ ...project, name: "Updated elsewhere" })) });
  });
  await expect(service.stage(saved.path, saved.sha256, "Copies")).rejects.toThrow("settings changed during staging");
  expect(create).not.toHaveBeenCalled();
});

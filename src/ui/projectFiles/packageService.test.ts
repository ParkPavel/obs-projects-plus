import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { canonical } from "src/lib/settings/settingsVerify";
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
  const host = { manifest: { dir: "AppConfig/plugins/projects" }, app: { vault: {
    configDir: "AppConfig", adapter: { read: async () => { if (primaryMissing) throw Error("ENOENT: no data.json yet"); return JSON.stringify(disk); } },
    getAbstractFileByPath: (path: string) => files.get(path) ?? folders.get(path),
    readBinary: read, createBinary: create, createFolder: mkdir,
    read: async (file: { bytes: Uint8Array }) => new TextDecoder().decode(file.bytes),
    create: async (path: string, text: string) => create(path, new TextEncoder().encode(text).buffer),
    process: async (file: { bytes: Uint8Array; stat: { size: number; mtime: number } }, transform: (text: string) => string) => {
      file.bytes = new TextEncoder().encode(transform(new TextDecoder().decode(file.bytes)));
      file.stat.size = file.bytes.length; file.stat.mtime++;
    },
  } } } as unknown as Plugin;
  service = new ProjectPackageService(host, flush, () => confirmed, () => true);
});
afterEach(() => service.dispose());

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

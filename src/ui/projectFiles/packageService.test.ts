import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { get } from "svelte/store";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { settings } from "src/lib/stores/settings";
import { canonical } from "src/lib/settings/settingsVerify";
type Plugin = import("obsidian").Plugin;
type State = import("src/settings/settings").LatestProjectsPluginSettings;

jest.mock("src/lib/stores/settings", () => ({ settings: require("svelte/store").writable(require("src/settings/settings").DEFAULT_SETTINGS) }));
jest.mock("obsidian", () => ({
  TFile: class { path: string; stat: { size: number; mtime: number }; constructor(path: string, stat: { size: number; mtime: number }) { this.path = path; this.stat = stat; } },
  TFolder: class { path: string; constructor(path: string) { this.path = path; } },
}));
const { TFile, TFolder } = require("obsidian");
const { ProjectPackageService } = require("./packageService") as typeof import("./packageService");
const beforeCrypto = window.crypto, beforeEncoder = window.TextEncoder;
beforeAll(() => {
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, "crypto", { value: beforeCrypto, configurable: true });
  Object.defineProperty(window, "TextEncoder", { value: beforeEncoder, configurable: true });
});
let disk: State, confirmed: string | null, service: import("./packageService").ProjectPackageService;
let files: Map<string, { path: string; stat: { size: number; mtime: number }; bytes: Uint8Array }>;
let folders: Map<string, unknown>, create: jest.Mock, read: jest.Mock, flush: jest.Mock;
function persist(state: State) { disk = state; confirmed = canonical(state); settings.set(state); }
beforeEach(() => {
  persist({ ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Project" }],
    preferences: { ...DEFAULT_SETTINGS.preferences, projectFiles: { root: "Copies", autoSync: false } } });
  files = new Map(); folders = new Map(); flush = jest.fn(async () => undefined);
  const source = new TFile("Note.md", { size: 3, mtime: 1 }); source.bytes = new Uint8Array([1, 2, 3]); files.set(source.path, source);
  read = jest.fn(async file => new Uint8Array(file.bytes as Uint8Array).buffer);
  create = jest.fn(async (path: string, buffer: ArrayBuffer) => {
    if (files.has(path)) throw Error("exists");
    const file = new TFile(path, { size: buffer.byteLength, mtime: 1 }); file.bytes = new Uint8Array(buffer); files.set(path, file); return file;
  });
  const host = { manifest: { dir: "AppConfig/plugins/projects" }, app: { vault: {
    configDir: "AppConfig", adapter: { read: async () => JSON.stringify(disk) },
    getAbstractFileByPath: (path: string) => files.get(path) ?? folders.get(path),
    readBinary: read, createBinary: create, createFolder: async (path: string) => { folders.set(path, new TFolder(path)); },
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

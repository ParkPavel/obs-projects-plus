import { webcrypto } from "node:crypto";
import { TextEncoder, TextDecoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { prepareProjectPackage } from "../package";
import { createProjectZip } from "../packageZip";
import { inspectProjectPackage } from "../packageInspect";
import { stageProjectPackage } from "../packageStage";
import type { ProjectStageStorage } from "../packageStage";
import type { InspectedProjectPackage } from "../packageInspect";

const original = { crypto: window.crypto, TextEncoder: window.TextEncoder, TextDecoder: window.TextDecoder };
const encoder = new TextEncoder(), decoder = new TextDecoder();
let inspected: InspectedProjectPackage;
beforeAll(async () => {
  for (const [name, value] of Object.entries({ crypto: webcrypto, TextEncoder, TextDecoder })) Object.defineProperty(window, name, { value, configurable: true });
  const prepared = await prepareProjectPackage({ ...DEFAULT_SETTINGS, projects: [{ ...DEFAULT_PROJECT, id: "p", name: "Project", uniqueIdCounter: 93 }] }, "p", ["Notes/Визит.md", "Assets/image.bin"], async path => path.endsWith(".md") ? encoder.encode("[[Клиент|имя]]\r\n") : new Uint8Array([0, 255, 1]), "AppConfig");
  inspected = await inspectProjectPackage(await createProjectZip(prepared), "AppConfig");
});
afterAll(() => { for (const [name, value] of Object.entries(original)) Object.defineProperty(window, name, { value, configurable: true }); });

class MemoryStage implements ProjectStageStorage {
  files = new Map<string, Uint8Array>(); folders = new Set<string>(); writes: string[] = [];
  beforeBinary: ((path: string) => void) | undefined;
  afterBinary: ((path: string) => void) | undefined;
  beforeReplace: ((path: string) => void) | undefined;
  async kind(path: string): Promise<"file" | "folder" | null> { return this.files.has(path) ? "file" : this.folders.has(path) ? "folder" : null; }
  async read(path: string) { const bytes = this.files.get(path); return bytes ? decoder.decode(bytes) : null; }
  async readBinary(path: string) { const bytes = this.files.get(path); return bytes ? new Uint8Array(bytes) : null; }
  async mkdir(path: string) { if (this.files.has(path)) throw Error("occupied"); this.folders.add(path); }
  async create(path: string, text: string) { if (await this.kind(path)) throw Error("exists"); this.files.set(path, encoder.encode(text)); this.writes.push(path); }
  async replace(path: string, expected: string, text: string) {
    this.beforeReplace?.(path); if (await this.read(path) !== expected) throw Error("journal CAS conflict");
    this.files.set(path, encoder.encode(text)); this.writes.push(path);
  }
  async createBinary(path: string, bytes: Uint8Array) {
    this.beforeBinary?.(path); if (await this.kind(path)) throw Error("exists");
    this.files.set(path, new Uint8Array(bytes)); this.writes.push(path); this.afterBinary?.(path);
  }
}
const run = (storage: MemoryStage, check?: () => void) => stageProjectPackage(storage, "Copies", inspected, "AppConfig", check);
const journalPath = () => `Copies/Incoming/${inspected.archiveHash}.json`;
const folder = () => `Copies/Incoming/${inspected.archiveHash}`;
const journal = async (storage: MemoryStage) => JSON.parse((await storage.read(journalPath()))!) as { state: string; files: { entry: string; stored: string }[]; completed: string[] };

test("staging preserves exact entries in opaque files and writes a verified ready journal", async () => {
  const storage = new MemoryStage(), receipt = await run(storage), saved = await journal(storage);
  expect(receipt).toMatchObject({ folder: folder(), journal: journalPath(), files: inspected.entries.size, created: inspected.entries.size, resumed: false });
  expect(saved.state).toBe("ready"); expect(saved.completed).toHaveLength(inspected.entries.size);
  for (const file of saved.files) {
    expect(file.stored).toMatch(/^Files\/[a-f0-9]{64}\.bin$/);
    expect(Array.from(storage.files.get(folder() + "/" + file.stored)!)).toEqual(Array.from(inspected.entries.get(file.entry)!));
  }
  expect(Array.from(storage.files.keys()).every(path => path.endsWith(".json") || path.endsWith(".bin"))).toBe(true);
});
test("repeating a complete preparation verifies without rewriting payloads or journal", async () => {
  const storage = new MemoryStage(); await run(storage); const writes = storage.writes.length, raw = await storage.read(journalPath());
  await expect(run(storage)).resolves.toMatchObject({ resumed: true, created: 0 });
  expect(storage.writes.length).toBe(writes); expect(await storage.read(journalPath())).toBe(raw);
});
test("interruption after one checkpoint resumes only missing entries", async () => {
  const storage = new MemoryStage(); let count = 0;
  storage.beforeBinary = () => { if (++count === 2) throw Error("interrupted"); };
  await expect(run(storage)).rejects.toThrow("interrupted");
  expect((await journal(storage)).completed).toHaveLength(1);
  storage.beforeBinary = undefined;
  await expect(run(storage)).resolves.toMatchObject({ resumed: true, created: inspected.entries.size - 1 });
});
test("an acknowledged file landing before its checkpoint is adopted only after matching bytes", async () => {
  const storage = new MemoryStage(); storage.afterBinary = () => { throw Error("stopped before checkpoint"); };
  await expect(run(storage)).rejects.toThrow("stopped");
  expect((await journal(storage)).completed).toHaveLength(0);
  storage.afterBinary = undefined;
  await expect(run(storage)).resolves.toMatchObject({ resumed: true, created: inspected.entries.size - 1 });
});
test("the parent journal permits recovery when payload folder creation was interrupted", async () => {
  const storage = new MemoryStage(), originalMkdir = storage.mkdir.bind(storage);
  storage.mkdir = async path => { if (path === folder()) throw Error("folder interrupted"); return originalMkdir(path); };
  await expect(run(storage)).rejects.toThrow("folder interrupted");
  expect(await storage.read(journalPath())).not.toBeNull(); expect(await storage.kind(folder())).toBeNull();
  storage.mkdir = originalMkdir; await expect(run(storage)).resolves.toMatchObject({ resumed: true, created: inspected.entries.size });
});
test("explicit retry restores a missing payload even if journal arrived first via sync", async () => {
  const storage = new MemoryStage(); await run(storage); const saved = await journal(storage);
  storage.files.delete(folder() + "/" + saved.files[0]!.stored);
  await expect(run(storage)).resolves.toMatchObject({ resumed: true, created: 1 });
});
test("changed payloads are preserved and do not get repaired in place", async () => {
  const storage = new MemoryStage(); await run(storage); const saved = await journal(storage), path = folder() + "/" + saved.files[0]!.stored;
  storage.files.get(path)![0] = storage.files.get(path)![0]! ^ 1; const changed = new Uint8Array(storage.files.get(path)!), writes = storage.writes.length;
  await expect(run(storage)).rejects.toThrow("staging conflict");
  expect(storage.files.get(path)).toEqual(changed); expect(storage.writes.length).toBe(writes);
});
test.each(["future", "whitespace", "foreign", "completion"])("externally changed %s journal blocks all writes", async kind => {
  const storage = new MemoryStage(); await run(storage);
  const raw = (await storage.read(journalPath()))!, value = JSON.parse(raw);
  if (kind === "future") value.schemaVersion = 2;
  if (kind === "foreign") value.archiveHash = "0".repeat(64);
  if (kind === "completion") value.completed[0] = "other";
  const changed = kind === "whitespace" ? raw + " " : JSON.stringify(value);
  storage.files.set(journalPath(), encoder.encode(changed)); const writes = storage.writes.length;
  await expect(run(storage)).rejects.toThrow("staging conflict");
  expect(await storage.read(journalPath())).toBe(changed); expect(storage.writes.length).toBe(writes);
});
test.each(["folder", "file"] as const)("an unclaimed existing staging %s cannot be adopted", async kind => {
  const storage = new MemoryStage();
  if (kind === "folder") storage.folders.add(folder()); else storage.files.set(folder(), new Uint8Array([1]));
  await expect(run(storage)).rejects.toThrow("staging conflict"); expect(storage.writes).toHaveLength(0);
});
test("journal compare-and-swap preserves a last-moment external edit", async () => {
  const storage = new MemoryStage(); storage.beforeReplace = path => storage.files.set(path, encoder.encode("external edit"));
  await expect(run(storage)).rejects.toThrow("CAS conflict");
  expect(await storage.read(journalPath())).toBe("external edit");
});
test("a host reporting success for a truncated payload cannot finish preparation", async () => {
  const storage = new MemoryStage(); storage.afterBinary = path => storage.files.set(path, new Uint8Array([0]));
  await expect(run(storage)).rejects.toThrow("staging conflict");
  expect((await journal(storage)).state).toBe("preparing");
  expect((await journal(storage)).completed).toHaveLength(0);
});
test("retirement after a host write leaves recoverable files and no false ready state", async () => {
  const storage = new MemoryStage(); let alive = true;
  storage.afterBinary = () => { alive = false; };
  await expect(run(storage, () => { if (!alive) throw Error("retired"); })).rejects.toThrow("retired");
  expect((await journal(storage)).state).toBe("preparing");
  storage.afterBinary = undefined; alive = true; await expect(run(storage)).resolves.toMatchObject({ resumed: true });
});
test("a mutated public preview is rejected before journal or directory creation", async () => {
  const storage = new MemoryStage(), entries = new Map(inspected.entries), first = Array.from(entries.keys()).find(path => path !== "manifest.json")!;
  entries.set(first, new Uint8Array([0]));
  await expect(stageProjectPackage(storage, "Copies", { ...inspected, entries }, "AppConfig")).rejects.toThrow("staging conflict");
  expect(storage.writes).toHaveLength(0); expect(storage.folders.size).toBe(0);
});

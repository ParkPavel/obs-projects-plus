import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS, type ProjectDefinition, type LatestProjectsPluginSettings } from "src/settings/settings";
import { createProjectDocument, parseProjectDocument, printProjectDocument, textDigest } from "../document";
import { isProjectCopyPath, projectFilesRoot } from "../paths";
import { syncProjectCopies } from "../mirror";
import type { ProjectFilesStorage } from "../storage";

const originalCrypto = globalThis.crypto, originalEncoder = globalThis.TextEncoder;
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: TextEncoder, configurable: true });
});
afterAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: originalCrypto, configurable: true });
  Object.defineProperty(globalThis, "TextEncoder", { value: originalEncoder, configurable: true });
});

function project(id = "one", name = "Practice"): ProjectDefinition {
  return { ...DEFAULT_PROJECT, id, name, uniqueIdCounter: 81,
    views: [{ id: "view", name: "Overview", type: "custom", config: { future: { values: [null, false, 0, "a\n```\n<!-- /projects-plus:configuration -->"] } }, filter: { conjunction: "and", conditions: [] }, colors: { conditions: [] }, sort: { criteria: [] } }],
  };
}
function value(projects = [project()], archives: ProjectDefinition[] = []): LatestProjectsPluginSettings {
  return { ...DEFAULT_SETTINGS, projects, archives };
}
class MemoryStorage implements ProjectFilesStorage {
  files = new Map<string, string>();
  folders = new Set<string>();
  writes = 0;
  beforeReplace: ((path: string) => void) | undefined;
  async read(path: string) { return this.files.get(path) ?? null; }
  async mkdir(path: string) { this.folders.add(path); }
  async create(path: string, text: string) { if (this.files.has(path)) throw Error("exists"); this.files.set(path, text); this.writes++; }
  async replace(path: string, expected: string, text: string) {
    this.beforeReplace?.(path);
    if (this.files.get(path) !== expected) throw Error("changed during write");
    this.files.set(path, text); this.writes++;
  }
}

test("document round-trip preserves opaque custom settings, counters and fence-like user text", async () => {
  const input = project(), doc = await createProjectDocument(input);
  const parsed = parseProjectDocument(printProjectDocument(doc));
  expect(parsed.project).toEqual(input);
  expect(parsed.project).not.toBe(input);
  expect(parsed.baseRevision).toBe(doc.baseRevision);
  expect(parseProjectDocument(printProjectDocument(doc).replaceAll("\n", "\r\n"))).toEqual(doc);
});

test("duplicate blocks, malformed data and future schemas are never accepted", async () => {
  const text = printProjectDocument(await createProjectDocument(project()));
  expect(() => parseProjectDocument(text + text)).toThrow("ambiguous");
  expect(() => parseProjectDocument(text.replace('"schemaVersion": 1', '"schemaVersion": 2'))).toThrow("version");
  expect(() => parseProjectDocument(text.replace('"baseRevision": "', '"baseRevision": "bad'))).toThrow();
});

test.each(["", "/Projects", "../Projects", "Application config", "Projects/../Other", "Projects//Other", "Projects\\Other", "C:/Other", "Projects/%2e%2e", "Projects/CON", "Projects/bad.", " Projects"])("refuses nonportable/unsafe root %s", root => {
  expect(() => projectFilesRoot(root, "Application config")).toThrow();
});
test("custom application config and its ancestors are protected", () => {
  expect(() => projectFilesRoot("App", "App/Settings")).toThrow();
  expect(() => projectFilesRoot("App/Settings/Copies", "App/Settings")).toThrow();
  expect(projectFilesRoot("Мои проекты/Копии", "Application config")).toBe("Мои проекты/Копии");
});

test("copies active/archived projects losslessly and deduplicates immutable revisions", async () => {
  const storage = new MemoryStorage(), settings = value([project()], [project("archived")]);
  const before = JSON.stringify(settings), result = await syncProjectCopies(storage, "Projects Plus", settings, "Application config");
  expect(result.projects).toBe(2);
  expect(JSON.stringify(settings)).toBe(before);
  expect(result.documents[1]?.archived).toBe(true);
  for (const path of result.copies) expect(parseProjectDocument(storage.files.get(path)!).project.uniqueIdCounter).toBe(81);
  const writes = storage.writes;
  await syncProjectCopies(storage, "Projects Plus", settings, "Application config");
  expect(storage.writes).toBe(writes);
});

test("external edits to a mirror survive both a new revision and repeated export", async () => {
  const storage = new MemoryStorage(), result = await syncProjectCopies(storage, "Copies", value(), "Application config");
  const path = result.copies[0]!, external = storage.files.get(path)! + "\nHuman / AI edits\n";
  storage.files.set(path, external);
  await expect(syncProjectCopies(storage, "Copies", value([project("one", "Changed")]), "Application config")).rejects.toThrow("externally");
  expect(storage.files.get(path)).toBe(external);
  await expect(syncProjectCopies(storage, "Copies", value(), "Application config")).rejects.toThrow("externally");
});

test("a last-moment edit inside the host write queue is not overwritten", async () => {
  const storage = new MemoryStorage(), result = await syncProjectCopies(storage, "Copies", value(), "Application config");
  const path = result.copies[0]!;
  storage.beforeReplace = destination => { if (destination === path) storage.files.set(path, "Other editor"); };
  await expect(syncProjectCopies(storage, "Copies", value([project("one", "New")]), "Application config")).rejects.toThrow("during");
  expect(storage.files.get(path)).toBe("Other editor");
  expect(parseProjectDocument(storage.files.get(result.snapshots[0]!)!).project.name).toBe("Practice");
});

test("corrupt immutable backup and missing mirror are explicit conflicts", async () => {
  const storage = new MemoryStorage(), result = await syncProjectCopies(storage, "Copies", value(), "Application config");
  storage.files.set(result.snapshots[0]!, "Corrupt backup");
  await expect(syncProjectCopies(storage, "Copies", value(), "Application config")).rejects.toThrow("snapshot");
  expect(storage.files.get(result.snapshots[0]!)).toBe("Corrupt backup");
  storage.files.delete(result.copies[0]!);
  await expect(syncProjectCopies(storage, "Copies", value([project("one", "New")]), "Application config")).rejects.toThrow("missing");
});

test("an interrupted index commit can resume without rewriting the accepted mirror", async () => {
  const storage = new MemoryStorage();await syncProjectCopies(storage, "Copies", value(), "Application config");
  const changed = value([project("one", "New")]);
  storage.beforeReplace = path => { if (path.endsWith("sync-index.json")) throw Error("disk unavailable"); };
  await expect(syncProjectCopies(storage, "Copies", changed, "Application config")).rejects.toThrow("disk");
  const count = storage.files.size;
  storage.beforeReplace = undefined;
  await syncProjectCopies(storage, "Copies", changed, "Application config");
  expect(storage.files.size).toBe(count);
});

test("reserved control notes are excluded without excluding imported project records", async () => {
  const key = await textDigest("one");
  expect(isProjectCopyPath(`Copies/Projects/${key}/Project.md`, "Copies")).toBe(true);
  expect(isProjectCopyPath(`Copies/Backups/${key}/${key}.md`, "Copies")).toBe(true);
  expect(isProjectCopyPath(`Copies/Projects/${key}/Notes/Task.md`, "Copies")).toBe(false);
  expect(isProjectCopyPath(`Copies/Projects/${key}/Project.md`, undefined)).toBe(false);
});

test("removed projects keep recoverable copies with an explicit removed state", async () => {
  const storage = new MemoryStorage(), result = await syncProjectCopies(storage, "Copies", value(), "Application config");
  await syncProjectCopies(storage, "Copies", value([]), "Application config");
  expect(storage.files.has(result.copies[0]!)).toBe(true);
  expect(storage.files.has(result.snapshots[0]!)).toBe(true);
  const index = JSON.parse(storage.files.get("Copies/sync-index.json")!);
  expect(index.entries[0].state).toBe("removed");
});
test("a host that resolves a truncated write cannot report a verified snapshot", async () => {
  const storage = new MemoryStorage(), before = JSON.stringify(value());
  storage.create = async (path, text) => { storage.files.set(path, text.slice(0, -4)); };
  await expect(syncProjectCopies(storage, "Copies", value(), "Application config")).rejects.toThrow("verification");
  expect(JSON.stringify(value())).toBe(before);
  expect(storage.files.has("Copies/sync-index.json")).toBe(false);
});

test("key-order changes preserve their order and create consistent distinct snapshots", async () => {
  const storage = new MemoryStorage();
  const firstProject = { ...project(), fieldConfig: { a: {}, b: {} } };
  const reordered = { ...project(), fieldConfig: { b: {}, a: {} } };
  const first = await syncProjectCopies(storage, "Copies", value([firstProject]), "Application config");
  const next = await syncProjectCopies(storage, "Copies", value([reordered]), "Application config");
  expect(first.snapshots[0]).not.toBe(next.snapshots[0]);
  const text = storage.files.get(next.snapshots[0]!)!;
  expect(next.snapshots[0]).toContain(await textDigest(text));
  expect(Object.keys(parseProjectDocument(text).project.fieldConfig)).toEqual(["b", "a"]);
  expect(Object.keys(parseProjectDocument(storage.files.get(first.snapshots[0]!)!).project.fieldConfig)).toEqual(["a", "b"]);
});

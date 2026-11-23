import { DEFAULT_PROJECT, DEFAULT_SETTINGS, type ProjectDefinition } from "src/settings/settings";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { TagDataSource } from "src/lib/datasources/tag/datasource";
import { NativeQueryDataSource } from "src/lib/datasources/native-query/datasource";
import { DataviewDataSource } from "src/lib/datasources/dataview/datasource";
import type { DataviewApi } from "src/lib/datasources/dataview/api";
import { refreshPendingImportIsolation, type PendingProjectImport } from "../pendingImportIsolation";
import { nextCopyPreferences } from "../paths";
import { createDataSource } from "src/lib/datasources";

const partial = "Notes/Partial.md", keep = "Notes/Keep.md", hash = "a".repeat(64);
const pending: PendingProjectImport = { format: "obs-projects-plus/pending-import", schemaVersion: 1, id: "attempt", archiveHash: hash,
  journal: `Copies/Incoming/${hash}/Installations/attempt.json`, paths: [partial] };
const preferences = { ...DEFAULT_SETTINGS.preferences, projectSizeLimit: 1, projectFiles: { root: "Copies", autoSync: false } };
const definition = (dataSource: ProjectDefinition['dataSource']): ProjectDefinition => ({ ...DEFAULT_PROJECT, id: "p", name: "P", dataSource });
afterEach(() => { refreshPendingImportIsolation(undefined, "AppConfig"); jest.restoreAllMocks(); });

test.each(["folder", "tag", "native-query"] as const)("an existing %s actor excludes pending notes before limits and event matching", async kind => {
  const fs = new InMemFileSystem({});
  await fs.create(partial, "#task\n"); await fs.create(keep, "#task\n");
  const source = kind === "folder" ? new FolderDataSource(fs, definition({ kind: "folder", config: { path: "Notes", recursive: true } }), preferences)
    : kind === "tag" ? new TagDataSource(fs, definition({ kind: "tag", config: { tag: "task", hierarchy: false } }), preferences)
      : new NativeQueryDataSource(fs, definition({ kind: "native-query", config: { from: { kind: "folder", path: "Notes", recursive: true } } }), preferences);
  expect(source.includes(partial)).toBe(true);
  const readPartial = jest.spyOn(fs.getFile(partial)!, "read").mockRejectedValue(new Error("incomplete payload must not be parsed"));
  expect(refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: pending }, "AppConfig")).toBe("pending");
  expect(source.includes(partial)).toBe(false); expect(source.includes(keep)).toBe(true);
  expect((await source.queryAll()).records.map(record => record.id)).toEqual([keep]);
  const one = (await source.queryOne(fs.getFile(partial)!, [])).records;
  expect(one.map(record => record.id)).not.toContain(partial);
  if (kind !== "native-query") expect(one).toEqual([]);
  expect(readPartial).not.toHaveBeenCalled();
  refreshPendingImportIsolation(undefined, "AppConfig");
  expect(source.includes(partial)).toBe(true); expect(source.includes(keep)).toBe(true);
});

test("Dataview pauses while payloads are pending and resumes the original query after completion", async () => {
  const fs = new InMemFileSystem({}); await fs.create(partial, "#task\n"); await fs.create(keep, "#task\n");
  const seen: string[] = [];
  const api = { settings: { tableIdColumnName: "File" }, query: async (query: string) => { seen.push(query); return { successful: true, value: { type: "table", headers: ["File"], values: [[{ path: partial }], [{ path: keep }]] } }; } } as unknown as DataviewApi;
  const source = new DataviewDataSource(fs, definition({ kind: "dataview", config: { query: "TABLE FROM #task" } }), preferences, api);
  refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: pending }, "AppConfig");
  expect(source.includes(partial)).toBe(false);
  await expect(source.queryAll()).rejects.toThrow(); expect(seen).toEqual([]);
  refreshPendingImportIsolation(undefined, "AppConfig");
  expect((await source.queryAll()).records.map(record => record.id)).toEqual([partial, keep]);
  expect(seen).toEqual(["TABLE FROM #task"]);
});

test("aggregate DQL rows without file paths cannot expose incomplete imports", async () => {
  const fs = new InMemFileSystem({}); const query = jest.fn(async () => ({ successful: true, value: { type: "table", headers: ["Group", "Total"], values: [["All", 999]] } }));
  const api = { settings: { tableIdColumnName: "File" }, query } as unknown as DataviewApi;
  const source = new DataviewDataSource(fs, definition({ kind: "dataview", config: { query: "TABLE sum(rows.Amount) GROUP BY true" } }), preferences, api);
  refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: pending }, "AppConfig");
  await expect(source.queryAll()).rejects.toThrow(); expect(query).not.toHaveBeenCalled();
});

test.each([false, true])("an in-flight DQL result is refused across quarantine changes (already cleared=%s)", cleared => {
  return (async () => {
    const fs = new InMemFileSystem({}); let finish!: (value: unknown) => void;
    const query = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const api = { settings: { tableIdColumnName: "File" }, query } as unknown as DataviewApi;
    const source = new DataviewDataSource(fs, definition({ kind: "dataview", config: { query: "TABLE" } }), preferences, api);
    const result = source.queryAll(); expect(query).toHaveBeenCalledTimes(1);
    refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: pending }, "AppConfig");
    if (cleared) refreshPendingImportIsolation(undefined, "AppConfig");
    finish({ successful: true, value: { type: "table", headers: ["Total"], values: [[999]] } });
    await expect(result).rejects.toThrow();
  })();
});

test("factory reports paused DQL projects including additional sources, while ordinary folders stay available", () => {
  const fileSystem = new InMemFileSystem({}), folder = definition({ kind: "folder", config: { path: "Notes", recursive: true } });
  const deps = { fileSystem, preferences, dataviewApi: {} as DataviewApi };
  refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: pending }, "AppConfig");
  expect(createDataSource(folder, deps).kind).toBe("ok");
  expect(createDataSource({ ...folder, additionalSources: [{ kind: "dataview", config: { query: "TABLE" } }] }, deps)).toEqual({ kind: "unavailable", reason: "pending-import" });
  refreshPendingImportIsolation({ ...preferences.projectFiles, pendingImport: { ...pending, paths: [] } }, "AppConfig");
  expect(createDataSource(folder, deps)).toEqual({ kind: "unavailable", reason: "pending-import" });
});

test("ordinary copy preference changes cannot silently drop pending ownership", () => {
  const before = { ...preferences.projectFiles, pendingImport: pending }, snapshot = JSON.stringify(before);
  expect(nextCopyPreferences(before, "Copies", true, "AppConfig").pendingImport).toBe(pending);
  expect(() => nextCopyPreferences(before, "Elsewhere", true, "AppConfig")).toThrow("pending import");
  expect(JSON.stringify(before)).toBe(snapshot);
});

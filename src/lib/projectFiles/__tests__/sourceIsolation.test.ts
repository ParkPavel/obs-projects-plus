import { DEFAULT_SETTINGS, DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { TagDataSource } from "src/lib/datasources/tag/datasource";
import { NativeQueryDataSource } from "src/lib/datasources/native-query/datasource";
import { DataviewDataSource } from "src/lib/datasources/dataview/datasource";
import type { DataviewApi } from "src/lib/datasources/dataview/api";

const key = "a".repeat(64), copy = `Copies/Projects/${key}/Project.md`, backup = `Copies/Backups/${key}/${key}.md`;
const note = "Copies/Imported/Task.md";
const preferences = { ...DEFAULT_SETTINGS.preferences, projectSizeLimit: 1, projectFiles: { root: "Copies", autoSync: false } };
function definition(dataSource: ProjectDefinition["dataSource"]): ProjectDefinition { return { ...DEFAULT_PROJECT, id: "project", name: "Project", dataSource }; }
async function files() {
  const fs = new InMemFileSystem({});
  for (const path of [copy, backup, note]) await fs.create(path, "---\nstatus: todo\n---\n#task\n");
  return fs;
}

test("root folder and tag sources ignore owned notes before size limits and event matching", async () => {
  const fs = await files();
  const sources = [new FolderDataSource(fs, definition({ kind: "folder", config: { path: "", recursive: true } }), preferences),
    new TagDataSource(fs, definition({ kind: "tag", config: { tag: "task", hierarchy: false } }), preferences)];
  for (const source of sources) {
    expect(source.includes(copy)).toBe(false);expect(source.includes(backup)).toBe(false);expect(source.includes(note)).toBe(true);
    expect((await source.queryAll()).records.map(record => record.id)).toEqual([note]);
    expect((await source.queryOne(fs.getFile(copy)!, [])).records).toEqual([]);
  }
});
test("native query delegates the same reserved-file boundary", async () => {
  const fs = await files();
  const source = new NativeQueryDataSource(fs, definition({ kind: "native-query", config: { from: { kind: "folder", path: "", recursive: true } } }), preferences);
  expect(source.includes(copy)).toBe(false);
  expect((await source.queryAll()).records.map(record => record.id)).toEqual([note]);
});
test("Dataview file-linked output excludes reserved records without changing the DQL text", async () => {
  const fs = await files();let seenQuery = "";
  const api = { settings: { tableIdColumnName: "File" }, query: async (query: string) => { seenQuery = query;return { successful: true, value: { type: "table", headers: ["File"], values: [[{ path: copy }], [{ path: note }], [{ path: backup }]] } }; } } as unknown as DataviewApi;
  const query = "TABLE FROM #task";
  const source = new DataviewDataSource(fs, definition({ kind: "dataview", config: { query } }), preferences, api);
  expect(source.includes(copy)).toBe(false);
  expect((await source.queryAll()).records.map(record => record.id)).toEqual([note]);
  expect(seenQuery).toBe(query);
});

test("switching the configured root retains isolation of old copies across reloads", async () => {
  const fs = await files();
  const persisted = JSON.parse(JSON.stringify({ ...preferences, projectFiles: { root: "New copies", autoSync: true, previousRoots: ["Copies"] } }));
  const source = new FolderDataSource(fs, definition({ kind: "folder", config: { path: "", recursive: true } }), persisted);
  expect(source.includes(copy)).toBe(false);expect(source.includes(backup)).toBe(false);
  expect((await source.queryAll()).records.map(record => record.id)).toEqual([note]);
});

import { applyDeclaredFieldTypes } from "../declaredFieldTypes";
import { DataApi } from "src/lib/dataApi";
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { NativeQueryDataSource } from "src/lib/datasources/native-query/datasource";
import { DataviewDataSource } from "src/lib/datasources/dataview/datasource";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
const { DataFieldType } = require("src/lib/dataframe/dataframe");
jest.mock("yaml", () => jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js"));

test.each([
  ["select", DataFieldType.Select, "Ready"],
  ["status", DataFieldType.Status, "Doing"],
  ["list", DataFieldType.List, ["one", "two"]],
  ["string", DataFieldType.String, "2026-11-05"],
  ["string", DataFieldType.String, "001"],
  ["string", DataFieldType.String, "false"],
  ["number", DataFieldType.Number, 0],
  ["boolean", DataFieldType.Boolean, false],
  ["list", DataFieldType.List, [0, false, null, "0", "a, b"]],
])("a declared %s field keeps its chosen type after its first actual value is written", async (type, expected, value) => {
  const config = { Value: { type } }, project = { ...DEFAULT_PROJECT, id: "declared", name: "Declared", fieldConfig: config };
  const files = new InMemFileSystem({}); await files.create("A.md", "---\nother: keep\n---\nKeep body");
  const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences);
  const empty = applyDeclaredFieldTypes(await source.queryAll(), config as never);
  expect(empty.fields.find(field => field.name === "Value")?.type).toBe(expected);
  const record = empty.records[0]!;
  await new DataApi(files).updateRecord(empty.fields, { ...record, values: { ...record.values, Value: value } }, ["Value"]);
  const loaded = applyDeclaredFieldTypes(await source.queryAll(), config as never);
  expect(loaded.fields.find(field => field.name === "Value")?.type).toBe(expected);
  expect(loaded.records[0]?.values["Value"]).toEqual(value);
  expect(await files.getFile("A.md")!.read()).toContain("Keep body");
});

test("explicit string parsing precedes inference; unconfigured fields retain historical inference", async () => {
  const files = new InMemFileSystem({}); await files.create("A.md", '---\nValue: "2026-11-05"\nInferred: "2026-11-05"\n---');
  const project = { ...DEFAULT_PROJECT, id: "typed", name: "Typed", fieldConfig: { Value: { type: "string" } } };
  const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences), frame = await source.queryAll();
  expect(frame.records[0]?.values["Value"]).toBe("2026-11-05");
  expect(frame.records[0]?.values["Inferred"]).toBeInstanceOf(Date);
  expect(applyDeclaredFieldTypes(frame, project.fieldConfig as never)).toBe(frame);
});

test.each(["folder", "tag"])("a native-query %s source applies declarations before parsing", async kind => {
  const files = new InMemFileSystem({}); await files.create("A.md", '---\nValue: "2026-11-05"\nChoice: Ready\n---\n#work');
  const project = { ...DEFAULT_PROJECT, id: "native", name: "Native",
    fieldConfig: { Value: { type: "string" }, Choice: { type: "select", options: ["Ready"] } },
    dataSource: { kind: "native-query", config: { from: kind === "folder" ? { kind, path: "", recursive: true } : { kind, tag: "work", hierarchy: false } } } };
  const frame = await new NativeQueryDataSource(files, project as never, DEFAULT_SETTINGS.preferences).queryAll();
  expect(frame.records[0]?.values["Value"]).toBe("2026-11-05");
  expect(frame.fields.find(field => field.name === "Choice")).toMatchObject({ type: DataFieldType.Select, typeConfig: { options: ["Ready"] } });
});

test("a Dataview source applies the same stored declarations before parsing", async () => {
  const project = { ...DEFAULT_PROJECT, id: "dv", name: "DV", fieldConfig: { Value: { type: "string" }, Choice: { type: "status" } },
    dataSource: { kind: "dataview", config: { query: "TABLE Value, Choice" } } };
  const api = { settings: { tableIdColumnName: "File" }, query: async () => ({ successful: true,
    value: { type: "table", headers: ["File", "Value", "Choice"], values: [[{ path: "A.md", display: "A" }, "2026-11-05", "Doing"]] } }) };
  const frame = await new DataviewDataSource(new InMemFileSystem({}), project as never, DEFAULT_SETTINGS.preferences, api as never).queryAll();
  expect(frame.records[0]?.values["Value"]).toBe("2026-11-05");
  expect(frame.fields.find(field => field.name === "Choice")?.type).toBe(DataFieldType.Status);
});

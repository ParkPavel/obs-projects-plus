import { get } from "svelte/store";
const { DataFieldType } = require("src/lib/dataframe/dataframe");
type DataField = import("src/lib/dataframe/dataframe").DataField;
type FieldType = import("src/lib/dataframe/dataframe").DataFieldType;
import { createDataRecord, DataApi } from "src/lib/dataApi";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { FolderDataSource } from "src/lib/datasources/folder/datasource";
import { ViewApi } from "src/lib/viewApi";
import { settings } from "src/lib/stores/settings";
import { dataFrame, dataSource } from "src/lib/stores/dataframe";
import { DEFAULT_PROJECT, DEFAULT_SETTINGS } from "src/settings/settings";
import { queryProjectRecords } from "src/lib/datasources/queryProjectRecords";
import { applyDeclaredFieldTypes, declaredPropertyType } from "../declaredFieldTypes";

jest.mock("yaml", () => jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js"));
const field = (type: FieldType): DataField => ({ name: "Ticket", type, repeated: false, identifier: false, derived: false });
let previousFrame = get(dataFrame);
beforeEach(() => { previousFrame = get(dataFrame); });
afterEach(() => dataFrame.set(previousFrame));

test.each([DataFieldType.AutoTime, DataFieldType.UniqueId])("a newly created %s field remains declared after the source refresh", type => {
  expect(declaredPropertyType(field(type))).toBe(type);
  const config = { Ticket: { type, autoTime: "created", uniqueIdPrefix: "T-" } };
  const result = applyDeclaredFieldTypes({ fields: [], records: [] }, config as never);
  expect(result.fields).toEqual([expect.objectContaining({ name: "Ticket", type,
    derived: type === DataFieldType.AutoTime, typeConfig: expect.objectContaining({ autoTime: "created", uniqueIdPrefix: "T-" }) })]);
  expect(applyDeclaredFieldTypes(result, config as never)).toBe(result);
});

test("creating and copying notes reserves distinct project IDs and writes them through the actual file writer", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "automatic-ids", uniqueIdCounter: 4,
    fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const first = createDataRecord("A", project as never, { other: false });
    const copy = createDataRecord("B", project as never, { ...first.values });
    expect(first.values["Ticket"]).toBe("T-5"); expect(copy.values["Ticket"]).toBe("T-6");
    expect(get(settings).projects[0]?.uniqueIdCounter).toBe(6); expect(project.uniqueIdCounter).toBe(4);
    const files = new InMemFileSystem({}), api = new DataApi(files);
    await Promise.all([first, copy].map(record => api.createNote(record, [field(DataFieldType.UniqueId)], "")));
    const yaml = jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js");
    const contents = await Promise.all([first, copy].map(record => files.getFile(record.id)!.read()));
    expect(contents.map(text => yaml.parse(text.split("---")[1])["Ticket"])).toEqual(["T-5", "T-6"]);
  } finally { settings.set(previous); }
});

test.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("a corrupt or exhausted counter %s cannot allocate a colliding ID", counter => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "counter-guard", uniqueIdCounter: counter,
    fieldConfig: { Ticket: { type: "unique_id" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    expect(() => createDataRecord("A", project as never)).toThrow(/counter/);
    expect(get(settings).projects[0]?.uniqueIdCounter).toBe(counter);
  } finally { settings.set(previous); }
});

test("a failed file write does not reuse a reserved ID on the next creation", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "counter-failure", uniqueIdCounter: 0,
    fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}), api = new DataApi(files);
    jest.spyOn(files, "create").mockRejectedValueOnce(new Error("write refused"));
    const first = createDataRecord("A", project as never);
    await expect(api.createNote(first, [field(DataFieldType.UniqueId)], "")).rejects.toThrow("write refused");
    const second = createDataRecord("B", project as never); expect(second.values["Ticket"]).toBe("T-2");
    await api.createNote(second, [field(DataFieldType.UniqueId)], ""); expect(get(settings).projects[0]?.uniqueIdCounter).toBe(2);
  } finally { settings.set(previous); }
});

test("ordinary creation tolerates unknown or null field configs without changing unrelated values", () => {
  const project = { ...DEFAULT_PROJECT, id: "ordinary-config", fieldConfig: { broken: null, future: { type: "future-version" } } };
  expect(createDataRecord("A", project as never, { value: [0, false, null, "0"] }).values).toEqual({ value: [0, false, null, "0"] });
});

test("a converted ID field reconciles existing project IDs before creating another note", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "existing-ids", dataSource: { kind: "folder", config: { path: "Notes", recursive: true } },
    fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: T-1\n---\nKeep me");
    await files.create("Other/foreign.md", "---\nTicket: T-500\n---\nOther project");
    const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences), api = new ViewApi(source, new DataApi(files));
    const record = createDataRecord("new", project as never); await api.addRecord(record, [field(DataFieldType.UniqueId)], "");
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe("T-2");
    expect(await files.getFile("Notes/old.md")!.read()).toBe("---\nTicket: T-1\n---\nKeep me");
  } finally { settings.set(previous); }
});

test("concurrent creations reconcile an old counter without duplicating IDs or mutating caller snapshots", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "parallel-ids", uniqueIdCounter: 1,
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: T-8\n---");
    const api = new ViewApi(new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences), new DataApi(files));
    const records = [createDataRecord("A", project as never), createDataRecord("B", project as never)];
    await Promise.all(records.map(record => api.addRecord(record, [field(DataFieldType.UniqueId)], "")));
    const ids = await Promise.all(records.map(async record => (await files.getFile(record.id)!.readValues())["Ticket"]));
    expect(new Set(ids)).toEqual(new Set(["T-9", "T-10"])); expect(get(settings).projects[0]?.uniqueIdCounter).toBe(10);
    expect(records.map(record => record.values["Ticket"])).toEqual(["T-2", "T-3"]);
    expect(new Set(get(dataFrame).records.filter(record => records.some(item => item.id === record.id)).map(record => record.values["Ticket"]))).toEqual(new Set(ids));
  } finally { settings.set(previous); }
});

test("an embedded creation checks fresh target records without using cached display frames", async () => {
  const previous = get(settings), target = { ...DEFAULT_PROJECT, id: "target-ids", dataSource: { kind: "folder", config: { path: "Notes", recursive: true } },
    fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [target as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: T-8\n---");
    const source = new FolderDataSource(files, target as never, DEFAULT_SETTINGS.preferences);
    const wrongQuery = jest.fn(), resolve = jest.fn(async () => source.queryAll());
    const api = new ViewApi({ project: { id: "parent" }, includes: () => false, queryAll: wrongQuery } as never, new DataApi(files), resolve);
    await api.addRecord(createDataRecord("new", target as never), [field(DataFieldType.UniqueId)], "");
    expect(resolve).not.toHaveBeenCalled(); expect(wrongQuery).not.toHaveBeenCalled();
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe("T-9");
  } finally { settings.set(previous); }
});

test.each([false, true])("automatic IDs include additional acquired sources (embedded=%s)", async embedded => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "additional-ids", uniqueIdCounter: 0,
    dataSource: { kind: "folder", config: { path: "Primary", recursive: true } },
    additionalSources: [
      { id: "extra", kind: "folder", config: { path: "Extra", recursive: true } },
      { id: "selection", kind: "derived", config: { from: "project", where: { conditions: [] } } },
    ], fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Extra/old.md", "---\nTicket: T-8\n---");
    await files.create("Other/foreign.md", "---\nTicket: T-500\n---");
    const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences);
    const cached = jest.fn(async () => ({ fields: [], records: [] }));
    const api = new ViewApi(embedded ? { project: { id: "parent" }, includes: () => false } as never : source, new DataApi(files), cached);
    await api.addRecord(createDataRecord("new", project as never), [field(DataFieldType.UniqueId)], "");
    expect((await files.getFile("Primary/new.md")!.readValues())["Ticket"]).toBe("T-9");
    expect(cached).not.toHaveBeenCalled();
  } finally { settings.set(previous); }
});

test("an automatic ID cannot overwrite the tag required for membership in a tag project", () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "tag-id-conflict", dataSource: { kind: "tag", config: { tag: "work" } },
    fieldConfig: { tags: { type: "unique_id" } } };
  settings.set({ ...previous, projects: [project as never] });
  try { expect(() => createDataRecord("new", project as never)).toThrow(/tags/); expect(get(settings).projects[0]?.uniqueIdCounter).toBeUndefined(); }
  finally { settings.set(previous); }
});

test("an unavailable additional source refuses automatic-ID creation before any file or optimistic row", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "unavailable-id-source",
    dataSource: { kind: "folder", config: { path: "Primary", recursive: true } },
    additionalSources: [{ id: "dv", kind: "dataview", config: { query: "FROM #work" } }],
    fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}), create = jest.spyOn(files, "create");
    const api = new ViewApi(new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences), new DataApi(files));
    const record = createDataRecord("new", project as never), before = get(dataFrame);
    await expect(api.addRecord(record, [field(DataFieldType.UniqueId)], "")).rejects.toThrow(/dataview-unavailable/);
    expect(create).not.toHaveBeenCalled(); expect(get(dataFrame)).toBe(before);
  } finally { settings.set(previous); }
});

test("the general command's direct DataApi creation reconciles existing automatic IDs too", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "command-ids", name: "Command",
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: T-8\n---");
    await new DataApi(files).createNote(createDataRecord("new", project as never), [], "");
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe("T-9");
  } finally { settings.set(previous); }
});

test.each(["2026-11-", "2026/11/", "T-", ""])("a restored ID counter preserves raw source IDs with prefix %s", async prefix => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "raw-ids", name: "Raw", uniqueIdCounter: 9,
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: prefix } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", `---\nTicket: "${prefix}10"\n---`);
    const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences);
    expect((await source.queryAll()).records[0]?.values["Ticket"]).toBe(`${prefix}10`);
    await new DataApi(files).createNote(createDataRecord("new", project as never), [], "");
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe(`${prefix}11`);
  } finally { settings.set(previous); }
});

test("a Dataview alias cannot hide an existing stored ID from reconciliation", async () => {
  const { app } = require("src/lib/stores/obsidian"), previousApp = get(app);
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "aliased-ids", name: "Aliased", uniqueIdCounter: 9, newNotesFolder: "Notes",
    dataSource: { kind: "dataview", config: { query: "TABLE Ticket AS Alias" } }, fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: T-10\n---");
    const api = { settings: { tableIdColumnName: "File" }, query: async () => ({ successful: true,
      value: { type: "table", headers: ["File", "Alias"], values: [[{ path: "Notes/old.md", display: "old" }, "T-10"]] } }) };
    const records = await queryProjectRecords(project as never, { fileSystem: files, preferences: DEFAULT_SETTINGS.preferences, dataviewApi: api as never });
    expect(records[0]?.values["Ticket"]).toBe("T-10");
    app.set({ plugins: { enabledPlugins: new Set(["dataview"]), plugins: { dataview: { api } } } });
    await new DataApi(files).createNote(createDataRecord("new", project as never), [], "");
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe("T-11");
  } finally { settings.set(previous); app.set(previousApp); }
});

test("a broken note in an acquired source cannot be mistaken for an empty ID set", async () => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "unreadable-ids", name: "Unreadable",
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { Ticket: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/broken.md", "---\nTicket: [broken\n---");
    const create = jest.spyOn(files, "create");
    await expect(new DataApi(files).createNote(createDataRecord("new", project as never), [], "")).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  } finally { settings.set(previous); }
});

test.each(["Template body", "---\ntags: [work]\n---\nTemplate body"])("a folder's automatic tags ID stays a scalar when applying template %s", async template => {
  const previous = get(settings), project = { ...DEFAULT_PROJECT, id: "template-tag-id", name: "Template tag ID",
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { tags: { type: "unique_id", uniqueIdPrefix: "T-" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Templates/base.md", template);
    await new DataApi(files).createNote(createDataRecord("new", project as never), [], "Templates/base.md");
    expect((await files.getFile("Notes/new.md")!.readValues())["tags"]).toBe("T-1");
    expect(await files.getFile("Notes/new.md")!.read()).toContain("Template body");
  } finally { settings.set(previous); }
});

test("a source read completing after project switch cannot add its row to the new frame", async () => {
  const previous = get(settings), previousSource = get(dataSource), project = { ...DEFAULT_PROJECT, id: "slow-create", name: "Slow",
    dataSource: { kind: "folder", config: { path: "Notes", recursive: true } }, fieldConfig: { Ticket: { type: "unique_id" } } };
  settings.set({ ...previous, projects: [project as never] });
  try {
    const files = new InMemFileSystem({}); await files.create("Notes/old.md", "---\nTicket: '8'\n---");
    const old = files.getFile("Notes/old.md")!, originalRead = old.read.bind(old);
    let release!: () => void, started!: () => void;
    const began = new Promise<void>(done => { started = done; }), gate = new Promise<void>(done => { release = done; });
    jest.spyOn(old, "read").mockImplementationOnce(async () => { started(); await gate; return originalRead(); });
    const source = new FolderDataSource(files, project as never, DEFAULT_SETTINGS.preferences); dataSource.set(source);
    const pending = new ViewApi(source, new DataApi(files)).addRecord(createDataRecord("new", project as never), [field(DataFieldType.UniqueId)], "");
    await began;
    dataSource.set({ project: { id: "other" } } as never);
    const otherFrame = { fields: [], records: [{ id: "Other/B.md", values: { keep: true } }] }; dataFrame.set(otherFrame);
    release(); await pending;
    expect(get(dataFrame)).toBe(otherFrame);
    expect((await files.getFile("Notes/new.md")!.readValues())["Ticket"]).toBe("9");
  } finally { settings.set(previous); dataSource.set(previousSource); }
});

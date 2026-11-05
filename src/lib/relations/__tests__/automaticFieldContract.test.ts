import { get } from "svelte/store";
const { DataFieldType } = require("src/lib/dataframe/dataframe");
type DataField = import("src/lib/dataframe/dataframe").DataField;
type FieldType = import("src/lib/dataframe/dataframe").DataFieldType;
import { createDataRecord, DataApi } from "src/lib/dataApi";
import { InMemFileSystem } from "src/lib/filesystem/inmem/filesystem";
import { settings } from "src/lib/stores/settings";
import { DEFAULT_PROJECT } from "src/settings/settings";
import { applyDeclaredFieldTypes, declaredPropertyType } from "../declaredFieldTypes";

jest.mock("yaml", () => jest.requireActual(process.cwd() + "/node_modules/yaml/dist/index.js"));
const field = (type: FieldType): DataField => ({ name: "Ticket", type, repeated: false, identifier: false, derived: false });

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

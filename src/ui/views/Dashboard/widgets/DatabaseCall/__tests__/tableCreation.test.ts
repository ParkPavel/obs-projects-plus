import { get } from "svelte/store";
import { app } from "src/lib/stores/obsidian";
import { DEFAULT_PROJECT } from "src/settings/settings";
import { bindTableCreation } from "../tableCreation";
import { DataFieldType } from "src/lib/dataframe/dataframe";

it("captures its writer, destination, schema and scope values without following later mutations", async () => {
  const previous = get(app); app.set({ vault: { getAbstractFileByPath: () => null } } as never);
  const addRecord = jest.fn().mockResolvedValue(undefined);
  const project = { ...DEFAULT_PROJECT, id: "own", name: "Own", dataSource: { kind: "folder" as const, config: { path: "Own", recursive: true } } };
  const fields = [{ name: "type", type: DataFieldType.String, derived: false, identifier: false, repeated: false }];
  const conditions = [{ field: "type", value: "visit", operator: "is" as const, enabled: true }];
  const save = bindTableCreation(project, fields, { addRecord } as never, conditions);
  project.dataSource.config.path = "Other"; fields[0]!.type = DataFieldType.Number; conditions[0]!.value = "other";
  try {
    await save("Visit");
    expect(addRecord).toHaveBeenCalledTimes(1); expect(addRecord.mock.calls[0]![0]).toMatchObject({ id: "Own/Visit.md", values: { type: "visit" } });
    expect(addRecord.mock.calls[0]![1][0].type).toBe(DataFieldType.String);
  } finally { app.set(previous); }
});

it("uses the common name validation before attempting a file create", async () => {
  const previous = get(app); app.set({ vault: { getAbstractFileByPath: () => null } } as never);
  const addRecord = jest.fn();
  const save = bindTableCreation({ ...DEFAULT_PROJECT, id: "own", name: "Own" }, [], { addRecord } as never, []);
  try { await expect(save(".hidden")).rejects.toThrow(); expect(addRecord).not.toHaveBeenCalled(); }
  finally { app.set(previous); }
});

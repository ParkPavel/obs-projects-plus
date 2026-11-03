import { get } from "svelte/store";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { ViewApi } from "src/lib/viewApi";
import { createTableEditing } from "../tableEditing";

const fields: DataField[] = [{ name: "f", type: DataFieldType.String, derived: false, identifier: false, repeated: false }];
const record = { id: "A.md", values: { f: "old" } };
const cell = { recordId: record.id, field: "f" };
const edit = { record, field: "f", value: "draft" };

it("rejects a late text commit after cancellation instead of treating it as a fresh edit", async () => {
  const updateRecord = jest.fn().mockResolvedValue(true);
  const editing = createTableEditing(() => ({ updateRecord }) as unknown as ViewApi, () => fields);
  editing.start(cell, []); editing.cancel(); await editing.commit(edit);
  expect(updateRecord).not.toHaveBeenCalled();
});

it("keeps a draft across an equivalent API wrapper and records refresh, using its original writer", async () => {
  const dataSource = {}, dataApi = {}, updateA = jest.fn().mockResolvedValue(true), updateB = jest.fn();
  let api = { dataSource, dataApi, updateRecord: updateA } as unknown as ViewApi;
  const editing = createTableEditing(() => api, () => fields, () => "source");
  editing.start(cell, []);
  api = { dataSource, dataApi, updateRecord: updateB } as unknown as ViewApi;
  editing.refresh(api, fields.map(field => ({ ...field })), "source", false);
  expect(get(editing).cell).toBe(cell);
  await editing.commit(edit);
  expect(updateA).toHaveBeenCalledTimes(1); expect(updateB).not.toHaveBeenCalled();
});

it("a completion from an earlier scope does not reopen its draft or write to the new source", async () => {
  let resolve!: (value: boolean) => void;
  const first = jest.fn(() => new Promise<boolean>(done => { resolve = done; })), second = jest.fn();
  let api = { updateRecord: first } as unknown as ViewApi, scope = "first";
  const editing = createTableEditing(() => api, () => fields, () => scope);
  editing.start(cell, []); const pending = editing.commit(edit);
  scope = "second"; api = { updateRecord: second } as unknown as ViewApi;
  editing.refresh(api, fields, scope, false);
  expect(get(editing).cell).toBeNull(); expect(get(editing).saving).toBe(true);
  resolve(false); await pending;
  expect(get(editing)).toMatchObject({ cell: null, saving: false, retry: 0 });
  expect(second).not.toHaveBeenCalled();
});

it("a checkbox still writes once without a text draft session", async () => {
  const updateRecord = jest.fn().mockResolvedValue(true);
  const api = { updateRecord } as unknown as ViewApi;
  const editing = createTableEditing(() => api, () => [{ ...fields[0]!, type: DataFieldType.Boolean }]);
  await editing.commit({ record: { id: "A.md", values: { f: false } }, field: "f", value: true });
  expect(updateRecord).toHaveBeenCalledTimes(1);
});

it.each(["scope", "schema"])("rechecks %s synchronously when commit arrives before reactive refresh", async change => {
  const updateRecord = jest.fn().mockResolvedValue(true), api = { updateRecord } as unknown as ViewApi;
  let scope = "old", schema = fields;
  const editing = createTableEditing(() => api, () => schema, () => scope);
  editing.start(cell, []);
  if (change === "scope") scope = "new";
  else schema = [{ ...fields[0]!, type: DataFieldType.Number }];
  await editing.commit(edit);
  expect(updateRecord).not.toHaveBeenCalled(); expect(get(editing).cell).toBeNull();
});

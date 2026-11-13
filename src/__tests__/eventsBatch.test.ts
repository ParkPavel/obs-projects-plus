import { get } from "svelte/store";
import { registerFileEvents } from "../events";
import { dataFrame, dataSource } from "src/lib/stores/dataframe";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import type { IFile, IFileSystemWatcher } from "src/lib/filesystem/filesystem";

function watch() {
  let changed!: (file: IFile) => Promise<void>;
  registerFileEvents({ onCreate() {}, onDelete() {}, onRename() {}, onChange(callback) { changed = callback; } } as IFileSystemWatcher);
  return (path: string) => changed({ path } as IFile);
}
const part = (id: string, value: boolean | string): DataFrame => ({
  fields: [{ name: "mixed", type: typeof value === "boolean" ? DataFieldType.Boolean : DataFieldType.String, repeated: false, derived: false, identifier: false }],
  records: [{ id, values: { mixed: value } }],
});
beforeEach(() => { jest.useFakeTimers(); dataFrame.set({ fields: [], records: [] }); });
afterEach(() => { dataSource.set(undefined); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each([false, true])("a batched mixed-type field has the same String schema in either event order: %s", reversed => {
  const a = part("A.md", true), b = part("B.md", "hello");
  const queryOne = jest.fn(async (file: IFile) => file.path === "A.md" ? a : b);
  dataSource.set({ includes: () => true, queryOne } as never);
  const change = watch();
  return (async () => {
    for (const path of reversed ? ["B.md", "A.md"] : ["A.md", "B.md"]) await change(path);
    await jest.advanceTimersByTimeAsync(60);
    expect(get(dataFrame).fields[0]?.type).toBe(DataFieldType.String);
    expect(get(dataFrame).records).toHaveLength(2);
  })();
});

test("a failed read cannot discard the other note's successful change", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  dataFrame.set({ fields: [], records: [{ id: "B.md", values: { mixed: "old" } }] });
  dataSource.set({ includes: () => true, queryOne: async (file: IFile) => {
    if (file.path === "A.md") throw Error("deleted before read");
    return part("B.md", "updated");
  } } as never);
  const change = watch(); await change("A.md"); await change("B.md");
  await jest.advanceTimersByTimeAsync(60);
  expect(get(dataFrame).records).toEqual([{ id: "B.md", values: { mixed: "updated" } }]);
  expect(error).toHaveBeenCalledTimes(1);
});

test("a failed whole-source refresh is reported and the next batch can run", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  const refresh = jest.fn().mockRejectedValueOnce(Error("unavailable")).mockResolvedValue(part("B.md", "updated"));
  dataSource.set({ includes: () => true, refresh } as never);
  const change = watch(); await change("B.md"); await jest.advanceTimersByTimeAsync(60);
  expect(error).toHaveBeenCalledTimes(1);
  await change("B.md"); await jest.advanceTimersByTimeAsync(60);
  expect(get(dataFrame).records[0]?.values["mixed"]).toBe("updated");
});

test.each([false, true])("an outstanding batch cannot merge into a replacement source (refresh=%s)", refresh => {
  return (async () => {
    let resolve!: (frame: DataFrame) => void;
    const pending = new Promise<DataFrame>(done => { resolve = done; });
    const source = { includes: () => true, ...(refresh ? { refresh: () => pending } : { queryOne: () => pending }) };
    dataSource.set(source as never);
    const change = watch(); await change("old.md"); await jest.advanceTimersByTimeAsync(60);
    dataSource.set({ includes: () => true } as never);
    dataFrame.set(part("new.md", "new source"));
    resolve(part("old.md", true)); await jest.advanceTimersByTimeAsync(1);
    expect(get(dataFrame).records.map(record => record.id)).toEqual(["new.md"]);
  })();
});

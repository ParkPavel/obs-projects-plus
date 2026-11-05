/**
 * stab-dup (Codex audit) — ViewApi.addRecord hands back the note creation, so
 * a caller that awaits it (the calendar duplicate) sees a failed create
 * instead of reporting a copy that does not exist.
 *
 * w4-p02 (audit F19) — with a data source that includes the new note, the row
 * is shown before the file is written. A refused create left that row in the
 * frame: a phantom record that exists nowhere on disk. It is taken back now,
 * and only that row.
 */
import { get } from "svelte/store";
import { ViewApi } from "src/lib/viewApi";
import type { DataApi } from "src/lib/dataApi";
import type { DataSource } from "src/lib/datasources";
import { dataFrame } from "src/lib/stores/dataframe";

const ids = () => get(dataFrame).records.map((r) => r.id);

describe("ViewApi.addRecord", () => {
  it("a failed old creation cannot remove the same path from a newly loaded project's frame", async () => {
    const { dataSource } = require("src/lib/stores/dataframe");
    const previous = get(dataSource), source = { includes: () => true } as unknown as DataSource;
    dataSource.set(source);
    try {
      let fail!: (error: Error) => void;
      const dataApi = { createNote: jest.fn(() => new Promise<void>((_resolve, reject) => { fail = reject; })) } as unknown as DataApi;
      const pending = new ViewApi(source, dataApi).addRecord({ id: "x.md", values: {} }, [], "");
      dataSource.set({ includes: () => true });
      const otherFrame = { fields: [], records: [{ id: "x.md", values: { keep: true } }] }; dataFrame.set(otherFrame);
      fail(new Error("refused")); await expect(pending).rejects.toThrow("refused");
      expect(get(dataFrame)).toBe(otherFrame);
    } finally { dataSource.set(previous); }
  });
  beforeEach(() => dataFrame.set({ fields: [], records: [] }));

  it("rejects when the note cannot be created", async () => {
    const dataApi = { createNote: jest.fn().mockRejectedValue(new Error("vault refused")) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => false } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).rejects.toThrow("vault refused");
  });

  it("resolves once the note is created", async () => {
    const dataApi = { createNote: jest.fn().mockResolvedValue(undefined) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => false } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).resolves.toBeUndefined();
  });

  it("shows the new row while the note is written and keeps it after", async () => {
    let finish: () => void = () => undefined;
    const dataApi = { createNote: jest.fn(() => new Promise<void>((resolve) => (finish = resolve))) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => true } as unknown as DataSource, dataApi);
    const pending = api.addRecord({ id: "x.md", values: {} }, [], "");
    expect(ids()).toEqual(["x.md"]);
    finish();
    await pending;
    expect(ids()).toEqual(["x.md"]);
  });

  it("takes the shown row back when the create is refused (old code: a phantom row)", async () => {
    const dataApi = { createNote: jest.fn().mockRejectedValue(new Error("vault refused")) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => true } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).rejects.toThrow("vault refused");
    expect(ids()).toEqual([]);
  });

  it("leaves the other rows, and a row that was there before, as they were", async () => {
    dataFrame.set({ fields: [], records: [{ id: "a.md", values: {} }, { id: "x.md", values: { kept: true } }] });
    const dataApi = { createNote: jest.fn().mockRejectedValue(new Error("exists")) } as unknown as DataApi;
    const api = new ViewApi({ includes: () => true } as unknown as DataSource, dataApi);
    await expect(api.addRecord({ id: "x.md", values: {} }, [], "")).rejects.toThrow("exists");
    expect(get(dataFrame).records).toEqual([{ id: "a.md", values: {} }, { id: "x.md", values: { kept: true } }]);
  });
});

/**
 * ViewApi hands the data layer only the keys that differ from the stored copy
 * of the record, so editing one field leaves every other key on disk alone.
 */
import { get } from "svelte/store";

import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { DataApi } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";
import { dataFrame } from "src/lib/stores/dataframe";
import type { DataSource } from "src/lib/datasources";
import { ViewApi } from "src/lib/viewApi";
import { updateRecordValues } from "src/lib/datasources/helpers";

const field = (name: string, type: DataFieldType): DataField => ({
  name,
  type,
  repeated: false,
  derived: false,
  identifier: false,
  typeConfig: {},
});

const fields: DataField[] = [
  field("source", DataFieldType.String),
  field("since", DataFieldType.Date),
  field("price", DataFieldType.Number),
];

const source = { includes: () => true } as unknown as DataSource;

const since = new Date(2026, 9, 4);

const rec = (id: string, values: DataRecord["values"]): DataRecord => ({ id, values });

class FakeFile extends IFile {
  readonly fm: Record<string, unknown> = {
    source: "old",
    since: "10.04.2026",
    price: 5,
  };
  constructor(private readonly _path: string) {
    super();
  }
  override get basename(): string { return this._path; }
  override get path(): string { return this._path; }
  override async read(): Promise<string> { return ""; }
  override async write(): Promise<void> {}
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async processFrontMatter(fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    fn(this.fm);
    return true;
  }
}

function setup(ids: string[]) {
  const files: Record<string, FakeFile> = {};
  for (const id of ids) files[id] = new FakeFile(id);
  const dataApi = new DataApi({
    getFile: (path: string) => files[path] ?? null,
  } as unknown as IFileSystem);
  const api = new ViewApi(source, dataApi);
  return { files, api, dataApi };
}

beforeEach(() => {
  dataFrame.set({
    fields,
    records: [
      rec("a.md", { source: "old", since, price: 5 }),
      rec("b.md", { source: "old", since, price: 5 }),
    ],
  });
});

describe("ViewApi.updateRecord writes only the changed key", () => {
  it("leaves an untouched date as the note had it", async () => {
    const { files, api } = setup(["a.md"]);
    const ok = await api.updateRecord(rec("a.md", { source: "new", since, price: 5 }), fields);
    expect(ok).toBe(true);
    expect(files["a.md"]?.fm).toEqual({ source: "new", since: "10.04.2026", price: 5 });
  });

  it("passes the key list down", async () => {
    const { api, dataApi } = setup(["a.md"]);
    const spy = jest.spyOn(dataApi, "updateRecord");
    await api.updateRecord(rec("a.md", { source: "new", since, price: 5 }), fields);
    expect(spy.mock.calls[0]?.[2]).toEqual(["source"]);
  });

  it("a write of the same value touches nothing and succeeds", async () => {
    const { files, api } = setup(["a.md"]);
    const ok = await api.updateRecord(rec("a.md", { source: "old", since, price: 5 }), fields);
    expect(ok).toBe(true);
    expect(files["a.md"]?.fm).toEqual({ source: "old", since: "10.04.2026", price: 5 });
  });

  it("writes the whole record when the previous one is unknown", async () => {
    const { files, api } = setup(["c.md"]);
    await api.updateRecord(rec("c.md", { source: "new", since, price: 5 }), fields);
    expect(files["c.md"]?.fm).toEqual({ source: "new", since: "2026-10-04", price: 5 });
  });

  it("still reverts the store when the write fails", async () => {
    const { api, dataApi } = setup(["a.md"]);
    jest.spyOn(dataApi, "updateRecord").mockRejectedValue(new Error("EACCES"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await api.updateRecord(rec("a.md", { source: "new", since, price: 5 }), fields);
    expect(get(dataFrame).records[0]?.values["source"]).toBe("old");
  });
});

describe("ViewApi.updateRecords writes per record", () => {
  it("narrows each record by its own difference", async () => {
    const { files, api } = setup(["a.md", "b.md"]);
    const ok = await api.updateRecords(
      [
        rec("a.md", { source: "new", since, price: 5 }),
        rec("b.md", { source: "old", since, price: 9 }),
      ],
      fields
    );
    expect(ok).toBe(true);
    expect(files["a.md"]?.fm).toEqual({ source: "new", since: "10.04.2026", price: 5 });
    expect(files["b.md"]?.fm).toEqual({ source: "old", since: "10.04.2026", price: 9 });
  });

  it("writes whole only the record with no previous copy", async () => {
    const { files, api, dataApi } = setup(["a.md", "c.md"]);
    const spy = jest.spyOn(dataApi, "updateRecords");
    await api.updateRecords(
      [
        rec("a.md", { source: "new", since, price: 5 }),
        rec("c.md", { source: "new", since, price: 5 }),
      ],
      fields
    );
    expect(spy.mock.calls[0]?.[2]).toEqual([["source"], undefined]);
    expect(files["c.md"]?.fm["since"]).toBe("2026-10-04");
  });

  it("takes the previous copy from before the optimistic update", async () => {
    const { api, dataApi } = setup(["a.md"]);
    const spy = jest.spyOn(dataApi, "updateRecords");
    await api.updateRecords([rec("a.md", { source: "new", since, price: 5 })], fields);
    expect(spy.mock.calls[0]?.[2]).toEqual([["source"]]);
  });
});

describe("two edits built from the same earlier copy", () => {
  it("the second does not put back the field the first one wrote", async () => {
    const { files, api } = setup(["a.md"]);
    const original = get(dataFrame).records.find((r) => r.id === "a.md")!;
    // Two editors opened on the same copy: one changes source, the other price.
    await api.updateRecord(updateRecordValues(original, { source: "new" }), fields);
    await api.updateRecord(updateRecordValues(original, { price: 9 }), fields);
    expect(files["a.md"]!.fm).toEqual({ source: "new", since: "10.04.2026", price: 9 });
    const stored = get(dataFrame).records.find((r) => r.id === "a.md")!;
    expect(stored.values["source"]).toBe("new");
    expect(stored.values["price"]).toBe(9);
  });

  it("the batch path keeps the other edit too", async () => {
    const { files, api } = setup(["a.md", "b.md"]);
    const [a, b] = get(dataFrame).records;
    await api.updateRecord(updateRecordValues(a!, { source: "new" }), fields);
    await api.updateRecords([updateRecordValues(a!, { price: 9 }), updateRecordValues(b!, { price: 7 })], fields);
    expect(files["a.md"]!.fm).toEqual({ source: "new", since: "10.04.2026", price: 9 });
    expect(files["b.md"]!.fm).toEqual({ source: "old", since: "10.04.2026", price: 7 });
    expect(get(dataFrame).records.find((r) => r.id === "a.md")!.values["source"]).toBe("new");
  });
});

describe("touched keys", () => {
  it("a record built twice keeps both changes (a board move: column, then order)", async () => {
    const { files, api } = setup(["a.md"]);
    const original = get(dataFrame).records.find((r) => r.id === "a.md")!;
    const moved = updateRecordValues(updateRecordValues(original, { source: "new" }), { price: 9 });
    await api.updateRecords([moved], fields);
    expect(files["a.md"]!.fm).toEqual({ source: "new", since: "10.04.2026", price: 9 });
  });

  it("a record the frame does not hold is written whole even when built with updateRecordValues", async () => {
    const { files, api } = setup(["c.md"]);
    await api.updateRecord(updateRecordValues(rec("c.md", { source: "x", since, price: 1 }), { price: 9 }), fields);
    expect(files["c.md"]!.fm["source"]).toBe("x");
    expect(files["c.md"]!.fm["price"]).toBe(9);
  });
});

/**
 * Editing one field must not rewrite the others. With a key list, both write
 * paths (processFrontMatter and the legacy read-modify-write) touch only those
 * keys; an untouched date keeps the exact text the note had, however the
 * in-memory record happens to hold it.
 */
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { DataApi, applyRecordToFrontmatter, doUpdateRecord } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";
import { either as E } from "fp-ts";

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
  field("at", DataFieldType.Date),
];

// The note as a sync plugin left it: a DD.MM.YYYY date and an ISO date-time.
const NOTE = "---\nsource: old\nsince: 10.04.2026\nat: 2026-10-04T10:30\n---\nBody\n";

// What the table holds after a month-first read of `since` and a parse of `at`.
const record = (source: string): DataRecord => ({
  id: "notes/a.md",
  values: {
    source,
    since: new Date(2026, 9, 4),
    at: new Date(2026, 9, 4, 10, 30),
  },
});

class FakeFile extends IFile {
  content = NOTE;
  constructor(readonly fm: Record<string, unknown> | null) {
    super();
  }
  override get basename(): string { return "a"; }
  override get path(): string { return "notes/a.md"; }
  override async read(): Promise<string> { return this.content; }
  override async write(content: string): Promise<void> { this.content = content; }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async processFrontMatter(fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    if (!this.fm) return false;
    fn(this.fm);
    return true;
  }
}

const apiFor = (file: IFile) =>
  new DataApi({ getFile: () => file } as unknown as IFileSystem);

const seed = (): Record<string, unknown> => ({
  source: "old",
  since: "10.04.2026",
  at: "2026-10-04T10:30",
});

describe("applyRecordToFrontmatter with keys", () => {
  it("writes only the listed keys", () => {
    const fm = seed();
    applyRecordToFrontmatter(fm, fields, record("new"), ["source"]);
    expect(fm).toEqual({ source: "new", since: "10.04.2026", at: "2026-10-04T10:30" });
  });

  it("without keys still writes every value (whole-record behaviour)", () => {
    const fm = seed();
    applyRecordToFrontmatter(fm, fields, record("new"));
    expect(fm["since"]).toBe("2026-10-04");
  });

  it("formats a listed date the way it always did", () => {
    const fm = seed();
    applyRecordToFrontmatter(fm, fields, record("old"), ["since"]);
    expect(fm["since"]).toBe("2026-10-04");
    expect(fm["source"]).toBe("old");
  });

  it("writes nothing for a listed key that is gone from values", () => {
    const fm = seed();
    applyRecordToFrontmatter(fm, fields, { id: "x", values: {} }, ["source"]);
    expect(fm).toEqual(seed());
  });
});

describe("doUpdateRecord with keys (legacy path)", () => {
  it("keeps untouched dates as the note had them", () => {
    const result = doUpdateRecord(NOTE, fields, record("new"), ["source"]);
    const written = E.getOrElse<Error, string>(() => "")(result);
    expect(written).toContain("source: new");
    expect(written).toContain("since: 10.04.2026");
    expect(written).toContain("at: 2026-10-04T10:30");
    expect(written).toContain("Body");
  });

  it("without keys reformats every date, as before", () => {
    const written = E.getOrElse<Error, string>(() => "")(doUpdateRecord(NOTE, fields, record("new")));
    expect(written).toContain("since: 2026-10-04");
  });
});

describe("DataApi.updateRecord with keys", () => {
  it("processFrontMatter path: untouched keys keep their exact original values", async () => {
    const file = new FakeFile(seed());
    await apiFor(file).updateRecord(fields, record("new"), ["source"]);
    expect(file.fm).toEqual({ source: "new", since: "10.04.2026", at: "2026-10-04T10:30" });
  });

  it("legacy path: untouched keys keep their exact original text", async () => {
    const file = new FakeFile(null);
    await apiFor(file).updateRecord(fields, record("new"), ["source"]);
    expect(file.content).toContain("source: new");
    expect(file.content).toContain("since: 10.04.2026");
    expect(file.content).toContain("at: 2026-10-04T10:30");
  });

  it("an empty key list writes nothing and succeeds", async () => {
    const file = new FakeFile(seed());
    const spy = jest.spyOn(file, "processFrontMatter");
    expect(await apiFor(file).updateRecord(fields, record("old"), [])).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(file.content).toBe(NOTE);
  });

  it("an empty key list still reports a missing note", async () => {
    const api = new DataApi({ getFile: () => null } as unknown as IFileSystem);
    expect(await api.updateRecord(fields, record("old"), [])).toBe(false);
  });
});

describe("DataApi.updateRecords with per-record keys", () => {
  it("narrows each record by its own list", async () => {
    const one = new FakeFile(seed());
    const two = new FakeFile(seed());
    const three = new FakeFile(seed());
    const files: Record<string, FakeFile> = { "one.md": one, "two.md": two, "three.md": three };
    const api = new DataApi({
      getFile: (path: string) => files[path] ?? null,
    } as unknown as IFileSystem);
    const at = (id: string, source: string): DataRecord => ({ ...record(source), id });

    await api.updateRecords(
      fields,
      [at("one.md", "a"), at("two.md", "b"), at("three.md", "c")],
      [["source"], [], undefined]
    );

    expect(one.fm).toEqual({ source: "a", since: "10.04.2026", at: "2026-10-04T10:30" });
    expect(two.fm).toEqual(seed());
    // No list: the whole record, as before.
    expect(three.fm?.["since"]).toBe("2026-10-04");
  });
});

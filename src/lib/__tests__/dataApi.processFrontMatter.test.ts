/**
 * Phase 3 / F6 — DataApi prefers `IFile.processFrontMatter` over the
 * legacy read-modify-write path when available.
 *
 * These tests stub `IFileSystem` / `IFile` to verify:
 *   1. `DataApi.updateRecord` calls `processFrontMatter` when the file
 *      implementation supports it, and skips the full-file write path.
 *   2. The callback mutates the frontmatter object in place with the
 *      given record values, honouring derived-field exclusion and date
 *      formatting rules (same rules as `doUpdateRecord`).
 *   3. When `processFrontMatter` returns `false` (unsupported), DataApi
 *      falls back to the legacy `read()` / `write()` pipeline.
 */
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { DataApi, applyRecordToFrontmatter } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";

const fields: DataField[] = [
  { name: "title", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
  { name: "due", type: DataFieldType.Date, repeated: false, derived: false, identifier: false, typeConfig: { time: false } },
  { name: "computed", type: DataFieldType.Number, repeated: false, derived: true, identifier: false },
];

function makeRecord(): DataRecord {
  return {
    id: "notes/a.md",
    values: {
      title: "Hello",
      due: new Date(2026, 4, 1, 0, 0, 0, 0), // local midnight
      computed: 42, // derived → must NOT leak to frontmatter
    },
  };
}

class FakeFile extends IFile {
  writeSpy = jest.fn<Promise<void>, [string]>(async () => {});
  readSpy = jest.fn<Promise<string>, []>(async () => "---\nexisting: keep\n---\nBody");
  pfmSpy: jest.Mock<Promise<boolean>, [(fm: Record<string, unknown>) => void]>;

  constructor(pfmSupported: boolean, public fmSeed: Record<string, unknown> = { existing: "keep" }) {
    super();
    this.pfmSpy = jest.fn(async (fn) => {
      if (!pfmSupported) return false;
      fn(this.fmSeed);
      return true;
    });
  }

  override get basename(): string { return "a"; }
  override get path(): string { return "notes/a.md"; }
  override async read(): Promise<string> { return this.readSpy(); }
  override async write(content: string): Promise<void> { return this.writeSpy(content); }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async processFrontMatter(fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    return this.pfmSpy(fn);
  }
}

function makeFs(file: IFile): IFileSystem {
  return {
    create: jest.fn(),
    getFile: jest.fn(() => file),
    getAllFiles: jest.fn(() => []),
  } as unknown as IFileSystem;
}

describe("applyRecordToFrontmatter", () => {
  test("assigns primitive values verbatim", () => {
    const fm: Record<string, unknown> = { existing: "keep" };
    applyRecordToFrontmatter(fm, fields, { id: "x", values: { title: "Hi" } });
    expect(fm).toEqual({ existing: "keep", title: "Hi" });
  });

  test("formats date-only values with the date format", () => {
    const fm: Record<string, unknown> = {};
    // Use local midnight to avoid timezone bleed; isDatetime triggers on
    // any non-zero H/M/S/ms component even without typeConfig.time.
    const d = new Date(2026, 4, 1, 0, 0, 0, 0);
    applyRecordToFrontmatter(fm, fields, { id: "x", values: { due: d } });
    expect(fm["due"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("skips derived fields", () => {
    const fm: Record<string, unknown> = {};
    applyRecordToFrontmatter(fm, fields, { id: "x", values: { computed: 999 } });
    expect("computed" in fm).toBe(false);
  });
});

describe("DataApi.updateRecord — Phase 3 / F6", () => {
  test("prefers processFrontMatter when supported and skips full-file write", async () => {
    const file = new FakeFile(true);
    const api = new DataApi(makeFs(file));
    await api.updateRecord(fields, makeRecord());
    expect(file.pfmSpy).toHaveBeenCalledTimes(1);
    expect(file.writeSpy).not.toHaveBeenCalled();
    expect(file.readSpy).not.toHaveBeenCalled();
    // Seed frontmatter must have been mutated in place by the callback.
    expect(file.fmSeed["title"]).toBe("Hello");
    expect("computed" in file.fmSeed).toBe(false);
  });

  test("falls back to read-modify-write when processFrontMatter returns false", async () => {
    const file = new FakeFile(false);
    const api = new DataApi(makeFs(file));
    await api.updateRecord(fields, makeRecord());
    expect(file.pfmSpy).toHaveBeenCalledTimes(1);
    expect(file.readSpy).toHaveBeenCalledTimes(1);
    expect(file.writeSpy).toHaveBeenCalledTimes(1);
    const written = file.writeSpy.mock.calls[0]?.[0] ?? "";
    expect(written).toContain("title: Hello");
    expect(written).not.toContain("computed:");
  });
});

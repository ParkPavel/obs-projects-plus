/**
 * PARITY-008 — Auto-fields (created_time / last_edited_time)
 *
 * Verifies that the frontmatter datasource pipeline injects virtual
 * `pp_created_time` and `pp_last_edited_time` Date values when the
 * underlying IFile exposes ctime/mtime, and that `detectSchema` marks
 * them as `derived: true` (read-only) and types them as Date.
 */

import {
  detectSchema,
  standardizeRecords,
} from "src/lib/datasources/frontmatter/datasource";
import { IFile } from "src/lib/filesystem/filesystem";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { either as E } from "fp-ts";

class StubFile extends IFile {
  constructor(
    private readonly _path: string,
    private readonly _content: string,
    private readonly _ctime: number,
    private readonly _mtime: number,
  ) {
    super();
  }
  get basename(): string {
    return this._path.split("/").at(-1)?.replace(/\.md$/, "") ?? this._path;
  }
  get path(): string {
    return this._path;
  }
  override get ctime(): number {
    return this._ctime;
  }
  override get mtime(): number {
    return this._mtime;
  }
  read(): Promise<string> {
    return Promise.resolve(this._content);
  }
  write(): Promise<void> {
    return Promise.resolve();
  }
  delete(): Promise<void> {
    return Promise.resolve();
  }
  readTags(): Set<string> {
    return new Set();
  }
}

describe("PARITY-008 — auto-fields", () => {
  const ctime = new Date("2024-01-15T10:00:00Z").getTime();
  const mtime = new Date("2024-06-20T15:30:00Z").getTime();
  const file = new StubFile(
    "Notes/example.md",
    "---\ntitle: Example\n---\nbody",
    ctime,
    mtime,
  );

  it("injects pp_created_time and pp_last_edited_time as Date", async () => {
    const records = await standardizeRecords([file]);
    expect(records).toHaveLength(1);
    const r = records[0]!;
    expect(E.isRight(r)).toBe(true);
    if (!E.isRight(r)) return;
    const v = r.right.values;
    expect(v["pp_created_time"]).toBeInstanceOf(Date);
    expect((v["pp_created_time"] as Date).getTime()).toBe(ctime);
    expect(v["pp_last_edited_time"]).toBeInstanceOf(Date);
    expect((v["pp_last_edited_time"] as Date).getTime()).toBe(mtime);
  });

  it("preserves user-supplied frontmatter values", async () => {
    const records = await standardizeRecords([file]);
    const r = records[0]!;
    if (!E.isRight(r)) throw new Error("expected right");
    expect(r.right.values["title"]).toBe("Example");
  });

  it("does NOT inject virtual fields when ctime/mtime are 0", async () => {
    const noStat = new StubFile("Notes/x.md", "---\na: 1\n---", 0, 0);
    const records = await standardizeRecords([noStat]);
    const r = records[0]!;
    if (!E.isRight(r)) throw new Error("expected right");
    expect("pp_created_time" in r.right.values).toBe(false);
    expect("pp_last_edited_time" in r.right.values).toBe(false);
  });

  it("detectSchema marks virtual time fields as derived (read-only)", async () => {
    const records = await standardizeRecords([file]);
    const right = records.flatMap((r) => (E.isRight(r) ? [r.right] : []));
    const fields = detectSchema(right);
    const created = fields.find((f) => f.name === "pp_created_time");
    const modified = fields.find((f) => f.name === "pp_last_edited_time");
    expect(created).toBeDefined();
    expect(modified).toBeDefined();
    expect(created?.derived).toBe(true);
    expect(modified?.derived).toBe(true);
    expect(created?.type).toBe(DataFieldType.AutoTime);
    expect(modified?.type).toBe(DataFieldType.AutoTime);
  });
});

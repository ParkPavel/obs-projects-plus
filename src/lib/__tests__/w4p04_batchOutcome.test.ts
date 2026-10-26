/**
 * w4-p04 (audit F17) — a batch of record writes says what it did, note by note.
 *
 * Before: `DataApi.updateRecords` resolved the same whether a note was missing
 * or not, and rejected on the first failure while the other writes went on;
 * the view then put EVERY record of the batch back — the written ones too —
 * and said "could not save N records". Now the batch lists written, unchanged,
 * missing and failed notes; the view puts back only the unwritten ones, says
 * how many of how many were not saved, and offers a retry over the failed ones.
 */
import { get } from "svelte/store";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import { DataApi } from "src/lib/dataApi";
import { IFile } from "src/lib/filesystem/filesystem";
import { dataFrame } from "src/lib/stores/dataframe";
import { ViewApi } from "src/lib/viewApi";

type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataRecord = import("src/lib/dataframe/dataframe").DataRecord;
type IFileSystem = import("src/lib/filesystem/filesystem").IFileSystem;
type DataSource = import("src/lib/datasources").DataSource;

jest.mock("src/lib/errors/retryNotice", () => ({ noticeWithRetry: jest.fn() }));
// The words are the registry's; here only the code and its numbers matter.
jest.mock("src/lib/errors/errorText", () => ({
  noticeFor: (code: string, params?: object) => `${code} ${JSON.stringify(params ?? {})}`,
}));
const { noticeWithRetry } = jest.requireMock("src/lib/errors/retryNotice") as {
  noticeWithRetry: jest.Mock<void, [string, (() => void) | undefined]>;
};

const fields: DataField[] = [
  { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
];

/** A note whose write succeeds, or throws when `refuses`. */
class Note extends IFile {
  readonly fm: Record<string, unknown>;
  refuses: boolean;
  constructor(readonly at: string, status: string, refuses = false) {
    super();
    this.fm = { status };
    this.refuses = refuses;
  }
  override get basename(): string { return this.at.replace(/\.md$/, ""); }
  override get path(): string { return this.at; }
  override async read(): Promise<string> { return ""; }
  override async write(): Promise<void> {}
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async processFrontMatter(fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    if (this.refuses) throw new Error("EACCES");
    fn(this.fm);
    return true;
  }
}

const rec = (id: string, status: string): DataRecord => ({ id, values: { status } });

/** ok.md is written, gone.md no longer exists, locked.md refuses the write. */
function setup() {
  const notes: Record<string, Note> = {
    "ok.md": new Note("ok.md", "old"),
    "locked.md": new Note("locked.md", "old", true),
  };
  const dataApi = new DataApi({ getFile: (path: string) => notes[path] ?? null } as unknown as IFileSystem);
  const api = new ViewApi({ includes: () => true } as unknown as DataSource, dataApi);
  dataFrame.set({ fields, records: ["ok.md", "gone.md", "locked.md"].map((id) => rec(id, "old")) });
  return { notes, dataApi, api };
}

const shown = (id: string) => get(dataFrame).records.find((r) => r.id === id)?.values["status"];
const batch = () => ["ok.md", "gone.md", "locked.md"].map((id) => rec(id, "new"));

beforeEach(() => {
  noticeWithRetry.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("DataApi.updateRecords — every note has an outcome", () => {
  it("lists the written, the missing and the refusing note (old code: resolved with nothing)", async () => {
    const { notes, dataApi } = setup();
    const outcome = await dataApi.updateRecords(fields, batch(), [["status"], ["status"], ["status"]]);
    expect(outcome.written).toEqual(["ok.md"]);
    expect(outcome.missing).toEqual(["gone.md"]);
    expect(outcome.failed.map((f) => f.path)).toEqual(["locked.md"]);
    expect(outcome.failed[0]?.error.message).toBe("EACCES");
    expect(notes["ok.md"]?.fm["status"]).toBe("new");
  });

  it("an empty key list is an unchanged note, not a write", async () => {
    const { dataApi } = setup();
    const outcome = await dataApi.updateRecords(fields, [rec("ok.md", "new")], [[]]);
    expect(outcome).toEqual({ written: [], unchanged: ["ok.md"], missing: [], failed: [] });
  });
});

describe("ViewApi.updateRecords — a partial batch", () => {
  it("keeps the written note, puts back only the unwritten ones", async () => {
    const { api } = setup();
    const ok = await api.updateRecords(batch(), fields);
    expect(ok).toBe(false);
    expect(shown("ok.md")).toBe("new");
    expect(shown("gone.md")).toBe("old");
    expect(shown("locked.md")).toBe("old");
  });

  it("says how many of how many were not saved, and offers a retry", async () => {
    const { api } = setup();
    await api.updateRecords(batch(), fields);
    expect(noticeWithRetry).toHaveBeenCalledTimes(1);
    const [text, retry] = noticeWithRetry.mock.calls[0]!;
    expect(text).toBe('PPP-205 {"unwritten":2,"count":3}');
    expect(typeof retry).toBe("function");
  });

  it("the retry writes only the note that failed", async () => {
    const { api, dataApi, notes } = setup();
    await api.updateRecords(batch(), fields);
    const retry = noticeWithRetry.mock.calls[0]![1]!;
    notes["locked.md"]!.refuses = false;
    const spy = jest.spyOn(dataApi, "updateRecords");
    retry();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1].map((r) => r.id)).toEqual(["locked.md"]);
    expect(notes["locked.md"]?.fm["status"]).toBe("new");
    expect(shown("locked.md")).toBe("new");
  });

  it("only missing notes: the notice has no retry — there is nothing to write to", async () => {
    const { api } = setup();
    await api.updateRecords([rec("ok.md", "new"), rec("gone.md", "new")], fields);
    const [text, retry] = noticeWithRetry.mock.calls[0]!;
    expect(text).toContain("PPP-205");
    expect(retry).toBeUndefined();
  });

  it("nothing saved: the whole-batch message", async () => {
    const { api } = setup();
    await api.updateRecords([rec("locked.md", "new")], fields);
    expect(noticeWithRetry.mock.calls[0]![0]).toContain("PPP-202");
    expect(shown("locked.md")).toBe("old");
  });

  it("a full success says nothing", async () => {
    const { api } = setup();
    expect(await api.updateRecords([rec("ok.md", "new")], fields)).toBe(true);
    expect(noticeWithRetry).not.toHaveBeenCalled();
  });
});

describe("Bulk field writes — retry over the notes that failed", () => {
  it("adding a field retries only the refused notes", async () => {
    const { api, dataApi, notes } = setup();
    const field: DataField = { ...fields[0]!, name: "priority" };
    await api.addField(field, "high");
    const [text, retry] = noticeWithRetry.mock.calls[0]!;
    expect(text).toContain("PPP-204");
    notes["locked.md"]!.refuses = false;
    const spy = jest.spyOn(dataApi, "addField");
    retry!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy.mock.calls[0]![0]).toEqual(["locked.md"]);
    expect(notes["locked.md"]?.fm["priority"]).toBe("high");
  });
});

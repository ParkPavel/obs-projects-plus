/**
 * #144 — a schema write spans every note in the project, and the caller used
 * to learn nothing about it: `DataApi` collapsed the writes into one
 * `Promise.all` (first rejection wins, the rest keep running) and `ViewApi`
 * voided the Promise entirely. A vault left half-written was indistinguishable
 * from a complete write.
 *
 * These tests pin the outcome, not the mechanism: how many notes were written,
 * which ones failed, which paths did not resolve.
 */
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { DataApi } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";

const field: DataField = {
  name: "problem_type",
  type: DataFieldType.String,
  repeated: false,
  derived: false,
  identifier: false,
};

class MemoryFile extends IFile {
  constructor(
    private readonly filePath: string,
    private content: string,
    private readonly failOnWrite = false
  ) {
    super();
  }

  override get basename(): string {
    return this.filePath.replace(/^.*\//, "").replace(/\.md$/, "");
  }
  override get path(): string {
    return this.filePath;
  }
  override async read(): Promise<string> {
    return this.content;
  }
  override async write(content: string): Promise<void> {
    if (this.failOnWrite) throw new Error("EACCES: permission denied");
    this.content = content;
  }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> {
    return new Set();
  }
  override async processFrontMatter(): Promise<boolean> {
    return false;
  }
  get written(): string {
    return this.content;
  }
}

function fileSystemOf(files: Record<string, MemoryFile>): IFileSystem {
  return {
    create: async () => {
      throw new Error("not used");
    },
    getFile: (path: string) => files[path] ?? null,
    getAllFiles: () => Object.values(files),
  };
}

const note = (name: string) => `---\ntitle: ${name}\n---\nBody\n`;

describe("#144 DataApi reports the outcome of a bulk field write", () => {
  it("reports every note when all writes succeed", async () => {
    const files = {
      "Clients/a.md": new MemoryFile("Clients/a.md", note("a")),
      "Clients/b.md": new MemoryFile("Clients/b.md", note("b")),
    };
    const api = new DataApi(fileSystemOf(files));

    const outcome = await api.addField(Object.keys(files), field, "");

    expect(outcome).toEqual({ written: 2, failed: [], missing: [] });
    expect(files["Clients/a.md"]!.written).toContain("problem_type");
    expect(files["Clients/b.md"]!.written).toContain("problem_type");
  });

  it("keeps writing after one note fails, and names the one that did not", async () => {
    // The old Promise.all rejected here and the rejection was voided by the
    // caller: the second note was written, the first was not, nobody was told.
    const files = {
      "Clients/locked.md": new MemoryFile("Clients/locked.md", note("locked"), true),
      "Clients/ok.md": new MemoryFile("Clients/ok.md", note("ok")),
    };
    const api = new DataApi(fileSystemOf(files));

    const outcome = await api.addField(Object.keys(files), field, "");

    expect(outcome.written).toBe(1);
    expect(outcome.failed.map((f) => f.path)).toEqual(["Clients/locked.md"]);
    expect(outcome.failed[0]!.error.message).toContain("EACCES");
    expect(files["Clients/ok.md"]!.written).toContain("problem_type");
  });

  it("separates paths the file system cannot resolve from writes that failed", async () => {
    const files = { "Clients/a.md": new MemoryFile("Clients/a.md", note("a")) };
    const api = new DataApi(fileSystemOf(files));

    const outcome = await api.addField(
      ["Clients/a.md", "Clients/ghost.md"],
      field,
      ""
    );

    expect(outcome.written).toBe(1);
    expect(outcome.failed).toEqual([]);
    expect(outcome.missing).toEqual(["Clients/ghost.md"]);
  });

  it("rename and delete report the same way — the hole was identical", async () => {
    const files = {
      "Clients/a.md": new MemoryFile("Clients/a.md", note("a")),
      "Clients/locked.md": new MemoryFile("Clients/locked.md", note("locked"), true),
    };
    const api = new DataApi(fileSystemOf(files));

    const renamed = await api.renameField(Object.keys(files), "title", "name");
    expect(renamed.written).toBe(1);
    expect(renamed.failed.map((f) => f.path)).toEqual(["Clients/locked.md"]);

    const deleted = await api.deleteField(Object.keys(files), "title");
    expect(deleted.written).toBe(1);
    expect(deleted.failed.map((f) => f.path)).toEqual(["Clients/locked.md"]);
  });
});

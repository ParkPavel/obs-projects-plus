/**
 * Catalogue audit C5 — note writes go through the platform's safe APIs.
 *
 * - Bulk field writes (add / rename / delete a property across a project)
 *   decoded and rewrote each note by a separate read and write; they now
 *   mutate the frontmatter inside processFrontMatter when the file offers it,
 *   and keep the old path, same meaning, when it does not.
 * - The read-modify-write path wrote a string computed from an EARLIER read,
 *   so an edit landing in between was overwritten; it now transforms the
 *   file's current contents inside IFile.process (Vault.process in Obsidian).
 * - A template path is normalised before it is looked up.
 * - A recovery note is made with Vault.create, which Obsidian indexes.
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { DataApi } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";
import { CONFLICT_NOTE_FOLDER, writeConflictNote } from "src/lib/settings/brokenBackup";

const field: DataField = { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false };

class FmFile extends IFile {
  fm: Record<string, unknown>;
  writes = 0;
  constructor(private readonly p: string, fm: Record<string, unknown>, private readonly supportsFm = true) {
    super();
    this.fm = { ...fm };
  }
  override get basename(): string { return this.p.replace(/^.*\//, "").replace(/\.md$/, ""); }
  override get path(): string { return this.p; }
  override async read(): Promise<string> {
    const lines = Object.entries(this.fm).map(([k, v]) => `${k}: ${String(v)}`);
    return `---\n${lines.join("\n")}\n---\nbody\n`;
  }
  override async write(): Promise<void> { this.writes++; }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async processFrontMatter(fn: (fm: Record<string, unknown>) => void): Promise<boolean> {
    if (!this.supportsFm) return false;
    fn(this.fm);
    return true;
  }
}

const fsOf = (files: Record<string, IFile>): IFileSystem => ({
  create: async () => { throw new Error("not used"); },
  getFile: (p) => files[p] ?? null,
  getAllFiles: () => Object.values(files),
});

describe("bulk field writes use processFrontMatter", () => {
  test("add, rename and delete mutate the frontmatter and never rewrite the file", async () => {
    const f = new FmFile("a.md", { title: "A", old: "x" });
    const api = new DataApi(fsOf({ "a.md": f }));
    await api.addField(["a.md"], field, "todo");
    await api.renameField(["a.md"], "old", "renamed");
    await api.deleteField(["a.md"], "title");
    expect(f.fm).toEqual({ status: "todo", renamed: "x" });
    expect(f.writes).toBe(0);
  });

  test("renaming a property a note lacks leaves the note without either key", async () => {
    const f = new FmFile("a.md", { title: "A" });
    await new DataApi(fsOf({ "a.md": f })).renameField(["a.md"], "old", "renamed");
    expect(f.fm).toEqual({ title: "A" });
  });
});

class ProcessFile extends IFile {
  constructor(public content: string) { super(); }
  override get basename(): string { return "n"; }
  override get path(): string { return "n.md"; }
  override async read(): Promise<string> { return "---\nstatus: stale\n---\n"; }
  override async write(): Promise<void> { throw new Error("write must not be used: process was available"); }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async process(fn: (data: string) => string): Promise<void> {
    // What Vault.process hands the callback: the file as it is NOW.
    this.content = fn(this.content);
  }
}

describe("the read-modify-write fallback transforms the current contents", () => {
  test("updateFile runs inside IFile.process, on what the file holds now", async () => {
    const f = new ProcessFile("---\nstatus: fresh\nkept: yes\n---\n");
    const api = new DataApi(fsOf({ "n.md": f }));
    await api.updateFile(f, (data) => ({ _tag: "Right", right: data.replace("fresh", "done") }) as never)();
    expect(f.content).toContain("status: done");
    expect(f.content).toContain("kept: yes");
  });
});

describe("a template path is normalised before it is looked up", () => {
  test("a doubled slash still finds the template", async () => {
    const looked: string[] = [];
    const fs: IFileSystem = {
      create: async (p, content) => new ProcessFile(content) as unknown as IFile & { p: string },
      getFile: (p) => { looked.push(p); return null; },
      getAllFiles: () => [],
    };
    await new DataApi(fs).createNote({ id: "x.md", values: {} } as never, [], "Templates//note.md").catch(() => undefined);
    expect(looked).toContain("Templates/note.md");
  });
});

describe("a recovery note is created through the vault when it is given", () => {
  test("the note and its folder go through the vault, so Obsidian indexes them", async () => {

    const onDisk = new Set<string>();
    const adapterWrites: string[] = [];
    const adapter = {
      exists: async (p: string) => onDisk.has(p),
      read: async () => "",
      write: async (p: string) => { adapterWrites.push(p); },
      mkdir: async () => { adapterWrites.push("mkdir"); },
    };
    const created: string[] = [];
    const folders: string[] = [];
    const vault = {
      create: async (p: string) => { created.push(p); onDisk.add(p); },
      createFolder: async (p: string) => { folders.push(p); },
    };
    const at = await writeConflictNote(adapter, '{"version":4}', new Date(), null, vault);
    expect(at).not.toBeNull();
    expect(created).toEqual([at]);
    expect(folders).toEqual([CONFLICT_NOTE_FOLDER]);
    expect(adapterWrites).toEqual([]);
  });
});

/**
 * A note can be created with a body (stab-dup).
 *
 * The calendar's duplicate wrote the copy with `api.addRecord(record, fields, "")`,
 * and the only text createNote could put in a new note came from a template, so
 * a copy had its frontmatter and nothing else. `body` is the minimal way in: it
 * is the text under the frontmatter, and it replaces the template.
 */

import { DataApi } from "src/lib/dataApi";
import { IFile, type IFileSystem } from "src/lib/filesystem/filesystem";

class MemoryFile extends IFile {
  constructor(public content: string) { super(); }
  override get basename(): string { return "n"; }
  override get path(): string { return "n.md"; }
  override async read(): Promise<string> { return this.content; }
  override async write(): Promise<void> { throw new Error("write must not be used: process was available"); }
  override async delete(): Promise<void> {}
  override readTags(): Set<string> { return new Set(); }
  override async process(fn: (data: string) => string): Promise<void> {
    this.content = fn(this.content);
  }
}

function memoryFs(looked: string[] = []): { fs: IFileSystem; files: MemoryFile[]; createdWith: string[] } {
  const files: MemoryFile[] = [];
  const createdWith: string[] = [];
  const fs: IFileSystem = {
    create: async (_path, content) => {
      createdWith.push(content);
      const file = new MemoryFile(content);
      files.push(file);
      return file as unknown as IFile;
    },
    getFile: (path) => { looked.push(path); return null; },
    getAllFiles: () => [],
  };
  return { fs, files, createdWith };
}

const record = { id: "Visits/visit_copy.md", values: { date: "2026-03-20" } } as never;

describe("DataApi.createNote with a body", () => {
  it("creates the note with the body under the frontmatter", async () => {
    const { fs, files } = memoryFs();
    await new DataApi(fs).createNote(record, [], "", "First line\n\nSecond line\n");
    const text = files[0]?.content ?? "";
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toMatch(/date: ["']?2026-03-20["']?/);
    expect(text).toContain("First line\n\nSecond line\n");
    // The frontmatter comes first, the body after it.
    expect(text.indexOf("date:")).toBeLessThan(text.indexOf("First line"));
  });

  it("hands the body to the file system as the note's content", async () => {
    const { fs, createdWith } = memoryFs();
    await new DataApi(fs).createNote(record, [], "", "Body only");
    expect(createdWith).toEqual(["Body only"]);
  });

  it("does not read a template when a body is given", async () => {
    const looked: string[] = [];
    const { fs } = memoryFs(looked);
    await new DataApi(fs).createNote(record, [], "Templates/visit.md", "Body");
    expect(looked).toEqual([]);
  });

  it("keeps an empty body empty rather than falling back to the template", async () => {
    const looked: string[] = [];
    const { fs, createdWith } = memoryFs(looked);
    await new DataApi(fs).createNote(record, [], "Templates/visit.md", "");
    expect(looked).toEqual([]);
    expect(createdWith).toEqual([""]);
  });

  it("without a body it behaves as before: the template is looked up", async () => {
    const looked: string[] = [];
    const { fs } = memoryFs(looked);
    await new DataApi(fs).createNote(record, [], "Templates/visit.md");
    expect(looked).toEqual(["Templates/visit.md"]);
  });
});

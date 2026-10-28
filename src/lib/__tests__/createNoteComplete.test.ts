import { DataApi } from "src/lib/dataApi";
import { IFile } from "src/lib/filesystem/filesystem";

class CreatedFile extends IFile {
  get basename(): string { return "new"; }
  get path(): string { return "new.md"; }
  async read(): Promise<string> { return ""; }
  async write(): Promise<void> { throw new Error("unexpected second write"); }
  async delete(): Promise<void> { throw new Error("must not delete a created note as compensation"); }
  readTags(): Set<string> { return new Set(); }
  async process(): Promise<void> { throw new Error("unexpected second write"); }
}

describe("new notes are complete at the creation boundary", () => {
  it("creates content and properties together, without a fallible follow-up write", async () => {
    const create = jest.fn(async () => new CreatedFile());
    const fs = { create, getFile: () => null, getAllFiles: () => [] };
    await expect(new DataApi(fs).createNote({ id: "new.md", values: { done: false, count: 0 } }, [], "", "Body"))
      .resolves.toBeUndefined();
    const args = create.mock.calls[0] as unknown as [string, string];
    expect(args[0]).toBe("new.md");
    expect(args[1]).toMatch(/done: false/);
    expect(args[1]).toMatch(/count: 0/);
    expect(args[1]).toContain("Body");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not leave an empty file when frontmatter cannot be prepared", async () => {
    const create = jest.fn(async () => new CreatedFile());
    const fs = { create, getFile: () => null, getAllFiles: () => [] };
    await expect(new DataApi(fs).createNote({ id: "new.md", values: { status: "todo" } }, [], "", "---\nbroken: [\n---\nBody"))
      .rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
// This boundary must exercise YAML's actual failure behaviour, not the suite's
// permissive subset parser (which accepts malformed YAML).
jest.mock("yaml", () => jest.requireActual("../../../node_modules/yaml/dist/index.js"));

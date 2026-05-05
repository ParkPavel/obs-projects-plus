import type { TFile } from "obsidian";
import { pathFromFile } from "../RelationPickerModal";

describe("pathFromFile", () => {
  it("strips .md extension", () => {
    const file = { path: "Folder/Note.md", extension: "md" } as unknown as TFile;
    expect(pathFromFile(file)).toBe("Folder/Note");
  });

  it("preserves non-md paths verbatim", () => {
    const file = { path: "Folder/file.png", extension: "png" } as unknown as TFile;
    expect(pathFromFile(file)).toBe("Folder/file.png");
  });

  it("handles top-level notes", () => {
    const file = { path: "Note.md", extension: "md" } as unknown as TFile;
    expect(pathFromFile(file)).toBe("Note");
  });
});

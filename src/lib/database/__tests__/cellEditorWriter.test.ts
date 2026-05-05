import type { App, TFile } from "obsidian";
import { writeCellValue } from "../cellEditorWriter";

function makeApp(): {
  app: App;
  calls: Array<{ file: TFile; mutate: (fm: Record<string, unknown>) => void }>;
  data: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {};
  const calls: Array<{
    file: TFile;
    mutate: (fm: Record<string, unknown>) => void;
  }> = [];
  const app = {
    fileManager: {
      async processFrontMatter(
        file: TFile,
        fn: (fm: Record<string, unknown>) => void,
      ) {
        calls.push({ file, mutate: fn });
        fn(data);
      },
    },
  } as unknown as App;
  return { app, calls, data };
}

describe("writeCellValue", () => {
  const file = { path: "Note.md" } as unknown as TFile;

  it("returns false when host lacks processFrontMatter", async () => {
    const app = { fileManager: {} } as unknown as App;
    const ok = await writeCellValue(app, file, "key", "x");
    expect(ok).toBe(false);
  });

  it("writes scalar values via processFrontMatter", async () => {
    const { app, data } = makeApp();
    await writeCellValue(app, file, "title", "Hello");
    expect(data["title"]).toBe("Hello");
  });

  it("deletes the key on null", async () => {
    const { app, data } = makeApp();
    data["title"] = "old";
    await writeCellValue(app, file, "title", null);
    expect("title" in data).toBe(false);
  });

  it("deletes the key when array is empty", async () => {
    const { app, data } = makeApp();
    data["tags"] = ["alpha"];
    await writeCellValue(app, file, "tags", []);
    expect("tags" in data).toBe(false);
  });

  it("writes non-empty arrays", async () => {
    const { app, data } = makeApp();
    await writeCellValue(app, file, "tags", ["a", "b"]);
    expect(data["tags"]).toEqual(["a", "b"]);
  });
});

// NPLAN-C2 — writeInverseRelations unit tests

import type { App, TFile } from "obsidian";
import { writeInverseRelations } from "../relationsWriter";
import type { RelationFieldConfig } from "src/settings/base/settings";

function makeApp(files: Record<string, Record<string, unknown>>): App {
  const fileManager = {
    processFrontMatter: jest.fn(
      async (
        file: TFile,
        mutate: (fm: Record<string, unknown>) => void
      ): Promise<void> => {
        const path = (file as unknown as { path: string }).path;
        if (!files[path]) files[path] = {};
        mutate(files[path]!);
      }
    ),
  };
  const vault = {
    getAbstractFileByPath: jest.fn(() => null),
  };
  const metadataCache = {
    getFirstLinkpathDest: jest.fn((name: string) => {
      const path = name.endsWith(".md") ? name : `${name}.md`;
      if (files[path] !== undefined) {
        return { path } as unknown as TFile;
      }
      return null;
    }),
  };
  return { fileManager, vault, metadataCache } as unknown as App;
}

describe("writeInverseRelations (NPLAN-C2)", () => {
  test("no-op when inverseFieldName not set", async () => {
    const cfg: RelationFieldConfig = { targetProjectId: "p" };
    const files: Record<string, Record<string, unknown>> = { "A.md": {} };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: cfg,
      newValue: "[[A]]",
      oldValue: null,
      app,
    });
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  test("appends source link when target added", async () => {
    const files: Record<string, Record<string, unknown>> = { "Target.md": {} };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: "[[Target]]",
      oldValue: null,
      app,
    });
    expect(files["Target.md"]!["backlinks"]).toEqual(["[[Source]]"]);
  });

  test("removes source link when target removed", async () => {
    const files: Record<string, Record<string, unknown>> = {
      "Target.md": { backlinks: ["[[Source]]", "[[Other]]"] },
    };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: null,
      oldValue: "[[Target]]",
      app,
    });
    expect(files["Target.md"]!["backlinks"]).toEqual(["[[Other]]"]);
  });

  test("deletes key when last inverse link removed", async () => {
    const files: Record<string, Record<string, unknown>> = {
      "Target.md": { backlinks: ["[[Source]]"] },
    };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: null,
      oldValue: "[[Target]]",
      app,
    });
    expect(files["Target.md"]!["backlinks"]).toBeUndefined();
  });

  test("idempotent — no-op when added and removed sets are both empty", async () => {
    const files: Record<string, Record<string, unknown>> = {
      "Target.md": { backlinks: ["[[Source]]"] },
    };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: "[[Target]]",
      oldValue: "[[Target]]",
      app,
    });
    // added=[], removed=[] → no processFrontMatter call
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  test("handles array newValue (multi-relation)", async () => {
    const files: Record<string, Record<string, unknown>> = {
      "A.md": {},
      "B.md": {},
    };
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: ["[[A]]", "[[B]]"],
      oldValue: null,
      app,
    });
    expect(files["A.md"]!["backlinks"]).toEqual(["[[Source]]"]);
    expect(files["B.md"]!["backlinks"]).toEqual(["[[Source]]"]);
  });

  test("skips missing target file silently", async () => {
    const files: Record<string, Record<string, unknown>> = {};
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: "[[Ghost]]",
      oldValue: null,
      app,
    });
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  test("no-op when both oldValue and newValue null", async () => {
    const files: Record<string, Record<string, unknown>> = {};
    const app = makeApp(files);
    await writeInverseRelations({
      sourceRecordId: "Source",
      fieldName: "f",
      fieldConfig: { targetProjectId: "p", inverseFieldName: "backlinks" },
      newValue: null,
      oldValue: null,
      app,
    });
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });
});

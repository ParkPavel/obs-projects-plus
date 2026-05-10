/**
 * DataviewDataSource — pure-method tests (R5-014).
 *
 * Tests the three methods that don't require a live Dataview query:
 *   - includes(): respects excludedNotes
 *   - sortFields(): orders fields by header priority
 *   - standardizeRecords(): resolves Link paths and synthetic IDs
 */

import { describe, expect, it } from "@jest/globals";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type {
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { DataviewDataSource } from "./datasource";

const defaultPrefs: ProjectsPluginPreferences = {
  projectSizeLimit: 1000,
  frontmatter: { quoteStrings: "PLAIN" },
  locale: { firstDayOfWeek: "monday" },
  commands: [],
  linkBehavior: "open-editor",
  mobileCalendarView: "month",
  showViewTitles: true,
  animationBehavior: "smooth",
  disableHapticFeedback: false,
  replaceObsidianProperties: false,
};

function makeProject(excludedNotes: string[] = []): ProjectDefinition {
  return {
    name: "Test",
    id: "test-id",
    fieldConfig: {},
    views: [],
    defaultName: "",
    templates: [],
    excludedNotes,
    isDefault: false,
    newNotesFolder: "",
    dataSource: { kind: "dataview", config: { query: "TABLE FROM #test" } },
  };
}

function makeApi(idColumnName = "File"): any {
  return {
    settings: { tableIdColumnName: idColumnName },
    query: async () => ({ successful: false }),
  };
}

function makeSource(excludedNotes: string[] = []): DataviewDataSource {
  return new DataviewDataSource(
    {} as any,
    makeProject(excludedNotes),
    defaultPrefs,
    makeApi()
  );
}

function makeField(name: string): DataField {
  return {
    name,
    type: DataFieldType.String,
    identifier: false,
    repeated: false,
    derived: false,
    typeConfig: {},
  };
}

describe("DataviewDataSource.includes", () => {
  it("includes a file not in excludedNotes", () => {
    const src = makeSource([]);
    expect(src.includes("Work/Note.md")).toBe(true);
  });

  it("excludes a file in excludedNotes", () => {
    const src = makeSource(["Work/Secret.md"]);
    expect(src.includes("Work/Secret.md")).toBe(false);
  });

  it("includes a file that has a similar prefix to an excluded note", () => {
    const src = makeSource(["Work/Note.md"]);
    expect(src.includes("Work/NoteExtra.md")).toBe(true);
  });

  it("always returns true when excludedNotes is empty", () => {
    const src = makeSource([]);
    expect(src.includes("Anything/Path.md")).toBe(true);
  });
});

describe("DataviewDataSource.sortFields", () => {
  it("places known header fields in header index order", () => {
    const src = makeSource();
    const fields = [makeField("B"), makeField("A"), makeField("File")];
    const sorted = src.sortFields(fields, ["File", "A", "B"]);
    expect(sorted[0]?.name).toBe("File");
    expect(sorted[1]?.name).toBe("A");
    expect(sorted[2]?.name).toBe("B");
  });

  it("sorts unknown-header fields before known ones (index -1 < 0)", () => {
    const src = makeSource();
    const fields = [makeField("File"), makeField("Unknown")];
    const sorted = src.sortFields(fields, ["File"]);
    // "Unknown" has index -1, "File" has index 0: -1 < 0 → Unknown sorts first
    expect(sorted[0]?.name).toBe("Unknown");
    expect(sorted[1]?.name).toBe("File");
  });

  it("sorts multiple unknown-header fields alphabetically among themselves", () => {
    const src = makeSource();
    const fields = [makeField("Z"), makeField("A")];
    const sorted = src.sortFields(fields, []);
    expect(sorted[0]?.name).toBe("A");
    expect(sorted[1]?.name).toBe("Z");
  });

  it("returns an empty array unchanged", () => {
    const src = makeSource();
    expect(src.sortFields([], ["File"])).toEqual([]);
  });
});

describe("DataviewDataSource.standardizeRecords", () => {
  it("extracts path from Link objects as record id", () => {
    const src = makeSource();
    const rows = [{ File: { path: "Work/Note.md", display: "Note" } }];
    const records = src.standardizeRecords(rows);
    expect(records[0]?.id).toBe("Work/Note.md");
  });

  it("falls back to String(id) when id is a plain string", () => {
    const src = makeSource();
    const rows = [{ File: "plain-string-id" }];
    const records = src.standardizeRecords(rows);
    expect(records[0]?.id).toBe("plain-string-id");
  });

  it("generates synthetic row-N id when id column is missing", () => {
    const src = makeSource();
    const rows = [{ Title: "Some note" }];
    const records = src.standardizeRecords(rows);
    expect(records[0]?.id).toBe("row-0");
  });

  it("generates sequential synthetic ids for multiple rows with missing ids", () => {
    const src = makeSource();
    const rows = [{ Title: "A" }, { Title: "B" }];
    const records = src.standardizeRecords(rows);
    expect(records[0]?.id).toBe("row-0");
    expect(records[1]?.id).toBe("row-1");
  });
});

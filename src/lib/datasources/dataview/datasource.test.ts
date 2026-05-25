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
  FilterDefinition,
  ProjectDefinition,
  ProjectsPluginPreferences,
} from "src/settings/settings";
import { createDataviewSource, DataviewDataSource } from "./datasource";

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

function makeProject(
  excludedNotes: string[] = [],
  filter?: FilterDefinition
): ProjectDefinition {
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
    dataSource: {
      kind: "dataview",
      config: { query: "TABLE FROM #test", ...(filter ? { filter } : {}) },
    },
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

describe("createDataviewSource", () => {
  it("returns 'ok' resolution when dataviewApi is provided", () => {
    const result = createDataviewSource(
      {} as any,
      makeProject(),
      defaultPrefs,
      makeApi()
    );
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.source).toBeInstanceOf(DataviewDataSource);
    }
  });

  it("returns 'unavailable' with reason when api is undefined", () => {
    const result = createDataviewSource(
      {} as any,
      makeProject(),
      defaultPrefs,
      undefined
    );
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expect(result.reason).toBe("dataview-unavailable");
    }
  });

  it("does not construct DataviewDataSource when api is undefined", () => {
    const result = createDataviewSource(
      {} as any,
      makeProject(),
      defaultPrefs,
      undefined
    );
    // Type guard ensures we never reach `.source` access on `unavailable`.
    expect((result as any).source).toBeUndefined();
  });
});

describe("DataviewDataSource.queryAll — unified filter semantics (#045.5)", () => {
  // Three-row TABLE result fixture used across the unified-filter tests.
  // Two columns: File (id) + Priority (Number-typed by detectSchema).
  const TABLE_RESULT_3_ROWS = {
    successful: true,
    value: {
      type: "table" as const,
      headers: ["File", "Priority"],
      values: [
        [{ path: "alpha.md", display: "alpha" }, 1],
        [{ path: "beta.md", display: "beta" }, 5],
        [{ path: "gamma.md", display: "gamma" }, 10],
      ],
    },
  };

  function makeApiWithTable(): any {
    return {
      settings: { tableIdColumnName: "File" },
      query: async () => TABLE_RESULT_3_ROWS,
    };
  }

  function makeSourceWithFilter(filter?: FilterDefinition): DataviewDataSource {
    return new DataviewDataSource(
      {} as any,
      makeProject([], filter),
      defaultPrefs,
      makeApiWithTable()
    );
  }

  it("returns all rows when config.filter is undefined", async () => {
    const src = makeSourceWithFilter(undefined);
    const frame = await src.queryAll();
    expect(frame.records).toHaveLength(3);
    expect(frame.records.map((r) => r.id)).toEqual([
      "alpha.md",
      "beta.md",
      "gamma.md",
    ]);
  });

  it("returns all rows when config.filter has zero conditions (no-op)", async () => {
    const src = makeSourceWithFilter({ conjunction: "and", conditions: [] });
    const frame = await src.queryAll();
    expect(frame.records).toHaveLength(3);
  });

  it("applies config.filter via canonical filterEvaluator (gt operator)", async () => {
    const src = makeSourceWithFilter({
      conjunction: "and",
      conditions: [
        { field: "Priority", operator: "gt", value: "3", enabled: true },
      ],
    });
    const frame = await src.queryAll();
    // Only beta (5) and gamma (10) match Priority > 3
    expect(frame.records).toHaveLength(2);
    expect(frame.records.map((r) => r.id).sort()).toEqual([
      "beta.md",
      "gamma.md",
    ]);
  });

  it("preserves fields shape after filtering (no schema drift)", async () => {
    const src = makeSourceWithFilter({
      conjunction: "and",
      conditions: [
        { field: "Priority", operator: "eq", value: "5", enabled: true },
      ],
    });
    const frame = await src.queryAll();
    expect(frame.fields.map((f) => f.name).sort()).toEqual(["File", "Priority"]);
    expect(frame.records).toHaveLength(1);
    expect(frame.records[0]?.id).toBe("beta.md");
  });

  it("respects R2.1c negative-semantics for undefined values (parity with folder/tag)", async () => {
    // gamma row will not have a value for "MissingField"; with a negative
    // operator filterEvaluator keeps records whose value is undefined.
    const src = makeSourceWithFilter({
      conjunction: "and",
      conditions: [
        {
          field: "MissingField",
          operator: "is-not",
          value: "x",
          enabled: true,
        },
      ],
    });
    const frame = await src.queryAll();
    expect(frame.records).toHaveLength(3); // all retained per R2.1c
  });

  it("supports group composition (and inside or)", async () => {
    const src = makeSourceWithFilter({
      conjunction: "or",
      conditions: [
        { field: "Priority", operator: "eq", value: "1", enabled: true },
      ],
      groups: [
        {
          conjunction: "and",
          conditions: [
            { field: "Priority", operator: "gt", value: "7", enabled: true },
          ],
        },
      ],
    });
    const frame = await src.queryAll();
    // alpha (eq 1) OR gamma (>7) — beta (5) excluded
    expect(frame.records.map((r) => r.id).sort()).toEqual([
      "alpha.md",
      "gamma.md",
    ]);
  });

  it("skips disabled conditions (enabled: false acts as if absent)", async () => {
    const src = makeSourceWithFilter({
      conjunction: "and",
      conditions: [
        { field: "Priority", operator: "eq", value: "1", enabled: false },
      ],
    });
    const frame = await src.queryAll();
    // All three records remain — the only condition is disabled.
    expect(frame.records).toHaveLength(3);
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

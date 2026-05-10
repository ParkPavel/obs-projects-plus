import {
  exportToCsv,
  exportToTsv,
  exportToJson,
  exportToMarkdown,
  exportRecords,
  exportMimeType,
  exportFileExtension,
} from "../exportService";
import type { DataField, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";

const fields: DataField[] = [
  { name: "name", type: DataFieldType.String, repeated: false, derived: false, identifier: true },
  { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
  { name: "estimate", type: DataFieldType.Number, repeated: false, derived: false, identifier: false },
];

const records: DataRecord[] = [
  { id: "note1.md", values: { name: "Alice", status: "done", estimate: 3 } },
  { id: "note2.md", values: { name: "Bob, Jr.", status: "todo", estimate: null } },
  { id: "note3.md", values: { name: "Carol", status: undefined, estimate: 7 } },
];

describe("exportToCsv", () => {
  it("produces header row", () => {
    const out = exportToCsv(records, fields);
    const lines = out.split("\n");
    expect(lines[0]).toBe("name,status,estimate");
  });

  it("escapes commas in values", () => {
    const out = exportToCsv(records, fields);
    expect(out).toContain('"Bob, Jr."');
  });

  it("renders null/undefined as empty string", () => {
    const out = exportToCsv(records, fields);
    const lines = out.split("\n");
    expect(lines[2]).toBe('"Bob, Jr.",todo,');
    expect(lines[3]).toBe("Carol,,7");
  });
});

describe("exportToTsv", () => {
  it("uses tabs as separator", () => {
    const out = exportToTsv(records, fields);
    expect(out.split("\n")[0]).toBe("name\tstatus\testimate");
  });
});

describe("exportToJson", () => {
  it("produces a JSON array", () => {
    const out = exportToJson(records, fields);
    const parsed = JSON.parse(out) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
  });

  it("includes _id and field values", () => {
    const out = exportToJson(records, fields);
    const parsed = JSON.parse(out) as Array<Record<string, unknown>>;
    expect(parsed[0]?.["_id"]).toBe("note1.md");
    expect(parsed[0]?.["name"]).toBe("Alice");
  });

  it("serialises null for missing fields", () => {
    const out = exportToJson(records, fields);
    const parsed = JSON.parse(out) as Array<Record<string, unknown>>;
    expect(parsed[1]?.["estimate"]).toBeNull();
  });
});

describe("exportToMarkdown", () => {
  it("produces a pipe-table header", () => {
    const out = exportToMarkdown(records, fields);
    const lines = out.split("\n");
    expect(lines[0]).toBe("| name | status | estimate |");
    expect(lines[1]).toBe("| --- | --- | --- |");
  });

  it("escapes pipe characters", () => {
    const pipeRecords: DataRecord[] = [
      { id: "a.md", values: { name: "A|B", status: "x", estimate: 1 } },
    ];
    const out = exportToMarkdown(pipeRecords, fields);
    expect(out).toContain("A\\|B");
  });
});

describe("exportRecords dispatch", () => {
  it("delegates to correct format", () => {
    expect(exportRecords(records, fields, "csv")).toContain(",");
    expect(exportRecords(records, fields, "tsv")).toContain("\t");
    const json = JSON.parse(exportRecords(records, fields, "json"));
    expect(Array.isArray(json)).toBe(true);
    expect(exportRecords(records, fields, "markdown")).toContain("|");
  });
});

describe("exportMimeType / exportFileExtension", () => {
  it("returns correct mime type", () => {
    expect(exportMimeType("csv")).toBe("text/csv");
    expect(exportMimeType("json")).toBe("application/json");
    expect(exportMimeType("markdown")).toBe("text/markdown");
  });

  it("returns correct extension", () => {
    expect(exportFileExtension("csv")).toBe(".csv");
    expect(exportFileExtension("tsv")).toBe(".tsv");
    expect(exportFileExtension("json")).toBe(".json");
    expect(exportFileExtension("markdown")).toBe(".md");
  });
});

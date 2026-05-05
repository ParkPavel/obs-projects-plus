import { test, describe, expect, it } from "@jest/globals";
import {
  DataFieldType,
  type DataField,
  type DataRecord,
} from "../dataframe/dataframe";
import { detectCellType, detectFields, parseRecords } from "./helpers";

describe("parseRecords", () => {
  it("parses", () => {
    const records: DataRecord[] = [
      {
        id: "Foo.md",
        values: { number: 12, text: "Foo", boolean: true },
      },
      {
        id: "Bar.md",
        values: { number: 12, text: "Bar", boolean: false },
      },
      {
        id: "Baz.md",
        values: {
          number: "12",
          text: 100,
          boolean: "false",
          repeated: [1, 2, 3],
        },
      },
    ];

    const fields: DataField[] = [
      {
        name: "number",
        type: DataFieldType.Number,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "text",
        type: DataFieldType.String,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "boolean",
        type: DataFieldType.Boolean,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "repeated",
        type: DataFieldType.String,
        identifier: false,
        derived: false,
        repeated: true,
        typeConfig: {},
      },
    ];

    const expected: DataRecord[] = [
      {
        id: "Foo.md",
        values: { number: 12, text: "Foo", boolean: true },
      },
      {
        id: "Bar.md",
        values: {
          number: 12,
          text: "Bar",
          boolean: false,
        },
      },
      {
        id: "Baz.md",
        values: {
          number: 12,
          text: "100",
          boolean: false,
          repeated: [1, 2, 3],
        },
      },
    ];

    expect(parseRecords(records, fields)).toStrictEqual(expected);
  });
});

describe("detectFields", () => {
  it("detects", () => {
    const records: DataRecord[] = [
      {
        id: "Foo.md",
        values: { number: 12, text: "Foo", boolean: true, nullable: null },
      },
      {
        id: "Bar.md",
        values: { number: 12, text: "Bar", boolean: false, nullable: null },
      },
      {
        id: "Baz.md",
        values: { number: 12, text: 100, boolean: "false", nullable: null },
      },
    ];
    const fields: DataField[] = [
      {
        name: "number",
        type: DataFieldType.Number,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "text",
        type: DataFieldType.String,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "boolean",
        type: DataFieldType.String,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
      {
        name: "nullable",
        type: DataFieldType.String,
        identifier: false,
        derived: false,
        repeated: false,
        typeConfig: {},
      },
    ];

    expect(detectFields(records)).toStrictEqual(fields);
  });
});

describe("detectCellType", () => {
  const cases: [unknown, DataFieldType][] = [
    // Primitive values.
    [null, DataFieldType.Unknown],
    [undefined, DataFieldType.Unknown],
    ["My value", DataFieldType.String],
    ["", DataFieldType.String],
    [12.0, DataFieldType.Number],
    [0, DataFieldType.Number],
    [true, DataFieldType.Boolean],
    [false, DataFieldType.Boolean],

    // Repeated values.
    [["foo", "bar"], DataFieldType.String],
    [[null, "bar"], DataFieldType.String],
    [[1, 2], DataFieldType.Number],
    [[1, null], DataFieldType.Number],
    [[true, false], DataFieldType.Boolean],
    [[null, false], DataFieldType.Boolean],
    [[true, 1], DataFieldType.String], // Fall back to String field.
    [[], DataFieldType.String], // Current behavior, but is this what we want?

    // Complex values.
    ["2022-01-01", DataFieldType.Date],
    ["2022-01-01T22:35", DataFieldType.Date],
    [new Date("2024-01-15"), DataFieldType.Date],  // Date objects from YAML parser
    [{ my: "object" }, DataFieldType.String],       // Nested YAML maps → String so they appear

    // Wiki-link / Relation detection (Stage A.9 — single string stays
    // String to preserve `[[path|alias]]` semantics for the derived `name`
    // field; only arrays of wiki-links auto-detect as Relation).
    ["[[Account 1]]", DataFieldType.String],
    ["[[Account 1|Custom]]", DataFieldType.String],
    [["[[A]]", "[[B]]"], DataFieldType.Relation],
    [["[[A]]", "plain"], DataFieldType.String], // Mixed → fall back
  ];

  test.each(cases)("%s should be detected as %s", (value, expected) => {
    expect(detectCellType(value)).toStrictEqual(expected);
  });
});

describe("parseRecords (Stage A field types)", () => {
  // Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a S-1/S-3/S-4/S-5a/S-6
  const buildField = (
    name: string,
    type: DataFieldType,
    repeated = false
  ): DataField => ({
    name,
    type,
    identifier: false,
    derived: false,
    repeated,
    typeConfig: {},
  });

  it("Relation: single wiki-link string → string[]", () => {
    const records: DataRecord[] = [
      { id: "j.md", values: { account: "[[Account 1]]" } },
    ];
    parseRecords(records, [buildField("account", DataFieldType.Relation)]);
    expect(records[0]?.values["account"]).toStrictEqual(["Account 1"]);
  });

  it("Relation: array of wiki-links → normalized bodies", () => {
    const records: DataRecord[] = [
      { id: "j.md", values: { accounts: ["[[A]]", "[[B|alias]]"] } },
    ];
    parseRecords(records, [buildField("accounts", DataFieldType.Relation, true)]);
    expect(records[0]?.values["accounts"]).toStrictEqual(["A", "B"]);
  });

  it("Relation: null/undefined left intact", () => {
    const records: DataRecord[] = [
      { id: "j.md", values: { accounts: null } },
    ];
    parseRecords(records, [buildField("accounts", DataFieldType.Relation, true)]);
    expect(records[0]?.values["accounts"]).toBeNull();
  });

  it("Select / Status: pass-through (no parse)", () => {
    const records: DataRecord[] = [
      { id: "j.md", values: { sel: "todo", st: "active" } },
    ];
    parseRecords(records, [
      buildField("sel", DataFieldType.Select),
      buildField("st", DataFieldType.Status),
    ]);
    expect(records[0]?.values["sel"]).toBe("todo");
    expect(records[0]?.values["st"]).toBe("active");
  });

  it("Formula / Rollup: raw value left intact", () => {
    const records: DataRecord[] = [
      { id: "j.md", values: { f: 42, r: "x" } },
    ];
    parseRecords(records, [
      buildField("f", DataFieldType.Formula),
      buildField("r", DataFieldType.Rollup),
    ]);
    expect(records[0]?.values["f"]).toBe(42);
    expect(records[0]?.values["r"]).toBe("x");
  });

  it("Relation: derived `name` field is exempt (Stage A.9 regression guard)", () => {
    // The derived `name` field is encoded as `[[fullpath|basename]]` so
    // MarkdownRenderer can render the alias and route clicks to the path.
    // Stage A.9 guarantees this encoding survives parseRecords even if the
    // schema accidentally classifies `name` as Relation.
    const nameField: DataField = {
      name: "name",
      type: DataFieldType.Relation,
      identifier: true,
      derived: true,
      repeated: false,
      typeConfig: {},
    };
    const records: DataRecord[] = [
      { id: "Foo.md", values: { name: "[[Folder/Foo|Foo]]" } },
    ];
    parseRecords(records, [nameField]);
    expect(records[0]?.values["name"]).toBe("[[Folder/Foo|Foo]]");
  });

  it("Relation: derived `path` field is exempt (Stage A.9 regression guard)", () => {
    const pathField: DataField = {
      name: "path",
      type: DataFieldType.Relation,
      identifier: false,
      derived: true,
      repeated: false,
      typeConfig: {},
    };
    const records: DataRecord[] = [
      { id: "Foo.md", values: { path: "Folder/Foo.md" } },
    ];
    parseRecords(records, [pathField]);
    expect(records[0]?.values["path"]).toBe("Folder/Foo.md");
  });
});

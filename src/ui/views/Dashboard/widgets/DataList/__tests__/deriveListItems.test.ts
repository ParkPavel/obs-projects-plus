// MPLAN-008 — Tests for deriveListItems.

import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { deriveListItems } from "../deriveListItems";

function makeFrame(): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "priority", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
      { name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "notes/a.md", values: { name: "Alpha", priority: 2, status: "open" } },
      { id: "notes/b.md", values: { name: "Bravo", priority: 1, status: "done" } },
      { id: "notes/c.md", values: { name: "", priority: 3, status: "open" } },
    ],
  };
}

describe("deriveListItems", () => {
  test("empty config still produces a row per record with title fallback", () => {
    const items = deriveListItems(makeFrame(), { fields: [] });
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toBe("Alpha");
    expect(items[2]?.title).toBe("c");
    expect(items[0]?.fields).toEqual([]);
  });

  test("uses titleField when provided", () => {
    const items = deriveListItems(makeFrame(), { titleField: "status", fields: [] });
    expect(items.map((i) => i.title)).toEqual(["open", "done", "open"]);
  });

  test("includes selected fields with their raw values and frame-derived types", () => {
    const items = deriveListItems(makeFrame(), { fields: ["priority", "status"] });
    // #045.3: ListItem.fields[i].type now mirrors frame.fields entry.
    expect(items[0]?.fields).toEqual([
      { name: "priority", value: 2, type: DataFieldType.Number },
      { name: "status", value: "open", type: DataFieldType.String },
    ]);
  });

  test("#045.3 — propagates Relation type when field is declared as Relation", () => {
    const frame: DataFrame = {
      fields: [
        { name: "name", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
        { name: "deps", type: DataFieldType.Relation, repeated: true, identifier: false, derived: false },
      ],
      records: [{ id: "notes/a.md", values: { name: "A", deps: ["[[B]]", "[[C]]"] } }],
    };
    const items = deriveListItems(frame, { fields: ["deps"] });
    expect(items[0]?.fields[0]?.type).toBe(DataFieldType.Relation);
    expect(items[0]?.fields[0]?.value).toEqual(["[[B]]", "[[C]]"]);
  });

  test("#045.3 — falls back to DataFieldType.Unknown for fields absent from the frame schema", () => {
    const items = deriveListItems(makeFrame(), { fields: ["ghost"] });
    expect(items[0]?.fields[0]?.type).toBe(DataFieldType.Unknown);
    expect(items[0]?.fields[0]?.value).toBeUndefined();
  });

  test("sorts ascending by sortField", () => {
    const items = deriveListItems(makeFrame(), {
      fields: [],
      sortField: "priority",
      sortOrder: "asc",
    });
    expect(items.map((i) => i.id)).toEqual(["notes/b.md", "notes/a.md", "notes/c.md"]);
  });

  test("sorts descending and respects limit", () => {
    const items = deriveListItems(makeFrame(), {
      fields: [],
      sortField: "priority",
      sortOrder: "desc",
      limit: 2,
    });
    expect(items.map((i) => i.id)).toEqual(["notes/c.md", "notes/a.md"]);
  });

  test("missing values sort to the bottom regardless of order", () => {
    const frame: DataFrame = {
      ...makeFrame(),
      records: [
        { id: "x.md", values: { name: "X" } },
        { id: "y.md", values: { name: "Y", priority: 5 } },
      ],
    };
    const asc = deriveListItems(frame, { fields: [], sortField: "priority", sortOrder: "asc" });
    expect(asc.map((i) => i.id)).toEqual(["y.md", "x.md"]);
    const desc = deriveListItems(frame, { fields: [], sortField: "priority", sortOrder: "desc" });
    expect(desc.map((i) => i.id)).toEqual(["y.md", "x.md"]);
  });

  test("undefined config behaves like empty", () => {
    const items = deriveListItems(makeFrame(), undefined);
    expect(items).toHaveLength(3);
    expect(items[0]?.fields).toEqual([]);
  });
});

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

  test("includes selected fields with their raw values", () => {
    const items = deriveListItems(makeFrame(), { fields: ["priority", "status"] });
    expect(items[0]?.fields).toEqual([
      { name: "priority", value: 2 },
      { name: "status", value: "open" },
    ]);
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

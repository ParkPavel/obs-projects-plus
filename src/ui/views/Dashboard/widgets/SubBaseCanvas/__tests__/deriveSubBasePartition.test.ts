// R5-009 — Tests for SubBaseCanvas partition derivation.

import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import {
  partitionFrame,
  deriveSubBaseItems,
  type SubBaseLike,
} from "../deriveSubBasePartition";

function makeFrame(): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "type", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "amount", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records: [
      { id: "a.md", values: { name: "Alpha", type: "budget", amount: 100 } },
      { id: "b.md", values: { name: "Bravo", type: "expense", amount: 25 } },
      { id: "c.md", values: { name: "Charlie", type: "expense", amount: 40 } },
    ],
  };
}

describe("SubBaseCanvas — partitionFrame", () => {
  test("undefined sub-base returns frame unchanged", () => {
    const out = partitionFrame(makeFrame(), undefined);
    expect(out.records).toHaveLength(3);
  });

  test("empty filter returns all records", () => {
    const sb: SubBaseLike = {
      id: "all",
      name: "All",
      filter: { conjunction: "and", conditions: [] },
    };
    expect(partitionFrame(makeFrame(), sb).records).toHaveLength(3);
  });

  test("filters records by single condition", () => {
    const sb: SubBaseLike = {
      id: "exp",
      name: "Expenses",
      filter: {
        conjunction: "and",
        conditions: [{ field: "type", operator: "is", value: "expense", enabled: true }],
      },
    };
    const out = partitionFrame(makeFrame(), sb);
    expect(out.records.map((r) => r.id)).toEqual(["b.md", "c.md"]);
  });
});

describe("SubBaseCanvas — deriveSubBaseItems", () => {
  test("undefined sub-base + empty config produces all rows with name fallback", () => {
    const items = deriveSubBaseItems(makeFrame(), undefined, { fields: [] });
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toBe("Alpha");
  });

  test("filters via active sub-base then projects fields", () => {
    const sb: SubBaseLike = {
      id: "exp",
      name: "Expenses",
      filter: {
        conjunction: "and",
        conditions: [{ field: "type", operator: "is", value: "expense", enabled: true }],
      },
    };
    const items = deriveSubBaseItems(makeFrame(), sb, { fields: ["amount"] });
    expect(items.map((i) => i.id)).toEqual(["b.md", "c.md"]);
    expect(items[0]?.fields).toEqual([{ name: "amount", value: 25 }]);
  });

  test("respects limit", () => {
    const items = deriveSubBaseItems(makeFrame(), undefined, { fields: [], limit: 2 });
    expect(items).toHaveLength(2);
  });
});

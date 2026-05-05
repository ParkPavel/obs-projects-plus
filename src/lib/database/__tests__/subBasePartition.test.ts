import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import {
  compareValues,
  getPartition,
  partitionBySubBases,
} from "../subBasePartition";
import { createSubBase } from "../subBase";

function rec(id: string, values: Record<string, unknown>): DataRecord {
  return { id, values: values as DataRecord["values"] };
}

const sample: DataFrame = {
  fields: [
    { name: "type", type: "string" } as never,
    { name: "amount", type: "number" } as never,
  ],
  records: [
    rec("a", { type: "budget", amount: 100 }),
    rec("b", { type: "expense", amount: 30 }),
    rec("c", { type: "expense", amount: 50 }),
    rec("d", { type: "note", amount: null }),
  ],
};

describe("partitionBySubBases", () => {
  it("returns one partition per sub-base, filtered independently", () => {
    const budgets = createSubBase("bud", "Budgets", {
      filter: {
        conjunction: "and",
        conditions: [{ field: "type", operator: "is", value: "budget" } as never],
      },
    });
    const expenses = createSubBase("exp", "Expenses", {
      filter: {
        conjunction: "and",
        conditions: [{ field: "type", operator: "is", value: "expense" } as never],
      },
    });
    const out = partitionBySubBases(sample, [budgets, expenses]);
    expect(out.size).toBe(2);
    expect(out.get("bud")?.frame.records.map((r) => r.id)).toEqual(["a"]);
    expect(out.get("exp")?.frame.records.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("returns the full frame when filter is empty", () => {
    const all = createSubBase("all", "All");
    const out = partitionBySubBases(sample, [all]);
    expect(out.get("all")?.frame.records.length).toBe(sample.records.length);
  });

  it("applies sub-base sort when criteria are enabled", () => {
    const sorted = createSubBase("s", "Sorted", {
      sort: {
        criteria: [{ field: "amount", order: "desc", enabled: true }],
      },
    });
    const out = partitionBySubBases(sample, [sorted]);
    const ids = out.get("s")?.frame.records.map((r) => r.id);
    // amount: 100, 50, 30, null  →  a, c, b, d
    expect(ids).toEqual(["a", "c", "b", "d"]);
  });

  it("ignores sort when no criteria are enabled", () => {
    const sorted = createSubBase("s", "Sorted", {
      sort: {
        criteria: [{ field: "amount", order: "desc", enabled: false }],
      },
    });
    const out = partitionBySubBases(sample, [sorted]);
    expect(out.get("s")?.frame.records.map((r) => r.id)).toEqual(
      sample.records.map((r) => r.id),
    );
  });
});

describe("compareValues", () => {
  it("sorts numbers numerically", () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(2, 1)).toBeGreaterThan(0);
  });
  it("places null/undefined after defined", () => {
    expect(compareValues(null, 1)).toBeGreaterThan(0);
    expect(compareValues(1, null)).toBeLessThan(0);
    expect(compareValues(null, null)).toBe(0);
  });
  it("compares booleans (false < true)", () => {
    expect(compareValues(false, true)).toBeLessThan(0);
  });
  it("falls back to localeCompare for strings", () => {
    expect(compareValues("a", "b")).toBeLessThan(0);
  });
});

describe("getPartition", () => {
  it("returns the partition or null", () => {
    const sb = createSubBase("x", "X");
    const map = partitionBySubBases(sample, [sb]);
    expect(getPartition(map, "x")?.subBase.name).toBe("X");
    expect(getPartition(map, "ghost")).toBeNull();
  });
});

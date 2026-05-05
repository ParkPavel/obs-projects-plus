/**
 * Tests for cross-SubBase relation resolver (REFACTOR-204).
 *
 * Covers the three scenarios named in the ticket:
 *   - same-base       (resolveWithinBase)
 *   - cross-SubBase   (resolveAcrossSubBases — both directions)
 *   - cross-base      (sanity check that an unresolved link is dropped,
 *                       leaving the cross-project resolver responsible)
 */

import {
  buildParentIndex,
  resolveAcrossSubBases,
  resolveTargets,
  resolveWithinBase,
} from "../crossSubBase";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { createSubBase, EMPTY_FILTER } from "src/lib/database/subBase";
import type { FilterDefinition } from "src/settings/base/settings";

function rec(id: string, values: Record<string, unknown>): DataRecord {
  return { id, values: values as DataRecord["values"] };
}

function frame(records: DataRecord[]): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "type", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
    ],
    records,
  };
}

const parent = frame([
  rec("Parent/Budget A.md", { name: "Budget A", type: "budget" }),
  rec("Parent/Budget B.md", { name: "Budget B", type: "budget" }),
  rec("Parent/Expense 1.md", { name: "Expense 1", type: "expense" }),
  rec("Parent/Expense 2.md", { name: "Expense 2", type: "expense" }),
]);

const filterByType = (value: string): FilterDefinition => ({
  conjunction: "and",
  conditions: [
    { field: "type", operator: "is", value, enabled: true },
  ],
});

const budgets = createSubBase("budgets", "Budgets", { filter: filterByType("budget") });
const expenses = createSubBase("expenses", "Expenses", { filter: filterByType("expense") });
const everything = createSubBase("all", "All", { filter: EMPTY_FILTER });

describe("crossSubBase / buildParentIndex", () => {
  it("indexes by display name and basename", () => {
    const idx = buildParentIndex(parent);
    expect(idx.get("budget a")?.id).toBe("Parent/Budget A.md");
    expect(idx.get("expense 1")?.id).toBe("Parent/Expense 1.md");
  });

  it("returns an empty index for an empty frame", () => {
    expect(buildParentIndex(frame([])).size).toBe(0);
  });
});

describe("crossSubBase / resolveTargets", () => {
  const idx = buildParentIndex(parent);

  it("resolves a single wikilink string", () => {
    const r = resolveTargets("[[Budget A]]", idx);
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe("Parent/Budget A.md");
  });

  it("resolves an array of wikilinks", () => {
    const r = resolveTargets(["[[Expense 1]]", "[[Expense 2]]"], idx);
    expect(r.map((x) => x.id)).toEqual([
      "Parent/Expense 1.md",
      "Parent/Expense 2.md",
    ]);
  });

  it("ignores wikilink alias suffix", () => {
    const r = resolveTargets("[[Budget A|Aliased]]", idx);
    expect(r[0]!.id).toBe("Parent/Budget A.md");
  });

  it("drops unresolved links silently (cross-base case)", () => {
    expect(resolveTargets("[[Other Project Item]]", idx)).toEqual([]);
  });

  it("returns [] for null / undefined", () => {
    expect(resolveTargets(null, idx)).toEqual([]);
    expect(resolveTargets(undefined, idx)).toEqual([]);
  });
});

describe("crossSubBase / resolveWithinBase (same-base)", () => {
  it("resolves the same as resolveTargets when caller passes the parent frame", () => {
    const r = resolveWithinBase(["[[Budget A]]", "[[Budget B]]"], parent);
    expect(r.map((x) => x.id)).toEqual([
      "Parent/Budget A.md",
      "Parent/Budget B.md",
    ]);
  });
});

describe("crossSubBase / resolveAcrossSubBases", () => {
  it("partitions resolved targets by SubBase filter", () => {
    const out = resolveAcrossSubBases(
      ["[[Budget A]]", "[[Expense 1]]"],
      parent,
      [budgets, expenses],
    );
    expect(out).toHaveLength(2);
    expect(out[0]!.subBaseId).toBe("budgets");
    expect(out[0]!.targets.map((r) => r.id)).toEqual(["Parent/Budget A.md"]);
    expect(out[1]!.subBaseId).toBe("expenses");
    expect(out[1]!.targets.map((r) => r.id)).toEqual(["Parent/Expense 1.md"]);
  });

  it("handles a target visible in multiple SubBases (overlap)", () => {
    const out = resolveAcrossSubBases(
      "[[Budget A]]",
      parent,
      [budgets, everything],
    );
    expect(out[0]!.targets).toHaveLength(1);
    expect(out[1]!.targets).toHaveLength(1);
  });

  it("returns empty target lists for every SubBase when nothing resolves", () => {
    const out = resolveAcrossSubBases(
      "[[Nothing Here]]",
      parent,
      [budgets, expenses],
    );
    expect(out.map((x) => x.targets.length)).toEqual([0, 0]);
  });

  it("filters out targets that don't belong to the queried SubBase (cross-SubBase)", () => {
    // Source claims to relate to a Budget, but caller filters by Expenses.
    const out = resolveAcrossSubBases(
      "[[Budget A]]",
      parent,
      [expenses],
    );
    expect(out[0]!.targets).toEqual([]);
  });

  it("accepts a pre-built index for memoised callers", () => {
    const idx = buildParentIndex(parent);
    const out = resolveAcrossSubBases("[[Budget A]]", parent, [budgets], idx);
    expect(out[0]!.targets).toHaveLength(1);
  });
});

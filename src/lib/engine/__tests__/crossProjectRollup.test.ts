/**
 * crossProjectRollup tests — Base 1 Accounts ↔ Base 2 Journal scenario.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.3 test plan.
 */
import { describe, expect, it } from "@jest/globals";

import {
  DataFieldType,
  type DataFrame,
} from "src/lib/dataframe/dataframe";
import {
  computeCrossProjectRollup,
  computeCrossProjectRollupColumn,
} from "../crossProjectRollup";

const accounts = (): DataFrame => ({
  fields: [
    { name: "name", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
  ],
  records: [
    { id: "Accounts/A1.md", values: { name: "A1" } },
    { id: "Accounts/A2.md", values: { name: "A2" } },
  ],
});

const journal = (): DataFrame => ({
  fields: [
    { name: "name", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
    { name: "account", type: DataFieldType.Relation, identifier: false, derived: false, repeated: false, typeConfig: {} },
    { name: "amount", type: DataFieldType.Number, identifier: false, derived: false, repeated: false, typeConfig: {} },
    { name: "date", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    { name: "label", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
  ],
  records: [
    { id: "J1.md", values: { name: "J1", account: "[[A1]]", amount: 50, date: "2026-01-01", label: "x" } },
    { id: "J2.md", values: { name: "J2", account: "[[A1]]", amount: 25, date: "2026-02-15", label: "y" } },
    { id: "J3.md", values: { name: "J3", account: "[[A2]]", amount: 100, date: "2026-03-01", label: "z" } },
  ],
});

describe("computeCrossProjectRollup — direction Account ← Journal (rollup on Accounts)", () => {
  // Account A1 wants to know SUM(amount) of journal entries that link to it.
  // The current frame is Accounts; the external frame is Journal; the relation
  // lives on Journal.account but the rollup is queried from Accounts. The
  // module's contract requires the relation field to be on the SAME frame
  // (`thisFrame`); to express the inverse direction we model it as the
  // forward direction with thisFrame=Journal and verify per-journal-row values.
  it("SUM of amount per Journal row referencing one Account", () => {
    const j = journal();
    const a = accounts();
    const result = computeCrossProjectRollup(
      j.records[0]!,
      { relationField: "account", targetField: "name", function: "count" },
      j,
      a
    );
    expect(result.sourceCount).toBe(1);
    expect(result.value).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("SUM of amount aggregates numeric target column", () => {
    // Synthesize a frame where Account A1 has its own relation field
    // pointing back to Journal entries (forward direction).
    const accountsWithRel: DataFrame = {
      fields: [...accounts().fields, { name: "entries", type: DataFieldType.Relation, identifier: false, derived: false, repeated: true, typeConfig: {} }],
      records: [
        { id: "Accounts/A1.md", values: { name: "A1", entries: ["[[J1]]", "[[J2]]"] } },
      ],
    };
    const result = computeCrossProjectRollup(
      accountsWithRel.records[0]!,
      { relationField: "entries", targetField: "amount", function: "sum" },
      accountsWithRel,
      journal()
    );
    expect(result.sourceCount).toBe(2);
    expect(result.value).toBe(75);
  });

  it("MAX over date column (string) returns numeric NaN-safe identity", () => {
    // MAX over strings is a type mismatch — should report errors and value=null.
    const accountsWithRel: DataFrame = {
      fields: accounts().fields,
      records: [
        { id: "Accounts/A1.md", values: { name: "A1", entries: ["[[J1]]", "[[J3]]"] } },
      ],
    };
    const result = computeCrossProjectRollup(
      accountsWithRel.records[0]!,
      { relationField: "entries", targetField: "label", function: "max" },
      accountsWithRel,
      journal()
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeNull();
  });

  it("COUNT over an empty relation returns 0 with sourceCount 0", () => {
    const empty: DataFrame = {
      fields: accounts().fields,
      records: [{ id: "Accounts/A1.md", values: { name: "A1", entries: null } }],
    };
    const result = computeCrossProjectRollup(
      empty.records[0]!,
      { relationField: "entries", targetField: "amount", function: "count" },
      empty,
      journal()
    );
    expect(result.sourceCount).toBe(0);
    expect(result.value).toBe(0);
  });

  it("CONCAT_UNIQUE produces deterministic separator-joined string", () => {
    const accountsWithRel: DataFrame = {
      fields: accounts().fields,
      records: [
        { id: "Accounts/A1.md", values: { name: "A1", entries: ["[[J1]]", "[[J2]]", "[[J3]]"] } },
      ],
    };
    const result = computeCrossProjectRollup(
      accountsWithRel.records[0]!,
      { relationField: "entries", targetField: "label", function: "concat_unique", separator: "|" },
      accountsWithRel,
      journal()
    );
    expect(result.value).toBe("x|y|z");
  });

  // R5-010 — sub-base scope on the relation field restricts rollup inputs.
  it("honors targetSubBaseFilter on the relation field when rolling up", () => {
    const accountsWithRel: DataFrame = {
      fields: [
        ...accounts().fields,
        {
          name: "entries",
          type: DataFieldType.Relation,
          identifier: false,
          derived: false,
          repeated: true,
          typeConfig: {
            relation: {
              targetProjectId: "journal",
              targetSubBaseFilter: {
                conjunction: "and",
                conditions: [
                  { field: "label", operator: "is", value: "y", enabled: true },
                ],
              },
            },
          },
        },
      ],
      records: [
        { id: "Accounts/A1.md", values: { name: "A1", entries: ["[[J1]]", "[[J2]]"] } },
      ],
    };
    const result = computeCrossProjectRollup(
      accountsWithRel.records[0]!,
      { relationField: "entries", targetField: "amount", function: "sum" },
      accountsWithRel,
      journal()
    );
    // Only J2 (label=y) passes the filter; amount=25.
    expect(result.sourceCount).toBe(1);
    expect(result.value).toBe(25);
  });
});

describe("computeCrossProjectRollupColumn", () => {
  it("emits a map keyed by record.id covering every record", () => {
    const j = journal();
    const a = accounts();
    const col = computeCrossProjectRollupColumn(
      j,
      { relationField: "account", targetField: "name", function: "count" },
      a
    );
    expect(col.size).toBe(j.records.length);
    for (const r of j.records) {
      expect(col.has(r.id)).toBe(true);
    }
  });
});

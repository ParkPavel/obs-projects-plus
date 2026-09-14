/**
 * crossProjectResolver tests — §A.2 PDF-schema scenario:
 * "Base 1 Accounts ↔ Base 2 Journal".
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.2 test plan.
 */
import { describe, expect, it } from "@jest/globals";

import {
  DataFieldType,
  type DataField,
  type DataFrame,
  type DataRecord,
} from "src/lib/dataframe/dataframe";
import {
  derivedFieldName,
  enrichFrameWithAllRelations,
  enrichFrameWithRelations,
  isRelationCompanionField,
  normalizeRelationValue,
  resolveCrossProjectRelations,
} from "../crossProjectResolver";

const accountsFrame = (): DataFrame => ({
  fields: [
    { name: "name", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
    { name: "balance", type: DataFieldType.Number, identifier: false, derived: false, repeated: false, typeConfig: {} },
  ],
  records: [
    { id: "Accounts/Account 1.md", values: { name: "Account 1", balance: 100 } },
    { id: "Accounts/Account 2.md", values: { name: "Account 2", balance: 250 } },
  ],
});

const journalFrame = (): DataFrame => ({
  fields: [
    { name: "name", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
    {
      name: "account",
      type: DataFieldType.Relation,
      identifier: false,
      derived: false,
      repeated: false,
      typeConfig: { relation: { targetProjectId: "accounts" } },
    },
    { name: "amount", type: DataFieldType.Number, identifier: false, derived: false, repeated: false, typeConfig: {} },
  ],
  records: [
    { id: "Journal/J1.md", values: { name: "J1", account: "[[Account 1]]", amount: 50 } },
    { id: "Journal/J2.md", values: { name: "J2", account: ["[[Account 1]]", "[[Account 2|alias]]"], amount: 75 } },
    { id: "Journal/J3.md", values: { name: "J3", account: null, amount: 0 } },
    { id: "Journal/J4.md", values: { name: "J4", account: "[[Missing Account]]", amount: 5 } },
  ],
});

describe("normalizeRelationValue", () => {
  it("strips brackets from a single string", () => {
    expect(normalizeRelationValue("[[Foo]]")).toEqual(["Foo"]);
  });

  it("drops alias suffix `|`", () => {
    expect(normalizeRelationValue("[[Foo|Bar]]")).toEqual(["Foo"]);
  });

  it("normalizes arrays element-wise", () => {
    expect(normalizeRelationValue(["[[A]]", "[[B|x]]"])).toEqual(["A", "B"]);
  });

  it("returns empty array for null/undefined/non-relation values", () => {
    expect(normalizeRelationValue(null)).toEqual([]);
    expect(normalizeRelationValue(undefined)).toEqual([]);
    expect(normalizeRelationValue(42)).toEqual([]);
  });

  it("accepts already-normalized plain strings", () => {
    expect(normalizeRelationValue("Foo")).toEqual(["Foo"]);
  });
});

describe("resolveCrossProjectRelations", () => {
  it("resolves a single wiki-link to one record", () => {
    const journal = journalFrame();
    const j1 = journal.records[0]!;
    const out = resolveCrossProjectRelations(j1, "account", accountsFrame());
    expect(out).toHaveLength(1);
    expect(out[0]?.values["name"]).toBe("Account 1");
  });

  it("resolves a multi-link list, preserving order", () => {
    const journal = journalFrame();
    const j2 = journal.records[1]!;
    const out = resolveCrossProjectRelations(j2, "account", accountsFrame());
    expect(out.map((r) => r.values["name"])).toEqual(["Account 1", "Account 2"]);
  });

  it("returns empty array for null value", () => {
    const journal = journalFrame();
    const j3 = journal.records[2]!;
    expect(resolveCrossProjectRelations(j3, "account", accountsFrame())).toEqual([]);
  });

  it("silently drops unmatched links", () => {
    const journal = journalFrame();
    const j4 = journal.records[3]!;
    expect(resolveCrossProjectRelations(j4, "account", accountsFrame())).toEqual([]);
  });

  it("uses displayField when provided", () => {
    const ext: DataFrame = {
      fields: [
        { name: "code", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
      ],
      records: [
        { id: "Misc/A.md", values: { code: "A-001" } },
      ],
    };
    const r: DataRecord = { id: "x", values: { rel: "[[A-001]]" } };
    const out = resolveCrossProjectRelations(r, "rel", ext, "code");
    expect(out).toHaveLength(1);
    expect(out[0]?.values["code"]).toBe("A-001");
  });
});

describe("enrichFrameWithRelations", () => {
  it("adds __resolved__<field> to each record", () => {
    const enriched = enrichFrameWithRelations(
      journalFrame(),
      "account",
      { targetProjectId: "accounts" },
      accountsFrame()
    );
    const derived = derivedFieldName("account");
    const j1 = enriched.records[0]!;
    const resolved = j1.values[derived] as unknown as DataRecord[];
    expect(Array.isArray(resolved)).toBe(true);
    expect(resolved[0]?.values["name"]).toBe("Account 1");
  });

  it("registers the derived field with derived:true", () => {
    const enriched = enrichFrameWithRelations(
      journalFrame(),
      "account",
      { targetProjectId: "accounts" },
      accountsFrame()
    );
    const derived: DataField | undefined = enriched.fields.find(
      (f) => f.name === derivedFieldName("account")
    );
    expect(derived).toBeDefined();
    expect(derived?.derived).toBe(true);
  });

  // R5-010 — sub-base scoped relation
  it("honors targetSubBaseFilter to restrict resolved targets", () => {
    const enriched = enrichFrameWithRelations(
      journalFrame(),
      "account",
      {
        targetProjectId: "accounts",
        targetSubBaseFilter: {
          conjunction: "and",
          conditions: [
            { field: "balance", operator: "gt", value: "150", enabled: true },
          ],
        },
      },
      accountsFrame()
    );
    const derived = derivedFieldName("account");
    const j2 = enriched.records[1]!;
    const resolved = j2.values[derived] as unknown as DataRecord[];
    // J2 originally references Account 1 (100) and Account 2 (250).
    // Filter `balance > 150` keeps only Account 2.
    expect(resolved.map((r) => r.values["name"])).toEqual(["Account 2"]);
  });
});

describe("enrichFrameWithAllRelations", () => {
  it("enriches every relation field present in fieldConfig", () => {
    const enriched = enrichFrameWithAllRelations(
      journalFrame(),
      new Map([["accounts", accountsFrame()]])
    );
    const derived = derivedFieldName("account");
    const j2 = enriched.records[1]!;
    const resolved = j2.values[derived] as unknown as DataRecord[];
    expect(resolved.map((r) => r.values["name"])).toEqual([
      "Account 1",
      "Account 2",
    ]);
  });

  it("skips relation fields whose target frame is missing (no throw)", () => {
    expect(() =>
      enrichFrameWithAllRelations(journalFrame(), new Map())
    ).not.toThrow();
  });
});

describe("isRelationCompanionField", () => {
  it("recognizes the __resolved__ prefix this module owns", () => {
    expect(isRelationCompanionField(derivedFieldName("account"))).toBe(true);
  });

  it("does not flag an ordinary field name", () => {
    expect(isRelationCompanionField("account")).toBe(false);
  });

  // A Formula field is also `derived: true` (applyFormulaFields.ts), so
  // `derived` cannot be the filter a picker uses — only the __resolved__
  // prefix identifies an engine companion.
  it("lets a derived Formula field survive the filter that removes companions", () => {
    const fields: DataField[] = [
      { name: "account", type: DataFieldType.Relation, identifier: false, derived: false, repeated: false, typeConfig: {} },
      { name: derivedFieldName("account"), type: DataFieldType.Relation, identifier: false, derived: true, repeated: true, typeConfig: {} },
      { name: "total", type: DataFieldType.Formula, identifier: false, derived: true, repeated: false, typeConfig: {} },
    ];
    const pickable = fields.filter((f) => !isRelationCompanionField(f.name));
    expect(pickable.map((f) => f.name)).toEqual(["account", "total"]);
  });
});

describe("the reserved namespace (#158)", () => {
  test("a user property named like a companion is recognised as one", () => {
    // The product hides companions, so a field a user named this way would
    // vanish from their own table. Creating one is refused in the field
    // dialog; this pins the predicate that refusal leans on.
    expect(isRelationCompanionField("__resolved__vendor")).toBe(true);
    expect(isRelationCompanionField("vendor")).toBe(false);
  });
});

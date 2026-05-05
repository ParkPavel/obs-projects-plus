/**
 * Two-project integration test for cross-project enrichment (Stage A / M0.4).
 *
 * Validates the engine pipeline that View.svelte assembles:
 *   1. enrichFrameWithAllRelations populates `__resolved__<field>` derived
 *      columns for every relation field in fieldConfig.
 *   2. computeCrossProjectRollupColumn produces a per-record rollup column.
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.4 test plan.
 *
 * Note: this test exercises the engine layer composition directly. The
 * `collectReferencedSourceIds` extension is tested implicitly by A.5b/A.7
 * suites that drive the full canvas; here we cover the data-shape contract.
 */
import { describe, expect, it } from "@jest/globals";

import {
  DataFieldType,
  type DataFrame,
} from "src/lib/dataframe/dataframe";
import {
  derivedFieldName,
  enrichFrameWithAllRelations,
} from "src/lib/engine/crossProjectResolver";
import { computeCrossProjectRollupColumn } from "src/lib/engine/crossProjectRollup";

describe("twoProjects integration — Accounts ↔ Journal", () => {
  const accounts: DataFrame = {
    fields: [
      { name: "name", type: DataFieldType.String, identifier: true, derived: false, repeated: false, typeConfig: {} },
    ],
    records: [
      { id: "Acc/A1.md", values: { name: "A1" } },
      { id: "Acc/A2.md", values: { name: "A2" } },
    ],
  };

  const journal: DataFrame = {
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
      { id: "J/1.md", values: { name: "J1", account: "[[A1]]", amount: 30 } },
      { id: "J/2.md", values: { name: "J2", account: "[[A2]]", amount: 70 } },
    ],
  };

  it("enrichFrameWithAllRelations populates __resolved__<field>", () => {
    const enriched = enrichFrameWithAllRelations(
      journal,
      new Map([["accounts", accounts]])
    );
    const derived = derivedFieldName("account");
    const j1 = enriched.records[0]!;
    const resolved = j1.values[derived] as unknown as DataFrame["records"];
    expect(resolved[0]?.values["name"]).toBe("A1");
    // Schema reflects the derived field.
    expect(enriched.fields.find((f) => f.name === derived)?.derived).toBe(true);
  });

  it("computeCrossProjectRollupColumn covers every record id", () => {
    const col = computeCrossProjectRollupColumn(
      journal,
      { relationField: "account", targetField: "name", function: "count" },
      accounts
    );
    expect(col.get("J/1.md")?.value).toBe(1);
    expect(col.get("J/2.md")?.value).toBe(1);
  });

  it("missing target frame leaves frame untouched (no throw)", () => {
    const enriched = enrichFrameWithAllRelations(journal, new Map());
    expect(enriched.fields.length).toBe(journal.fields.length);
  });
});

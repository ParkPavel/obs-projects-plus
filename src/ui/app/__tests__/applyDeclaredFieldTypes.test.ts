/**
 * applyDeclaredFieldTypes — a field the user explicitly configured as a
 * relation (via "Настроить поле" → fieldConfig.relation.targetProjectId)
 * must read as Relation everywhere the frame is inspected, whatever its
 * inferred type was.
 *
 * The bug this pins: `client` held one `[[wikilink]]`, which
 * `detectCellType` (Stage A.9) deliberately infers as String so the
 * derived `name` field's alias encoding keeps rendering. Nothing applied
 * the user's explicit choice afterwards, so the schema list, the header
 * tooltip and the rollup relation picker all disagreed with what the user
 * set. This function is the reconciliation point, run on the frame in
 * `View.svelte` before enrichment.
 */
import { describe, expect, it } from "@jest/globals";
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyDeclaredFieldTypes, type FieldConfigRelationMap } from "../viewHelpers";

function frameWith(fields: DataFrame["fields"]): DataFrame {
  return { fields, records: [] };
}

describe("applyDeclaredFieldTypes", () => {
  it("promotes a single-wikilink String field to Relation when fieldConfig declares it", () => {
    const frame = frameWith([
      { name: "client", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ]);
    const fieldConfig: FieldConfigRelationMap = {
      client: { relation: { targetProjectId: "clients-158-v2" } },
    };

    const result = applyDeclaredFieldTypes(frame, fieldConfig);

    expect(result.fields[0]?.type).toBe(DataFieldType.Relation);
  });

  it("promotes an array-valued relation field the same way", () => {
    const frame = frameWith([
      { name: "clients", type: DataFieldType.String, identifier: false, derived: false, repeated: true, typeConfig: {} },
    ]);
    const fieldConfig: FieldConfigRelationMap = {
      clients: { relation: { targetProjectId: "clients-158-v2" } },
    };

    const result = applyDeclaredFieldTypes(frame, fieldConfig);

    expect(result.fields[0]?.type).toBe(DataFieldType.Relation);
  });

  it("leaves an unconfigured single-wikilink field's inferred type alone — the #A.9 rule", () => {
    // `name` is the field whose `[[fullpath|basename]]` encoding depends on
    // staying String; nobody configured it as a relation here.
    const frame = frameWith([
      { name: "name", type: DataFieldType.String, identifier: true, derived: true, repeated: false, typeConfig: {} },
    ]);

    const result = applyDeclaredFieldTypes(frame, { client: { relation: { targetProjectId: "p2" } } });

    expect(result.fields[0]?.type).toBe(DataFieldType.String);
  });

  it("leaves a field alone when fieldConfig has no entry for it at all", () => {
    const frame = frameWith([
      { name: "notes", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ]);

    const result = applyDeclaredFieldTypes(frame, {});

    expect(result.fields[0]?.type).toBe(DataFieldType.String);
  });

  it("leaves a field alone when its fieldConfig entry has no targetProjectId (relation not fully set up)", () => {
    const frame = frameWith([
      { name: "client", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ]);

    const result = applyDeclaredFieldTypes(frame, { client: { relation: { targetProjectId: "" } } });

    expect(result.fields[0]?.type).toBe(DataFieldType.String);
  });

  it("returns the frame unchanged (same reference) when fieldConfig is undefined", () => {
    const frame = frameWith([
      { name: "client", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ]);

    expect(applyDeclaredFieldTypes(frame, undefined)).toBe(frame);
  });

  it("returns the frame unchanged (same reference) when nothing needed promotion", () => {
    const frame = frameWith([
      { name: "notes", type: DataFieldType.String, identifier: false, derived: false, repeated: false, typeConfig: {} },
    ]);

    expect(applyDeclaredFieldTypes(frame, { other: { relation: { targetProjectId: "p2" } } })).toBe(frame);
  });

  it("is a no-op for a field already typed Relation (e.g. auto-detected array of wikilinks)", () => {
    const frame = frameWith([
      { name: "accounts", type: DataFieldType.Relation, identifier: false, derived: false, repeated: true, typeConfig: {} },
    ]);

    const result = applyDeclaredFieldTypes(frame, { accounts: { relation: { targetProjectId: "p2" } } });

    expect(result.fields[0]?.type).toBe(DataFieldType.Relation);
  });
});

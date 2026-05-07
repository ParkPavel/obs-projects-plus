/**
 * viewHelpers — pure utility tests (R5-014).
 *
 * Covers extractRelationTargetIds and getRecordColor which were
 * extracted from View.svelte reactive statements for testability.
 */

import { describe, expect, it, jest } from "@jest/globals";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { ColorFilterDefinition, FilterCondition } from "src/settings/base/settings";
import {
  extractRelationTargetIds,
  getRecordColor,
  type FieldConfigRelationMap,
} from "./viewHelpers";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRecord(values: Record<string, unknown> = {}, id = "note.md"): DataRecord {
  return { id, values: values as DataRecord["values"] };
}

function makeCond(field: string, value = ""): FilterCondition {
  return { field, operator: "is", value, enabled: true } as FilterCondition;
}

// ── extractRelationTargetIds ──────────────────────────────────────────────────

describe("extractRelationTargetIds", () => {
  it("returns empty array when fieldConfig is undefined", () => {
    expect(extractRelationTargetIds("p1", undefined)).toEqual([]);
  });

  it("returns empty array when fieldConfig is empty", () => {
    expect(extractRelationTargetIds("p1", {})).toEqual([]);
  });

  it("extracts relation targetProjectId from a single field", () => {
    const fc: FieldConfigRelationMap = {
      myRelation: { relation: { targetProjectId: "p2", displayField: "name" } },
    };
    expect(extractRelationTargetIds("p1", fc)).toEqual(["p2"]);
  });

  it("extracts rollup targetProjectId from a single field", () => {
    const fc: FieldConfigRelationMap = {
      count: {
        rollup: {
          relationField: "myRelation",
          targetProjectId: "p3",
          targetField: "name",
          function: "count",
        },
      },
    };
    expect(extractRelationTargetIds("p1", fc)).toEqual(["p3"]);
  });

  it("deduplicates when multiple fields reference the same target", () => {
    const fc: FieldConfigRelationMap = {
      a: { relation: { targetProjectId: "p2" } },
      b: { relation: { targetProjectId: "p2" } },
    };
    expect(extractRelationTargetIds("p1", fc)).toEqual(["p2"]);
  });

  it("excludes self-references (targetProjectId === own project id)", () => {
    const fc: FieldConfigRelationMap = {
      self: { relation: { targetProjectId: "p1" } },
    };
    expect(extractRelationTargetIds("p1", fc)).toEqual([]);
  });

  it("returns result sorted alphabetically for stable reactive key comparison", () => {
    const fc: FieldConfigRelationMap = {
      a: { relation: { targetProjectId: "p3" } },
      b: { relation: { targetProjectId: "p1-other" } },
      c: { relation: { targetProjectId: "p2" } },
    };
    expect(extractRelationTargetIds("p0", fc)).toEqual(["p1-other", "p2", "p3"]);
  });

  it("collects both relation and rollup targets from the same field", () => {
    const fc: FieldConfigRelationMap = {
      mixed: {
        relation: { targetProjectId: "p2" },
        rollup: {
          relationField: "mixed",
          targetProjectId: "p3",
          targetField: "name",
          function: "count",
        },
      },
    };
    expect(extractRelationTargetIds("p1", fc)).toEqual(["p2", "p3"]);
  });

  it("handles undefined field slot in map without throwing", () => {
    const fc = { broken: undefined } as unknown as FieldConfigRelationMap;
    expect(() => extractRelationTargetIds("p1", fc)).not.toThrow();
    expect(extractRelationTargetIds("p1", fc)).toEqual([]);
  });
});

// ── getRecordColor ────────────────────────────────────────────────────────────

describe("getRecordColor", () => {
  const alwaysMatch = jest.fn((_cond: FilterCondition, _rec: DataRecord) => true) as jest.MockedFunction<
    (condition: FilterCondition, record: DataRecord) => boolean
  >;
  const neverMatch = jest.fn((_cond: FilterCondition, _rec: DataRecord) => false) as jest.MockedFunction<
    (condition: FilterCondition, record: DataRecord) => boolean
  >;

  it("returns null when colorFilter has no conditions", () => {
    const filter: ColorFilterDefinition = { conditions: [] };
    expect(getRecordColor(makeRecord(), filter, alwaysMatch)).toBeNull();
  });

  it("returns the color of the first matching rule", () => {
    const filter: ColorFilterDefinition = {
      conditions: [
        { color: "#ff0000", condition: makeCond("status", "done") },
      ],
    };
    expect(getRecordColor(makeRecord(), filter, alwaysMatch)).toBe("#ff0000");
  });

  it("returns null when no rule matches", () => {
    const filter: ColorFilterDefinition = {
      conditions: [
        { color: "#ff0000", condition: makeCond("status", "done") },
      ],
    };
    expect(getRecordColor(makeRecord(), filter, neverMatch)).toBeNull();
  });

  it("returns the first matching color when multiple rules match", () => {
    const filter: ColorFilterDefinition = {
      conditions: [
        { color: "#ff0000", condition: makeCond("a") },
        { color: "#00ff00", condition: makeCond("b") },
      ],
    };
    expect(getRecordColor(makeRecord(), filter, alwaysMatch)).toBe("#ff0000");
  });

  it("skips disabled rules (enabled === false)", () => {
    const filter: ColorFilterDefinition = {
      conditions: [
        { color: "#ff0000", condition: { ...makeCond("a"), enabled: false } },
        { color: "#00ff00", condition: makeCond("b") },
      ],
    };
    expect(getRecordColor(makeRecord(), filter, alwaysMatch)).toBe("#00ff00");
  });

  it("treats missing enabled flag as true (backward compat)", () => {
    const condWithoutEnabled = { field: "x", operator: "is", value: "" } as FilterCondition;
    const filter: ColorFilterDefinition = {
      conditions: [{ color: "#0000ff", condition: condWithoutEnabled }],
    };
    expect(getRecordColor(makeRecord(), filter, alwaysMatch)).toBe("#0000ff");
  });
});

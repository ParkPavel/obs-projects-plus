/**
 * operatorHelpers test (Stage A / S-step coverage).
 *
 * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5a — every DataFieldType
 * literal must produce a non-empty operator list (was previously falling
 * through to the unary base set for Select/Status/Relation/Formula/Rollup).
 */
import { describe, expect, it } from "@jest/globals";

import { DataFieldType } from "src/lib/dataframe/dataframe";
import { getOperatorsForFieldType } from "../operatorHelpers";

describe("getOperatorsForFieldType — Stage A coverage", () => {
  it("Select includes is/is-not on top of base", () => {
    const ops = getOperatorsForFieldType(DataFieldType.Select);
    expect(ops).toEqual(expect.arrayContaining(["is-empty", "is-not-empty", "is", "is-not"]));
  });

  it("Status includes is/is-not on top of base", () => {
    const ops = getOperatorsForFieldType(DataFieldType.Status);
    expect(ops).toEqual(expect.arrayContaining(["is", "is-not"]));
  });

  it("Relation includes contains/not-contains", () => {
    const ops = getOperatorsForFieldType(DataFieldType.Relation);
    expect(ops).toEqual(
      expect.arrayContaining(["is", "is-not", "contains", "not-contains"])
    );
  });

  it("Formula exposes text-style operators (Stage A baseline)", () => {
    const ops = getOperatorsForFieldType(DataFieldType.Formula);
    expect(ops).toEqual(expect.arrayContaining(["contains", "not-contains"]));
  });

  it("Rollup exposes numeric operators", () => {
    const ops = getOperatorsForFieldType(DataFieldType.Rollup);
    expect(ops).toEqual(expect.arrayContaining(["eq", "neq", "lt", "gt", "lte", "gte"]));
  });

  it("Every DataFieldType literal returns a non-empty list", () => {
    for (const t of Object.values(DataFieldType)) {
      const ops = getOperatorsForFieldType(t);
      expect(ops.length).toBeGreaterThan(0);
    }
  });
});

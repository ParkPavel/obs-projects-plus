/**
 * B5 (3.7.2) — the property flow as in Notion: the type is picked from two
 * groups, a rollup can create its relation on the spot and shows a live
 * example on three records before anything is written.
 */
import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  FIELD_TYPE_GROUPS,
  defaultRollupFunction,
  newRelationFieldName,
  rollupExample,
  ROLLUP_QUICK_FUNCTIONS,
} from "../createFieldFlow";

const rec = (id: string, values: DataRecord["values"]): DataRecord => ({ id, values });

describe("createFieldFlow (B5)", () => {
  it("groups every selectable type: basic, then relations and computations", () => {
    expect(FIELD_TYPE_GROUPS.map((g) => g.id)).toEqual(["basic", "linked"]);
    const linked = FIELD_TYPE_GROUPS[1]!.types.map((t) => t.value);
    expect(linked).toEqual([DataFieldType.Relation, DataFieldType.Rollup, DataFieldType.Formula]);
    const all = FIELD_TYPE_GROUPS.flatMap((g) => g.types);
    expect(all).toHaveLength(11);
    for (const t of all) expect(t.icon).toMatch(/^[a-z0-9-]+$/);
  });

  it("offers the Notion calculations", () => {
    expect(ROLLUP_QUICK_FUNCTIONS).toEqual(["count_total", "sum", "avg", "min", "max", "percent_not_empty", "show_original"]);
  });

  it("a number target defaults to sum, anything else to count", () => {
    const num: DataField = { name: "Оплата", type: DataFieldType.Number, repeated: false, identifier: false, derived: false };
    expect(defaultRollupFunction(num)).toBe("sum");
    expect(defaultRollupFunction({ ...num, type: DataFieldType.String })).toBe("count_total");
    expect(defaultRollupFunction(undefined)).toBe("count_total");
  });

  it("names a new relation after the target project, never clashing", () => {
    expect(newRelationFieldName("Визиты", ["Имя"])).toBe("Визиты");
    expect(newRelationFieldName("Визиты", ["Визиты", "Визиты 2"])).toBe("Визиты 3");
  });

  it("example: sum over the first 3 target records", () => {
    const records = [rec("a", { Оплата: 100 }), rec("b", { Оплата: 250 }), rec("c", { Оплата: null }), rec("d", { Оплата: 999 })];
    const ex = rollupExample(records, "Оплата", "sum");
    expect(ex).not.toBeNull();
    expect(ex!.records).toBe(3);
    expect(ex!.values).toEqual([100, 250, null]);
    expect(ex!.result.value).toBe(350);
    expect(rollupExample([], "Оплата", "sum")).toBeNull();
    expect(rollupExample(records, "", "sum")).toBeNull();
  });
});

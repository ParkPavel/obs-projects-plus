/**
 * tableHeaderOps.test.ts — F2.4 (#074) column-menu config patches.
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import {
  applySortPatch,
  applyHidePatch,
  applyWidthPatch,
  applyCalculatePatch,
  calculateOptions,
  buildHeaderMenuEntries,
} from "../tableHeaderOps";
import type { DataTableConfig } from "../../../types";

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false } as DataField;
}

describe("tableHeaderOps (F2.4)", () => {
  it("applySortPatch replaces criteria and clears legacy sortField", () => {
    const next = applySortPatch({ sortField: "old", sortAsc: true } as DataTableConfig, "mrr", "desc");
    expect(next.sortCriteria).toEqual([{ field: "mrr", order: "desc" }]);
    expect(next.sortField).toBeUndefined();
    expect(applySortPatch(next, "mrr", null).sortCriteria).toEqual([]);
  });

  it("applyHidePatch hides a field preserving other field config", () => {
    const next = applyHidePatch({ fieldConfig: { mrr: { widthRem: 8 } } } as DataTableConfig, "mrr");
    expect(next.fieldConfig?.["mrr"]).toEqual({ widthRem: 8, hide: true });
  });

  it("applyWidthPatch clamps to ≥4rem and rounds to quarter-rem", () => {
    expect(applyWidthPatch(undefined, "x", 1).fieldConfig?.["x"]?.widthRem).toBe(4);
    expect(applyWidthPatch(undefined, "x", 8.13).fieldConfig?.["x"]?.widthRem).toBe(8.25);
  });

  it("applyCalculatePatch toggles aggregations and the footer flag", () => {
    const on = applyCalculatePatch(undefined, "mrr", "sum");
    expect(on.aggregations?.["mrr"]).toBe("sum");
    expect(on.showAggregationRow).toBe(true);
    const off = applyCalculatePatch(on, "mrr", null);
    expect(off.aggregations?.["mrr"]).toBeUndefined();
    expect(off.showAggregationRow).toBe(false);
  });

  it("calculateOptions offers numeric aggregations only for numeric types", () => {
    expect(calculateOptions(field("mrr", DataFieldType.Number))).toContain("sum");
    expect(calculateOptions(field("name", DataFieldType.String))).not.toContain("sum");
  });

  it("buildHeaderMenuEntries omits Hide for the primary column", () => {
    const make = (isPrimary: boolean) =>
      buildHeaderMenuEntries({
        field: field("name", DataFieldType.String),
        isPrimary,
        currentSort: null,
        currentCalc: undefined,
        groupedBy: false,
        t: (_k, d) => d,
        onSort: () => {},
        onHide: () => {},
        onCalculate: () => {},
        onGroup: () => {},
      });
    const titles = (entries: ReturnType<typeof make>) =>
      entries.filter((e) => !("separator" in e)).map((e) => (e as { title: string }).title);
    expect(titles(make(false))).toContain("Hide in view");
    expect(titles(make(true))).not.toContain("Hide in view");
  });
});

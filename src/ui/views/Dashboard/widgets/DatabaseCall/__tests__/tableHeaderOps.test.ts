/**
 * tableHeaderOps.test.ts — F2.4 (#074) column-menu config patches.
 */

import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import {
  applySortPatch,
  applyHidePatch,
  applyWidthPatch,
  applyCalculatePatch,
  calculateOptions,
  buildHeaderMenuEntries,
  optionPools,
  startColumnResize,
} from "../tableHeaderOps";
import type { DataTableConfig } from "../../../types";

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false } as DataField;
}

describe("tableHeaderOps (F2.4)", () => {
  it("tracks and commits column resize in the handle's owner window", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const ownerDocument = iframe.contentDocument!;
    const ownerView = iframe.contentWindow! as Window & typeof globalThis;
    const handle = ownerDocument.createElement("div");
    ownerDocument.body.appendChild(handle);
    const live = jest.fn();
    const commit = jest.fn();
    handle.addEventListener("pointerdown", (event) => {
      startColumnResize(event as PointerEvent, 8, live, commit);
    });
    const dispatch = (target: EventTarget, type: string, x: number) => {
      const event = new ownerView.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x });
      Object.defineProperty(event, "pointerId", { value: 1 });
      target.dispatchEvent(event);
    };

    try {
      dispatch(handle, "pointerdown", 10);
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100 }));
      expect(live).not.toHaveBeenCalled();
      dispatch(ownerView, "pointermove", 42);
      expect(live).toHaveBeenCalledWith(10);
      dispatch(ownerView, "pointerup", 42);
      expect(commit).toHaveBeenCalledWith(10);
    } finally {
      iframe.remove();
    }
  });

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

  it("offers declared and used values for editable string, list and choice fields, excluding templates", () => {
    const records: DataRecord[] = [
      {
        id: "Clients/a.md",
        values: {
          name: "Alice",
          tags: ["warm", "returning"],
          status: "Active",
          computed: 42,
        },
      },
      {
        id: "Templates/client.md",
        values: { name: "Template", tags: ["template-tag"], status: "Template status" },
      },
    ];
    const pools = optionPools(
      [
        { ...field("name", DataFieldType.String), typeConfig: { options: ["Pinned"] } },
        { ...field("tags", DataFieldType.List), typeConfig: { options: ["Priority"] } },
        { ...field("status", DataFieldType.Status), typeConfig: { options: ["Planned"] } },
        field("computed", DataFieldType.Rollup),
      ],
      records,
      { templateFolders: ["Templates"] },
    );

    expect(pools.get("name")).toEqual(["Pinned", "Alice"]);
    expect(pools.get("tags")).toEqual(["Priority", "returning", "warm"]);
    expect(pools.get("status")).toEqual(["Planned", "Active"]);
    expect(pools.has("computed")).toBe(false);
  });
});

import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import { chartEmptyReason } from "../chartEmptyReason";
import type { ChartConfig } from "../../../types";

const f = (name: string, type: DataFieldType): DataField => ({ name, type, repeated: false, derived: false, identifier: false });
const base = (over: Partial<ChartConfig> = {}): ChartConfig => ({
  chartType: "bar",
  xAxis: { property: "status", sortBy: "label", sortOrder: "asc", omitZero: false },
  yAxis: { property: "count", aggregation: "count_total" },
  style: { colorScheme: "auto", height: "medium", showGrid: true, showLabels: true, showLegend: false, showValues: true },
  ...over,
});
const frame = (fields: DataField[], records: DataFrame["records"]): DataFrame => ({ fields, records });
const one = frame([f("status", DataFieldType.String), f("amount", DataFieldType.Number)], [{ id: "a", values: { status: "A", amount: 1 } }]);

describe("chartEmptyReason — an empty chart says what is missing", () => {
  it("no records", () => {
    expect(chartEmptyReason(base(), frame(one.fields, []))?.kind).toBe("no-records");
  });
  it("no X field chosen", () => {
    expect(chartEmptyReason(base({ xAxis: { ...base().xAxis, property: "" } }), one)?.kind).toBe("no-x");
  });
  it("an X field that is not in the source any more", () => {
    const r = chartEmptyReason(base({ xAxis: { ...base().xAxis, property: "old" } }), one);
    expect(r).toEqual({ kind: "missing-field", field: "old" });
  });
  it("a sum when the source has no numeric field → suggest Count", () => {
    const src = frame([f("status", DataFieldType.String)], [{ id: "a", values: { status: "A" } }]);
    const r = chartEmptyReason(base({ yAxis: { property: "status", aggregation: "sum" } }), src);
    expect(r).toEqual({ kind: "no-numeric", field: "status", aggregation: "sum" });
  });
  it("a sum over a text field while a number exists → name the field", () => {
    const r = chartEmptyReason(base({ yAxis: { property: "status", aggregation: "sum" } }), one);
    expect(r).toEqual({ kind: "not-numeric", field: "status", aggregation: "sum" });
  });
  it("scatter needs two numeric fields", () => {
    const r = chartEmptyReason(base({ chartType: "scatter", yAxis: { property: "status", aggregation: "sum" } }), one);
    expect(r?.kind).toBe("scatter-needs-numbers");
  });
  it("every record has an empty X", () => {
    const src = frame(one.fields, [{ id: "a", values: { status: null } }, { id: "b", values: {} }]);
    expect(chartEmptyReason(base(), src)).toEqual({ kind: "x-all-empty", field: "status" });
  });
  it("nothing to explain → null (the generic no-data stays)", () => {
    expect(chartEmptyReason(base(), one)).toBeNull();
  });
});

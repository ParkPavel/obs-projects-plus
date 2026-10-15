import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { suggestChart, resuggestChart } from "../chartSuggest";
import type { ChartConfig } from "../../../types";

const f = (name: string, type: DataFieldType, extra: Partial<DataField> = {}): DataField =>
  ({ name, type, repeated: false, derived: false, identifier: false, ...extra });
const rec = (id: string, values: DataRecord["values"]): DataRecord => ({ id, values });

describe("suggestChart — the type and axes a new chart starts with (Google Sheets-like)", () => {
  it("a select/status category → bars counting records per category", () => {
    const c = suggestChart([f("name", DataFieldType.String, { identifier: true }), f("status", DataFieldType.Status), f("amount", DataFieldType.Number)]);
    expect(c.chartType).toBe("bar");
    expect(c.xAxis.property).toBe("status");
    expect(c.yAxis).toEqual({ property: "count", aggregation: "count_total" });
  });

  it("a text field with few distinct values is a category; one with many is not", () => {
    const records = Array.from({ length: 30 }, (_, i) => rec(`r${i}`, { title: `Note ${i}`, team: i % 3 === 0 ? "A" : "B" }));
    const c = suggestChart([f("title", DataFieldType.String), f("team", DataFieldType.String)], records);
    expect(c.chartType).toBe("bar");
    expect(c.xAxis.property).toBe("team");
  });

  it("a date without a category → a line over time, summing the first number by month", () => {
    const c = suggestChart([f("due", DataFieldType.Date), f("hours", DataFieldType.Number), f("cost", DataFieldType.Number)]);
    expect(c.chartType).toBe("line");
    expect(c.xAxis.property).toBe("due");
    expect(c.xAxis.dateGranularity).toBe("month");
    expect(c.yAxis).toEqual({ property: "hours", aggregation: "sum" });
  });

  it("a date and no number → a line counting records over time", () => {
    const c = suggestChart([f("created", DataFieldType.AutoTime)]);
    expect(c.chartType).toBe("line");
    expect(c.yAxis).toEqual({ property: "count", aggregation: "count_total" });
  });

  it("two numbers and nothing else → a scatter of the first against the second", () => {
    const c = suggestChart([f("hours", DataFieldType.Number), f("cost", DataFieldType.Number)]);
    expect(c.chartType).toBe("scatter");
    expect(c.xAxis.property).toBe("hours");
    expect(c.yAxis.property).toBe("cost");
  });

  it("one number → a single total (KPI) over all records", () => {
    const c = suggestChart([f("cost", DataFieldType.Number)]);
    expect(c.chartType).toBe("number");
    expect(c.xAxis.property).toBe("");
    expect(c.yAxis).toEqual({ property: "cost", aggregation: "sum" });
  });

  it("no usable field → a record count", () => {
    const c = suggestChart([]);
    expect(c.chartType).toBe("number");
    expect(c.yAxis).toEqual({ property: "count", aggregation: "count_total" });
  });

  it("ignores engine relation companions", () => {
    const c = suggestChart([f("__resolved__client", DataFieldType.String), f("cost", DataFieldType.Number)]);
    expect(c.chartType).toBe("number");
  });

  it("re-pick keeps the look, source and follow settings, and drops axis-bound extras", () => {
    const old: ChartConfig = {
      chartType: "pie",
      xAxis: { property: "gone", sortBy: "value", sortOrder: "desc", omitZero: true },
      yAxis: { property: "gone", aggregation: "avg" },
      style: { colorScheme: "accent", height: "large", showGrid: false, showLabels: false, showLegend: true, showValues: false },
      series: [{ id: "s1", property: "gone", aggregation: "sum" }],
      title: "Mine",
    };
    const raw = { ...old, dataProjectId: "p2" } as ChartConfig;
    const next = resuggestChart(raw, [f("status", DataFieldType.Select)]) as ChartConfig & { dataProjectId?: string };
    expect(next.chartType).toBe("bar");
    expect(next.xAxis.property).toBe("status");
    expect(next.style).toEqual(old.style);
    expect(next.title).toBe("Mine");
    expect(next.dataProjectId).toBe("p2");
    expect(next.series).toBeUndefined();
  });
});

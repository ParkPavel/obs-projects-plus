/**
 * Codex review of 08eda4e, the chart half:
 * - an extra series made the primary read only the notes that have its
 *   field, which changed a count_total (2 notes, one with a value → 1);
 * - every empty label was dropped from extra series, also on a categorical
 *   axis where "" is the uncategorised bucket the primary still shows;
 * - axis ticks were rounded to one decimal whatever the scale: 0..0.02 kept
 *   only 0, and a fitted scale could get ticks outside the plot.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { computeMultiSeriesChartData } from "src/lib/dashboard-engine/chartDataPipeline";
import type { ChartConfig } from "src/ui/views/Dashboard/types";
import { axisTicks } from "src/ui/views/Dashboard/widgets/Chart/chartScale";

const num = (name: string) => ({ name, type: DataFieldType.Number, repeated: false, identifier: false, derived: false });
const frame = (rows: Array<Record<string, DataValue>>): DataFrame =>
  ({
    fields: [{ ...num("category"), type: DataFieldType.String }, num("amount"), num("extra")],
    records: rows.map((values, i) => ({ id: `r${i}.md`, values })),
  }) as unknown as DataFrame;

const base: ChartConfig = {
  chartType: "bar",
  xAxis: { property: "category", sortBy: "label", sortOrder: "asc", omitZero: false },
  yAxis: { property: "amount", aggregation: "count_total" },
  style: { colorScheme: "categorical", height: "medium", showGrid: false, showLabels: true, showLegend: true, showValues: false },
  series: [{ id: "e", label: "Extra", property: "extra", aggregation: "sum" }],
};

test("an extra series does not change the primary's count_total", () => {
  const src = frame([{ category: "A", amount: 5, extra: 1 }, { category: "A", extra: 2 }]);
  const out = computeMultiSeriesChartData(src, base, new Map());
  expect(out.series[0]!.values[out.labels.indexOf("A")]).toBe(2);
});

test("the uncategorised bucket keeps the extra series' value on a categorical axis", () => {
  const src = frame([{ category: "", amount: 10, extra: 2 }, { category: "B", amount: 1, extra: 1 }]);
  const cfg: ChartConfig = { ...base, yAxis: { property: "amount", aggregation: "sum" } };
  const out = computeMultiSeriesChartData(src, cfg, new Map());
  const i = out.labels.indexOf("");
  expect(i).toBeGreaterThanOrEqual(0);
  expect(out.series[0]!.values[i]).toBe(10);
  expect(out.series[1]!.values[i]).toBe(2);
});

test("ticks keep the precision of their scale and stay inside it", () => {
  expect(axisTicks({ min: 0, max: 0.02 })).toEqual([0, 0.02]);
  const fitted = { min: 62.77, max: 64.33 };
  for (const t of axisTicks(fitted)) {
    expect(t).toBeGreaterThanOrEqual(fitted.min);
    expect(t).toBeLessThanOrEqual(fitted.max);
  }
});

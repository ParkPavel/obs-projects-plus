/**
 * i3-data — formulas in dependency order, loops left empty, and one answer
 * for a formula column's sum whether a footer or a chart asks.
 */
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { applyFormulaFields, orderFormulaDefs } from "../applyFormulaFields";
import { computeAggregateValue } from "../aggregation";
import { computeChartData } from "../chartDataPipeline";
import type { ChartConfig } from "src/ui/views/Dashboard/types";

const base: DataFrame = {
  fields: [
    { name: "qty", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    { name: "price", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
  ],
  records: [
    { id: "a", values: { qty: 2, price: 10 } },
    { id: "b", values: { qty: 3, price: 7 } },
  ],
};

it("a formula reading a later-created formula is computed after it", () => {
  const out = applyFormulaFields(base, [
    { name: "doubled", expression: "total * 2" },
    { name: "total", expression: "qty * price" },
  ]);
  expect(out.records.map((r) => r.values["doubled"])).toEqual([40, 42]);
});

it("formulas reading each other are left empty, the rest still compute", () => {
  const out = applyFormulaFields(base, [
    { name: "x", expression: "y + 1" },
    { name: "y", expression: "x + 1" },
    { name: "ok", expression: "qty + 1" },
  ]);
  expect(out.records.map((r) => [r.values["x"], r.values["y"], r.values["ok"]])).toEqual([[null, null, 3], [null, null, 4]]);
  expect(orderFormulaDefs([{ name: "x", expression: "y" }, { name: "y", expression: "x" }]).cyclic).toEqual(new Set(["x", "y"]));
});

it("a formula naming itself reads the stored value — no loop", () => {
  expect(orderFormulaDefs([{ name: "qty", expression: "qty + 1" }]).cyclic.size).toBe(0);
});

it("sum / avg / min / max / count of a formula column agree between footer and chart", () => {
  const out = applyFormulaFields(base, [{ name: "total", expression: "qty * price" }]);
  const values = out.records.map((r) => r.values["total"] ?? null);
  const chart = (aggregation: ChartConfig["yAxis"]["aggregation"]) => computeChartData(out, {
    chartType: "number",
    xAxis: { property: "", sortBy: "value", sortOrder: "desc", omitZero: false },
    yAxis: { property: "total", aggregation },
    style: { colorScheme: "auto", height: "medium", showGrid: true, showLabels: true, showLegend: false, showValues: true },
  }).series[0]?.values[0];
  for (const fn of ["sum", "avg", "min", "max", "count_total"] as const) {
    expect(chart(fn)).toBe(Number(computeAggregateValue(values, fn)));
  }
});

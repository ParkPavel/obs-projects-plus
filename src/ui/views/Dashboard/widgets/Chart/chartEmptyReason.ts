import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { ChartConfig, ColumnAggregation } from "../../types";
import { chartAggregations } from "./chartAggregations";

/**
 * 3.7.2 B6 — why a chart has nothing to draw, so the empty state names the
 * missing piece ("No numeric fields to sum — choose Count") instead of a bare
 * "No data". Null when nothing specific is wrong.
 */
export type ChartEmptyReason =
  | { kind: "no-records" }
  | { kind: "no-x" }
  | { kind: "missing-field"; field: string }
  | { kind: "no-numeric"; field: string; aggregation: ColumnAggregation }
  | { kind: "not-numeric"; field: string; aggregation: ColumnAggregation }
  | { kind: "scatter-needs-numbers" }
  | { kind: "x-all-empty"; field: string };

const NUMERIC_ONLY: ReadonlySet<ColumnAggregation> = new Set(["sum", "avg", "min", "max", "median"]);

export function chartEmptyReason(config: ChartConfig, source: DataFrame): ChartEmptyReason | null {
  const has = (name: string) => source.fields.some((f) => f.name === name);
  const numeric = source.fields.filter((f) => chartAggregations(f).includes("sum"));

  if (config.chartType === "scatter") {
    const x = source.fields.find((f) => f.name === config.xAxis.property);
    const y = source.fields.find((f) => f.name === config.yAxis.property);
    const ok = (f: typeof x) => !!f && chartAggregations(f).includes("sum");
    if (!ok(x) || !ok(y)) return { kind: "scatter-needs-numbers" };
  }
  if (source.records.length === 0) return { kind: "no-records" };
  if (config.chartType !== "number" && config.chartType !== "scatter") {
    if (!config.xAxis.property) return { kind: "no-x" };
    if (!has(config.xAxis.property)) return { kind: "missing-field", field: config.xAxis.property };
  }
  const y = config.yAxis.property;
  if (y !== "count") {
    if (!has(y)) return { kind: "missing-field", field: y };
    const agg = config.yAxis.aggregation;
    if (NUMERIC_ONLY.has(agg) && !numeric.some((f) => f.name === y)) {
      return numeric.length === 0 ? { kind: "no-numeric", field: y, aggregation: agg } : { kind: "not-numeric", field: y, aggregation: agg };
    }
  }
  if (config.chartType !== "number" && config.chartType !== "scatter") {
    const x = config.xAxis.property;
    const filled = source.records.some((r) => {
      const v = r.values[x];
      return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    });
    if (!filled) return { kind: "x-all-empty", field: x };
  }
  return null;
}

import type { DataField } from "src/lib/dataframe/dataframe";
import { aggregationOptionsFor } from "src/lib/dashboard-engine/aggregationOptions";
import type { ChartConfig, ColumnAggregation } from "../../types";

// Only operations already offered by the chart and implemented by its pipeline.
const CHART_AGGREGATIONS: readonly ColumnAggregation[] = ["sum", "avg", "min", "max", "median", "count_total", "count_unique"];
export function chartAggregations(field: DataField | undefined): readonly ColumnAggregation[] {
  const allowed = new Set<ColumnAggregation>(field ? aggregationOptionsFor(field) : ["count_total", "count_unique"]);
  return CHART_AGGREGATIONS.filter(value => allowed.has(value));
}

/** Only an explicit field change may reconcile a now-incompatible operation. */
export function chartYAxis(config: Pick<ChartConfig, "yAxis">, property: string, fields: readonly DataField[]): ChartConfig["yAxis"] {
  const allowed = property === "count" ? ["count_total"] : chartAggregations(fields.find(f => f.name === property));
  const aggregation = allowed.includes(config.yAxis.aggregation) ? config.yAxis.aggregation : "count_total";
  return { ...config.yAxis, property, aggregation };
}

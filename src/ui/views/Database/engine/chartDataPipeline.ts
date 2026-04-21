// src/ui/views/Database/engine/chartDataPipeline.ts
// Converts ChartConfig → TransformPipeline → ChartData

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { ChartConfig, ChartData, ChartSeries, ColumnAggregation, ScatterChartConfig, ScatterData, ScatterPoint } from "../types";
import type { TransformPipeline, TransformStep, AggregationFunction } from "./transformTypes";
import { executeTransformCached } from "./transformCache";

/**
 * Map footer ColumnAggregation (lowercase) to pipeline AggregationFunction (UPPERCASE).
 * Not all footer aggregations have pipeline equivalents.
 */
function toAggFn(agg: ColumnAggregation): AggregationFunction {
  const map: Partial<Record<ColumnAggregation, AggregationFunction>> = {
    sum: "SUM",
    avg: "AVG",
    median: "MEDIAN",
    min: "MIN",
    max: "MAX",
    range: "RANGE",
    count: "COUNT",
    count_unique: "COUNT_DISTINCT",
  };
  return map[agg] ?? "SUM";
}

/**
 * Build a TransformPipeline from a ChartConfig.
 * ChartConfig describes what the user wants to see.
 * The pipeline describes how to compute it from raw data.
 */
export function buildChartPipeline(config: ChartConfig): TransformPipeline {
  const steps: TransformStep[] = [];

  // 1. GROUP BY x-axis property
  steps.push({
    type: "group-by",
    fields: [config.xAxis.property],
  });

  // 2. AGGREGATE y-axis (skip for "count" — use _group_size from GROUP BY)
  if (config.yAxis.property !== "count") {
    steps.push({
      type: "aggregate",
      columns: [{
        sourceField: config.yAxis.property,
        outputName: "__chart_value__",
        function: toAggFn(config.yAxis.aggregation),
      }],
    });
  }

  return { steps };
}

/**
 * Execute chart pipeline and transform result into ChartData.
 */
export function computeChartData(
  source: DataFrame,
  config: ChartConfig
): ChartData {
  // Guard: no x-axis field selected → empty chart (not "__empty__" bar)
  if (!config.xAxis.property) {
    return { labels: [], series: [{ name: "", values: [] }] };
  }

  const pipeline = buildChartPipeline(config);
  const result = executeTransformCached(source, pipeline);

  const df = result.data;

  // Extract labels and values
  const xField = config.xAxis.property;
  const valueField = config.yAxis.property === "count" ? "_group_size" : "__chart_value__";
  let entries: { label: string; value: number | null }[] = [];

  for (const record of df.records) {
    const label = String(record.values[xField] ?? "");
    const rawVal = record.values[valueField];
    const value = rawVal != null ? Number(rawVal) : null;

    // Skip zero values if configured
    if (config.xAxis.omitZero && (value === 0 || value === null)) continue;

    // Skip hidden groups
    if (config.xAxis.hiddenGroups?.includes(label)) continue;

    entries.push({ label, value });
  }

  // Sort entries
  if (config.xAxis.sortBy === "value") {
    entries.sort((a, b) => {
      const av = a.value ?? 0;
      const bv = b.value ?? 0;
      return config.xAxis.sortOrder === "asc" ? av - bv : bv - av;
    });
  } else if (config.xAxis.sortBy === "label") {
    entries.sort((a, b) =>
      config.xAxis.sortOrder === "asc"
        ? a.label.localeCompare(b.label, undefined, { numeric: true })
        : b.label.localeCompare(a.label, undefined, { numeric: true })
    );
  }

  // Apply cumulative if configured
  if (config.yAxis.cumulative) {
    let running = 0;
    entries = entries.map((e) => {
      running += e.value ?? 0;
      return { ...e, value: running };
    });
  }

  const labels = entries.map((e) => e.label);
  const values = entries.map((e) => e.value);

  const series: ChartSeries[] = [{
    name: config.yAxis.property === "count" ? "Count" : config.yAxis.property,
    values,
  }];

  return { labels, series };
}

/**
 * Get chart height in pixels from style size.
 */
export function chartHeightPx(height: ChartConfig["style"]["height"]): number {
  switch (height) {
    case "small": return 200;
    case "medium": return 320;
    case "large": return 480;
    default: return 320;
  }
}

/**
 * Compute scatter data from DataFrame using ScatterChartConfig.
 * Extracts (x, y) numeric pairs, computes trend line via least squares, R².
 */
export function computeScatterData(
  source: DataFrame,
  config: ScatterChartConfig
): ScatterData {
  const xField = config.xAxis.field;
  const yField = config.yAxis.field;
  if (!xField || !yField) return { points: [] };

  const points: ScatterPoint[] = [];

  for (const record of source.records) {
    const xRaw = record.values[xField];
    const yRaw = record.values[yField];
    const x = typeof xRaw === "number" ? xRaw : parseFloat(String(xRaw ?? ""));
    const y = typeof yRaw === "number" ? yRaw : parseFloat(String(yRaw ?? ""));
    if (isNaN(x) || isNaN(y)) continue;

    const label = record.id ?? undefined;
    const group = config.colorBy ? String(record.values[config.colorBy] ?? "") : undefined;

    const sizeRaw = config.sizeBy ? record.values[config.sizeBy] : undefined;
    const size = typeof sizeRaw === "number" ? Math.max(2, Math.min(sizeRaw, 20)) : undefined;

    const point: ScatterPoint = {
      x,
      y,
      ...(label !== undefined ? { label } : {}),
      ...(group !== undefined ? { group } : {}),
      ...(size !== undefined ? { size } : {}),
    };
    points.push(point);
  }

  if (points.length < 2) return { points };

  // Compute linear regression (least squares)
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) return { points };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R² = (correlation coefficient)²
  const ssRes = points.reduce((s, p) => {
    const predicted = slope * p.x + intercept;
    return s + (p.y - predicted) ** 2;
  }, 0);
  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    points,
    ...(config.showTrendLine ? { trendLine: { slope, intercept } } : {}),
    ...(config.showR2 ? { r2 } : {}),
  };
}

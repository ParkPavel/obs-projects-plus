import { DataFieldType, type DataField, type DataRecord } from "src/lib/dataframe/dataframe";
import { isRelationCompanionField } from "src/lib/engine/crossProjectResolver";
import type { ChartConfig } from "../../types";

/**
 * 3.7.2 B6 — the chart a source suggests, the way Google Sheets picks one
 * when a range is selected: the user starts from something drawn and adjusts
 * it, instead of assembling type, axes and operation from an empty form.
 *
 * Order of preference:
 *  1. a category (select or status, then text with few distinct values, then yes/no)
 *     → bars, number of records per category;
 *  2. a date → a line over time by month, summing the first number (or counting);
 *  3. two numbers → a scatter of the first against the second;
 *  4. one number → one total (KPI) over every record (no X field);
 *  5. nothing usable → the record count.
 */

/** A text field is a category when it has at most this many distinct values. */
export const CATEGORY_MAX_DISTINCT = 12;

const CATEGORY_TYPES: ReadonlySet<DataFieldType> = new Set([DataFieldType.Select, DataFieldType.Status]);
const DATE_TYPES: ReadonlySet<DataFieldType> = new Set([DataFieldType.Date, DataFieldType.AutoTime]);

const DEFAULT_STYLE: ChartConfig["style"] = {
  colorScheme: "auto",
  height: "medium",
  showGrid: true,
  showLabels: true,
  showLegend: false,
  showValues: true,
};

function distinctCount(name: string, records: readonly DataRecord[]): number {
  const seen = new Set<string>();
  for (const r of records) {
    const v = r.values[name];
    const items = Array.isArray(v) ? v : [v];
    for (const item of items) {
      if (item === null || item === undefined || item === "") continue;
      seen.add(item instanceof Date ? item.toISOString() : String(item));
      if (seen.size > CATEGORY_MAX_DISTINCT) return seen.size;
    }
  }
  return seen.size;
}

function isTextCategory(field: DataField, records: readonly DataRecord[]): boolean {
  if (field.type !== DataFieldType.String && field.type !== DataFieldType.List) return false;
  if (field.identifier) return false;
  // Without records only the type speaks: a plain text field may be a category.
  if (records.length === 0) return field.type === DataFieldType.String;
  const n = distinctCount(field.name, records);
  return n > 0 && n <= CATEGORY_MAX_DISTINCT;
}

export function suggestChart(fields: readonly DataField[], records: readonly DataRecord[] = []): ChartConfig {
  const usable = fields.filter((f) => !isRelationCompanionField(f.name));
  const category =
    usable.find((f) => CATEGORY_TYPES.has(f.type)) ??
    usable.find((f) => isTextCategory(f, records)) ??
    usable.find((f) => f.type === DataFieldType.Boolean);
  const date = usable.find((f) => DATE_TYPES.has(f.type));
  const numbers = usable.filter((f) => f.type === DataFieldType.Number);
  const count = { property: "count", aggregation: "count_total" } as const;
  const x = (property: string): ChartConfig["xAxis"] => ({ property, sortBy: "label", sortOrder: "asc", omitZero: false });

  if (category) return { chartType: "bar", xAxis: x(category.name), yAxis: { ...count }, style: { ...DEFAULT_STYLE } };
  if (date) {
    const first = numbers[0];
    return {
      chartType: "line",
      xAxis: { ...x(date.name), dateGranularity: "month" },
      yAxis: first ? { property: first.name, aggregation: "sum" } : { ...count },
      style: { ...DEFAULT_STYLE },
    };
  }
  if (numbers.length >= 2) {
    return { chartType: "scatter", xAxis: x(numbers[0]!.name), yAxis: { property: numbers[1]!.name, aggregation: "sum" }, style: { ...DEFAULT_STYLE } };
  }
  if (numbers.length === 1) {
    return { chartType: "number", xAxis: x(""), yAxis: { property: numbers[0]!.name, aggregation: "sum" }, style: { ...DEFAULT_STYLE } };
  }
  return { chartType: "number", xAxis: x(""), yAxis: { ...count }, style: { ...DEFAULT_STYLE } };
}

/**
 * "Re-pick from data": a fresh suggestion for type and axes that keeps what
 * the user chose about the look (style, title), the source and the selection
 * it follows. Extra series and status grouping are bound to the old axes and
 * are dropped.
 */
export function resuggestChart(config: ChartConfig, fields: readonly DataField[], records: readonly DataRecord[] = []): ChartConfig {
  const fresh = suggestChart(fields, records);
  const { series: _s, groupMode: _g, chartType: _t, xAxis: _x, yAxis: _y, ...kept } = config;
  void _s; void _g; void _t; void _x; void _y;
  return { ...kept, chartType: fresh.chartType, xAxis: fresh.xAxis, yAxis: fresh.yAxis, style: config.style };
}

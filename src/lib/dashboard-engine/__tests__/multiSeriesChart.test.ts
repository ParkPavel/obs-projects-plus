/**
 * Several lines on one chart, each from its own field, project and axis (3.6.0).
 *
 * The client's weight against training minutes, the wellbeing from visits
 * against the daily tracker's tests, the massage room's income against the
 * studio's payments in personal finances — one chart used to hold one series
 * (calc-charts-map). A chart now carries extra series: each names its field,
 * its aggregation, optionally another project and its x field there, and the
 * axis it is read against. Labels are the union of every series' labels, in
 * time order when the x axis is bucketed by date; a label a series has no
 * value for is a gap (null), never a zero.
 */

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { computeChartData, computeMultiSeriesChartData } from "src/lib/dashboard-engine/chartDataPipeline";
import type { ChartConfig } from "src/ui/views/Dashboard/types";

function frame(rows: Array<Record<string, DataValue>>, types: Record<string, DataFieldType>): DataFrame {
  return {
    fields: Object.entries(types).map(([name, type]) => ({ name, type, repeated: false, identifier: false, derived: false })),
    records: rows.map((values, i) => ({ id: `r${i}.md`, values })),
  } as unknown as DataFrame;
}
const d = (iso: string) => new Date(`${iso}T00:00:00`) as unknown as DataValue;

// The tracker: weight and training minutes by day.
const tracker = frame(
  [
    { date: d("2026-09-01"), weight: 80, minutes: 30 },
    { date: d("2026-09-02"), weight: 79.5, minutes: 45 },
    { date: d("2026-09-03"), weight: 79, minutes: 0 },
  ],
  { date: DataFieldType.Date, weight: DataFieldType.Number, minutes: DataFieldType.Number }
);

// Visits in another project, on days the tracker partly covers.
const visits = frame(
  [
    { day: d("2026-09-02"), wellbeing: 7 },
    { day: d("2026-09-04"), wellbeing: 8 },
  ],
  { day: DataFieldType.Date, wellbeing: DataFieldType.Number }
);

const base: ChartConfig = {
  chartType: "line",
  xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false, dateGranularity: "day" },
  yAxis: { property: "weight", aggregation: "avg" },
  style: { colorScheme: "categorical", height: "medium", showGrid: true, showLabels: true, showLegend: true, showValues: false },
};

describe("computeMultiSeriesChartData", () => {
  test("no extra series: exactly the single-series result", () => {
    expect(computeMultiSeriesChartData(tracker, base, new Map())).toEqual(computeChartData(tracker, base));
  });

  test("a second field of the same project, on the right axis", () => {
    const cfg: ChartConfig = { ...base, series: [{ id: "m", label: "Minutes", property: "minutes", aggregation: "sum", axis: "right" }] };
    const out = computeMultiSeriesChartData(tracker, cfg, new Map());
    expect(out.series).toHaveLength(2);
    expect(out.series[0]!.values).toEqual([80, 79.5, 79]);
    expect(out.series[1]).toMatchObject({ name: "Minutes", axis: "right", values: [30, 45, 0] });
  });

  test("a series from another project: labels are the union in time order, gaps are null", () => {
    const cfg: ChartConfig = {
      ...base,
      series: [{ id: "w", label: "Wellbeing", property: "wellbeing", aggregation: "avg", dataProjectId: "visits", xProperty: "day" }],
    };
    const out = computeMultiSeriesChartData(tracker, cfg, new Map([["visits", visits]]));
    expect(out.labels).toHaveLength(4);
    expect([...out.labels].sort()).toEqual(out.labels);
    expect(out.series[0]!.values).toEqual([80, 79.5, 79, null]);
    expect(out.series[1]!.values).toEqual([null, 7, null, 8]);
  });

  test("a series whose project is not loaded yet is all gaps, not zeros", () => {
    const cfg: ChartConfig = { ...base, series: [{ id: "w", property: "wellbeing", aggregation: "avg", dataProjectId: "visits", xProperty: "day" }] };
    const out = computeMultiSeriesChartData(tracker, cfg, new Map());
    expect(out.series[1]!.values.every((v) => v === null)).toBe(true);
    expect(out.series[1]!.name).toBe("wellbeing");
  });

  test("the primary series is read against the left axis", () => {
    const cfg: ChartConfig = { ...base, series: [{ id: "m", property: "minutes", aggregation: "sum", axis: "right" }] };
    expect(computeMultiSeriesChartData(tracker, cfg, new Map()).series[0]!.axis ?? "left").toBe("left");
  });
});

describe("narrowing each series to a picked record (linked selection)", () => {
  test("the primary is narrowed through its field, each series through its own", () => {
    const seen: Array<string | undefined> = [];
    const narrow = (frame: DataFrame, s?: { selectionField?: string }) => {
      seen.push(s ? s.selectionField : "primary");
      return { ...frame, records: frame.records.slice(0, 1) };
    };
    const cfg: ChartConfig = {
      ...base,
      series: [{ id: "w", property: "wellbeing", aggregation: "avg", dataProjectId: "visits", xProperty: "day", selectionField: "client" }],
    };
    const out = computeMultiSeriesChartData(tracker, cfg, new Map([["visits", visits]]), undefined, narrow);
    expect(seen).toEqual(["primary", "client"]);
    // Only the first record of each source survived the narrowing.
    expect(out.series[0]!.values.filter((v) => v !== null)).toEqual([80]);
    expect(out.series[1]!.values.filter((v) => v !== null)).toEqual([7]);
  });
});

// Scatter correlation (Pillar 5) — computeScatterData with right frame.
import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";
import { computeScatterData } from "src/ui/views/Dashboard/engine/chartDataPipeline";
import type { ScatterChartConfig } from "src/ui/views/Dashboard/types";

function mkFrame(
  fields: Array<[string, DataFieldType]>,
  rows: Array<Record<string, unknown>>
): DataFrame {
  return {
    fields: fields.map(([name, type]) => ({
      name,
      type,
      repeated: false,
      identifier: name === "id",
      derived: false,
    })),
    records: rows.map((r, i) => ({
      id: String(r["id"] ?? `row-${i}`),
      values: r as Record<string, never>,
    })) as unknown as DataFrame["records"],
  };
}

describe("computeScatterData (correlation)", () => {
  const workouts = mkFrame(
    [
      ["id", DataFieldType.String],
      ["date", DataFieldType.Date],
      ["weight", DataFieldType.Number],
    ],
    [
      { id: "w1", date: new Date(2026, 3, 1), weight: 80 },
      { id: "w2", date: new Date(2026, 3, 2), weight: 82 },
      { id: "w3", date: new Date(2026, 3, 3), weight: 85 },
    ]
  );

  const nutrition = mkFrame(
    [
      ["id", DataFieldType.String],
      ["date", DataFieldType.Date],
      ["calories", DataFieldType.Number],
    ],
    [
      { id: "n1", date: new Date(2026, 3, 1), calories: 2200 },
      { id: "n2", date: new Date(2026, 3, 2), calories: 2400 },
      // no entry for 04-03 → w3 is dropped.
    ]
  );

  it("pairs X from left with Y from right on day key", () => {
    const config: ScatterChartConfig = {
      xAxis: { field: "weight" },
      yAxis: { field: "calories" },
      showTrendLine: false,
      showR2: false,
      pointRadius: 3,
      opacity: 1,
      correlation: {
        rightSourceId: "nutrition",
        on: { leftKey: "date", rightKey: "date" },
      },
    };
    const result = computeScatterData(workouts, config, nutrition);
    expect(result.points).toHaveLength(2);
    expect(result.points.map((p) => [p.x, p.y])).toEqual([
      [80, 2200],
      [82, 2400],
    ]);
  });

  it("falls back to single-frame path when correlation is set but rightFrame missing", () => {
    const config: ScatterChartConfig = {
      xAxis: { field: "weight" },
      yAxis: { field: "date" }, // not numeric → all rows rejected
      showTrendLine: false,
      showR2: false,
      pointRadius: 3,
      opacity: 1,
      correlation: {
        rightSourceId: "nutrition",
        on: { leftKey: "date", rightKey: "date" },
      },
    };
    const result = computeScatterData(workouts, config /* no rightFrame */);
    expect(result.points).toEqual([]);
  });

  it("computes trend line on correlated data when requested", () => {
    const config: ScatterChartConfig = {
      xAxis: { field: "weight" },
      yAxis: { field: "calories" },
      showTrendLine: true,
      showR2: true,
      pointRadius: 3,
      opacity: 1,
      correlation: {
        rightSourceId: "nutrition",
        on: { leftKey: "date", rightKey: "date" },
      },
    };
    const result = computeScatterData(workouts, config, nutrition);
    expect(result.trendLine).toBeDefined();
    expect(result.r2).toBeDefined();
  });
});

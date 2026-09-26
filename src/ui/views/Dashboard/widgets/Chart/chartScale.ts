/**
 * chartScale — how a value becomes a height, for every series on every axis.
 *
 * 3.6.0. The line and bar charts scaled 0..max: a negative value (a month
 * that lost money) fell below the plot, a bar of negative height was not
 * drawn at all, and a missing point was drawn as 0 — the line dived to the
 * axis wherever a series had no value, which reads as a measurement. And one
 * scale served every series, so weight in kg and training in minutes could
 * not share a chart.
 *
 * - Every scale includes 0, so the zero line is always inside the plot and a
 *   bar grows from it, up or down.
 * - Series on the right axis get their own scale.
 * - A missing value is a gap: paths break there.
 */

import type { ChartSeries } from "../../types";

export interface AxisScale {
  readonly min: number;
  readonly max: number;
}

/**
 * The scale of a set of values, never zero-height. A bar's length is its
 * value, so bar scales always span 0. A line spans 0 too, unless its data sit
 * far from it — all of one sign, the nearest end more than half the farthest —
 * and then it fits the data with a little room: weight between 62.9 and
 * 64.2 kg drawn on 0..64 is a flat line (live demo check, 2026-09-26), while
 * counts from 0 to 10 keep their zero.
 */
export function axisScale(values: readonly (number | null)[], spanZero = true): AxisScale {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  const farFromZero = (min > 0 && min > max / 2) || (max < 0 && max < min / 2);
  if (spanZero || !farFromZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  } else {
    const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  return min === max ? { min, max: min + 1 } : { min, max };
}

/** One scale for the left axis, one for the right when any series is on it. */
export function seriesScales(
  series: readonly ChartSeries[],
  spanZero = true
): { left: AxisScale; right: AxisScale | null } {
  const right = series.filter((s) => s.axis === "right");
  const left = series.filter((s) => s.axis !== "right");
  return {
    left: axisScale(left.flatMap((s) => s.values), spanZero),
    right: right.length > 0 ? axisScale(right.flatMap((s) => s.values), spanZero) : null,
  };
}

/** The scale a series is read against. */
export function scaleOf(series: ChartSeries, scales: { left: AxisScale; right: AxisScale | null }): AxisScale {
  return series.axis === "right" && scales.right ? scales.right : scales.left;
}

/** Vertical position (0 at the top) of `value` in a plot `plotH` high. */
export function scaleY(value: number, plotH: number, scale: AxisScale): number {
  return plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;
}

/**
 * A path through the points that have a value, broken where one is missing:
 * each run of consecutive values is its own `M … L …` segment. A lone value
 * between gaps is a segment of one point (drawn by its marker, not a line).
 */
export function gappedPath(
  values: readonly (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number
): string {
  const segments: string[] = [];
  let run: string[] = [];
  values.forEach((v, i) => {
    if (v == null) {
      if (run.length > 0) segments.push("M " + run.join(" L "));
      run = [];
      return;
    }
    run.push(`${x(i)},${y(v)}`);
  });
  if (run.length > 0) segments.push("M " + run.join(" L "));
  return segments.join(" ");
}

/** Tick values for an axis: its ends, and 0 when 0 is inside, rounded for reading. */
export function axisTicks(scale: AxisScale): number[] {
  const round = (v: number) => Math.round(v * 10) / 10;
  const ticks = [scale.min, scale.max];
  if (scale.min < 0 && scale.max > 0) ticks.push(0);
  return [...new Set(ticks.map(round))].sort((a, b) => a - b);
}

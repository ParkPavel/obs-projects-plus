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

/**
 * Tick values for an axis: its ends, and 0 when 0 is inside, rounded for
 * reading at the scale's own precision, and inward, so a tick never lands
 * outside the plot. One decimal for every scale left 0..0.02 with only 0
 * (review of 08eda4e).
 */
export function axisTicks(scale: AxisScale): number[] {
  const span = scale.max - scale.min;
  const decimals = span > 0 && Number.isFinite(span) ? Math.min(10, Math.max(1, Math.ceil(-Math.log10(span)) + 1)) : 1;
  const unit = Math.pow(10, decimals);
  const tidy = (v: number) => Math.round(v * unit) / unit; // float noise after ceil/floor
  const ticks = [tidy(Math.ceil(scale.min * unit) / unit), tidy(Math.floor(scale.max * unit) / unit)];
  if (scale.min < 0 && scale.max > 0) ticks.push(0);
  return [...new Set(ticks)].sort((a, b) => a - b);
}
/** A readable step near `rough`: m × 10^e with m of 1, 2, 5 or 10. */
function niceStep(rough: number): { m: number; e: number } {
  const e = Math.floor(Math.log10(rough));
  const normalized = rough / Math.pow(10, e);
  const m = normalized <= 1.5 ? 1 : normalized <= 3.5 ? 2 : normalized <= 7.5 ? 5 : 10;
  return { m, e };
}

/**
 * Grid values inside a scale, at a readable step, never 0 (the axis or the
 * zero line is drawn there). Empty for a scale with no height. The bar chart
 * stepped from 0 up to its max: all-negative bars have a max of 0, the step
 * was 0 and the loop never ended (review of c5cf809).
 *
 * Each value is built from the step's digits, k·m / 10^-e, not rounded after
 * the fact: 0.1 steps print 0.3, and neither 1e-10 nor 1e300 scales collapse
 * to 0 or overflow (review of 680bca3).
 */
export function gridValues(scale: AxisScale, ticks: number): number[] {
  const span = scale.max - scale.min;
  if (!Number.isFinite(span) || span <= 0 || ticks <= 0) return [];
  const { m, e } = niceStep(span / ticks);
  const step = m * Math.pow(10, e);
  if (!Number.isFinite(step) || step <= 0) return [];
  const at = (k: number) => (e < 0 ? (k * m) / Math.pow(10, -e) : k * m * Math.pow(10, e));
  const out: number[] = [];
  for (let k = Math.ceil(scale.min / step); at(k) <= scale.max + step * 0.05; k++) {
    if (k !== 0) out.push(at(k));
  }
  return out;
}

/** Indices of values with no value on either side: a path draws nothing there. */
export function isolatedPoints(values: readonly (number | null)[]): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v != null && values[i - 1] == null && values[i + 1] == null) out.push(i);
  });
  return out;
}

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/**
 * Path commands from a run's first point to its last: straight segments, or
 * Catmull-Rom as cubic Béziers. The line and the area under it share them, so
 * a smooth area follows its line (review of c5cf809).
 */
export function runSegments(pts: readonly Pt[], smooth: boolean): string {
  let d = "";
  for (let k = 0; k < pts.length - 1; k++) {
    const p1 = pts[k]!;
    const p2 = pts[k + 1]!;
    if (!smooth) {
      d += ` L ${p2.x},${p2.y}`;
      continue;
    }
    const p0 = pts[Math.max(k - 1, 0)]!;
    const p3 = pts[Math.min(k + 2, pts.length - 1)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

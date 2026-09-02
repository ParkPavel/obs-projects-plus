// src/ui/views/Dashboard/widgets/Chart/chartWidth.ts
// #166 Step 2 — the width a chart's viewBox is pinned to.
//
// Every chart root carries a `viewBox` and no `width`/`height` attribute, so the
// SVG fills its container's inline size and the viewBox width decides only the
// scale. With a constant there, 11 user units rendered at ~5.5 CSS px in a 240px
// widget and ~22 CSS px in a 960px one (measured:
// `docs/internal/probes/166-chart-viewbox-scale.html`). Pinning the viewBox to
// the measured container width makes one user unit one CSS pixel at every width.
//
// Kept out of ChartWidget.svelte so the guard below is reachable from jest
// without mounting a component — the guard is the part that can silently break.

/**
 * Width used before the container has reported one. It is the constant the
 * charts were pinned to before #166, so the first frame renders exactly as it
 * did, and only the measurement moves it.
 */
export const CHART_WIDTH_FALLBACK = 480;

/**
 * A collapsed or hidden widget measures 0. A zero viewBox width is a
 * division by zero in every scale function downstream (`plotW`, `barGap`,
 * `axisLabels`' `slotWidth`), so a non-positive measurement keeps the last
 * good width instead of propagating.
 */
export function resolveChartWidth(
  measured: number | null | undefined,
  previous: number
): number {
  if (measured == null || !Number.isFinite(measured) || measured <= 0) {
    return previous;
  }
  return measured;
}

<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import type { ChartData, ChartStyle } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { computeAxisLabelLayout, labelAnchor, shouldRenderLabel, truncateLabel } from "./axisLabels";
  import { axisTicks, gappedPath, scaleOf, scaleY, seriesScales, type AxisScale } from "./chartScale";

  export let data: ChartData;
  export let width: number = 400;
  export let height: number = 320;
  export let style: ChartStyle;
  /**
   * #044.2: label currently selected via the per-canvas selection store
   * (driver-mode self-highlight). `null` ⇒ no chart-driven selection.
   */
  export let selectedLabel: string | null = null;

  const dispatch = createEventDispatcher<{ select: { label: string } }>();

  const PADDING_TOP = 20;
  const PADDING_LEFT = 50;
  const LABEL_FONT = 10;

  $: labels = data.labels;
  // 3.6.0 (chartScale.ts): scales span 0, series on the right axis get their
  // own, and a missing value is a gap in the line, not a point at 0.
  $: scales = seriesScales(data.series);
  $: PADDING_RIGHT = scales.right ? 50 : 20;

  // #096.2 — density-based label layout replaces the old `/8` magic skip.
  $: maxLabelChars = labels.reduce((m, l) => Math.max(m, l.length), 0);
  $: axisLabels = computeAxisLabelLayout({
    count: labels.length,
    plotWidth: width - PADDING_LEFT - PADDING_RIGHT,
    fontSize: LABEL_FONT,
    maxLabelChars,
  });
  // Bottom padding reconciles with the (possibly rotated) label height.
  $: paddingBottom = style.showLabels ? axisLabels.bottomPadding : 16;

  $: plotW = width - PADDING_LEFT - PADDING_RIGHT;
  $: plotH = height - PADDING_TOP - paddingBottom;
  $: pointCount = labels.length || 1;
  $: stepX = plotW / Math.max(pointCount - 1, 1);

  // #166 follow-up: these read plotH/maxVal/stepX from the closure. Called
  // straight from the template (`xPos(i)`), Svelte only tracks the identifiers
  // the call expression names — `i`, not what `xPos` reaches into — so a width
  // change patched the viewBox and nothing else. Same fix PieChart already
  // uses for CX/CY/R: the values are passed in rather than closed over, so the
  // template call site names them and the compiler sees the dependency.
  function yPos(val: number, plotHeight: number, scale: AxisScale): number {
    return scaleY(val, plotHeight, scale);
  }

  function xPos(index: number, step: number): number {
    return index * step;
  }

  function buildPath(
    values: (number | null)[],
    smooth: boolean,
    step: number,
    plotHeight: number,
    scale: AxisScale
  ): string {
    if (!smooth) {
      return gappedPath(values, (i) => xPos(i, step), (v) => yPos(v, plotHeight, scale));
    }
    // Catmull-Rom → cubic bezier, within each run of values between gaps.
    return runs(values).map((run) => {
      const pts = run.map(({ i, v }) => ({ x: xPos(i, step), y: yPos(v, plotHeight, scale) }));
      let d = `M ${pts[0]!.x},${pts[0]!.y}`;
      for (let k = 0; k < pts.length - 1; k++) {
        const p0 = pts[Math.max(k - 1, 0)]!;
        const p1 = pts[k]!;
        const p2 = pts[k + 1]!;
        const p3 = pts[Math.min(k + 2, pts.length - 1)]!;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      return d;
    }).join(" ");
  }

  /** Consecutive values between gaps, with their indices. */
  function runs(values: (number | null)[]): Array<Array<{ i: number; v: number }>> {
    const out: Array<Array<{ i: number; v: number }>> = [];
    let run: Array<{ i: number; v: number }> = [];
    values.forEach((v, i) => {
      if (v == null) {
        if (run.length > 0) out.push(run);
        run = [];
      } else run.push({ i, v });
    });
    if (run.length > 0) out.push(run);
    return out;
  }

  /** The area under each run, closed to the zero line of its scale. */
  function areaPath(
    values: (number | null)[],
    step: number,
    plotHeight: number,
    scale: AxisScale
  ): string {
    const zero = yPos(0, plotHeight, scale);
    return runs(values).map((run) => {
      const pts = run.map(({ i, v }) => `${xPos(i, step)},${yPos(v, plotHeight, scale)}`);
      const first = xPos(run[0]!.i, step);
      const last = xPos(run[run.length - 1]!.i, step);
      return `M ${first},${zero} L ${pts.join(" L ")} L ${last},${zero} Z`;
    }).join(" ");
  }

  function seriesColor(index: number): string {
    if (style.colorScheme === "accent" && index === 0) return "var(--interactive-accent)";
    const hues = [210, 340, 120, 45, 275, 180, 15, 300];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 60%, 55%)`;
  }
</script>

<svg
  viewBox="0 0 {width} {height}"
  class="ppp-chart-line"
  role="img"
  aria-label={$i18n.t("views.dashboard.chart.line")}
>
  <g transform="translate({PADDING_LEFT}, {PADDING_TOP})">
    {#if style.showGrid}
      {#each labels as _, i}
        <line
          x1={xPos(i, stepX)} y1={0}
          x2={xPos(i, stepX)} y2={plotH}
          stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
        />
      {/each}
    {/if}

    {#each data.series as series, si}
      {#if style.gradient}
        <defs>
          <linearGradient id="grad-{si}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={seriesColor(si)} stop-opacity="0.3" />
            <stop offset="100%" stop-color={seriesColor(si)} stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path
          d={areaPath(series.values, stepX, plotH, scaleOf(series, scales))}
          fill="url(#grad-{si})"
        />
      {/if}

      <path
        d={buildPath(series.values, !!style.smooth, stepX, plotH, scaleOf(series, scales))}
        fill="none"
        stroke={seriesColor(si)}
        stroke-width="2"
      />

      {#each series.values as val, i}
        {#if val != null}
          {@const label = labels[i] ?? ""}
          {@const isSelected = selectedLabel != null && label === selectedLabel}
          <circle
            cx={xPos(i, stepX)} cy={yPos(val, plotH, scaleOf(series, scales))}
            r={isSelected ? 5 : 3}
            fill={seriesColor(si)}
            stroke={isSelected ? "var(--interactive-accent)" : "none"}
            stroke-width={isSelected ? 2 : 0}
            opacity={selectedLabel == null || isSelected ? 1 : 0.35}
            class="ppp-chart-line__point"
            role="button"
            tabindex="0"
            aria-label={label}
            aria-pressed={isSelected}
            on:click={() => dispatch("select", { label })}
            on:keydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dispatch("select", { label });
              }
            }}
          />
          {#if style.showValues}
            <text
              x={xPos(i, stepX)} y={yPos(val, plotH, scaleOf(series, scales)) - 8}
              text-anchor="middle"
              fill="var(--text-muted)" font-size="10"
            >{val}</text>
          {/if}
        {/if}
      {/each}
    {/each}

    {#if style.showLabels}
      {#each labels as label, i}
        {#if shouldRenderLabel(i, labels.length, axisLabels.skipInterval)}
          <text
            x={xPos(i, stepX)} y={plotH + 16}
            text-anchor={labelAnchor(i, labels.length, axisLabels.rotate)}
            fill="var(--text-normal)" font-size={LABEL_FONT}
            transform={axisLabels.rotate ? `rotate(${axisLabels.rotationDeg} ${xPos(i, stepX)} ${plotH + 16})` : ""}
          >{truncateLabel(label, axisLabels.truncateAt)}</text>
        {/if}
      {/each}
    {/if}

    <!-- Axes -->
    <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--text-muted)" />
    <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--text-muted)" />
    {#if scales.left.min < 0}
      <line x1={0} y1={yPos(0, plotH, scales.left)} x2={plotW} y2={yPos(0, plotH, scales.left)}
        stroke="var(--text-muted)" stroke-dasharray="2,2" class="ppp-chart-zero" />
    {/if}
    {#each axisTicks(scales.left) as tick}
      <text x={-6} y={yPos(tick, plotH, scales.left) + 3} text-anchor="end"
        fill="var(--text-muted)" font-size={LABEL_FONT} class="ppp-chart-tick">{tick}</text>
    {/each}
    {#if scales.right}
      <line x1={plotW} y1={0} x2={plotW} y2={plotH} stroke="var(--text-muted)" class="ppp-chart-axis-right" />
      {#each axisTicks(scales.right) as tick}
        <text x={plotW + 6} y={yPos(tick, plotH, scales.right) + 3} text-anchor="start"
          fill="var(--text-muted)" font-size={LABEL_FONT} class="ppp-chart-tick">{tick}</text>
      {/each}
    {/if}
  </g>
</svg>

{#if style.showLegend && data.series.length > 1}
  <div class="ppp-chart-legend">
    {#each data.series as series, si}
      <span class="ppp-legend-item">
        <span class="ppp-legend-dot" style="background: {seriesColor(si)}"></span>
        {series.name}
      </span>
    {/each}
  </div>
{/if}

<style>
  /*
   * #044.2: line/area points are clickable drivers for cross-widget
   * selection. Visual feedback (radius, accent stroke, opacity) is bound
   * from the script.
   */
  .ppp-chart-line__point {
    cursor: pointer;
    transition: opacity 120ms ease-out, r 120ms ease-out;
  }

  .ppp-chart-line__point:focus-visible {
    outline: none;
    stroke: var(--interactive-accent);
    stroke-width: 2;
  }
</style>

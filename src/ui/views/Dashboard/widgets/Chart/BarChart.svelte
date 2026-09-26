<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import type { ChartData, ChartStyle } from "../../types";
  import { createEventDispatcher } from "svelte";
  import { computeAxisLabelLayout, shouldRenderLabel, truncateLabel } from "./axisLabels";
  import { axisScale, type AxisScale, axisTicks, gappedPath, gridValues, isolatedPoints, scaleOf, scaleY, seriesScales } from "./chartScale";

  export let data: ChartData;
  export let width: number = 400;
  export let height: number = 320;
  export let style: ChartStyle;
  export let horizontal: boolean = false;
  /**
   * #044.2: label currently selected via the per-canvas selection store
   * (driver-mode self-highlight). `null` ⇒ no chart-driven selection,
   * render every bar at full opacity.
   */
  export let selectedLabel: string | null = null;

  const dispatch = createEventDispatcher<{ select: { label: string } }>();

  const PADDING_TOP = 20;
  const PADDING_LEFT = 50;
  const LABEL_FONT = 11;

  $: labels = data.labels;
  $: values = data.series[0]?.values ?? [];
  // 3.6.0 (chartScale.ts): bars grow from the zero line, up or down; a missing
  // value draws no bar; series after the first are lines over the bars on
  // their own axis (a combo chart: income bars, visits line).
  $: scales = seriesScales(data.series);
  $: barScale = data.series[0] ? scaleOf(data.series[0], scales) : axisScale([]);
  $: lineSeries = horizontal ? [] : data.series.slice(1);
  $: PADDING_RIGHT = scales.right && !horizontal ? 50 : 20;

  // #096.2 — vertical bars previously had no skip/rotate, so dense category
  // axes overlapped. Reuse the shared density helper (horizontal bars label
  // in the left gutter, so they keep a fixed bottom padding).
  $: maxLabelChars = labels.reduce((m, l) => Math.max(m, l.length), 0);
  $: axisLabels = computeAxisLabelLayout({
    count: labels.length,
    plotWidth: width - PADDING_LEFT - PADDING_RIGHT,
    fontSize: LABEL_FONT,
    maxLabelChars,
  });
  $: paddingBottom =
    horizontal || !style.showLabels ? 40 : Math.max(40, axisLabels.bottomPadding);

  $: plotW = width - PADDING_LEFT - PADDING_RIGHT;
  $: plotH = height - PADDING_TOP - paddingBottom;
  $: barCount = labels.length || 1;
  $: barGap = Math.max(2, plotW * 0.1 / barCount);
  $: barWidth = horizontal
    ? (plotH - barGap * barCount) / barCount
    : (plotW - barGap * barCount) / barCount;

  $: gridLines = gridValues(barScale, 5);

  // #166 follow-up: same closure blindness LineChart had — called straight
  // from the template (`xPos(gl)`), Svelte tracks only the identifiers the
  // call expression names, not what the function reaches into, so a width
  // change never reran these. Values are passed in rather than closed over
  // (the fix PieChart already uses for CX/CY/R) so the call site names them.
  function yPos(val: number, plotHeight: number, scale: AxisScale): number {
    return scaleY(val, plotHeight, scale);
  }

  function xPos(val: number, scale: AxisScale, plotWidth: number): number {
    return ((val - scale.min) / (scale.max - scale.min)) * plotWidth;
  }

  /** With lines over the bars, every bar is the first series: one colour, as in the legend. */
  function barFill(index: number, multi: boolean): string {
    return multi ? barColor(0) : barColor(index);
  }

  function barColor(index: number): string {
    if (style.colorScheme === "accent") return "var(--interactive-accent)";
    const hues = [210, 340, 120, 45, 275, 180, 15, 300];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 60%, 55%)`;
  }

  /**
   * #044.2: opacity for non-selected bars when a self-highlight is active.
   * Returns 1 when no selection is active OR the bar is the selected one;
   * dims to 0.35 otherwise so the active bar visually pops.
   */
  function barOpacity(label: string): number {
    if (selectedLabel == null) return 1;
    return label === selectedLabel ? 1 : 0.35;
  }

  function handleBarClick(label: string): void {
    dispatch("select", { label });
  }

  function handleBarKey(event: KeyboardEvent, label: string): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dispatch("select", { label });
    }
  }
</script>

<svg
  viewBox="0 0 {width} {height}"
  class="ppp-chart-bar"
  role="img"
  aria-label={$i18n.t("views.dashboard.chart.bar")}
>
  <g transform="translate({PADDING_LEFT}, {PADDING_TOP})">
    {#if style.showGrid}
      {#each gridLines as gl}
        {#if horizontal}
          <line
            x1={xPos(gl, barScale, plotW)} y1={0}
            x2={xPos(gl, barScale, plotW)} y2={plotH}
            stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
          />
        {:else}
          <line
            x1={0} y1={yPos(gl, plotH, barScale)}
            x2={plotW} y2={yPos(gl, plotH, barScale)}
            stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
          />
        {/if}
      {/each}
    {/if}

    {#each labels as label, i}
      {@const val = values[i] ?? null}
      {@const isSelected = selectedLabel != null && label === selectedLabel}
      {#if val == null}
        <!-- A missing value draws no bar: an empty slot, not a zero. -->
      {:else if horizontal}
        {@const bY = i * (barWidth + barGap)}
        {@const x0 = xPos(0, barScale, plotW)}
        {@const xv = xPos(val, barScale, plotW)}
        {@const bW = Math.abs(xv - x0)}
        <rect
          x={Math.min(x0, xv)} y={bY}
          width={bW} height={barWidth}
          fill={barFill(i, lineSeries.length > 0)} rx="2"
          opacity={barOpacity(label)}
          stroke={isSelected ? "var(--interactive-accent)" : "none"}
          stroke-width={isSelected ? 2 : 0}
          class="ppp-chart-bar__rect"
          role="button"
          tabindex="0"
          aria-label={label}
          aria-pressed={isSelected}
          on:click={() => handleBarClick(label)}
          on:keydown={(e) => handleBarKey(e, label)}
        />
        {#if style.showValues}
          <text
            x={Math.max(x0, xv) + 4} y={bY + barWidth / 2}
            dominant-baseline="middle"
            fill="var(--text-muted)" font-size="10"
          >{val}</text>
        {/if}
      {:else}
        {@const bX = i * (barWidth + barGap)}
        {@const y0 = yPos(0, plotH, barScale)}
        {@const yv = yPos(val, plotH, barScale)}
        {@const bH = Math.abs(y0 - yv)}
        <rect
          x={bX} y={Math.min(y0, yv)}
          width={barWidth} height={bH}
          fill={barFill(i, lineSeries.length > 0)} rx="2"
          opacity={barOpacity(label)}
          stroke={isSelected ? "var(--interactive-accent)" : "none"}
          stroke-width={isSelected ? 2 : 0}
          class="ppp-chart-bar__rect"
          role="button"
          tabindex="0"
          aria-label={label}
          aria-pressed={isSelected}
          on:click={() => handleBarClick(label)}
          on:keydown={(e) => handleBarKey(e, label)}
        />
        {#if style.showValues}
          <text
            x={bX + barWidth / 2} y={Math.min(y0, yv) - 4}
            text-anchor="middle"
            fill="var(--text-muted)" font-size="10"
          >{val}</text>
        {/if}
      {/if}
    {/each}

    <!-- Every category keeps its label, with or without a bar (review of c5cf809). -->
    {#if style.showLabels}
      {#each labels as label, i}
        {#if horizontal}
          <text
            x={-4} y={i * (barWidth + barGap) + barWidth / 2}
            text-anchor="end" dominant-baseline="middle"
            fill="var(--text-normal)" font-size="11"
          >{label}</text>
        {:else if shouldRenderLabel(i, labels.length, axisLabels.skipInterval)}
          <text
            x={i * (barWidth + barGap) + barWidth / 2} y={plotH + 14}
            text-anchor="middle"
            fill="var(--text-normal)" font-size={LABEL_FONT}
            transform={axisLabels.rotate ? `rotate(${axisLabels.rotationDeg} ${i * (barWidth + barGap) + barWidth / 2} ${plotH + 14})` : ""}
          >{truncateLabel(label, axisLabels.truncateAt)}</text>
        {/if}
      {/each}
    {/if}

    {#each lineSeries as series, k}
      <path
        d={gappedPath(series.values, (i) => i * (barWidth + barGap) + barWidth / 2, (v) => yPos(v, plotH, scaleOf(series, scales)))}
        fill="none" stroke={barColor(k + 1)} stroke-width="2" class="ppp-chart-bar-line"
      />
      <!-- A value with gaps on both sides: a path draws nothing, a point does. -->
      {#each isolatedPoints(series.values) as i}
        <circle
          cx={i * (barWidth + barGap) + barWidth / 2} cy={yPos(series.values[i] ?? 0, plotH, scaleOf(series, scales))}
          r="3" fill={barColor(k + 1)} class="ppp-chart-bar-point"
        />
      {/each}
    {/each}

    <!-- Axes -->
    <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--text-muted)" />
    <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--text-muted)" />
    {#if !horizontal && barScale.min < 0}
      <line x1={0} y1={yPos(0, plotH, barScale)} x2={plotW} y2={yPos(0, plotH, barScale)}
        stroke="var(--text-muted)" class="ppp-chart-zero" />
    {/if}
    {#if !horizontal && scales.right}
      <line x1={plotW} y1={0} x2={plotW} y2={plotH} stroke="var(--text-muted)" class="ppp-chart-axis-right" />
      {#each axisTicks(scales.right) as tick}
        <text x={plotW + 6} y={yPos(tick, plotH, scales.right) + 3} text-anchor="start"
          fill="var(--text-muted)" font-size={LABEL_FONT} class="ppp-chart-tick">{tick}</text>
      {/each}
    {/if}
  </g>
</svg>

{#if style.showLegend && lineSeries.length > 0}
  <div class="ppp-chart-legend">
    {#each data.series as series, si}
      <span class="ppp-legend-item">
        <span class="ppp-legend-dot" style="background: {barColor(si)}"></span>
        {series.name}
      </span>
    {/each}
  </div>
{/if}

<style>
  /*
   * #044.2: bars are clickable drivers for cross-widget selection. The
   * cursor + focus ring make the affordance discoverable; the dim
   * (`opacity`) and accent stroke are driven from the script.
   */
  .ppp-chart-bar__rect {
    cursor: pointer;
    transition: opacity 120ms ease-out;
  }

  .ppp-chart-bar__rect:focus-visible {
    outline: none;
    stroke: var(--interactive-accent);
    stroke-width: 2;
  }
</style>

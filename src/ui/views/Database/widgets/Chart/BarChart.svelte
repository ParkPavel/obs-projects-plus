<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";

  export let data: ChartData;
  export let width: number = 400;
  export let height: number = 320;
  export let style: ChartStyle;
  export let horizontal: boolean = false;

  const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

  $: labels = data.labels;
  $: values = data.series[0]?.values ?? [];
  $: maxVal = Math.max(...values.map((v) => v ?? 0), 1);

  $: plotW = width - PADDING.left - PADDING.right;
  $: plotH = height - PADDING.top - PADDING.bottom;
  $: barCount = labels.length || 1;
  $: barGap = Math.max(2, plotW * 0.1 / barCount);
  $: barWidth = horizontal
    ? (plotH - barGap * barCount) / barCount
    : (plotW - barGap * barCount) / barCount;

  $: gridLines = computeGrid(maxVal, 5);

  function computeGrid(max: number, ticks: number): number[] {
    const step = niceStep(max / ticks);
    const result: number[] = [];
    for (let v = step; v <= max * 1.05; v += step) {
      result.push(v);
    }
    return result;
  }

  function niceStep(rough: number): number {
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const normalized = rough / mag;
    if (normalized <= 1.5) return mag;
    if (normalized <= 3.5) return 2 * mag;
    if (normalized <= 7.5) return 5 * mag;
    return 10 * mag;
  }

  function yPos(val: number): number {
    return plotH - (val / maxVal) * plotH;
  }

  function xPos(val: number): number {
    return (val / maxVal) * plotW;
  }

  function barColor(index: number): string {
    if (style.colorScheme === "accent") return "var(--interactive-accent)";
    const hues = [210, 340, 120, 45, 275, 180, 15, 300];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 60%, 55%)`;
  }
</script>

<svg
  viewBox="0 0 {width} {height}"
  class="ppp-chart-bar"
  role="img"
  aria-label="Bar chart"
>
  <g transform="translate({PADDING.left}, {PADDING.top})">
    {#if style.showGrid}
      {#each gridLines as gl}
        {#if horizontal}
          <line
            x1={xPos(gl)} y1={0}
            x2={xPos(gl)} y2={plotH}
            stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
          />
        {:else}
          <line
            x1={0} y1={yPos(gl)}
            x2={plotW} y2={yPos(gl)}
            stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
          />
        {/if}
      {/each}
    {/if}

    {#each labels as label, i}
      {@const val = values[i] ?? 0}
      {#if horizontal}
        {@const bY = i * (barWidth + barGap)}
        {@const bW = xPos(val)}
        <rect
          x={0} y={bY}
          width={bW} height={barWidth}
          fill={barColor(i)} rx="2"
        />
        {#if style.showLabels}
          <text
            x={-4} y={bY + barWidth / 2}
            text-anchor="end" dominant-baseline="middle"
            fill="var(--text-normal)" font-size="11"
          >{label}</text>
        {/if}
        {#if style.showValues}
          <text
            x={bW + 4} y={bY + barWidth / 2}
            dominant-baseline="middle"
            fill="var(--text-muted)" font-size="10"
          >{val}</text>
        {/if}
      {:else}
        {@const bX = i * (barWidth + barGap)}
        {@const bH = (val / maxVal) * plotH}
        <rect
          x={bX} y={plotH - bH}
          width={barWidth} height={bH}
          fill={barColor(i)} rx="2"
        />
        {#if style.showLabels}
          <text
            x={bX + barWidth / 2} y={plotH + 14}
            text-anchor="middle"
            fill="var(--text-normal)" font-size="11"
          >{label.length > 10 ? label.slice(0, 9) + "…" : label}</text>
        {/if}
        {#if style.showValues}
          <text
            x={bX + barWidth / 2} y={plotH - bH - 4}
            text-anchor="middle"
            fill="var(--text-muted)" font-size="10"
          >{val}</text>
        {/if}
      {/if}
    {/each}

    <!-- Axes -->
    <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--text-muted)" />
    <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--text-muted)" />
  </g>
</svg>

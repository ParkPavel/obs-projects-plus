<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";

  export let data: ChartData;
  export let width: number = 400;
  export let height: number = 320;
  export let style: ChartStyle;

  const PADDING = { top: 20, right: 20, bottom: 55, left: 50 };

  $: labels = data.labels;
  $: allValues = data.series.flatMap((s) => s.values).filter((v): v is number => v != null);
  $: maxVal = Math.max(...allValues, 1);

  $: plotW = width - PADDING.left - PADDING.right;
  $: plotH = height - PADDING.top - PADDING.bottom;
  $: pointCount = labels.length || 1;
  $: stepX = plotW / Math.max(pointCount - 1, 1);

  function yPos(val: number | null): number {
    return plotH - ((val ?? 0) / maxVal) * plotH;
  }

  function xPos(index: number): number {
    return index * stepX;
  }

  function buildPath(values: (number | null)[], smooth: boolean): string {
    const points = values.map((v, i) => ({
      x: xPos(i),
      y: yPos(v),
    }));

    if (points.length === 0) return "";

    if (!smooth) {
      return "M " + points.map((p) => `${p.x},${p.y}`).join(" L ");
    }

    // Catmull-Rom → cubic bezier approximation
    let d = `M ${points[0]!.x},${points[0]!.y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[Math.min(i + 2, points.length - 1)]!;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  function areaPath(values: (number | null)[], smooth: boolean): string {
    const linePath = buildPath(values, smooth);
    if (!linePath) return "";
    const lastX = xPos(values.length - 1);
    return `${linePath} L ${lastX},${plotH} L 0,${plotH} Z`;
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
  aria-label="Line chart"
>
  <g transform="translate({PADDING.left}, {PADDING.top})">
    {#if style.showGrid}
      {#each labels as _, i}
        <line
          x1={xPos(i)} y1={0}
          x2={xPos(i)} y2={plotH}
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
          d={areaPath(series.values, !!style.smooth)}
          fill="url(#grad-{si})"
        />
      {/if}

      <path
        d={buildPath(series.values, !!style.smooth)}
        fill="none"
        stroke={seriesColor(si)}
        stroke-width="2"
      />

      {#each series.values as val, i}
        {#if val != null}
          <circle
            cx={xPos(i)} cy={yPos(val)}
            r="3"
            fill={seriesColor(si)}
          />
          {#if style.showValues}
            <text
              x={xPos(i)} y={yPos(val) - 8}
              text-anchor="middle"
              fill="var(--text-muted)" font-size="10"
            >{val}</text>
          {/if}
        {/if}
      {/each}
    {/each}

    {#if style.showLabels}
      {#each labels as label, i}
        {@const skipInterval = labels.length > 10 ? Math.ceil(labels.length / 8) : 1}
        {#if i % skipInterval === 0 || i === labels.length - 1}
          <text
            x={xPos(i)} y={plotH + 16}
            text-anchor="middle"
            fill="var(--text-normal)" font-size="10"
            transform="rotate(-30 {xPos(i)} {plotH + 16})"
          >{label.length > 12 ? label.slice(0, 11) + "…" : label}</text>
        {/if}
      {/each}
    {/if}

    <!-- Axes -->
    <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--text-muted)" />
    <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--text-muted)" />
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

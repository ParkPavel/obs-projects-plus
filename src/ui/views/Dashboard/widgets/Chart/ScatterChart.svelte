<script lang="ts">
  import type { ScatterData, ChartStyle } from "../../types";

  export let data: ScatterData;
  export let width: number = 480;
  export let height: number = 320;
  export let style: ChartStyle;
  export let pointRadius: number = 5;
  export let opacity: number = 0.8;
  export let showTrendLine: boolean = true;
  export let showR2: boolean = true;

  const PADDING = { top: 20, right: 20, bottom: 40, left: 50 };

  $: plotW = width - PADDING.left - PADDING.right;
  $: plotH = height - PADDING.top - PADDING.bottom;

  $: xValues = data.points.map((p) => p.x);
  $: yValues = data.points.map((p) => p.y);

  $: xMin = xValues.length ? xValues.reduce((m, v) => v < m ? v : m, Infinity) : 0;
  $: xMax = xValues.length ? xValues.reduce((m, v) => v > m ? v : m, -Infinity) : 1;
  $: yMin = yValues.length ? yValues.reduce((m, v) => v < m ? v : m, Infinity) : 0;
  $: yMax = yValues.length ? yValues.reduce((m, v) => v > m ? v : m, -Infinity) : 1;

  // Add padding to ranges so points aren't on edges
  $: xRange = xMax - xMin || 1;
  $: yRange = yMax - yMin || 1;
  $: xLo = xMin - xRange * 0.05;
  $: xHi = xMax + xRange * 0.05;
  $: yLo = yMin - yRange * 0.05;
  $: yHi = yMax + yRange * 0.05;

  $: gridLinesX = computeGrid(xLo, xHi, 5);
  $: gridLinesY = computeGrid(yLo, yHi, 5);

  function computeGrid(lo: number, hi: number, ticks: number): number[] {
    const range = hi - lo;
    if (range <= 0) return [lo];
    const step = niceStep(range / ticks);
    const start = Math.ceil(lo / step) * step;
    const result: number[] = [];
    for (let v = start; v <= hi; v += step) {
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

  function scaleX(val: number): number {
    return ((val - xLo) / (xHi - xLo)) * plotW;
  }

  function scaleY(val: number): number {
    return plotH - ((val - yLo) / (yHi - yLo)) * plotH;
  }

  function formatAxis(val: number): string {
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + "M";
    if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + "K";
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  }

  // Group points by color dimension
  $: groups = groupPoints(data.points);

  function groupPoints(points: ScatterData["points"]): Map<string, { x: number; y: number; label?: string; group?: string; size?: number }[]> {
    const map = new Map<string, { x: number; y: number; label?: string; group?: string; size?: number }[]>();
    for (const p of points) {
      const key = p.group ?? "";
      const arr = map.get(key);
      if (arr) {
        arr.push(p);
      } else {
        map.set(key, [p]);
      }
    }
    return map;
  }

  const HUES = [210, 340, 120, 45, 275, 180, 15, 300];

  function groupColor(index: number): string {
    if (style.colorScheme === "accent") return "var(--interactive-accent)";
    const hue = HUES[index % HUES.length]!;
    return `hsl(${hue}, 60%, 55%)`;
  }

  // Trend line
  $: trendLine = data.trendLine;
  $: r2 = data.r2;
  $: trendPath = trendLine ? computeTrendPath(trendLine) : "";

  function computeTrendPath(trend: { slope: number; intercept: number }): string {
    const x1 = xLo;
    const x2 = xHi;
    const y1 = trend.slope * x1 + trend.intercept;
    const y2 = trend.slope * x2 + trend.intercept;
    return `M ${scaleX(x1)} ${scaleY(y1)} L ${scaleX(x2)} ${scaleY(y2)}`;
  }
</script>

<svg
  viewBox="0 0 {width} {height}"
  class="ppp-chart-scatter"
  role="img"
  aria-label="Scatter chart"
>
  <g transform="translate({PADDING.left}, {PADDING.top})">
    <!-- Grid lines -->
    {#if style.showGrid}
      {#each gridLinesY as gl}
        <line
          x1={0} y1={scaleY(gl)}
          x2={plotW} y2={scaleY(gl)}
          stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
        />
      {/each}
      {#each gridLinesX as gl}
        <line
          x1={scaleX(gl)} y1={0}
          x2={scaleX(gl)} y2={plotH}
          stroke="var(--background-modifier-border)" stroke-dasharray="3,3"
        />
      {/each}
    {/if}

    <!-- Axes -->
    <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--text-faint)" />
    <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--text-faint)" />

    <!-- Axis labels -->
    {#if style.showLabels}
      {#each gridLinesX as gl}
        <text
          x={scaleX(gl)} y={plotH + 16}
          text-anchor="middle" font-size="10" fill="var(--text-muted)"
        >{formatAxis(gl)}</text>
      {/each}
      {#each gridLinesY as gl}
        <text
          x={-8} y={scaleY(gl) + 3}
          text-anchor="end" font-size="10" fill="var(--text-muted)"
        >{formatAxis(gl)}</text>
      {/each}
    {/if}

    <!-- Trend line -->
    {#if showTrendLine && trendPath}
      <path
        d={trendPath}
        fill="none"
        stroke="var(--text-faint)"
        stroke-width="1.5"
        stroke-dasharray="6,4"
      />
    {/if}

    <!-- Points -->
    {#each [...groups.entries()] as [_groupName, points], gi}
      {#each points as point}
        <circle
          cx={scaleX(point.x)}
          cy={scaleY(point.y)}
          r={point.size ?? pointRadius}
          fill={groupColor(gi)}
          fill-opacity={opacity}
          stroke={groupColor(gi)}
          stroke-opacity={Math.min(opacity + 0.2, 1)}
          stroke-width="1"
        >
          {#if point.label}
            <title>{point.label}: ({point.x}, {point.y})</title>
          {:else}
            <title>({point.x}, {point.y})</title>
          {/if}
        </circle>
      {/each}
    {/each}

    <!-- R² label -->
    {#if showR2 && r2 != null}
      <text
        x={plotW - 4} y={16}
        text-anchor="end" font-size="11" fill="var(--text-muted)"
      >
        R² = {r2.toFixed(3)}
      </text>
    {/if}

    <!-- Legend -->
    {#if style.showLegend && groups.size > 1}
      {#each [...groups.keys()] as groupName, gi}
        <g transform="translate({plotW - 100}, {30 + gi * 18})">
          <circle cx={0} cy={0} r={4} fill={groupColor(gi)} />
          <text x={8} y={4} font-size="10" fill="var(--text-muted)">{groupName || "—"}</text>
        </g>
      {/each}
    {/if}
  </g>
</svg>

<style>
  .ppp-chart-scatter {
    width: 100%;
    height: 100%;
  }

  .ppp-chart-scatter circle {
    transition: transform 0.15s ease, stroke-width 0.15s ease;
    transform-box: fill-box;
    transform-origin: center;
    cursor: default;
  }

  .ppp-chart-scatter circle:hover {
    transform: scale(1.2);
    stroke-width: 2;
  }
</style>

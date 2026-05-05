<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";

  export let data: ChartData;
  export let width: number = 300;
  export let height: number = 300;
  export let style: ChartStyle;
  export let donut: boolean = false;

  const CX = width / 2;
  const CY = height / 2;
  const R = Math.min(CX, CY) - 30;
  const INNER_R = donut ? R * 0.55 : 0;

  $: labels = data.labels;
  $: values = (data.series[0]?.values ?? []).map((v) => Math.max(v ?? 0, 0));
  $: total = values.reduce((s, v) => s + v, 0) || 1;

  function sliceColor(index: number): string {
    if (style.colorScheme === "accent") {
      const lightness = 40 + (index / Math.max(labels.length, 1)) * 30;
      return `hsl(var(--accent-h, 210), 60%, ${lightness}%)`;
    }
    const hues = [210, 340, 120, 45, 275, 180, 15, 300, 90, 0];
    const hue = hues[index % hues.length];
    return `hsl(${hue}, 55%, 55%)`;
  }

  interface SliceArc {
    path: string;
    midAngle: number;
    percent: number;
    color: string;
    label: string;
  }

  $: slices = computeSlices(values, labels);

  function computeSlices(vals: number[], lbls: string[]): SliceArc[] {
    const result: SliceArc[] = [];
    let angle = -Math.PI / 2;

    for (let i = 0; i < vals.length; i++) {
      const pct = vals[i]! / total;
      const sweep = pct * 2 * Math.PI;
      const midAngle = angle + sweep / 2;

      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      const x2 = CX + R * Math.cos(angle + sweep);
      const y2 = CY + R * Math.sin(angle + sweep);
      const largeArc = sweep > Math.PI ? 1 : 0;

      let path: string;
      if (donut) {
        const ix1 = CX + INNER_R * Math.cos(angle);
        const iy1 = CY + INNER_R * Math.sin(angle);
        const ix2 = CX + INNER_R * Math.cos(angle + sweep);
        const iy2 = CY + INNER_R * Math.sin(angle + sweep);
        path = `M ${ix1},${iy1} L ${x1},${y1} A ${R},${R} 0 ${largeArc},1 ${x2},${y2} L ${ix2},${iy2} A ${INNER_R},${INNER_R} 0 ${largeArc},0 ${ix1},${iy1} Z`;
      } else {
        path = `M ${CX},${CY} L ${x1},${y1} A ${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`;
      }

      result.push({
        path,
        midAngle,
        percent: pct * 100,
        color: sliceColor(i),
        label: lbls[i] ?? "",
      });

      angle += sweep;
    }
    return result;
  }
</script>

<svg
  viewBox="0 0 {width} {height}"
  class="ppp-chart-pie"
  role="img"
  aria-label="{donut ? 'Donut' : 'Pie'} chart"
>
  {#each slices as slice}
    <path
      d={slice.path}
      fill={slice.color}
      stroke="var(--background-primary)"
      stroke-width="1.5"
    >
      <title>{slice.label}: {slice.percent.toFixed(1)}%</title>
    </path>
  {/each}

  {#if style.showValues}
    {#each slices as slice}
      {#if slice.percent >= 3}
        {@const labelR = slice.percent < 8 ? R * 0.88 : (donut ? (R + INNER_R) / 2 : R * 0.55)}
        {@const lx = CX + labelR * Math.cos(slice.midAngle)}
        {@const ly = CY + labelR * Math.sin(slice.midAngle)}
        <text
          x={lx} y={ly}
          text-anchor="middle" dominant-baseline="middle"
          fill={slice.percent < 8 ? "var(--text-normal)" : "var(--text-on-accent, #fff)"}
          font-size={slice.percent < 8 ? "9" : "11"} font-weight="600"
        >{slice.percent.toFixed(0)}%</text>
      {/if}
    {/each}
  {/if}

  {#if donut && style.showCenter}
    <text
      x={CX} y={CY}
      text-anchor="middle" dominant-baseline="middle"
      fill="var(--text-normal)" font-size="20" font-weight="700"
    >{total}</text>
  {/if}
</svg>

{#if style.showLegend}
  <div class="ppp-chart-legend">
    {#each slices as slice, i}
      <span class="ppp-legend-item">
        <span class="ppp-legend-dot" style="background: {slice.color}"></span>
        {labels[i]}
      </span>
    {/each}
  </div>
{/if}

<style>
  .ppp-chart-pie {
    width: 100%;
    height: auto;
  }

  .ppp-chart-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .ppp-legend-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>

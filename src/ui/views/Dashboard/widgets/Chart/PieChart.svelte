<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";
  import { createEventDispatcher } from "svelte";

  export let data: ChartData;
  export let width: number = 300;
  export let height: number = 300;
  export let style: ChartStyle;
  export let donut: boolean = false;
  /**
   * #044.2: label currently selected via the per-canvas selection store
   * (driver-mode self-highlight). `null` ⇒ no chart-driven selection.
   */
  export let selectedLabel: string | null = null;

  const dispatch = createEventDispatcher<{ select: { label: string } }>();

  /*
   * #166: these were `const`, computed once at mount. `width` was a constant in
   * practice (ChartWidget passed the configured height for both axes), so the
   * staleness never showed — but it was already reachable by editing the chart's
   * height in the config, and Step 2 makes `width` change on every resize. A
   * stale CX/CY/R against a live viewBox draws the pie off its own centre.
   */
  $: CX = width / 2;
  $: CY = height / 2;
  $: R = Math.min(CX, CY) - 30;
  $: INNER_R = donut ? R * 0.55 : 0;

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

  // The geometry is passed in rather than closed over: Svelte tracks only the
  // identifiers this statement names, so a `$:` CX read inside the function
  // would not re-run it.
  $: slices = computeSlices(values, labels, CX, CY, R, INNER_R);

  function computeSlices(
    vals: number[],
    lbls: string[],
    cx: number,
    cy: number,
    r: number,
    innerR: number,
  ): SliceArc[] {
    const result: SliceArc[] = [];
    let angle = -Math.PI / 2;

    for (let i = 0; i < vals.length; i++) {
      const pct = vals[i]! / total;
      const sweep = pct * 2 * Math.PI;
      const midAngle = angle + sweep / 2;

      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(angle + sweep);
      const y2 = cy + r * Math.sin(angle + sweep);
      const largeArc = sweep > Math.PI ? 1 : 0;

      let path: string;
      if (donut) {
        const ix1 = cx + innerR * Math.cos(angle);
        const iy1 = cy + innerR * Math.sin(angle);
        const ix2 = cx + innerR * Math.cos(angle + sweep);
        const iy2 = cy + innerR * Math.sin(angle + sweep);
        path = `M ${ix1},${iy1} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} L ${ix2},${iy2} A ${innerR},${innerR} 0 ${largeArc},0 ${ix1},${iy1} Z`;
      } else {
        path = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
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
  width={width}
  height={height}
  class="ppp-chart-pie"
  role="img"
  aria-label="{donut ? 'Donut' : 'Pie'} chart"
>
  {#each slices as slice}
    <path
      d={slice.path}
      fill={slice.color}
      stroke={selectedLabel != null && slice.label === selectedLabel
        ? "var(--interactive-accent)"
        : "var(--background-primary)"}
      stroke-width={selectedLabel != null && slice.label === selectedLabel ? 2.5 : 1.5}
      opacity={selectedLabel == null || slice.label === selectedLabel ? 1 : 0.35}
      class="ppp-chart-pie__slice"
      role="button"
      tabindex="0"
      aria-label={slice.label}
      aria-pressed={selectedLabel != null && slice.label === selectedLabel}
      on:click={() => dispatch("select", { label: slice.label })}
      on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dispatch("select", { label: slice.label });
        }
      }}
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
  /* #166 step 2: the viewBox is a square capped at the widget height, so the SVG
     must not be stretched to the container width — `width: 100%` would scale
     every label back up in a wide widget (Codex audit). The width/height
     attributes give it its intrinsic size; max-width keeps it inside a narrow
     container. Centred, so a capped pie sits in the middle of a wide widget. */
  .ppp-chart-pie {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
  }

  /*
   * #044.2: slices are clickable drivers for cross-widget selection.
   * Visual state (opacity + accent stroke) is bound from the script.
   */
  .ppp-chart-pie__slice {
    cursor: pointer;
    transition: opacity 120ms ease-out, stroke-width 120ms ease-out;
  }

  .ppp-chart-pie__slice:focus-visible {
    outline: none;
    stroke: var(--interactive-accent);
    stroke-width: 2.5;
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

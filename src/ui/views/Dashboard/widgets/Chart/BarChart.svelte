<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";
  import { createEventDispatcher } from "svelte";

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
      {@const isSelected = selectedLabel != null && label === selectedLabel}
      {#if horizontal}
        {@const bY = i * (barWidth + barGap)}
        {@const bW = xPos(val)}
        <rect
          x={0} y={bY}
          width={bW} height={barWidth}
          fill={barColor(i)} rx="2"
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

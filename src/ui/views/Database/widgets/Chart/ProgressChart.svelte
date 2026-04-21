<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";

  export let data: ChartData;
  export let width: number = 400;
  export let style: ChartStyle;

  $: value = data.series[0]?.values[0] ?? 0;
  $: label = data.series[0]?.name ?? "";
  $: percent = Math.min(Math.max(value ?? 0, 0), 100);

  const BAR_H = 28;
  const RADIUS = 4;

  function fillColor(): string {
    if (style.colorScheme === "accent") return "var(--interactive-accent)";
    if (percent >= 80) return "hsl(120, 50%, 45%)";
    if (percent >= 50) return "hsl(45, 70%, 50%)";
    return "hsl(210, 60%, 55%)";
  }
</script>

<div class="ppp-chart-progress" role="img" aria-label="Progress: {label} {percent}%">
  <svg viewBox="0 0 {width} {BAR_H + 24}" class="ppp-progress-svg">
    {#if style.showLabels}
      <text x={0} y={12} fill="var(--text-normal)" font-size="12">{label}</text>
    {/if}
    <rect
      x={0} y={18} rx={RADIUS} ry={RADIUS}
      width={width} height={BAR_H}
      fill="var(--background-modifier-border)"
    />
    <rect
      x={0} y={18} rx={RADIUS} ry={RADIUS}
      width={width * percent / 100} height={BAR_H}
      fill={fillColor()}
    />
    {#if style.showValues}
      <text
        x={width / 2} y={18 + BAR_H / 2 + 1}
        text-anchor="middle" dominant-baseline="middle"
        fill="var(--text-normal)" font-size="13" font-weight="600"
      >{percent.toFixed(0)}%</text>
    {/if}
  </svg>
</div>

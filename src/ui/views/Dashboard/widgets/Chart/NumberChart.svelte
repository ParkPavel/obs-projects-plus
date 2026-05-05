<script lang="ts">
  import type { ChartData, ChartStyle } from "../../types";

  export let data: ChartData;
  export let style: ChartStyle;

  $: value = data.series[0]?.values[0] ?? 0;
  $: label = data.series[0]?.name ?? "";

  function formatValue(val: number | null): string {
    if (val == null) return "—";
    if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M";
    if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + "K";
    return Number.isInteger(val) ? String(val) : val.toFixed(1);
  }
</script>

<div class="ppp-chart-number" role="img" aria-label="KPI: {label} = {value}">
  <span class="ppp-number-value"
    style={style.colorScheme === "accent" ? "color: var(--interactive-accent)" : ""}
  >{formatValue(value)}</span>
  {#if style.showLabels}
    <span class="ppp-number-label">{label}</span>
  {/if}
</div>

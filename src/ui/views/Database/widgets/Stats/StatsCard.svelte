<script lang="ts">
  import type { StatsCardConfig } from "../../types";
  import type { DataValue } from "src/lib/dataframe/dataframe";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import { sanitizeColor } from "../../engine/conditionalFormat";
  import { computeAggregateValue } from "../../engine/aggregation";

  export let config: StatsCardConfig;
  export let values: Optional<DataValue>[];

  $: safeColor = config.color ? sanitizeColor(config.color) : null;
  $: result = computeAggregateValue(values, config.aggregation);
  $: formatted = formatResult(result, config.format, config.currencySymbol);
  $: sparklinePath = config.sparkline ? buildSparkline(values) : "";

  function formatResult(
    val: number | string | null,
    fmt?: StatsCardConfig["format"],
    currency?: string
  ): string {
    if (val == null) return "—";
    if (typeof val === "string") return val;

    switch (fmt) {
      case "percent": return val.toFixed(1) + "%";
      case "currency": return (currency ?? "$") + val.toLocaleString();
      case "duration": {
        const h = Math.floor(val / 3600);
        const m = Math.floor((val % 3600) / 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
      }
      case "number":
      default:
        return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
    }
  }

  function buildSparkline(vals: Optional<DataValue>[]): string {
    const nums = vals
      .filter((v): v is DataValue => v !== undefined && v !== null)
      .map((v) => (typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN))
      .filter((n) => !isNaN(n));
    if (nums.length < 2) return "";
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const range = max - min || 1;
    const w = 80;
    const h = 24;
    const step = w / (nums.length - 1);
    return nums.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }
</script>

<div
  class="ppp-stats-card"
  style={safeColor ? `border-left: 3px solid ${safeColor}` : ""}
>
  <span class="ppp-stats-value">{formatted}</span>
  {#if config.sparkline && sparklinePath}
    <svg class="ppp-stats-sparkline" viewBox="0 0 80 24" preserveAspectRatio="none">
      <path d={sparklinePath} fill="none" stroke="var(--interactive-accent)" stroke-width="1.5" />
    </svg>
  {/if}
  <span class="ppp-stats-label">{config.label}</span>
</div>

<style>
  .ppp-stats-sparkline {
    width: 5rem;
    height: 1.5rem;
    display: block;
    margin: 0.125rem 0;
  }
</style>

<script lang="ts">
  import type { StatsCardConfig } from "../../types";
  import type { DataValue } from "src/lib/dataframe/dataframe";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import { sanitizeColor } from "src/lib/dashboard-engine/conditionalFormat";
  import { computeAggregateValue } from "src/lib/dashboard-engine/aggregation";

  export let config: StatsCardConfig;
  export let values: Optional<DataValue>[];
  export let fieldMissing: boolean = false;
  /**
   * #044.4 receiver: `true` when a canvas-level selection is actively
   * narrowing the records this card was computed over. Renders a small
   * accent-coloured dot next to the value (spec §5.3, §6.1).
   */
  export let filtered: boolean = false;

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
  class:ppp-stats-card--missing={fieldMissing}
  style={safeColor ? `border-left: 0.1875rem solid ${safeColor}` : ""}
  title={fieldMissing ? `Field "${config.field}" not found in data. Edit the widget config to pick an existing field.` : ""}
>
  {#if fieldMissing}
    <span class="ppp-stats-value ppp-stats-value--missing" aria-label="Field not found">⚠</span>
  {:else}
    <span class="ppp-stats-value">
      {formatted}
      {#if filtered}
        <span
          class="ppp-stats-filtered-dot"
          title="Filtered by canvas selection"
          aria-label="Filtered by canvas selection"
        ></span>
      {/if}
    </span>
  {/if}
  {#if config.sparkline && sparklinePath && !fieldMissing}
    <svg class="ppp-stats-sparkline" viewBox="0 0 80 24" preserveAspectRatio="none">
      <path d={sparklinePath} fill="none" stroke="var(--interactive-accent)" stroke-width="1.5" />
    </svg>
  {/if}
  <span class="ppp-stats-label">
    {config.label}{#if fieldMissing} — <span class="ppp-stats-missing-hint">no field “{config.field}”</span>{/if}
  </span>
</div>

<style>
  .ppp-stats-sparkline {
    width: 5rem;
    height: 1.5rem;
    display: block;
    margin: 0.125rem 0;
  }

  .ppp-stats-card--missing {
    opacity: 0.7;
    border-left: 0.1875rem solid var(--text-warning, orange) !important;
  }

  .ppp-stats-value--missing {
    color: var(--text-warning, orange);
  }

  .ppp-stats-missing-hint {
    color: var(--text-warning, orange);
    font-style: italic;
  }

  /* #044.4 filtered-by-selection indicator. Subtle accent-coloured dot
     positioned next to the value (spec §5.3). Uses rem to respect PX-budget. */
  .ppp-stats-filtered-dot {
    display: inline-block;
    width: 0.4rem;
    height: 0.4rem;
    margin-left: 0.375rem;
    border-radius: 50%;
    background: var(--interactive-accent);
    vertical-align: middle;
  }
</style>

<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ComparisonMetric } from "../../types";
  import { sanitizeColor } from "../../engine/conditionalFormat";

  export let config: Record<string, unknown>;
  export let source: DataFrame;
  import { i18n } from "src/lib/stores/i18n";

  interface ResolvedMetric {
    field: string;
    label: string;
    value: number;
    color: string;
  }

  const HUES = [210, 340, 120, 45, 275, 180, 15, 300];

  function metricColor(index: number): string {
    if (index === 0) return "var(--interactive-accent)";
    const hue = HUES[index % HUES.length]!;
    return `hsl(${hue}, 60%, 55%)`;
  }

  function computeSum(field: string): number {
    let total = 0;
    for (const r of source.records) {
      const v = r.values[field];
      if (typeof v === "number") total += v;
    }
    return total;
  }

  // Backward compat: support old metricA/metricB config + new metrics[] config
  // Include `source` in reactive expression so metrics recalculate when DataFrame changes
  $: metrics = resolveMetrics(config, source);

  function resolveMetrics(cfg: Record<string, unknown>, _df: DataFrame): ResolvedMetric[] {
    // New format: metrics array
    const arr = cfg["metrics"] as ComparisonMetric[] | undefined;
    if (arr && Array.isArray(arr) && arr.length > 0) {
      return arr.map((m, i) => ({
        field: m.field,
        label: m.label ?? m.field,
        value: computeSum(m.field),
        color: (m.color ? sanitizeColor(m.color) : null) ?? metricColor(i),
      }));
    }
    // Old format: metricA / metricB
    const result: ResolvedMetric[] = [];
    const metricA = String(cfg["metricA"] ?? "");
    const metricB = String(cfg["metricB"] ?? "");
    if (metricA) result.push({ field: metricA, label: metricA, value: computeSum(metricA), color: metricColor(0) });
    if (metricB) result.push({ field: metricB, label: metricB, value: computeSum(metricB), color: metricColor(1) });
    return result;
  }

  $: mode = (config["mode"] as string) ?? "absolute";
  $: showDelta = (config["showDelta"] as boolean) ?? false;
  $: maxVal = Math.max(...metrics.map((m) => m.value), 1);
  $: baseValue = metrics.length > 0 ? metrics[0]!.value : 0;

  function barWidth(value: number): number {
    if (mode === "percentage" && metrics.length > 0) {
      const total = metrics.reduce((s, m) => s + m.value, 0);
      return total > 0 ? (value / total) * 100 : 0;
    }
    return (value / maxVal) * 100;
  }

  function formatValue(value: number): string {
    if (mode === "percentage") {
      const total = metrics.reduce((s, m) => s + m.value, 0);
      return total > 0 ? ((value / total) * 100).toFixed(1) + "%" : "0%";
    }
    return value.toLocaleString();
  }
</script>

<div class="ppp-comparison-widget">
  {#if metrics.length === 0}
    <div class="ppp-widget-empty">{$i18n.t("views.database.comparison.empty")}</div>
  {:else}
    <div class="ppp-comparison-bars">
      {#each metrics as metric, i}
        <div class="ppp-comparison-row">
          <span class="ppp-comparison-label">{metric.label}</span>
          <div class="ppp-comparison-bar-bg">
            <div
              class="ppp-comparison-bar"
              style="width: {barWidth(metric.value)}%; background: {metric.color}"
            ></div>
          </div>
          <span class="ppp-comparison-value">{formatValue(metric.value)}</span>
          {#if showDelta && i > 0}
            {@const delta = metric.value - baseValue}
            <span class="ppp-comparison-delta" class:positive={delta > 0} class:negative={delta < 0}>
              {delta > 0 ? "+" : ""}{delta.toLocaleString()}
            </span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ppp-comparison-widget {
    padding: 0.5rem;
  }

  .ppp-comparison-bars {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ppp-comparison-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ppp-comparison-label {
    min-width: 5rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    text-align: right;
    flex-shrink: 0;
  }

  .ppp-comparison-bar-bg {
    flex: 1;
    height: 1.5rem;
    background: var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    overflow: hidden;
  }

  .ppp-comparison-bar {
    height: 100%;
    border-radius: var(--radius-s, 0.25rem);
    transition: width 0.3s ease;
  }

  .ppp-comparison-value {
    min-width: 3rem;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
    text-align: right;
    flex-shrink: 0;
  }

  .ppp-comparison-delta {
    min-width: 3rem;
    font-size: var(--font-ui-smaller, 0.7rem);
    text-align: right;
    flex-shrink: 0;
  }

  .ppp-comparison-delta.positive {
    color: var(--text-success, hsl(120, 50%, 45%));
  }

  .ppp-comparison-delta.negative {
    color: var(--text-error, hsl(0, 50%, 50%));
  }

  .ppp-widget-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    color: var(--text-faint);
    font-style: italic;
  }

  /* Matryoshka: stack labels above bars in narrow container */
  @container widget (max-width: 20rem) {
    .ppp-comparison-row {
      flex-wrap: wrap;
    }
    .ppp-comparison-label {
      min-width: 100%;
      text-align: left;
    }
    .ppp-comparison-delta {
      display: none;
    }
  }
</style>

<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ChartConfig, ChartData, ScatterChartConfig } from "../../types";
  import { computeChartData, computeScatterData, chartHeightPx } from "../../engine/chartDataPipeline";
  import BarChart from "./BarChart.svelte";
  import LineChart from "./LineChart.svelte";
  import PieChart from "./PieChart.svelte";
  import NumberChart from "./NumberChart.svelte";
  import ProgressChart from "./ProgressChart.svelte";
  import ScatterChart from "./ScatterChart.svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: ChartConfig;
  export let source: DataFrame;
  /** Pillar 5: preloaded DataFrame for scatter correlation. */
  export let rightFrame: DataFrame | null = null;

  const EMPTY_CHART: ChartData = { labels: [], series: [] };

  $: isScatter = config.chartType === "scatter";
  $: chartData = isScatter ? EMPTY_CHART : computeChartData(source, config);
  $: scatterConfig = isScatter ? extractScatterConfig(config) : null;
  $: scatterData = isScatter && scatterConfig ? computeScatterData(source, scatterConfig, rightFrame ?? undefined) : null;
  $: heightPx = chartHeightPx(config.style.height);
  $: isEmpty = isScatter
    ? (scatterData?.points.length ?? 0) === 0
    : (chartData.labels.length === 0 && config.chartType !== "number");

  // Pillar 5: correlation diagnostics. Surface actionable hints instead of
  // rendering a silent empty chart when join-key semantics go wrong.
  $: correlationActive = isScatter && scatterConfig?.correlation != null;
  $: correlationMissingRight = correlationActive && rightFrame == null;
  $: correlationStats = scatterData?.correlationStats;
  $: correlationWarning = (() => {
    if (!correlationActive) return null as null | { kind: "missing-right" | "no-matches" | "mostly-unmatched"; matched: number; total: number };
    if (correlationMissingRight) return { kind: "missing-right", matched: 0, total: 0 } as const;
    if (!correlationStats) return null;
    const { matched, leftCount } = correlationStats;
    if (leftCount === 0) return null;
    if (matched === 0) return { kind: "no-matches", matched, total: leftCount } as const;
    if (matched < leftCount * 0.1) return { kind: "mostly-unmatched", matched, total: leftCount } as const;
    return null;
  })();

  /*
   * Degenerate: chart renders correctly but data has no variance,
   * so the visualization becomes meaningless (e.g. pie with 1 slice = 100%,
   * line with 1 point = flat). Surface an explanatory hint instead of a silent
   * misleading render.
   */
  $: isDegenerate = !isEmpty && (
    ((config.chartType === "pie" || config.chartType === "donut") && chartData.labels.length === 1) ||
    ((config.chartType === "line" || config.chartType === "area" || config.chartType === "bar" || config.chartType === "stacked-bar" || config.chartType === "horizontal-bar") && chartData.labels.length < 2)
  );

  function extractScatterConfig(cfg: ChartConfig): ScatterChartConfig {
    const raw = cfg as unknown as Record<string, unknown>;
    const base: ScatterChartConfig = {
      xAxis: { field: cfg.xAxis.property },
      yAxis: { field: cfg.yAxis.property === "count" ? "" : cfg.yAxis.property },
      showTrendLine: (raw["showTrendLine"] as boolean) ?? true,
      showR2: (raw["showR2"] as boolean) ?? true,
      pointRadius: (raw["pointRadius"] as number) ?? 5,
      opacity: (raw["opacity"] as number) ?? 0.8,
    };
    const colorBy = raw["colorBy"] as string | undefined;
    const sizeBy = raw["sizeBy"] as string | undefined;
    return {
      ...base,
      ...(colorBy ? { colorBy } : {}),
      ...(sizeBy ? { sizeBy } : {}),
    };
  }
</script>

<div class="ppp-chart-widget" class:ppp-chart-widget--degenerate={isDegenerate} style={isDegenerate ? "" : `min-height: ${heightPx}px`}>
  {#if isDegenerate}
    <div class="ppp-chart-degenerate-hint" role="note">
      <span class="ppp-chart-degenerate-hint__icon" aria-hidden="true">⚠</span>
      <span>{$i18n.t("views.dashboard.chart.degenerate-hint", {
        defaultValue: "All records share the same value of '{{field}}' — the chart shows only one category. Add variety to your data or change the X field.",
        field: config.xAxis.property,
      })}</span>
    </div>
  {:else if isEmpty}
    {#if correlationWarning}
      <div class="ppp-chart-correlation-warning" role="status">
        <span class="ppp-chart-correlation-warning__icon" aria-hidden="true">⚠</span>
        <span>
          {#if correlationWarning.kind === "missing-right"}
            {$i18n.t("views.dashboard.chart.scatter.warn-missing-right", {
              defaultValue: "Right source is not loaded. Check the selected source id and that the sibling project is still available.",
            })}
          {:else if correlationWarning.kind === "no-matches"}
            {$i18n.t("views.dashboard.chart.scatter.warn-no-matches", {
              defaultValue: "No records matched on the join key. Verify the left/right key names and that values overlap.",
            })}
          {/if}
        </span>
      </div>
    {:else}
      <div class="ppp-chart-empty">{$i18n.t("views.dashboard.chart.no-data")}</div>
    {/if}
  {:else if isScatter && scatterData}
    {#if correlationWarning && correlationWarning.kind === "mostly-unmatched"}
      <div class="ppp-chart-correlation-warning ppp-chart-correlation-warning--inline" role="status">
        <span class="ppp-chart-correlation-warning__icon" aria-hidden="true">⚠</span>
        <span>{$i18n.t("views.dashboard.chart.scatter.warn-mostly-unmatched", {
          defaultValue: "Only {{matched}} of {{total}} records matched — results may be skewed.",
          matched: correlationWarning.matched,
          total: correlationWarning.total,
        })}</span>
      </div>
    {/if}
    <ScatterChart
      data={scatterData}
      width={480}
      height={heightPx}
      style={config.style}
      pointRadius={scatterConfig?.pointRadius ?? 5}
      opacity={scatterConfig?.opacity ?? 0.8}
      showTrendLine={scatterConfig?.showTrendLine ?? true}
      showR2={scatterConfig?.showR2 ?? true}
    />
  {:else if config.chartType === "bar" || config.chartType === "stacked-bar"}
    <BarChart data={chartData} width={480} height={heightPx} style={config.style} />
  {:else if config.chartType === "horizontal-bar"}
    <BarChart data={chartData} width={480} height={heightPx} style={config.style} horizontal />
  {:else if config.chartType === "line"}
    <LineChart data={chartData} width={480} height={heightPx} style={config.style} />
  {:else if config.chartType === "area"}
    <LineChart data={chartData} width={480} height={heightPx}
      style={{ ...config.style, gradient: true }} />
  {:else if config.chartType === "pie"}
    <PieChart data={chartData} width={heightPx} height={heightPx} style={config.style} />
  {:else if config.chartType === "donut"}
    <PieChart data={chartData} width={heightPx} height={heightPx} style={config.style} donut />
  {:else if config.chartType === "number"}
    <NumberChart data={chartData} style={config.style} />
  {:else if config.chartType === "progress"}
    <ProgressChart data={chartData} width={480} style={config.style} />
  {/if}
</div>

<style>
  .ppp-chart-widget {
    padding: var(--ppp-space-sm, 0.25rem);
    overflow: hidden;
  }

  /* When degenerate, collapse to just the banner (no wasted space) */
  .ppp-chart-widget--degenerate {
    min-height: 0;
  }

  .ppp-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 6rem;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .ppp-chart-degenerate-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    margin-bottom: 0.375rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    background: color-mix(in srgb, var(--text-warning, orange) 12%, var(--background-secondary));
    border: 0.0625rem solid color-mix(in srgb, var(--text-warning, orange) 30%, transparent);
    border-radius: var(--radius-s, 0.25rem);
    line-height: 1.3;
  }

  .ppp-chart-degenerate-hint__icon {
    flex-shrink: 0;
  }

  /* Correlation diagnostics (Pillar 5). Shares visual language with the
     degenerate-hint banner but uses a distinct class so UI rules can target
     correlation-specific variants independently. */
  .ppp-chart-correlation-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    margin-bottom: 0.375rem;
    font-size: var(--font-ui-smaller, 0.75rem);
    color: var(--text-muted);
    background: color-mix(in srgb, var(--text-warning, orange) 12%, var(--background-secondary));
    border: 0.0625rem solid color-mix(in srgb, var(--text-warning, orange) 30%, transparent);
    border-radius: var(--radius-s, 0.25rem);
    line-height: 1.3;
  }

  .ppp-chart-correlation-warning--inline {
    margin-bottom: 0.25rem;
  }

  .ppp-chart-correlation-warning__icon {
    flex-shrink: 0;
  }

  /* Matryoshka: compact chart in narrow container */
  @container widget (max-width: 20rem) {
    .ppp-chart-widget :global(.chart-legend) {
      display: none;
    }
  }
</style>

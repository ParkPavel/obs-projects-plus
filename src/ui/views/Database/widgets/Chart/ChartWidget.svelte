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

  const EMPTY_CHART: ChartData = { labels: [], series: [] };

  $: isScatter = config.chartType === "scatter";
  $: chartData = isScatter ? EMPTY_CHART : computeChartData(source, config);
  $: scatterConfig = isScatter ? extractScatterConfig(config) : null;
  $: scatterData = isScatter && scatterConfig ? computeScatterData(source, scatterConfig) : null;
  $: heightPx = chartHeightPx(config.style.height);
  $: isEmpty = isScatter
    ? (scatterData?.points.length ?? 0) === 0
    : (chartData.labels.length === 0 && config.chartType !== "number");

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

<div class="ppp-chart-widget" style="min-height: {heightPx}px">
  {#if isEmpty}
    <div class="ppp-chart-empty">{$i18n.t("views.database.chart.no-data")}</div>
  {:else if isScatter && scatterData}
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

  .ppp-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 6rem;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  /* Matryoshka: compact chart in narrow container */
  @container widget (max-width: 20rem) {
    .ppp-chart-widget :global(.chart-legend) {
      display: none;
    }
  }
</style>

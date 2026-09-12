<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { ChartConfig, ChartData, ScatterChartConfig } from "../../types";
  import { computeChartData, computeScatterData, chartHeightPx } from "src/lib/dashboard-engine/chartDataPipeline";
  import BarChart from "./BarChart.svelte";
  import LineChart from "./LineChart.svelte";
  import PieChart from "./PieChart.svelte";
  import NumberChart from "./NumberChart.svelte";
  import ProgressChart from "./ProgressChart.svelte";
  import ScatterChart from "./ScatterChart.svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { getContext } from "svelte";
  import {
    SELECTION_CONTEXT_KEY,
    type SelectionState,
    type SelectionStore,
  } from "../../canvasSelectionStore";
  import {
    computeChartSelectionToggle,
    getSelectedChartLabel,
  } from "./chartSelectionDriver";
  import { CHART_WIDTH_FALLBACK, resolveChartWidth } from "./chartWidth";

  export let config: ChartConfig;
  export let source: DataFrame;
  /** Pillar 5: preloaded DataFrame for scatter correlation. */
  export let rightFrame: DataFrame | null = null;
  /**
   * #044.2: widget id used to discriminate this chart's selection from
   * sibling drivers on the same canvas. Optional so tests and non-canvas
   * mounts (config previews) keep working without a selection store.
   */
  export let widgetId: string = "";

  // #044.2: optional per-canvas selection store. `undefined` in non-canvas
  // mounts; the driver simply becomes inert.
  const selectionStore = getContext<SelectionStore | undefined>(SELECTION_CONTEXT_KEY);
  let currentSelection: SelectionState | null = null;
  if (selectionStore) {
    selectionStore.subscribe((v) => {
      currentSelection = v;
    });
  }

  // Self-highlight only — receiver-style cross-widget dimming lands in #044.4/.5.
  $: selectedLabel = (() => {
    if (!selectionStore || !currentSelection || widgetId === "") return null;
    return getSelectedChartLabel(currentSelection, {
      widgetId,
      field: config.xAxis.property,
    });
  })();

  function handleSegmentSelect(label: string): void {
    if (!selectionStore || widgetId === "") return;
    const next = computeChartSelectionToggle(
      currentSelection ?? { source: null, field: null, values: [], op: null },
      { widgetId, field: config.xAxis.property, value: label },
    );
    if (next.kind === "set") {
      selectionStore.setSelection({
        source: next.source,
        field: next.field,
        values: next.values,
      });
    } else if (next.kind === "clear") {
      selectionStore.clearSelection();
    }
  }

  /*
   * #166 Step 2 — the container decides the chart's scale. `bind:contentRect`
   * is the ResizeObserver-backed binding in Svelte 3.59 and reports the CONTENT
   * box, which is the box the `<svg>` fills; feeding that width into the viewBox
   * makes one user unit one CSS pixel at every widget width. `bind:clientWidth`
   * would have measured this element's padding as well and, in this Svelte
   * version, compiles to an injected `<iframe>` plus a `style.position` write.
   */
  let contentRect: DOMRectReadOnly | undefined = undefined;
  let chartWidth: number = CHART_WIDTH_FALLBACK;
  $: chartWidth = resolveChartWidth(contentRect?.width, chartWidth);

  const EMPTY_CHART: ChartData = { labels: [], series: [] };

  // #094 — semantic status-group labels, mirroring Board's keys so a Status
  // chart shows the same To Do / In Progress / Done / No Status as the Board.
  $: semanticLabels = {
    todo: $i18n.t("views.board.status-groups.todo", { defaultValue: "To Do" }),
    inProgress: $i18n.t("views.board.status-groups.in-progress", { defaultValue: "In Progress" }),
    complete: $i18n.t("views.board.status-groups.complete", { defaultValue: "Done" }),
    none: $i18n.t("views.board.no-status", { defaultValue: "No Status" }),
  };

  $: isScatter = config.chartType === "scatter";
  $: chartData = isScatter ? EMPTY_CHART : computeChartData(source, config, semanticLabels);
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

<div class="ppp-chart-widget" class:ppp-chart-widget--degenerate={isDegenerate} style={isDegenerate ? "" : `min-height: ${heightPx}px`} bind:contentRect>
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
      width={chartWidth}
      height={heightPx}
      style={config.style}
      pointRadius={scatterConfig?.pointRadius ?? 5}
      opacity={scatterConfig?.opacity ?? 0.8}
      showTrendLine={scatterConfig?.showTrendLine ?? true}
      showR2={scatterConfig?.showR2 ?? true}
    />
  {:else if config.chartType === "bar" || config.chartType === "stacked-bar"}
    <BarChart data={chartData} width={chartWidth} height={heightPx} style={config.style}
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "horizontal-bar"}
    <BarChart data={chartData} width={chartWidth} height={heightPx} style={config.style} horizontal
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "line"}
    <LineChart data={chartData} width={chartWidth} height={heightPx} style={config.style}
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "area"}
    <LineChart data={chartData} width={chartWidth} height={heightPx}
      style={{ ...config.style, gradient: true }}
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "pie"}
    <PieChart data={chartData} width={Math.min(chartWidth, heightPx)} height={heightPx} style={config.style}
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "donut"}
    <PieChart data={chartData} width={Math.min(chartWidth, heightPx)} height={heightPx} style={config.style} donut
      {selectedLabel} on:select={(e) => handleSegmentSelect(e.detail.label)} />
  {:else if config.chartType === "number"}
    <NumberChart data={chartData} style={config.style} />
  {:else if config.chartType === "progress"}
    <ProgressChart data={chartData} width={chartWidth} style={config.style} />
  {/if}
</div>

<style>
  /* #165 pilot for the container-derived scale. This element is a DESCENDANT
     of WidgetShell's `widget` container (`container-type: inline-size`), so
     `cqi` inside these tokens measures the widget's own width. The padding is
     in `em` and therefore follows the font-size, which is where the container
     decides.

     What this font-size reaches is the HTML text inside the wrapper, and only
     that: NumberChart (which declares no font-size of its own) and the
     empty / degenerate / correlation banners.

     It does NOT reach the SVG charts, and #166 deliberately did not make it.
     Their labels are `font-size="11"`-style presentation attributes in viewBox
     user units; a CSS font-size would override the attribute while staying
     invisible to `axisLabels.ts`, which sizes the label box, the bottom padding,
     the rotation threshold and the cull step from that same number. Renderer and
     geometry would then disagree — overlapping ticks — and no gate can see it,
     because jsdom does not lay out SVG text. So #166 pins the viewBox width to
     the MEASURED container width instead (`bind:contentRect` above): one user
     unit becomes one CSS pixel, so 11 units render at 11 CSS pixels at any width,
     and `axisLabels.ts` receives the true available width and culls honestly.
     Measured both ways in `docs/internal/probes/166-chart-viewbox-scale.html`;
     the decision is ADR_MATRYOSHKA_SIZING_2026-09-02 Q1. Making the labels GROW
     with the container is still possible, but only as a number threaded into the
     layout model — never as CSS. */
  .ppp-chart-widget {
    font-size: var(--ppp-local-text-sm);
    padding: var(--ppp-local-pad-sm);
    overflow: hidden;
  }

  /* When degenerate, collapse to just the banner (no wasted space) */
  .ppp-chart-widget--degenerate {
    min-height: 0;
  }

  .ppp-chart-widget {
    aspect-ratio: var(--ppp-chart-aspect, auto);
  }

  .ppp-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--ppp-db-chart-empty-height, 6rem);
    color: var(--ppp-db-text-secondary, var(--text-muted));
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

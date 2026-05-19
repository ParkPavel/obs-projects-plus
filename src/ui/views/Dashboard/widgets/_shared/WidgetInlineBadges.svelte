<script lang="ts" context="module">
  import type { ColumnAggregation } from "../../types";

  /**
   * #034.3 / #040.2 — labels used by inline header badges. Kept exported
   * (via context="module") so tests can import the same map and don't
   * have to hard-code label strings.
   */
  export const AGG_LABEL: Partial<Record<ColumnAggregation, string>> = {
    sum: "SUM",
    avg: "AVG",
    median: "MEDIAN",
    min: "MIN",
    max: "MAX",
    range: "RANGE",
    count_total: "COUNT",
    count_values: "COUNT",
    count_unique: "UNIQUE",
    count_checked: "✓",
    count_unchecked: "✗",
    percent_checked: "%✓",
    percent_unchecked: "%✗",
    percent_empty: "%∅",
    percent_not_empty: "%¬∅",
    earliest: "EARLIEST",
    latest: "LATEST",
    date_range: "RANGE",
  };
</script>

<script lang="ts">
  /**
   * WidgetInlineBadges.svelte — renders inline informational badges into the
   * WindowShell `badges` slot for stats / chart / data-table widgets.
   *
   * Spec: #034.3 (orchestrator brief — Phase 4 sub-PR 3) + #040.2 inline
   * consumer wiring of the slot API introduced in #034.1.
   *
   * Per spec, badges that have no existing first-class picker are rendered
   * as static info only (no on:click). Cog ⚙ in the WidgetHost header
   * remains the canonical entry point to chart/stats configuration, so
   * making the badge clickable would duplicate that surface — explicitly
   * out of scope here.
   */

  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type {
    ChartConfig,
    DataTableConfig,
    StatsConfig,
    WidgetDefinition,
  } from "../../types";

  export let widget: WidgetDefinition;
  export let frame: DataFrame;
  export let tableConfig: DataTableConfig | undefined = undefined;

  function isChartConfig(cfg: unknown): cfg is ChartConfig {
    return (
      !!cfg && typeof cfg === "object" && "chartType" in (cfg as object)
    );
  }

  function isStatsConfig(cfg: unknown): cfg is StatsConfig {
    return !!cfg && typeof cfg === "object" && "cards" in (cfg as object);
  }

  function aggLabel(agg: string): string {
    return AGG_LABEL[agg as keyof typeof AGG_LABEL] ?? agg.toUpperCase();
  }

  $: chartCfg =
    widget.type === "chart" && isChartConfig(widget.config)
      ? widget.config
      : null;
  $: statsCfg =
    widget.type === "stats" && isStatsConfig(widget.config)
      ? widget.config
      : null;
  $: effectiveTableConfig =
    widget.type === "data-table"
      ? (widget.config as { table?: DataTableConfig })?.table ?? tableConfig
      : undefined;
</script>

{#if chartCfg}
  <span
    class="ppp-widget-badge ppp-widget-badge--type"
    data-testid="widget-badge-chart-type"
    title="Chart type"
  >
    {chartCfg.chartType}
  </span>
  {#if chartCfg.yAxis?.aggregation && chartCfg.yAxis.aggregation !== "none"}
    <span
      class="ppp-widget-badge ppp-widget-badge--agg"
      data-testid="widget-badge-chart-agg"
      title="Y-axis aggregation"
    >
      {aggLabel(chartCfg.yAxis.aggregation)}
    </span>
  {/if}
{:else if statsCfg}
  {#if statsCfg.cards.length === 1}
    <span
      class="ppp-widget-badge ppp-widget-badge--agg"
      data-testid="widget-badge-stats-agg"
      title="Aggregation"
    >
      {aggLabel(statsCfg.cards[0].aggregation)}
    </span>
  {:else if statsCfg.cards.length > 1}
    <span
      class="ppp-widget-badge ppp-widget-badge--count"
      data-testid="widget-badge-stats-count"
      title="Number of cards"
    >
      {statsCfg.cards.length} cards
    </span>
  {/if}
{:else if widget.type === "data-table"}
  <span
    class="ppp-widget-badge ppp-widget-badge--count"
    data-testid="widget-badge-table-cols"
    title="Visible columns"
  >
    {frame.fields.length} cols
  </span>
  {#if effectiveTableConfig?.groupBy?.field}
    <span
      class="ppp-widget-badge ppp-widget-badge--grouped"
      data-testid="widget-badge-table-grouped"
      title="Grouped by {effectiveTableConfig.groupBy.field}"
    >
      grouped
    </span>
  {/if}
{/if}

<style>
  .ppp-widget-badge {
    display: inline-flex;
    align-items: center;
    height: 1.25rem;
    padding: 0 0.5rem;
    border-radius: var(--ppp-radius-pill, 62.5rem);
    background: var(--ppp-surface-2, var(--background-secondary));
    color: var(--text-muted);
    font-size: 0.75rem;
    line-height: 1;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    white-space: nowrap;
    border: var(--ppp-border-subtle);
  }
</style>

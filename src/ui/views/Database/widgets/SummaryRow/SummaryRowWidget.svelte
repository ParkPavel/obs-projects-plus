<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { SummaryColumnConfig, ColumnAggregation } from "../../types";
  import { computeAggregateValue } from "../../engine/aggregation";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown>;
  export let source: DataFrame;
  export let pipelineSteps: number = 0;

  interface SummaryCell {
    field: string;
    label: string;
    aggregation: ColumnAggregation;
    format: string;
    value: string;
  }

  $: columns = (config["columns"] as SummaryColumnConfig[] | undefined) ?? [];
  $: cells = columns.length ? computeCells(columns, source) : [];

  /** Map ColumnAggregation → short localized label (reuses chart.aggregations keys where possible) */
  function aggLabel(agg: ColumnAggregation): string {
    const t = $i18n.t;
    switch (agg) {
      case "sum": return t("views.database.chart.aggregations.sum", { defaultValue: "Sum" });
      case "avg": return t("views.database.chart.aggregations.average", { defaultValue: "Avg" });
      case "min": return t("views.database.chart.aggregations.min", { defaultValue: "Min" });
      case "max": return t("views.database.chart.aggregations.max", { defaultValue: "Max" });
      case "median": return t("views.database.chart.aggregations.median", { defaultValue: "Median" });
      case "count": return t("views.database.chart.aggregations.count", { defaultValue: "Count" });
      case "count_values": return t("views.database.chart.aggregations.count", { defaultValue: "Count" });
      case "count_unique": return t("views.database.chart.aggregations.unique", { defaultValue: "Unique" });
      case "count_checked": return "✓ count";
      case "count_unchecked": return "✗ count";
      case "percent_checked": return "% ✓";
      case "percent_unchecked": return "% ✗";
      case "percent_empty": return "% empty";
      case "percent_not_empty": return "% filled";
      case "range": return "Range";
      case "earliest": return "Earliest";
      case "latest": return "Latest";
      case "date_range": return "Date range";
      default: return String(agg);
    }
  }

  function computeCells(columns: readonly SummaryColumnConfig[], df: DataFrame): SummaryCell[] {
    return columns.map((col) => {
      const vals = df.records.map((r) => r.values[col.field] ?? undefined);
      const result = computeAggregateValue(vals, col.aggregation);
      return {
        field: col.field,
        aggregation: col.aggregation,
        format: col.format ?? "number",
        label: `${aggLabel(col.aggregation)} · ${col.field}`,
        value: formatResult(typeof result === "number" ? result : null, col.format, col.currencySymbol),
      };
    });
  }

  function formatResult(val: number | null, fmt?: SummaryColumnConfig["format"], currencySymbol?: string): string {
    if (val == null) return "—";
    switch (fmt) {
      case "percent": return val.toFixed(1) + "%";
      case "currency": return (currencySymbol ?? "$") + val.toLocaleString();
      case "number":
      default:
        return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
    }
  }
</script>

<div class="ppp-summary-widget">
  <!-- Transparency bar: show data source size + pipeline depth + column rules -->
  <div class="ppp-summary-rules" title={$i18n.t("views.database.widget.rules-hint", { defaultValue: "Rules that drive this widget" })}>
    <span class="ppp-summary-rules__item">
      <strong>{source.records.length}</strong>
      {$i18n.t("views.database.widget.records", { defaultValue: "records" })}
    </span>
    <span class="ppp-summary-rules__sep">·</span>
    <span class="ppp-summary-rules__item">
      {$i18n.t("views.database.widget.pipeline-steps", { defaultValue: "pipeline steps" })}: <strong>{pipelineSteps}</strong>
    </span>
    <span class="ppp-summary-rules__sep">·</span>
    <span class="ppp-summary-rules__item">
      {$i18n.t("views.database.widget.columns", { defaultValue: "columns" })}: <strong>{columns.length}</strong>
    </span>
  </div>

  {#if cells.length === 0}
    <div class="ppp-summary-empty">
      {$i18n.t("views.database.widget.summary-empty", { defaultValue: "No columns configured. Open the gear icon to add aggregations." })}
    </div>
  {:else}
    <div class="ppp-summary-row">
      {#each cells as cell (cell.field + cell.aggregation)}
        <div class="ppp-summary-cell" title="{cell.label} ({cell.format})">
          <span class="ppp-summary-label">{cell.label}</span>
          <span class="ppp-summary-value">{cell.value}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ppp-summary-widget {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .ppp-summary-rules {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.625rem;
    background: var(--background-modifier-hover);
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-smaller, 0.7rem);
    color: var(--text-muted);
  }
  .ppp-summary-rules__item strong {
    color: var(--text-normal);
    font-weight: 600;
  }
  .ppp-summary-rules__sep {
    color: var(--text-faint);
  }

  .ppp-summary-empty {
    padding: 0.5rem 0.75rem;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-style: italic;
  }

  .ppp-summary-row {
    display: flex;
    gap: 1rem;
    padding: 0.375rem 0.75rem;
    background: var(--background-secondary);
    border-radius: var(--radius-s, 0.25rem);
    overflow-x: auto;
  }

  .ppp-summary-cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 4rem;
    flex-shrink: 0;
  }

  .ppp-summary-label {
    font-size: var(--font-ui-smaller, 0.7rem);
    color: var(--text-faint);
    white-space: nowrap;
  }

  .ppp-summary-value {
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
    white-space: nowrap;
  }

  /* Matryoshka: wrap summary cells in narrow container */
  @container widget (max-width: 20rem) {
    .ppp-summary-row {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .ppp-summary-cell {
      min-width: 3rem;
    }
  }
</style>

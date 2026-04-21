<script lang="ts">
  import type { DataFrame } from "src/lib/dataframe/dataframe";
  import type { SummaryColumnConfig } from "../../types";
  import { computeAggregateValue } from "../../engine/aggregation";

  export let config: Record<string, unknown>;
  export let source: DataFrame;

  interface SummaryCell {
    field: string;
    value: string;
  }

  $: columns = (config["columns"] as SummaryColumnConfig[] | undefined) ?? [];
  $: cells = columns.length ? computeCells(columns, source) : [];

  function computeCells(columns: readonly SummaryColumnConfig[], df: DataFrame): SummaryCell[] {
    return columns.map((col) => {
      const vals = df.records.map((r) => r.values[col.field] ?? undefined);
      const result = computeAggregateValue(vals, col.aggregation);
      return {
        field: col.field,
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

<div class="ppp-summary-row">
  {#each cells as cell (cell.field)}
    <div class="ppp-summary-cell">
      <span class="ppp-summary-label">{cell.field}</span>
      <span class="ppp-summary-value">{cell.value}</span>
    </div>
  {/each}
</div>

<style>
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
    align-items: center;
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

<script lang="ts">
  /**
   * TableFooter — F2.1 (TABLE_V2_CANON §1/§2). Sticky aggregation row fed by
   * the canonical computeAggregations. The «Calculate ▸» entry point per
   * column arrives with the header menu in F2.4.
   */
  import type { AggregationResult } from "../../types";
  import type { TableColumn } from "./tableCanon";

  export let columns: TableColumn[];
  export let aggregations: AggregationResult;
</script>

<div class="ppp-t2-footer" role="row">
  {#each columns as col (col.field.name)}
    {@const agg = aggregations[col.field.name]}
    <div class="ppp-t2-footer-cell" role="gridcell">
      {#if agg}
        <span class="ppp-t2-footer-fn">{agg.function.replace(/_/g, " ")}</span>
        <span class="ppp-t2-footer-value">{agg.formattedValue}</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ppp-t2-footer {
    display: grid;
    grid-template-columns: var(--ppp-dt-columns);
    position: sticky;
    bottom: 0;
    background: var(--background-secondary);
    border-top: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-t2-footer-cell {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 0.25rem;
    min-width: 0;
    height: 1.75rem;
    padding: 0 0.5rem;
    overflow: hidden;
  }

  .ppp-t2-footer-fn {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    text-transform: lowercase;
    white-space: nowrap;
  }

  .ppp-t2-footer-value {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>

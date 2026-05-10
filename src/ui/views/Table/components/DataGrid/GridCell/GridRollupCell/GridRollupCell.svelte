<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  $: fn = column.typeConfig?.rollup?.function ?? "";
  $: isPercentFn = fn.startsWith("percent_") || fn === "percent_true";
  $: isListFn = fn === "show_original" || fn === "show_unique" || fn === "concat" || fn === "concat_unique";

  $: percentValue = isPercentFn ? parsePercent(value) : null;
  $: chips = isListFn ? splitChips(value) : null;
  $: plainText = !isPercentFn && !isListFn ? formatPlain(value) : "";

  function parsePercent(val: Optional<DataValue>): number {
    if (val == null) return 0;
    const str = String(val).replace("%", "");
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
  }

  function splitChips(val: Optional<DataValue>): string[] {
    if (val == null || val === "") return [];
    return String(val).split(",").map((s) => s.trim()).filter(Boolean);
  }

  function formatPlain(val: Optional<DataValue>): string {
    if (val == null) return "—";
    if (Array.isArray(val)) return val.map(String).join(", ");
    if (typeof val === "number") {
      return Number.isInteger(val) ? val.toString() : val.toFixed(2);
    }
    return String(val);
  }
</script>

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <span slot="read" class="ppp-rollup-cell">
    {#if isPercentFn && percentValue !== null}
      <span class="ppp-rollup-bar-wrap" title="{percentValue}%">
        <span class="ppp-rollup-bar" style="width: {percentValue}%"></span>
        <span class="ppp-rollup-bar-label">{Math.round(percentValue)}%</span>
      </span>
    {:else if chips !== null}
      {#if chips.length === 0}
        <span class="ppp-rollup-empty">—</span>
      {:else}
        <span class="ppp-rollup-chips">
          {#each chips as chip}
            <span class="ppp-rollup-chip">{chip}</span>
          {/each}
        </span>
      {/if}
    {:else}
      {plainText}
    {/if}
  </span>
</GridCell>

<style>
  .ppp-rollup-cell {
    display: flex;
    align-items: center;
    padding: 0 0.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    width: 100%;
  }

  .ppp-rollup-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
  }

  .ppp-rollup-bar {
    display: block;
    height: 0.375rem;
    border-radius: 0.1875rem;
    background: var(--interactive-accent);
    opacity: 0.7;
    min-width: 0.125rem;
    flex-shrink: 0;
    transition: width 150ms ease;
  }

  .ppp-rollup-bar-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ppp-rollup-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1875rem;
    align-items: center;
  }

  .ppp-rollup-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.75rem;
    background: var(--background-modifier-hover);
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    white-space: nowrap;
  }

  .ppp-rollup-empty {
    color: var(--text-faint);
  }
</style>

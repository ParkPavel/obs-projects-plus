<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  $: displayValue = formatRollup(value);

  function formatRollup(val: Optional<DataValue>): string {
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
    {displayValue}
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
  }
</style>

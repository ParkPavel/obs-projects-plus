<script lang="ts">
  export let onColumnAdd: (columns: string[], name: string) => void;
  export let onSortColumns: (columns: string[]) => void;
  $: void $$restProps;
</script>
<button type="button" on:click={() => onColumnAdd([], "External column")}>Probe column callback</button>
<button type="button" on:click={() => onSortColumns(["high", "low"])}>Probe reorder callback</button>

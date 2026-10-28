<script lang="ts">
  export let onColumnAdd: (columns: string[], name: string) => void;
  $: void $$restProps;
</script>
<button type="button" on:click={() => onColumnAdd([], "External column")}>Probe column callback</button>

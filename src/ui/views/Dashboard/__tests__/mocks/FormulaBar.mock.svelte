<script>
  import { createEventDispatcher } from "svelte";

  export let fields = [];
  export let previewRecord = undefined;
  export let previewFrame = undefined;
  export let formulaFields = [];

  const dispatch = createEventDispatcher();
</script>

<div class="ppp-formula-bar" data-testid="formula-bar" data-preview-frame={!!previewFrame} data-formula-count={formulaFields.length}>
  Formula Bar Mock ({fields.length})
  {#if previewRecord}
    <span data-testid="formula-bar-preview">preview</span>
  {/if}
  <button class="formula-bar-apply" on:click={() => dispatch("apply", { name: "Profit", expression: "amount" })}>
    Apply formula
  </button>
  <button class="formula-bar-cancel" on:click={() => dispatch("cancel")}>Cancel formula</button>
</div>

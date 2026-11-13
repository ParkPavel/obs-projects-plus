<script>
  import { createEventDispatcher } from "svelte";
  export let value = "", placeholder = "", width = "auto";
  const dispatch = createEventDispatcher();
  $: dispatch("input", value);
</script>
<!-- Match installed obsidian-svelte: input is a scalar CustomEvent; blur/key are native. -->
<input class="multi-text-input" {placeholder} style:width bind:value on:input={() => dispatch("input", value)} on:blur on:keydown />

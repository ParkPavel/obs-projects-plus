<!-- Stand-in for obsidian-svelte TextInput: a real input that forwards keydown
     and reports typed text the way the real control does (event.detail). -->
<script>
  import { createEventDispatcher } from "svelte";
  export let value = "";
  export let ref = undefined;
  export let placeholder = "";
  export let error = false;
  export let helperText = "";
  export let autoFocus = false;
  const dispatch = createEventDispatcher();
</script>

<input
  bind:this={ref}
  data-testid="text-input"
  data-error={error}
  data-helper={helperText}
  data-autofocus={autoFocus}
  {placeholder}
  {value}
  on:input={(e) => dispatch("input", e.currentTarget.value)}
  on:keydown
/>

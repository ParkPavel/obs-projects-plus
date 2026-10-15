<!-- Stand-in for obsidian-svelte Select: a native select that reports the
     chosen value as event.detail, like the real control. -->
<script>
  import { createEventDispatcher } from "svelte";
  export let value = "";
  export let options = [];
  const dispatch = createEventDispatcher();
</script>

<select data-testid="select" {value} on:change={(e) => dispatch("change", e.currentTarget.value)}>
  {#each options as option}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>

<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let variant: string | undefined = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher();
</script>

<button
  {...$$restProps}
  class={variant ? `mod-${variant}` : ""}
  {disabled}
  on:click={(event) => dispatch("click", event)}
>
  <slot />
</button>

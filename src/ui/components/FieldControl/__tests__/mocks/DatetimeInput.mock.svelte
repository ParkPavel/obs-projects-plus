<script>
  import { createEventDispatcher } from "svelte";
  export const value = null;
  const dispatch = createEventDispatcher();
</script>

<button
  data-testid="blur-only"
  on:click={() => dispatch("blur")}
>
  blur
</button>

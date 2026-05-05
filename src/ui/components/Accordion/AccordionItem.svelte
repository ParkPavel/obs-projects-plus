<script lang="ts">
  import { Icon } from "obsidian-svelte";
  import { slide } from "svelte/transition";

  let open: boolean = false;
</script>

<section>
  <header on:click={() => (open = !open)} on:keypress>
    <slot name="header" />
    <Icon name={open ? "chevron-up" : "chevron-down"} />
  </header>

  {#if open}
    <div transition:slide={{ duration: 200 }}>
      <slot />
    </div>
  {/if}
</section>

<style>
  section {
    border-top: 1px solid var(--background-modifier-border);
  }

  div {
    padding: 0.5rem;
    background-color: var(--background-primary-alt);
  }

  header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    justify-content: space-between;
  }
</style>

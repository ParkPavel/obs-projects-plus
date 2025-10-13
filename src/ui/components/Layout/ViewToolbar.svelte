<script lang="ts">
  import { IconButton } from "obsidian-svelte";

  export let variant: "primary" | "secondary";
  export let collapsible: boolean = true;
  let clientWidth: number;
  let collapsed: boolean = false;

  $: isMobile = clientWidth < 480;
  function toggleCollapse() {
    if (!collapsible) return;
    collapsed = !collapsed;
  }
</script>

<div
  class="container"
  class:primary={variant === "primary"}
  class:secondary={variant === "secondary"}
  class:isMobile
  class:collapsed
  bind:clientWidth
>
  {#if collapsible}
    <div class="toggle">
      <IconButton
        icon={collapsed ? "chevron-down" : "chevron-up"}
        tooltip={collapsed ? "Show toolbar" : "Hide toolbar"}
        onClick={toggleCollapse}
      />
    </div>
  {/if}
  <div class="left" class:hidden={collapsed}>
    <slot name="left" />
  </div>
  <div class="info" class:hidden={collapsed}>
    <slot name="info" />
  </div>
  <div class="middle" class:hidden={collapsed}>
    <slot name="middle" />
  </div>
  <div class="right" class:hidden={collapsed}>
    <slot name="right" />
  </div>
</div>

<style>
  .container {
    display: flex;
    justify-content: flex-start;
    padding: var(--size-4-2);
    gap: var(--size-4-2);
    border-bottom: 1px solid var(--background-modifier-border);
    align-items: center;
    width: auto;
    position: relative;
    transition: padding 0.2s ease-in-out;
  }
  .container.collapsed {
    padding: 0;
    min-height: 24px; /* Adjust to fit the button */
    border-bottom: none;
  }

  .toggle {
    display: flex;
    align-items: center;
    transition: all 0.2s ease-in-out;
  }

  .container.collapsed .toggle {
    position: absolute;
    top: -4px;
    left: 4px;
    z-index: 1;
  }

  .middle {
    flex: 0 1 auto;
    overflow-x: auto;
    text-align: center;
    min-width: 200px;
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    flex-wrap: wrap;
  }
  .left {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    flex-wrap: wrap;
  }
  .isMobile {
    flex-direction: column;
    align-items: stretch;
  }
  .isMobile .right {
    align-items: stretch;
  }

  .hidden {
    display: none;
  }

  .primary {
    background-color: var(--background-primary);
  }
  .secondary {
    background-color: var(--background-primary-alt);
  }
</style>

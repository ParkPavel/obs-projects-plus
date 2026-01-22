<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { createEventDispatcher } from "svelte";

  export let variant: "primary" | "secondary";
  export let collapsible: boolean = true;
  export let collapsed: boolean = false;
  
  let clientWidth: number;

  $: isMobile = clientWidth < 480;
  
  const dispatch = createEventDispatcher<{ collapse: boolean }>();
  
  function toggleCollapse() {
    if (!collapsible) return;
    collapsed = !collapsed;
    dispatch('collapse', collapsed);
  }
</script>

<div
  class="toolbar-wrapper"
  class:collapsed
  class:isMobile
  bind:clientWidth
>
  {#if !collapsed}
    <div
      class="container"
      class:primary={variant === "primary"}
      class:secondary={variant === "secondary"}
      class:isMobile
    >
      {#if collapsible}
        <button
          class="toggle-button"
          on:click={toggleCollapse}
          title={$i18n.t("toolbar.collapse.hide")}
          aria-expanded={true}
          aria-label={$i18n.t("toolbar.collapse.hide")}
        >
          <svg 
            class="toggle-icon"
            width="14" 
            height="14" 
            viewBox="0 0 16 16" 
            fill="none"
          >
            <path 
              d="M4 6L8 10L12 6" 
              stroke="currentColor" 
              stroke-width="1.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
            />
          </svg>
        </button>
      {/if}
      <div class="content-wrapper">
        <div class="left">
          <slot name="left" />
        </div>
        <div class="info">
          <slot name="info" />
        </div>
        <div class="middle">
          <slot name="middle" />
        </div>
        <div class="right">
          <slot name="right" />
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Floating toggle button when collapsed -->
{#if collapsed && collapsible}
  <button
    class="floating-toggle"
    class:primary={variant === "primary"}
    class:secondary={variant === "secondary"}
    on:click={toggleCollapse}
    title={$i18n.t("toolbar.collapse.show")}
    aria-expanded={false}
    aria-label={$i18n.t("toolbar.collapse.show")}
  >
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="none"
    >
      {#if variant === "primary"}
        <!-- Menu icon for primary toolbar -->
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      {:else}
        <!-- Settings icon for secondary toolbar -->
        <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M13.5 8a5.5 5.5 0 01-11 0 5.5 5.5 0 0111 0z" stroke="currentColor" stroke-width="1.5"/>
      {/if}
    </svg>
  </button>
{/if}

<style>
  .toolbar-wrapper {
    position: relative;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toolbar-wrapper.collapsed {
    height: 0;
    min-height: 0;
  }

  .container {
    display: flex;
    align-items: center;
    padding: var(--ppp-spacing-xs, 0.375rem) var(--ppp-spacing-sm, 0.75rem);
    gap: var(--ppp-spacing-sm, 0.5rem);
    border-bottom: 1px solid var(--background-modifier-border);
    position: relative;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    opacity: 0.6;
  }

  .toggle-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    opacity: 1;
  }

  .toggle-button:active {
    transform: scale(0.92);
  }

  .toggle-icon {
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Floating toggle buttons when collapsed */
  .floating-toggle {
    position: fixed;
    top: 8px;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.5;
    backdrop-filter: blur(0.5rem);
    -webkit-backdrop-filter: blur(0.5rem);
  }

  .floating-toggle.primary {
    left: 8px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .floating-toggle.secondary {
    left: 48px;
    background: var(--background-secondary);
    color: var(--text-muted);
  }

  .floating-toggle:hover {
    opacity: 1;
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .floating-toggle:active {
    transform: scale(0.95);
  }

  .content-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow: hidden;
  }

  .middle {
    flex: 0 1 auto;
    overflow-x: auto;
    text-align: center;
  }

  .right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-left: auto;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .info {
    display: flex;
    align-items: center;
  }

  .isMobile .container,
  .container.isMobile {
    flex-direction: column;
    align-items: stretch;
    padding: 8px 12px;
    gap: 8px;
  }

  .isMobile .content-wrapper {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .isMobile .left {
    width: 100%;
  }

  .isMobile .middle {
    width: 100%;
    overflow-x: auto;
  }

  .isMobile .right {
    width: 100%;
    align-items: stretch;
    margin-left: 0;
    flex-wrap: nowrap;
    overflow-x: auto;
  }

  .primary {
    background-color: var(--background-primary);
  }

  .secondary {
    background-color: var(--background-secondary);
  }

  /* Mobile floating buttons */
  @media (max-width: 480px) {
    .floating-toggle {
      width: 36px;
      height: 36px;
      opacity: 0.6;
    }

    .floating-toggle.primary {
      left: 6px;
      top: 6px;
    }

    .floating-toggle.secondary {
      left: 50px;
      top: 6px;
    }
  }
</style>

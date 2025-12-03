<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";

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
  class="toolbar-wrapper"
  class:collapsed
  bind:clientWidth
>
  <div
    class="container"
    class:primary={variant === "primary"}
    class:secondary={variant === "secondary"}
    class:isMobile
    class:collapsed
  >
    {#if collapsible}
      <button
        class="toggle-button"
        class:collapsed
        on:click={toggleCollapse}
        title={collapsed ? $i18n.t("toolbar.collapse.show") : $i18n.t("toolbar.collapse.hide")}
        aria-expanded={!collapsed}
        aria-label={collapsed ? $i18n.t("toolbar.collapse.show") : $i18n.t("toolbar.collapse.hide")}
      >
        <svg 
          class="toggle-icon"
          class:collapsed
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
    <div class="content-wrapper" class:collapsed>
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
</div>

<style>
  .toolbar-wrapper {
    position: relative;
    overflow: hidden;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .container {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    gap: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
    position: relative;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .container.collapsed {
    padding: 4px 12px;
    border-bottom-color: transparent;
  }

  .toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
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

  .toggle-button.collapsed {
    opacity: 0.4;
  }

  .toggle-button.collapsed:hover {
    opacity: 0.8;
  }

  .toggle-button:active {
    transform: scale(0.92);
  }

  .toggle-icon {
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-icon.collapsed {
    transform: rotate(-90deg);
  }

  .content-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow: hidden;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 1;
    max-height: 100px;
  }

  .content-wrapper.collapsed {
    opacity: 0;
    max-height: 0;
    gap: 0;
    pointer-events: none;
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

  .isMobile {
    flex-direction: column;
    align-items: stretch;
    padding: 6px 8px;
  }

  .isMobile .content-wrapper {
    flex-direction: column;
    align-items: stretch;
  }

  .isMobile .right {
    align-items: stretch;
    margin-left: 0;
  }

  .primary {
    background-color: var(--background-primary);
  }

  .secondary {
    background-color: var(--background-secondary);
  }
</style>

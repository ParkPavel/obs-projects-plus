<script lang="ts">
  /**
   * Dashboard V2 — DG-3.
   *
   * Generic slide-in panel anchored to the right edge of the viewport.
   * Replaces the Modal pattern for field/filter/conditional-format
   * settings. Caller owns open state and slot content; this component
   * only handles transform animation, backdrop, and Esc-to-close.
   *
   * No bounce/spring — gentle 200ms ease-out per DG-8.
   */
  import { createEventDispatcher } from "svelte";

  export let open: boolean = false;
  export let title: string = "";
  /** Panel width in rem; honor device limits via max-width: 100vw. */
  export let width: string = "22rem";
  /** Hide the dimmed backdrop when stacking inside another panel. */
  export let backdrop: boolean = true;
  /** Aria-label override for the close button. */
  export let closeLabel: string = "Close panel";

  const dispatch = createEventDispatcher<{ close: void }>();

  function close() {
    dispatch("close");
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if backdrop}
  <div
    class="ppp-slide-in-backdrop"
    class:ppp-slide-in-backdrop--open={open}
    on:click={close}
    on:keydown={(e) => e.key === "Enter" && close()}
    role="button"
    tabindex="-1"
    aria-hidden={!open}
  ></div>
{/if}

<aside
  class="ppp-slide-in-panel"
  class:ppp-slide-in-panel--open={open}
  style:width
  style:max-width="100vw"
  role="dialog"
  aria-modal="true"
  aria-hidden={!open}
  aria-label={title}
>
  <header class="ppp-slide-in-header">
    {#if $$slots.icon}
      <slot name="icon" />
    {/if}
    <span class="ppp-slide-in-title">{title}</span>
    <button
      class="ppp-slide-in-close clickable-icon"
      on:click={close}
      aria-label={closeLabel}
      title={closeLabel}
    >✕</button>
  </header>
  <div class="ppp-slide-in-body">
    <slot />
  </div>
</aside>

<style>
  .ppp-slide-in-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.32);
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms cubic-bezier(0, 0, 0.2, 1);
    z-index: 40;
  }

  .ppp-slide-in-backdrop--open {
    opacity: 1;
    pointer-events: auto;
  }

  .ppp-slide-in-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--ppp-db-panel-bg, var(--background-primary));
    border-left: 0.0625rem solid var(--ppp-db-panel-border, var(--background-modifier-border));
    box-shadow: var(--ppp-db-panel-shadow, -0.125rem 0 0.75rem rgba(0, 0, 0, 0.08));
    transform: translateX(100%);
    transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    z-index: 50;
  }

  .ppp-slide-in-panel--open {
    transform: translateX(0);
  }

  .ppp-slide-in-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    flex-shrink: 0;
    min-height: 2.75rem;
  }

  .ppp-slide-in-title {
    flex: 1;
    font-weight: 600;
    font-size: var(--font-ui-medium, 0.875rem);
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-slide-in-close {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    font-size: 0.875rem;
  }

  .ppp-slide-in-close:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-slide-in-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .ppp-slide-in-panel,
    .ppp-slide-in-backdrop {
      transition: none;
    }
  }
</style>

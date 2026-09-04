<script lang="ts">
  /**
   * Dashboard V2 — DG-3.
   *
   * Generic slide-in panel anchored to the right edge of **the view**. Its one
   * consumer today is `RecordCardView`; the header used to advertise it as the
   * replacement for field/filter/conditional-format modals, which never
   * happened. Caller owns open state and slot content; this component only
   * handles transform animation, backdrop, and Esc-to-close.
   *
   * #190 — it was anchored to the WINDOW (`position: fixed`), which put it over
   * the plugin's own header, over the neighbouring leaf in a split, and over
   * Obsidian's chrome. It is now absolute inside the view's overlay layer, into
   * which both of its nodes portal themselves. Nothing about the behaviour
   * changed: modality, Escape, click-outside, timings are as they were.
   *
   * No bounce/spring — gentle 200ms ease-out per DG-8.
   */
  import { createEventDispatcher } from "svelte";
  import { focusTrap } from "src/lib/a11y/focusTrap";
  import { portalToOverlay } from "src/ui/app/overlayPortal";

  export let open: boolean = false;
  export let title: string = "";
  /** Panel width in rem; the layer caps it via max-inline-size: 100%. */
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
    use:portalToOverlay
    on:click={close}
    on:keydown={(e) => e.key === "Enter" && close()}
    role="button"
    tabindex="-1"
    aria-hidden={!open}
  ></div>
{/if}

<!-- `use:portalToOverlay` is declared BEFORE `use:focusTrap` deliberately.
     Today the panel mounts closed and the trap is inactive, so the order is
     inert; the moment anyone wraps this in `{#if open}`, reparenting a subtree
     that holds focus drops the focus in Chrome. Ordering costs nothing. -->
<aside
  class="ppp-slide-in-panel"
  class:ppp-slide-in-panel--open={open}
  style:width
  use:portalToOverlay
  use:focusTrap={{ active: open }}
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
  /* #190: `absolute`, so `inset: 0` means the view's overlay layer rather than
     the window — which is what used to dim the neighbouring leaf and Obsidian's
     own chrome. The dimming itself, its opacity and its timing are unchanged. */
  .ppp-slide-in-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.32);
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms cubic-bezier(0, 0, 0.2, 1);
    z-index: var(--ppp-z-base);
  }

  .ppp-slide-in-backdrop--open {
    opacity: 1;
    pointer-events: auto;
  }

  /* #190: absolute inside the overlay layer. `max-inline-size: 100%` replaces
     the inline `max-width: 100vw` — the cap belongs to the box that actually
     holds the panel, not to the window. There is deliberately no minimum:
     #182 ended by removing one, and re-introducing a floor here re-introduces
     that bug on a narrow phone. */
  .ppp-slide-in-panel {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    max-inline-size: 100%;
    pointer-events: auto;
    background: var(--ppp-db-panel-bg, var(--background-primary));
    border-left: 0.0625rem solid var(--ppp-db-panel-border, var(--background-modifier-border));
    box-shadow: var(--ppp-db-panel-shadow, -0.125rem 0 0.75rem rgba(0, 0, 0, 0.08));
    transform: translateX(100%);
    transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    z-index: var(--ppp-z-raised);
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

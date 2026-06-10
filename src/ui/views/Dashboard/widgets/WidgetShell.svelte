<script lang="ts">
  /**
   * #052 — WidgetShell: CSS Grid frame for Dashboard widgets.
   *
   * Provides the outer container (border, shadow, container query) and a
   * two-row grid (header / content). Actual widget content goes in the default
   * slot; header actions go in the "actions" named slot.
   *
   * ResizeObserver writes --ppp-widget-w so child components can branch on
   * actual rendered width without media queries.
   */
  import { onMount } from "svelte";

  export let title: string;
  export let collapsed: boolean = false;
  export let readonly: boolean = false;
  export let widgetId: string = "";
  export let widgetType: string = "";

  let shellEl: HTMLDivElement;

  onMount(() => {
    if (!shellEl) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        shellEl.style.setProperty("--ppp-widget-w", `${entry.contentRect.width}px`);
      }
    });
    ro.observe(shellEl);
    return () => ro.disconnect();
  });
</script>

<div
  class="ppp-widget-shell"
  class:ppp-widget-shell--collapsed={collapsed}
  bind:this={shellEl}
  aria-labelledby={widgetId ? `ppp-wshell-title-${widgetId}` : undefined}
>
  <header class="ppp-widget-shell__header">
    <span
      id={widgetId ? `ppp-wshell-title-${widgetId}` : undefined}
      class="ppp-widget-shell__title"
    >{title}</span>

    {#if widgetType && !readonly}
      <span class="ppp-widget-shell__type-badge" aria-hidden="true">({widgetType})</span>
    {/if}

    <div class="ppp-widget-shell__actions">
      <slot name="actions" />
    </div>

    <!-- DnD handle (consumed by WidgetGrid drag-and-drop) -->
    {#if !readonly}
      <span class="ppp-widget-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
    {/if}
  </header>

  {#if !collapsed}
    <div class="ppp-widget-shell__content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .ppp-widget-shell {
    display: grid;
    grid-template-areas: "header" "content";
    grid-template-rows: var(--ppp-db-toolbar-height, 2rem) 1fr;
    border: 0.0625rem solid var(--ppp-db-border, var(--background-modifier-border));
    border-radius: var(--radius-m, 0.5rem);
    background: var(--ppp-db-surface, var(--background-primary));
    overflow: hidden;
    container-type: inline-size;
    container-name: widget;
    transition: box-shadow var(--ppp-duration-normal, 150ms) ease;
  }

  .ppp-widget-shell--collapsed {
    grid-template-rows: var(--ppp-db-toolbar-height, 2rem) 0;
  }

  .ppp-widget-shell__header {
    grid-area: header;
    display: flex;
    align-items: center;
    gap: var(--ppp-space-3, 0.375rem);
    padding: 0 var(--ppp-space-4, 0.5rem);
    border-bottom: 0.0625rem solid var(--ppp-db-border, var(--background-modifier-border));
    background: var(--ppp-db-surface-raised, var(--background-secondary));
    user-select: none;
    min-height: var(--ppp-db-toolbar-height, 2rem);
  }

  .ppp-widget-shell__title {
    font-weight: var(--font-semibold, 600);
    font-size: var(--font-ui-small);
    color: var(--ppp-db-text-primary, var(--text-normal));
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-widget-shell__type-badge {
    font-size: var(--font-ui-smaller);
    color: var(--ppp-db-text-faint, var(--text-faint));
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 150ms) ease;
  }

  .ppp-widget-shell__header:hover .ppp-widget-shell__type-badge {
    opacity: 1;
  }

  .ppp-widget-shell__actions {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-1, 0.125rem);
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 150ms) ease;
  }

  .ppp-widget-shell:hover .ppp-widget-shell__actions {
    opacity: 1;
  }

  .ppp-widget-drag-handle {
    flex-shrink: 0;
    cursor: grab;
    color: var(--ppp-db-text-faint, var(--text-faint));
    font-size: 0.875rem;
    padding: 0 var(--ppp-space-1, 0.125rem);
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 150ms) ease;
  }

  .ppp-widget-shell:hover .ppp-widget-drag-handle {
    opacity: 1;
  }

  .ppp-widget-shell__content {
    grid-area: content;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Touch: always-visible actions */
  @media (pointer: coarse) {
    .ppp-widget-shell__actions,
    .ppp-widget-shell__type-badge,
    .ppp-widget-drag-handle {
      opacity: 1;
    }
  }
</style>

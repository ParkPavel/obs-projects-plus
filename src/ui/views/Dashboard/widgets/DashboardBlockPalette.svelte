<script lang="ts">
  import type { WidgetType } from "../types";
  import { WIDGET_REGISTRY, canAddWidget } from "./widgetRegistry";
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";

  export let currentWidgets: { type: WidgetType }[];

  let open = false;
  let paletteEl: HTMLDivElement;

  const dispatch = createEventDispatcher<{ addWidget: WidgetType }>();

  function handleAdd(type: WidgetType) {
    dispatch("addWidget", type);
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
      e.stopPropagation();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (open && paletteEl && !paletteEl.contains(e.target as Node)) {
      open = false;
    }
  }

  onMount(() => document.addEventListener("click", handleClickOutside, true));
  onDestroy(() => document.removeEventListener("click", handleClickOutside, true));
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="ppp-block-palette" bind:this={paletteEl} on:keydown={handleKeydown}>
  <button
    class="ppp-block-palette__trigger"
    on:click={() => (open = !open)}
    aria-label={$i18n.t("views.dashboard.canvas.add-widget", { defaultValue: "Add widget" })}
    aria-expanded={open}
  >+</button>

  {#if open}
    <div class="ppp-block-palette__popup" role="menu">
      {#each WIDGET_REGISTRY as meta}
        {@const allowed = canAddWidget(meta.type, currentWidgets)}
        <button
          class="ppp-block-palette__item"
          class:ppp-block-palette__item--disabled={!allowed}
          disabled={!allowed}
          on:click={() => handleAdd(meta.type)}
          role="menuitem"
        >
          <span class="ppp-block-palette__icon"><Icon name={meta.icon} /></span>
          <span>{$i18n.t(meta.labelKey)}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ppp-block-palette {
    position: relative;
    display: inline-flex;
  }

  .ppp-block-palette__trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: 0.0625rem dashed var(--background-modifier-border-hover);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    font-size: 1.125rem;
    line-height: 1;
    cursor: pointer;
    transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
  }

  .ppp-block-palette__trigger:hover,
  .ppp-block-palette__trigger[aria-expanded="true"] {
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-block-palette__trigger:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-block-palette__popup {
    position: absolute;
    bottom: calc(100% + 0.25rem);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--layer-popover, 30);
    padding: 0.25rem;
    background: var(--background-primary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-s);
    min-width: 10rem;
    animation: ppp-palette-in 150ms ease both;
  }

  @keyframes ppp-palette-in {
    from { opacity: 0; transform: translateX(-50%) translateY(0.25rem); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .ppp-block-palette__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.375rem 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    background: transparent;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    text-align: left;
  }

  .ppp-block-palette__item:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .ppp-block-palette__item--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ppp-block-palette__icon {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
</style>

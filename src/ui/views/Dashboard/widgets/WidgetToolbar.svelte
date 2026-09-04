<script lang="ts">
  import type { WidgetType } from "../types";
  import { WIDGET_REGISTRY, canAddWidget } from "./widgetRegistry";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";

  export let currentWidgets: { type: WidgetType }[];

  let open = false;
  let triggerEl: HTMLButtonElement | null = null;

  const dispatch = createEventDispatcher<{ addWidget: WidgetType }>();

  function handleAdd(type: WidgetType) {
    dispatch("addWidget", type);
    open = false;
  }

  // UT2026-A L2 (#086): same legacy filter as DashboardBlockPalette —
  // retired types are not creation candidates unless already on canvas.
  $: visibleMetas = WIDGET_REGISTRY.filter(
    (meta) => !meta.legacy || currentWidgets.some((w) => w.type === meta.type)
  );
</script>

<div class="ppp-widget-toolbar">
  <button
    bind:this={triggerEl}
    class="ppp-toolbar-add clickable-icon"
    on:click={() => (open = !open)}
    aria-label={$i18n.t("views.dashboard.widget.add-aria")}
    aria-expanded={open}
    aria-haspopup="menu"
  >
    + {$i18n.t("views.dashboard.widget.add")}
  </button>

  <FloatingPopup
    {triggerEl}
    bind:open
    placement="bottom-start"
    role="menu"
    ariaLabel={$i18n.t("views.dashboard.widget.add-aria")}
  >
    {#each visibleMetas as meta}
      {@const allowed = canAddWidget(meta.type, currentWidgets)}
      <button
        class="ppp-toolbar-option"
        class:ppp-toolbar-option--disabled={!allowed}
        disabled={!allowed}
        on:click={() => handleAdd(meta.type)}
        role="menuitem"
      >
        <span class="ppp-toolbar-icon"><Icon name={meta.icon} /></span>
        <span>{$i18n.t(meta.labelKey)}</span>
      </button>
    {/each}

  </FloatingPopup>
</div>

<style>
  .ppp-widget-toolbar {
    position: relative;
    display: inline-flex;
  }

  .ppp-toolbar-add {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.75rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: var(--background-secondary);
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-toolbar-add:hover {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
  }

  .ppp-toolbar-option {
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

  .ppp-toolbar-option:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .ppp-toolbar-option--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ppp-toolbar-icon {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

</style>

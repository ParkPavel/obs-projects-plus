<script lang="ts">
  import type { WidgetType, WidgetDefinition } from "../types";
  import { WIDGET_REGISTRY, canAddWidget } from "./widgetRegistry";
  import { WIDGET_TEMPLATES, type WidgetTemplate } from "../widgetTemplates";
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let currentWidgets: { type: WidgetType }[];

  let open = false;
  let showTemplates = false;
  let toolbarEl: HTMLDivElement;

  const dispatch = createEventDispatcher<{
    addWidget: WidgetType;
    applyTemplate: WidgetDefinition[];
  }>();

  function handleAdd(type: WidgetType) {
    dispatch("addWidget", type);
    open = false;
  }

  function handleTemplate(template: WidgetTemplate) {
    dispatch("applyTemplate", template.widgets);
    showTemplates = false;
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
      showTemplates = false;
      e.stopPropagation();
    }
  }

  function handleClickOutside(e: MouseEvent) {
    if (open && toolbarEl && !toolbarEl.contains(e.target as Node)) {
      open = false;
      showTemplates = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside, true);
  });
  onDestroy(() => {
    document.removeEventListener("click", handleClickOutside, true);
  });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="ppp-widget-toolbar" bind:this={toolbarEl} on:keydown={handleKeydown}>
  <button
    class="ppp-toolbar-add clickable-icon"
    on:click={() => (open = !open)}
    aria-label={$i18n.t("views.database.widget.add-aria")}
    aria-expanded={open}
  >
    + {$i18n.t("views.database.widget.add")}
  </button>

  {#if open}
    <div class="ppp-toolbar-dropdown" role="menu">
      {#each WIDGET_REGISTRY as meta}
        {@const allowed = canAddWidget(meta.type, currentWidgets)}
        <button
          class="ppp-toolbar-option"
          class:ppp-toolbar-option--disabled={!allowed}
          disabled={!allowed}
          on:click={() => handleAdd(meta.type)}
          role="menuitem"
        >
          <span class="ppp-toolbar-icon">{meta.icon}</span>
          <span>{$i18n.t(meta.labelKey)}</span>
        </button>
      {/each}

      {#if WIDGET_TEMPLATES.length > 0}
        <div class="ppp-toolbar-separator"></div>
        <button
          class="ppp-toolbar-option ppp-toolbar-option--section"
          on:click|stopPropagation={() => (showTemplates = !showTemplates)}
          role="menuitem"
        >
          <span class="ppp-toolbar-icon">📋</span>
          <span>{$i18n.t("views.database.widget.templates")} {showTemplates ? "▾" : "▸"}</span>
        </button>
        {#if showTemplates}
          {#each WIDGET_TEMPLATES as tpl}
            <button
              class="ppp-toolbar-option ppp-toolbar-option--template"
              on:click={() => handleTemplate(tpl)}
              role="menuitem"
              title={$i18n.t(tpl.descriptionKey)}
            >
              <span class="ppp-toolbar-tpl-label">{$i18n.t(tpl.labelKey)}</span>
              <span class="ppp-toolbar-tpl-desc">{$i18n.t(tpl.descriptionKey)}</span>
            </button>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
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

  .ppp-toolbar-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: var(--layer-popover, 30);
    margin-top: 0.25rem;
    padding: 0.25rem;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m, 0.5rem);
    box-shadow: var(--shadow-s);
    min-width: 10rem;
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

  .ppp-toolbar-separator {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 0.25rem 0;
  }

  .ppp-toolbar-option--template {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding-left: 1.5rem;
  }

  .ppp-toolbar-tpl-label {
    font-weight: 500;
  }

  .ppp-toolbar-tpl-desc {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
  }
</style>

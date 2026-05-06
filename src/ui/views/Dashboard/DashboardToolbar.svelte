<script lang="ts">
  import type { WidgetDefinition } from "./types";
  import WidgetToolbar from "./widgets/WidgetToolbar.svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { isMobile } from "src/lib/stores/ui";
  import { createEventDispatcher } from "svelte";

  export let showToolbar: boolean;
  export let layoutMode: "stack" | "free";
  export let readonly: boolean;
  export let showFormulaBar: boolean;
  export let currentWidgets: WidgetDefinition[];

  const dispatch = createEventDispatcher<{
    toggleToolbar: void;
    toggleLayout: void;
    openSchema: void;
    toggleFormulaBar: void;
    addWidget: string;
    applyTemplate: WidgetDefinition[];
  }>();
</script>

<div class="ppp-database-toolbar">
  <button
    class="ppp-toolbar-btn clickable-icon"
    on:click={() => dispatch("toggleToolbar")}
    aria-pressed={showToolbar}
    aria-label={showToolbar ? $i18n.t("views.dashboard.canvas.hide-toolbar") : $i18n.t("views.dashboard.canvas.show-toolbar")}
  >
    {showToolbar ? "−" : "+"} {$i18n.t("views.dashboard.canvas.widgets")}
  </button>
  <button
    class="ppp-toolbar-btn clickable-icon"
    on:click={() => dispatch("toggleLayout")}
    aria-label={$i18n.t("views.dashboard.canvas.toggle-layout")}
    disabled={$isMobile}
  >
    {layoutMode === "stack" ? `⊞ ${$i18n.t("views.dashboard.canvas.layout-grid")}` : `≡ ${$i18n.t("views.dashboard.canvas.layout-stack")}`}
  </button>
  {#if !readonly}
    <button
      class="ppp-toolbar-btn clickable-icon"
      on:click={() => dispatch("openSchema")}
      aria-label={$i18n.t("views.dashboard.canvas.schema")}
      title={$i18n.t("views.dashboard.canvas.schema-tip", {
        defaultValue: "Manage project fields — types, relations, rollups",
      })}
    >
      ⚙ {$i18n.t("views.dashboard.canvas.schema")}
    </button>
    <button
      class="ppp-toolbar-btn clickable-icon"
      on:click={() => dispatch("toggleFormulaBar")}
      aria-pressed={showFormulaBar}
      aria-label={showFormulaBar ? $i18n.t("views.dashboard.canvas.hide-formula-bar") : $i18n.t("views.dashboard.canvas.show-formula-bar")}
      title={showFormulaBar
        ? $i18n.t("views.dashboard.canvas.hide-formula-bar", { defaultValue: "Hide formula bar" })
        : $i18n.t("views.dashboard.canvas.show-formula-bar-tip", {
            defaultValue: "Show formula bar — IntelliSense, live preview, syntax check",
          })}
    >
      ƒx
    </button>
  {/if}
  {#if showToolbar && !readonly}
    <WidgetToolbar
      {currentWidgets}
      on:addWidget={(e) => dispatch("addWidget", e.detail)}
      on:applyTemplate={(e) => dispatch("applyTemplate", e.detail)}
    />
  {/if}
</div>

<style>
  .ppp-database-toolbar {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0;
    flex-wrap: wrap;
  }

  .ppp-toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    min-height: 2.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  }

  .ppp-toolbar-btn:hover {
    color: var(--text-normal);
    border-color: var(--interactive-accent);
    background: var(--background-secondary);
  }

  .ppp-toolbar-btn:active {
    background: var(--background-modifier-active-hover, var(--background-secondary));
    transform: translateY(0.0625rem);
  }

  .ppp-toolbar-btn:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-toolbar-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ppp-toolbar-btn[aria-pressed="true"] {
    color: var(--text-on-accent, var(--text-normal));
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
  }
</style>

<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { Icon } from "obsidian-svelte";
  import { createEventDispatcher } from "svelte";

  export let readonly: boolean;
  export let showFormulaBar: boolean;

  const dispatch = createEventDispatcher<{
    toggleFormulaBar: void;
  }>();
</script>

<div class="ppp-database-toolbar">
  {#if !readonly}
    <!-- B7: no «Add widget» here — blocks are added with the «+» on the page itself.
         i3-dash: no «Properties» either. It opened the schema of the dashboard's
         own project with nothing saying so, on a page whose blocks may read other
         projects; it is now in the menu of each block that reads this project,
         named after it (layout/blockProperties.ts). The command palette keeps it. -->
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
      <Icon name="function-square" size="sm" /><span class="ppp-toolbar-label">{$i18n.t("views.dashboard.canvas.formula-builder", { defaultValue: "Formulas" })}</span>
    </button>
  {/if}
</div>

<style>
  /* i2-model (N23): page tools are quiet, at the end of a short row — the
     page's content starts right under them, as in Notion. On a phone they
     are icons; the label is the tooltip and the accessible name. */
  .ppp-database-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.25rem;
    padding: 0;
    flex-wrap: wrap;
  }

  @media (pointer: coarse) {
    .ppp-toolbar-label {
      display: none;
    }
  }

  .ppp-toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    min-height: 1.75rem;
    font-size: var(--font-ui-small);
    color: var(--text-faint);
    background: transparent;
    border: var(--ppp-border-width) solid transparent;
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

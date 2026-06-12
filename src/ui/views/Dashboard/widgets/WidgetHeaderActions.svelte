<script lang="ts">
  /**
   * WidgetHeaderActions — #067 F1 (UT2026-F).
   *
   * The right-hand action cluster of a widget header: configure, pipeline,
   * lock, remove. Pure presentation — every click is dispatched as a
   * semantic event; the host owns what the actions mean. Hover-reveal
   * styling relies on the `:global(.ppp-widget-host)` ancestor rendered
   * by WidgetShell.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { openContextMenu } from "src/lib/contextMenu";
  import { buildWidgetMenuEntries } from "./widgetMenu";

  export let readonly: boolean;
  /** Widget type has a config panel (configPanelRegistry hasCog). */
  export let hasCog: boolean;
  /** Widget type supports the transform pipeline button. */
  export let hasPipeline: boolean;
  export let pipelineStepCount = 0;
  export let locked = false;

  const dispatch = createEventDispatcher<{
    toggleConfig: void;
    togglePipeline: void;
    toggleLock: void;
    remove: void;
    rename: void;
  }>();

  // R3 P0 (NOTION_GRADE_PIPELINE W2): the ALWAYS-visible «⋯» menu is the
  // discoverable entry to every widget action — labeled, through the
  // canonical contextMenu. Hover icons stay as expert shortcuts.
  function openWidgetMenu(e: MouseEvent) {
    openContextMenu(
      buildWidgetMenuEntries({
        hasCog, hasPipeline, pipelineStepCount, locked,
        t: (k, d) => $i18n.t(k, { defaultValue: d }),
        onConfigure: () => dispatch("toggleConfig"),
        onPipeline: () => dispatch("togglePipeline"),
        onRename: () => dispatch("rename"),
        onToggleLock: () => dispatch("toggleLock"),
        onRemove: () => dispatch("remove"),
      }),
      e
    );
  }
</script>

{#if hasCog && !readonly}
  <button
    class="ppp-widget-settings-btn clickable-icon"
    on:click={() => dispatch("toggleConfig")}
    aria-label={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
    title={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
  ><Icon name="settings-2" size="sm" /></button>
{/if}
{#if hasPipeline && !readonly}
  <button
    class="ppp-widget-pipeline-btn clickable-icon"
    class:ppp-widget-pipeline-btn--active={pipelineStepCount > 0}
    on:click={() => dispatch("togglePipeline")}
    aria-label={$i18n.t("views.dashboard.widget.pipeline", { defaultValue: "Data transform pipeline" })}
    title={pipelineStepCount > 0
      ? $i18n.t("views.dashboard.widget.pipeline-active", {
          defaultValue: "Pipeline: {{count}} step(s) — filter, group, unnest, sort",
          count: pipelineStepCount,
        })
      : $i18n.t("views.dashboard.widget.pipeline-tip", {
          defaultValue: "Data pipeline — filter, group, unnest, sort (empty)",
        })}
  >
    <span class="ppp-widget-pipeline-glyph">∑</span>{#if pipelineStepCount > 0}<span class="ppp-widget-pipeline-count">{pipelineStepCount}</span>{/if}
  </button>
{/if}
{#if !readonly}
  <button
    class="ppp-widget-menu-btn clickable-icon"
    on:click={openWidgetMenu}
    aria-label={$i18n.t("views.dashboard.widget.menu", { defaultValue: "Widget menu" })}
    title={$i18n.t("views.dashboard.widget.menu", { defaultValue: "Widget menu — configure, pipeline, rename, remove" })}
    aria-haspopup="menu"
  ><Icon name="more-horizontal" size="sm" /></button>
  <button
    class="ppp-widget-lock-btn clickable-icon"
    class:ppp-widget-lock-btn--locked={locked}
    on:click={() => dispatch("toggleLock")}
    aria-label={locked ? $i18n.t("views.dashboard.widget.unlock", { defaultValue: "Unlock widget" }) : $i18n.t("views.dashboard.widget.lock", { defaultValue: "Lock widget position" })}
    title={locked ? $i18n.t("views.dashboard.widget.unlock", { defaultValue: "Unlock widget" }) : $i18n.t("views.dashboard.widget.lock", { defaultValue: "Lock widget position" })}
  ><Icon name={locked ? "lock" : "unlock"} size="sm" /></button>
  <button
    class="ppp-widget-remove-btn clickable-icon"
    on:click={() => dispatch("remove")}
    aria-label={$i18n.t("views.dashboard.widget.remove")}
  ><Icon name="x" size="sm" /></button>
{/if}

<style>
  /* R3 P0: the menu button is ALWAYS visible — the one discoverable entry. */
  .ppp-widget-menu-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-widget-menu-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-settings-btn,
  .ppp-widget-pipeline-btn,
  .ppp-widget-lock-btn,
  .ppp-widget-remove-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    cursor: pointer;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    opacity: 0;
    transition: opacity 120ms ease, transform 120ms ease, color 120ms ease, background 120ms ease;
  }

  .ppp-widget-remove-btn {
    margin-left: auto;
  }

  :global(.ppp-widget-host:hover) .ppp-widget-settings-btn,
  :global(.ppp-widget-host:hover) .ppp-widget-pipeline-btn,
  :global(.ppp-widget-host:hover) .ppp-widget-lock-btn,
  :global(.ppp-widget-host:hover) .ppp-widget-remove-btn {
    opacity: 1;
  }

  .ppp-widget-settings-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .ppp-widget-pipeline-btn:hover {
    color: var(--text-accent);
    background: var(--background-modifier-hover);
  }

  .ppp-widget-pipeline-btn--active {
    opacity: 1;
    color: var(--text-accent);
  }

  .ppp-widget-pipeline-glyph {
    font-size: 0.9rem;
    line-height: 1;
    font-weight: 700;
  }

  .ppp-widget-pipeline-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0.875rem;
    height: 0.875rem;
    padding: 0 0.1875rem;
    margin-left: 0.1875rem;
    font-size: 0.625rem;
    font-weight: 700;
    line-height: 1;
    color: var(--text-on-accent, var(--background-primary));
    background: var(--interactive-accent);
    border-radius: 0.4375rem;
  }

  .ppp-widget-lock-btn--locked {
    opacity: 1;
    color: var(--text-accent);
  }

  .ppp-widget-lock-btn:hover {
    background: var(--background-modifier-hover);
  }

  .ppp-widget-remove-btn:hover {
    color: var(--text-error);
    background: var(--background-modifier-hover);
  }

  @media (pointer: coarse) {
    .ppp-widget-settings-btn,
    .ppp-widget-pipeline-btn,
    .ppp-widget-lock-btn,
    .ppp-widget-remove-btn {
      opacity: 1;
    }
  }
</style>

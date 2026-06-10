<script lang="ts">
  /**
   * #052 — WidgetToolbar: action buttons for widget header.
   * Designed to be placed in WidgetShell's "actions" slot.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let collapsed: boolean = false;
  export let hasCog: boolean = false;
  export let hasPipeline: boolean = false;
  export let pipelineSteps: number = 0;
  export let locked: boolean = false;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{
    toggleCollapse: void;
    toggleConfig: void;
    togglePipeline: void;
    toggleLock: void;
    remove: void;
  }>();
</script>

<button
  class="ppp-toolbar-btn"
  class:ppp-toolbar-btn--rotated={collapsed}
  on:click={() => dispatch("toggleCollapse")}
  aria-label={collapsed ? $i18n.t("views.dashboard.widget.expand") : $i18n.t("views.dashboard.widget.collapse")}
  aria-expanded={!collapsed}
>‹</button>

{#if !readonly}
  {#if hasCog}
    <button class="ppp-toolbar-btn" on:click={() => dispatch("toggleConfig")}
      aria-label={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
      title={$i18n.t("views.dashboard.widget.configure", { defaultValue: "Configure widget" })}
    ><Icon name="settings-2" size="sm" /></button>
  {/if}
  {#if hasPipeline}
    <button class="ppp-toolbar-btn" class:ppp-toolbar-btn--active={pipelineSteps > 0}
      on:click={() => dispatch("togglePipeline")}
      aria-label={$i18n.t("views.dashboard.widget.pipeline", { defaultValue: "Data transform pipeline" })}
    ><span class="ppp-toolbar-glyph">∑</span>{#if pipelineSteps > 0}<span class="ppp-toolbar-count">{pipelineSteps}</span>{/if}</button>
  {/if}
  <button class="ppp-toolbar-btn" class:ppp-toolbar-btn--locked={locked}
    on:click={() => dispatch("toggleLock")}
    aria-label={locked ? $i18n.t("views.dashboard.widget.unlock", { defaultValue: "Unlock widget" }) : $i18n.t("views.dashboard.widget.lock", { defaultValue: "Lock widget position" })}
  ><Icon name={locked ? "lock" : "unlock"} size="sm" /></button>
  <button class="ppp-toolbar-btn ppp-toolbar-btn--danger" on:click={() => dispatch("remove")}
    aria-label={$i18n.t("views.dashboard.widget.remove")}
  ><Icon name="x" size="sm" /></button>
{/if}

<style>
  .ppp-toolbar-btn {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--ppp-db-text-faint, var(--text-faint));
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    font-size: 0.75rem;
    transition: color 120ms ease, background 120ms ease, transform 120ms ease;
  }
  .ppp-toolbar-btn:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
  .ppp-toolbar-btn--rotated { transform: rotate(-90deg); }
  .ppp-toolbar-btn--active { color: var(--text-accent); }
  .ppp-toolbar-btn--locked { color: var(--text-accent); }
  .ppp-toolbar-btn--danger:hover { color: var(--text-error); }
  .ppp-toolbar-glyph { font-size: 0.9rem; font-weight: 700; line-height: 1; }
  .ppp-toolbar-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 0.875rem; height: 0.875rem; padding: 0 0.1875rem; margin-left: 0.1875rem;
    font-size: 0.625rem; font-weight: 700;
    color: var(--text-on-accent, var(--background-primary));
    background: var(--interactive-accent); border-radius: 0.4375rem;
  }
</style>

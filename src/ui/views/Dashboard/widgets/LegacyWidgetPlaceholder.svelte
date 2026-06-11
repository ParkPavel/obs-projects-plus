<script lang="ts">
  /**
   * LegacyWidgetPlaceholder — F3 (#074, UT2026-A L1). Shown for archived V1
   * widget types whose rendering retired with the archive. The stored
   * config is never touched; where the V2 fate table defines a successor,
   * a one-click convert is offered.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let widgetType: string;
  export let convertible: boolean;
  export let readonly: boolean;

  const dispatch = createEventDispatcher<{ convert: void }>();
</script>

<div class="ppp-legacy-widget" role="status">
  <span class="ppp-legacy-widget-icon"><Icon name="archive" /></span>
  <span class="ppp-legacy-widget-title">
    {$i18n.t("views.dashboard.legacy.retired", {
      defaultValue: 'Widget type "{{type}}" was retired in Dashboard V2',
      type: widgetType,
    })}
  </span>
  <span class="ppp-legacy-widget-hint">
    {#if convertible}
      {$i18n.t("views.dashboard.legacy.convert-hint", {
        defaultValue: "Its data lives on — convert this block to the V2 equivalent. The stored settings are preserved until you do.",
      })}
    {:else}
      {$i18n.t("views.dashboard.legacy.no-successor", {
        defaultValue: "Its settings are preserved in the canvas config. Recreate the view with V2 blocks (database-call, stats, chart).",
      })}
    {/if}
  </span>
  {#if convertible && !readonly}
    <button class="ppp-legacy-widget-btn" on:click={() => dispatch("convert")}>
      {$i18n.t("views.dashboard.legacy.convert", { defaultValue: "Convert to V2 block" })}
    </button>
  {/if}
</div>

<style>
  .ppp-legacy-widget {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ppp-space-sm, 0.25rem);
    padding: var(--ppp-space-xl, 1.5rem);
    color: var(--text-muted);
    text-align: center;
  }

  .ppp-legacy-widget-icon {
    color: var(--text-faint);
    opacity: 0.7;
  }

  .ppp-legacy-widget-title {
    font-size: var(--font-ui-small);
    font-weight: var(--font-medium, 500);
  }

  .ppp-legacy-widget-hint {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    max-width: 24rem;
  }

  .ppp-legacy-widget-btn {
    margin-top: var(--ppp-space-sm, 0.25rem);
    padding: 0.25rem 0.75rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--interactive-accent);
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .ppp-legacy-widget-btn:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>

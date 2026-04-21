<script lang="ts">
  import ViewPortSelector from "./ViewPortSelector.svelte";
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let config: Record<string, unknown>;

  const dispatch = createEventDispatcher<{
    configChange: Record<string, unknown>;
  }>();

  $: viewId = String(config["viewId"] ?? "");
  $: viewLabel = String(config["viewLabel"] ?? "");

  let showSelector = false;

  function handleViewSelect(e: CustomEvent<{ id: string; label: string }>) {
    showSelector = false;
    dispatch("configChange", {
      ...config,
      viewId: e.detail.id,
      viewLabel: e.detail.label,
    });
  }
</script>

<div class="ppp-viewport-widget">
  {#if !viewId}
    <div class="ppp-viewport-empty">
      <button
        class="ppp-viewport-select-btn"
        on:click={() => (showSelector = !showSelector)}
      >
        {$i18n.t("views.database.viewport.select")}
      </button>
      {#if showSelector}
        <ViewPortSelector on:select={handleViewSelect} />
      {/if}
    </div>
  {:else}
    <div class="ppp-viewport-header">
      <span class="ppp-viewport-label">{viewLabel}</span>
      <button
        class="ppp-viewport-change-btn clickable-icon"
        on:click={() => (showSelector = !showSelector)}
        aria-label={$i18n.t("views.database.viewport.change")}
      >⟳</button>
      {#if showSelector}
        <ViewPortSelector on:select={handleViewSelect} />
      {/if}
    </div>
    <div class="ppp-viewport-content">
      <div class="ppp-viewport-placeholder">
        {$i18n.t("views.database.viewport.embedded", { view: viewLabel })}
      </div>
    </div>
  {/if}
</div>

<style>
  .ppp-viewport-widget {
    display: flex;
    flex-direction: column;
    min-height: 6rem;
    position: relative;
  }

  .ppp-viewport-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.5rem;
  }

  .ppp-viewport-select-btn {
    padding: 0.5rem 1rem;
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .ppp-viewport-select-btn:hover {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
  }

  .ppp-viewport-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border);
    position: relative;
  }

  .ppp-viewport-label {
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    flex: 1;
  }

  .ppp-viewport-change-btn {
    font-size: var(--font-ui-small);
  }

  .ppp-viewport-content {
    flex: 1;
    overflow: auto;
    padding: 0.5rem;
  }

  .ppp-viewport-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 8rem;
    color: var(--text-faint);
    font-style: italic;
    border: 1px dashed var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
  }
</style>

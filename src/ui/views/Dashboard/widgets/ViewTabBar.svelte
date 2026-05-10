<script lang="ts">
  /**
   * Dashboard V2 (DG-5) — multi-view tab bar.
   *
   * Renders tabs for Table/Board/Calendar/... inside a database-call
   * block. Active tab highlights; click switches; `+` adds new view.
   * Each tab stores its own config so switching preserves state.
   */
  import { createEventDispatcher } from "svelte";
  import type { ViewTab } from "../../types";

  export let tabs: ViewTab[];
  export let activeTabId: string;

  const dispatch = createEventDispatcher<{
    tabSwitch: string;
    tabAdd: void;
    tabRemove: string;
    tabRename: { id: string; label: string };
  }>();

  const VIEW_ICONS: Record<ViewTab["viewType"], string> = {
    table: "⊞",
    board: "⬜",
    calendar: "📅",
    gallery: "🖼",
    list: "☰",
    timeline: "━",
    chart: "📊",
    stats: "📈",
  };

  function handleTabClick(id: string) {
    if (id !== activeTabId) {
      dispatch("tabSwitch", id);
    }
  }
</script>

<div class="ppp-view-tab-bar" role="tablist">
  {#each tabs as tab (tab.id)}
    <button
      class="ppp-view-tab"
      class:ppp-view-tab--active={tab.id === activeTabId}
      role="tab"
      aria-selected={tab.id === activeTabId}
      aria-controls="ppp-tab-panel-{tab.id}"
      on:click={() => handleTabClick(tab.id)}
    >
      <span class="ppp-view-tab-icon" aria-hidden="true">{VIEW_ICONS[tab.viewType]}</span>
      <span class="ppp-view-tab-label">{tab.label}</span>
    </button>
  {/each}
  <button
    class="ppp-view-tab-add clickable-icon"
    on:click={() => dispatch("tabAdd")}
    aria-label="Add view tab"
    title="Add view tab"
  >+</button>
</div>

<style>
  .ppp-view-tab-bar {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .ppp-view-tab {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-small, 0.875rem);
    white-space: nowrap;
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-view-tab:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-view-tab--active {
    background: var(--background-primary);
    color: var(--text-accent);
    font-weight: 600;
    box-shadow: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05);
  }

  .ppp-view-tab-icon {
    font-size: 0.875rem;
    line-height: 1;
  }

  .ppp-view-tab-label {
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-view-tab-add {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-s, 0.25rem);
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    font-size: 1rem;
    margin-left: 0.25rem;
  }

  .ppp-view-tab-add:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }
</style>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { GridRowId } from "./dataGrid";

  export let selectedIds: Set<GridRowId>;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{
    deleteSelected: void;
    clearSelection: void;
  }>();

  $: count = selectedIds.size;
</script>

{#if count > 0}
  <div class="ppp-bulk-bar" role="toolbar" aria-label="Bulk actions">
    <span class="ppp-bulk-count">{count} selected</span>
    <button
      class="ppp-bulk-btn ppp-bulk-btn--clear"
      on:click={() => dispatch("clearSelection")}
      aria-label="Deselect all"
    >✕ Deselect all</button>
    {#if !readonly}
      <button
        class="ppp-bulk-btn ppp-bulk-btn--danger"
        on:click={() => dispatch("deleteSelected")}
        aria-label="Delete selected"
      >Delete {count}</button>
    {/if}
  </div>
{/if}

<style>
  .ppp-bulk-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--ppp-db-canvas-bg, var(--background-secondary));
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    font-size: var(--font-ui-small);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .ppp-bulk-count {
    font-weight: 600;
    color: var(--text-normal);
    margin-right: 0.25rem;
  }

  .ppp-bulk-btn {
    padding: 0.125rem 0.625rem;
    border-radius: 0.25rem;
    border: 0.0625rem solid var(--background-modifier-border);
    background: transparent;
    cursor: pointer;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    transition: background 100ms ease, color 100ms ease;
  }

  .ppp-bulk-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-bulk-btn--danger {
    color: var(--text-error);
    border-color: var(--text-error);
  }

  .ppp-bulk-btn--danger:hover {
    background: var(--text-error);
    color: var(--background-primary);
  }
</style>

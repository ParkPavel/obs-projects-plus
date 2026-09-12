<script lang="ts">
  /**
   * TableGroupSection — F2.5 (TABLE_V2_CANON §2). Group header row:
   * chevron + value + muted count on a secondary background; click
   * collapses/expands (persisted via configChange upstream).
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";

  export let groupKey: string;
  export let count: number;
  export let collapsed: boolean;

  const dispatch = createEventDispatcher<{ toggle: string }>();
</script>

<button class="ppp-t2-group" on:click={() => dispatch("toggle", groupKey)} aria-expanded={!collapsed}>
  <span class="ppp-t2-group-chevron" class:ppp-t2-group-chevron--collapsed={collapsed}>
    <Icon name="chevron-down" size="sm" />
  </span>
  <span class="ppp-t2-group-label">{groupKey}</span>
  <span class="ppp-t2-group-count">{count}</span>
</button>

<style>
  .ppp-t2-group {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-height: var(--ppp-t2-row-height, 2.25rem);
    padding: 0 0.5rem;
    border: none;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-weight: var(--font-medium, 500);
    cursor: pointer;
    text-align: left;
    position: sticky;
    left: 0;
  }

  .ppp-t2-group:hover {
    color: var(--text-normal);
  }

  .ppp-t2-group-chevron {
    display: inline-flex;
    transition: transform 120ms ease;
  }

  .ppp-t2-group-chevron--collapsed {
    transform: rotate(-90deg);
  }

  .ppp-t2-group-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-t2-group-count {
    color: var(--text-faint);
    font-weight: normal;
    font-variant-numeric: tabular-nums;
  }
</style>

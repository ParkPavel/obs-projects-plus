<script lang="ts">
  /**
   * TableControlBar — F2.1 (TABLE_V2_CANON §1). The view's single control
   * surface: dismissable sort pills, expandable search, record count.
   * Filter pills and the «⋯» display menu arrive in F2.4 — the bar is the
   * canonical place they will land in, nothing view-related stays in the
   * table body.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataTableSortCriteria } from "../../types";

  export let sortCriteria: DataTableSortCriteria[] = [];
  export let recordCount = 0;
  export let readonly = false;
  export let searchQuery = "";

  const dispatch = createEventDispatcher<{
    search: string;
    removeSort: DataTableSortCriteria;
    clearSort: void;
  }>();

  let searchOpen = false;
  let searchEl: HTMLInputElement | null = null;

  function toggleSearch() {
    searchOpen = !searchOpen;
    if (!searchOpen) {
      searchQuery = "";
      dispatch("search", "");
    } else {
      setTimeout(() => searchEl?.focus(), 0);
    }
  }
</script>

<div class="ppp-t2-controlbar" role="toolbar" aria-label={$i18n.t("views.dashboard.table-v2.controls", { defaultValue: "Table controls" })}>
  {#each sortCriteria as crit (crit.field)}
    <span class="ppp-t2-cb-pill" class:ppp-t2-cb-pill--static={readonly}>
      <Icon name={crit.order === "asc" ? "arrow-up" : "arrow-down"} size="sm" />
      <span class="ppp-t2-cb-pill-label">{crit.field}</span>
      {#if !readonly}
        <button
          class="ppp-t2-cb-pill-x clickable-icon"
          on:click={() => dispatch("removeSort", crit)}
          aria-label={$i18n.t("views.dashboard.table-v2.remove-sort", { defaultValue: "Remove sort" })}
        ><Icon name="x" size="sm" /></button>
      {/if}
    </span>
  {/each}

  <span class="ppp-t2-cb-spacer" />

  {#if searchOpen}
    <input
      bind:this={searchEl}
      class="ppp-t2-cb-search"
      type="search"
      bind:value={searchQuery}
      placeholder={$i18n.t("views.dashboard.table-v2.search-placeholder", { defaultValue: "Search…" })}
      aria-label={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
      on:input={() => dispatch("search", searchQuery)}
      on:keydown={(e) => { if (e.key === "Escape") toggleSearch(); }}
    />
  {/if}
  <button
    class="ppp-t2-cb-btn clickable-icon"
    class:ppp-t2-cb-btn--active={searchOpen}
    on:click={toggleSearch}
    aria-label={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
    title={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
  ><Icon name="search" size="sm" /></button>

  <span class="ppp-t2-cb-count" aria-live="polite">{recordCount}</span>
</div>

<style>
  .ppp-t2-controlbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 2rem;
    padding: 0 0.5rem;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-t2-cb-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    height: 1.75rem;
    padding: 0 0.375rem;
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0.875rem;
    background: var(--background-secondary);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .ppp-t2-cb-pill-label {
    max-width: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-t2-cb-pill-x {
    display: inline-flex;
    align-items: center;
    border: none;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    padding: 0;
  }

  .ppp-t2-cb-pill-x:hover {
    color: var(--text-normal);
  }

  .ppp-t2-cb-spacer {
    flex: 1;
  }

  .ppp-t2-cb-search {
    height: 1.75rem;
    max-width: 14rem;
    font-size: var(--font-ui-small);
  }

  .ppp-t2-cb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
  }

  .ppp-t2-cb-btn:hover,
  .ppp-t2-cb-btn--active {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .ppp-t2-cb-count {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>

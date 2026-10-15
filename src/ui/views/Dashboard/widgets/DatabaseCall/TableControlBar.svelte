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
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import type { DataTableSortCriteria } from "../../types";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { searchSuggestions, hintKey, type SearchSuggestion } from "./tableSearchQuery";
  import SearchHints from "./SearchHints.svelte";

  export let sortCriteria: DataTableSortCriteria[] = [];
  export let recordCount = 0;
  export let readonly = false;
  export let searchQuery = "";
  export let searching = false;
  /** B3: known fields and records, for `field:value` suggestions. */
  export let fieldNames: readonly string[] = [];
  export let records: readonly DataRecord[] = [];

  const dispatch = createEventDispatcher<{
    search: string;
    removeSort: DataTableSortCriteria;
    clearSort: void;
  }>();

  let searchOpen = false;
  function toggleSearch() {
    searchOpen = !searchOpen;
    if (!searchOpen) {
      searchQuery = "";
      dispatch("search", "");
    }
  }

  let active = -1;
  const listId = `ppp-t2-hints-${Math.random().toString(36).slice(2, 8)}`;
  $: suggestions = searchOpen ? searchSuggestions(searchQuery, fieldNames, records) : ([] as SearchSuggestion[]);

  function setQuery(next: string) {
    searchQuery = next;
    active = -1;
    dispatch("search", next);
  }

  // Arrows/Enter/Tab walk the hints; Escape closes them, then the search; never during IME.
  function onSearchKeydown(e: KeyboardEvent) {
    const step = isImeKey(e) ? null : hintKey(e.key, suggestions.length, active);
    if (!step) return;
    if (e.key !== "Escape") e.preventDefault();
    active = step.active;
    const chosen = step.choose === undefined ? undefined : suggestions[step.choose];
    if (chosen) setQuery(chosen.query);
    if (step.close) toggleSearch();
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
    <div class="ppp-t2-cb-search">
      <SearchField
        query={searchQuery}
        focusOnMount
        placeholder={$i18n.t("views.dashboard.table-v2.search-placeholder", { defaultValue: "Search…" })}
        ariaLabel={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
        controls={suggestions.length ? listId : undefined} activeDescendant={active >= 0 ? `${listId}-${active}` : undefined}
        on:queryChange={(e) => setQuery(e.detail)}
        on:keydown={onSearchKeydown}
      />
      <SearchHints {suggestions} {active} {listId} showTip={searchQuery.trim() === ""} on:choose={(e) => setQuery(e.detail.query)} />
    </div>
  {/if}
  <button
    class="ppp-t2-cb-btn clickable-icon"
    class:ppp-t2-cb-btn--active={searchOpen}
    on:click={toggleSearch}
    aria-label={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
    title={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
  ><Icon name="search" size="sm" /></button>

  <span class="ppp-t2-cb-count" aria-live="polite" aria-busy={searching}
    aria-label={searching ? $i18n.t("views.dashboard.table-v2.searching", { defaultValue: "Searching…" }) : undefined}
  >{searching ? "…" : recordCount}</span>
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
    position: relative;
    min-width: 0;
    max-width: 14rem;
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

  /* #169/#166: in a narrow widget the label yields space in the widget's own
     units (cqi of `widget`, threshold in em) instead of vanishing. */
  @container widget (max-width: 24em) {
    .ppp-t2-cb-pill-label {
      max-width: 40cqi;
    }

    .ppp-t2-cb-search {
      max-width: 100%;
    }
  }

  .ppp-t2-cb-count {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
</style>

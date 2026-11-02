<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import SearchField from "src/ui/components/fields/SearchField.svelte";
  import FloatingPopup from "src/ui/components/FloatingPopup/FloatingPopup.svelte";
  import { isImeKey } from "src/ui/components/fields/draftController";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { searchSuggestions, hintKey, type SearchSuggestion } from "./tableSearchQuery";
  import SearchHints from "./SearchHints.svelte";

  export let searchQuery = "";
  export let recordCount = 0;
  export let searching = false;
  export let fieldNames: readonly string[] = [];
  export let records: readonly DataRecord[] = [];

  const dispatch = createEventDispatcher<{ search: string }>();

  let searchOpen = false;
  let hintsDismissed = false;
  let searchEl: HTMLDivElement | null = null;
  let active = -1;
  const listId = `ppp-t2-hints-${Math.random().toString(36).slice(2, 8)}`;
  $: queryActive = !searchOpen && searchQuery.trim() !== "";
  $: searchLabel = $i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" });
  $: suggestions = searchOpen ? searchSuggestions(searchQuery, fieldNames, records) : ([] as SearchSuggestion[]);
  $: hintsOpen = searchOpen && !hintsDismissed && (suggestions.length > 0 || searchQuery.trim() === "");

  function toggleSearch() {
    searchOpen = !searchOpen;
    hintsDismissed = false;
  }

  function closeAndClear() {
    searchOpen = false;
    searchQuery = "";
    hintsDismissed = false;
    dispatch("search", "");
  }

  function setQuery(next: string) {
    searchQuery = next;
    active = -1;
    hintsDismissed = false;
    dispatch("search", next);
  }

  function onSearchKeydown(e: KeyboardEvent) {
    const step = isImeKey(e) ? null : hintKey(e.key, suggestions.length, active);
    if (!step) return;
    if (e.key !== "Escape") e.preventDefault();
    active = step.active;
    const chosen = step.choose === undefined ? undefined : suggestions[step.choose];
    if (chosen) setQuery(chosen.query);
    if (step.close) closeAndClear();
  }
</script>

{#if searchOpen}
  <div class="ppp-t2-cb-search" bind:this={searchEl}>
    <SearchField
      query={searchQuery}
      focusOnMount
      placeholder={$i18n.t("views.dashboard.table-v2.search-placeholder", { defaultValue: "Search…" })}
      ariaLabel={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
      controls={suggestions.length ? listId : undefined}
      activeDescendant={active >= 0 ? `${listId}-${active}` : undefined}
      on:queryChange={(e) => setQuery(e.detail)}
      on:keydown={onSearchKeydown}
    />
  </div>
{/if}
<FloatingPopup
  open={hintsOpen}
  triggerEl={searchEl}
  mobilePresentation="anchored"
  role="presentation"
  autoFocus={false}
  on:close={() => (hintsDismissed = true)}
>
  <SearchHints
    {suggestions}
    {active}
    {listId}
    showTip={searchQuery.trim() === ""}
    on:choose={(e) => setQuery(e.detail.query)}
  />
</FloatingPopup>
<button
  class="ppp-t2-cb-btn clickable-icon"
  class:ppp-t2-cb-btn--active={searchOpen || queryActive}
  class:ppp-t2-cb-btn--query={queryActive}
  aria-pressed={searchOpen}
  on:click={toggleSearch}
  aria-label={queryActive ? `${searchLabel}: ${searchQuery}` : searchLabel}
  title={searchLabel}
><Icon name="search" size="sm" />{#if queryActive}<span class="ppp-t2-cb-dot" aria-hidden="true"></span>{/if}</button>

<span class="ppp-t2-cb-count" aria-live="polite" aria-busy={searching}
  aria-label={searching ? $i18n.t("views.dashboard.table-v2.searching", { defaultValue: "Searching…" }) : undefined}
>{searching ? "…" : recordCount}</span>

<style>
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

  .ppp-t2-cb-btn--query { position: relative; }
  .ppp-t2-cb-dot { position: absolute; top: 0.2em; right: 0.2em; width: 0.4em; height: 0.4em; border-radius: 50%; background: var(--interactive-accent); }

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

  @container widget (max-width: 24em) {
    .ppp-t2-cb-search {
      max-width: 100%;
    }
  }
</style>

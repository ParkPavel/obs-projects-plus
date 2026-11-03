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
  let inputEl: HTMLInputElement | null = null, searchField: SearchField | undefined, overlayVisible = false;
  let active = -1;
  const listId = `ppp-t2-hints-${Math.random().toString(36).slice(2, 8)}`;
  $: queryActive = !searchOpen && searchQuery.trim() !== "";
  $: searchLabel = $i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" });
  $: suggestions = searchOpen ? searchSuggestions(searchQuery, fieldNames, records) : ([] as SearchSuggestion[]);
  $: hintsOpen = searchOpen && !hintsDismissed && (suggestions.length > 0 || searchQuery.trim() === "");

  function toggleSearch() {
    searchOpen = !searchOpen;
    hintsDismissed = false;
    overlayVisible = false;
  }

  function closeAndClear() {
    searchOpen = false;
    searchQuery = "";
    hintsDismissed = false;
    overlayVisible = false;
    dispatch("search", "");
  }

  function setQuery(next: string) {
    searchQuery = next;
    active = -1;
    hintsDismissed = false;
    dispatch("search", next);
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (searchField?.isComposing() || isImeKey(e)) { e.stopPropagation(); return; }
    if (e.key !== "Escape" && (!hintsOpen || !overlayVisible)) return;
    const step = hintKey(e.key, suggestions.length, active);
    if (!step) { if (e.key === "Tab") dismissHints(); return; }
    if (e.key !== "Escape" && e.key !== "Tab") e.preventDefault();
    active = step.active;
    const chosen = step.choose === undefined ? undefined : suggestions[step.choose];
    if (chosen) chooseSuggestion(chosen);
    if (step.close) closeAndClear();
    if (e.key === "Tab") dismissHints();
  }

  function chooseSuggestion(chosen: SearchSuggestion): void {
    if (!hintsOpen || !overlayVisible || searchField?.isComposing()) return;
    setQuery(chosen.query);
    searchField?.reset(chosen.query);
  }
  function confirmSearch(): void {
    const chosen = active >= 0 ? suggestions[active] : undefined;
    if (chosen) chooseSuggestion(chosen);
    dismissHints();
  }
  function dismissHints(): void { hintsDismissed = true; overlayVisible = false; }
</script>

{#if searchOpen}
  <div class="ppp-t2-cb-search" bind:this={searchEl}>
    <SearchField
      bind:this={searchField} bind:inputEl
      query={searchQuery}
      focusOnMount
      placeholder={$i18n.t("views.dashboard.table-v2.search-placeholder", { defaultValue: "Search…" })}
      ariaLabel={$i18n.t("views.dashboard.table-v2.search", { defaultValue: "Search records" })}
      controls={suggestions.length ? listId : undefined}
      expanded={hintsOpen && overlayVisible}
      activeDescendant={hintsOpen && overlayVisible && active >= 0 ? `${listId}-${active}` : undefined}
      onConfirm={confirmSearch}
      on:queryChange={(e) => setQuery(e.detail)}
      on:keydown={onSearchKeydown}
    />
  </div>
{/if}
<FloatingPopup
  open={hintsOpen}
  triggerEl={inputEl} interactionEl={searchEl}
  placement="above-field"
  mobilePresentation="anchored"
  role="presentation"
  autoFocus={false}
  on:position={(event) => { overlayVisible = event.detail.visible; if (!overlayVisible) active = -1; }}
  on:close={dismissHints}
>
  <SearchHints
    {suggestions}
    {active}
    {listId}
    showTip={searchQuery.trim() === ""}
    on:choose={(e) => chooseSuggestion(e.detail)}
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

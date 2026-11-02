<script lang="ts">
  /** B3: the search's completions (field names, then a field's values), or the syntax tip. */
  import { createEventDispatcher } from "svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { SearchSuggestion } from "./tableSearchQuery";

  export let suggestions: SearchSuggestion[];
  export let active = -1;
  export let listId: string;
  export let showTip = false;

  const dispatch = createEventDispatcher<{ choose: SearchSuggestion }>();
</script>

{#if suggestions.length}
  <ul class="ppp-t2-hints" id={listId} role="listbox"
    aria-label={$i18n.t("views.dashboard.table-v2.search-hints", { defaultValue: "Search suggestions" })}>
    {#each suggestions as s, i (s.query)}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <li id={`${listId}-${i}`} role="option" aria-selected={i === active}
        class="ppp-t2-hint" class:ppp-t2-hint--active={i === active}
        on:mousedown|preventDefault
        on:click={() => dispatch("choose", s)}>{s.label}</li>
    {/each}
  </ul>
{:else if showTip}
  <span class="ppp-t2-hint-tip">{$i18n.t("views.dashboard.table-v2.search-tip", { defaultValue: "Tip: field:value, field: for empty, field:* for filled" })}</span>
{/if}

<style>
  .ppp-t2-hints {
    max-height: 20em;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ppp-t2-hint {
    padding: 0.25em 0.5em;
    border-radius: var(--radius-s);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-t2-hint--active {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-t2-hint-tip {
    display: block;
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
  }
</style>

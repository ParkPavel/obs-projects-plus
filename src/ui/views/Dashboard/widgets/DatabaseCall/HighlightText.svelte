<script lang="ts">
  /** B3: a cell's text with the active search's matches marked. */
  import { highlightParts, type ParsedSearch } from "./tableSearchQuery";

  export let text: string;
  export let search: ParsedSearch | null = null;
  /** The cell's field: a `field:value` term marks only its own field. */
  export let field: string | undefined = undefined;

  $: parts = search && search.terms.length ? highlightParts(text, search, field) : [{ text, hit: false }];
</script>

{#each parts as part}{#if part.hit}<mark class="ppp-t2-hit">{part.text}</mark>{:else}{part.text}{/if}{/each}

<style>
  .ppp-t2-hit {
    background: var(--text-highlight-bg);
    color: inherit;
    border-radius: 0.125em;
  }
</style>

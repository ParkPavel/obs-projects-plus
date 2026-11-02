<script lang="ts">
  /** TableControlBar — F2.1 (TABLE_V2_CANON §1): the view's one control surface
   * (sort pills, search, record count); nothing view-related in the table body. */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import TableSearch from "./TableSearch.svelte";
  import type { DataTableSortCriteria } from "../../types";
  import type { DataRecord } from "src/lib/dataframe/dataframe";

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

  // w4-p10a (N8): the button folds the field and KEEPS the query (the button is
  // marked); the field's clear (×) or Escape ends the search.
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

  <TableSearch
    bind:searchQuery
    {searching}
    {recordCount}
    {fieldNames}
    {records}
    on:search={(event) => dispatch("search", event.detail)}
  />
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

  /* #169/#166: in a narrow widget the label yields space in the widget's own
     units (cqi of `widget`, threshold in em) instead of vanishing. */
  @container widget (max-width: 24em) {
    .ppp-t2-cb-pill-label {
      max-width: 40cqi;
    }
  }

</style>

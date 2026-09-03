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

  /*
   * #169 / #166 — what a narrow widget costs the bar.
   *
   * The design spec asked for pills to collapse to icon-only below the label
   * budget. Measured against what a pill IS, that is the wrong trade: a filter
   * pill with no text says only that SOME filter exists and not which one, and
   * an unreadable filter is worse than one that wraps — which this bar already
   * does. So the label yields space instead of vanishing.
   *
   * It yields it in the container's own units, which is the point of the
   * exercise: `8rem` above is anchored to the document root, so it caps the
   * label identically in a widget one column wide and one spanning the canvas.
   * `cqi` is a share of THIS widget. Named `widget` after the container
   * `WidgetShell` declares on `.ppp-widget-host`, so the rule cannot silently
   * re-target whichever ancestor is nearest, and the threshold is in `em` —
   * `rem` inside the condition would be root-anchored again, and would count
   * against R0.16 from inside a media condition where nothing renders it.
   */
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

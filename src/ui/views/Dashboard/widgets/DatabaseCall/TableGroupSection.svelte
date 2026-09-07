<script lang="ts">
  /**
   * TableGroupSection — F2.5 (TABLE_V2_CANON §2). Group header row:
   * chevron + value + muted count on a secondary background; click
   * collapses/expands (persisted via configChange upstream).
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";

  export let groupKey: string;
  export let count: number;
  export let collapsed: boolean;

  // #187 — records with no value in the grouped field arrive here with an empty
  // key (`valueToGroupKey` in groupRows.ts returns "" for null/undefined), and
  // this rendered as chevron, nothing, count: indistinguishable from a blank
  // separator row, which is exactly what the user reported seeing. The semantic
  // grouping mode has always had a fallback label for the same case; the
  // default value mode never got one.
  $: label =
    groupKey === ""
      ? $i18n.t("views.dashboard.table-v2.group-empty", {
          defaultValue: "No value",
        })
      : groupKey;

  const dispatch = createEventDispatcher<{ toggle: string }>();
</script>

<button class="ppp-t2-group" on:click={() => dispatch("toggle", groupKey)} aria-expanded={!collapsed}>
  <span class="ppp-t2-group-chevron" class:ppp-t2-group-chevron--collapsed={collapsed}>
    <Icon name="chevron-down" size="sm" />
  </span>
  <span class="ppp-t2-group-label" class:ppp-t2-group-label--empty={groupKey === ""}>{label}</span>
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
    font-weight: var(--ppp-font-weight-medium);
    cursor: pointer;
    text-align: left;
    position: sticky;
    left: 0;
  }

  /* The fallback is a label for an absence, so it reads as one: same size and
     weight, lower emphasis. Not italic — the grouped values themselves may be
     italic text, and a style that collides with real data is not a signal. */
  .ppp-t2-group-label--empty {
    color: var(--text-faint);
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

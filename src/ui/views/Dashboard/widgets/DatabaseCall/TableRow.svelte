<script lang="ts">
  /**
   * TableRow — F2.1 (TABLE_V2_CANON §2). One record as a grid row: per-type
   * read-only cell rendering (pills / tabular numbers / checkbox / text),
   * full-row hover background, hover «↗» on the primary (Name) cell.
   * In-place editors arrive in F2.2; row actions/bulk in F2.3.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { cellDisplay, type TableColumn } from "./tableCanon";

  export let columns: TableColumn[];
  export let record: DataRecord;

  const dispatch = createEventDispatcher<{ openRecord: DataRecord }>();
</script>

<div class="ppp-t2-row" role="row">
  {#each columns as col (col.field.name)}
    {@const cell = cellDisplay(col.field, record.values[col.field.name])}
    <div class="ppp-t2-cell" class:ppp-t2-cell--number={cell.kind === "number"} role="gridcell">
      {#if col.isPrimary}
        <span class="ppp-t2-name">{cell.kind === "text" ? cell.text : record.id}</span>
        <button
          class="ppp-t2-open clickable-icon"
          on:click|stopPropagation={() => dispatch("openRecord", record)}
          aria-label={$i18n.t("views.dashboard.table-v2.open", { defaultValue: "Open note" })}
          title={$i18n.t("views.dashboard.table-v2.open", { defaultValue: "Open note" })}
        ><Icon name="arrow-up-right" size="sm" /></button>
      {:else if cell.kind === "empty"}
        <span class="ppp-t2-empty" aria-hidden="true">—</span>
      {:else if cell.kind === "check"}
        <input type="checkbox" checked={cell.checked} disabled class="ppp-t2-check" />
      {:else if cell.kind === "pills"}
        <span class="ppp-t2-pills">
          {#each cell.pills as pill (pill.label)}
            <span class="ppp-t2-pill" style:background-color={pill.color ?? ""}>
              {#if cell.status}<span class="ppp-t2-pill-dot" aria-hidden="true">●</span>{/if}{pill.label}
            </span>
          {/each}
          {#if cell.overflow > 0}<span class="ppp-t2-pill ppp-t2-pill--more">+{cell.overflow}</span>{/if}
        </span>
      {:else if cell.kind === "number"}
        {cell.text}
      {:else}
        <span class="ppp-t2-text">{cell.text}</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ppp-t2-row {
    display: grid;
    grid-template-columns: var(--ppp-dt-columns);
    min-height: var(--ppp-t2-row-height, 2.25rem);
    border-bottom: 0.0625rem solid var(--background-modifier-border);
  }

  .ppp-t2-row:hover {
    background: var(--ppp-db-surface-hover, var(--background-modifier-hover));
  }

  .ppp-t2-cell {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    padding: 0 0.5rem;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .ppp-t2-cell--number {
    justify-content: flex-end;
    font-variant-numeric: tabular-nums;
  }

  .ppp-t2-name {
    font-weight: var(--font-medium, 500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-t2-open {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border: none;
    background: transparent;
    color: var(--text-faint);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ppp-t2-row:hover .ppp-t2-open {
    opacity: 1;
  }

  .ppp-t2-open:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  /* Empty cells are visually empty; ghost dash appears on cell hover only */
  .ppp-t2-empty {
    color: transparent;
  }

  .ppp-t2-cell:hover .ppp-t2-empty {
    color: var(--text-faint);
  }

  .ppp-t2-check {
    margin: 0;
  }

  .ppp-t2-pills {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
  }

  .ppp-t2-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.1875rem;
    height: 1.25rem;
    padding: 0 0.375rem;
    border-radius: 0.25rem;
    background: var(--background-secondary);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-t2-pill-dot {
    font-size: 0.5rem;
    line-height: 1;
  }

  .ppp-t2-pill--more {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .ppp-t2-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

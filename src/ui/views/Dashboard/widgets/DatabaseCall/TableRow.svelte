<script lang="ts">
  /**
   * TableRow — F2.2/F2.3 (TABLE_V2_CANON §1/§3). Grid row: primary Name cell
   * (identity, hover ↗ OPEN + ⋯ row menu), every other cell is an
   * EditableCell. The row knows nothing about persistence — edits and row
   * operations bubble to the orchestrator as semantic events.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import type { DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { cellDisplay, type TableColumn } from "./tableCanon";
  import EditableCell from "./EditableCell.svelte";

  export let columns: TableColumn[];
  export let record: DataRecord;
  export let readonly: boolean;
  /** Field name currently edited in THIS record (single editor per table). */
  export let editingField: string | null = null;
  /** Unique value lists for Select/Status dropdowns, keyed by field name. */
  export let optionsByField: ReadonlyMap<string, string[]> = new Map();

  const dispatch = createEventDispatcher<{
    openRecord: DataRecord;
    rowMenu: { record: DataRecord; event: MouseEvent };
    startEdit: { recordId: string; field: string };
    commitEdit: { record: DataRecord; field: string; value: Optional<DataValue> };
    cancelEdit: void;
  }>();

  function nameText(): string {
    const col = columns.find((c) => c.isPrimary);
    if (!col) return record.id;
    const cell = cellDisplay(col.field, record.values[col.field.name]);
    return cell.kind === "text" ? cell.text : record.id;
  }
</script>

<div class="ppp-t2-row" role="row">
  {#each columns as col (col.field.name)}
    {#if col.isPrimary}
      <div class="ppp-t2-cell ppp-t2-cell--primary" role="gridcell">
        <span class="ppp-t2-name">{nameText()}</span>
        <button
          class="ppp-t2-rowbtn clickable-icon"
          on:click|stopPropagation={() => dispatch("openRecord", record)}
          aria-label={$i18n.t("views.dashboard.table-v2.open", { defaultValue: "Open note" })}
          title={$i18n.t("views.dashboard.table-v2.open", { defaultValue: "Open note" })}
        ><Icon name="arrow-up-right" size="sm" /></button>
        {#if !readonly}
          <button
            class="ppp-t2-rowbtn clickable-icon"
            on:click|stopPropagation={(e) => dispatch("rowMenu", { record, event: e })}
            aria-label={$i18n.t("views.dashboard.table-v2.row-menu", { defaultValue: "Row actions" })}
            title={$i18n.t("views.dashboard.table-v2.row-menu", { defaultValue: "Row actions" })}
          ><Icon name="more-horizontal" size="sm" /></button>
        {/if}
      </div>
    {:else}
      <EditableCell
        field={col.field}
        value={record.values[col.field.name]}
        {readonly}
        editing={editingField === col.field.name}
        options={optionsByField.get(col.field.name) ?? []}
        on:startEdit={() => dispatch("startEdit", { recordId: record.id, field: col.field.name })}
        on:commit={(e) => dispatch("commitEdit", { record, field: col.field.name, value: e.detail })}
        on:cancel={() => dispatch("cancelEdit")}
      />
    {/if}
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

  .ppp-t2-name {
    font-weight: var(--font-medium, 500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ppp-t2-rowbtn {
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

  .ppp-t2-row:hover .ppp-t2-rowbtn {
    opacity: 1;
  }

  .ppp-t2-rowbtn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
</style>

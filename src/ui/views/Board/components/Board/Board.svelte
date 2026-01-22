<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { dndzone } from "svelte-dnd-action";

  import BoardColumn from "./BoardColumn.svelte";
  import NewColumn from "./NewColumn.svelte";
  import type {
    Column,
    OnRecordAdd,
    OnRecordClick,
    OnRecordCheck,
    OnRecordUpdate,
    OnSortColumns,
    OnColumnAdd,
    OnColumnDelete,
    OnColumnRename,
    OnColumnCollapse,
    OnColumnPin,
  } from "./types";

  export let columns: Column[];

  export let readonly: boolean;
  export let richText: boolean;
  export let onRecordClick: OnRecordClick;
  export let onRecordCheck: OnRecordCheck;
  export let onRecordUpdate: OnRecordUpdate;
  export let onRecordAdd: OnRecordAdd;
  export let columnWidth: number;
  export let onSortColumns: OnSortColumns;
  export let onColumnAdd: OnColumnAdd;
  export let onColumnDelete: OnColumnDelete;
  export let onColumnRename: OnColumnRename;
  export let onColumnCollapse: OnColumnCollapse;
  export let onColumnPin: OnColumnPin;
  import type { FieldError } from "src/lib/types/validation";
  export let validateStatusField: () => FieldError;
  export let checkField: string | undefined;
  export let includeFields: DataField[];
  export let customHeader: DataField | undefined;

  let boardEditing: boolean = false;
  let onEdit = (editing: boolean) => (boardEditing = editing);

  const flipDurationMs = 200;

  $: pinnedColumns = columns.filter((c) => c.pinned);
  $: unpinnedColumns = columns.filter((c) => !c.pinned);

  function handleDndConsider(e: CustomEvent<DndEvent<Column>>) {
    const newUnpinned = e.detail.items;
    columns = [...pinnedColumns, ...newUnpinned];
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<Column>>) {
    const newUnpinned = e.detail.items;
    columns = [...pinnedColumns, ...newUnpinned];
    onSortColumns(columns.map((col) => col.id));
  }
</script>

<div>
  <!-- Pinned columns: fixed position, no column-level DnD -->
  {#if pinnedColumns.length > 0}
    <section class="projects--board projects--board--pinned">
      {#each pinnedColumns as column (column.id)}
        <div class="projects--board--column--dndwrapper projects--board--column--pinned">
        <BoardColumn
          {readonly}
          {richText}
          {boardEditing}
          {onEdit}
          width={columnWidth}
          collapse={column.collapse}
          pinned={column.pinned}
          name={column.id}
          records={column.records}
          {onRecordClick}
          {checkField}
          {onRecordCheck}
          onRecordAdd={() => onRecordAdd(column.id)}
          onDrop={(record, records, trigger) => {
            // Disallow cross-column drop into pinned columns
            if (trigger === "droppedIntoAnother") return;
            onRecordUpdate(record, { ...column, records }, "addToColumn");
          }}
          {includeFields}
          {customHeader}
          onColumnPin={(name) =>
            onColumnPin(
              columns.map((col) => col.id),
              name
            )}
          onColumnDelete={(name, records) =>
            onColumnDelete(
              columns.map((col) => col.id),
              name,
              records
            )}
          {onColumnCollapse}
          onColumnRename={(name) => {
            const cols = columns.map((col) => col.id);
            onColumnRename(cols, column.id, name, column.records);
          }}
          onValidate={(name) => {
            if (name === "") return false;
            if (columns.map((col) => col.id).includes(name)) return false;
            return true;
          }}
        />
      </div>
    {/each}
    </section>
  {/if}

  <!-- Unpinned columns: DnD enabled within unpinned subset -->
  <section
    class="projects--board"
    use:dndzone={{
      type: "columns",
      items: unpinnedColumns,
      flipDurationMs,
      dropTargetStyle: {
        outline: "none",
      },
      dragDisabled: boardEditing,
      morphDisabled: true,
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
  >
    {#each unpinnedColumns as column (column.id)}
      <div class="projects--board--column--dndwrapper">
        <BoardColumn
          {readonly}
          {richText}
          {boardEditing}
          {onEdit}
          width={columnWidth}
          collapse={column.collapse}
          pinned={column.pinned}
          name={column.id}
          records={column.records}
          {onRecordClick}
          {checkField}
          {onRecordCheck}
          onRecordAdd={() => onRecordAdd(column.id)}
          onDrop={(record, records, trigger) => {
            switch (trigger) {
              case "droppedIntoZone":
                onRecordUpdate(record, { ...column, records }, "addToColumn");
                break;
              case "droppedIntoAnother":
                onRecordUpdate(
                  record,
                  { ...column, records },
                  "removeFromColumn"
                );
                break;
            }
          }}
          {includeFields}
          {customHeader}
          onColumnPin={(name) =>
            onColumnPin(
              columns.map((col) => col.id),
              name
            )}
          onColumnDelete={(name, records) =>
            onColumnDelete(
              columns.map((col) => col.id),
              name,
              records
            )}
          {onColumnCollapse}
          onColumnRename={(name) => {
            const cols = columns.map((col) => col.id);
            onColumnRename(cols, column.id, name, column.records);
          }}
          onValidate={(name) => {
            if (name === "") return false;
            if (columns.map((col) => col.id).includes(name)) return false;
            return true;
          }}
        />
      </div>
    {/each}
  </section>
  {#if !readonly}
    <NewColumn
      {onEdit}
      onColumnAdd={(name) => {
        const cols = columns.map((col) => col.id);
        onColumnAdd(cols, name);
      }}
      fieldError={validateStatusField()}
      onValidate={(name) => {
        if (name === "") return false;
        if (columns.map((col) => col.id).includes(name)) return false;

        return true;
      }}
    />
  {/if}
</div>

<style>
  div {
    display: flex;
  }

  .projects--board--column--dndwrapper {
    flex-shrink: 0;
  }
</style>

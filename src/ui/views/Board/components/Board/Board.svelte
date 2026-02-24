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
    OnColumnPersist,
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
  export let onColumnPersist: OnColumnPersist;
  import type { FieldError } from "src/lib/types/validation";
  export let validateStatusField: () => FieldError;
  export let checkField: string | undefined;
  export let includeFields: DataField[];
  export let customHeader: DataField | undefined;

  /** Zoom level (0.25 – 2.0, default 1) */
  export let zoom: number = 1;
  export let onZoomChange: (zoom: number) => void = () => {};

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.05;

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

  /**
   * Svelte action — registers a non-passive wheel listener so that
   * e.preventDefault() reliably blocks the browser's built-in
   * Ctrl+Scroll zoom while the plugin's own zoom is active.
   */
  function wheelZoom(node: HTMLElement) {
    function handler(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta)) * 100) / 100;
      if (next !== zoom) {
        zoom = next;
        onZoomChange(next);
      }
    }
    node.addEventListener('wheel', handler, { passive: false });
    return {
      destroy() {
        node.removeEventListener('wheel', handler);
      }
    };
  }

  function handleResetZoom() {
    zoom = 1;
    onZoomChange(1);
  }
</script>

<div class="projects--board--container" use:wheelZoom>
<div
  class="projects--board--viewport"
  style={zoom !== 1 ? `zoom: ${zoom}; width: ${zoom < 1 ? (100 / zoom) + '%' : '100%'}` : ''}
>
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
          persisted={column.persisted}
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
          {onColumnPersist}
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
          persisted={column.persisted}
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
          {onColumnPersist}
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
</div>

  <!-- Zoom indicator -->
  {#if zoom !== 1}
    <button
      class="projects--board--zoom-badge"
      on:click={handleResetZoom}
      title="Reset zoom"
    >
      {Math.round(zoom * 100)}%
    </button>
  {/if}

<style>
  .projects--board--container {
    position: relative;
    overflow: auto;
    width: 100%;
    height: 100%;
  }

  .projects--board--viewport {
    display: flex;
  }

  .projects--board--zoom-badge {
    position: fixed;
    bottom: 2.5rem;
    right: 1rem;
    z-index: 100;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: var(--radius-m);
    padding: 0.25rem 0.625rem;
    font-size: var(--font-ui-smaller);
    font-weight: 600;
    cursor: pointer;
    opacity: 0.85;
    transition: opacity 150ms ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .projects--board--zoom-badge:hover {
    opacity: 1;
  }

  .projects--board--column--dndwrapper {
    flex-shrink: 0;
  }
</style>

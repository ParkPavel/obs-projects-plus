<script lang="ts">
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { dragHandleZone, dragHandle } from "svelte-dnd-action";
  import { Icon } from "obsidian-svelte";

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
   *
   * v3.0.10: Also handles pinch-to-zoom on touch devices.
   */
  function wheelZoom(node: HTMLElement) {
    // --- Desktop: Ctrl+Wheel ---
    function wheelHandler(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta)) * 100) / 100;
      if (next !== zoom) {
        zoom = next;
        onZoomChange(next);
      }
    }

    // --- Touch: Pinch-to-zoom ---
    let initialPinchDistance: number | null = null;
    let initialZoom: number = zoom;

    function getPinchDistance(touches: TouchList): number {
      const [a, b] = [touches[0], touches[1]];
      if (!a || !b) return 0;
      return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    }

    function touchStartHandler(e: TouchEvent) {
      if (e.touches.length === 2) {
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoom = zoom;
      }
    }

    function touchMoveHandler(e: TouchEvent) {
      if (e.touches.length !== 2 || initialPinchDistance === null) return;
      e.preventDefault();
      const currentDistance = getPinchDistance(e.touches);
      const scale = currentDistance / initialPinchDistance;
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, initialZoom * scale)) * 100) / 100;
      if (next !== zoom) {
        zoom = next;
        onZoomChange(next);
      }
    }

    function touchEndHandler(e: TouchEvent) {
      if (e.touches.length < 2) {
        initialPinchDistance = null;
      }
    }

    // --- Safari: GestureEvent (scale-based pinch) ---
    function gestureStartHandler(e: any) {
      e.preventDefault();
      initialZoom = zoom;
    }

    function gestureChangeHandler(e: any) {
      e.preventDefault();
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, initialZoom * e.scale)) * 100) / 100;
      if (next !== zoom) {
        zoom = next;
        onZoomChange(next);
      }
    }

    node.addEventListener('wheel', wheelHandler, { passive: false });
    node.addEventListener('touchstart', touchStartHandler, { passive: true });
    node.addEventListener('touchmove', touchMoveHandler, { passive: false });
    node.addEventListener('touchend', touchEndHandler, { passive: true });
    node.addEventListener('gesturestart', gestureStartHandler, { passive: false });
    node.addEventListener('gesturechange', gestureChangeHandler, { passive: false });

    return {
      destroy() {
        node.removeEventListener('wheel', wheelHandler);
        node.removeEventListener('touchstart', touchStartHandler);
        node.removeEventListener('touchmove', touchMoveHandler);
        node.removeEventListener('touchend', touchEndHandler);
        node.removeEventListener('gesturestart', gestureStartHandler);
        node.removeEventListener('gesturechange', gestureChangeHandler);
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
    use:dragHandleZone={{
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
        <span class="board-column-grip" use:dragHandle aria-label="Drag to reorder column">
          <Icon name="grip-vertical" size="xs" />
        </span>
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
    /* v3.1.0: Prevent scroll chaining to Obsidian workspace on mobile */
    overscroll-behavior: contain;
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
    position: relative;
  }

  /* Column drag grip — top-left corner, visually separated from header */
  .board-column-grip {
    position: absolute;
    top: 0.5rem;
    left: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1.25rem;
    border-radius: var(--radius-s);
    color: var(--text-faint);
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
    z-index: 2;
  }

  .projects--board--column--dndwrapper:hover .board-column-grip {
    opacity: 0.45;
  }

  .board-column-grip:hover {
    opacity: 1;
    color: var(--text-muted);
    background: var(--background-modifier-hover);
  }

  .board-column-grip:active {
    cursor: grabbing;
    color: var(--text-normal);
  }

  /* On touch devices, always show the column grip (subtle) */
  @media (pointer: coarse) {
    .board-column-grip {
      opacity: 0.3;
      width: 1.125rem;
      height: 1.5rem;
    }
  }
</style>

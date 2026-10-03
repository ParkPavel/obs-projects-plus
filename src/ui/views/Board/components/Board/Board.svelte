<script lang="ts">
  import { i18n } from "src/lib/stores/i18n";
  import { isTouchDevice } from "src/lib/stores/ui";
  import { getAnimationDuration } from "src/lib/helpers/animation";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import {
    dragHandleZone,
    dragHandle,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    TRIGGERS,
  } from "svelte-dnd-action";
  import { Icon } from "obsidian-svelte";
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";
  import { remAt, rootFontPx, toRem } from "src/ui/utils/cssLength";

  import BoardColumn from "./BoardColumn.svelte";
  import NewColumn from "./NewColumn.svelte";
  // ios-d1: the column row is a `dragHandleZone` sharing the cards' arming
  // store, so a tap on a column grip must disarm it too (see CardList).
  import { disarmAfterGripTap, gateDisabledGrip, isDisarmEvent, isDragZoneDisabled } from "./CardList.svelte";
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
  import type { BoardThumbnailLayout } from "../../types";
  import type { CardFrame, NormalizedCardFrames } from "src/ui/components/SharedCard/cardFrames";

  export let columns: Column[];

  export let readonly: boolean;
  /** #C4 — see BoardView.svelte for what this covers and why it is separate from `readonly`. */
  export let dataReadOnly: boolean = false;
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
  export let iconField: DataField | undefined = undefined;
  /** cards-g4 — card thumbnails: where (BoardConfig) and from which field. */
  export let thumbnailLayout: BoardThumbnailLayout = "none";
  export let coverField: DataField | undefined = undefined;
  /** cards-g5 — saved card frames (BoardView) and their change route, passed to every column. */
  export let cardFrames: NormalizedCardFrames = { view: {}, byRecord: {} };
  export let onCardFrameChange: ((recordId: string, frame: CardFrame | undefined) => void) | undefined = undefined;

  /** Zoom level (0.25 – 2.0, default 1) */
  export let zoom: number = 1;
  export let onZoomChange: (zoom: number) => void = () => {};

  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.05;
  const COLLAPSED_COLUMN_FOOTPRINT = 48;

  let boardEditing: boolean = false;
  let onEdit = (editing: boolean) => (boardEditing = editing);

  // cards-g1: 0 under reduced motion, as for cards (CardList).
  const flipDurationMs = getAnimationDuration(150);

  // Guard: prevent reactive prop updates from resetting DnD state mid-drag
  let isDraggingColumns = false;
  let finalizeTimeout: ReturnType<typeof setTimeout> | undefined;
  let pendingColumnOrder: string[] | undefined;
  type DndColumn = Column & Record<string, unknown>;

  $: pinnedColumns = columns.filter((c) => c.pinned);
  $: if (!isDraggingColumns) {
    dndUnpinnedColumns = columns.filter((c) => !c.pinned);
  }
  let dndUnpinnedColumns: DndColumn[] = columns.filter((c) => !c.pinned);

  const isShadowPlaceholder = (column: DndColumn) =>
    Boolean(column[SHADOW_ITEM_MARKER_PROPERTY_NAME]) ||
    column.id === SHADOW_PLACEHOLDER_ITEM_ID ||
    column.id === SHADOW_PLACEHOLDER_ITEM_ID.toString();

  const getColumnFootprint = (column: Pick<Column, "collapse"> | undefined) =>
    column?.collapse ? COLLAPSED_COLUMN_FOOTPRINT : columnWidth;

  const hasMatchingOrder = (items: Column[], order: string[]) =>
    items.length === order.length && items.every((item, index) => item.id === order[index]);

  $: if (pendingColumnOrder && hasMatchingOrder(columns, pendingColumnOrder)) {
    pendingColumnOrder = undefined;
    isDraggingColumns = false;
  }

  function filterShadowColumns(items: DndColumn[]): Column[] {
    return items.filter((column) => !isShadowPlaceholder(column));
  }

  // ios-c1: the column row may not start a drag while editing, zoomed or
  // read-only. `dragHandleZone` ignores its `dragDisabled`, so the grips are
  // gated (`gateDisabledGrip`) and, as a safeguard, a drag that still starts
  // while disabled is not committed: its finalize restores the order.
  $: columnZoneDisabled = isDragZoneDisabled({ editing: boardEditing, locked: dataReadOnly, zoom });
  let rejectedColumnDrag: DndColumn[] | undefined;

  function handleDndConsider(e: CustomEvent<DndEvent<Column>>) {
    // The disarm signal is not a drag: it must not freeze the column order.
    if (isDisarmEvent(e)) return;
    if (e.detail.info.trigger === TRIGGERS.DRAG_STARTED && columnZoneDisabled) {
      rejectedColumnDrag = dndUnpinnedColumns;
    }
    isDraggingColumns = true;
    dndUnpinnedColumns = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<Column>>) {
    if (rejectedColumnDrag) {
      dndUnpinnedColumns = rejectedColumnDrag;
      rejectedColumnDrag = undefined;
      isDraggingColumns = false;
      return;
    }
    dndUnpinnedColumns = e.detail.items;
    const newUnpinned = filterShadowColumns(dndUnpinnedColumns);
    pendingColumnOrder = [...pinnedColumns, ...newUnpinned].map((col) => col.id);
    // Dispatch after flip animation completes to prevent reactive cascade mid-animation
    clearTimeout(finalizeTimeout);
    finalizeTimeout = setTimeout(() => {
      if (pendingColumnOrder) {
        onSortColumns(pendingColumnOrder);
      }
    }, flipDurationMs + 50);
  }

  onDestroy(() => {
    if (pendingColumnOrder) {
      onSortColumns(pendingColumnOrder);
      pendingColumnOrder = undefined;
    }
    clearTimeout(finalizeTimeout);
    isDraggingColumns = false;
  });

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

<!-- ios-g1 G2: interior swipes pan the board instead of opening Obsidian's
     drawer at the board's scroll boundary; edge swipes still reach the host. -->
<div class="projects--board--container" use:wheelZoom use:ignoreHostSwipe>
  <div
    class="projects--board--viewport"
    style={zoom !== 1 ? `transform: scale(${zoom}); transform-origin: top left; width: ${100 / zoom}%; height: ${100 / zoom}%` : ""}
  >
    {#if pinnedColumns.length > 0}
      <section class="projects--board projects--board--pinned">
        {#each pinnedColumns as column (column.id)}
          <div class="projects--board--column--dndwrapper projects--board--column--pinned">
            <BoardColumn
              {readonly}
              {dataReadOnly}
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
                if (trigger === "droppedIntoAnother") return;
                onRecordUpdate(record, { ...column, records }, "addToColumn");
              }}
              {includeFields}
              {customHeader}
              {iconField}
              {thumbnailLayout}
              {coverField}
              {cardFrames}
              {onCardFrameChange}
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

    <section
      class="projects--board"
      use:dragHandleZone={{
        type: "columns",
        items: dndUnpinnedColumns,
        flipDurationMs,
        dropTargetStyle: {
          outline: "none",
        },
        transformDraggedElement: (element) => {
          if (!element) return;
          const rect = element.getBoundingClientRect();
          const root = rootFontPx(element.ownerDocument);
          const width = remAt(rect.width, root);
          const height = remAt(rect.height, root);
          element.style.width = width;
          element.style.minWidth = width;
          element.style.maxWidth = width;
          element.style.height = height;
          element.style.minHeight = height;
          element.style.boxSizing = "border-box";
          element.style.zIndex = "30";
        },
        // Overwritten by `dragHandleZone`; `gateDisabledGrip` below enforces it.
        dragDisabled: dataReadOnly || columnZoneDisabled,
        morphDisabled: true,
        // ios-d1: as for cards (CardList) — the column grip leads its header,
        // so on touch centre the clone on the finger for zone hit-tests.
        centreDraggedOnCursor: $isTouchDevice,
      }}
      use:disarmAfterGripTap={".board-column-grip"}
      use:gateDisabledGrip={{ grip: ".board-column-grip", disabled: columnZoneDisabled }}
      on:consider={handleDndConsider}
      on:finalize={handleDndFinalize}
    >
      {#each dndUnpinnedColumns as column (column.id)}
        {@const footprint = toRem(getColumnFootprint(column))}
        <div
          class="projects--board--column--dndwrapper"
          class:projects--board--column--dndwrapper--placeholder={isShadowPlaceholder(column)}
          class:projects--board--column--dndwrapper--collapsed={column.collapse}
          data-dnd-width={footprint}
          style={`width: ${footprint}; min-width: ${footprint}; max-width: ${footprint};`}
          aria-hidden={isShadowPlaceholder(column) ? "true" : undefined}
          animate:flip={{ duration: flipDurationMs }}
        >
          {#if isShadowPlaceholder(column)}
            <div class="projects--board--column--placeholder" style={`width: ${footprint}; min-width: ${footprint}; max-width: ${footprint};`}></div>
          {:else}
            <!-- cards-g1: a collapsed column is a rotated strip whose expand action
                 sits at its top, so its grip is a strip of its own above it. -->
            {#if column.collapse}
              <span class="board-column-grip board-column-grip--strip" use:dragHandle aria-label={$i18n.t("views.board.drag-column")}>
                <Icon name="grip-vertical" size="xs" />
              </span>
            {/if}
            <BoardColumn
              {readonly}
              {dataReadOnly}
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
              {iconField}
              {thumbnailLayout}
              {coverField}
              {cardFrames}
              {onCardFrameChange}
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
            >
              <svelte:fragment slot="grip">
                <!-- cards-g1: the expanded column's grip is the first cell of its
                     header row; a double click on it is not a rename. -->
                {#if !column.collapse}
                  <span class="board-column-grip" use:dragHandle on:dblclick|stopPropagation aria-label={$i18n.t("views.board.drag-column")}>
                    <Icon name="grip-vertical" size="xs" />
                  </span>
                {/if}
              </svelte:fragment>
            </BoardColumn>
          {/if}
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

{#if zoom !== 1}
  <button
    class="projects--board--zoom-badge"
    on:click={handleResetZoom}
    title={$i18n.t("views.board.reset-zoom")}
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
    overscroll-behavior: contain;
    /* ios-s1: this box scrolls the board on both axes, and on a phone its
       bottom is under Obsidian's floating navbar. End space of the host's own
       `--view-bottom-spacing` (Obsidian app.css, `.is-phone`; 0 by default,
       navbar + home-indicator inset with the floating nav — the value Bases
       reserves) lets the last card scroll above the bar; vertical only, the
       horizontal end is not obstructed. `border-box` keeps it inside the
       100%, so a short board's columns end above the bar instead of the
       container growing past its parent. 0/unset on desktop and tablets. */
    box-sizing: border-box;
    padding-bottom: var(--view-bottom-spacing, 0);
  }

  .projects--board--viewport {
    display: flex;
    min-height: 100%;
  }

  .projects--board--zoom-badge {
    position: fixed;
    bottom: 2.5rem;
    /* ios-s1: fixed to the window's bottom, i.e. under Obsidian's floating
       navbar on a phone. The margin lifts the offset by the host's
       `--view-bottom-spacing` without a calc over a value that may be 0. */
    margin-bottom: var(--view-bottom-spacing, 0);
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
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  }

  @media (hover: hover) and (pointer: fine) {
    .projects--board--zoom-badge:hover {
      opacity: 1;
    }
  }

  .projects--board--column--dndwrapper {
    flex-shrink: 0;
    position: relative;
    box-sizing: border-box;
  }

  .projects--board--column--placeholder {
    min-height: 12rem;
    border: var(--ppp-border-width) dashed var(--background-modifier-border-hover);
    border-radius: var(--radius-m);
    background: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
  }

  /* cards-g1: the column grip is a cell of its own, in flow — the first item
     of an expanded column's header row (BoardColumn's `grip` slot), or a strip
     above a collapsed column — never over the border, the title or an action.
     Pinned columns render none and keep their header whole. The cell is sized
     from the space scale and the glyph (the xs icon) is smaller than it. */
  .board-column-grip {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-4-5);
    height: 1.5rem;
    margin-right: var(--size-4-1);
    border-radius: var(--radius-s);
    color: var(--text-faint);
    opacity: 0.5;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
    z-index: 2;
  }

  /* The collapsed column's rotated strip ends in its expand action at the top;
     the grip takes a strip of the column's width above it, not its corner. */
  .board-column-grip--strip {
    width: 100%;
    height: var(--size-4-6);
    margin-right: 0;
  }

  /* cards-g1: low contrast at rest, so a fine pointer without hover still finds
     it; full on keyboard focus or while focus is inside the column. */
  .projects--board--column--dndwrapper:focus-within .board-column-grip,
  .board-column-grip:focus-visible {
    opacity: 1;
    color: var(--text-muted);
  }

  /* Stronger under the mouse — only where a hover exists. */
  @media (hover: hover) and (pointer: fine) {
    .projects--board--column--dndwrapper:hover .board-column-grip {
      opacity: 0.8;
    }

    .board-column-grip:hover {
      opacity: 1;
      color: var(--text-muted);
      background: var(--background-modifier-hover);
    }
  }

  .board-column-grip:active {
    cursor: grabbing;
    color: var(--text-normal);
  }

  /* ios-t1: on touch the grip is the only way to move a column, so it is shown
     plainly and is a finger-sized cell, glyph centred. cards-g1: in flow, so
     the header's title and actions start after it with no padding to keep in
     step; the collapsed strip is the column's full 3rem width and a target tall. */
  @media (pointer: coarse) {
    .board-column-grip {
      opacity: 0.7;
      color: var(--text-muted);
      width: var(--ppp-touch-target-min);
      height: var(--ppp-touch-target-min);
      margin-right: 0;
    }

    .board-column-grip--strip {
      width: 100%;
    }
  }
</style>

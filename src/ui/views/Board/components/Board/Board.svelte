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
  import { onDestroy, onMount } from "svelte";
  import { Notice } from "obsidian";
  import { sortRecordsContext } from "src/ui/views/helpers";
  import {
    computeDropWrites,
    createTouchCardDrag,
    type DragBlockReason,
    type TouchCardDragHandle,
    type TouchCardDropDetail,
  } from "./touchCardDrag";
  import { ignoreHostSwipe } from "src/ui/actions/ignoreHostSwipe";
  import { remAt, rootFontPx, toRem } from "src/ui/utils/cssLength";

  import BoardColumn from "./BoardColumn.svelte";
  import NewColumn from "./NewColumn.svelte";
  // ios-d1: the column row is a `dragHandleZone` sharing the cards' arming
  // store, so a tap on a column grip must disarm it too (see CardList).
  import { disarmAfterGripTap, gateDisabledGrip, isDisarmEvent, isDragZoneDisabled, zoomHeldByDrag } from "./CardList.svelte";
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
  /** B10 — the note editor (the card's pencil); the card itself opens the peek. */
  export let onRecordEdit: OnRecordClick | undefined = undefined;
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

  // cards-g1: 0 under reduced motion, as for cards (CardList). stab-board: no
  // per-item `animate:flip` here either (see CardList: it measures every item
  // on each `consider`); the value is the library's drop animation.
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

  // ios-c1: the column row may not start a drag while editing or read-only
  // (w4-p08, N6: at any zoom). `dragHandleZone` ignores its `dragDisabled`, so
  // the grips are gated (`gateDisabledGrip`) and, as a safeguard, a drag that
  // still starts while disabled is not committed: its finalize restores the order.
  $: columnZoneDisabled = isDragZoneDisabled({ editing: boardEditing, locked: dataReadOnly });
  let rejectedColumnDrag: DndColumn[] | undefined;

  function handleDndConsider(e: CustomEvent<DndEvent<Column>>) {
    // The disarm signal is not a drag: it must not freeze the column order.
    if (isDisarmEvent(e)) return;
    if (e.detail.info.trigger === TRIGGERS.DRAG_STARTED && columnZoneDisabled) {
      rejectedColumnDrag = dndUnpinnedColumns;
    }
    isDraggingColumns = true;
    dndUnpinnedColumns = e.detail.items;
    armDragWatchdog();
  }

  /**
   * i3-board — a column drag that never ends. When the pressed grip is
   * removed before the release (the column re-renders as the drag starts),
   * the release never reaches the window, the library waits for it forever
   * and refuses every later drag in every zone. If neither a consider nor a
   * finalize comes for a few seconds, the release is sent for it and the
   * board leaves its drag state.
   */
  const DRAG_WATCHDOG_MS = 8000;
  let dragWatchdog: ReturnType<typeof setTimeout> | undefined;
  // i3-final: a consider event comes only when the shadow moves, so holding a
  // column still is not "no events". Any pointer movement during the drag
  // re-arms the watchdog; only a drag nothing is moving ends on its own.
  let watchedView: Window | null = null;
  const onDragActivity = () => { if (isDraggingColumns) armDragWatchdog(); };
  function watchActivity(view: Window | null) {
    if (view === watchedView) return;
    for (const type of ["pointermove", "touchmove", "mousemove"]) {
      watchedView?.removeEventListener(type, onDragActivity, true);
      view?.addEventListener(type, onDragActivity, { capture: true, passive: true });
    }
    watchedView = view;
  }
  function disarmDragWatchdog() {
    clearTimeout(dragWatchdog);
    dragWatchdog = undefined;
    watchActivity(null);
  }
  function armDragWatchdog() {
    clearTimeout(dragWatchdog);
    const view = containerEl?.ownerDocument.defaultView ?? window;
    watchActivity(view);
    dragWatchdog = setTimeout(() => {
      dragWatchdog = undefined;
      watchActivity(null);
      if (!isDraggingColumns) return;
      // The library ends a drag on the window's mouseup and touchend alike.
      view.dispatchEvent(new MouseEvent("mouseup"));
      releaseColumnDrag();
    }, DRAG_WATCHDOG_MS);
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<Column>>) {
    disarmDragWatchdog();
    if (rejectedColumnDrag) {
      dndUnpinnedColumns = rejectedColumnDrag;
      rejectedColumnDrag = undefined;
      isDraggingColumns = false;
      return;
    }
    dndUnpinnedColumns = e.detail.items;
    const newUnpinned = filterShadowColumns(dndUnpinnedColumns);
    const order = [...pinnedColumns, ...newUnpinned].map((col) => col.id);
    // i3-board: a column dropped where it was writes nothing. Every attempt
    // used to save the view and the field options and rebuild every column.
    if (hasMatchingOrder(columns, order)) {
      releaseColumnDrag();
      return;
    }
    pendingColumnOrder = order;
    // Dispatch after flip animation completes to prevent reactive cascade mid-animation
    clearTimeout(finalizeTimeout);
    finalizeTimeout = setTimeout(() => {
      if (pendingColumnOrder) {
        onSortColumns(pendingColumnOrder);
      }
      // i3-board: the drag ends here even if no matching `columns` comes back
      // (a read-only source saves nothing, or the saved order sorts
      // differently); waiting for that echo alone froze the board for good.
      finalizeTimeout = setTimeout(releaseColumnDrag, COLUMN_ECHO_WAIT_MS);
    }, flipDurationMs + 50);
  }

  const COLUMN_ECHO_WAIT_MS = 1000;
  function releaseColumnDrag() {
    pendingColumnOrder = undefined;
    isDraggingColumns = false;
  }

  /**
   * i3-board — the column menu's Move left / Move right: the same write as a
   * drag, for the keyboard and for a phone where a grip drag is awkward.
   * Pinned columns stay first and are not moved.
   */
  function moveColumn(name: string, delta: -1 | 1) {
    if (dataReadOnly) return;
    const unpinned = columns.filter((c) => !c.pinned).map((c) => c.id);
    const from = unpinned.indexOf(name);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= unpinned.length) return;
    unpinned.splice(to, 0, ...unpinned.splice(from, 1));
    onSortColumns([...pinnedColumns.map((c) => c.id), ...unpinned]);
  }
  $: unpinnedIds = columns.filter((c) => !c.pinned).map((c) => c.id);

  onDestroy(() => {
    if (pendingColumnOrder) {
      onSortColumns(pendingColumnOrder);
      pendingColumnOrder = undefined;
    }
    clearTimeout(finalizeTimeout);
    disarmDragWatchdog();
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
    // w4-p08 (N6): the zoom holds still while anything on the board is dragged.
    const held = () => zoomHeldByDrag(node.ownerDocument, isDraggingColumns, Boolean(touchDrag?.isActive()));

    // --- Desktop: Ctrl+Wheel ---
    function wheelHandler(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (held()) return;
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
      // p372-b8: a second finger cancels a card drag (touchCardDrag); while
      // one is under way, a pinch never starts.
      if (held()) return;
      if (e.touches.length === 2) {
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoom = zoom;
      }
    }

    function touchMoveHandler(e: TouchEvent) {
      if (e.touches.length !== 2 || initialPinchDistance === null) return;
      e.preventDefault();
      if (held()) {
        initialPinchDistance = null;
        return;
      }
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
      if (held()) return;
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

  // ── p372-b8: touch and pen drag cards here, not through the library ──
  const sortRecords = sortRecordsContext.get();
  let containerEl: HTMLElement;
  let viewportEl: HTMLElement;
  let touchDrag: TouchCardDragHandle | undefined;
  let lastBlockedNotice = 0;

  function touchBlockReason(columnEl: HTMLElement): DragBlockReason | null {
    if (boardEditing) return "editing";
    if (dataReadOnly) return "readonly";
    if (columnEl.classList.contains("pinned")) return "pinned";
    return null;
  }

  function onTouchBlocked(reason: DragBlockReason) {
    const now = Date.now();
    if (now - lastBlockedNotice < 2000) return;
    lastBlockedNotice = now;
    const text =
      reason === "pinned"
        ? $i18n.t("views.board.drag-blocked.pinned")
        : reason === "readonly"
          ? $i18n.t("views.board.drag-blocked.readonly")
          : $i18n.t("views.board.drag-blocked.editing");
    new Notice(text);
  }

  /** The same writer as the library's drop: target `addToColumn`, then source `removeFromColumn`. */
  function onTouchDrop({ recordId, fromColumnId, toColumnId, index }: TouchCardDropDetail) {
    if (dataReadOnly) return;
    const writes = computeDropWrites(columns, recordId, fromColumnId, toColumnId, index);
    const record = columns.find((c) => c.id === fromColumnId)?.records.find((r) => r.id === recordId);
    if (!record) return;
    for (const write of writes) {
      const column = columns.find((c) => c.id === write.columnId);
      if (!column) continue;
      const records = write.trigger === "addToColumn" ? sortRecords(write.records) : write.records;
      onRecordUpdate(record, { ...column, records }, write.trigger);
    }
  }

  onMount(() => {
    touchDrag = createTouchCardDrag({
      container: containerEl,
      viewport: viewportEl,
      getScale: () => zoom,
      blockReason: touchBlockReason,
      onBlocked: onTouchBlocked,
      onDrop: onTouchDrop,
    });
    return () => touchDrag?.destroy();
  });

  function handleResetZoom() {
    zoom = 1;
    onZoomChange(1);
  }
</script>

<!-- ios-g1 G2: interior swipes pan the board instead of opening Obsidian's
     drawer at the board's scroll boundary; edge swipes still reach the host. -->
<div class="projects--board--container" bind:this={containerEl} use:wheelZoom use:ignoreHostSwipe>
  <div
    bind:this={viewportEl}
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
              {zoom}
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
              {onRecordEdit}
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
          // i3-board: the library calls this first while its clone is not in the
          // document yet; that clone measures 0×0, and pinning it to 0rem put
          // the hit point (the clone's centre) at the column's top-left corner —
          // half a column away from the finger, so an expanded column never
          // landed anywhere (a collapsed one, 3rem wide, barely noticed). The
          // library has already sized the clone from the real column in px.
          if (!element || !element.isConnected) return;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const root = rootFontPx(element.ownerDocument);
          // w4-p08 (N6): on a zoomed board the column's rect is scaled, and the
          // clone (outside the board's transform) holds unscaled content. As
          // for cards (scaleDraggedClone): the logical size, drawn at the zoom.
          // The scaled clone measures the same rect again, so this is stable.
          const scale = zoom > 0 ? zoom : 1;
          const width = remAt(rect.width / scale, root);
          const height = remAt(rect.height / scale, root);
          if (scale !== 1) {
            element.classList.add("ppp-board-scaled-clone");
            element.style.scale = String(scale);
          }
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
              {zoom}
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
              {onRecordEdit}
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
              onColumnMove={dataReadOnly ? undefined : moveColumn}
              canMoveLeft={unpinnedIds.indexOf(column.id) > 0}
              canMoveRight={unpinnedIds.indexOf(column.id) < unpinnedIds.length - 1}
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
    /* p372-b8: the touch drag's preview and line are placed in it. */
    position: relative;
    display: flex;
    min-height: 100%;
  }

  /* p372-b8: the touch drag (touchCardDrag.ts). The preview is a copy of
     the card in the scaled viewport, moved by transform only; the line marks
     where it will land; the source stays in place, dimmed, so nothing in the
     lists moves under the finger. */
  .projects--board--container:global(.ppp-board-touch-dragging) {
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .projects--board--viewport :global(.ppp-board-touch-preview) {
    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--ppp-z-overlay);
    pointer-events: none;
    min-height: 0;
    background: none;
    will-change: transform;
    filter: drop-shadow(var(--shadow-s));
  }
  .projects--board--viewport :global(.ppp-board-touch-line) {
    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--ppp-z-overlay);
    height: var(--ppp-border-width-thick, 0.125rem);
    margin-top: calc(-0.5 * var(--ppp-border-width-thick, 0.125rem));
    border-radius: var(--radius-s);
    background: var(--interactive-accent);
    pointer-events: none;
  }
  .projects--board--viewport :global(.ppp-board-touch-line.is-hidden) {
    display: none;
  }
  .projects--board--viewport :global(.ppp-board-touch-source) {
    opacity: 0.35;
  }
  /* p372-b8: the library's mouse clone on a zoomed board (scaleDraggedClone). */
  :global(.ppp-board-scaled-clone) {
    box-sizing: border-box;
    transform-origin: top left;
  }
  @media (pointer: coarse) {
    .projects--board--viewport :global(.ppp-board-card-slot) {
      -webkit-touch-callout: none;
    }
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
    box-shadow: var(--shadow-s);
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

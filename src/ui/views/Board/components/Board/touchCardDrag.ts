/**
 * p372-b8 — a board card drag of its own for touch and pen.
 *
 * svelte-dnd-action clones the dragged item into `document.body` at the size
 * `getBoundingClientRect` reports. On a zoomed board (the viewport carries a
 * `transform: scale`) that is the SCALED box filled with UNSCALED content, so
 * the preview is a narrow, cropped strip (H01, S08/S09), and on a phone the
 * shadow reflow under the finger made cards sag. On touch and pen the board
 * therefore drags cards here instead; the mouse keeps the library.
 *
 * The contract (M04):
 * - a long press on a card (shorter on its grip) starts the drag; a pan before
 *   it fires is a pan, a second finger is a pinch, and both cancel it;
 * - the preview is a copy of the card INSIDE the scaled viewport, so it has
 *   exactly the card's look at the board's scale;
 * - geometry (columns, card slots) is read once, at start, in logical board
 *   coordinates, which do not change when the board scrolls; a move reads no
 *   layout: it converts the pointer and moves the preview by `transform` in an
 *   animation frame. Only an auto-scroll reads the scroll offsets back;
 * - nothing in the lists moves during the drag: the source card is dimmed in
 *   place and an insertion line marks the target, so nothing sags;
 * - a drop calls `onDrop` once with the target; a cancel (pointercancel,
 *   Escape, a drop outside the board, a second finger, blur) calls nothing.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A card slot, in logical board coordinates. */
export interface SlotGeom {
  id: string;
  top: number;
  bottom: number;
}

/** A column's card list, in logical board coordinates. */
export interface ColumnGeom {
  id: string;
  left: number;
  right: number;
  top: number;
  slots: SlotGeom[];
}

export interface DropTarget {
  columnId: string;
  /** Insertion index among the column's cards WITHOUT the dragged one. */
  index: number;
  /** Logical y of the insertion line. */
  lineY: number;
}

/**
 * A screen point (client px) to logical board coordinates: the viewport's
 * top-left `origin` on screen and the board's `scale` (its `transform: scale`).
 */
export function screenToBoard(point: Point, origin: Point, scale: number): Point {
  const s = scale > 0 ? scale : 1;
  return { x: (point.x - origin.x) / s, y: (point.y - origin.y) / s };
}

/** A screen box to logical board coordinates (see `screenToBoard`). */
export function boxToBoard(box: Box, origin: Point, scale: number): Box {
  const a = screenToBoard({ x: box.left, y: box.top }, origin, scale);
  const b = screenToBoard({ x: box.right, y: box.bottom }, origin, scale);
  return { left: a.x, top: a.y, right: b.x, bottom: b.y };
}

/** Logical px a point may sit beside a column (in the gap) and still target it. */
const COLUMN_SLACK = 24;
/** Logical px of the line above the first card of an empty-start list. */
const LINE_INSET = 4;

/**
 * The drop target under logical point `p`: the column whose span holds `p.x`
 * (or the nearest within `COLUMN_SLACK`), and the index among its cards
 * without `sourceId` before which `p.y` falls (by each card's middle).
 */
export function pickDropTarget(columns: readonly ColumnGeom[], p: Point, sourceId: string): DropTarget | null {
  let best: ColumnGeom | undefined;
  let bestDistance = Infinity;
  for (const column of columns) {
    const distance = p.x < column.left ? column.left - p.x : p.x > column.right ? p.x - column.right : 0;
    if (distance < bestDistance) {
      best = column;
      bestDistance = distance;
    }
  }
  if (!best || bestDistance > COLUMN_SLACK) return null;

  const slots = best.slots.filter((slot) => slot.id !== sourceId);
  let index = 0;
  while (index < slots.length) {
    const slot = slots[index] as SlotGeom;
    if (p.y < (slot.top + slot.bottom) / 2) break;
    index += 1;
  }
  const prev = slots[index - 1];
  const next = slots[index];
  let lineY: number;
  if (prev && next) lineY = (prev.bottom + next.top) / 2;
  else if (prev) lineY = prev.bottom + LINE_INSET;
  else if (next) lineY = next.top - LINE_INSET;
  else lineY = best.top + LINE_INSET;
  return { columnId: best.id, index, lineY };
}

/**
 * Auto-scroll speed (px per frame) for a pointer at `pos` on an axis whose
 * visible span is [start, end]: 0 outside the edge bands, growing linearly to
 * `max` at the edge itself; negative toward the start.
 */
export function edgeScrollDelta(pos: number, start: number, end: number, edge = 48, max = 18): number {
  if (end - start <= edge * 2) return 0;
  if (pos < start + edge) return -Math.round(max * Math.min(1, (start + edge - pos) / edge));
  if (pos > end - edge) return Math.round(max * Math.min(1, (pos - (end - edge)) / edge));
  return 0;
}

export interface DropWrite<R> {
  columnId: string;
  records: R[];
  trigger: "addToColumn" | "removeFromColumn";
}

/**
 * The writes a drop makes, in the order the library made them: the target
 * column (`addToColumn`, the one write that sets the group field), then, for
 * a move between columns, the source (`removeFromColumn`). A drop back where
 * the card was writes nothing.
 */
export function computeDropWrites<R extends { id: string }>(
  columns: ReadonlyArray<{ id: string; records: readonly R[] }>,
  recordId: string,
  fromColumnId: string,
  toColumnId: string,
  index: number
): DropWrite<R>[] {
  const from = columns.find((c) => c.id === fromColumnId);
  const to = columns.find((c) => c.id === toColumnId);
  if (!from || !to) return [];
  const record = from.records.find((r) => r.id === recordId);
  if (!record) return [];
  const targetRest = to.records.filter((r) => r.id !== recordId);
  const at = Math.max(0, Math.min(index, targetRest.length));
  const targetRecords = [...targetRest.slice(0, at), record, ...targetRest.slice(at)];
  if (from === to) {
    const unchanged = targetRecords.every((r, i) => r.id === from.records[i]?.id);
    return unchanged ? [] : [{ columnId: to.id, records: targetRecords, trigger: "addToColumn" }];
  }
  return [
    { columnId: to.id, records: targetRecords, trigger: "addToColumn" },
    { columnId: from.id, records: from.records.filter((r) => r.id !== recordId), trigger: "removeFromColumn" },
  ];
}

// ── controller ──

export type DragBlockReason = "pinned" | "readonly" | "editing";

export interface TouchCardDropDetail {
  recordId: string;
  fromColumnId: string;
  toColumnId: string;
  index: number;
}

export interface TouchCardDragOptions {
  /** The board's scroll container. */
  container: HTMLElement;
  /** The scaled viewport inside it (the preview and the line live here). */
  viewport: HTMLElement;
  getScale: () => number;
  /** Why a drag of a card from this column may not start, or null. */
  blockReason: (columnEl: HTMLElement) => DragBlockReason | null;
  onBlocked: (reason: DragBlockReason) => void;
  onDrop: (detail: TouchCardDropDetail) => void;
  /** Hold on the card body before the drag starts (ms). */
  longPressMs?: number;
  /** Hold on the grip before the drag starts (ms); moving it starts at once. */
  gripPressMs?: number;
  raf?: (cb: () => void) => number;
  caf?: (id: number) => void;
}

export interface TouchCardDragHandle {
  isActive: () => boolean;
  destroy: () => void;
}

const SLOT = ".ppp-board-card-slot";
const GRIP = ".board-card-grip";
const COLUMN = ".projects--board--column";
const LIST = ".projects--board--card-list";
/** Presses on these keep their own touch behaviour (links, controls, resize). */
const OWN_GESTURE = "a, button, input, textarea, select, [contenteditable='true'], .internal-link, [data-ppp-no-drag]";
/** Movement (px) that turns a pending press into a pan. */
const PAN_SLOP = 8;
/** Movement (px) on the grip that starts the drag before its timer. */
const GRIP_SLOP = 4;

type State =
  | { kind: "idle" }
  | {
      kind: "pending";
      pointerId: number;
      start: Point;
      onGrip: boolean;
      slot: HTMLElement;
      column: HTMLElement;
      timer: ReturnType<typeof setTimeout>;
    }
  | {
      kind: "active";
      pointerId: number;
      recordId: string;
      fromColumnId: string;
      slot: HTMLElement;
      scale: number;
      containerBox: Box;
      originStart: Point;
      scrollStart: Point;
      origin: Point;
      grab: Point;
      columns: ColumnGeom[];
      preview: HTMLElement;
      line: HTMLElement;
      pointer: Point;
      target: DropTarget | null;
      frame: number | null;
    };

function rectBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

export function createTouchCardDrag(options: TouchCardDragOptions): TouchCardDragHandle {
  const { container, viewport } = options;
  const longPressMs = options.longPressMs ?? 450;
  const gripPressMs = options.gripPressMs ?? 150;
  const raf = options.raf ?? ((cb: () => void) => window.requestAnimationFrame(cb));
  const caf = options.caf ?? ((id: number) => window.cancelAnimationFrame(id));
  let state: State = { kind: "idle" };
  /** A click right after a drag or a blocked press opens nothing. */
  let swallowClickUntil = 0;

  const isTouchLike = (e: PointerEvent) => e.pointerType === "touch" || e.pointerType === "pen";
  const pointOf = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });

  function onPointerDown(e: PointerEvent) {
    if (state.kind !== "idle") {
      // A second finger: a pinch or a pan with two, never a drag.
      if (e.pointerId !== state.pointerId) cancel();
      return;
    }
    if (!isTouchLike(e) || !e.isPrimary) return;
    if (!(e.target instanceof Element)) return;
    const slot = e.target.closest<HTMLElement>(SLOT);
    if (!slot || !container.contains(slot)) return;
    const onGrip = e.target.closest(GRIP) !== null;
    if (!onGrip && e.target.closest(OWN_GESTURE)) return;
    const column = slot.closest<HTMLElement>(COLUMN);
    if (!column) return;
    const start = pointOf(e);
    const pointerId = e.pointerId;
    const timer = setTimeout(() => fire(), onGrip ? gripPressMs : longPressMs);
    state = { kind: "pending", pointerId, start, onGrip, slot, column, timer };
    addWindowListeners();
  }

  function fire() {
    if (state.kind !== "pending") return;
    const { slot, column, pointerId, start } = state;
    const reason = options.blockReason(column);
    if (reason) {
      reset();
      swallowClickUntil = Date.now() + 600;
      options.onBlocked(reason);
      return;
    }
    activate(slot, column, pointerId, start);
  }

  function readColumns(origin: Point, scale: number): ColumnGeom[] {
    const result: ColumnGeom[] = [];
    viewport.querySelectorAll<HTMLElement>(COLUMN).forEach((columnEl) => {
      const id = columnEl.dataset["id"];
      const list = columnEl.querySelector<HTMLElement>(LIST);
      if (id === undefined || !list) return;
      const box = boxToBoard(rectBox(columnEl), origin, scale);
      const listBox = boxToBoard(rectBox(list), origin, scale);
      const slots: SlotGeom[] = [];
      list.querySelectorAll<HTMLElement>(`:scope > ${SLOT}`).forEach((slotEl) => {
        const slotId = slotEl.dataset["recordId"];
        if (slotId === undefined) return;
        const b = boxToBoard(rectBox(slotEl), origin, scale);
        slots.push({ id: slotId, top: b.top, bottom: b.bottom });
      });
      result.push({ id, left: box.left, right: box.right, top: listBox.top, slots });
    });
    return result;
  }

  function activate(slot: HTMLElement, column: HTMLElement, pointerId: number, pointer: Point) {
    const recordId = slot.dataset["recordId"];
    const fromColumnId = column.dataset["id"];
    if (recordId === undefined || fromColumnId === undefined) {
      reset();
      return;
    }
    const scale = options.getScale() || 1;
    const vBox = rectBox(viewport);
    const origin = { x: vBox.left, y: vBox.top };
    const columns = readColumns(origin, scale);
    const slotBox = boxToBoard(rectBox(slot), origin, scale);
    const p = screenToBoard(pointer, origin, scale);

    // The copy lives in the scaled viewport: it is the card, at the board's scale.
    const preview = document.createElement("div");
    preview.className = "projects--board--card-list ppp-board-touch-preview";
    preview.setAttribute("aria-hidden", "true");
    preview.style.width = `${slotBox.right - slotBox.left}px`;
    const copy = slot.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-record-id");
    preview.append(copy);
    const line = document.createElement("div");
    line.className = "ppp-board-touch-line";
    line.setAttribute("aria-hidden", "true");
    viewport.append(preview, line);

    slot.classList.add("ppp-board-touch-source");
    container.classList.add("ppp-board-touch-dragging");

    state = {
      kind: "active",
      pointerId,
      recordId,
      fromColumnId,
      slot,
      scale,
      containerBox: rectBox(container),
      originStart: origin,
      scrollStart: { x: container.scrollLeft, y: container.scrollTop },
      origin,
      grab: { x: p.x - slotBox.left, y: p.y - slotBox.top },
      columns,
      preview,
      line,
      pointer,
      target: null,
      frame: null,
    };
    render();
  }

  function schedule() {
    if (state.kind !== "active" || state.frame !== null) return;
    state.frame = raf(() => {
      if (state.kind !== "active") return;
      state.frame = null;
      render();
    });
  }

  function render() {
    if (state.kind !== "active") return;
    const s = state;
    // Auto-scroll first, so the frame shows where the board now is.
    const dx = edgeScrollDelta(s.pointer.x, s.containerBox.left, s.containerBox.right);
    const dy = edgeScrollDelta(s.pointer.y, s.containerBox.top, s.containerBox.bottom);
    let scrolling = false;
    if (dx !== 0 || dy !== 0) {
      const beforeX = container.scrollLeft;
      const beforeY = container.scrollTop;
      container.scrollLeft = beforeX + dx;
      container.scrollTop = beforeY + dy;
      const afterX = container.scrollLeft;
      const afterY = container.scrollTop;
      scrolling = afterX !== beforeX || afterY !== beforeY;
      s.origin = {
        x: s.originStart.x - (afterX - s.scrollStart.x),
        y: s.originStart.y - (afterY - s.scrollStart.y),
      };
    }
    const p = screenToBoard(s.pointer, s.origin, s.scale);
    s.preview.style.transform = `translate3d(${p.x - s.grab.x}px, ${p.y - s.grab.y}px, 0)`;
    const inside =
      s.pointer.x >= s.containerBox.left &&
      s.pointer.x <= s.containerBox.right &&
      s.pointer.y >= s.containerBox.top &&
      s.pointer.y <= s.containerBox.bottom;
    s.target = inside ? pickDropTarget(s.columns, p, s.recordId) : null;
    if (s.target) {
      const column = s.columns.find((c) => c.id === s.target?.columnId) as ColumnGeom;
      s.line.style.display = "";
      s.line.style.width = `${column.right - column.left}px`;
      s.line.style.transform = `translate3d(${column.left}px, ${s.target.lineY}px, 0)`;
    } else {
      s.line.style.display = "none";
    }
    if (scrolling) schedule();
  }

  function onPointerMove(e: PointerEvent) {
    if (state.kind === "pending") {
      if (e.pointerId !== state.pointerId) return;
      const dist = Math.hypot(e.clientX - state.start.x, e.clientY - state.start.y);
      if (state.onGrip && dist > GRIP_SLOP) {
        clearTimeout(state.timer);
        fire();
        const after = state as State;
        if (after.kind === "active") {
          after.pointer = pointOf(e);
          schedule();
        }
      } else if (!state.onGrip && dist > PAN_SLOP) {
        reset();
      }
      return;
    }
    if (state.kind !== "active" || e.pointerId !== state.pointerId) return;
    state.pointer = pointOf(e);
    schedule();
  }

  function onPointerUp(e: PointerEvent) {
    if (state.kind === "pending") {
      if (e.pointerId === state.pointerId) reset();
      return;
    }
    if (state.kind !== "active" || e.pointerId !== state.pointerId) return;
    state.pointer = pointOf(e);
    if (state.frame !== null) {
      caf(state.frame);
      state.frame = null;
    }
    render();
    const { target, recordId, fromColumnId } = state;
    reset();
    swallowClickUntil = Date.now() + 600;
    if (target) options.onDrop({ recordId, fromColumnId, toColumnId: target.columnId, index: target.index });
  }

  function cancel() {
    if (state.kind === "active") swallowClickUntil = Date.now() + 600;
    reset();
  }

  function reset() {
    if (state.kind === "pending") clearTimeout(state.timer);
    if (state.kind === "active") {
      if (state.frame !== null) caf(state.frame);
      state.preview.remove();
      state.line.remove();
      state.slot.classList.remove("ppp-board-touch-source");
      container.classList.remove("ppp-board-touch-dragging");
    }
    state = { kind: "idle" };
    removeWindowListeners();
  }

  function onTouchMove(e: TouchEvent) {
    // Active (or a grip press, whose lane has `touch-action: none` anyway):
    // the finger moves the card, not the board.
    if (state.kind === "active" || (state.kind === "pending" && state.onGrip)) {
      if (e.touches.length > 1) {
        cancel();
        return;
      }
      if (e.cancelable) e.preventDefault();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && state.kind !== "idle") {
      e.preventDefault();
      cancel();
    }
  }

  function onContextMenu(e: Event) {
    // Android's long-press menu would end the drag it is part of.
    if (state.kind !== "idle") e.preventDefault();
  }

  function onClick(e: Event) {
    if (Date.now() < swallowClickUntil) {
      swallowClickUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const onCancel = () => cancel();
  let windowListening = false;
  function addWindowListeners() {
    if (windowListening) return;
    windowListening = true;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onCancel);
    window.addEventListener("resize", onCancel);
  }
  function removeWindowListeners() {
    if (!windowListening) return;
    windowListening = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("blur", onCancel);
    window.removeEventListener("resize", onCancel);
  }

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("touchmove", onTouchMove, { passive: false });
  container.addEventListener("contextmenu", onContextMenu);
  container.addEventListener("click", onClick, true);

  return {
    isActive: () => state.kind === "active",
    destroy() {
      reset();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("click", onClick, true);
    },
  };
}

/**
 * On a card list (a `dragHandleZone`): a single-finger touchstart on a card
 * grip never reaches the grip's `dragHandle` listener, so the library starts
 * no touch drag; touch and pen drag through `createTouchCardDrag`. The mouse
 * is untouched. A second finger passes (a pinch is not a grip press).
 */
export function blockLibraryTouchGrip(node: HTMLElement): { destroy: () => void } {
  function block(e: TouchEvent) {
    // A synthetic touchstart may carry no list; it is one finger then.
    const fingers = (e as Partial<TouchEvent>).touches?.length ?? 1;
    if (fingers > 1) return;
    if (!(e.target instanceof Element)) return;
    const grip = e.target.closest(GRIP);
    if (grip && node.contains(grip)) e.stopPropagation();
  }
  node.addEventListener("touchstart", block, { capture: true, passive: true });
  return {
    destroy() {
      node.removeEventListener("touchstart", block, true);
    },
  };
}

/**
 * svelte-dnd-action's mouse clone of a card on a zoomed board: the library
 * sizes the clone from the SCALED rect but its content is unscaled, so it is
 * a cropped strip. Give it the card's logical size and the board's scale (the
 * CSS `scale` property, which the library's `transform: translate` leaves
 * alone), origin top-left: its box on screen is the card's box again, and the
 * library's hit-test, which reads that box, aims where the preview is.
 */
export function scaleDraggedClone(element: HTMLElement | undefined, zoom: number): void {
  if (!element || zoom === 1 || !(zoom > 0)) return;
  if (element.dataset["pppScaled"] === String(zoom)) return;
  const rect = element.getBoundingClientRect();
  element.dataset["pppScaled"] = String(zoom);
  element.style.width = `${rect.width / zoom}px`;
  element.style.height = `${rect.height / zoom}px`;
  element.style.boxSizing = "border-box";
  element.style.transformOrigin = "top left";
  element.style.setProperty("scale", String(zoom));
}

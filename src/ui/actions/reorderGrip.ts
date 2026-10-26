// w4-p06 (CONSOLIDATION §7 row 17) — a row of a list moved by its grip, with
// a mouse, a pen or a finger.
//
// The view's field list and the gallery's card fields were reordered by HTML
// drag and drop, which never starts from touch: on a phone the order could not
// be changed, and the view list hid its grip there. The grip (≡, on the left,
// as on iOS) now follows the pointer: pressed, it captures the pointer, the
// row under the pointer is reported as the slot, and the release moves the row
// there. The arrow keys on the grip stay the keyboard's way.

export interface ReorderGripOptions {
  /** The row this grip moves. */
  readonly key: string;
  /** The rows of the list, in order: the grip's row is among them. */
  readonly rows: () => HTMLElement[];
  /** The row's key, read from its element. */
  readonly keyOf: (row: HTMLElement) => string | undefined;
  /** Moves `key` to slot `to` (an index among `rows()`). */
  readonly onMove: (key: string, to: number) => void;
  /** The slot the row would take, while a drag is on; null when it ends. */
  readonly onOver?: (key: string | null) => void;
  readonly disabled?: boolean;
}

/**
 * The slot a pointer at `y` points to: the row under it, whose place the moved
 * row takes (as a drop on that row did); above the first or below the last,
 * the first or the last.
 */
export function slotAt(y: number, rows: readonly HTMLElement[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (y < rows[i]!.getBoundingClientRect().bottom) return i;
  }
  return Math.max(0, rows.length - 1);
}

export function reorderGrip(node: HTMLElement, initial: ReorderGripOptions) {
  let options = initial;
  let pointer: number | null = null;
  let slot = -1;

  function end(commit: boolean): void {
    if (pointer === null) return;
    if (node.hasPointerCapture?.(pointer)) node.releasePointerCapture(pointer);
    pointer = null;
    options.onOver?.(null);
    const from = options.rows().findIndex((row) => options.keyOf(row) === options.key);
    if (commit && slot >= 0 && from >= 0 && slot !== from) options.onMove(options.key, slot);
    slot = -1;
  }

  function onDown(e: PointerEvent): void {
    if (options.disabled || pointer !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    pointer = e.pointerId;
    node.setPointerCapture?.(e.pointerId);
    slot = options.rows().findIndex((row) => options.keyOf(row) === options.key);
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    const rows = options.rows();
    slot = slotAt(e.clientY, rows);
    options.onOver?.(options.keyOf(rows[slot]!) ?? null);
  }

  const onUp = (e: PointerEvent) => { if (e.pointerId === pointer) end(true); };
  const onCancel = (e: PointerEvent) => { if (e.pointerId === pointer) end(false); };

  node.addEventListener("pointerdown", onDown);
  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerup", onUp);
  node.addEventListener("pointercancel", onCancel);
  return {
    update(next: ReorderGripOptions) {
      options = next;
    },
    destroy() {
      end(false);
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onUp);
      node.removeEventListener("pointercancel", onCancel);
    },
  };
}

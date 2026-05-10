/**
 * Svelte action: use:draggable
 * Injects a six-dot drag handle (⠿) into the widget header and
 * lets the user reposition the widget on the CSS grid.
 * Dispatches via onMove callback with new { x, y } (1-based grid coords).
 *
 * Grid coordinates match WidgetLayout: x = column start (1-based), y = row start (1-based).
 */

export interface DraggableParams {
  /** Current column start (1-based). */
  x: number;
  /** Current row start (1-based). */
  y: number;
  /** Width in grid units. */
  w: number;
  /** Height in grid units. */
  h: number;
  /** Disable dragging (e.g. locked widget or readonly mode). */
  enabled?: boolean;
  /** Called on drag end with the new grid position. */
  onMove?: (x: number, y: number) => void;
}

export function draggable(node: HTMLElement, params: DraggableParams) {
  let { x, y, w, h, enabled = true, onMove } = params;

  const handle = document.createElement("button");
  handle.className = "ppp-drag-handle clickable-icon";
  handle.textContent = "⠿";
  handle.setAttribute("aria-hidden", "true");
  handle.setAttribute("tabindex", "-1");
  handle.type = "button";

  function attachHandle() {
    const header = node.querySelector(".ppp-widget-header");
    if (header) {
      header.insertBefore(handle, header.firstChild);
    } else {
      node.prepend(handle);
    }
  }

  if (enabled) attachHandle();

  let startClientX = 0;
  let startClientY = 0;
  let startX = 0;
  let startY = 0;
  let cellW = 0;
  let cellH = 0;

  function onPointerDown(e: PointerEvent) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    startClientX = e.clientX;
    startClientY = e.clientY;
    startX = x;
    startY = y;

    // Measure grid cell from current widget dimensions.
    const rect = node.getBoundingClientRect();
    cellW = rect.width / w;
    cellH = rect.height / h;

    handle.setPointerCapture(e.pointerId);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    node.classList.add("ppp-widget-host--dragging");
    document.body.classList.add("ppp-dragging");
  }

  function snap(val: number) {
    return Math.round(val);
  }

  function computePos(e: PointerEvent) {
    const dxUnits = (e.clientX - startClientX) / cellW;
    const dyUnits = (e.clientY - startClientY) / cellH;
    const newX = Math.max(1, Math.min(13 - w, snap(startX + dxUnits)));
    const newY = Math.max(1, snap(startY + dyUnits));
    return { newX, newY };
  }

  function onPointerMove(e: PointerEvent) {
    const { newX, newY } = computePos(e);
    node.style.gridColumn = `${newX} / span ${w}`;
    node.style.gridRow = `${newY} / span ${h}`;
  }

  function onPointerUp(e: PointerEvent) {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    node.classList.remove("ppp-widget-host--dragging");
    document.body.classList.remove("ppp-dragging");

    const { newX, newY } = computePos(e);

    // Clear live-preview inline styles
    node.style.gridColumn = "";
    node.style.gridRow = "";

    if (newX !== x || newY !== y) {
      onMove?.(newX, newY);
    }
  }

  handle.addEventListener("pointerdown", onPointerDown);

  return {
    update(newParams: DraggableParams) {
      x = newParams.x;
      y = newParams.y;
      w = newParams.w;
      h = newParams.h;
      onMove = newParams.onMove;

      const wasEnabled = enabled;
      enabled = newParams.enabled ?? true;

      if (enabled && !wasEnabled) attachHandle();
      else if (!enabled && wasEnabled) handle.remove();
    },
    destroy() {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.remove();
      document.body.classList.remove("ppp-dragging");
    },
  };
}

/**
 * Svelte action: use:resizable
 * Adds a bottom-right resize handle to a grid-placed widget.
 * Dispatches 'resize' CustomEvent with { w, h } on drag end.
 */

export interface ResizableParams {
  /** Current width in grid units */
  w: number;
  /** Current height in grid units */
  h: number;
  /** Minimum width in grid units */
  minW: number;
  /** Minimum height in grid units */
  minH: number;
  /** Maximum width in grid units (default 12) */
  maxW?: number;
  /** Snap resolution in grid units (default 1) */
  snap?: number;
  /** Whether resize is enabled */
  enabled?: boolean;
  /** Callback on resize end */
  onResize?: (w: number, h: number) => void;
}

export function resizable(
  node: HTMLElement,
  params: ResizableParams
) {
  let { w, h, minW, minH, maxW = 12, snap = 1, enabled = true, onResize } = params;

  // Create the resize handle element
  const handle = document.createElement("div");
  handle.className = "ppp-resize-handle";
  handle.setAttribute("aria-hidden", "true");

  if (enabled) {
    node.appendChild(handle);
    node.style.position = "relative";
  }

  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let cellWidth = 0;
  let cellHeight = 0;

  function onPointerDown(e: PointerEvent) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    startX = e.clientX;
    startY = e.clientY;
    startW = w;
    startH = h;

    // Measure one grid cell size from the current element
    const rect = node.getBoundingClientRect();
    cellWidth = rect.width / w;
    cellHeight = rect.height / (node.classList.contains("ppp-widget-host--collapsed") ? 1 : h);

    handle.setPointerCapture(e.pointerId);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);

    node.classList.add("ppp-widget-host--resizing");
  }

  function onPointerMove(e: PointerEvent) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const rawW = startW + dx / cellWidth;
    const rawH = startH + dy / cellHeight;

    // Snap to grid units
    const snappedW = Math.round(rawW / snap) * snap;
    const snappedH = Math.round(rawH / snap) * snap;

    const newW = Math.max(minW, Math.min(maxW, snappedW));
    const newH = Math.max(minH, Math.min(24, snappedH));

    // Live preview via inline styles
    node.style.gridColumn = newW === 12 ? "1 / -1" : `span ${newW}`;
    node.style.gridRow = `span ${newH}`;
  }

  function onPointerUp(e: PointerEvent) {
    handle.releasePointerCapture(e.pointerId);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);

    node.classList.remove("ppp-widget-host--resizing");

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const rawW = startW + dx / cellWidth;
    const rawH = startH + dy / cellHeight;

    const snappedW = Math.round(rawW / snap) * snap;
    const snappedH = Math.round(rawH / snap) * snap;

    const newW = Math.max(minW, Math.min(maxW, snappedW));
    const newH = Math.max(minH, Math.min(24, snappedH));

    // Clear inline styles — let grid placement take over
    node.style.gridColumn = "";
    node.style.gridRow = "";

    if (newW !== w || newH !== h) {
      onResize?.(newW, newH);
    }
  }

  handle.addEventListener("pointerdown", onPointerDown);

  return {
    update(newParams: ResizableParams) {
      w = newParams.w;
      h = newParams.h;
      minW = newParams.minW;
      minH = newParams.minH;
      maxW = newParams.maxW ?? 12;
      snap = newParams.snap ?? 1;

      onResize = newParams.onResize;

      const wasEnabled = enabled;
      enabled = newParams.enabled ?? true;

      if (enabled && !wasEnabled) {
        node.appendChild(handle);
        node.style.position = "relative";
      } else if (!enabled && wasEnabled) {
        handle.remove();
      }
    },
    destroy() {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.remove();
    },
  };
}

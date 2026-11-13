import { styleColumnClone } from "./columnCloneStyle";

const compacted = new WeakSet<HTMLElement>();
/** The library appends its clone on the frame after it asks for the transform. */
const MAX_WAIT_FRAMES = 6;

/**
 * Compact only the library's visual copy; the original handle stays connected.
 * The clone ends up centred on its original centre, which the library puts
 * under the pointer (`centreDraggedOnCursor`), so the compact strip is where
 * the pointer is and the library's hit-test aims at it.
 */
export function compactDraggedColumn(
  element: HTMLElement | undefined,
  columnWidth: number,
  zoom: number,
  footprint = 48,
  waited = 0,
): void {
  if (!element || compacted.has(element)) return;
  // At once: the library's clone slides to the pointer under inline transitions.
  element.classList.add("ppp-board-column-clone");
  if (!element.isConnected) {
    const view = element.ownerDocument.defaultView;
    if (view && waited < MAX_WAIT_FRAMES) {
      view.requestAnimationFrame(() => compactDraggedColumn(element, columnWidth, zoom, footprint, waited + 1));
    }
    return;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  compacted.add(element);
  styleColumnClone(element, rect, columnWidth, zoom, footprint);
}

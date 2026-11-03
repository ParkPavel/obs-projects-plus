import { remAt, rootFontPx } from "src/ui/utils/cssLength";
const offsets = new WeakMap<HTMLElement, { x: number; y: number }>();

/** Compact only the library's visual copy; the original handle stays connected. */
export function compactDraggedColumn(element: HTMLElement | undefined, columnWidth: number, zoom: number, footprint = 48): void {
  if (!element || !element.isConnected) return;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const root = rootFontPx(element.ownerDocument);
  element.classList.add("ppp-board-column-clone");
  const scale = zoom > 0 ? zoom : 1;
  const prior = offsets.get(element);
  // coercion-exempt: Class C — the library pins its original DOMRect in inline CSS px.
  const originalWidth = !prior && /px$/.test(element.style.width) ? parseFloat(element.style.width) : rect.width;
  const originalHeight = !prior && /px$/.test(element.style.height) ? parseFloat(element.style.height) : rect.height;
  const offset = { x: (prior?.x ?? 0) + (originalWidth - footprint * scale) / 2, y: (prior?.y ?? 0) + (originalHeight - columnWidth * scale) / 2 };
  const column = element.querySelector<HTMLElement>("section.projects--board--column");
  if (column) {
    column.classList.add("collapse");
    column.style.marginRight = remAt(footprint - columnWidth, root);
    column.style.height = remAt(footprint, root);
    for (const child of Array.from(column.children)) {
      if (!child.classList.contains("projects--board--column--header")) child.remove();
    }
  }
  const width = remAt(footprint, root);
  const height = remAt(columnWidth, root);
  element.classList.toggle("ppp-board-scaled-clone", scale !== 1);
  element.style.scale = String(scale);
  element.style.width = width;
  element.style.minWidth = width;
  element.style.maxWidth = width;
  element.style.height = height;
  element.style.minHeight = height;
  element.style.removeProperty("z-index");
  element.style.translate = `${remAt(offset.x, root)} ${remAt(offset.y, root)}`;
  offsets.set(element, offset);
}

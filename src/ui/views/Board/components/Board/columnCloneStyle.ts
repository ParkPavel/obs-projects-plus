import { remAt, rootFontPx } from "src/ui/utils/cssLength";
import { keepClonePaceWithPointer } from "./cloneMotion";

/** Style the visual copy only; the live column and its pressed handle stay intact. */
export function styleColumnClone(element: HTMLElement, rect: DOMRect, columnWidth: number, zoom: number, footprint: number): void {
  const root = rootFontPx(element.ownerDocument);
  const scale = zoom > 0 ? zoom : 1;
  // coercion-exempt: Class C — the library pins its original DOMRect in inline CSS px.
  const originalWidth = /px$/.test(element.style.width) ? parseFloat(element.style.width) : rect.width;
  const originalHeight = /px$/.test(element.style.height) ? parseFloat(element.style.height) : rect.height;
  const offset = { x: (originalWidth - footprint * scale) / 2, y: (originalHeight - columnWidth * scale) / 2 };
  const column = element.querySelector<HTMLElement>("section.projects--board--column");
  if (column) {
    column.classList.add("collapse");
    column.style.marginRight = remAt(footprint - columnWidth, root);
    column.style.height = remAt(footprint, root);
    for (const child of Array.from(column.children)) {
      if (!child.classList.contains("projects--board--column--header")) child.remove();
    }
  }
  const width = remAt(footprint, root), height = remAt(columnWidth, root);
  element.classList.toggle("ppp-board-scaled-clone", scale !== 1);
  element.style.scale = String(scale);
  element.style.width = width;
  element.style.minWidth = width;
  element.style.maxWidth = width;
  element.style.height = height;
  element.style.minHeight = height;
  element.style.removeProperty("z-index");
  element.style.translate = `${remAt(offset.x, root)} ${remAt(offset.y, root)}`;
  keepClonePaceWithPointer(element, scale);
}

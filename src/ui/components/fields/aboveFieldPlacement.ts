interface Bounds { top: number; bottom: number; left: number; right: number; width: number }
type Anchor = Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width" | "height">;

/** PP-INPUT-004: upper placement only; lack of space never flips the list below. */
export function aboveFieldPlacement(anchor: Anchor, natural: number, popupWidth: number, bounds: Bounds, base: number) {
  const margin = base / 2;
  const gap = base / 4;
  const rawAbove = anchor.top - gap - bounds.top - margin;
  const above = Math.max(0, rawAbove);
  const height = Math.min(natural, above);
  const width = Math.min(Math.max(popupWidth, anchor.width), Math.max(0, bounds.width - 2 * margin));
  const left = Math.min(Math.max(anchor.left, bounds.left + margin), Math.max(bounds.left + margin, bounds.right - width - margin));
  const visible = anchor.width > 0 && anchor.height > 0 && (
    height > 0 && above >= Math.min(natural, 2 * base) &&
    anchor.top >= bounds.top && anchor.bottom <= bounds.bottom &&
    anchor.right > bounds.left && anchor.left < bounds.right
  );
  return { top: anchor.top - gap - height, left, width, height, visible, missing: Math.max(0, Math.min(natural, 2 * base) - rawAbove) };
}

/** Move the original field down using existing scroll space, without focus or DOM replacement. */
export function makeRoomAbove(field: HTMLElement, missing: number, bounds: Bounds): void {
  let anchor = field.getBoundingClientRect();
  const wanted = anchor.top + missing;
  for (let parent = field.parentElement; parent && anchor.top < wanted; parent = parent.parentElement) {
    if (parent.scrollTop <= 0 || parent.scrollHeight <= parent.clientHeight) continue;
    const box = parent.getBoundingClientRect();
    const scale = parent.offsetHeight > 0 && box.height > 0 ? box.height / parent.offsetHeight : 1;
    const available = Math.max(0, Math.min(bounds.bottom, box.bottom) - anchor.bottom);
    const delta = Math.min(wanted - anchor.top, available, parent.scrollTop * scale);
    if (delta <= 0) continue;
    parent.scrollTop -= delta / scale;
    anchor = field.getBoundingClientRect();
  }
}

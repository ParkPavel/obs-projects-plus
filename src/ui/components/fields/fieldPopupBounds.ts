/** A modal's scrollable body is usable popup space; its fixed header is not. */
export function fieldPopupBounds<T extends {top:number;bottom:number;left:number;right:number;width:number;height:number}>(field: HTMLElement, viewport: T): T {
  const boundary = field.closest<HTMLElement>("[data-ppp-popup-boundary]");
  if (!boundary) return viewport;
  const box = boundary.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return viewport;
  const top = Math.max(viewport.top, box.top), bottom = Math.max(top, Math.min(viewport.bottom, box.bottom));
  const left = Math.max(viewport.left, box.left), right = Math.max(left, Math.min(viewport.right, box.right));
  return {...viewport, top, bottom, left, right, width:right-left, height:bottom-top};
}

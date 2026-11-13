import { remAt, rootFontPx } from "src/ui/utils/cssLength";
import { bindDragSessionEnd } from "src/ui/utils/dragSessionLifecycle";

const LIBRARY_TRANSLATION = /translate3d\(\s*(-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px/;

/**
 * The library moves its clone with `transform: translate3d(dx, dy)`, which a `scale` on the
 * same element multiplies: a zoomed clone would trail the pointer. This listener runs after
 * the library's own (registered later on the same window) and divides its translation by the
 * scale, so the clone keeps the pointer's pace.
 */
export function keepClonePaceWithPointer(element: HTMLElement, scale: number): void {
  const view = element.ownerDocument.defaultView;
  if (!view || scale === 1) return;
  const events = ["mousemove", "touchmove"];
  let unbind: (() => void) | undefined;
  const stop = () => {
    events.forEach((type) => view.removeEventListener(type, follow));
    unbind?.();
  };
  function follow() {
    if (!element.isConnected) return stop();
    const moved = LIBRARY_TRANSLATION.exec(element.style.transform);
    if (!moved) return;
    const root = rootFontPx(element.ownerDocument);
    // coercion-exempt: Class C — the library writes its translation in CSS px.
    element.style.transform = `translate3d(${remAt(parseFloat(moved[1]!) / scale, root)}, ${remAt(parseFloat(moved[2]!) / scale, root)}, 0)`;
  }
  events.forEach((type) => view.addEventListener(type, follow, { passive: true }));
  unbind = bindDragSessionEnd(element.ownerDocument, stop, stop);
}

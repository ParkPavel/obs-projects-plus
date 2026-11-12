import { remAt, rootFontPx } from "src/ui/utils/cssLength";
import { bindDragSessionEnd } from "src/ui/utils/dragSessionLifecycle";
import { keepClonePaceWithPointer } from "./cloneMotion";

const pending = new WeakSet<HTMLElement>();
const retired = new WeakSet<HTMLElement>();

/** The library asks before attaching its clone; measure only its rendered box. */
export function scaleDraggedClone(element: HTMLElement | undefined, zoom: number): void {
  if (!element || zoom === 1 || !(zoom > 0) || retired.has(element) || pending.has(element) || element.dataset["pppScaled"] === String(zoom)) return;
  const view = element.ownerDocument.defaultView;
  if (!view) return;
  pending.add(element);
  let frame = 0, attempts = 0;
  const cancel = () => { retired.add(element); stop(); };
  const unbind = bindDragSessionEnd(element.ownerDocument, cancel, cancel);
  function stop() { view!.cancelAnimationFrame(frame); pending.delete(element!); unbind(); }
  function measure() {
    const rect = element!.getBoundingClientRect();
    if (!element!.isConnected || rect.width <= 0 || rect.height <= 0) {
      if (++attempts < 6) frame = view!.requestAnimationFrame(measure);
      else stop();
      return;
    }
    stop();
    const root = rootFontPx(element!.ownerDocument);
    element!.style.width = remAt(rect.width / zoom, root);
    element!.style.height = remAt(rect.height / zoom, root);
    element!.classList.add("ppp-board-scaled-clone");
    element!.style.scale = String(zoom);
    element!.dataset["pppScaled"] = String(zoom);
    keepClonePaceWithPointer(element!, zoom);
  }
  measure();
}

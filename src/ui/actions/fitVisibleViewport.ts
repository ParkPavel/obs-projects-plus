import { onKeyboardChange, visibleViewport } from "src/ui/utils/visibleViewport";
import { remAt, rootFontPx } from "src/ui/utils/cssLength";

/**
 * Keep a body-portalled mobile layer inside its OWN keyboard-visible window.
 * w4-input: "visible" ends at the keyboard Obsidian reports (visibleViewport),
 * and the layer is placed again when that keyboard comes or goes.
 */
export function fitVisibleViewport(node: HTMLElement, boundsOf = visibleViewport) {
  const view = node.ownerDocument.defaultView ?? window;
  const viewport = view.visualViewport;
  function place() {
    const bounds = boundsOf(view);
    const base = rootFontPx(node.ownerDocument);
    node.style.top = remAt(bounds.top, base);
    node.style.left = remAt(bounds.left, base);
    node.style.width = remAt(bounds.width, base);
    node.style.height = remAt(bounds.height, base);
    const active = node.ownerDocument.activeElement as HTMLElement | null;
    if (active && node.contains(active)) {
      const rect = active.getBoundingClientRect();
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) active.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }
  place();
  const unwatchKeyboard = onKeyboardChange(view, place);
  viewport?.addEventListener("resize", place);
  viewport?.addEventListener("scroll", place);
  view.addEventListener("resize", place);
  node.addEventListener("focusin", place);
  return { update: place, destroy() {
    unwatchKeyboard();
    viewport?.removeEventListener("resize", place);
    viewport?.removeEventListener("scroll", place);
    view.removeEventListener("resize", place);
    node.removeEventListener("focusin", place);
  } };
}

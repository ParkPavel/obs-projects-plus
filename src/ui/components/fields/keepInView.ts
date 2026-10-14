/**
 * keepInView (3.7.2 B1b) — the one answer to "the keyboard covers the field".
 *
 * Every field of the kit carries it. While the field has focus it listens to
 * its own window's visualViewport (the on-screen keyboard shrinks it, a pinch
 * pans it) and, whenever the field's box leaves the visible part, scrolls the
 * nearest scroll container just enough to bring it back. Nothing is listened
 * to while the field is not focused, and everything is removed on blur and on
 * destroy, so a list of a hundred fields costs nothing until one is used.
 */
import { visibleViewport } from "src/ui/utils/visibleViewport";

export type ViewportBounds = ReturnType<typeof visibleViewport>;

export function keepInView(node: HTMLElement, boundsOf: (view: Window) => ViewportBounds = visibleViewport) {
  const view = node.ownerDocument.defaultView ?? window;
  let listening = false;

  function check(): void {
    const bounds = boundsOf(view);
    const rect = node.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
      node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    }
  }
  function start(): void {
    if (listening) return;
    listening = true;
    view.visualViewport?.addEventListener("resize", check);
    view.visualViewport?.addEventListener("scroll", check);
    view.addEventListener("resize", check);
    check();
  }
  function stop(): void {
    if (!listening) return;
    listening = false;
    view.visualViewport?.removeEventListener("resize", check);
    view.visualViewport?.removeEventListener("scroll", check);
    view.removeEventListener("resize", check);
  }

  node.addEventListener("focus", start);
  node.addEventListener("blur", stop);
  if (node.ownerDocument.activeElement === node) start();
  return {
    destroy(): void {
      stop();
      node.removeEventListener("focus", start);
      node.removeEventListener("blur", stop);
    },
  };
}

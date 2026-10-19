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
  let frame = 0;

  function check(): void {
    frame = 0;
    const bounds = boundsOf(view);
    const rect = node.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
      node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "auto" });
    }
  }
  // i3-input: one check per frame, and only when the visible area changes
  // size (the keyboard opens or closes). Reacting to visualViewport scroll as
  // well fought WebKit's own pan to the caret and a sheet that fits itself to
  // the keyboard: each scrollIntoView fired another scroll, and the field
  // drifted away while typing.
  function schedule(): void {
    if (frame === 0) frame = view.requestAnimationFrame ? view.requestAnimationFrame(check) : (check(), 0);
  }
  function start(): void {
    if (listening) return;
    listening = true;
    view.visualViewport?.addEventListener("resize", schedule);
    view.addEventListener("resize", schedule);
    check();
  }
  function stop(): void {
    if (!listening) return;
    listening = false;
    if (frame !== 0) view.cancelAnimationFrame?.(frame);
    frame = 0;
    view.visualViewport?.removeEventListener("resize", schedule);
    view.removeEventListener("resize", schedule);
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

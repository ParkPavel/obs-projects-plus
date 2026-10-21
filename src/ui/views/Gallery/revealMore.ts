/**
 * i3-gallery — calls `onReveal` when the node scrolls near the viewport of
 * the scroller it is in: the sentinel after the last rendered card of a large
 * gallery, which then renders its next window. Uses the IntersectionObserver
 * of the node's own window (a popout has its own); where there is none (jsdom,
 * an old webview) nothing happens and the visible "show more" button remains
 * the way on.
 *
 * `key` is the current window: when it changes the node is observed afresh,
 * because an observer reports crossings only, and a sentinel still in view
 * after a window grew would otherwise never ask for the next one.
 */
export interface RevealMoreOptions {
  readonly key: number;
  readonly onReveal: () => void;
}

export function revealMore(node: HTMLElement, options: RevealMoreOptions) {
  let current = options;
  const Observer = node.ownerDocument.defaultView?.IntersectionObserver;
  if (!Observer) {
    return {
      update(next: RevealMoreOptions) {
        current = next;
      },
    };
  }
  const observer = new Observer(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) current.onReveal();
    },
    { rootMargin: "0% 0% 50% 0%" }
  );
  observer.observe(node);
  return {
    update(next: RevealMoreOptions) {
      const changed = next.key !== current.key;
      current = next;
      if (changed) {
        observer.unobserve(node);
        observer.observe(node);
      }
    },
    destroy() {
      observer.disconnect();
    },
  };
}

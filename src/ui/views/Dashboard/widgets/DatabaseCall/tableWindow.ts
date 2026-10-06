/**
 * tableWindow - which part of a table is on screen, wherever the scrolling happens.
 *
 * The table windows its rows by how far its body is scrolled. That held while the
 * body was the scroller. In a dashboard tile it is not: the tile grows to the
 * full height of its rows and the PAGE scrolls, so the body's own scrollTop stays
 * 0 and only the first screenful of rows ever rendered. The visible part is now
 * measured the way the eye sees it: the body's box intersected with every
 * clipping ancestor and the window, so it is right whichever of them scrolls.
 */

export interface TableViewport {
  /** Pixels of the body's content above the visible part. */
  scrollTop: number;
  /** Height of the visible part, in pixels. */
  viewportPx: number;
}

const CLIPPING = /^(auto|scroll|hidden|overlay|clip)$/;

/** The node, then its ancestors that clip vertically, nearest first. */
function clippers(node: HTMLElement): HTMLElement[] {
  const view = node.ownerDocument.defaultView;
  const out: HTMLElement[] = [node];
  for (let el = node.parentElement; el && view; el = el.parentElement) {
    if (CLIPPING.test(view.getComputedStyle(el).getPropertyValue("overflow-y"))) out.push(el);
  }
  return out;
}

/** The visible part of `node`'s content, or null while it has no box (hidden, detached). */
export function measureViewport(node: HTMLElement): TableViewport | null {
  const view = node.ownerDocument.defaultView;
  const rect = node.getBoundingClientRect();
  if (!view || (rect.width === 0 && rect.height === 0)) return null;
  let top = 0;
  let bottom = view.innerHeight;
  for (const el of clippers(node)) {
    const box = el === node ? rect : el.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }
  // `node` clips too, so `top` is never above its own box: this is the content
  // offset of the visible top edge, and equals node.scrollTop when node scrolls.
  const above = top - rect.top + node.scrollTop;
  return {
    scrollTop: Math.min(above, Math.max(node.scrollHeight, rect.height)),
    viewportPx: Math.max(0, bottom - top),
  };
}

/**
 * Report the visible part of the node now, and again whenever it can change: a
 * scroll of the node, of any clipping ancestor or of the window, or a resize of
 * any of them. One frame is measured per burst of events.
 */
export function trackViewport(
  node: HTMLElement,
  onChange: (viewport: TableViewport) => void,
): { destroy?: () => void } {
  const view = node.ownerDocument.defaultView;
  if (!view) return {};
  // The node's own window (a popout has its own ResizeObserver constructor).
  const win: Window & { ResizeObserver?: typeof ResizeObserver } = view;
  let frame = 0;
  let watched: HTMLElement[] = [];
  let observer: ResizeObserver | null = null;

  function run(): void {
    frame = 0;
    const viewport = measureViewport(node);
    if (viewport) onChange(viewport);
  }
  function schedule(): void {
    if (!frame) frame = win.requestAnimationFrame(run);
  }
  function unwatch(): void {
    for (const el of watched) el.removeEventListener("scroll", schedule);
    observer?.disconnect();
  }
  function watch(): void {
    const next = clippers(node);
    if (next.length === watched.length && next.every((el, i) => el === watched[i])) return;
    unwatch();
    watched = next;
    for (const el of watched) {
      el.addEventListener("scroll", schedule, { passive: true });
      observer?.observe(el);
    }
  }

  // A resize may move which ancestors clip, so the set is read again with it.
  observer = win.ResizeObserver ? new win.ResizeObserver(() => { watch(); schedule(); }) : null;
  win.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("resize", schedule, { passive: true });
  watch();
  run();

  return {
    destroy() {
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      unwatch();
      win.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
    },
  };
}

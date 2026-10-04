/**
 * ignoreHostSwipe — the plugin owns interior swipes, Obsidian keeps the edges
 * (ios-g1 G2).
 *
 * Obsidian 1.13.7's mobile swipe recogniser (app.js `dg`) is a bubble-phase
 * `touchstart` listener on the workspace container. It returns early when an
 * ancestor of the touch target has `dataset.ignoreSwipe`; otherwise it only
 * yields to an `overflow: auto|scroll` ancestor that can still scroll in the
 * gesture direction. Calendar paging, board and gallery surfaces are often at
 * their scroll boundary (or page by gesture, not by scroll), so without the
 * flag a horizontal pan inside them opens a side drawer.
 *
 * Our listener sits on a descendant of the workspace container, so in the
 * bubble phase it runs before `dg` and the flag is already in place when `dg`
 * looks. A touch that starts within the edge zone is left unflagged on
 * purpose: that is how the drawers stay reachable from the screen edge.
 *
 * The flag lives only for the duration of one touch. It is cleared on
 * touchend/touchcancel on the node AND on window (the finger may end outside
 * the node, or the subtree may re-render under it), and on destroy.
 */

/** Edge zone width in rem. Root-anchored on purpose: the zone is measured
 *  from the WINDOW edge, not from any container. */
const EDGE_ZONE_REM = 1.25;

/** Root font size used when the document reports none (jsdom, detached docs). */
const FALLBACK_ROOT_FONT_SIZE = 16;

/**
 * Whether a touch at `clientX` starts inside the edge zone of a viewport
 * `viewportWidth` wide. The boundary itself counts as edge: the plugin claims
 * only touches strictly more than `edgePx` away from both window edges.
 */
export function startsInEdgeZone(
  clientX: number,
  viewportWidth: number,
  edgePx: number
): boolean {
  return clientX <= edgePx || clientX >= viewportWidth - edgePx;
}

/** The edge zone in CSS pixels, read from the current root font size. */
export function edgeZonePx(): number {
  // coercion-exempt: Class C - a computed CSS length ("16px") read back from the DOM, not record data
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const base = Number.isFinite(root) && root > 0 ? root : FALLBACK_ROOT_FONT_SIZE;
  return EDGE_ZONE_REM * base;
}

const PASSIVE: AddEventListenerOptions = { passive: true };

export function ignoreHostSwipe(node: HTMLElement): { destroy: () => void } {
  function clear(): void {
    delete node.dataset["ignoreSwipe"];
  }

  function handleTouchStart(e: TouchEvent): void {
    const touches = e.touches;
    const first = touches.length === 1 ? touches[0] : undefined;
    // Multi-touch (pinch) is not a drawer swipe and not ours to claim; an
    // edge touch must reach Obsidian unflagged.
    if (first && !startsInEdgeZone(first.clientX, window.innerWidth, edgeZonePx())) {
      node.dataset["ignoreSwipe"] = "true";
    } else {
      clear();
    }
  }

  node.addEventListener("touchstart", handleTouchStart, PASSIVE);
  node.addEventListener("touchend", clear, PASSIVE);
  node.addEventListener("touchcancel", clear, PASSIVE);
  window.addEventListener("touchend", clear, PASSIVE);
  window.addEventListener("touchcancel", clear, PASSIVE);

  return {
    destroy() {
      node.removeEventListener("touchstart", handleTouchStart, PASSIVE);
      node.removeEventListener("touchend", clear, PASSIVE);
      node.removeEventListener("touchcancel", clear, PASSIVE);
      window.removeEventListener("touchend", clear, PASSIVE);
      window.removeEventListener("touchcancel", clear, PASSIVE);
      clear();
    },
  };
}

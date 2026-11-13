import { visibleViewport } from "src/ui/utils/visibleViewport";

interface FollowField { anchor: HTMLElement | null; changed: () => void }
/** Follow layout-only movement; no global window, no RAF after close/destroy. */
export function followFieldAnchor(popup: HTMLElement, initial: FollowField | null) {
  let config = initial, view: Window | null = null, frame: number | null = null, last = "", alive = true;
  const stop = () => { if (frame !== null) view?.cancelAnimationFrame(frame); frame = null; };
  const run = () => {
    frame = null;
    if (!alive || !config?.anchor || !popup.isConnected || !view) return;
    const current = config, currentView = view;
    const anchor = config.anchor.getBoundingClientRect(), area = visibleViewport(view);
    const key = `${anchor.top}|${anchor.left}|${anchor.width}|${anchor.height}|${popup.scrollHeight}|${area.top}|${area.left}|${area.width}|${area.height}`;
    if (key !== last) { last = key; config.changed(); }
    if (alive && config === current && view === currentView && frame === null) frame = view.requestAnimationFrame(run);
  };
  const update = (next: FollowField | null) => {
    stop(); config = next; last = ""; view = next?.anchor?.ownerDocument.defaultView ?? null;
    if (alive && view && next?.anchor) frame = view.requestAnimationFrame(run);
  };
  update(initial);
  return { update, destroy(): void { alive = false; stop(); config = null; } };
}

// tileResize.ts — i3-dash: one corner-handle drag, from press to release.
//
// i3-dash: the listeners go on the canvas's OWN window, so a drag in an
// Obsidian popout ends where it is released (the same reason WidgetGrid's
// grip release does). The span shown while dragging is already snapped to
// whole cells, so what the pointer leaves is what gets saved — no jump on
// release. A cancelled pointer (the system took the gesture) saves nothing.

import { snapResize, type TileSpan, type TileSteps } from "./tileGrid";

export interface TileResizeOptions {
  readonly win: Window;
  readonly startX: number;
  readonly startY: number;
  readonly from: TileSpan;
  readonly steps: TileSteps;
  readonly columns: number;
  /** Every snapped span on the way, for the live preview. */
  readonly onPreview: (span: TileSpan) => void;
  /** The span at release, or null when the drag was cancelled. */
  readonly onEnd: (span: TileSpan | null) => void;
}

/** Starts the drag; the returned function cancels it (the canvas is going away). */
export function startTileResize(o: TileResizeOptions): () => void {
  let span = o.from;
  let over = false;
  const move = (ev: PointerEvent): void => {
    span = snapResize(o.from, ev.clientX - o.startX, ev.clientY - o.startY, o.steps, o.columns);
    o.onPreview(span);
  };
  const end = (commit: boolean): void => {
    if (over) return;
    over = true;
    o.win.removeEventListener("pointermove", move);
    o.win.removeEventListener("pointerup", up);
    o.win.removeEventListener("pointercancel", cancel);
    o.onEnd(commit ? span : null);
  };
  const up = (): void => end(true);
  const cancel = (): void => end(false);
  o.win.addEventListener("pointermove", move);
  o.win.addEventListener("pointerup", up);
  o.win.addEventListener("pointercancel", cancel);
  return cancel;
}

import { rootFontPx } from "src/ui/utils/cssLength";

/**
 * 3.7.2 B3 — touch on the table: a tap edits, a drag scrolls.
 *
 * A finger never lands still: a pan that starts on a cell and ends on it used
 * to count as a click on some engines, and on others the tap never reached the
 * cell at all. The rule is Notion's: a touch that moved less than half a rem
 * (8 CSS px at the default size) is a tap; anything more is the scroll.
 */

export const TAP_SLOP_REM = 0.5;

export interface TapTracker {
  down(e: { pointerType: string; clientX: number; clientY: number }): void;
  move(e: { clientX: number; clientY: number }): void;
  /** True when the gesture that just ended was a touch/pen tap. */
  up(e: { pointerType: string; clientX: number; clientY: number }): boolean;
  cancel(): void;
  /** A click the browser may send after a tap that was already handled, or after a drag. */
  swallowClick(): boolean;
}

export function createTapTracker(slopPx: number): TapTracker {
  let start: { x: number; y: number } | null = null;
  let moved = false;
  let handled = false;

  const far = (x: number, y: number) => start !== null && Math.hypot(x - start.x, y - start.y) > slopPx;

  return {
    down(e) {
      handled = false;
      moved = false;
      start = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
    },
    move(e) {
      if (start && far(e.clientX, e.clientY)) moved = true;
    },
    up(e) {
      if (!start) return false;
      if (far(e.clientX, e.clientY)) moved = true;
      start = null;
      handled = !moved;
      return handled;
    },
    cancel() {
      start = null;
      moved = true;
    },
    swallowClick() {
      const swallow = handled || moved;
      handled = false;
      moved = false;
      return swallow;
    },
  };
}

/**
 * How far to scroll so a cell's bottom clears the on-screen keyboard: the
 * visual viewport is what stays visible above it. 0 when nothing hides it.
 */
export function keyboardLift(
  cell: { top: number; bottom: number },
  visual: { offsetTop: number; height: number } | null | undefined,
  marginPx = 0,
): number {
  if (!visual) return 0;
  const visibleBottom = visual.offsetTop + visual.height - marginPx;
  const visibleTop = visual.offsetTop + marginPx;
  if (cell.bottom > visibleBottom) return Math.min(cell.bottom - visibleBottom, cell.top - visibleTop);
  return 0;
}

/** Which edges of a scroller have more content beyond them. */
export interface ScrollEdges {
  readonly left: boolean;
  readonly right: boolean;
  readonly top: boolean;
  readonly bottom: boolean;
}

export function scrollEdges(el: {
  scrollLeft: number; scrollTop: number; scrollWidth: number; scrollHeight: number; clientWidth: number; clientHeight: number;
}): ScrollEdges {
  const eps = 1;
  return {
    left: el.scrollLeft > eps,
    right: el.scrollLeft + el.clientWidth < el.scrollWidth - eps,
    top: el.scrollTop > eps,
    bottom: el.scrollTop + el.clientHeight < el.scrollHeight - eps,
  };
}

/**
 * Mark the scroller's parent (the frame) with `data-more-*` for each edge that
 * hides content; one measurement per animation frame, attributes written only
 * when they change, nothing through the component's reactivity.
 */
export function trackEdges(scroller: HTMLElement): { destroy(): void } {
  const win = scroller.ownerDocument.defaultView;
  const frame = scroller.parentElement;
  if (!win || !frame) return { destroy() {} };
  let raf = 0;
  let last = "";
  const run = () => {
    raf = 0;
    const e = scrollEdges(scroller);
    const key = `${+e.left}${+e.right}${+e.top}${+e.bottom}`;
    if (key === last) return;
    last = key;
    for (const side of ["left", "right", "top", "bottom"] as const) frame.toggleAttribute(`data-more-${side}`, e[side]);
  };
  const schedule = () => { if (!raf) raf = win.requestAnimationFrame(run); };
  scroller.addEventListener("scroll", schedule, { passive: true });
  const ro = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const observer = ro ? new ro(schedule) : null;
  observer?.observe(scroller);
  if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
  run();
  return {
    destroy() {
      if (raf) win.cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", schedule);
      observer?.disconnect();
    },
  };
}

/**
 * Svelte action: `activate` on a mouse click or a still touch tap; a drag
 * (and the click some engines send after it) does nothing. A tap on a native
 * checkbox is left to the checkbox.
 */
export function cellTouch(node: HTMLElement, activate: () => void): { update(next: () => void): void; destroy(): void } {
  // Measured on the first touch, not per mounted cell: a scroll mounts hundreds.
  let tracker: TapTracker | null = null;
  const tap = (): TapTracker => {
    if (!tracker) {

      const fontPx = rootFontPx(node.ownerDocument);
      tracker = createTapTracker(TAP_SLOP_REM * fontPx);
    }
    return tracker;
  };
  let act = activate;
  const handlers: Array<[string, (e: Event) => void]> = [
    ["pointerdown", (e) => tap().down(e as PointerEvent)],
    ["pointermove", (e) => tracker?.move(e as PointerEvent)],
    ["pointerup", (e) => { if (tracker?.up(e as PointerEvent) && !(e.target instanceof HTMLInputElement)) act(); }],
    ["pointercancel", () => tracker?.cancel()],
    ["click", () => { if (!tracker?.swallowClick()) act(); }],
  ];
  for (const [type, fn] of handlers) node.addEventListener(type, fn);
  return {
    update(next) { act = next; },
    destroy() { for (const [type, fn] of handlers) node.removeEventListener(type, fn); },
  };
}

/** Svelte action: while `on`, keep the node above the on-screen keyboard. */
export function liftOnKeyboard(node: HTMLElement, on: boolean): { update(next: boolean): void; destroy(): void } {
  const vv = node.ownerDocument.defaultView?.visualViewport ?? null;
  function lift(): void {
    if (!vv) return;
    const delta = keyboardLift(node.getBoundingClientRect(), vv, 8);
    if (delta <= 0) return;
    const scroller = node.closest<HTMLElement>(".ppp-t2-scroll");
    const room = scroller ? scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop : 0;
    if (scroller && room >= delta) scroller.scrollTop += delta;
    else node.scrollIntoView({ block: "center" });
  }
  function set(next: boolean): void {
    vv?.removeEventListener("resize", lift);
    if (!next || !vv) return;
    vv.addEventListener("resize", lift);
    void Promise.resolve().then(lift);
  }
  set(on);
  return { update: set, destroy: () => set(false) };
}

export { timedDismiss } from "./timedDismiss";

/**
 * reorderCollapse - while a widget grip is held, every tile shows only its header.
 *
 * A table tile can be thousands of pixels tall, so a tile carried by its grip
 * cannot pass a tall neighbour: the drop target is never under the finger. The
 * fix is not to drag faster but to make the list short. A press on a grip puts
 * the canvas into a reorder state, a class that hides everything in a tile but
 * its header. Nothing is unmounted, so nothing is rebuilt on the way out.
 *
 * The press must land before the drag library measures, which it does on the
 * first move, so the caller wires `begin` to the capture phase of the press.
 * The class is written straight onto the canvas as well as reported through
 * `onChange`, because Svelte applies its own class binding a microtask later and
 * the scroll compensation below has to measure the collapsed layout now.
 */
import { tick } from "svelte";
import { toRem } from "src/ui/utils/cssLength";

/** The class the canvas carries while tiles are collapsed to headers. */
export const REORDER_CLASS = "ppp-database-canvas--reordering";

/**
 * The canvas keeps its pre-collapse height while reordering: collapsing every
 * tile shortens the page, the browser clamps the scroll position at once, and
 * the pressed tile then moves out from under the finger before the scroll can
 * be compensated.
 */
export const HOLD_VAR = "--ppp-reorder-hold";

const TILE_SELECTOR = ".ppp-widget-host";

export interface ReorderCollapse {
  /** A grip was pressed: collapse every tile, keeping the pressed one under the finger. */
  begin(target: Element): void;
  /** The press is over. `moved` is true when a drag finalized, so its tile is brought into view. */
  end(moved: boolean): void;
  /** Drop the state without touching scroll (the canvas is going away). */
  dispose(): void;
}

/** The nearest ancestor that really scrolls, else the document's scrolling element. */
function scrollParent(tile: HTMLElement): HTMLElement {
  const doc = tile.ownerDocument;
  const view = doc.defaultView;
  for (let el = tile.parentElement; el && view; el = el.parentElement) {
    const overflow = view.getComputedStyle(el).getPropertyValue("overflow-y");
    const scrollable = overflow === "auto" || overflow === "scroll" || overflow === "overlay";
    if (scrollable && el.scrollHeight > el.clientHeight) return el;
  }
  return (doc.scrollingElement as HTMLElement | null) ?? doc.documentElement;
}

export function createReorderCollapse(
  canvas: HTMLElement,
  onChange: (reordering: boolean) => void,
): ReorderCollapse {
  let active = false;
  let tile: HTMLElement | null = null;
  // Found before the collapse: afterwards the page may be too short to scroll at all.
  let scroller: HTMLElement | null = null;

  function set(on: boolean): void {
    if (on) canvas.style.setProperty(HOLD_VAR, toRem(canvas.getBoundingClientRect().height, canvas.ownerDocument));
    else canvas.style.removeProperty(HOLD_VAR);
    active = on;
    canvas.classList.toggle(REORDER_CLASS, on);
    onChange(on);
  }

  /** Move the scroller by however far the tile's header moved while `change` ran. */
  function holdHeader(change: () => void): void {
    const before = tile?.getBoundingClientRect().top ?? 0;
    change();
    if (!tile || !scroller) return;
    const delta = tile.getBoundingClientRect().top - before;
    if (delta !== 0) scroller.scrollTop += delta;
  }

  return {
    begin(target) {
      if (active) return;
      tile = target.closest<HTMLElement>(TILE_SELECTOR);
      scroller = tile ? scrollParent(tile) : null;
      holdHeader(() => set(true));
    },
    end(moved) {
      if (!active) return;
      const held = tile;
      if (moved) {
        set(false);
        // The finalized order reaches the DOM on the next flush; look after it.
        void tick().then(() => {
          if (held?.isConnected) held.scrollIntoView?.({ block: "nearest" });
        });
      } else {
        // A tap: no tile moved, so put the page back the way the press found it.
        holdHeader(() => set(false));
      }
      tile = null;
      scroller = null;
    },
    dispose() {
      if (active) set(false);
      tile = null;
      scroller = null;
    },
  };
}

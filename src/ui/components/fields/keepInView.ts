/**
 * keepInView (3.7.2 B1b) — the one answer to "the keyboard covers the field".
 *
 * Every field of the kit carries it. While the field has focus it listens to
 * its own window's visualViewport (the on-screen keyboard shrinks it, a pinch
 * pans it) and, whenever the field's box leaves the visible part, scrolls the
 * nearest scroll container just enough to bring it back. Nothing is listened
 * to while the field is not focused, and everything is removed on blur (a
 * microtask later, w4-p06) and on destroy, so a list of a hundred fields costs
 * nothing until one is used.
 *
 * w4-p06 adds the rest of the input standard: when the keyboard goes, the view
 * scrolled for it is put back, and Obsidian's keyboard button stands over the
 * keyboard (keyboardDismiss).
 *
 * w4-input: the visible part is the visual viewport cut at the keyboard
 * Obsidian reports (`--keyboard-height`, visibleViewport.ts) — on iOS the
 * visual viewport alone never shrinks — and the field is checked again when
 * that keyboard comes or goes (onKeyboardChange).
 */
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { keyboardHeight, onKeyboardChange, visibleViewport } from "src/ui/utils/visibleViewport";
import { offerKeyboardDismiss } from "./keyboardDismiss";

export type ViewportBounds = ReturnType<typeof visibleViewport>;
export interface KeepInViewOptions {
  readonly boundsOf?: (view: Window) => ViewportBounds;
  readonly confirm?: () => void;
}

export function keepInView(node: HTMLElement, options: KeepInViewOptions | ((view: Window) => ViewportBounds) = {}) {
  const boundsOf = typeof options === "function" ? options : options.boundsOf ?? visibleViewport;
  const view = node.ownerDocument.defaultView ?? window;
  let listening = false, alive = true;
  let frame: number | null = null;
  let dismiss: (() => void) | null = null;
  let unwatchKeyboard: (() => void) | null = null;
  // w4-p06: the scroll positions before the keyboard came up, and the visible
  // height then. When the keyboard goes (the height is back) after the field
  // was scrolled into view, the view is put back where the user left it.
  let before: Array<{ el: Element; top: number; left: number; assistedTop: number; assistedLeft: number }> = [];
  let restingHeight = 0;
  let moved = false, shrunk = false, userMoved = false;

  function check(): void {
    frame = null;
    if (!listening || !alive) return;
    const bounds = boundsOf(view);
    if (bounds.height < restingHeight - 1) shrunk = true;
    // Native panning and deliberate user scrolling both take precedence over
    // restoring our old position. Never pull a manually explored form back.
    if (before.some(({ el, assistedTop, assistedLeft }) => Math.abs(el.scrollTop - assistedTop) > 1 || Math.abs(el.scrollLeft - assistedLeft) > 1)) userMoved = true;
    if (userMoved) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom || rect.left < bounds.left || rect.right > bounds.right) {
      moved = true;
      node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "auto" });
      for (const item of before) { item.assistedTop = item.el.scrollTop; item.assistedLeft = item.el.scrollLeft; }
    } else if (moved && shrunk && bounds.height >= restingHeight - 1) {
      moved = false;
      for (const { el, top, left } of before) { el.scrollTop = top; el.scrollLeft = left; }
    }
  }
  // i3-input: one check per frame, and only when the visible area changes
  // size (the keyboard opens or closes). Reacting to visualViewport scroll as
  // well fought WebKit's own pan to the caret and a sheet that fits itself to
  // the keyboard: each scrollIntoView fired another scroll, and the field
  // drifted away while typing.
  function schedule(): void {
    if (!listening || !alive || frame !== null) return;
    if (view.requestAnimationFrame) frame = view.requestAnimationFrame(check);
    else check();
  }
  function start(): void {
    if (listening || !alive) return;
    listening = true;
    before = [];
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) before.push({ el, top: el.scrollTop, left: el.scrollLeft, assistedTop: el.scrollTop, assistedLeft: el.scrollLeft });
    }
    const height = boundsOf(view).height;
    restingHeight = keyboardHeight(view) > 0 ? Math.max(height, view.innerHeight) : height;
    moved = false; shrunk = false; userMoved = false;
    // A tag test, not instanceof: the field may live in a popout window.
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      const confirm = typeof options === "function" ? undefined : options.confirm;
      dismiss = offerKeyboardDismiss(node as HTMLInputElement, {
        label: () => get(i18n).t("common.hide-keyboard"),
        confirm: confirm ? { label: () => get(i18n).t("common.apply"), run: confirm } : undefined,
      });
    }
    view.visualViewport?.addEventListener("resize", schedule);
    view.addEventListener("resize", schedule);
    unwatchKeyboard = onKeyboardChange(view, schedule);
    check();
  }
  function stop(): void {
    if (!listening) return;
    listening = false;
    dismiss?.();
    dismiss = null;
    if (frame !== null) view.cancelAnimationFrame?.(frame);
    frame = null;
    view.visualViewport?.removeEventListener("resize", schedule);
    view.removeEventListener("resize", schedule);
    unwatchKeyboard?.();
    unwatchKeyboard = null;
  }

  // A blur followed at once by a focus of the same field (a re-render, a
  // popup giving the focus back) is not the end of the field's turn: the stop
  // waits a microtask to see.
  function blurred(): void {
    void Promise.resolve().then(() => {
      if (node.ownerDocument.activeElement !== node) stop();
    });
  }

  node.addEventListener("focus", start);
  node.addEventListener("blur", blurred);
  if (node.ownerDocument.activeElement === node) start();
  return {
    destroy(): void {
      alive = false;
      stop();
      node.removeEventListener("focus", start);
      node.removeEventListener("blur", blurred);
    },
  };
}

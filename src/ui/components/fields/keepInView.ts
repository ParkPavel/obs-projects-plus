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
import { onKeyboardChange, visibleViewport } from "src/ui/utils/visibleViewport";
import { offerKeyboardDismiss } from "./keyboardDismiss";

export type ViewportBounds = ReturnType<typeof visibleViewport>;

export function keepInView(node: HTMLElement, boundsOf: (view: Window) => ViewportBounds = visibleViewport) {
  const view = node.ownerDocument.defaultView ?? window;
  let listening = false;
  let frame = 0;
  let dismiss: (() => void) | null = null;
  let unwatchKeyboard: (() => void) | null = null;
  // w4-p06: the scroll positions before the keyboard came up, and the visible
  // height then. When the keyboard goes (the height is back) after the field
  // was scrolled into view, the view is put back where the user left it.
  let before: Array<{ el: Element; top: number }> = [];
  let restingHeight = 0;
  let moved = false;

  function check(): void {
    frame = 0;
    const bounds = boundsOf(view);
    const rect = node.getBoundingClientRect();
    if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
      moved = true;
      node.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "auto" });
    } else if (moved && bounds.height >= restingHeight - 1) {
      moved = false;
      for (const { el, top } of before) el.scrollTop = top;
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
    before = [];
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight) before.push({ el, top: el.scrollTop });
    }
    restingHeight = boundsOf(view).height;
    moved = false;
    // A tag test, not instanceof: the field may live in a popout window.
    if (node.tagName === "INPUT" || node.tagName === "TEXTAREA") {
      dismiss = offerKeyboardDismiss(node as HTMLInputElement, { label: () => get(i18n).t("common.hide-keyboard") });
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
    if (frame !== 0) view.cancelAnimationFrame?.(frame);
    frame = 0;
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
      stop();
      node.removeEventListener("focus", start);
      node.removeEventListener("blur", blurred);
    },
  };
}

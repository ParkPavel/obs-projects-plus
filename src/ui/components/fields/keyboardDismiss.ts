// w4-p06 — the input standard (CONSOLIDATION §7, rows 11–12): whenever the
// on-screen keyboard is up there is a button that puts it away and leaves the
// focus on the field, until a tap elsewhere or an attempt to scroll.
//
// A web view hides its keyboard only when the field loses focus — unless the
// field asks for no keyboard: `inputmode="none"`. The button sets that and
// focuses the field again, so the keyboard goes and the field, its typed text
// and its suggestion list stay. A tap on the field gives the keyboard back; a
// tap elsewhere or a scroll gesture ends the focus as usual.
//
// Only on a touch screen (`pointer: coarse`); a computer has no such keyboard.

import { visibleViewport } from "src/ui/utils/visibleViewport";
import { remAt, rootFontPx } from "src/ui/utils/cssLength";

export interface KeyboardDismissOptions {
  /** The button's accessible name, read when the button is made. */
  readonly label: () => string;
}

const BUTTON_CLASS = "ppp-keyboard-dismiss";

function isCoarse(view: Window): boolean {
  return view.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * Shows the button for `field` while it has focus; returns the cleanup. Does
 * nothing (and returns a no-op) on a fine pointer.
 */
export function offerKeyboardDismiss(field: HTMLInputElement | HTMLTextAreaElement, options: KeyboardDismissOptions): () => void {
  const doc = field.ownerDocument;
  const view = doc.defaultView ?? window;
  if (!isCoarse(view)) return () => {};
  const asked = field.getAttribute("inputmode");
  const label = options.label();
  const button = doc.body.createEl("button", {
    cls: BUTTON_CLASS,
    text: "⌄",
    attr: { type: "button", "aria-label": label, title: label },
  });
  let resting = false;

  function place(): void {
    const bounds = visibleViewport(view);
    const base = rootFontPx(doc);
    button.style.top = remAt(bounds.bottom - 3 * base, base);
    button.style.left = remAt(bounds.right - 3 * base, base);
    button.hidden = resting;
  }

  function restoreMode(): void {
    if (asked === null) field.removeAttribute("inputmode");
    else field.setAttribute("inputmode", asked);
  }

  function rest(e: Event): void {
    // The press must not take the focus from the field.
    e.preventDefault();
    resting = true;
    field.setAttribute("inputmode", "none");
    field.blur();
    field.focus({ preventScroll: true });
    place();
  }

  function wake(): void {
    if (!resting) return;
    resting = false;
    restoreMode();
    field.blur();
    field.focus({ preventScroll: true });
    place();
  }

  function leave(e: Event): void {
    if (!resting || (e.target instanceof Node && (field.contains(e.target) || button.contains(e.target)))) return;
    field.blur();
  }

  button.addEventListener("pointerdown", rest);
  button.addEventListener("mousedown", (e) => e.preventDefault());
  field.addEventListener("pointerdown", wake);
  doc.addEventListener("pointerdown", leave, true);
  doc.addEventListener("touchmove", leave, true);
  view.visualViewport?.addEventListener("resize", place);
  view.visualViewport?.addEventListener("scroll", place);
  place();

  return () => {
    restoreMode();
    button.removeEventListener("pointerdown", rest);
    field.removeEventListener("pointerdown", wake);
    doc.removeEventListener("pointerdown", leave, true);
    doc.removeEventListener("touchmove", leave, true);
    view.visualViewport?.removeEventListener("resize", place);
    view.visualViewport?.removeEventListener("scroll", place);
    button.remove();
  };
}

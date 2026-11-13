// w4-input — the "hide keyboard" control is Obsidian's own.
//
// In a note Obsidian shows its mobile toolbar over the keyboard with a round
// `keyboard-toggle` button at the right; the command behind it
// (editor:toggle-keyboard) takes the focus from the editor and the keyboard
// goes with it. That toolbar exists only for the note editor, so a plugin
// field gets the same element — `.mobile-toolbar-floating-options.mod-raised`
// holding a `.mobile-toolbar-option` with the `keyboard-toggle` icon, styled by
// Obsidian and the theme — at the same place: the right end of the strip just
// above the keyboard (`--keyboard-height`, `--mobile-toolbar-height`). Its
// press does what Obsidian's does: the field loses focus.
//
// It is there only while the app reports an on-screen keyboard; a computer or
// a hardware keyboard reports none, and outside the mobile app (no `is-mobile`
// on the body) nothing is made. Nothing else of the field is touched: the
// w4-p06 button kept the focus with `inputmode="none"`, re-focused the field
// on each tap and blurred it on any scroll gesture, and typing broke on that.

import { setIcon } from "obsidian";
import { KEYBOARD_BAR_CLASS, KEYBOARD_BAR_EVENT, keyboardHeight, onKeyboardChange } from "src/ui/utils/visibleViewport";

export interface KeyboardDismissOptions {
  /** The button's accessible name, read when the button is made. */
  readonly label: () => string;
  /** Explicit confirmation belongs to the field's typed draft controller. */
  readonly confirm?: { readonly label: () => string; readonly run: () => void } | undefined;
}

/** Shows the keyboard button for `field` while it has focus; returns the cleanup. */
export function offerKeyboardDismiss(field: HTMLInputElement | HTMLTextAreaElement, options: KeyboardDismissOptions): () => void {
  const doc = field.ownerDocument;
  const view = doc.defaultView ?? window;
  // Obsidian marks its mobile app on the body; a computer gets nothing.
  if (!doc.body.classList.contains("is-mobile")) return () => {};
  const label = options.label();
  const bar = doc.body.createDiv({ cls: KEYBOARD_BAR_CLASS });
  // Each control sits on a pill of its own: one shared backing used to stretch past the
  // screen edge and put one button over a different background than the other.
  const pill = bar.createDiv({ cls: "mobile-toolbar-floating-options mod-raised ppp-keyboard-pill" });
  const option = pill.createDiv({
    cls: "mobile-toolbar-option ppp-keyboard-hide",
    attr: { role: "button", "aria-label": label, title: label },
  });
  setIcon(option, "keyboard-toggle");

  // The strip counts as covered screen (visibleViewport): whoever lays out
  // over the keyboard hears when it comes or goes.
  const sync = () => {
    const hidden = keyboardHeight(view) <= 0;
    if (bar.hidden === hidden) return;
    bar.hidden = hidden;
    view.dispatchEvent(new view.Event(KEYBOARD_BAR_EVENT));
  };
  // As in Obsidian's toolbar: the press must not move the focus by itself.
  const hold = (e: Event) => e.preventDefault();
  const hide = (e: Event) => {
    e.preventDefault();
    field.blur();
  };
  const cleanups: Array<() => void> = [];
  function bindButton(button: HTMLElement, action: (event: Event) => void): void {
    button.tabIndex = 0;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      action(event);
    };
    button.addEventListener("pointerdown", hold);
    button.addEventListener("mousedown", hold);
    button.addEventListener("click", action);
    button.addEventListener("keydown", key);
    cleanups.push(() => {
      button.removeEventListener("pointerdown", hold);
      button.removeEventListener("mousedown", hold);
      button.removeEventListener("click", action);
      button.removeEventListener("keydown", key);
    });
  }
  if (options.confirm) {
    const label = options.confirm.label();
    const confirmPill = bar.createDiv({ cls: "mobile-toolbar-floating-options mod-raised ppp-keyboard-pill" });
    const confirm = confirmPill.createDiv({
      cls: "mobile-toolbar-option ppp-keyboard-confirm",
      attr: { role: "button", "aria-label": label, title: label },
    });
    // Before keyboard-toggle, matching the existing right-hand control.
    bar.insertBefore(confirmPill, pill);
    setIcon(confirm, "check");
    bindButton(confirm, (event) => { event.preventDefault(); options.confirm?.run(); });
  }
  bindButton(option, hide);
  bar.hidden = true;
  const stopWatching = onKeyboardChange(view, sync);
  sync();

  return () => {
    stopWatching();
    for (const cleanup of cleanups) cleanup();
    const shown = !bar.hidden;
    bar.remove();
    if (shown) view.dispatchEvent(new view.Event(KEYBOARD_BAR_EVENT));
  };
}

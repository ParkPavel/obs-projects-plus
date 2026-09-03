/**
 * Focus containment for a surface that calls itself modal (#169).
 *
 * ## What was wrong
 *
 * `SlideInPanel` and `SettingsMenuPopover` both declare `role="dialog"` and
 * `aria-modal="true"`, and both did nothing about focus. A screen reader is
 * told the rest of the page is inert while Tab walks straight out of the panel
 * and back into the view behind it — so the two halves of the same promise
 * disagree, and only the half a keyboard user relies on is broken.
 *
 * ## Why one action and not two components
 *
 * The same defect in two files is the shape this project keeps paying for: a
 * fix lands on one side and not the other. `use:focusTrap` is the containment
 * itself, so a third modal surface gets it by asking rather than by
 * remembering.
 *
 * ## What it does, in order
 *
 *   1. Remembers what had focus, so it can be given back.
 *   2. Moves focus inside — to the first focusable child, or to the container,
 *      which is given `tabindex="-1"` when it has no focusable content. A
 *      dialog nobody can focus is the same defect one level down.
 *   3. Keeps Tab and Shift+Tab inside, wrapping at both ends.
 *   4. On teardown, returns focus to what had it — unless the caller moved
 *      focus somewhere deliberate in the meantime, which is checked rather than
 *      assumed.
 *
 * It deliberately does NOT close on Escape: the components already do that, and
 * two handlers for one key is how a keystroke starts being swallowed twice.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

/** Focusable descendants, in document order, skipping anything hidden. */
export function focusableWithin(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute("inert")) return false;
    if (el.closest("[inert]")) return false;
    // `offsetParent` is null for `display: none` and for a `position: fixed`
    // element, so it cannot be the test on its own — these panels are fixed.
    const style = el.ownerDocument.defaultView?.getComputedStyle(el);
    if (!style) return true;
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

export interface FocusTrapOptions {
  /** Inactive traps do nothing, so a closed panel costs nothing. */
  readonly active?: boolean;
}

interface TrapState {
  active: boolean;
  returnTo: Element | null;
}

/**
 * Svelte action. `use:focusTrap={{ active: open }}`.
 */
export function focusTrap(node: HTMLElement, options: FocusTrapOptions = {}) {
  const state: TrapState = { active: false, returnTo: null };

  function onKeydown(e: KeyboardEvent) {
    if (!state.active || e.key !== "Tab") return;
    const items = focusableWithin(node);
    if (items.length === 0) {
      // Nothing to move to: keep focus on the container rather than letting Tab
      // escape to the page the dialog claims is inert.
      e.preventDefault();
      node.focus();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const current = node.ownerDocument.activeElement;
    if (e.shiftKey && (current === first || current === node)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function activate() {
    if (state.active) return;
    state.active = true;
    state.returnTo = node.ownerDocument.activeElement;
    const items = focusableWithin(node);
    if (items.length > 0) {
      items[0]!.focus();
    } else {
      if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
      node.focus();
    }
    node.ownerDocument.addEventListener("keydown", onKeydown, true);
  }

  function deactivate() {
    if (!state.active) return;
    state.active = false;
    node.ownerDocument.removeEventListener("keydown", onKeydown, true);
    const back = state.returnTo;
    state.returnTo = null;
    // Only take focus back if it is still inside the surface being closed.
    // Otherwise the caller has moved it somewhere on purpose and stealing it
    // would be the same rudeness in the opposite direction.
    const active = node.ownerDocument.activeElement;
    const stillInside = active === node || (active instanceof Node && node.contains(active));
    if (stillInside && back instanceof HTMLElement && back.isConnected) {
      back.focus();
    }
  }

  if (options.active !== false) activate();

  return {
    update(next: FocusTrapOptions) {
      if (next.active === false) deactivate();
      else activate();
    },
    destroy() {
      deactivate();
    },
  };
}

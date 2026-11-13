/**
 * The unobscured, possibly panned part of a window (keyboard/zoom included).
 *
 * The app reports keyboard height separately. Window/visual viewport sizes
 * can already be smaller after focus: subtracting from innerHeight again
 * collapses sheets. Intersect with the actual toolbar top, or the keyboard
 * edge in layout-viewport coordinates when no toolbar is measurable.
 */
export function visibleViewport(view: Window) {
  const viewport = view.visualViewport;
  const usable = viewport && viewport.width > 0 && viewport.height > 0;
  const left = usable ? viewport.offsetLeft : 0;
  const top = usable ? viewport.offsetTop : 0;
  const width = usable ? viewport.width : view.innerWidth;
  const keyboard = keyboardHeight(view);
  const viewHeight = usable ? viewport.height : view.innerHeight;
  const layoutHeight = Math.max(view.innerHeight, view.document?.documentElement?.clientHeight || 0);
  const keyboardTop = keyboard > 0 ? keyboardBarTop(view) ?? layoutHeight - keyboard : Infinity;
  const height = Math.max(0, Math.min(top + viewHeight, keyboardTop) - top);
  return { left, top, width, height, right: left + width, bottom: top + height };
}

/** The on-screen keyboard's height Obsidian reports, in px; 0 when none or unknown. */
export function keyboardHeight(view: Window): number {
  const root = view.document?.documentElement;
  if (!root) return 0;
  // coercion-exempt: Class C - a CSS length Obsidian writes to the root, not record data
  const px = parseFloat(view.getComputedStyle(root).getPropertyValue("--keyboard-height"));
  return Number.isFinite(px) && px > 0 ? px : 0;
}

/** The shown strip's actual top already accounts for the keyboard and its own height. */
function keyboardBarTop(view: Window): number | undefined {
  const bar = view.document?.querySelector<HTMLElement>(`.${KEYBOARD_BAR_CLASS}:not([hidden])`);
  const rect = bar?.getBoundingClientRect();
  return rect && rect.height > 0 && Number.isFinite(rect.top) ? rect.top : undefined;
}

/** The strip keyboardDismiss.ts shows over the keyboard. */
export const KEYBOARD_BAR_CLASS = "ppp-keyboard-bar";
/** Sent on the window when that strip shows or hides. */
export const KEYBOARD_BAR_EVENT = "ppp-keyboard-bar";

/** The window events Obsidian's mobile app sends around its keyboard (and ours). */
const KEYBOARD_EVENTS = ["keyboardWillShow", "keyboardDidShow", "keyboardWillHide", "keyboardDidHide", KEYBOARD_BAR_EVENT] as const;

/**
 * Calls `changed` whenever the keyboard comes, goes or finishes animating:
 * on the app's keyboard events and on a change of `--keyboard-height` or of
 * the `keyboard-animating` body class (a style or class write the events may
 * precede). Returns the cleanup. Visual-viewport and window resizes are the
 * caller's own business — some callers must not react to every pan.
 */
export function onKeyboardChange(view: Window, changed: () => void): () => void {
  const doc = view.document;
  let last = keyboardHeight(view);
  let animating = doc.body?.classList.contains("keyboard-animating") ?? false;
  const fire = () => changed();
  const check = () => {
    const height = keyboardHeight(view);
    const nowAnimating = doc.body?.classList.contains("keyboard-animating") ?? false;
    if (height === last && nowAnimating === animating) return;
    last = height;
    animating = nowAnimating;
    changed();
  };
  for (const name of KEYBOARD_EVENTS) view.addEventListener(name, fire);
  const Observer = (view as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
  const observer = Observer ? new Observer(check) : null;
  const options = { attributes: true, attributeFilter: ["style", "class"] };
  if (observer) {
    observer.observe(doc.documentElement, options);
    if (doc.body) observer.observe(doc.body, options);
  }
  return () => {
    for (const name of KEYBOARD_EVENTS) view.removeEventListener(name, fire);
    observer?.disconnect();
  };
}

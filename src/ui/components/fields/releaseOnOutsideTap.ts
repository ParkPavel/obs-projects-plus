/**
 * i2-input (D03): on iOS a tap on an empty part of the page does not take the
 * focus away from a text field, so nothing blurs and the typed value — «завтра»
 * — is never committed. While the field has focus, a tap anywhere outside it
 * blurs it, and the field's own blur commit runs as on every other platform.
 *
 * w4-input: a TAP — a press released where it began. A finger scrolling the
 * form or a list (the press moves, or the browser cancels it for the scroll)
 * leaves the field and its keyboard alone; blurring on the first touch of a
 * scroll made typing near a list impossible. Presses in the field's own
 * layers — a suggestion list, a picker sheet, Obsidian's keyboard button —
 * belong to the input, not to "elsewhere". So do the field's own buttons
 * (✓ / ✕ beside a name typed in place), marked `data-ppp-field-tools`: a tap
 * on ✕ must reach ✕, not commit the name on its way.
 */

/** Layers that belong to whichever field is being typed into. */
const OWN_LAYERS = ".ppp-popup, .ppp-combo-popup, .ppp-keyboard-bar, [data-settings-dropdown], [data-ppp-field-tools]";
/** How far a press may travel and still be a tap, in CSS px (a finger's wobble). */
const TAP_SLOP_PX = 10;

export function releaseOnOutsideTap(node: HTMLElement): { destroy(): void } {
  const doc = node.ownerDocument;
  let press: { id: number; x: number; y: number } | null = null;

  const onDown = (e: PointerEvent): void => {
    press = null;
    if (doc.activeElement !== node) return;
    const target = e.target;
    if (target instanceof Node && node.contains(target)) return;
    if ((target as Element | null)?.closest?.(OWN_LAYERS)) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent): void => {
    const started = press;
    press = null;
    if (!started || e.pointerId !== started.id || doc.activeElement !== node) return;
    if (Math.hypot(e.clientX - started.x, e.clientY - started.y) > TAP_SLOP_PX) return;
    node.blur();
  };
  const onCancel = (): void => {
    press = null;
  };
  const arm = (): void => {
    doc.addEventListener("pointerdown", onDown, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onCancel, true);
  };
  const disarm = (): void => {
    press = null;
    doc.removeEventListener("pointerdown", onDown, true);
    doc.removeEventListener("pointerup", onUp, true);
    doc.removeEventListener("pointercancel", onCancel, true);
  };
  node.addEventListener("focus", arm);
  node.addEventListener("blur", disarm);
  return {
    destroy() {
      disarm();
      node.removeEventListener("focus", arm);
      node.removeEventListener("blur", disarm);
    },
  };
}

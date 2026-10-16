/**
 * i2-input (D03): on iOS a tap on an empty part of the page does not take the
 * focus away from a text field, so nothing blurs and the typed value — «завтра»
 * — is never committed. While the field has focus, a press anywhere outside it
 * blurs it, and the field's own blur commit runs as on every other platform.
 */
export function releaseOnOutsideTap(node: HTMLElement): { destroy(): void } {
  const doc = node.ownerDocument;
  const onPress = (e: PointerEvent): void => {
    if (doc.activeElement !== node) return;
    if (e.target instanceof Node && node.contains(e.target)) return;
    node.blur();
  };
  const arm = (): void => doc.addEventListener("pointerdown", onPress, true);
  const disarm = (): void => doc.removeEventListener("pointerdown", onPress, true);
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

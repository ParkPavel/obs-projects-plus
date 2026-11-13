/**
 * D16: a touch does not blur, so a cell's lock reason stayed over the next
 * cells. While open it closes by itself after `ms` and on any press elsewhere.
 */
export function timedDismiss(
  close: () => void,
  ms = 2500,
  ownerDocument: () => Document | null = () => document
): (open: boolean) => void {
  let timer: number | null = null;
  let boundDocument: Document | null = null;
  let boundView: Window | null = null;
  const onPress = (): void => close();
  return (open) => {
    if (timer !== null) boundView?.clearTimeout(timer);
    boundDocument?.removeEventListener("pointerdown", onPress, true);
    timer = null;
    boundDocument = null;
    boundView = null;
    if (!open) return;
    boundDocument = ownerDocument() ?? document;
    boundView = boundDocument.defaultView ?? window;
    timer = boundView.setTimeout(close, ms);
    boundDocument.addEventListener("pointerdown", onPress, true);
  };
}

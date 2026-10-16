/**
 * D16: a touch does not blur, so a cell's lock reason stayed over the next
 * cells. While open it closes by itself after `ms` and on any press elsewhere.
 */
export function timedDismiss(close: () => void, ms = 2500): (open: boolean) => void {
  let timer: number | null = null;
  const onPress = (): void => close();
  return (open) => {
    if (timer !== null) window.clearTimeout(timer);
    document.removeEventListener("pointerdown", onPress, true);
    if (!open) return;
    timer = window.setTimeout(close, ms);
    window.setTimeout(() => document.addEventListener("pointerdown", onPress, true), 0);
  };
}

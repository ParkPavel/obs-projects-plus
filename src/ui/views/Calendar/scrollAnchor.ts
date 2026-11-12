/** Keep a retained unit at the same viewport position after a bounded prepend. */
export function captureScrollAnchor(parent: HTMLElement | null, anchor: HTMLElement | null | undefined): () => void {
  if (!parent || !anchor) return () => {};
  const top = anchor.getBoundingClientRect().top;
  return () => {
    if (!parent.isConnected || !parent.contains(anchor)) return;
    parent.scrollTop += anchor.getBoundingClientRect().top - top;
  };
}

/** Shared drag termination in the document/window where the gesture began. */
export function bindDragSessionEnd(
  doc: Document,
  release: (event: MouseEvent | TouchEvent) => void,
  cancel: () => void,
): () => void {
  const view = doc.defaultView;
  const hidden = () => { if (doc.visibilityState === "hidden") cancel(); };
  // Touch input is cancelled by `touchcancel`. Its pointer events are not a second opinion:
  // on iOS `pointercancel` and `lostpointercapture` precede the `touchend` of a perfectly
  // normal release, and cancelling there threw the drag away before it could be committed.
  const pointerCancel = (event: Event) => { if ((event as PointerEvent).pointerType !== "touch") cancel(); };
  // A sidebar/popup may stop bubbling. A real release must still end the drag;
  // browser cancellation must never pass through the release/commit handler.
  doc.addEventListener("mouseup", release, true);
  doc.addEventListener("touchend", release, true);
  doc.addEventListener("touchcancel", cancel, true);
  doc.addEventListener("pointercancel", pointerCancel, true);
  doc.addEventListener("visibilitychange", hidden);
  view?.addEventListener("blur", cancel);
  view?.addEventListener("pagehide", cancel);
  view?.addEventListener("orientationchange", cancel);
  return () => {
    doc.removeEventListener("mouseup", release, true);
    doc.removeEventListener("touchend", release, true);
    doc.removeEventListener("touchcancel", cancel, true);
    doc.removeEventListener("pointercancel", pointerCancel, true);
    doc.removeEventListener("visibilitychange", hidden);
    view?.removeEventListener("blur", cancel);
    view?.removeEventListener("pagehide", cancel);
    view?.removeEventListener("orientationchange", cancel);
  };
}

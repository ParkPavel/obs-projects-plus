/** Terminal events belong to the document/window where the drag began. */
export function bindDragSessionEnd(
  doc: Document,
  release: (event: MouseEvent | TouchEvent) => void,
  cancel: () => void,
): () => void {
  const view = doc.defaultView;
  const hidden = () => { if (doc.visibilityState === "hidden") cancel(); };
  // A sidebar/popup may stop bubbling. A real release must still end the drag;
  // browser cancellation must never pass through the release/commit handler.
  doc.addEventListener("mouseup", release, true);
  doc.addEventListener("touchend", release, true);
  doc.addEventListener("touchcancel", cancel, true);
  doc.addEventListener("pointercancel", cancel, true);
  doc.addEventListener("lostpointercapture", cancel, true);
  doc.addEventListener("visibilitychange", hidden);
  view?.addEventListener("blur", cancel);
  view?.addEventListener("pagehide", cancel);
  view?.addEventListener("orientationchange", cancel);
  return () => {
    doc.removeEventListener("mouseup", release, true);
    doc.removeEventListener("touchend", release, true);
    doc.removeEventListener("touchcancel", cancel, true);
    doc.removeEventListener("pointercancel", cancel, true);
    doc.removeEventListener("lostpointercapture", cancel, true);
    doc.removeEventListener("visibilitychange", hidden);
    view?.removeEventListener("blur", cancel);
    view?.removeEventListener("pagehide", cancel);
    view?.removeEventListener("orientationchange", cancel);
  };
}

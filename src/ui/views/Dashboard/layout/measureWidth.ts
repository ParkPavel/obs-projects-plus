// measureWidth.ts — i3-dash: the canvas reports its own width and font size.
//
// i3-dash: the tile/stack decision follows the CONTAINER, not the device: a
// dashboard in a narrow split pane on a desktop is a stack, one on a wide
// tablet is tiles. A CSS container query alone cannot choose it, because the
// number of columns also drives the packing (tileGrid.ts) and the pointer math
// of a resize, which run in script. The font size is read from the canvas
// itself, because every tile length (row, gap) is in em of that font.

export type WidthListener = (widthPx: number, fontPx: number) => void;

/** Used when the document reports no font size (jsdom, a detached node). */
const FALLBACK_FONT = 16;

export function measureWidth(node: HTMLElement, listener: WidthListener) {
  let onMeasure = listener;
  const view = node.ownerDocument.defaultView;
  const read = (): void => {
    // coercion-exempt: Class C - a computed CSS length read back from the DOM, not record data
    const font = parseFloat(view?.getComputedStyle(node).fontSize ?? "");
    onMeasure(node.clientWidth, Number.isFinite(font) && font > 0 ? font : FALLBACK_FONT);
  };
  read();
  // The canvas's own window: in an Obsidian popout the main window's observer
  // class belongs to another realm.
  const Observer = view?.ResizeObserver;
  const observer = Observer ? new Observer(() => read()) : null;
  observer?.observe(node);
  return {
    update(next: WidthListener) { onMeasure = next; },
    destroy() { observer?.disconnect(); },
  };
}

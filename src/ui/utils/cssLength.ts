/**
 * cssLength — a measured length written back as a root-relative one (R0.3b).
 *
 * The plugin writes lengths in relative units only (Revision 3 §2.1). Some
 * lengths are not authored but measured: a pointer coordinate, a bounding
 * rectangle, a column footprint. The DOM reports those in CSS pixels, and the
 * one honest way to write them back without a pixel unit is to divide by the
 * root font size of the document the element lives in and write `rem`. At the
 * moment of writing the result resolves to exactly the measured length; it is
 * not rounded, because a drag ghost that drifts by a rounding step per frame
 * is a visible defect.
 *
 * The document matters: a leaf moved into an Obsidian popout window has its
 * own `<html>` (#192), so the root is read from the element's
 * `ownerDocument`, never from the bundle's global `document` alone.
 */

/** Root font size used when the document reports none (jsdom, detached docs). */
export const FALLBACK_ROOT_FONT_SIZE = 16;

/** The root font size of `doc`, in CSS pixels; 16 when it cannot be read. */
export function rootFontPx(doc: Document = document): number {
  const view = doc.defaultView;
  if (!view) return FALLBACK_ROOT_FONT_SIZE;
  // coercion-exempt: Class C - a computed CSS length read back from the DOM, not record data
  const root = parseFloat(view.getComputedStyle(doc.documentElement).fontSize);
  return Number.isFinite(root) && root > 0 ? root : FALLBACK_ROOT_FONT_SIZE;
}

/**
 * `cssPx` CSS pixels as a `rem` length against a root font size already read.
 * For a site that writes several lengths at once, so the root is read once.
 */
export function remAt(cssPx: number, rootPx: number): string {
  return `${cssPx / rootPx}rem`;
}

/** `cssPx` CSS pixels as a `rem` length against the root font size of `doc`. */
export function toRem(cssPx: number, doc: Document = document): string {
  return remAt(cssPx, rootFontPx(doc));
}

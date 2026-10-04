export interface TabStripMetrics {
  /** Visible width of the strip. */
  clientWidth: number;
  /** Full scrollable width of the strip. */
  scrollWidth: number;
  /** Current `scrollLeft` (0..max in LTR, -max..0 in RTL). */
  scrollLeft: number;
  /** Tab rect left minus strip rect left (viewport-relative). */
  tabLeft: number;
  tabWidth: number;
  /** Strip computed direction is rtl. */
  rtl: boolean;
}

/**
 * The strip `scrollLeft` that centres a tab, clamped to what the strip can
 * actually scroll. Direction-aware: in RTL, Chromium's `scrollLeft` ranges
 * from -max (far left) to 0 (start, right edge). Used instead of
 * `scrollIntoView`, which also scrolls every scrollable ancestor — on a phone
 * that includes `.projects-container` and shifts the whole plugin view sideways.
 */
export function getTabStripScrollLeft(metrics: TabStripMetrics): number {
  const { clientWidth, scrollWidth, scrollLeft, tabLeft, tabWidth, rtl } = metrics;
  const max = Math.max(0, scrollWidth - clientWidth);
  const origin = rtl ? max + scrollLeft : scrollLeft;
  const tabContentX = tabLeft + origin;
  const centred = Math.min(max, Math.max(0, tabContentX + tabWidth / 2 - clientWidth / 2));
  const result = rtl ? centred - max : centred;
  return result === 0 ? 0 : result;
}

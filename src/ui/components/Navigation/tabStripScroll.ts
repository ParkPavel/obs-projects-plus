export interface TabStripMetrics {
  /** Visible width of the strip. */
  clientWidth: number;
  /** Full scrollable width of the strip. */
  scrollWidth: number;
  /** Tab's left edge measured from the strip's scrollable origin. */
  tabOffset: number;
  tabWidth: number;
}

/**
 * The strip `scrollLeft` that centres a tab, clamped to what the strip can
 * actually scroll. Used instead of `scrollIntoView`, which also scrolls every
 * scrollable ancestor — on a phone that includes `.projects-container` and
 * shifts the whole plugin view sideways.
 */
export function getTabStripScrollLeft(metrics: TabStripMetrics): number {
  const { clientWidth, scrollWidth, tabOffset, tabWidth } = metrics;
  const max = Math.max(0, scrollWidth - clientWidth);
  const centred = tabOffset + tabWidth / 2 - clientWidth / 2;
  return Math.min(max, Math.max(0, centred));
}

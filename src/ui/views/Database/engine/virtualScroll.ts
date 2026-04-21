/**
 * VirtualScroller — windowed rendering for large DataFrames.
 *
 * Given a total item count and a container height, computes which items
 * are visible and provides padding to simulate the full list.
 */

export interface VirtualScrollState {
  /** Index of the first visible item */
  readonly startIndex: number;
  /** Index past the last visible item */
  readonly endIndex: number;
  /** Total pixel height of the virtual container */
  readonly totalHeight: number;
  /** Top offset for visible slice positioning */
  readonly offsetTop: number;
  /** Number of visible items */
  readonly visibleCount: number;
}

export interface VirtualScrollOptions {
  /** Total number of items */
  itemCount: number;
  /** Height of each row in pixels */
  rowHeight: number;
  /** Height of the visible container in pixels */
  containerHeight: number;
  /** Extra rows to render above/below viewport */
  overscan?: number;
}

const DEFAULT_OVERSCAN = 5;

/**
 * Compute the virtual scroll window based on current scroll position.
 */
export function computeVirtualScroll(
  scrollTop: number,
  options: VirtualScrollOptions
): VirtualScrollState {
  const {
    itemCount,
    rowHeight,
    containerHeight,
    overscan = DEFAULT_OVERSCAN,
  } = options;

  if (itemCount === 0 || rowHeight <= 0 || containerHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      totalHeight: 0,
      offsetTop: 0,
      visibleCount: 0,
    };
  }

  const totalHeight = itemCount * rowHeight;
  const safeScroll = Math.max(0, Math.min(scrollTop, totalHeight - containerHeight));

  const rawStart = Math.floor(safeScroll / rowHeight);
  const rawEnd = Math.ceil((safeScroll + containerHeight) / rowHeight);

  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(itemCount, rawEnd + overscan);
  const visibleCount = endIndex - startIndex;
  const offsetTop = startIndex * rowHeight;

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetTop,
    visibleCount,
  };
}

/**
 * Threshold above which virtual scrolling is activated.
 */
export const VIRTUAL_SCROLL_THRESHOLD = 100;

/**
 * Check if a DataFrame exceeds the virtual scroll threshold.
 */
export function shouldVirtualize(recordCount: number): boolean {
  return recordCount > VIRTUAL_SCROLL_THRESHOLD;
}

/**
 * Get row height for a given density setting.
 */
export function getRowHeight(
  density: "compact" | "default" | "expanded"
): number {
  switch (density) {
    case "compact":
      return 28;
    case "expanded":
      return 48;
    default:
      return 36;
  }
}

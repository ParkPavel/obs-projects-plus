/**
 * Strip geometry for the timeline all-day section (ios-p1).
 *
 * The all-day section of `TimelineView`, the sticky all-day row of
 * `InfiniteHorizontalCalendar` and the strips themselves (`AllDayEventStrip`,
 * `MultiDayEventStrip`) must agree on one strip height and one gap, or the
 * sticky label row and the day columns drift apart. Each of the four used to
 * carry its own copy of the constants; this module is now the only source.
 *
 * A coarse pointer gets a finger-sized strip: `STRIP_HEIGHT_COARSE_REM` equals
 * `--ppp-touch-target-min` at the default root. A fine pointer keeps the
 * density it always had, desktop and narrow layout alike.
 *
 * All lengths are in rem.
 */

/** Strip height on a fine pointer in the desktop layout. */
export const STRIP_HEIGHT_DESKTOP_REM = 1.25;
/** Strip height on a fine pointer in the narrow (`isMobile`) layout. */
export const STRIP_HEIGHT_MOBILE_REM = 1.125;
/** Strip height on a coarse pointer: the touch-target minimum (`--ppp-touch-target-min`). */
export const STRIP_HEIGHT_COARSE_REM = 2.75;
/** Vertical gap between stacked strips, on every pointer. */
export const STRIP_GAP_REM = 0.125;

export interface StripGeometryInput {
  /** The primary pointer is coarse (`isTouchDevice` in `src/lib/stores/ui`). */
  coarse: boolean;
  /** The calendar renders its narrow layout. */
  isMobile: boolean;
}

export interface StripGeometry {
  /** Height of one strip. */
  heightRem: number;
  /** Gap between two stacked strips. */
  gapRem: number;
}

/** Height and gap of an all-day strip for the given pointer and layout. */
export function stripGeometry({ coarse, isMobile }: StripGeometryInput): StripGeometry {
  const heightRem = coarse
    ? STRIP_HEIGHT_COARSE_REM
    : isMobile
      ? STRIP_HEIGHT_MOBILE_REM
      : STRIP_HEIGHT_DESKTOP_REM;
  return { heightRem, gapRem: STRIP_GAP_REM };
}

/** Top offset of the strip in lane `rowIndex`: one strip plus one gap per lane above it. */
export function stripTopRem(rowIndex: number, geometry: StripGeometry): number {
  return rowIndex * (geometry.heightRem + geometry.gapRem);
}

/**
 * Height of an all-day section whose deepest lane is `maxLane` (0-based):
 * `(maxLane + 1)` strips and `maxLane` gaps between them. No lane (`maxLane < 0`)
 * is an empty section, 0.
 */
export function allDaySectionHeightRem(maxLane: number, geometry: StripGeometry): number {
  if (maxLane < 0) return 0;
  return (maxLane + 1) * geometry.heightRem + maxLane * geometry.gapRem;
}

/**
 * SnapEngine — Time snapping calculations for DnD v3.2.0
 *
 * Provides time quantization (snap-to-grid) for drag and resize operations.
 * All calculations are pure functions with no side effects.
 *
 * @module dnd/SnapEngine
 */

import { DND_CONSTANTS, type SnapLine } from './types';

/**
 * Round minutes to the nearest snap interval.
 *
 * @param minutes - Raw minutes value (can be fractional)
 * @param interval - Snap interval in minutes (default: 15)
 * @returns Snapped minutes value
 */
export function snapMinutes(
  minutes: number,
  interval: number = DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
): number {
  if (interval <= 0) return minutes;
  return Math.round(minutes / interval) * interval;
}

/**
 * Snap a time string (HH:mm) to the nearest interval.
 *
 * @param time - Time string in "HH:mm" format
 * @param interval - Snap interval in minutes (default: 15)
 * @returns Snapped time string in "HH:mm" format
 */
export function snapTime(
  time: string,
  interval: number = DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
): string {
  const [hourStr, minStr] = time.split(':');
  const hours = parseInt(hourStr ?? '0', 10);
  const mins = parseInt(minStr ?? '0', 10);
  const totalMinutes = hours * 60 + mins;

  const snapped = snapMinutes(totalMinutes, interval);

  // Clamp to last valid snap point before midnight (e.g., 23:45 for 15-min)
  const maxMinutes = 24 * 60 - interval;
  const clamped = Math.max(0, Math.min(maxMinutes, snapped));

  const clampedHours = Math.floor(clamped / 60);
  const clampedMins = clamped % 60;

  return `${clampedHours.toString().padStart(2, '0')}:${clampedMins.toString().padStart(2, '0')}`;
}

/**
 * Convert a Y position (px) to snapped minutes from midnight.
 *
 * @param relativeY - Pixels from top of timeline container
 * @param startHour - First visible hour in the timeline
 * @param endHour - Last visible hour in the timeline
 * @param hourHeightRem - Height per hour in rem units
 * @param remPx - Pixels per rem (default: 16)
 * @param interval - Snap interval in minutes (default: 15)
 * @returns Total minutes from midnight, snapped to interval
 */
export function yPositionToMinutes(
  relativeY: number,
  startHour: number,
  endHour: number,
  hourHeightRem: number,
  remPx: number = 16,
  interval: number = DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
): number {
  const totalHeightPx = (endHour - startHour) * hourHeightRem * remPx;
  if (totalHeightPx <= 0) return startHour * 60;

  const hourOffset = (relativeY / totalHeightPx) * (endHour - startHour);
  const rawMinutes = (startHour + hourOffset) * 60;

  // Clamp to visible range
  const minMinutes = startHour * 60;
  const maxMinutes = endHour * 60;
  const clamped = Math.max(minMinutes, Math.min(maxMinutes, rawMinutes));

  return snapMinutes(clamped, interval);
}

/**
 * Convert minutes from midnight to a "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const clampedH = Math.min(23, Math.max(0, h));
  const clampedM = Math.max(0, m);
  return `${clampedH.toString().padStart(2, '0')}:${clampedM.toString().padStart(2, '0')}`;
}

/**
 * Convert minutes from midnight to a rem position from top of timeline.
 */
export function minutesToRem(
  minutes: number,
  startHour: number,
  hourHeightRem: number
): number {
  const minuteHeightRem = hourHeightRem / 60;
  return (minutes - startHour * 60) * minuteHeightRem;
}

/**
 * Generate snap lines for visual indicators within a time range.
 *
 * @param startHour - First visible hour
 * @param endHour - Last visible hour
 * @param interval - Snap interval in minutes (default: 15)
 * @param hourHeightRem - Height per hour in rem
 * @returns Array of snap lines with position and type info
 */
export function getSnapLines(
  startHour: number,
  endHour: number,
  interval: number = DND_CONSTANTS.SNAP_INTERVAL_DEFAULT,
  hourHeightRem: number = 3
): SnapLine[] {
  const lines: SnapLine[] = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;

  for (let m = startMinutes; m <= endMinutes; m += interval) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    lines.push({
      minutes: m,
      time: `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
      positionRem: minutesToRem(m, startHour, hourHeightRem),
      type: min === 0 ? 'major' : 'minor',
    });
  }

  return lines;
}

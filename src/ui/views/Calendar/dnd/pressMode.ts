/**
 * pressMode — the single press-time decision "what does this press on a timed
 * event bar mean": move, resize-top or resize-bottom.
 *
 * EventBar (mouse and touch) decides once at pointerDown; the drag manager's
 * touch re-evaluation after the long press uses the same function with the same
 * press point, so the mode never changes after pointerDown and mouse and touch
 * agree for the same geometry.
 *
 * @module dnd/pressMode
 */

import type { DragMode } from './types';

export type HandleHit = 'top' | 'bottom' | null;

export interface PressModeInput {
  /** Press point relative to the bar's top edge (px) */
  relY: number;
  /** Bar height (px) */
  barH: number;
  /** Root font size (px) */
  remPx: number;
  /** Touch pointer: larger edge band */
  coarse: boolean;
  /** Which visible resize handle (incl. its enlarged hit area) took the press */
  handleHit: HandleHit;
}

/** Edge band in rem: mouse / touch. */
const ZONE_REM_MOUSE = 1;
const ZONE_REM_TOUCH = 1.25;
/** The edge band never takes more than this share of the bar. */
const ZONE_MAX_SHARE = 0.35;

export function pressMode(input: PressModeInput): DragMode {
  const { relY, barH, remPx, coarse, handleHit } = input;

  // A press on a handle, in that handle's half of the bar, is its resize.
  if (handleHit === 'bottom' && relY >= barH / 2) return 'resize-bottom';
  if (handleHit === 'top' && relY <= barH / 2) return 'resize-top';

  const zone = Math.min((coarse ? ZONE_REM_TOUCH : ZONE_REM_MOUSE) * remPx, barH * ZONE_MAX_SHARE);
  if (relY <= zone) return 'resize-top';
  if (relY >= barH - zone) return 'resize-bottom';
  return 'move';
}

/** The handle (inside `bar`) a press target belongs to, if any. */
export function handleHitFromTarget(target: EventTarget | null, bar: Element | null): HandleHit {
  if (!bar || !target || typeof (target as Element).closest !== 'function') return null;
  const el = target as Element;
  const bottom = el.closest('.resize-handle-bottom');
  if (bottom && bar.contains(bottom)) return 'bottom';
  const top = el.closest('.resize-handle-top');
  if (top && bar.contains(top)) return 'top';
  return null;
}

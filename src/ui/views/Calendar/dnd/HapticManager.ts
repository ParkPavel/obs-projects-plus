/**
 * HapticManager — Centralized haptic feedback for DnD v3.2.0
 *
 * Wraps the Vibration API with predefined patterns for
 * different drag-and-drop interaction stages.
 *
 * v4.0.3: Android intensity reduction + global disable flag.
 *
 * @module dnd/HapticManager
 */

import { HAPTIC_PATTERNS, type HapticPattern } from './types';

// ─── Module-level state ──────────────────────────────────────────────────────

/** When true, all vibrate() calls are no-ops. Controlled by plugin settings. */
let _disabled = false;

/** Cached platform flag (computed once). */
let _isAndroid: boolean | null = null;

/**
 * Android vibration motors are notably stronger than iOS taptic engines.
 * Scale all durations by this factor on Android devices.
 */
const ANDROID_INTENSITY_SCALE = 0.5;

// ─── Public configuration ────────────────────────────────────────────────────

/** Enable or disable all haptic feedback globally (called from settings). */
export function setHapticEnabled(enabled: boolean): void {
  _disabled = !enabled;
}

// ─── Internals ───────────────────────────────────────────────────────────────

function isAndroid(): boolean {
  if (_isAndroid === null) {
    _isAndroid =
      typeof navigator !== 'undefined' &&
      /android/i.test(navigator.userAgent);
  }
  return _isAndroid;
}

/**
 * Trigger a haptic vibration pattern.
 * Silently no-ops on devices that don't support the Vibration API
 * or when haptic feedback is disabled via settings.
 */
function vibrate(pattern: HapticPattern): void {
  if (_disabled) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    let durations: number[] = Array.isArray(pattern.duration)
      ? [...pattern.duration]
      : [pattern.duration];

    // Scale down on Android for softer feedback
    if (isAndroid()) {
      durations = durations.map(d => Math.round(d * ANDROID_INTENSITY_SCALE));
    }

    navigator.vibrate(durations);
  }
}

/** Light tap — record creation */
export function hapticTapCreate(): void {
  vibrate(HAPTIC_PATTERNS.TAP_CREATE);
}

/** Medium pulse — drag/resize started */
export function hapticDragStart(): void {
  vibrate(HAPTIC_PATTERNS.DRAG_START);
}

/** Short tick — snapped to grid line */
export function hapticSnap(): void {
  vibrate(HAPTIC_PATTERNS.SNAP);
}

/** Confirm pulse — drop committed */
export function hapticDrop(): void {
  vibrate(HAPTIC_PATTERNS.DROP);
}

/** Double pulse — resize limit reached (min duration) */
export function hapticResizeLimit(): void {
  vibrate(HAPTIC_PATTERNS.RESIZE_LIMIT);
}

/** Triple short — action cancelled */
export function hapticCancel(): void {
  vibrate(HAPTIC_PATTERNS.CANCEL);
}

/** Two pulses — creation confirmed */
export function hapticCreationConfirm(): void {
  vibrate(HAPTIC_PATTERNS.CREATION_CONFIRM);
}

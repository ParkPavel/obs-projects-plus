// RESERVED, NOT DEAD — do not delete on an "unused imports" sweep.
//
// Nothing imports this yet by design. #036 (Mobile interaction spec, open)
// plans to convert it from reference to production: `createTouchDragHandler`
// for WindowShell's long-press activation, plus an `isCoarsePointer` store.
// A 2026-08-25 audit listed it as dead on import count alone; import count is
// not the same question as whether anything is planned.
/**
 * 🚨 REFERENCE IMPLEMENTATION - NOT CURRENTLY USED
 * =================================================
 * 
 * This file is a REFERENCE implementation of the Unified Interaction Model (UIM)
 * documented in internal_docs/MOBILE_ARCHITECTURE.md
 * 
 * ❌ NOT IMPORTED ANYWHERE - служит как архитектурная документация
 * ❌ Gesture handling реализован напрямую в RecordItem.svelte
 * ✅ Оставлен как reference для будущей рефакторинга
 * 
 * Unified Gesture Handler v1.0
 * 
 * Cross-platform input abstraction for consistent UX on desktop and mobile.
 * 
 * INTERACTION MODEL:
 * ==================
 * 
 * | Action              | Desktop          | Mobile/Touch       |
 * |---------------------|------------------|--------------------|
 * | Primary action      | Click            | Single tap         |
 * | Open in new tab     | Ctrl+Click       | Double tap         |
 * | Context menu        | Right-click      | Long press (400ms) |
 * | Cancel              | Escape           | Swipe away         |
 * 
 * CALENDAR SPECIFIC:
 * - Tap on day cell → Open DayPopup
 * - Tap on event → Show event context menu (settings, color, delete)
 * - Double tap on event (mobile) / Ctrl+Click (desktop) → Open note in new tab
 * - Long press on event → Drag to reschedule
 * 
 * All distance values in rem for consistency with design tokens.
 */

import { writable } from 'svelte/store';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type GestureAction = 
  | 'primary'           // Single click / tap → context menu / settings
  | 'openInNewTab'      // Ctrl+Click / Double tap → open note
  | 'contextMenu'       // Right-click / Long press → extended menu
  | 'drag'              // Drag to reschedule
  | 'cancel';           // Escape / swipe away

export interface GestureResult {
  action: GestureAction;
  target: HTMLElement;
  event: MouseEvent | TouchEvent;
  position: { x: number; y: number };
}

export interface GestureConfig {
  // Timing (ms)
  doubleTapInterval: number;
  longPressDelay: number;
  
  // Distance thresholds (rem, converted to px at runtime)
  tapMoveTolerance: number;
  dragThreshold: number;
  
  // Edge zones to avoid (system gestures)
  edgeLeft: number;
  edgeRight: number;
  edgeTop: number;
  edgeBottom: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: GestureConfig = {
  // Timing
  doubleTapInterval: 300,    // ms between taps for double-tap
  longPressDelay: 400,       // ms for long press
  
  // Distance (rem)
  tapMoveTolerance: 0.625,   // ~10px - max movement during tap
  dragThreshold: 0.3125,     // ~5px - start of drag
  
  // Edge zones (rem) - avoid system gestures
  edgeLeft: 1.25,            // ~20px
  edgeRight: 1.25,
  edgeTop: 3.125,            // ~50px (header)
  edgeBottom: 1.875,         // ~30px (mobile nav)
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert rem to pixels based on root font size
 */
function remToPx(rem: number): number {
  if (typeof activeDocument === 'undefined') return rem * 16;
  const rootFontSize = parseFloat(getComputedStyle(activeDocument.documentElement).fontSize);
  return rem * rootFontSize;
}

/**
 * Check if touch started in system gesture zone
 */
function isInEdgeZone(x: number, y: number, config: GestureConfig): boolean {
  const { innerWidth, innerHeight } = window;
  
  const edgeLeft = remToPx(config.edgeLeft);
  const edgeRight = remToPx(config.edgeRight);
  const edgeTop = remToPx(config.edgeTop);
  const edgeBottom = remToPx(config.edgeBottom);
  
  return (
    x < edgeLeft ||
    x > innerWidth - edgeRight ||
    y < edgeTop ||
    y > innerHeight - edgeBottom
  );
}

/**
 * Calculate distance between two points
 */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

export interface DeviceCapabilities {
  isTouchDevice: boolean;
  hasFinePointer: boolean;
  isCoarsePointer: boolean;
  prefersReducedMotion: boolean;
}

export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      isTouchDevice: false,
      hasFinePointer: true,
      isCoarsePointer: false,
      prefersReducedMotion: false,
    };
  }
  
  return {
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasFinePointer: window.matchMedia('(pointer: fine)').matches,
    isCoarsePointer: window.matchMedia('(pointer: coarse)').matches,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}

export const deviceCapabilities = writable<DeviceCapabilities>(detectDeviceCapabilities());

// Update on media query change
if (typeof window !== 'undefined') {
  const updateCapabilities = () => deviceCapabilities.set(detectDeviceCapabilities());
  window.matchMedia('(pointer: fine)').addEventListener('change', updateCapabilities);
  window.matchMedia('(pointer: coarse)').addEventListener('change', updateCapabilities);
}

// ═══════════════════════════════════════════════════════════════════════════
// GESTURE HANDLER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export interface GestureCallbacks {
  /** Single tap/click → show context menu or settings */
  onPrimary?: (result: GestureResult) => void;
  /** Double tap / Ctrl+Click → open in new tab */
  onOpenInNewTab?: (result: GestureResult) => void;
  /** Right-click / Long press → extended context menu */
  onContextMenu?: (result: GestureResult) => void;
  /** Drag start */
  onDragStart?: (result: GestureResult) => void;
}

interface TouchState {
  startTime: number;
  startX: number;
  startY: number;
  lastTapTime: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  isLongPress: boolean;
  hasMoved: boolean;
}

/**
 * Create a gesture handler for an element
 * 
 * Usage:
 * ```svelte
 * <script>
 *   import { createGestureHandler } from '$lib/helpers/gestureHandler';
 *   
 *   const gesture = createGestureHandler({
 *     onPrimary: (result) => showContextMenu(result.position),
 *     onOpenInNewTab: (result) => openNote(record.id, true),
 *     onContextMenu: (result) => showExtendedMenu(result.position),
 *   });
 * </script>
 * 
 * <div use:gesture.action>
 *   ...
 * </div>
 * ```
 */
export function createGestureHandler(
  callbacks: GestureCallbacks,
  config: Partial<GestureConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const state: TouchState = {
    startTime: 0,
    startX: 0,
    startY: 0,
    lastTapTime: 0,
    longPressTimer: null,
    isLongPress: false,
    hasMoved: false,
  };
  
  // Prevent synthetic click after touch
  let touchHandled = false;
  let touchHandledTimer: ReturnType<typeof setTimeout> | null = null;
  
  function clearTimers() {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    if (touchHandledTimer) {
      clearTimeout(touchHandledTimer);
      touchHandledTimer = null;
    }
  }
  
  function createResult(
    action: GestureAction,
    event: MouseEvent | TouchEvent,
    target: HTMLElement
  ): GestureResult {
    let x: number, y: number;
    
    if ('touches' in event) {
      const touch = event.changedTouches[0] || event.touches[0];
      x = touch?.clientX ?? 0;
      y = touch?.clientY ?? 0;
    } else {
      x = event.clientX;
      y = event.clientY;
    }
    
    return { action, target, event, position: { x, y } };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // MOUSE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  
  function handleClick(event: MouseEvent) {
    // Block synthetic click after touch
    if (touchHandled) {
      touchHandled = false;
      return;
    }
    
    const target = event.currentTarget as HTMLElement;
    
    // Ctrl+Click / Cmd+Click → open in new tab
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onOpenInNewTab?.(createResult('openInNewTab', event, target));
      return;
    }
    
    // Normal click → primary action (context menu / settings)
    event.preventDefault();
    event.stopPropagation();
    callbacks.onPrimary?.(createResult('primary', event, target));
  }
  
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    callbacks.onContextMenu?.(createResult('contextMenu', event, target));
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // TOUCH HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  
  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    
    // Check edge zones - don't intercept system gestures
    if (isInEdgeZone(touch.clientX, touch.clientY, cfg)) {
      return;
    }
    
    state.startTime = Date.now();
    state.startX = touch.clientX;
    state.startY = touch.clientY;
    state.isLongPress = false;
    state.hasMoved = false;
    
    // Start long press timer
    state.longPressTimer = setTimeout(() => {
      state.isLongPress = true;
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      const target = event.currentTarget as HTMLElement;
      callbacks.onContextMenu?.(createResult('contextMenu', event, target));
    }, cfg.longPressDelay);
  }
  
  function handleTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (!touch) return;
    
    const moveDistance = distance(state.startX, state.startY, touch.clientX, touch.clientY);
    const tolerance = remToPx(cfg.tapMoveTolerance);
    
    if (moveDistance > tolerance) {
      state.hasMoved = true;
      
      // Cancel long press if moved
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
      
      // Check for drag start
      const dragThreshold = remToPx(cfg.dragThreshold);
      if (moveDistance > dragThreshold && callbacks.onDragStart) {
        const target = event.currentTarget as HTMLElement;
        callbacks.onDragStart(createResult('drag', event, target));
      }
    }
  }
  
  function handleTouchEnd(event: TouchEvent) {
    clearTimers();
    
    // Set flag to block synthetic click
    touchHandled = true;
    touchHandledTimer = setTimeout(() => {
      touchHandled = false;
    }, 400);
    
    // If long press already fired, don't process tap
    if (state.isLongPress) {
      state.isLongPress = false;
      event.preventDefault();
      return;
    }
    
    // If finger moved too much, it's a scroll/swipe
    if (state.hasMoved) {
      return;
    }
    
    const touchDuration = Date.now() - state.startTime;
    if (touchDuration > 500) {
      return; // Too long for a tap
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.currentTarget as HTMLElement;
    const now = Date.now();
    
    // Check for double tap
    if (now - state.lastTapTime < cfg.doubleTapInterval) {
      state.lastTapTime = 0;
      callbacks.onOpenInNewTab?.(createResult('openInNewTab', event, target));
    } else {
      // Single tap - use timeout to wait for potential second tap
      state.lastTapTime = now;
      
      setTimeout(() => {
        if (state.lastTapTime === now) {
          // No second tap came, execute primary action
          callbacks.onPrimary?.(createResult('primary', event, target));
        }
      }, cfg.doubleTapInterval);
    }
  }
  
  function handleTouchCancel() {
    clearTimers();
    state.isLongPress = false;
    state.hasMoved = false;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SVELTE ACTION
  // ─────────────────────────────────────────────────────────────────────────
  
  function action(node: HTMLElement) {
    // Mouse events
    node.addEventListener('click', handleClick);
    node.addEventListener('contextmenu', handleContextMenu);
    
    // Touch events
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: true });
    node.addEventListener('touchend', handleTouchEnd);
    node.addEventListener('touchcancel', handleTouchCancel);
    
    return {
      destroy() {
        clearTimers();
        node.removeEventListener('click', handleClick);
        node.removeEventListener('contextmenu', handleContextMenu);
        node.removeEventListener('touchstart', handleTouchStart);
        node.removeEventListener('touchmove', handleTouchMove);
        node.removeEventListener('touchend', handleTouchEnd);
        node.removeEventListener('touchcancel', handleTouchCancel);
      }
    };
  }
  
  return { action };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLIFIED HANDLERS FOR COMMON CASES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple handler that maps gestures to dispatched events.
 * 
 * Dispatches:
 * - 'primary' → showMenu (single tap/click)
 * - 'openInNewTab' → open in new tab (double tap / Ctrl+Click)
 * - 'contextMenu' → extended menu (long press / right-click)
 */
export function createEventGestureHandler(dispatch: (event: string, detail?: unknown) => void) {
  return createGestureHandler({
    onPrimary: (result) => {
      dispatch('showMenu', result.position);
    },
    onOpenInNewTab: () => {
      dispatch('openInNewTab');
    },
    onContextMenu: (result) => {
      dispatch('contextMenu', result.position);
    },
  });
}

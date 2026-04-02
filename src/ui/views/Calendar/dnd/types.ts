/**
 * DnD Types & Constants for Timeline Drag & Drop v3.2.0
 *
 * Constants, types and interfaces for the drag-and-drop system
 * used in Calendar timeline views (Week/Day).
 *
 * @module dnd/types
 */

import type dayjs from 'dayjs';
import type { DataRecord } from '../../../../lib/dataframe/dataframe';
import type { EventRenderType, ProcessedRecord } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

export const DND_CONSTANTS = {
  /** Minimum pointer movement in rem-multiplier to distinguish drag from click (×remPx) */
  DRAG_THRESHOLD_REM: 0.3125,
  /** Touch: long-press duration to initiate drag (ms) */
  LONG_PRESS_MS: 500,
  /** Default snap interval in minutes */
  SNAP_INTERVAL_DEFAULT: 15,
  /** Available snap intervals */
  SNAP_INTERVALS: [15, 30, 60] as readonly number[],
  /** Edge zone width for auto-scroll activation in rem-multiplier (×remPx) */
  AUTO_SCROLL_ZONE_REM: 2.5,
  /** Auto-scroll speed in rem per animation frame */
  AUTO_SCROLL_SPEED_REM: 0.1875,
  /** Ghost bar opacity during drag */
  GHOST_OPACITY: 0.7,
  /** Minimum event duration when resizing (minutes) */
  MIN_DURATION_MINUTES: 15,
  /** Default duration for new events created via tap (minutes) */
  CREATION_DEFAULT_DURATION: 60,
  /** Auto-confirm timeout for touch-tap creation preview (ms) */
  CREATION_CONFIRM_TIMEOUT: 3000,
  /** Triangle handle size on desktop (rem) */
  TRIANGLE_SIZE_DESKTOP: 0.5,
  /** Triangle handle size on touch devices (rem) */
  TRIANGLE_SIZE_TOUCH: 0.75,
  /** Minimum touch target around triangle handle (rem) */
  TRIANGLE_TOUCH_AREA: 2.75,
} as const;

// ─── Haptic Patterns ─────────────────────────────────────────────────────────

export interface HapticPattern {
  readonly duration: number | readonly number[];
}

export const HAPTIC_PATTERNS = {
  /** Light tap — record creation */
  TAP_CREATE: { duration: 30 } as const,
  /** Medium — drag/resize start */
  DRAG_START: { duration: 50 } as const,
  /** Short — snap to grid */
  SNAP: { duration: 15 } as const,
  /** Confirm — drop/commit */
  DROP: { duration: 40 } as const,
  /** Double pulse — resize limit reached */
  RESIZE_LIMIT: { duration: [20, 50, 20] as const } as const,
  /** Triple short — cancel */
  CANCEL: { duration: [15, 30, 15] as const } as const,
  /** Two pulses — creation confirmed */
  CREATION_CONFIRM: { duration: [20, 40] as const } as const,
} as const satisfies Record<string, HapticPattern>;

export type HapticPatternName = keyof typeof HAPTIC_PATTERNS;

// ─── Drag State Types ────────────────────────────────────────────────────────

/** State machine states for drag operations */
export type DragState = 'idle' | 'pending' | 'dragging' | 'committing';

/** Drag operation modes */
export type DragMode =
  | 'move'               // Vertical drag of EventBar (time change)
  | 'resize-top'         // Resize top edge of EventBar (startTime)
  | 'resize-bottom'      // Resize bottom edge of EventBar (endTime)
  | 'strip-move'         // Horizontal drag of strip (date change)
  | 'strip-resize-start' // Resize left edge of MultiDay strip (startDate)
  | 'strip-resize-end';  // Resize right edge of MultiDay strip (endDate)

/** Ghost bar position during drag */
export interface GhostPosition {
  /** Top offset in rem */
  topRem: number;
  /** Height in rem */
  heightRem: number;
  /** Index of the target day column */
  dayColumnIndex: number;
  /** Formatted start time (e.g., "14:30") */
  time: string;
  /** Formatted end time (e.g., "15:30") */
  endTime: string;
  /** Target day */
  date: dayjs.Dayjs;
  /** v3.2.6: Event title for ghost display */
  title?: string;
  /** v3.2.2: Viewport-fixed rect for cross-period ghost rendering */
  viewportRect?: { top: number; left: number; width: number; height: number };
}

/** Snap line for visual indicator */
export interface SnapLine {
  /** Total minutes from midnight */
  minutes: number;
  /** Formatted time (e.g., "14:30") */
  time: string;
  /** Vertical position in rem */
  positionRem: number;
  /** Line type: hour boundary vs sub-hour */
  type: 'major' | 'minor';
}

/** Complete drag context passed to commit handler */
export interface DragContext {
  /** The record being dragged */
  record: DataRecord;
  /** Original processed record data */
  processedRecord: ProcessedRecord;
  /** Drag operation mode */
  mode: DragMode;
  /** Target day after drag */
  targetDate: dayjs.Dayjs;
  /** New start time (for move/resize-top) */
  startTime: string | undefined;
  /** New end time (for move/resize-bottom) */
  endTime: string | undefined;
}

// ─── Strip DnD Types (Iteration 5-6) ────────────────────────────────────────

/** Context for strip drag operations */
export interface StripDragContext {
  record: ProcessedRecord;
  renderType: EventRenderType;
  originalStartDate: dayjs.Dayjs;
  originalEndDate: dayjs.Dayjs;
  spanDays: number;
  sourceView: 'timeline' | 'headers';
}

/** Ghost position for strip drag */
export interface StripGhostPosition {
  startDayIndex: number;
  endDayIndex: number;
  laneIndex: number;
  targetDate: dayjs.Dayjs;
  /** v3.2.6: Event title for ghost display */
  title?: string;
  /** v3.2.4: Viewport-relative rect for cross-period strip ghost rendering */
  viewportRect?: { top: number; left: number; width: number; height: number };
}

/** Column detection utility interface */
export interface DayColumnMap {
  columns: DOMRect[];
  days: dayjs.Dayjs[];
  getDayFromClientX(clientX: number): { day: dayjs.Dayjs; index: number } | null;
}

// ─── Options for handleRecordChange extension ────────────────────────────────

/** Extended options for record change from DnD operations */
export interface RecordChangeOptions {
  /** New start time (e.g., "14:30") */
  startTime?: string;
  /** New end time (e.g., "15:45") */
  endTime?: string;
  /** New end date (for strip resize operations) */
  endDate?: dayjs.Dayjs;
}

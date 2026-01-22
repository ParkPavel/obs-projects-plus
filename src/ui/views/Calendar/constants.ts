/**
 * Calendar Constants (v3.0.0)
 * 
 * Centralized constants for the Calendar module.
 * Single source of truth for all magic numbers and configurations.
 */

import type { CalendarInterval } from "./calendar";

// ============================================================
// ZOOM HIERARCHY - Single source of truth
// ============================================================

export interface ZoomLevelDefinition {
  interval: CalendarInterval;
  order: number;      // -1 = most zoomed out, higher = more detail
  label: string;      // Display label
  daysVisible: number; // Approximate days visible in this view
}

/**
 * Zoom hierarchy from most zoomed out to most zoomed in.
 * Use this EVERYWHERE instead of defining locally.
 */
export const ZOOM_HIERARCHY: ZoomLevelDefinition[] = [
  { interval: "year", order: -1, label: "Year", daysVisible: 365 },
  { interval: "month", order: 0, label: "Month", daysVisible: 30 },
  { interval: "2weeks", order: 1, label: "2 Weeks", daysVisible: 14 },
  { interval: "week", order: 2, label: "Week", daysVisible: 7 },
  { interval: "day", order: 3, label: "Day", daysVisible: 1 },
];

/**
 * Simple array of intervals in zoom order (convenience)
 */
export const ZOOM_LEVELS: CalendarInterval[] = ZOOM_HIERARCHY.map(z => z.interval);

/**
 * Get zoom level definition by interval
 */
export function getZoomLevel(interval: CalendarInterval): ZoomLevelDefinition | undefined {
  return ZOOM_HIERARCHY.find(z => z.interval === interval);
}

/**
 * Get next zoom level (zoom in = more detail)
 */
export function getNextZoomLevel(current: CalendarInterval): CalendarInterval {
  const currentIndex = ZOOM_HIERARCHY.findIndex(z => z.interval === current);
  if (currentIndex < 0 || currentIndex >= ZOOM_HIERARCHY.length - 1) {
    return current;
  }
  return ZOOM_HIERARCHY[currentIndex + 1]!.interval;
}

/**
 * Get previous zoom level (zoom out = less detail)
 */
export function getPreviousZoomLevel(current: CalendarInterval): CalendarInterval {
  const currentIndex = ZOOM_HIERARCHY.findIndex(z => z.interval === current);
  if (currentIndex <= 0) {
    return current;
  }
  return ZOOM_HIERARCHY[currentIndex - 1]!.interval;
}

// ============================================================
// GESTURE CONSTANTS
// ============================================================

export const GESTURE = {
  /** Minimum distance (px) to consider a swipe */
  SWIPE_THRESHOLD: 15,
  
  /** Maximum vertical deviation for horizontal swipe (px) */
  SWIPE_MAX_VERTICAL: 50,
  
  /** Distance from screen edge for Obsidian sidebar gesture (px) */
  EDGE_THRESHOLD: 30,
  
  /** Minimum distance for pinch zoom (px) */
  PINCH_THRESHOLD: 50,
  
  /** Ratio: if horizontal > vertical * this, it's horizontal swipe */
  HORIZONTAL_RATIO: 1.5,
} as const;

// ============================================================
// TIMING CONSTANTS
// ============================================================

export const TIMING = {
  /** Debounce delay for zoom operations (ms) */
  ZOOM_DEBOUNCE: 400,
  
  /** Animation duration for view transitions (ms) */
  VIEW_TRANSITION: 200,
  
  /** Delay before auto-centering after view change (ms) */
  AUTO_CENTER_DELAY: 200,
  
  /** Duration for zoom indicator display (ms) */
  ZOOM_INDICATOR_DURATION: 1000,
  
  /** Scroll debounce for infinite scroll (ms) */
  SCROLL_DEBOUNCE: 100,
  
  /** Interval for "now" updates (ms) */
  NOW_UPDATE_INTERVAL: 60_000,
  
  /** Max retry attempts for scroll operations */
  MAX_SCROLL_ATTEMPTS: 20,
  
  /** Delay between scroll retry attempts (ms) */
  SCROLL_RETRY_DELAY: 50,
} as const;

// ============================================================
// INFINITE SCROLL CONSTANTS
// ============================================================

export const INFINITE_SCROLL = {
  /** Initial buffer of periods on each side */
  INITIAL_BUFFER: 4,
  
  /** Units from edge to trigger loading more - v6.5: increased for smoother infinite scroll */
  LOAD_THRESHOLD: 2,
  
  /** Batch size when loading more periods */
  LOAD_BATCH: 3,
  
  /** Vertical scroll: initial buffer */
  VERTICAL_INITIAL_BUFFER: 3,
  
  /** Vertical scroll: load threshold */
  VERTICAL_LOAD_THRESHOLD: 2,
  
  /** Vertical scroll: batch size */
  VERTICAL_LOAD_BATCH: 3,
} as const;

// ============================================================
// TIMELINE VIEW CONSTANTS
// ============================================================

export const TIMELINE = {
  /** Height per hour in rem */
  HOUR_HEIGHT_REM: 3,
  
  /** Total hours displayed */
  TOTAL_HOURS: 24,
  
  /** Default scroll position (hour) */
  DEFAULT_SCROLL_HOUR: 7,
  
  /** Strip height for all-day events (rem) */
  STRIP_HEIGHT_REM: 1.375,
  
  /** Gap between strip rows (rem) */
  STRIP_GAP_REM: 0.125,
  
  /** Minimum height for all-day section (rem) */
  MIN_ALLDAY_HEIGHT_REM: 0,
  
  /** Default start hour for time display */
  DEFAULT_START_HOUR: 6,
  
  /** Default end hour for time display */
  DEFAULT_END_HOUR: 22,
} as const;

// ============================================================
// YEAR HEATMAP CONSTANTS
// ============================================================

export const HEATMAP = {
  /** Heat level thresholds (events per day) */
  HEAT_LEVELS: {
    LEVEL_0: 0,   // No events
    LEVEL_1: 1,   // 1 event
    LEVEL_2: 3,   // 2-3 events
    LEVEL_3: 6,   // 4-6 events
    LEVEL_4: 7,   // 7+ events
  },
} as const;

// ============================================================
// VALIDATION CONSTANTS
// ============================================================

export const VALIDATION = {
  /** Maximum event span in days (safety limit) */
  MAX_SPAN_DAYS: 365,
  
  /** Maximum date range (years from today) */
  MAX_DATE_RANGE_YEARS: 100,
} as const;

// ============================================================
// GESTURE & NAVIGATION CONSTANTS (v3.1.0)
// ============================================================

/**
 * Gesture zone definitions for conflict resolution
 */
export const GESTURE_ZONES = {
  /** Pinch-to-zoom active zone (center of screen) */
  PINCH_ZONE: {
    TOP_PERCENT: 20,
    BOTTOM_PERCENT: 80,
  },
  
  /** Edge swipe zones (navigation/sidebar) */
  EDGE_ZONE: {
    LEFT_PX: 50,
    RIGHT_PX: 50,
    TOP_PX: 60,  // Obsidian top menu swipe area
  },
  
  /** Scroll zones (main content) */
  SCROLL_ZONE: {
    MIN_MOVE_PX: 10, // Minimum movement to trigger scroll
  },
} as const;

/**
 * Gesture detection thresholds
 */
export const GESTURE_THRESHOLDS = {
  /** Pinch-to-zoom */
  PINCH: {
    MIN_SCALE_DELTA: 0.15,  // Minimum scale change to trigger zoom
    DEBOUNCE_MS: 100,        // Debounce between zoom operations
  },
  
  /** Tap vs Hold */
  TAP: {
    MAX_DURATION_MS: 300,    // Max duration for tap
    MAX_MOVE_PX: 10,         // Max movement for tap
  },
  
  /** Swipe */
  SWIPE: {
    MIN_VELOCITY: 0.5,       // Minimum velocity (px/ms)
    MIN_DISTANCE_PX: 50,     // Minimum distance
  },
} as const;

/**
 * Animation configurations
 */
export const ANIMATION = {
  /** Default animation duration */
  DURATION_MS: 300,
  
  /** Easing functions */
  EASING: {
    DEFAULT: 'cubic-bezier(0.33, 1, 0.68, 1)', // easeOutCubic
    SMOOTH: 'cubic-bezier(0.65, 0, 0.35, 1)',  // easeInOutCubic
  },
  
  /** Scroll animations */
  SCROLL: {
    DURATION_MS: 300,
    POSITION_CENTER_OFFSET_PX: 0, // Offset for center positioning
  },
  
  /** Zoom animations */
  ZOOM: {
    DURATION_MS: 400,
    VISUAL_RATIO_PRESERVE: true, // Preserve visual position during zoom
  },
} as const;

// ============================================================
// CSS CUSTOM PROPERTIES (for reference/documentation)
// ============================================================

/**
 * These should be defined in CSS, this is for documentation:
 * 
 * --calendar-hour-height: 3rem;
 * --calendar-strip-height: 1.375rem;
 * --calendar-strip-gap: 0.125rem;
 * --calendar-transition-duration: 200ms;
 * --calendar-transition-easing: ease-out;
 */
export const CSS_VARS = {
  HOUR_HEIGHT: '--calendar-hour-height',
  STRIP_HEIGHT: '--calendar-strip-height',
  STRIP_GAP: '--calendar-strip-gap',
  TRANSITION_DURATION: '--calendar-transition-duration',
  TRANSITION_EASING: '--calendar-transition-easing',
} as const;

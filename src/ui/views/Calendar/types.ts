import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { CalendarInterval } from "./calendar";
import type dayjs from "dayjs";

export interface CalendarConfig {
  readonly interval?: CalendarInterval;
  readonly displayMode?: 'headers' | 'bars'; // default: "headers" (legacy mode), "bars" (timeline mode for day)
  // NEW fields (v3.0.0) - startDate/endDate/startTime/endTime
  readonly startDateField?: string;  // default: "startDate"
  readonly endDateField?: string;    // default: "endDate"
  readonly startTimeField?: string;  // default: "startTime"
  readonly endTimeField?: string;    // default: "endTime"
  readonly eventColorField?: string; // default: "eventColor" (hex color for event bars)
  readonly startHour?: number;       // default: 6 (timeline start hour)
  readonly endHour?: number;         // default: 22 (timeline end hour)
  // Creation date field — auto-filled when creating notes, NOT used for event start detection
  readonly dateField?: string;       // default: "date" (creation date)
  readonly checkField?: string;
  readonly centerOn?: string | null;
  readonly agendaOpen?: boolean;
  readonly timezone?: string;
  readonly timeFormat?: string;
}

// ============================================================
// PROCESSED CALENDAR DATA TYPES (v3.0.0)
// Single source of truth - processed ONCE, used by all views
// ============================================================

/**
 * Event render type determines WHERE the event is rendered:
 * - ALL_DAY: Header section only (no time)
 * - TIMED: Timeline section only (has time, single day)
 * - MULTI_DAY_ALLDAY: Header section (spans multiple days, no time)
 * - MULTI_DAY_TIMED: BOTH header and timeline (spans multiple days with time)
 */
export enum EventRenderType {
  ALL_DAY = "all-day",
  TIMED = "timed",
  MULTI_DAY_ALLDAY = "multi-day-allday",
  MULTI_DAY_TIMED = "multi-day-timed",
}

/**
 * Time information extracted from record
 */
export interface TimeInfo {
  startTime: dayjs.Dayjs;       // Full datetime with time
  endTime: dayjs.Dayjs;         // Full datetime with time
  durationMinutes: number;      // Duration in minutes
  hasEmbeddedTime: boolean;     // Time was in date field (not separate)
}

/**
 * Span information for multi-day events
 */
export interface SpanInfo {
  startDate: dayjs.Dayjs;       // First day of span
  endDate: dayjs.Dayjs;         // Last day of span
  spanDays: number;             // Total days in span
}

/**
 * Processed record with all calendar-relevant data pre-computed
 */
export interface ProcessedRecord {
  record: DataRecord;           // Original record reference
  renderType: EventRenderType;  // How to render this event
  
  // Parsed dates (computed ONCE)
  startDate: dayjs.Dayjs | null;  // Can be null if only endDate exists
  endDate: dayjs.Dayjs | null;    // Can be null for single-day events
  
  // Time info (for TIMED/MULTI_DAY_TIMED)
  timeInfo: TimeInfo | null;
  
  // Span info (for MULTI_DAY events)
  spanInfo: SpanInfo | null;
  
  // Visual properties
  color: string | null;         // From eventColorField or getRecordColor
  
  // Lane assignment for header stacking (assigned by processor)
  lane: number;
}

/**
 * Main processed data structure - computed once, used everywhere
 */
export interface ProcessedCalendarData {
  /** All records processed with dates/times/spans/colors */
  processed: ProcessedRecord[];
  
  /** Records grouped by date (YYYY-MM-DD → records touching that date) */
  grouped: Record<string, ProcessedRecord[]>;
  
  /** Quick lookup by record ID */
  index: Map<string, ProcessedRecord>;
  
  /** Maximum lane number used (for header height calculation) */
  maxLane: number;
}

/**
 * Header plaque for rendering in day header
 */
export interface HeaderPlaque {
  event: ProcessedRecord;
  lane: number;
  top: string;                  // CSS rem value
  height: string;               // CSS rem value
}

/**
 * Timeline column for overlapping events
 */
export interface TimelineColumn {
  events: ProcessedRecord[];
  width: string;                // CSS width (percentage or calc)
  left: string;                 // CSS left offset
  columnIndex: number;
  totalColumns: number;
}

/**
 * Zoom level configuration
 */
export interface ZoomLevelConfig {
  hourHeight: number;           // rem per hour
  dayPadding: string;           // rem
  eventGap: string;             // rem
  fontSize: string;             // rem
  minBarHeight: number;         // rem (minimum visible bar)
  maxBarsPerDay: number;        // After N → "+X more"
  showTimeLabels: boolean;
  showTimeGrid: boolean;
}

/**
 * Zoom level configurations by interval
 */
export const ZOOM_CONFIGS: Record<CalendarInterval, ZoomLevelConfig> = {
  year: {
    hourHeight: 0,
    dayPadding: "0",
    eventGap: "0",
    fontSize: "0.625rem",
    minBarHeight: 0,
    maxBarsPerDay: 0,
    showTimeLabels: false,
    showTimeGrid: false,
  },
  month: {
    hourHeight: 0.5,
    dayPadding: "0.375rem",
    eventGap: "0.25rem",
    fontSize: "0.75rem",
    minBarHeight: 1,
    maxBarsPerDay: 5,
    showTimeLabels: false,
    showTimeGrid: false,
  },
  "2weeks": {
    hourHeight: 1.5,
    dayPadding: "0.5rem",
    eventGap: "0.375rem",
    fontSize: "0.8125rem",
    minBarHeight: 1.5,
    maxBarsPerDay: 8,
    showTimeLabels: false,
    showTimeGrid: false,
  },
  week: {
    hourHeight: 2.5,
    dayPadding: "0.75rem",
    eventGap: "0.5rem",
    fontSize: "0.875rem",
    minBarHeight: 2,
    maxBarsPerDay: 12,
    showTimeLabels: true,
    showTimeGrid: true,
  },
  day: {
    hourHeight: 4,
    dayPadding: "1.5rem",
    eventGap: "1rem",
    fontSize: "1rem",
    minBarHeight: 3,
    maxBarsPerDay: 50,
    showTimeLabels: true,
    showTimeGrid: true,
  },
};

// Zoom functionality interfaces
export interface ZoomTarget {
  date: Date;
  interval: CalendarInterval;
}

export interface ZoomLevel {
  interval: CalendarInterval;
  order: number; // Lower number = zoomed out, higher = zoomed in
}

export const ZOOM_HIERARCHY: ZoomLevel[] = [
  { interval: "month", order: 0 },
  { interval: "2weeks", order: 1 },
  { interval: "week", order: 2 },
  { interval: "day", order: 3 }
];

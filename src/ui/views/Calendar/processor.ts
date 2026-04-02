/**
 * CalendarDataProcessor (v3.0.0)
 * 
 * Processes DataFrame records ONCE and produces ProcessedCalendarData.
 * All views (month/week/day) use the same processed data.
 * 
 * Key responsibilities:
 * 1. Parse dates/times with timezone awareness
 * 2. Determine render type (all-day, timed, multi-day)
 * 3. Assign lanes for header stacking
 * 4. Group records by date
 * 5. Extract colors from eventColorField or getRecordColor
 */

import dayjs from "dayjs";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import {
  parseDateInTimezone,
  extractTimeWithPriority,
  extractEventColor,
} from "./calendar";
import {
  EventRenderType,
  type CalendarConfig,
  type ProcessedCalendarData,
  type ProcessedRecord,
  type TimeInfo,
  type SpanInfo,
} from "./types";
import { calendarLogger } from './logger';

/**
 * Check if a date value contains embedded time
 */
function hasTimeComponent(value: unknown): boolean {
  if (typeof value !== "string") return false;
  // Match patterns: "09:30", "T09:30", "09:30:00", ISO datetime
  return /\d{2}:\d{2}/.test(value);
}

/**
 * Main processor class
 */
export class CalendarDataProcessor {
  private config: CalendarConfig;
  private timezone: string;
  private getRecordColor: ((record: DataRecord) => string | null) | null;

  constructor(
    config: CalendarConfig,
    getRecordColor?: (record: DataRecord) => string | null
  ) {
    this.config = config;
    this.timezone = config.timezone ?? "local";
    this.getRecordColor = getRecordColor ?? null;
  }

  /**
   * Process all records from DataFrame
   * This is the ONLY place where date parsing happens
   */
  process(frame: DataFrame): ProcessedCalendarData {
    const t0 = performance.now();
    const processed: ProcessedRecord[] = [];

    // Process each record
    for (const record of frame.records) {
      const processedRecord = this.processRecord(record);
      if (processedRecord) {
        processed.push(processedRecord);
      }
    }
    const t1 = performance.now();

    // Assign lanes for header events (all-day and multi-day)
    this.assignLanes(processed);
    const t2 = performance.now();
    
    // Group by date
    const grouped = this.groupByDate(processed);
    const t3 = performance.now();

    // Build index
    const index = new Map<string, ProcessedRecord>();
    for (const pr of processed) {
      index.set(pr.record.id, pr);
    }

    // Calculate max lane
    const maxLane = processed.reduce((max, pr) => Math.max(max, pr.lane), 0);

    calendarLogger.debug(`[Perf] process(): ${(t1-t0).toFixed(1)}ms records, ${(t2-t1).toFixed(1)}ms lanes, ${(t3-t2).toFixed(1)}ms group, total=${(performance.now()-t0).toFixed(1)}ms (${frame.records.length} records, ${processed.length} processed, ${Object.keys(grouped).length} days)`);

    return { processed, grouped, index, maxLane };
  }

  /**
   * Process a single record
   */
  private processRecord(record: DataRecord): ProcessedRecord | null {
    // Extract dates
    const { startDate, endDate } = this.extractDates(record);

    // Skip records with no dates at all
    if (!startDate && !endDate) {
      return null;
    }

    // Use available date (startDate takes priority, fallback to endDate)
    const effectiveStart = startDate || endDate!;
    const effectiveEnd = endDate || startDate!;

    // Extract time info
    const timeInfo = this.extractTimeInfo(record, effectiveStart, effectiveEnd);

    // Determine render type
    const renderType = this.determineRenderType(
      startDate,
      endDate,
      timeInfo !== null
    );

    // Calculate span info for multi-day events
    const spanInfo = this.calculateSpanInfo(effectiveStart, effectiveEnd);

    // Extract color
    const color = this.extractColor(record);

    return {
      record,
      renderType,
      startDate,
      endDate,
      timeInfo,
      spanInfo,
      color,
      lane: 0, // Will be assigned later
    };
  }

  /**
   * Extract start and end dates from record
   */
  private extractDates(record: DataRecord): {
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  } {
    const endFieldName = this.config.endDateField || "endDate";

    // Priority: startDateField > common field names > filename date
    // Note: config.dateField is now "creation date" — not used for event start detection
    let startDate: dayjs.Dayjs | null = null;
    let endDate: dayjs.Dayjs | null = null;

    // Try startDateField first (from config)
    if (this.config.startDateField && record.values[this.config.startDateField] !== undefined) {
      startDate = parseDateInTimezone(record.values[this.config.startDateField], this.timezone);
    }
    // Try common field names in priority order
    else {
      const commonDateFields = ["startDate", "date", "deadline", "dueDate", "scheduled"];
      for (const fieldName of commonDateFields) {
        if (record.values[fieldName] !== undefined) {
          startDate = parseDateInTimezone(record.values[fieldName], this.timezone);
          if (startDate) break;
        }
      }
    }

    // Last resort: extract date from filename (e.g. "2025-01-15.md", "folder/2025-01-15 Meeting.md")
    if (!startDate) {
      startDate = this.extractDateFromFilename(record.id);
    }

    // Extract end date
    if (record.values[endFieldName] !== undefined) {
      endDate = parseDateInTimezone(record.values[endFieldName], this.timezone);
    }
    // Also try common end date field names
    else {
      const commonEndFields = ["endDate", "end", "due"];
      for (const fieldName of commonEndFields) {
        if (record.values[fieldName] !== undefined) {
          endDate = parseDateInTimezone(record.values[fieldName], this.timezone);
          if (endDate) break;
        }
      }
    }

    return { startDate, endDate };
  }

  /**
   * Extract a date from a filename/path.
   * Supports patterns:
   *   - "2025-01-15.md"
   *   - "folder/2025-01-15.md"
   *   - "2025-01-15 Meeting Notes.md"
   *   - "Daily/2025-01-15 - Review.md"
   *   - "20250115.md" (no separators)
   *   - "2025.01.15.md" (dot separators)
   */
  private extractDateFromFilename(recordId: string): dayjs.Dayjs | null {
    // Get basename without extension
    const lastSlash = recordId.lastIndexOf("/");
    const basename = lastSlash >= 0 ? recordId.slice(lastSlash + 1) : recordId;
    const nameWithoutExt = basename.replace(/\.[^.]+$/, "");

    // Try YYYY-MM-DD or YYYY.MM.DD at start of filename
    const separatedMatch = nameWithoutExt.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (separatedMatch) {
      const dateStr = `${separatedMatch[1]}-${separatedMatch[2]}-${separatedMatch[3]}`;
      const parsed = parseDateInTimezone(dateStr, this.timezone);
      if (parsed) return parsed;
    }

    // Try YYYYMMDD at start of filename (8 digits, no separators)
    const compactMatch = nameWithoutExt.match(/^(\d{4})(\d{2})(\d{2})/);
    if (compactMatch) {
      const dateStr = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
      const parsed = parseDateInTimezone(dateStr, this.timezone);
      if (parsed) return parsed;
    }

    return null;
  }

  /**
   * Extract time information from record
   * Implements TIME_PRIORITY_LOGIC: date field time > separate time field
   */
  private extractTimeInfo(
    record: DataRecord,
    startDate: dayjs.Dayjs,
    endDate: dayjs.Dayjs
  ): TimeInfo | null {
    const startFieldName = this.config.startDateField || "startDate";
    const endFieldName = this.config.endDateField || "endDate";
    const startTimeFieldName = this.config.startTimeField || "startTime";
    const endTimeFieldName = this.config.endTimeField || "endTime";

    // Check if date fields have embedded time
    const startHasEmbeddedTime = hasTimeComponent(record.values[startFieldName]);
    const endHasEmbeddedTime = hasTimeComponent(record.values[endFieldName]);

    // Extract separate time fields (only used if no embedded time)
    const separateStartTime = !startHasEmbeddedTime
      ? extractTimeWithPriority(record, startTimeFieldName)
      : null;
    const separateEndTime = !endHasEmbeddedTime
      ? extractTimeWithPriority(record, endTimeFieldName)
      : null;

    // Determine if we have ANY time data
    const hasAnyTime = startHasEmbeddedTime || separateStartTime !== null;

    if (!hasAnyTime) {
      return null; // All-day event
    }

    // Build start time
    let startTime = startDate.clone();
    if (!startHasEmbeddedTime && separateStartTime) {
      const timeParts = separateStartTime.split(":").map(Number);
      const hours = timeParts[0] ?? 0;
      const minutes = timeParts[1] ?? 0;
      startTime = startTime.hour(hours).minute(minutes).second(0);
    }

    // Build end time
    let endTime = endDate.clone();
    if (!endHasEmbeddedTime && separateEndTime) {
      const timeParts = separateEndTime.split(":").map(Number);
      const hours = timeParts[0] ?? 0;
      const minutes = timeParts[1] ?? 0;
      endTime = endTime.hour(hours).minute(minutes).second(0);
    } else if (!endHasEmbeddedTime && !separateEndTime) {
      // No end time specified - default to start + 1 hour
      endTime = startTime.add(1, "hour");
    }

    // Handle overnight events (e.g., 23:00-01:00 or 22:00-08:00)
    // If endTime appears before startTime on the same calendar day,
    // and both are single-day events, this is likely overnight
    if (startDate.isSame(endDate, "day") && endTime.isBefore(startTime)) {
      // Check if it's a reasonable overnight event
      // Case 1: Classic overnight (23:00-01:00) - start >= 12, end < 12
      // Case 2: Morning overnight (10:00-08:00) - both before 12, end < start
      // Case 3: Any case where end hour is less than start hour
      if (endTime.hour() < startTime.hour()) {
        // Move end time to next day
        endTime = endTime.add(1, "day");
      } else if (endTime.hour() === startTime.hour() && endTime.minute() < startTime.minute()) {
        // Edge case: same hour but earlier minutes (e.g., 10:30-10:15)
        endTime = endTime.add(1, "day");
      } else {
        // Fallback: extend to +1 hour if times don't make sense
        endTime = startTime.add(1, "hour");
      }
    }
    
    // Handle same time (default to 1 hour duration)
    if (endTime.isSame(startTime)) {
      endTime = startTime.add(1, "hour");
    }

    const durationMinutes = endTime.diff(startTime, "minute");

    return {
      startTime,
      endTime,
      durationMinutes,
      hasEmbeddedTime: startHasEmbeddedTime,
    };
  }

  /**
   * Determine how to render this event
   */
  private determineRenderType(
    startDate: dayjs.Dayjs | null,
    endDate: dayjs.Dayjs | null,
    hasTime: boolean
  ): EventRenderType {
    // Use effective dates
    const effectiveStart = startDate || endDate!;
    const effectiveEnd = endDate || startDate!;

    // Check if multi-day
    const isMultiDay = !effectiveStart.isSame(effectiveEnd, "day");

    if (isMultiDay) {
      return hasTime ? EventRenderType.MULTI_DAY_TIMED : EventRenderType.MULTI_DAY_ALLDAY;
    } else {
      return hasTime ? EventRenderType.TIMED : EventRenderType.ALL_DAY;
    }
  }

  /**
   * Calculate span information for multi-day events
   */
  private calculateSpanInfo(
    startDate: dayjs.Dayjs,
    endDate: dayjs.Dayjs
  ): SpanInfo | null {
    // Defensive: swap if dates are inverted (endDate < startDate)
    let effectiveStart = startDate;
    let effectiveEnd = endDate;
    if (endDate.isBefore(startDate)) {
      effectiveStart = endDate;
      effectiveEnd = startDate;
    }
    
    const startDay = effectiveStart.startOf("day");
    const endDay = effectiveEnd.startOf("day");

    if (startDay.isSame(endDay, "day")) {
      return null; // Single day, no span
    }

    const spanDays = endDay.diff(startDay, "day") + 1;

    // v4.0.5: Cap span to 365 days — absurdly long spans (e.g. from epoch dates)
    // freeze the calendar by generating thousands of grouped entries.
    if (spanDays > 365) {
      return {
        startDate: startDay,
        endDate: startDay.add(364, "day"),
        spanDays: 365,
      };
    }

    return {
      startDate: startDay,
      endDate: endDay,
      spanDays,
    };
  }

  /**
   * Extract color from eventColorField or getRecordColor callback
   */
  private extractColor(record: DataRecord): string | null {
    // Priority 1: eventColorField from frontmatter
    const colorFieldName = this.config.eventColorField || "eventColor";
    const frontmatterColor = extractEventColor(record, colorFieldName);
    if (frontmatterColor) {
      return frontmatterColor;
    }

    // Priority 2: Also check "color" field as fallback
    const fallbackColor = extractEventColor(record, "color");
    if (fallbackColor) {
      return fallbackColor;
    }

    // Priority 3: getRecordColor callback (from Board integration)
    if (this.getRecordColor) {
      return this.getRecordColor(record);
    }

    return null;
  }

  /**
   * Assign lanes to header events (all-day and multi-day)
   * 
   * Lane assignment ensures events on the same day don't overlap visually.
   * Events spanning multiple days get the SAME lane across all days
   * to create the illusion of a continuous bar.
   * 
   * Algorithm: Greedy lane assignment with proper overlap detection
   * - Sort by start date, then by duration (longer first)
   * - For each event, find first available lane
   * - "Available" = no event in that lane overlaps this event's dates
   * - v6.3: Fixed overlap detection to check full date range
   */
  private assignLanes(processed: ProcessedRecord[]): void {
    // Filter header events (all-day and multi-day)
    const headerEvents = processed.filter(
      (pr) =>
        pr.renderType === EventRenderType.ALL_DAY ||
        pr.renderType === EventRenderType.MULTI_DAY_ALLDAY ||
        pr.renderType === EventRenderType.MULTI_DAY_TIMED
    );

    // Sort: earlier start first, then longer duration first
    headerEvents.sort((a, b) => {
      const aStart = a.startDate || a.endDate;
      const bStart = b.startDate || b.endDate;
      if (!aStart && !bStart) return 0;
      if (!aStart) return 1;
      if (!bStart) return -1;
      
      const startDiff = aStart.valueOf() - bStart.valueOf();
      if (startDiff !== 0) return startDiff;

      const aDuration = a.spanInfo?.spanDays ?? 1;
      const bDuration = b.spanInfo?.spanDays ?? 1;
      return bDuration - aDuration;
    });

    // Use numeric timestamps for fast overlap checks (no dayjs per comparison)
    interface LaneEvent {
      startMs: number;
      endMs: number;
    }
    const laneEvents: LaneEvent[][] = [];

    for (const event of headerEvents) {
      if (!event.startDate && !event.endDate) {
        event.lane = 0;
        continue;
      }
      
      const eventStartMs = (event.startDate || event.endDate!).startOf("day").valueOf();
      const eventEndMs = (event.endDate || event.startDate!).startOf("day").valueOf();

      // Find first available lane (no overlap)
      let assignedLane = -1;
      for (let i = 0; i < laneEvents.length; i++) {
        const eventsInLane = laneEvents[i];
        if (!eventsInLane) continue;
        
        let hasOverlap = false;
        for (const existing of eventsInLane) {
          // Ranges intersect if eventStart <= existingEnd AND eventEnd >= existingStart
          if (eventStartMs <= existing.endMs && eventEndMs >= existing.startMs) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          assignedLane = i;
          break;
        }
      }

      if (assignedLane === -1) {
        assignedLane = laneEvents.length;
        laneEvents.push([]);
      }
      
      const targetLane = laneEvents[assignedLane];
      if (targetLane) {
        targetLane.push({ startMs: eventStartMs, endMs: eventEndMs });
      }

      event.lane = assignedLane;
    }
  }

  /**
   * Group processed records by date (YYYY-MM-DD)
   * 
   * Multi-day events appear in EACH day they span.
   */
  private groupByDate(processed: ProcessedRecord[]): Record<string, ProcessedRecord[]> {
    const grouped: Record<string, ProcessedRecord[]> = {};

    for (const pr of processed) {
      const startDay = (pr.startDate || pr.endDate!).startOf("day");
      const endDay = (pr.endDate || pr.startDate!).startOf("day");

      // Fast path: single-day events (most common case, skip loop overhead)
      if (startDay.isSame(endDay, "day")) {
        const dateStr = startDay.format("YYYY-MM-DD");
        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(pr);
        continue;
      }

      // Multi-day: use native Date arithmetic (5-10x faster than dayjs per iteration)
      // Extract calendar date components from timezone-aware dayjs objects
      const cursor = new Date(Date.UTC(startDay.year(), startDay.month(), startDay.date()));
      const endMs = Date.UTC(endDay.year(), endDay.month(), endDay.date());
      const maxDays = 90;
      let guard = 0;

      while (cursor.getTime() <= endMs && guard < maxDays) {
        const y = cursor.getUTCFullYear();
        const m = cursor.getUTCMonth() + 1;
        const d = cursor.getUTCDate();
        const dateStr = `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;

        if (!grouped[dateStr]) grouped[dateStr] = [];
        grouped[dateStr].push(pr);

        cursor.setUTCDate(d + 1);
        guard++;
      }
      
      if (guard >= maxDays) {
        calendarLogger.warn(
          `[Calendar] Event "${pr.record?.id || 'unknown'}" spans more than ${maxDays} days and was truncated. ` +
          `Start: ${startDay.format('YYYY-MM-DD')}, End: ${endDay.format('YYYY-MM-DD')}`
        );
      }
    }

    return grouped;
  }
}

/**
 * Helper function to create processor and process data
 * Use this in CalendarView.svelte
 */
export function processCalendarData(
  frame: DataFrame,
  config: CalendarConfig,
  getRecordColor?: (record: DataRecord) => string | null
): ProcessedCalendarData {
  const processor = new CalendarDataProcessor(config, getRecordColor);
  return processor.process(frame);
}

/**
 * Get header plaques for a specific date
 */
export function getHeaderPlaquesForDate(
  date: dayjs.Dayjs,
  grouped: Record<string, ProcessedRecord[]>
): ProcessedRecord[] {
  const dateStr = date.format("YYYY-MM-DD");
  const records = grouped[dateStr] ?? [];

  // Filter only header events (all-day and multi-day)
  return records.filter(
    (pr) =>
      pr.renderType === EventRenderType.ALL_DAY ||
      pr.renderType === EventRenderType.MULTI_DAY_ALLDAY ||
      pr.renderType === EventRenderType.MULTI_DAY_TIMED
  );
}

/**
 * Get timeline events for a specific date
 */
export function getTimelineEventsForDate(
  date: dayjs.Dayjs,
  grouped: Record<string, ProcessedRecord[]>
): ProcessedRecord[] {
  const dateStr = date.format("YYYY-MM-DD");
  const records = grouped[dateStr] ?? [];

  // Filter only timed events
  return records.filter(
    (pr) =>
      pr.renderType === EventRenderType.TIMED ||
      pr.renderType === EventRenderType.MULTI_DAY_TIMED
  );
}

/**
 * Calculate timeline columns for overlapping events
 * 
 * Events that overlap in time are placed in adjacent columns.
 * Each column gets equal width = 100% / totalColumns.
 */
export function calculateTimelineColumns(
  timedEvents: ProcessedRecord[],
  startHour: number,
  endHour: number
): { events: ProcessedRecord[]; columns: Map<string, { index: number; total: number }> } {
  if (timedEvents.length === 0) {
    return { events: [], columns: new Map() };
  }

  // Sort by start time
  const sorted = [...timedEvents].sort((a, b) => {
    if (!a.timeInfo || !b.timeInfo) return 0;
    return a.timeInfo.startTime.diff(b.timeInfo.startTime);
  });

  // Build overlap groups
  const groups: ProcessedRecord[][] = [];
  let currentGroup: ProcessedRecord[] = [];
  let groupEndTime: dayjs.Dayjs | null = null;

  for (const event of sorted) {
    if (!event.timeInfo) continue;

    const eventStart = event.timeInfo.startTime;
    const eventEnd = event.timeInfo.endTime;

    if (!groupEndTime || eventStart.isBefore(groupEndTime)) {
      // Overlaps with current group
      currentGroup.push(event);
      if (!groupEndTime || eventEnd.isAfter(groupEndTime)) {
        groupEndTime = eventEnd;
      }
    } else {
      // No overlap - start new group
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [event];
      groupEndTime = eventEnd;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Assign column indices within each group
  const columns = new Map<string, { index: number; total: number }>();

  for (const group of groups) {
    const totalColumns = group.length;
    group.forEach((event, index) => {
      columns.set(event.record.id, { index, total: totalColumns });
    });
  }

  return { events: sorted, columns };
}

/**
 * Calculate top offset for timeline bar (rem)
 */
export function calculateTimelineTop(
  timeInfo: TimeInfo,
  startHour: number,
  hourHeight: number
): number {
  const eventHour = timeInfo.startTime.hour();
  const eventMinute = timeInfo.startTime.minute();
  const offsetMinutes = (eventHour - startHour) * 60 + eventMinute;
  return (offsetMinutes / 60) * hourHeight;
}

/**
 * Calculate height for timeline bar (rem)
 */
export function calculateTimelineHeight(
  timeInfo: TimeInfo,
  hourHeight: number,
  minHeight: number,
  maxHeight: number
): number {
  const baseHeight = (timeInfo.durationMinutes / 60) * hourHeight;
  return Math.max(minHeight, Math.min(baseHeight, maxHeight));
}

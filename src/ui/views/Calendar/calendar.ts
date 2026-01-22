import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { get } from "svelte/store";

import type { DataRecord } from "src/lib/dataframe/dataframe";
import { i18n } from "src/lib/stores/i18n";
import type { FirstDayOfWeek } from "src/settings/settings";
import type { ZoomLevel } from "./types";

dayjs.extend(utc);
dayjs.extend(timezone);

export type CalendarInterval = "year" | "month" | "2weeks" | "week" | "day";

export function isCalendarInterval(value: string): value is CalendarInterval {
  switch (value) {
    case "year":
    case "month":
    case "2weeks":
    case "week":
    case "day":
      return true;
    default:
      return false;
  }
}

export function addInterval(
  date: dayjs.Dayjs,
  interval: CalendarInterval
): dayjs.Dayjs {
  switch (interval) {
    case "year":
      return date.add(1, "year");
    case "month":
      return date.add(1, "month");
    case "2weeks":
      return date.add(2, "week");
    case "week":
      return date.add(1, "week");
    case "day":
      return date.add(1, "day");
  }
}

export function subtractInterval(
  date: dayjs.Dayjs,
  interval: CalendarInterval
): dayjs.Dayjs {
  switch (interval) {
    case "year":
      return date.subtract(1, "year");
    case "month":
      return date.subtract(1, "month");
    case "2weeks":
      return date.subtract(2, "week");
    case "week":
      return date.subtract(1, "week");
    case "day":
      return date.subtract(1, "day");
  }
}

export function parseDateInTimezone(
  value: unknown,
  tz?: string
): dayjs.Dayjs | null {
  if (!value) return null;
  const targetTz = tz && tz !== "local" ? tz : undefined;
  const parsed = targetTz
    ? dayjs.tz(value as string | Date, targetTz)
    : dayjs(value as string | Date);

  return parsed.isValid() ? parsed : null;
}

export function groupRecordsByRange(
  records: DataRecord[],
  startField: string,
  endField?: string,
  tz?: string,
  maxSpanDays = 365
): Record<string, DataRecord[]> {
  const res: Record<string, DataRecord[]> = {};

  records.forEach((record) => {
    const start = parseDateInTimezone(record.values[startField], tz);
    if (!start) return;

    const endValue = endField ? record.values[endField] : undefined;
    const parsedEnd = endField ? parseDateInTimezone(endValue, tz) : null;

    const startDay = start.startOf("day");
    const endDay = parsedEnd?.isValid()
      ? parsedEnd.startOf("day")
      : startDay;

    const rangeEnd = endDay.isBefore(startDay) ? startDay : endDay;

    let cursor = startDay;
    let guard = 0;

    while (cursor.isSame(rangeEnd, "day") || cursor.isBefore(rangeEnd)) {
      const dateStr = cursor.format("YYYY-MM-DD");
      if (!(dateStr in res)) {
        res[dateStr] = [];
      }
      res[dateStr]?.push(record);

      cursor = cursor.add(1, "day");
      guard += 1;

      if (guard > maxSpanDays) {
        break;
      }
    }
  });

  return res;
}

export function groupRecordsByField(
  records: DataRecord[],
  field: string,
  tz?: string
): Record<string, DataRecord[]> {
  return groupRecordsByRange(records, field, undefined, tz);
}

export function computeDateInterval(
  anchor: dayjs.Dayjs,
  interval: CalendarInterval,
  firstDayOfWeek: number
): [dayjs.Dayjs, dayjs.Dayjs] {
  const sow = startOfWeek(anchor, firstDayOfWeek);
  const eow = endOfWeek(anchor, firstDayOfWeek);
  switch (interval) {
    case "year":
      return [
        anchor.startOf("year"),
        anchor.endOf("year"),
      ];
    case "month":
      return [
        startOfWeek(anchor.startOf("month"), firstDayOfWeek),
        endOfWeek(anchor.endOf("month"), firstDayOfWeek),
      ];
    case "2weeks":
      return [sow, eow.add(1, "week")];
    case "week":
      return [sow, eow];
    case "day":
      return [anchor, anchor];
  }
}

export function generateTitle(dateInterval: [dayjs.Dayjs, dayjs.Dayjs]) {
  if (dateInterval[0].startOf("day").isSame(dateInterval[1].startOf("day"))) {
    return get(i18n).t("views.calendar.date", {
      value: dateInterval[0],
      formatParams: {
        value: { year: "numeric", month: "long", day: "numeric" },
      },
    });
  }

  if (dateInterval[0].startOf("year").isSame(dateInterval[1].startOf("year"))) {
    return get(i18n).t("views.calendar.interval", {
      from: dateInterval[0],
      to: dateInterval[1],
      en_separator: ", ",
      custom_year: dateInterval[0],
      formatParams: {
        from: { month: "short", day: "numeric" },
        to: { month: "short", day: "numeric" },
        custom_year: { year: "numeric" },
      },
    });
  }

  return get(i18n).t("views.calendar.interval", {
    from: dateInterval[0],
    to: dateInterval[1],
    en_separator: "",
    custom_year: "",
    formatParams: {
      from: { year: "numeric", month: "short", day: "numeric" },
      to: { year: "numeric", month: "short", day: "numeric" },
      custom_year: { year: false },
    },
  });
}

export function generateDates(
  dateInterval: [dayjs.Dayjs, dayjs.Dayjs]
): dayjs.Dayjs[] {
  const dates: dayjs.Dayjs[] = [];

  const numDays = dateInterval[1].diff(dateInterval[0], "days");

  for (let i = 0; i <= numDays; i++) {
    dates.push(dateInterval[0].add(i, "day"));
  }

  return dates;
}

export function chunkDates(
  dates: dayjs.Dayjs[],
  chunks: number
): dayjs.Dayjs[][] {
  const chunkedDates: dayjs.Dayjs[][] = [];

  let rest = dates;
  while (rest.length) {
    const chunked = take(rest, chunks);

    chunkedDates.push(chunked);

    rest = rest.slice(chunked.length);
  }

  return chunkedDates;
}

function take<T>(arr: Array<T>, num: number): Array<T> {
  const buffer: Array<T> = [];
  for (let i = 0; i < num && i < arr.length; i++) {
    const el = arr[i];

    if (el) {
      buffer.push(el);
    }
  }
  return buffer;
}

export function startOfWeek(
  date: dayjs.Dayjs,
  firstDayOfWeek: number
): dayjs.Dayjs {
  const offset = (7 + date.day() - firstDayOfWeek) % 7;
  return date.subtract(offset, "days");
}

export function endOfWeek(
  date: dayjs.Dayjs,
  firstDayOfWeek: number
): dayjs.Dayjs {
  const offset = (firstDayOfWeek + 6 - date.day()) % 7;
  return date.add(offset, "days");
}

export type LocaleOption = "system" | "obsidian";

export function getLocale(locale: LocaleOption): Intl.Locale {
  if (locale === "system") {
    return new Intl.Locale(navigator?.language || "en");
  }

  const obsidianLanguage =
    localStorage.getItem("language") || dayjs().locale();


  return new Intl.Locale(obsidianLanguage);
}

export function getFirstDayOfWeek(day: FirstDayOfWeek): number {
  switch (day) {
    case "sunday":
      return 0;
    case "monday":
      return 1;
    case "default": {
      const obLocale = getLocale("obsidian");
      if (obLocale.weekInfo) {
        return obLocale.weekInfo.firstDay ?? 0;
      }
      if (typeof obLocale.getWeekInfo === "function") {
        return obLocale.getWeekInfo().firstDay ?? 0;
      }
      return 0;
    }
  }
}

// Zoom functionality utilities
export const ZOOM_HIERARCHY: ZoomLevel[] = [
  { interval: "year", order: -1 },
  { interval: "month", order: 0 },
  { interval: "2weeks", order: 1 },
  { interval: "week", order: 2 },
  { interval: "day", order: 3 }
];

/**
 * Get the next zoom level in the hierarchy
 */
export function getNextZoomLevel(current: CalendarInterval): CalendarInterval {
  const currentIndex = ZOOM_HIERARCHY.findIndex(level => level.interval === current);
  const nextIndex = Math.min(currentIndex + 1, ZOOM_HIERARCHY.length - 1);
  const nextLevel = ZOOM_HIERARCHY[nextIndex];
  return nextLevel ? nextLevel.interval : current;
}

/**
 * Get the previous zoom level in the hierarchy
 */
export function getPreviousZoomLevel(current: CalendarInterval): CalendarInterval {
  const currentIndex = ZOOM_HIERARCHY.findIndex(level => level.interval === current);
  const prevIndex = Math.max(currentIndex - 1, 0);
  const prevLevel = ZOOM_HIERARCHY[prevIndex];
  return prevLevel ? prevLevel.interval : current;
}

/**
 * Get zoom level based on wheel delta and current interval
 */
export function getZoomLevelFromWheel(
  current: CalendarInterval,
  deltaY: number
): CalendarInterval {
  // Negative deltaY means zoom in (mouse wheel up)
  // Positive deltaY means zoom out (mouse wheel down)
  return deltaY < 0 ? getNextZoomLevel(current) : getPreviousZoomLevel(current);
}

/**
 * Extract date from mouse position relative to calendar element with enhanced error handling
 */
export function getDateFromMousePosition(
  mouseX: number,
  mouseY: number,
  calendarElement: HTMLElement,
  interval: CalendarInterval,
  anchorDate: dayjs.Dayjs,
  firstDayOfWeek: number
): dayjs.Dayjs {
  if (!calendarElement || !calendarElement.getBoundingClientRect) {
    return anchorDate; // Return fallback if element is invalid
  }

  const rect = calendarElement.getBoundingClientRect();
  const relativeX = Math.max(0, Math.min(mouseX - rect.left, rect.width));
  const relativeY = Math.max(0, Math.min(mouseY - rect.top, rect.height));

  switch (interval) {
    case "year": {
      // For year view, calculate based on month position
      // Year view typically shows 12 months in a 4x3 or 3x4 grid
      const monthWidth = rect.width / 4; // 4 columns
      const monthHeight = rect.height / 3; // 3 rows
      
      if (monthWidth <= 0 || monthHeight <= 0) {
        return anchorDate;
      }
      
      const rowIndex = Math.max(0, Math.min(Math.floor(relativeY / monthHeight), 2));
      const colIndex = Math.max(0, Math.min(Math.floor(relativeX / monthWidth), 3));
      const monthIndex = rowIndex * 4 + colIndex;
      
      return anchorDate.startOf("year").add(monthIndex, "month");
    }
    
    case "month": {
      // For month view, calculate based on day cells
      const dayWidth = rect.width / 7; // 7 days per week
      const dayHeight = rect.height / 6; // 6 weeks per month grid
      
      // Prevent division by zero
      if (dayWidth <= 0 || dayHeight <= 0) {
        return anchorDate;
      }
      
      const weekIndex = Math.max(0, Math.min(Math.floor(relativeY / dayHeight), 5));
      const dayIndex = Math.max(0, Math.min(Math.floor(relativeX / dayWidth), 6));
      
      const startOfGrid = startOfWeek(anchorDate.startOf("month"), firstDayOfWeek);
      const targetDate = startOfGrid.add(weekIndex * 7 + dayIndex, "day");
      
      return targetDate;
    }
    
    case "2weeks":
    case "week": {
      // For week views, calculate based on day columns
      const dayWidth = rect.width / 7;
      
      // Prevent division by zero
      if (dayWidth <= 0) {
        return anchorDate;
      }
      
      const dayIndex = Math.max(0, Math.min(Math.floor(relativeX / dayWidth), 6));
      
      const startOfGrid = startOfWeek(anchorDate, firstDayOfWeek);
      return startOfGrid.add(dayIndex, "day");
    }
    
    case "day": {
      // For day views, return the anchor date (no cursor-based navigation)
      return anchorDate;
    }
    
    default:
      return anchorDate;
  }
}

/**
 * Check if zoom gesture should be applied with enhanced validation
 */
export function shouldApplyZoom(
  event: WheelEvent,
  target: HTMLElement
): boolean {
  // Only apply zoom when Ctrl is pressed and we're not over interactive elements
  const hasCtrlKey = event.ctrlKey || event.metaKey;
  const isInteractiveElement = target?.closest?.('input, textarea, select, button, [role="button"]') !== null;
  
  // Additional validation for empty or invalid targets
  if (!target) {
    return false;
  }
  
  return hasCtrlKey && !isInteractiveElement;
}

/**
 * Validate zoom parameters to prevent errors
 */
export function validateZoomParams(
  current: CalendarInterval,
  newInterval: CalendarInterval,
  anchorDate: dayjs.Dayjs
): { isValid: boolean; error?: string } {
  if (!current || !newInterval || !anchorDate?.isValid) {
    return { isValid: false, error: "Invalid zoom parameters" };
  }

  if (!ZOOM_HIERARCHY.find(level => level.interval === current)) {
    return { isValid: false, error: "Current interval not in hierarchy" };
  }

  if (!ZOOM_HIERARCHY.find(level => level.interval === newInterval)) {
    return { isValid: false, error: "New interval not in hierarchy" };
  }

  return { isValid: true };
}

/**
 * Get zoom level display information
 */
export function getZoomLevelInfo(interval: CalendarInterval): { name: string; description: string } {
  switch (interval) {
    case "year":
      return { name: "Year", description: "Year heatmap overview" };
    case "month":
      return { name: "Month", description: "Full month overview" };
    case "2weeks":
      return { name: "2 Weeks", description: "Bi-weekly view" };
    case "week":
      return { name: "Week", description: "Weekly view" };
    case "day":
      return { name: "Day", description: "Single day view" };
    default:
      return { name: "Unknown", description: "Invalid interval" };
  }
}



export function generateMonthTitle(month: dayjs.Dayjs): string {
  return month.format("MMMM YYYY");
}

export interface DayCell {
  date: dayjs.Dayjs;
  isOutsideMonth: boolean;
}

export function generateMonthGrid(
  monthStart: dayjs.Dayjs,
  firstDayOfWeek: number
): DayCell[][] {
  const year = monthStart.year();
  const mon = monthStart.month();
  const firstDay = dayjs(new Date(year, mon, 1));
  const startOfGrid = startOfWeek(firstDay, firstDayOfWeek);
  const grid: DayCell[][] = [];
  let current = startOfGrid.clone();
  for (let week = 0; week < 6; week++) {
    const row: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = current.add(d, "day");
      row.push({
        date,
        isOutsideMonth: date.month() !== mon
      });
    }
    grid.push(row);
    current = current.add(7, "day");
  }
  return grid;
}

/**
 * Extract date value from record with field priority logic (v3.0.0).
 * Priority order (ROADMAP_V3.0.0.md):
 * 1. If startDateField exists → use it (new field)
 * 2. If dateField exists → use it (legacy field)
 * 3. If endDateField only → use it as deadline
 * 4. Return null (no date found)
 */
export function extractDateWithPriority(
  record: DataRecord,
  startDateField?: string,
  dateField?: string,
  endDateField?: string,
  timezone: string = "local"
): dayjs.Dayjs | null {
  // Priority 1: NEW field startDateField (default: "startDate")
  const startFieldName = startDateField || "startDate";
  if (record.values[startFieldName] !== undefined) {
    return parseDateInTimezone(record.values[startFieldName], timezone);
  }

  // Priority 2: LEGACY field dateField (default: "date")
  const legacyFieldName = dateField || "date";
  if (record.values[legacyFieldName] !== undefined) {
    return parseDateInTimezone(record.values[legacyFieldName], timezone);
  }

  // Priority 3: endDateField only (use as deadline)
  const endFieldName = endDateField || "endDate";
  if (record.values[endFieldName] !== undefined) {
    return parseDateInTimezone(record.values[endFieldName], timezone);
  }

  // No date found
  return null;
}

/**
 * Extract end date value from record with field priority logic (v3.0.0).
 * If endDateField exists → use it, otherwise return null.
 */
export function extractEndDateWithPriority(
  record: DataRecord,
  endDateField?: string,
  timezone: string = "local"
): dayjs.Dayjs | null {
  const endFieldName = endDateField || "endDate";
  const value = record.values[endFieldName];
  return value !== undefined && value !== null
    ? parseDateInTimezone(value, timezone)
    : null;
}

/**
 * Extract time value from record (v3.0.0).
 * Returns time string in "HH:mm" format (24-hour) or null.
 * 
 * Validation:
 * - Must be string format "HH:mm" (e.g., "09:30", "14:00", "23:59")
 * - Hours: 00-23, Minutes: 00-59
 * - No timezone info (timezone applied at dayjs combination stage)
 * 
 * Priority:
 * 1. Use provided timeField parameter
 * 2. Default to "startTime" if not provided
 * 
 * @example
 * extractTimeWithPriority(record, "startTime") → "09:30" | null
 * extractTimeWithPriority(record, "endTime") → "17:00" | null
 */
export function extractTimeWithPriority(
  record: DataRecord,
  timeField?: string
): string | null {
  const fieldName = timeField || "startTime";
  const value = record.values[fieldName];
  
  // Validate HH:mm format
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    // Additional validation: hours 00-23, minutes 00-59
    const parts = value.split(':');
    if (parts.length === 2) {
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      if (!isNaN(hours) && !isNaN(minutes) && 
          hours >= 0 && hours <= 23 && 
          minutes >= 0 && minutes <= 59) {
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Extract event color from record (v3.0.0).
 * Returns hex color string (e.g., "#FF5733") or null.
 */
export function extractEventColor(
  record: DataRecord,
  colorField?: string
): string | null {
  const fieldName = colorField || "eventColor";
  const value = record.values[fieldName];
  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value;
  }
  return null;
}

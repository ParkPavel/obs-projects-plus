import dayjs from "dayjs";
import { get } from "svelte/store";

import { isDate, type DataRecord } from "src/lib/dataframe/dataframe";
import { i18n } from "src/lib/stores/i18n";
import type { FirstDayOfWeek } from "src/settings/settings";
import type { ZoomLevel } from "./types";

export type CalendarInterval = "month" | "2weeks" | "week" | "3days" | "day";

export function isCalendarInterval(value: string): value is CalendarInterval {
  switch (value) {
    case "month":
    case "2weeks":
    case "week":
    case "3days":
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
    case "month":
      return date.add(1, "month");
    case "2weeks":
      return date.add(2, "week");
    case "week":
      return date.add(1, "week");
    case "3days":
      return date.add(1, "day");
    case "day":
      return date.add(1, "day");
  }
}

export function subtractInterval(
  date: dayjs.Dayjs,
  interval: CalendarInterval
): dayjs.Dayjs {
  switch (interval) {
    case "month":
      return date.subtract(1, "month");
    case "2weeks":
      return date.subtract(2, "week");
    case "week":
      return date.subtract(1, "week");
    case "3days":
      return date.subtract(1, "day");
    case "day":
      return date.subtract(1, "day");
  }
}

export function groupRecordsByField(
  records: DataRecord[],
  field: string
): Record<string, DataRecord[]> {
  const res: Record<string, DataRecord[]> = {};

  records.forEach((record) => {
    const dateValue = record.values[field];

    const start = dateValue
      ? isDate(dateValue)
        ? dayjs(dateValue)
        : null
      : null;

    if (start) {
      const dateStr = start.format("YYYY-MM-DD");
      if (!(dateStr in res)) {
        res[dateStr] = [];
      }

      res[dateStr]?.push(record);
    }
  });

  return res;
}

export function computeDateInterval(
  anchor: dayjs.Dayjs,
  interval: CalendarInterval,
  firstDayOfWeek: number
): [dayjs.Dayjs, dayjs.Dayjs] {
  const sow = startOfWeek(anchor, firstDayOfWeek);
  const eow = endOfWeek(anchor, firstDayOfWeek);
  switch (interval) {
    case "month":
      return [
        startOfWeek(anchor.startOf("month"), firstDayOfWeek),
        endOfWeek(anchor.endOf("month"), firstDayOfWeek),
      ];
    case "2weeks":
      return [sow, eow.add(1, "week")];
    case "week":
      return [sow, eow];
    case "3days":
      return [anchor, anchor.add(2, "days")];
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
  { interval: "month", order: 0 },
  { interval: "2weeks", order: 1 },
  { interval: "week", order: 2 },
  { interval: "3days", order: 3 },
  { interval: "day", order: 4 }
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
    
    case "3days":
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
    case "month":
      return { name: "Month", description: "Full month overview" };
    case "2weeks":
      return { name: "2 Weeks", description: "Bi-weekly view" };
    case "week":
      return { name: "Week", description: "Weekly view" };
    case "3days":
      return { name: "3 Days", description: "3-day overview" };
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

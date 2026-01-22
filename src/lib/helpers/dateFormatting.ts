import dayjs from "dayjs";
import type { ProjectDefinition } from "src/settings/settings";
import type { DateFormatConfig } from "src/settings/v3/settings";

/**
 * Parse a date value with flexible format support.
 * Supports timezones and various input formats.
 * 
 * @param value - Date value in any format (string, Date, dayjs, etc.)
 * @param tz - Optional timezone string (e.g., "America/New_York")
 * @returns dayjs object or null if parsing fails
 */
function parseDateInTimezone(
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

/**
 * Default date format configuration (ISO 8601)
 * Used when project has no dateFormat configuration
 */
const DEFAULT_DATE_FORMAT: DateFormatConfig = {
  writeFormat: "YYYY-MM-DD",
  preset: "iso",
};

/**
 * Format a date for writing to frontmatter according to project configuration.
 * This is the PRIMARY formatting function for all date writes.
 * 
 * @param date - dayjs object to format
 * @param project - Project configuration (contains dateFormat)
 * @returns Formatted date string according to project configuration, or null if date is invalid
 * 
 * @example
 * // Project with US format
 * const project = { dateFormat: { writeFormat: "MM/DD/YYYY" } };
 * formatDateForProject(dayjs("2025-01-18"), project); // "01/18/2025"
 * 
 * @example
 * // Project with time inclusion
 * const project = { dateFormat: { writeFormat: "YYYY-MM-DD", includeTime: true } };
 * formatDateForProject(dayjs("2025-01-18 14:30"), project); // "2025-01-18 14:30"
 */
export function formatDateForProject(
  date: dayjs.Dayjs | null,
  project: ProjectDefinition
): string | null {
  if (!date || !date.isValid()) return null;
  
  const config = project.dateFormat ?? DEFAULT_DATE_FORMAT;
  const format = config.writeFormat;
  
  if (config.includeTime) {
    return date.format(`${format} HH:mm`);
  }
  
  return date.format(format);
}

/**
 * Format a date for display in UI according to project configuration.
 * Can be different from storage format.
 * 
 * @param date - dayjs object to format
 * @param project - Project configuration (contains dateFormat)
 * @returns Formatted date string for display, or null if date is invalid
 * 
 * @example
 * // Project with separate display format
 * const project = { 
 *   dateFormat: { 
 *     writeFormat: "YYYY-MM-DD",
 *     displayFormat: "MMM DD, YYYY"
 *   } 
 * };
 * formatDateForDisplay(dayjs("2025-01-18"), project); // "Jan 18, 2025"
 */
export function formatDateForDisplay(
  date: dayjs.Dayjs | null,
  project: ProjectDefinition
): string | null {
  if (!date || !date.isValid()) return null;
  
  const config = project.dateFormat ?? DEFAULT_DATE_FORMAT;
  const format = config.displayFormat ?? config.writeFormat;
  
  if (config.includeTime) {
    return date.format(`${format} HH:mm`);
  }
  
  return date.format(format);
}

/**
 * Format a date for internal use (keys, grouping, collision detection, etc.).
 * ALWAYS returns ISO 8601 format (YYYY-MM-DD) for consistency.
 * NEVER use project configuration here - internal keys must be consistent.
 * 
 * CRITICAL: This function is used for:
 * - Map keys in groupRecordsByRange()
 * - Set keys in collision detection
 * - Date-based indexing throughout the codebase
 * 
 * Changing the format here WILL BREAK existing functionality!
 * 
 * @param date - dayjs object to format
 * @returns ISO 8601 formatted string (YYYY-MM-DD), or null if date is invalid
 * 
 * @example
 * // Internal keys are always ISO 8601, regardless of project format
 * const date = dayjs("2025-01-18");
 * formatDateForInternal(date); // "2025-01-18"
 * 
 * // Even with a US-formatted project
 * const usProject = { dateFormat: { writeFormat: "MM/DD/YYYY" } };
 * formatDateForInternal(date); // Still "2025-01-18"
 */
export function formatDateForInternal(date: dayjs.Dayjs | null): string | null {
  if (!date || !date.isValid()) return null;
  return date.format("YYYY-MM-DD");
}

/**
 * Parse a date value with flexible format support.
 * This wraps parseDateInTimezone for consistency and reusability.
 * 
 * @param value - Date value in any format (string, Date, dayjs, etc.)
 * @param timezone - Optional timezone string (e.g., "America/New_York")
 * @returns dayjs object or null if parsing fails
 * 
 * @example
 * // Parse various formats
 * parseDate("2025-01-18");           // ISO 8601
 * parseDate("01/18/2025");           // US format
 * parseDate("18.01.2025");           // EU format
 * parseDate("2025-01-18 14:30");     // With time
 */
export function parseDate(
  value: unknown,
  timezone?: string
): dayjs.Dayjs | null {
  // Delegate to existing parsing logic from calendar.ts
  return parseDateInTimezone(value, timezone);
}

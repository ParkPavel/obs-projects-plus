import type { Dayjs } from "dayjs";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { CalendarConfig } from "./types";
import { parseDateInTimezone } from "./calendar";
import { filenameDate } from "./calendarFilenameDate";

export type CalendarDateMapping = { [K in "startDateField" | "endDateField" | "timezone"]?: CalendarConfig[K] | undefined };

/** Explicit mappings are authoritative. Unconfigured views retain conventional/filename discovery. */
export function calendarRecordDates(record: DataRecord, mapping: CalendarDateMapping = {}, writeFormat?: string, fallbackStartField = "") {
  const timezone = mapping.timezone ?? "local";
  const parse = (value: unknown): Dayjs | null => parseDateInTimezone(value, timezone, writeFormat);
  function first(names: string[]): Dayjs | null {
    for (const name of names) {
      if (record.values[name] === undefined) continue;
      const parsed = parse(record.values[name]);
      if (parsed) return parsed;
    }
    return null;
  }
  const startDate = mapping.startDateField
    ? mapping.startDateField === "name"
      ? parse(record.values["name"]) ?? filenameDate(record.id, timezone)
      : parse(record.values[mapping.startDateField])
    : first(["startDate", "date", "deadline", "dueDate", "scheduled", fallbackStartField]) ?? filenameDate(record.id, timezone);
  const endDate = mapping.endDateField
    ? parse(record.values[mapping.endDateField])
    : record.values["endDate"] !== undefined ? parse(record.values["endDate"]) : first(["endDate", "end", "due"]);
  return { startDate, endDate };
}

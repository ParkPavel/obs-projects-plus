import type { Dayjs } from "dayjs";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import type { CalendarConfig } from "./types";
import { parseDateInTimezone } from "./calendar";

export type CalendarDateMapping = { [K in "startDateField" | "endDateField" | "timezone"]?: CalendarConfig[K] | undefined };

function filenameDate(id: string, timezone: string): Dayjs | null {
  const basename = id.slice(id.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  const separated = /^(\d{4})[-.](\d{2})[-.](\d{2})/.exec(basename);
  if (separated) {
    const parsed = parseDateInTimezone(`${separated[1]}-${separated[2]}-${separated[3]}`, timezone);
    if (parsed) return parsed;
  }
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(basename);
  return compact ? parseDateInTimezone(`${compact[1]}-${compact[2]}-${compact[3]}`, timezone) : null;
}

/** Explicit mappings are authoritative. Unconfigured views retain conventional/filename discovery. */
export function calendarRecordDates(record: DataRecord, mapping: CalendarDateMapping = {}, writeFormat?: string) {
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
    ? parse(record.values[mapping.startDateField])
    : first(["startDate", "date", "deadline", "dueDate", "scheduled"]) ?? filenameDate(record.id, timezone);
  const endDate = mapping.endDateField
    ? parse(record.values[mapping.endDateField])
    : record.values["endDate"] !== undefined ? parse(record.values["endDate"]) : first(["endDate", "end", "due"]);
  return { startDate, endDate };
}

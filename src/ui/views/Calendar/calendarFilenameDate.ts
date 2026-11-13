import type { Dayjs } from "dayjs";
import { parseDateInTimezone } from "./calendar";

/** Date-bearing note identity, including temporary calendar draft paths. */
export function filenameDate(id: string, timezone: string): Dayjs | null {
  const basename = id.slice(id.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  const separated = /^(\d{4})[-.](\d{2})[-.](\d{2})/.exec(basename);
  if (separated) {
    const parsed = parseDateInTimezone(`${separated[1]}-${separated[2]}-${separated[3]}`, timezone);
    if (parsed) return parsed;
  }
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(basename);
  return compact ? parseDateInTimezone(`${compact[1]}-${compact[2]}-${compact[3]}`, timezone) : null;
}

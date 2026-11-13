import dayjs from "dayjs";

function calendarDay(value: dayjs.Dayjs): number {
  // Local midnight may not exist. Serialize calendar labels in UTC instead;
  // setUTCFullYear also avoids Date.UTC's special handling of years 0–99.
  const utc = new Date(0);
  utc.setUTCFullYear(value.year(), value.month(), value.date());
  return utc.getTime() / 86_400_000;
}

/** Calendar-day interval (earlier,later], with at most six residual weekdays. */
export function workdayDistance(startValue: unknown, endValue: unknown, chargeWork?: (steps: number) => void): number | null {
  const start = dayjs(String(startValue)), end = dayjs(String(endValue));
  if (!start.isValid() || !end.isValid()) return null;
  // Preserve the accepted date range, including its time-of-day rounding.
  if (Math.abs(end.diff(start, "day")) + 1 > 36600) return null;
  const distance = calendarDay(end) - calendarDay(start);
  if (!Number.isFinite(distance)) return null;
  const from = distance < 0 ? end : start, sign = distance < 0 ? -1 : 1;
  const days = Math.abs(distance);
  chargeWork?.(days % 7);
  let count = Math.floor(days / 7) * 5;
  const weekday = from.day();
  for (let i = 1; i <= days % 7; i++) {
    const day = (weekday + i) % 7;
    if (day !== 0 && day !== 6) count++;
  }
  return count === 0 ? 0 : sign * count;
}

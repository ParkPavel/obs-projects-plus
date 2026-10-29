import dayjs from "dayjs";

/** Calendar-day interval (earlier,later], with at most six residual weekdays. */
export function workdayDistance(startValue: unknown, endValue: unknown, chargeWork?: (steps: number) => void): number | null {
  const start = dayjs(String(startValue)), end = dayjs(String(endValue));
  if (!start.isValid() || !end.isValid()) return null;
  // Preserve the accepted date range, including its time-of-day rounding.
  if (Math.abs(end.diff(start, "day")) + 1 > 36600) return null;
  let from = start.startOf("day"), to = end.startOf("day"), sign = 1;
  if (to.isBefore(from)) { [from, to] = [to, from]; sign = -1; }
  const days = to.diff(from, "day");
  chargeWork?.(days % 7);
  let count = Math.floor(days / 7) * 5;
  const weekday = from.day();
  for (let i = 1; i <= days % 7; i++) {
    const day = (weekday + i) % 7;
    if (day !== 0 && day !== 6) count++;
  }
  return count === 0 ? 0 : sign * count;
}

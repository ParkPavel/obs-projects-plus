import { toNumber } from "src/lib/engine/numeric";

// Complete supported date/time forms only; text with a date prefix stays text.
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))?)?$/;

export function comparisonDateTime(value: string): number | undefined {
  const text = value.trim(), parts = ISO.exec(text);
  if (!parts) return undefined;
  const year = toNumber(parts[1])!, month = toNumber(parts[2])!, day = toNumber(parts[3])!;
  const hour = toNumber(parts[4]) ?? 0, minute = toNumber(parts[5]) ?? 0, second = toNumber(parts[6]) ?? 0;
  const milliseconds = toNumber((parts[7] ?? "").padEnd(3, "0")) ?? 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 24 || minute > 59 || second > 59) return undefined;
  if (hour === 24 && (minute !== 0 || second !== 0 || milliseconds !== 0)) return undefined;
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  let instant: number;
  if (parts[8]) {
    if ((toNumber(parts[10]) ?? 0) > 23 || (toNumber(parts[11]) ?? 0) > 59) return undefined;
    // Canonical milliseconds/seconds avoid implementation-dependent partial formats.
    const canonical = `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:${parts[6] ?? "00"}.${(parts[7] ?? "").padEnd(3, "0")}${parts[8]}`;
    instant = Date.parse(canonical);
  } else {
    const local = new Date(0);
    local.setFullYear(year, month - 1, day);
    instant = local.setHours(hour, minute, second, milliseconds);
  }
  return Number.isFinite(instant) ? instant : undefined;
}

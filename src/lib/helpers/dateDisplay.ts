import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { toNumber } from "src/lib/engine/numeric";
import type { DateFormatConfig } from "src/settings/v3/settings";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
type Parts = { y: number; m: number; d: number; time?: [number, number] };

/** The display format a project asks for; none (DD.MM.YYYY) for the ISO storage default. */
export function displayFormatOf(cfg: DateFormatConfig | undefined): string | undefined {
  if (cfg?.displayFormat) return cfg.displayFormat;
  return cfg?.writeFormat && cfg.writeFormat !== "YYYY-MM-DD" ? cfg.writeFormat : undefined;
}

/**
 * i2-table (D14): a date reads as the person writes it — DD.MM.YYYY, or the
 * project's display format — not as the YYYY-MM-DD it is stored in. The day
 * comes from LOCAL getters or from the stored digits, never from a UTC
 * conversion, so a date-only note keeps its calendar day (#158). A value that
 * is no date is shown as written; an unparseable time stamp is parsed only
 * when `withTime` (AutoTime) asks for it.
 */
export function formatDateCell(value: Optional<DataValue>, opts: { withTime: boolean; displayFormat?: string | undefined }): string {
  const parts = partsOf(value, opts.withTime);
  if (parts === "invalid") return "";
  if (!parts) return String(value);
  const p = (n: number) => String(n).padStart(2, "0");
  const f = opts.displayFormat;
  const day = f ? f.replace(/YYYY/g, String(parts.y)).replace(/MM/g, p(parts.m)).replace(/DD/g, p(parts.d)) : `${p(parts.d)}.${p(parts.m)}.${parts.y}`;
  return parts.time ? `${day} ${p(parts.time[0])}:${p(parts.time[1])}` : day;
}

function partsOf(value: Optional<DataValue>, withTime: boolean): Parts | "invalid" | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "invalid";
    const parts: Parts = { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
    return withTime ? { ...parts, time: [value.getHours(), value.getMinutes()] } : parts;
  }
  if (typeof value !== "string") return null;
  const iso = ISO_DAY.exec(value.trim());
  if (!iso) {
    const parsed = withTime ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? partsOf(parsed, true) : null;
  }
  const [y, m, d, hh, mm] = iso.slice(1).map((x) => (x === undefined ? null : toNumber(x)));
  const parts: Parts = { y: y ?? 0, m: m ?? 1, d: d ?? 1 };
  return hh !== null && hh !== undefined ? { ...parts, time: [hh, mm ?? 0] } : parts;
}

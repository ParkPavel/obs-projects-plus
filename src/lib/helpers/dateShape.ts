/**
 * The date a cell editor shows, and the value it writes back (3.7.0 P0-1).
 *
 * A date editor is an `<input type="date">`, and that control speaks exactly
 * one dialect: `YYYY-MM-DD`, or the empty string. A note does not have to.
 * The 3.7.0 report was that dates were "accepted or rolled back
 * unpredictably" and that a manual edit could break the stored format. Two
 * reasons, both here:
 *
 *   - the editor was seeded with `String(value)`. Ingestion parses a date
 *     field into a `Date` (`datasources/helpers.ts`), and `String(date)` is
 *     `"Mon Jan 15 2024 00:00:00 GMT…"`, which the control rejects — it opened
 *     empty, and a blur then wrote the empty string over the date;
 *   - whatever the control produced was written verbatim, so a value with a
 *     time lost its time and `15.01.2024` became `2024-01-15`.
 *
 * `dateInputValue` answers the first: the stored day in the control's dialect.
 * `dateToStore` answers the second: the picked day in the STORED value's shape.
 * A date-only value stays `YYYY-MM-DD`; a value with a time keeps that time
 * and its separator verbatim; a value in another spelling the plugin reads
 * (`DD.MM.YYYY`, `MM/DD/YYYY` or `DD/MM/YYYY`, `YYYY/MM/DD`, `YYYY年MM月DD日` —
 * the write presets in `settings/v3/settings.ts`) is written back in that
 * spelling. An emptied control clears the value. An unchanged day returns the
 * stored value itself, so a blur that changed nothing writes nothing.
 */
import dayjs from "dayjs";

import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { toNumber } from "src/lib/engine/numeric";
import { formatLocalDay } from "./dateFormatting";

type DateFormatConfig = import("src/settings/v3/settings").DateFormatConfig;

/** The only thing an `<input type="date">` produces besides "". */
const INPUT_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A time after the date, kept verbatim: `T10`, `T10:30`, ` 10:30:15.250`,
 * `T10:30:00Z`, `T10:30+03:00`, ` 2:30 PM`. Ingestion types `YYYY-MM-DDTHH`
 * as a date too (`detectCellType`), so the hour alone is a time here.
 */
const TIME_TAIL = String.raw`((?:[T ]\d{1,2}(?::\d{2}(?::\d{2}(?:\.\d+)?)?)?(?:\s?[AaPp][Mm])?(?:Z|[+-]\d{2}:?\d{2})?)?)`;

/** Which group is the year, the month and the day. */
type Order = "ymd" | "dmy" | "mdy";

interface Spelling {
  readonly re: RegExp;
  readonly order: Order;
  /** The three parts in written order, joined the way this spelling joins them. */
  readonly join: (parts: readonly [string, string, string]) => string;
}

function spelling(head: string, order: Order, join: Spelling["join"]): Spelling {
  return { re: new RegExp(`^${head}${TIME_TAIL}$`), order, join };
}

const SPELLINGS: readonly Spelling[] = [
  spelling(String.raw`(\d{4})-(\d{2})-(\d{2})`, "ymd", ([a, b, c]) => `${a}-${b}-${c}`),
  spelling(String.raw`(\d{4})/(\d{1,2})/(\d{1,2})`, "ymd", ([a, b, c]) => `${a}/${b}/${c}`),
  spelling(String.raw`(\d{1,2})\.(\d{1,2})\.(\d{4})`, "dmy", ([a, b, c]) => `${a}.${b}.${c}`),
  // Ambiguous slash dates use the project's write format when available.
  // Legacy projects without a format retain their month-first fallback.
  spelling(String.raw`(\d{1,2})/(\d{1,2})/(\d{4})`, "mdy", ([a, b, c]) => `${a}/${b}/${c}`),
  spelling(String.raw`(\d{4})年(\d{1,2})月(\d{1,2})日`, "ymd", ([a, b, c]) => `${a}年${b}月${c}日`),
];

const pad2 = (part: string): string => part.padStart(2, "0");

/** True when year-month-day names a real calendar day. */
function isCalendarDay(year: string, month: string, day: string): boolean {
  const y = toNumber(year);
  const m = toNumber(month);
  const d = toNumber(day);
  if (y === null || m === null || d === null || m < 1 || m > 12 || d < 1) return false;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last;
}

/**
 * Slash order follows the project's day-first format when selected. Without
 * that context, legacy month-first parsing and the above-twelve heuristic remain.
 */
function writtenOrder(s: Spelling, parts: readonly [string, string, string], writeFormat?: string): Order {
  if (s.order === "mdy" && writeFormat) {
    // Ignore bracketed literals: [Day] is not a date token.
    const format = writeFormat.replace(/\[[^\]]*\]/g, "");
    const d = format.indexOf("D");
    const m = format.indexOf("M");
    if (d >= 0 && m >= 0 && d < m) return "dmy";
  }
  return s.order === "mdy" && (toNumber(parts[0]) ?? 0) > 12 ? "dmy" : s.order;
}

/** The three parts, as written, rearranged to year, month, day. */
function inYmd(order: Order, parts: readonly [string, string, string]): [string, string, string] {
  return order === "ymd" ? [parts[0], parts[1], parts[2]] : order === "dmy" ? [parts[2], parts[1], parts[0]] : [parts[2], parts[0], parts[1]];
}

interface StoredText {
  /** The stored day as `YYYY-MM-DD`. */
  readonly day: string;
  /** `YYYY-MM-DD` written in the stored spelling, time and padding included. */
  readonly write: (day: string) => string;
}

// Ingestion must still produce ordinary Dates for sorting/calendar/filters.
// Keep their source spelling outside the data model (and out of persistence).
// Weak keys disappear with the frame; the timestamp guard rejects stale
// spelling if a consumer mutates a Date in place.
const dateSources = new WeakMap<Date, { text: StoredText; timestamp: number }>();

function sourceText(date: Date): StoredText | undefined {
  const source = dateSources.get(date);
  return source?.timestamp === date.getTime() ? source.text : undefined;
}

/**
 * A stored date string in a spelling this module can write back. `null` when
 * the spelling matched but names no real day (`2024-02-30`), `undefined` when
 * it is not one of the spellings at all.
 */
function readStoredText(text: string, writeFormat?: string): StoredText | null | undefined {
  const trimmed = text.trim();
  for (const s of SPELLINGS) {
    const m = s.re.exec(trimmed);
    if (!m) continue;
    const parts: [string, string, string] = [m[1] ?? "", m[2] ?? "", m[3] ?? ""];
    // A stored time that is not a real clock time is not carried over: the
    // edited day is written without it rather than as an unparseable value.
    const tail = isClockTail(m[4] ?? "") ? m[4] ?? "" : "";
    const order = writtenOrder(s, parts, writeFormat);
    const [year, month, day] = inYmd(order, parts);
    if (!isCalendarDay(year, month, day)) return null;
    // A part written without its leading zero is written back without one.
    const width = (stored: string, next: string): string => (stored.length === 1 ? next.replace(/^0/, "") : next);
    return {
      day: `${year}-${pad2(month)}-${pad2(day)}`,
      write: (next) => {
        const [, y = "", mo = "", d = ""] = INPUT_DAY.exec(next) ?? [];
        const nm = width(month, mo);
        const nd = width(day, d);
        const written: [string, string, string] = order === "ymd" ? [y, nm, nd] : order === "dmy" ? [nd, nm, y] : [nm, nd, y];
        return s.join(written) + tail;
      },
    };
  }
  return undefined;
}

const TAIL_PARTS = /^[T ](\d{1,2})(?::(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(\s?[AaPp][Mm])?(Z|[+-](\d{2}):?(\d{2}))?$/;

/** Whether a kept time tail is a real clock time (hour, minutes, seconds, offset in range). */
function isClockTail(tail: string): boolean {
  if (tail === "") return true;
  const m = TAIL_PARTS.exec(tail);
  if (!m) return false;
  const hour = toNumber(m[1]) ?? 0;
  const meridiem = m[4] !== undefined;
  if (meridiem ? hour < 1 || hour > 12 : hour > 23) return false;
  if (m[2] !== undefined && (toNumber(m[2]) ?? 0) > 59) return false;
  if (m[3] !== undefined && (toNumber(m[3]) ?? 0) > 59) return false;
  if (m[6] !== undefined && ((toNumber(m[6]) ?? 0) > 14 || (toNumber(m[7]) ?? 0) > 59)) return false;
  return true;
}

/** A kept time tail as the ISO time `THH:mm:ss[.fff][Z or ±hh:mm]` dayjs reads. */
function isoTail(tail: string): string {
  const m = TAIL_PARTS.exec(tail);
  if (!m) return "";
  const two = (n: number): string => String(n).padStart(2, "0");
  const meridiem = m[4]?.trim().toLowerCase();
  let hour = toNumber(m[1]) ?? 0;
  if (meridiem !== undefined) hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
  const fraction = /\.\d+/.exec(tail)?.[0] ?? "";
  const zone = m[5] === undefined ? "" : m[5] === "Z" ? "Z" : `${m[5].slice(0, 1)}${m[6] ?? "00"}:${m[7] ?? "00"}`;
  return `T${two(hour)}:${m[2] ?? "00"}:${m[3] ?? "00"}${fraction}${zone}`;
}

/**
 * A stored date string in the form dayjs reads without guessing: the day in its
 * WRITTEN order (`10.04.2026` is the 10th of April) as `YYYY-MM-DD`, then the
 * time tail as `THH:mm:ss`. `null` when the spelling is known but names no
 * real day or clock time (`2024-02-30`, no rollover), `undefined` when it is
 * not one of the spellings. An ISO `YYYY-MM-DD` text that names a real day is
 * returned as it came, so its result does not change.
 */
export function normalizeStoredDate(text: string, writeFormat?: string): string | null | undefined {
  const trimmed = text.trim();
  for (const s of SPELLINGS) {
    const m = s.re.exec(trimmed);
    if (!m) continue;
    const parts: [string, string, string] = [m[1] ?? "", m[2] ?? "", m[3] ?? ""];
    const [year, month, day] = inYmd(writtenOrder(s, parts, writeFormat), parts);
    if (!isCalendarDay(year, month, day)) return null;
    if (s === SPELLINGS[0]) return text;
    const tail = m[4] ?? "";
    if (!isClockTail(tail)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}${isoTail(tail)}`;
  }
  return undefined;
}

/**
 * A stored date string as a LOCAL `Date`, read in the order it is written
 * (`10.04.2026` is the 10th of April; slash dates use `writeFormat` to resolve
 * day/month order), with its time tail. `null` when the spelling is known but
 * the day does not exist; `undefined` when the spelling is not known, or is
 * known but dayjs cannot read it. The caller then keeps whatever it did before.
 */
export function parseStoredDate(text: string, writeFormat?: string): Date | null | undefined {
  const normal = normalizeStoredDate(text, writeFormat);
  if (normal === null || normal === undefined) return normal;
  const parsed = dayjs(normal);
  if (!parsed.isValid()) return undefined;
  const date = parsed.toDate();
  const original = readStoredText(text, writeFormat);
  if (original) dateSources.set(date, { text: original, timestamp: date.getTime() });
  return date;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** The local time of a `Date` as a suffix, or "" when it is a bare day. */
function timeTail(date: Date, withTime: boolean): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  if (!withTime && h === 0 && m === 0 && s === 0 && date.getMilliseconds() === 0) return "";
  const hm = `T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return s === 0 ? hm : `${hm}:${String(s).padStart(2, "0")}`;
}

/**
 * w4-p01 (F06) — a Date as text, for a field read as String: the spelling it
 * was stored in when that is known, otherwise the local day with its time
 * (`2026-10-24T14:35:27`). The time is never dropped; a value at exact
 * midnight reads as its day, because a Date alone cannot tell the two apart.
 */
export function dateAsText(date: Date): string {
  const source = sourceText(date);
  if (source) return source.write(source.day);
  return formatLocalDay(date) + timeTail(date, false);
}

/**
 * The stored value as the date control's `YYYY-MM-DD`, or "" when there is no
 * day to show. Never `String(value)`: see the header.
 */
export function dateInputValue(stored: Optional<DataValue>, writeFormat?: string): string {
  if (isValidDate(stored)) return sourceText(stored)?.day ?? formatLocalDay(stored);
  if (typeof stored !== "string" || stored.trim() === "") return "";
  const known = readStoredText(stored, writeFormat);
  if (known) return known.day;
  // A known spelling naming no real day shows nothing rather than the day
  // `Date` would roll it over to.
  if (known === null) return "";
  // A spelling this module cannot write back is still shown, read the way
  // ingestion reads it; a commit then writes the plugin's default `YYYY-MM-DD`.
  const parsed = dayjs(stored.trim());
  return parsed.isValid() ? formatLocalDay(parsed.toDate()) : "";
}

/**
 * The value to write when the date control holds `input`.
 *
 * @param stored - the cell's current value (a `Date` from ingestion, a string, or nothing)
 * @param input - the control's value: `YYYY-MM-DD`, or "" when it was cleared
 * @param withTime - the field is configured to carry a time even at midnight
 * @param config - project format, used to disambiguate text and format new dates
 */
export function dateToStore(stored: Optional<DataValue>, input: string, withTime = false, config?: DateFormatConfig): Optional<DataValue> {
  const next = input.trim();
  if (next === dateInputValue(stored, config?.writeFormat)) return stored;
  if (next === "") return null;
  const m = INPUT_DAY.exec(next);
  if (!m || !isCalendarDay(m[1] ?? "", m[2] ?? "", m[3] ?? "")) return stored;
  if (typeof stored === "string") {
    const known = readStoredText(stored, config?.writeFormat);
    if (known) return known.write(next);
  }
  if (isValidDate(stored)) {
    const original = sourceText(stored);
    if (original) return original.write(next);
  }
  if (config) {
    const tail = isValidDate(stored) ? timeTail(stored, withTime || config.includeTime === true) : withTime || config.includeTime ? "T00:00" : "";
    // No original spelling (new cell, YAML Date or a cloned Date): honour the
    // project's selected format instead of silently reverting to ISO.
    const format = config.writeFormat + (tail ? tail.split(":").length > 2 ? " HH:mm:ss" : " HH:mm" : "");
    return dayjs(next + tail).format(format);
  }
  if (isValidDate(stored)) return next + timeTail(stored, withTime);
  return next;
}

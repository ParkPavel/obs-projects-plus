/**
 * typedDate (3.7.2 B1) — what a person types into a date field.
 *
 * A date field used to be a native `<input type="date">`: on iOS that is a
 * wheel and nothing can be typed. The text a person enters is read here, in
 * the forms people actually write: 14.10.2026, 14.10, 14/10/26, 2026-10-14,
 * «сегодня», «завтра», «+3», with an optional time «9:30». Day comes before
 * month (DD.MM) unless the year leads (ISO).
 *
 * The result is a Date or a refusal; storage stays with dateToStore.
 */

export type TypedDate =
  | { kind: "date"; date: Date; hasTime: boolean }
  | { kind: "empty" }
  | { kind: "invalid" };

// coercion-exempt: Class B - lexing digit runs a regular expression has already shaped
const digits = (text: string): number => Number(text);

const WORDS: Record<string, number> = {
  "сегодня": 0, "today": 0, "сьогодні": 0, "今天": 0,
  "завтра": 1, "tomorrow": 1, "明天": 1,
  "вчера": -1, "yesterday": -1, "вчора": -1, "昨天": -1,
};

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** A real calendar day (rejects 31.04, 29.02 of a common year). */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

function withTime(date: Date, time: string | undefined): Date | null {
  if (time === undefined) return date;
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(time);
  if (!m) return null;
  const h = digits(m[1]), min = digits(m[2]);
  if (h > 23 || min > 59) return null;
  const out = new Date(date);
  out.setHours(h, min, 0, 0);
  return out;
}

function fullYear(text: string, now: Date): number {
  if (text.length === 4) return digits(text);
  // Two digits: the century that keeps the year within 50 years of today.
  const yy = digits(text), base = Math.floor(now.getFullYear() / 100) * 100;
  const candidate = base + yy;
  return candidate - now.getFullYear() > 50 ? candidate - 100 : candidate;
}

export function parseTypedDate(input: string, now: Date = new Date()): TypedDate {
  const text = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (text === "") return { kind: "empty" };

  // Split off a trailing time: «14.10.2026 9:30», «завтра 18:00».
  const timeMatch = /^(.*?)(?:\s+|t)(\d{1,2}[:.]\d{2})$/.exec(text);
  const datePart = timeMatch ? timeMatch[1]!.trim() : text;
  const timePart = timeMatch ? timeMatch[2] : undefined;

  let day: Date | null = null;
  const today = startOfDay(now);

  if (datePart in WORDS) {
    day = new Date(today);
    day.setDate(day.getDate() + WORDS[datePart]!);
  } else if (/^[+-]\d{1,4}$/.test(datePart)) {
    day = new Date(today);
    day.setDate(day.getDate() + digits(datePart));
  } else {
    let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(datePart);
    if (m) day = makeDate(digits(m[1]), digits(m[2]), digits(m[3]));
    else if ((m = /^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/.exec(datePart))) {
      const year = m[3] ? fullYear(m[3], now) : now.getFullYear();
      day = makeDate(year, digits(m[2]), digits(m[1]));
    } else if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(datePart))) {
      // 14102026 — a date typed without separators on a numeric keypad.
      day = makeDate(digits(m[3]), digits(m[2]), digits(m[1]));
    }
  }

  if (!day) return { kind: "invalid" };
  const result = withTime(day, timePart);
  return result ? { kind: "date", date: result, hasTime: timePart !== undefined } : { kind: "invalid" };
}

/** How a date is shown back in the field: DD.MM.YYYY[ HH:mm]. */
export function formatTypedDate(date: Date, withClock: boolean): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const base = `${p(date.getDate())}.${p(date.getMonth() + 1)}.${date.getFullYear()}`;
  return withClock ? `${base} ${p(date.getHours())}:${p(date.getMinutes())}` : base;
}

/** A stored day (YYYY-MM-DD, as dateInputValue gives it) shown as DD.MM.YYYY. */
export function typedFromDay(day: string): string {
  const parsed = day ? parseTypedDate(day) : null;
  return parsed?.kind === "date" ? formatTypedDate(parsed.date, false) : "";
}

/** Typed text as the YYYY-MM-DD a date control reports: "" clears, null is refused. */
export function dayFromTyped(text: string): string | null {
  const parsed = parseTypedDate(text);
  if (parsed.kind === "empty") return "";
  if (parsed.kind === "invalid") return null;
  const d = parsed.date, p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

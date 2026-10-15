/**
 * duplicateValues - what the calendar duplicate window writes into a copy.
 *
 * Pure (no stores, no Obsidian): CalendarView reads the source note and its
 * parsed dates, this module decides which values the copy gets for ONE target
 * day. The window used to build them inline, and four things were wrong:
 *
 *   - the chosen time reached the copy only when the date field itself carried
 *     a time, so for a record with a date plus startTime/endTime fields the time
 *     editor did nothing;
 *   - derived values (formula, rollup, relation companions) were copied into
 *     the frontmatter of the new note;
 *   - the date was written in the project's format, which turned a date-only
 *     value into a datetime for a project that writes time;
 *   - the end was only rewritten for a multi-day span, so a single-day event
 *     with an end date kept the source's end day.
 *
 * Time models (the same two the processor and dnd/recordChangeUpdates know):
 *   - embedded: the date field carries the time ("2026-03-12T14:30:00");
 *   - separate: the date field is date-only and startTime/endTime fields hold
 *     a clock ("HH:mm").
 *
 * @module duplicate/duplicateValues
 */

import { DataFieldType } from "src/lib/dataframe/dataframe";

type Dayjs = import("dayjs").Dayjs;
type DataField = import("src/lib/dataframe/dataframe").DataField;

/** The same test the processor uses for "this date value carries a time". */
const CLOCK_IN_VALUE = /\d{2}:\d{2}/;
const CLOCK_ONLY = /^\d{2}:\d{2}$/;
const EMBEDDED_FORMAT = "YYYY-MM-DDTHH:mm:ss";
const CLOCK_FORMAT = "HH:mm";
const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
/** Prefix of the relation companion columns (engine/crossProjectResolver). */
const COMPANION_PREFIX = "__resolved__";

/** The time the user picked in the duplicate window. */
export interface DuplicateTime {
  startTime: Dayjs;
  endTime: Dayjs;
}

/** Input of one copy: the source note and the day it lands on. */
export interface DuplicateValuesInput {
  /** Frontmatter values of the source record */
  values: Record<string, unknown>;
  /** Fields of the view, used to find the ones that are computed */
  fields: ReadonlyArray<Pick<DataField, "name" | "type" | "derived">>;
  dateFieldName: string;
  endDateFieldName?: string | undefined;
  startTimeFieldName: string;
  endTimeFieldName: string;
  /** Parsed start of the source, null when it has none */
  sourceStart: Dayjs | null;
  /** Parsed end of the source, null when it has none */
  sourceEnd: Dayjs | null;
  /** The day the copy lands on */
  targetDate: Dayjs;
  /** The time chosen in the window, null when the source is an all-day event */
  customTime: DuplicateTime | null;
  /** Write format of a date-only value, the project's; ISO when absent */
  dateFormat?: string | undefined;
}

/**
 * Whether a stored date value carries a time of day. A string is read the way
 * the processor reads it; a Date counts when it is not exactly midnight.
 */
export function hasEmbeddedTime(value: unknown): boolean {
  if (value instanceof Date) {
    return (
      value.getHours() !== 0 ||
      value.getMinutes() !== 0 ||
      value.getSeconds() !== 0
    );
  }
  return typeof value === "string" && CLOCK_IN_VALUE.test(value);
}

/**
 * The values of the source that belong in a copy: everything stored, nothing
 * computed. Derived fields, formula and rollup columns and the relation
 * companions exist only in the view's frame, never in a note.
 */
export function storedValues(
  values: Record<string, unknown>,
  fields: DuplicateValuesInput["fields"]
): Record<string, unknown> {
  const computed = new Set(
    fields
      .filter(
        (field) =>
          field.derived ||
          field.type === DataFieldType.Formula ||
          field.type === DataFieldType.Rollup
      )
      .map((field) => field.name)
  );
  const stored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (computed.has(key) || key.startsWith(COMPANION_PREFIX)) continue;
    stored[key] = value;
  }
  return stored;
}

/** The target day with the hour and minute of `time`, seconds as given. */
function atClock(day: Dayjs, time: Dayjs, seconds: number): Dayjs {
  return day.startOf("day").hour(time.hour()).minute(time.minute()).second(seconds);
}

/**
 * The frontmatter values of the copy of one note on one day.
 *
 * - the date keeps the shape of the source: a date-only value stays date-only,
 *   a value with a time stays a datetime;
 * - the chosen time is written where the source keeps its time: into the date
 *   field in the embedded model, into the startTime and endTime fields in the
 *   separate model;
 * - the span is kept: the end lands the same number of days after the target as
 *   the source's end lies after its start, with the chosen end time;
 * - nothing computed is copied.
 *
 * When the date field is the note name the date is not a value at all: the
 * caller puts it into the file name, and no date is written here.
 */
export function buildDuplicateValues(
  input: DuplicateValuesInput
): Record<string, unknown> {
  const {
    values,
    fields,
    dateFieldName,
    endDateFieldName,
    startTimeFieldName,
    endTimeFieldName,
    sourceStart,
    sourceEnd,
    targetDate,
    customTime,
  } = input;
  const dateFormat = input.dateFormat ?? DEFAULT_DATE_FORMAT;
  const day = targetDate.startOf("day");
  const out = storedValues(values, fields);

  // A note name that happens to contain "12:30" is a name, not a time.
  const startEmbedded = dateFieldName !== "name" && hasEmbeddedTime(values[dateFieldName]);
  const endRaw = endDateFieldName ? values[endDateFieldName] : undefined;
  const endEmbedded = hasEmbeddedTime(endRaw);

  // ── Start side ──────────────────────────────────────────────────────────
  if (dateFieldName !== "name") {
    if (startEmbedded) {
      // The chosen time wins; without one the source keeps its own time.
      const time = customTime ? customTime.startTime : (sourceStart ?? day);
      out[dateFieldName] = atClock(day, time, customTime ? 0 : time.second()).format(
        EMBEDDED_FORMAT
      );
    } else {
      out[dateFieldName] = day.format(dateFormat);
    }
  }
  if (customTime && !startEmbedded) {
    // Separate model: the date field stays date-only, the time goes beside it.
    out[startTimeFieldName] = customTime.startTime.format(CLOCK_FORMAT);
  }

  // ── End side ────────────────────────────────────────────────────────────
  if (endDateFieldName && sourceEnd) {
    // A single-day event with an end date is rewritten too: leaving the
    // source's end would stretch the copy from the target day back to it.
    const spanDays = sourceStart
      ? Math.max(0, sourceEnd.startOf("day").diff(sourceStart.startOf("day"), "day"))
      : 0;
    const endDay = day.add(spanDays, "day");
    if (endEmbedded) {
      const time = customTime ? customTime.endTime : sourceEnd;
      out[endDateFieldName] = atClock(endDay, time, customTime ? 0 : time.second()).format(
        EMBEDDED_FORMAT
      );
    } else {
      out[endDateFieldName] = endDay.format(dateFormat);
    }
  }
  if (customTime && !endEmbedded) {
    // The end time lives in its own field. In the embedded model the source
    // may have none (its end is then start plus one hour); a field is not
    // added to a note that never had one.
    const storedEnd = values[endTimeFieldName];
    const hadEndClock = typeof storedEnd === "string" && CLOCK_ONLY.test(storedEnd);
    if (!startEmbedded || hadEndClock) {
      out[endTimeFieldName] = customTime.endTime.format(CLOCK_FORMAT);
    }
  }

  return out;
}

/**
 * The body of a note: everything after the frontmatter block, without the
 * blank lines that separate the two. A note with no frontmatter is all body.
 * Writing it back through createNote gives the copy the same text under its
 * own frontmatter.
 */
export function extractNoteBody(content: string): string {
  const delim = "---";
  if (!/^---[ \t]*\r?\n/.test(content)) return content.replace(/^(?:\r?\n)+/, "");
  const rest = content.slice(delim.length);
  const closing = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(rest);
  if (!closing) return content;
  return rest.slice(closing.index + closing[0].length).replace(/^(?:\r?\n)+/, "");
}

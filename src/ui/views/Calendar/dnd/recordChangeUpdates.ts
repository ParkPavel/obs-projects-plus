/**
 * recordChangeUpdates — the frontmatter updates a calendar drag/resize writes.
 *
 * Pure (no stores, no Obsidian): CalendarView.handleRecordChange gathers the
 * record, the field names and the parsed originals; this module decides which
 * fields change and to what.
 *
 * Time models (must mirror the processor's extractTimeInfo()):
 *   - embedded: the date field carries the time ("2026-03-12T14:30:00");
 *   - separate: the date field is "YYYY-MM-DD" and startTime/endTime fields
 *     hold "HH:mm". The end-date field is optional in this model.
 *
 * P0-4: in the separate model options.endTime used to be written only when an
 * end-date field existed, so a resize-bottom was a no-op and a move shifted only
 * the start (end before start, which the processor reads as overnight).
 *
 * @module dnd/recordChangeUpdates
 */

type Dayjs = import('dayjs').Dayjs;
type RecordChangeOptions = import('./types').RecordChangeOptions;

const EMBEDDED_TIME = /T\d{2}:\d{2}/;
const CLOCK_TIME = /^\d{2}:\d{2}$/;

export interface TimeModel {
  /** The date field value carries the time (ISO "T" separator) */
  startHasEmbeddedTime: boolean;
  /** The record uses "date + startTime field" */
  hasSeparateStartTime: boolean;
}

/**
 * Detect the time model from the raw values only (never from typeConfig: that
 * wrote T00:00:00 into date-only records of time-enabled projects).
 */
export function detectTimeModel(
  values: Record<string, unknown>,
  dateFieldName: string,
  startTimeFieldName: string
): TimeModel {
  const rawStart = values[dateFieldName];
  const startHasEmbeddedTime = typeof rawStart === 'string' && EMBEDDED_TIME.test(rawStart);
  const rawStartTime = values[startTimeFieldName];
  const hasSeparateStartTime =
    !startHasEmbeddedTime && typeof rawStartTime === 'string' && CLOCK_TIME.test(rawStartTime);
  return { startHasEmbeddedTime, hasSeparateStartTime };
}

export interface RecordChangeInput {
  values: Record<string, unknown>;
  dateFieldName: string;
  endDateFieldName?: string | undefined;
  startTimeFieldName: string;
  endTimeFieldName: string;
  /** Target day, already `startOf('day')` */
  targetDate: Dayjs;
  options?: RecordChangeOptions | undefined;
  /** Parsed original start (date field), null when unparsable */
  originalStart: Dayjs | null;
  /** Parsed original end (end-date field), null when there is none */
  originalEnd: Dayjs | null;
  /** Optional sanity check for a shifted end date */
  validateEndShift?:
    | ((original: Dayjs | null, next: Dayjs, hasTime: boolean) => { isValid: boolean; error?: string })
    | undefined;
}

export interface RecordChangeResult {
  updates: Record<string, string>;
  /** Target day combined with the new start time (used for the rename branch) */
  newStartDate: Dayjs;
  warnings: string[];
}

function clockMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function storedClock(values: Record<string, unknown>, name: string): string | null {
  const v = values[name];
  return typeof v === 'string' && CLOCK_TIME.test(v) ? v : null;
}

export function buildRecordChangeUpdates(input: RecordChangeInput): RecordChangeResult {
  const {
    values,
    dateFieldName,
    endDateFieldName,
    startTimeFieldName,
    endTimeFieldName,
    targetDate,
    options,
    originalStart,
    originalEnd,
    validateEndShift,
  } = input;
  const warnings: string[] = [];

  const { startHasEmbeddedTime, hasSeparateStartTime } = detectTimeModel(
    values,
    dateFieldName,
    startTimeFieldName
  );
  const useSeparateTimeFields = hasSeparateStartTime;

  // Build the new start datetime (embedded-time writes and the rename branch)
  let newStartDate: Dayjs;
  if (options?.startTime) {
    const [h, m] = options.startTime.split(':').map(Number);
    newStartDate = targetDate.hour(h ?? 0).minute(m ?? 0).second(0);
  } else if (startHasEmbeddedTime && originalStart) {
    // Embedded time model: preserve original hours/minutes
    newStartDate = targetDate
      .hour(originalStart.hour())
      .minute(originalStart.minute())
      .second(originalStart.second());
  } else if (hasSeparateStartTime) {
    const stored = storedClock(values, startTimeFieldName) ?? '00:00';
    const [h, m] = stored.split(':').map(Number);
    newStartDate = targetDate.hour(h ?? 0).minute(m ?? 0).second(0);
  } else {
    newStartDate = targetDate;
  }

  const updates: Record<string, string> = {};
  const separateWrite = useSeparateTimeFields || (!startHasEmbeddedTime && !!options?.startTime);

  // The start time as it will be stored, for the same-day order guard.
  const effectiveStart = options?.startTime ?? storedClock(values, startTimeFieldName);

  // ── Start side ──────────────────────────────────────────────────────────
  if (separateWrite) {
    // The date field keeps its stored shape (YYYY-MM-DD stays date-only).
    updates[dateFieldName] = targetDate.format('YYYY-MM-DD');
    if (options?.startTime) {
      let start = options.startTime;
      // A resize-top (no end time in the options) never crosses the stored end
      // on the same day; an overnight original (end before start) is left alone.
      if (!options.endTime && !endDateFieldName) {
        const storedStart = storedClock(values, startTimeFieldName);
        const storedEnd = storedClock(values, endTimeFieldName);
        if (
          storedStart &&
          storedEnd &&
          clockMinutes(storedEnd) >= clockMinutes(storedStart) &&
          clockMinutes(start) > clockMinutes(storedEnd)
        ) {
          start = storedEnd;
        }
      }
      updates[startTimeFieldName] = start;
    }
  } else if (startHasEmbeddedTime) {
    updates[dateFieldName] = newStartDate.format('YYYY-MM-DDTHH:mm:ss');
  } else {
    updates[dateFieldName] = targetDate.format('YYYY-MM-DD');
  }

  /** End time never lands before the start time of the same day. */
  const guardEnd = (endTime: string, sameDay: boolean): string => {
    if (sameDay && effectiveStart && clockMinutes(endTime) < clockMinutes(effectiveStart)) {
      return effectiveStart;
    }
    return endTime;
  };

  // ── End side ────────────────────────────────────────────────────────────
  if (!endDateFieldName) {
    // Separate model without an end-date field: the end time lives only in the
    // end-time field. (Embedded model without an end-date field has no end.)
    if (options?.endTime && !startHasEmbeddedTime) {
      updates[endTimeFieldName] = guardEnd(options.endTime, true);
    }
  } else {
    const endRaw = values[endDateFieldName];
    const endHasEmbeddedTime = typeof endRaw === 'string' && EMBEDDED_TIME.test(endRaw);
    const hasSeparateEndTime =
      !endHasEmbeddedTime && storedClock(values, endTimeFieldName) !== null;
    const endFormat = endHasEmbeddedTime ? 'YYYY-MM-DDTHH:mm:ss' : 'YYYY-MM-DD';

    if (options?.endTime) {
      if (useSeparateTimeFields || hasSeparateEndTime || !endHasEmbeddedTime) {
        // Separate model or date-only end field: time goes to the end-time field
        const endDateDay = options.endDate ?? targetDate;
        updates[endTimeFieldName] = guardEnd(options.endTime, endDateDay.isSame(targetDate, 'day'));
        updates[endDateFieldName] = endDateDay.format('YYYY-MM-DD');
      } else {
        // Embedded model: combine date+time into the end-date field
        const [eh, em] = options.endTime.split(':').map(Number);
        let newEndDate = (options.endDate ?? targetDate).hour(eh ?? 0).minute(em ?? 0).second(0);
        if (newEndDate.isBefore(newStartDate)) {
          newEndDate = newStartDate;
        }
        updates[endDateFieldName] = newEndDate.format(endFormat);
      }
    } else if (options?.endDate) {
      // Strip DnD — explicit end date without time change
      let newEndDate = options.endDate;
      if (endHasEmbeddedTime && originalEnd) {
        newEndDate = newEndDate
          .hour(originalEnd.hour())
          .minute(originalEnd.minute())
          .second(originalEnd.second());
      }
      if (newEndDate.isBefore(newStartDate)) {
        newEndDate = newStartDate;
      }
      updates[endDateFieldName] = newEndDate.format(endFormat);
    } else if (originalStart && originalEnd) {
      // Day delta: shift the end date by the days the start moved
      const deltaDays = targetDate.diff(originalStart.startOf('day'), 'day');
      if (deltaDays !== 0) {
        let newEndDate = originalEnd.add(deltaDays, 'day');
        const endValidation = validateEndShift?.(originalEnd, newEndDate, endHasEmbeddedTime);
        if (endValidation && !endValidation.isValid) {
          warnings.push(
            `End date validation failed, skipping end date update: ${endValidation.error ?? ''}`
          );
        } else {
          if (newEndDate.isBefore(newStartDate)) {
            warnings.push('End date would be before start date, adjusting to match start');
            newEndDate = newStartDate;
          }
          updates[endDateFieldName] = newEndDate.format(endFormat);
        }
      }
    }
  }

  return { updates, newStartDate, warnings };
}

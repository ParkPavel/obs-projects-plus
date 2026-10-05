/**
 * P0-4 — what a calendar drag/resize writes. The reported corruption: a record
 * with date + startTime + endTime and no end-date field got its start moved but
 * its end left alone (move) or nothing at all (resize-bottom).
 */

import dayjs from "dayjs";
import { buildRecordChangeUpdates, detectTimeModel } from "../recordChangeUpdates";
import type { RecordChangeOptions } from "../types";

const DATE = "date";
const END_DATE = "endDate";
const START = "startTime";
const END = "endTime";

const day = (iso: string): dayjs.Dayjs => dayjs(iso).startOf("day");

function build(args: {
  values: Record<string, unknown>;
  target: string;
  options?: RecordChangeOptions;
  withEndDateField?: boolean;
}): ReturnType<typeof buildRecordChangeUpdates> {
  const { values, target, options, withEndDateField } = args;
  const rawDate = values[DATE];
  const rawEnd = values[END_DATE];
  return buildRecordChangeUpdates({
    values,
    dateFieldName: DATE,
    endDateFieldName: withEndDateField ? END_DATE : undefined,
    startTimeFieldName: START,
    endTimeFieldName: END,
    targetDate: day(target),
    options,
    originalStart: typeof rawDate === "string" ? dayjs(rawDate) : null,
    originalEnd: withEndDateField && typeof rawEnd === "string" ? dayjs(rawEnd) : null,
  });
}

describe("buildRecordChangeUpdates — separate time model, no end-date field", () => {
  const values = { [DATE]: "2026-10-02", [START]: "10:00", [END]: "11:00" };

  it("a move writes both times, keeping the dragged duration", () => {
    const { updates } = build({
      values,
      target: "2026-10-02",
      options: { startTime: "11:45", endTime: "12:45" },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-02", [START]: "11:45", [END]: "12:45" });
  });

  it("a move to another day writes the new date and both times", () => {
    const { updates } = build({
      values,
      target: "2026-10-05",
      options: { startTime: "09:00", endTime: "10:00" },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-05", [START]: "09:00", [END]: "10:00" });
  });

  it("resize-bottom writes only the end time", () => {
    const { updates } = build({ values, target: "2026-10-02", options: { endTime: "12:30" } });
    expect(updates).toEqual({ [DATE]: "2026-10-02", [END]: "12:30" });
    expect(updates).not.toHaveProperty(START);
  });

  it("resize-top writes only the start time", () => {
    const { updates } = build({ values, target: "2026-10-02", options: { startTime: "09:15" } });
    expect(updates).toEqual({ [DATE]: "2026-10-02", [START]: "09:15" });
    expect(updates).not.toHaveProperty(END);
  });

  it("resize-top never crosses the stored end on the same day", () => {
    const { updates } = build({ values, target: "2026-10-02", options: { startTime: "11:30" } });
    expect(updates[START]).toBe("11:00");
  });

  it("resize-bottom never ends before the start", () => {
    const { updates } = build({ values, target: "2026-10-02", options: { endTime: "09:00" } });
    expect(updates[END]).toBe("10:00");
  });

  it("an overnight original may still move its start before the stored end", () => {
    const overnight = { [DATE]: "2026-10-02", [START]: "22:00", [END]: "02:00" };
    const { updates } = build({ values: overnight, target: "2026-10-02", options: { startTime: "21:00" } });
    expect(updates[START]).toBe("21:00");
  });

  it("keeps the date field date-only", () => {
    const { updates } = build({
      values,
      target: "2026-10-05",
      options: { startTime: "09:00", endTime: "10:00" },
    });
    expect(updates[DATE]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("buildRecordChangeUpdates — separate time model with an end-date field", () => {
  const values = {
    [DATE]: "2026-10-02",
    [END_DATE]: "2026-10-02",
    [START]: "10:00",
    [END]: "11:00",
  };

  it("a move writes both times and the end date for the target day", () => {
    const { updates } = build({
      values,
      withEndDateField: true,
      target: "2026-10-03",
      options: { startTime: "11:00", endTime: "12:00", endDate: day("2026-10-03") },
    });
    expect(updates).toEqual({
      [DATE]: "2026-10-03",
      [START]: "11:00",
      [END]: "12:00",
      [END_DATE]: "2026-10-03",
    });
  });

  it("resize-bottom writes the end time and keeps the end date on the target day", () => {
    const { updates } = build({
      values,
      withEndDateField: true,
      target: "2026-10-02",
      options: { endTime: "12:30" },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-02", [END]: "12:30", [END_DATE]: "2026-10-02" });
  });

  it("without time options the end date shifts by the day delta", () => {
    const { updates } = build({ values, withEndDateField: true, target: "2026-10-04" });
    expect(updates).toEqual({ [DATE]: "2026-10-04", [END_DATE]: "2026-10-04" });
  });

  it("a strip resize writes the explicit end date only", () => {
    const { updates } = build({
      values: { [DATE]: "2026-10-02", [END_DATE]: "2026-10-03" },
      withEndDateField: true,
      target: "2026-10-02",
      options: { endDate: day("2026-10-06") },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-02", [END_DATE]: "2026-10-06" });
  });
});

describe("buildRecordChangeUpdates — embedded time model (unchanged)", () => {
  it("a move rewrites the embedded date field and writes no time fields", () => {
    const { updates } = build({
      values: { [DATE]: "2026-10-02T10:00:00" },
      target: "2026-10-05",
      options: { startTime: "14:00", endTime: "15:00" },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-05T14:00:00" });
  });

  it("a move without a time keeps the original clock time", () => {
    const { updates } = build({ values: { [DATE]: "2026-10-02T10:30:00" }, target: "2026-10-05" });
    expect(updates).toEqual({ [DATE]: "2026-10-05T10:30:00" });
  });

  it("resize-bottom with an embedded end-date field combines date and time", () => {
    const { updates } = build({
      values: { [DATE]: "2026-10-02T10:00:00", [END_DATE]: "2026-10-02T11:00:00" },
      withEndDateField: true,
      target: "2026-10-02",
      options: { endTime: "15:00" },
    });
    expect(updates).toEqual({
      [DATE]: "2026-10-02T10:00:00",
      [END_DATE]: "2026-10-02T15:00:00",
    });
  });
});

describe("buildRecordChangeUpdates — date-only (all-day) records", () => {
  it("an all-day move writes only the date", () => {
    const { updates } = build({ values: { [DATE]: "2026-10-02" }, target: "2026-10-05" });
    expect(updates).toEqual({ [DATE]: "2026-10-05" });
  });

  it("a timed drop on a date-only record keeps the date shape and writes the time fields", () => {
    const { updates } = build({
      values: { [DATE]: "2026-10-02" },
      target: "2026-10-05",
      options: { startTime: "09:00", endTime: "10:00" },
    });
    expect(updates).toEqual({ [DATE]: "2026-10-05", [START]: "09:00", [END]: "10:00" });
  });
});

describe("detectTimeModel", () => {
  it("tells the three shapes apart from the raw values", () => {
    expect(detectTimeModel({ [DATE]: "2026-10-02T10:00:00" }, DATE, START)).toEqual({
      startHasEmbeddedTime: true,
      hasSeparateStartTime: false,
    });
    expect(detectTimeModel({ [DATE]: "2026-10-02", [START]: "10:00" }, DATE, START)).toEqual({
      startHasEmbeddedTime: false,
      hasSeparateStartTime: true,
    });
    expect(detectTimeModel({ [DATE]: "2026-10-02" }, DATE, START)).toEqual({
      startHasEmbeddedTime: false,
      hasSeparateStartTime: false,
    });
  });
});

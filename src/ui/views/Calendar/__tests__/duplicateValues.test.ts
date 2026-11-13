/**
 * What the calendar duplicate window writes into a copy (stab-dup).
 *
 * The values used to be built inline in CalendarView.handleDayPopupRecordDuplicate
 * and four things were wrong, each pinned below by a case that fails on the
 * inline code:
 *   - the chosen time was applied only when the date field's typeConfig said it
 *     had a time, so a visit with a date plus startTime/endTime fields kept the
 *     source's time whatever the user picked;
 *   - computed values (formula, rollup, relation companions) were spread into
 *     the copy together with the stored ones;
 *   - a single-day event with an end-date field kept the source's end day, as
 *     the end was rewritten for a multi-day span only;
 *   - the body of the note was never read: the copy was created empty.
 */

import dayjs from "dayjs";

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import {
  buildDuplicateValues,
  extractNoteBody,
  hasEmbeddedTime,
  storedValues,
  type DuplicateValuesInput,
} from "src/lib/duplicate/duplicateValues";

const field = (name: string, type: DataFieldType, derived = false): DataField => ({
  name,
  type,
  repeated: false,
  identifier: false,
  derived,
});

const FIELDS: DataField[] = [
  field("date", DataFieldType.Date),
  field("endDate", DataFieldType.Date),
  field("tags", DataFieldType.List),
  field("total", DataFieldType.Formula, true),
  field("rollup", DataFieldType.Rollup, true),
  field("computed", DataFieldType.Number, true),
];

const at = (iso: string): dayjs.Dayjs => dayjs(iso);
const time = (start: string, end: string) => ({
  startTime: at(`2026-03-12T${start}:00`),
  endTime: at(`2026-03-12T${end}:00`),
});

function build(
  values: Record<string, unknown>,
  over: Partial<DuplicateValuesInput> = {}
): Record<string, unknown> {
  const hasEnd = over.endDateFieldName !== undefined;
  const rawStart = values["date"];
  const rawEnd = values["endDate"];
  return buildDuplicateValues({
    values,
    fields: FIELDS,
    dateFieldName: "date",
    startTimeFieldName: "startTime",
    endTimeFieldName: "endTime",
    sourceStart: typeof rawStart === "string" ? at(rawStart) : null,
    sourceEnd: hasEnd && typeof rawEnd === "string" ? at(rawEnd) : null,
    targetDate: at("2026-03-20"),
    customTime: null,
    ...over,
  });
}

describe("separate time model (date plus startTime/endTime fields)", () => {
  const visit = { name: "Visit", date: "2026-03-12", startTime: "10:00", endTime: "11:00" };

  it("applies the chosen time to the time fields and the date to the date field", () => {
    const copy = build(visit, { customTime: time("14:30", "15:45") });
    expect(copy["date"]).toBe("2026-03-20");
    expect(copy["startTime"]).toBe("14:30");
    expect(copy["endTime"]).toBe("15:45");
  });

  it("keeps the source's times when no time was chosen", () => {
    const copy = build(visit);
    expect(copy["date"]).toBe("2026-03-20");
    expect(copy["startTime"]).toBe("10:00");
    expect(copy["endTime"]).toBe("11:00");
  });

  it("uses the configured names of the time fields", () => {
    const copy = build(
      { date: "2026-03-12", from: "10:00", to: "11:00" },
      { startTimeFieldName: "from", endTimeFieldName: "to", customTime: time("09:15", "10:15") }
    );
    expect(copy["from"]).toBe("09:15");
    expect(copy["to"]).toBe("10:15");
    expect(copy).not.toHaveProperty("startTime");
  });

  it("keeps the date date-only", () => {
    const copy = build(visit, { customTime: time("14:30", "15:45") });
    expect(copy["date"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("writes a date-only value in the project's format when it has one", () => {
    expect(build(visit, { dateFormat: "DD.MM.YYYY" })["date"]).toBe("20.03.2026");
  });

  it("writes the end time into the end-time field of a multi-day event too", () => {
    const copy = build(
      { ...visit, endDate: "2026-03-14" },
      { endDateFieldName: "endDate", customTime: time("14:30", "15:45") }
    );
    expect(copy["date"]).toBe("2026-03-20");
    expect(copy["endDate"]).toBe("2026-03-22");
    expect(copy["startTime"]).toBe("14:30");
    expect(copy["endTime"]).toBe("15:45");
  });
});

describe("embedded time model (the date field carries the time)", () => {
  const meeting = { date: "2026-03-12T09:00:00", endDate: "2026-03-12T10:00:00" };

  it("puts the chosen time into the date field", () => {
    const copy = build(meeting, { customTime: time("14:30", "15:45") });
    expect(copy["date"]).toBe("2026-03-20T14:30:00");
  });

  it("keeps the source's own time when none was chosen", () => {
    const copy = build({ date: "2026-03-12T09:05:30" });
    expect(copy["date"]).toBe("2026-03-20T09:05:30");
  });

  it("does not add an end-time field to a note that never had one", () => {
    const copy = build({ date: "2026-03-12T09:00:00" }, { customTime: time("14:30", "15:45") });
    expect(copy).not.toHaveProperty("endTime");
    expect(copy).not.toHaveProperty("startTime");
  });

  it("updates an end-time field the note already has", () => {
    const copy = build(
      { date: "2026-03-12T09:00:00", endTime: "10:00" },
      { customTime: time("14:30", "15:45") }
    );
    expect(copy["date"]).toBe("2026-03-20T14:30:00");
    expect(copy["endTime"]).toBe("15:45");
  });

  it("moves the end of a single-day event with the start", () => {
    const copy = build(meeting, { endDateFieldName: "endDate" });
    expect(copy["date"]).toBe("2026-03-20T09:00:00");
    // The inline code left the source's end day here, so the copy ran from the
    // 20th back to the 12th.
    expect(copy["endDate"]).toBe("2026-03-20T10:00:00");
  });
});

describe("a multi-day span", () => {
  it("keeps the span of an all-day event and its date-only shape", () => {
    const copy = build(
      { date: "2026-03-10", endDate: "2026-03-12" },
      { endDateFieldName: "endDate" }
    );
    expect(copy["date"]).toBe("2026-03-20");
    expect(copy["endDate"]).toBe("2026-03-22");
  });

  it("keeps the span and the end time of a timed event", () => {
    const copy = build(
      { date: "2026-03-10T09:00:00", endDate: "2026-03-12T17:30:00" },
      { endDateFieldName: "endDate" }
    );
    expect(copy["date"]).toBe("2026-03-20T09:00:00");
    expect(copy["endDate"]).toBe("2026-03-22T17:30:00");
  });

  it("puts the chosen end time on the last day of the span", () => {
    const copy = build(
      { date: "2026-03-10T09:00:00", endDate: "2026-03-12T17:30:00" },
      { endDateFieldName: "endDate", customTime: time("11:00", "18:15") }
    );
    expect(copy["date"]).toBe("2026-03-20T11:00:00");
    expect(copy["endDate"]).toBe("2026-03-22T18:15:00");
  });

  it("leaves a note without an end alone", () => {
    const copy = build({ date: "2026-03-10" }, { endDateFieldName: "endDate" });
    expect(copy).not.toHaveProperty("endDate");
  });
});

describe("what is copied", () => {
  const source = {
    name: "Visit",
    date: "2026-03-12",
    tags: ["a", "b"],
    total: 12,
    rollup: [1, 2],
    computed: 7,
    __resolved__client: [{ id: "Clients/x.md" }],
  };

  it("skips derived, formula and rollup values and the relation companions", () => {
    const copy = build(source);
    expect(copy).toEqual({ name: "Visit", date: "2026-03-20", tags: ["a", "b"] });
  });

  it("storedValues is the same cut without any date handling", () => {
    expect(storedValues(source, FIELDS)).toEqual({
      name: "Visit",
      date: "2026-03-12",
      tags: ["a", "b"],
    });
  });

  it("writes no date when the date field is the note name", () => {
    const copy = build(
      { name: "2026-03-12 Visit", startTime: "10:00" },
      { dateFieldName: "name", sourceStart: null, customTime: time("14:30", "15:45") }
    );
    expect(copy["name"]).toBe("2026-03-12 Visit");
    expect(copy["startTime"]).toBe("14:30");
  });
});

describe("hasEmbeddedTime", () => {
  it("reads strings the way the processor does", () => {
    expect(hasEmbeddedTime("2026-03-12")).toBe(false);
    expect(hasEmbeddedTime("2026-03-12T09:00:00")).toBe(true);
    expect(hasEmbeddedTime("2026-03-12 09:00")).toBe(true);
    expect(hasEmbeddedTime(undefined)).toBe(false);
    expect(hasEmbeddedTime(20260312)).toBe(false);
  });

  it("treats a Date at midnight as date-only", () => {
    expect(hasEmbeddedTime(new Date(2026, 2, 12, 0, 0, 0))).toBe(false);
    expect(hasEmbeddedTime(new Date(2026, 2, 12, 9, 30, 0))).toBe(true);
  });
});

describe("extractNoteBody", () => {
  it("returns the text under the frontmatter", () => {
    expect(extractNoteBody("---\ntitle: A\n---\n\nHello\n\nWorld\n")).toBe("Hello\n\nWorld\n");
  });

  it("is the whole text when there is no frontmatter", () => {
    expect(extractNoteBody("Just text\n")).toBe("Just text\n");
  });

  it("handles an empty frontmatter and a body that is empty", () => {
    expect(extractNoteBody("---\n---\nBody")).toBe("Body");
    expect(extractNoteBody("---\ntitle: A\n---\n")).toBe("");
    expect(extractNoteBody("---\ntitle: A\n---")).toBe("");
  });

  it("reads Windows line endings", () => {
    expect(extractNoteBody("---\r\ntitle: A\r\n---\r\n\r\nHello\r\n")).toBe("Hello\r\n");
  });

  it("does not take a horizontal rule in the body for the end of the frontmatter", () => {
    expect(extractNoteBody("---\ntitle: A\n---\n\nAbove\n\n---\n\nBelow\n")).toBe(
      "Above\n\n---\n\nBelow\n"
    );
  });

  it("leaves a note that opens a block and never closes it as it is", () => {
    expect(extractNoteBody("---\ntitle: A\nno end\n")).toBe("---\ntitle: A\nno end\n");
  });
});

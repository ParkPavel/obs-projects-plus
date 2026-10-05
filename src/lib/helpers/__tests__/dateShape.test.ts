/**
 * stab-input (3.7.0 P0-1) — a date cell shows the stored day and writes the
 * picked day back in the stored value's shape.
 *
 * `Date` values are built from LOCAL components, the way ingestion builds them
 * (`dayjs(text).toDate()`), so these hold in any process timezone.
 */
import { dateInputValue, dateToStore } from "src/lib/helpers/dateShape";

describe("dateInputValue — what the date control is seeded with", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    ["", ""],
    ["   ", ""],
    [42, ""],
    [true, ""],
  ])("%p has no day to show", (stored, expected) => {
    expect(dateInputValue(stored)).toBe(expected);
  });

  it.each([
    ["2024-01-15", "2024-01-15"],
    ["2024-01-15T10", "2024-01-15"],
    ["2024-01-15T10:30", "2024-01-15"],
    ["2024-01-15 10:30:15", "2024-01-15"],
    ["2024-01-15T10:30:00.250Z", "2024-01-15"],
    ["2024-01-15T10:30+03:00", "2024-01-15"],
    [" 2024-01-15 ", "2024-01-15"],
    ["15.01.2024", "2024-01-15"],
    ["5.1.2024", "2024-01-05"],
    ["15.01.2024 09:00", "2024-01-15"],
    ["01/18/2025", "2025-01-18"],
    ["18/01/2025", "2025-01-18"],
    ["1/8/2025 2:30 PM", "2025-01-08"],
    ["2025/01/18", "2025-01-18"],
    ["2025年01月18日", "2025-01-18"],
  ])("the stored text %p is the day %p", (stored, expected) => {
    expect(dateInputValue(stored)).toBe(expected);
  });

  it("a Date from ingestion is its LOCAL day, never String(date)", () => {
    // The 3.7.0 editor was seeded with String(value): "Mon Jan 15 2024 …",
    // which a date control rejects — it opened empty.
    expect(dateInputValue(new Date(2024, 0, 15))).toBe("2024-01-15");
    expect(dateInputValue(new Date(2024, 0, 15, 23, 59))).toBe("2024-01-15");
    expect(dateInputValue(new Date(Number.NaN))).toBe("");
  });

  it("a known spelling that names no real day shows nothing, not the rolled-over day", () => {
    expect(dateInputValue("2024-02-30")).toBe("");
    expect(dateInputValue("31.04.2024")).toBe("");
    expect(dateInputValue("13/13/2024")).toBe("");
  });

  it("another spelling is shown as ingestion reads it; nonsense shows nothing", () => {
    expect(dateInputValue("Jan 5, 2025")).toBe("2025-01-05");
    expect(dateInputValue("soon")).toBe("");
  });
});

describe("dateToStore — the value written back keeps the stored shape", () => {
  it.each([
    ["2024-01-15T25:99", "2024-01-16"],
    ["2024-01-15T10:75", "2024-01-16"],
    ["2024-01-15T10:30:61", "2024-01-16"],
    ["2024-01-15 13:00 PM", "2024-01-16"],
    ["2024-01-15T10:30+15:00", "2024-01-16"],
  ])("a stored time that is no clock time (%s) is not carried to the new day", (stored, expected) => {
    expect(dateToStore(stored, "2024-01-16")).toBe(expected);
  });

  it.each([
    ["2024-01-15T23:59:59", "2024-01-16T23:59:59"],
    ["2024-01-15 12:30 AM", "2024-01-16 12:30 AM"],
    ["2024-01-15T00:00+14:00", "2024-01-16T00:00+14:00"],
  ])("a real clock time at the edge of its range (%s) is kept", (stored, expected) => {
    expect(dateToStore(stored, "2024-01-16")).toBe(expected);
  });

  it("a date-only value stays date-only", () => {
    expect(dateToStore("2024-01-15", "2024-03-05")).toBe("2024-03-05");
  });

  it.each([
    ["2024-01-15T10", "2024-03-05T10"],
    ["2024-01-15T10:30", "2024-03-05T10:30"],
    ["2024-01-15 10:30", "2024-03-05 10:30"],
    ["2024-01-15 10:30:15", "2024-03-05 10:30:15"],
    ["2024-01-15T10:30:00Z", "2024-03-05T10:30:00Z"],
    ["2024-01-15T10:30:00.250+03:00", "2024-03-05T10:30:00.250+03:00"],
  ])("a value with a time keeps its time and separator: %p", (stored, expected) => {
    expect(dateToStore(stored, "2024-03-05")).toBe(expected);
  });

  it.each([
    ["15.01.2024", "05.03.2024"],
    ["5.1.2024", "5.3.2024"],
    ["15.01.2024 09:00", "05.03.2024 09:00"],
    ["01/18/2025", "03/05/2024"],
    ["18/01/2025", "05/03/2024"],
    ["1/8/2025 2:30 PM", "3/5/2024 2:30 PM"],
    ["2025/01/18", "2024/03/05"],
    ["2025年01月18日", "2024年03月05日"],
  ])("another recognised spelling is written back in that spelling: %p", (stored, expected) => {
    expect(dateToStore(stored, "2024-03-05")).toBe(expected);
  });

  it("a day-first value is written day-first even when the new day could be read as a month", () => {
    // Read as DD/MM because 18 cannot be a month; the order written is the
    // stored one, not re-guessed from the new day. A later reader cannot tell
    // this 05/03 from 3 May — that ambiguity belongs to the slash spelling
    // itself, which ingestion reads month-first everywhere.
    expect(dateToStore("18/01/2025", "2024-03-05")).toBe("05/03/2024");
  });

  it("a Date from ingestion is written as the day, plus its time when it has one", () => {
    expect(dateToStore(new Date(2024, 0, 15), "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore(new Date(2024, 0, 15, 10, 30), "2024-03-05")).toBe("2024-03-05T10:30");
    expect(dateToStore(new Date(2024, 0, 15, 10, 30, 15), "2024-03-05")).toBe("2024-03-05T10:30:15");
  });

  it("a field configured with a time keeps it at midnight too", () => {
    expect(dateToStore(new Date(2024, 0, 15), "2024-03-05", true)).toBe("2024-03-05T00:00");
  });

  it("an empty or unreadable stored value takes the plugin's default YYYY-MM-DD", () => {
    expect(dateToStore(null, "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore(undefined, "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore("", "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore(new Date(Number.NaN), "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore("Jan 5, 2025", "2024-03-05")).toBe("2024-03-05");
    expect(dateToStore("2024-02-30", "2024-03-05")).toBe("2024-03-05");
  });

  it("an emptied control clears the value", () => {
    expect(dateToStore("2024-01-15", "")).toBeNull();
    expect(dateToStore("15.01.2024 09:00", "  ")).toBeNull();
    expect(dateToStore(new Date(2024, 0, 15), "")).toBeNull();
  });

  it("an unchanged day returns the stored value itself, so a blur writes nothing", () => {
    const date = new Date(2024, 0, 15, 10, 30);
    expect(dateToStore(date, "2024-01-15")).toBe(date);
    expect(dateToStore("15.01.2024 09:00", "2024-01-15")).toBe("15.01.2024 09:00");
    expect(dateToStore("2024-01-15T10:30", "2024-01-15")).toBe("2024-01-15T10:30");
    expect(dateToStore(null, "")).toBeNull();
    expect(dateToStore(undefined, "")).toBeUndefined();
  });

  it("input the control cannot produce changes nothing", () => {
    expect(dateToStore("2024-01-15", "2024-13-01")).toBe("2024-01-15");
    expect(dateToStore("2024-01-15", "15.01.2024")).toBe("2024-01-15");
    expect(dateToStore("2024-01-15", "garbage")).toBe("2024-01-15");
  });

  it("the written value reads back as the picked day — a round trip through each shape", () => {
    for (const stored of ["2024-01-15", "2024-01-15T10:30", "15.01.2024", "01/18/2025", "18/01/2025", "2025年01月18日", "5.1.2024"]) {
      const written = dateToStore(stored, "2024-11-28");
      expect(dateInputValue(written)).toBe("2024-11-28");
    }
  });
});

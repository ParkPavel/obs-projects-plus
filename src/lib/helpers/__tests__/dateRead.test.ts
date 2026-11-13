/**
 * stab-dateread (3.7.1) — a stored date string is read in the order it is
 * written. `10.04.2026` is the 10th of April; ingestion used to hand it to
 * `Date()`, which read it month first.
 *
 * Every expectation is built from LOCAL components, so these hold in any
 * process timezone.
 *
 * On the old code `parseStoredDate` and `normalizeStoredDate` do not exist, so
 * the whole file fails (not a function); the reasons per case are in the
 * contract report.
 */
import { normalizeStoredDate, parseStoredDate } from "src/lib/helpers/dateShape";

describe("parseStoredDate — the day in its written order", () => {
  it.each([
    ["10.04.2026", new Date(2026, 3, 10)],
    ["1.2.2026", new Date(2026, 1, 1)],
    ["04/10/2026", new Date(2026, 3, 10)],
    ["4/10/2026", new Date(2026, 3, 10)],
    ["13/04/2026", new Date(2026, 3, 13)],
    ["2026/4/10", new Date(2026, 3, 10)],
    ["2026年4月10日", new Date(2026, 3, 10)],
  ])("%p is %p", (text, expected) => {
    expect(parseStoredDate(text)).toEqual(expected);
  });

  it("applies the time tail", () => {
    expect(parseStoredDate("10.04.2026 09:30")).toEqual(new Date(2026, 3, 10, 9, 30));
    expect(parseStoredDate("10.04.2026T09:30:15")).toEqual(new Date(2026, 3, 10, 9, 30, 15));
    expect(parseStoredDate("04/10/2026 2:30 PM")).toEqual(new Date(2026, 3, 10, 14, 30));
    expect(parseStoredDate("04/10/2026 12:05 AM")).toEqual(new Date(2026, 3, 10, 0, 5));
    expect(parseStoredDate("2026/4/10 07")).toEqual(new Date(2026, 3, 10, 7));
  });

  it("reads an offset the way dayjs reads the ISO form", () => {
    expect(parseStoredDate("10.04.2026 09:30+03:00")).toEqual(new Date("2026-04-10T09:30:00+03:00"));
    expect(parseStoredDate("10.04.2026T09:30Z")).toEqual(new Date("2026-04-10T09:30:00Z"));
  });

  it("leaves the ISO results as they were", () => {
    expect(parseStoredDate("2026-04-10")).toEqual(new Date(2026, 3, 10));
    expect(parseStoredDate("2026-04-10T10:30")).toEqual(new Date(2026, 3, 10, 10, 30));
    expect(parseStoredDate("2026-04-10 10:30:15")).toEqual(new Date(2026, 3, 10, 10, 30, 15));
    expect(parseStoredDate("2026-04-10T10:30:00Z")).toEqual(new Date("2026-04-10T10:30:00Z"));
    expect(parseStoredDate("2026-04-10T10:30+03:00")).toEqual(new Date("2026-04-10T10:30:00+03:00"));
  });

  it("does not roll an impossible day over", () => {
    expect(parseStoredDate("2024-02-30")).toBeNull();
    expect(parseStoredDate("31.04.2026")).toBeNull();
    expect(parseStoredDate("13/13/2026")).toBeNull();
    expect(parseStoredDate("29.02.2025")).toBeNull();
    expect(parseStoredDate("29.02.2024")).toEqual(new Date(2024, 1, 29));
  });

  it("returns undefined for a spelling it does not know", () => {
    expect(parseStoredDate("April 10, 2026")).toBeUndefined();
    expect(parseStoredDate("tomorrow")).toBeUndefined();
    expect(parseStoredDate("")).toBeUndefined();
  });
});

describe("normalizeStoredDate — the form dayjs reads without guessing", () => {
  it.each([
    ["10.04.2026", "2026-04-10"],
    ["1.2.2026", "2026-02-01"],
    ["04/10/2026", "2026-04-10"],
    ["13/04/2026", "2026-04-13"],
    ["10.04.2026 09:30", "2026-04-10T09:30:00"],
    ["04/10/2026 2:30 PM", "2026-04-10T14:30:00"],
  ])("%p is %p", (text, expected) => {
    expect(normalizeStoredDate(text)).toBe(expected);
  });

  it("hands a real ISO text back as it came", () => {
    expect(normalizeStoredDate("2026-04-10T10:30+03:00")).toBe("2026-04-10T10:30+03:00");
    expect(normalizeStoredDate("2024-02-30")).toBeNull();
  });
});

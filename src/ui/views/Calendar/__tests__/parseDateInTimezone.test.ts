/**
 * stab-dateread (3.7.1) — the calendar places a stored date string on the day
 * it is written, not the day `Date()` makes of it.
 */
import { parseDateInTimezone } from "../calendar";

const day = (value: unknown, tz?: string): string | null =>
  parseDateInTimezone(value, tz)?.format("YYYY-MM-DD") ?? null;

describe("parseDateInTimezone — written order", () => {
  it("places 10.04.2026 on April 10 (old code: October 4)", () => {
    expect(day("10.04.2026")).toBe("2026-04-10");
    expect(day("10.04.2026", "Europe/Moscow")).toBe("2026-04-10");
  });

  it("places 1.2.2026 on February 1 (old code: January 2)", () => {
    expect(day("1.2.2026")).toBe("2026-02-01");
  });

  it("reads 04/10/2026 month first and 13/04/2026 day first (old code: no day)", () => {
    expect(day("04/10/2026")).toBe("2026-04-10");
    expect(day("13/04/2026")).toBe("2026-04-13");
  });

  it("applies the time tail", () => {
    const parsed = parseDateInTimezone("10.04.2026 09:30");
    expect(parsed?.format("YYYY-MM-DD HH:mm")).toBe("2026-04-10 09:30");
    const zoned = parseDateInTimezone("10.04.2026 09:30", "Europe/Moscow");
    expect(zoned?.format("YYYY-MM-DD HH:mm")).toBe("2026-04-10 09:30");
  });

  it("leaves ISO as it was", () => {
    expect(day("2026-04-10")).toBe("2026-04-10");
    expect(day("2026-04-10", "Europe/Moscow")).toBe("2026-04-10");
    expect(parseDateInTimezone("2026-04-10T10:30")?.format("HH:mm")).toBe("10:30");
  });

  it("gives no day for 2024-02-30 instead of March 1", () => {
    expect(day("2024-02-30")).toBeNull();
    expect(day("31.04.2026")).toBeNull();
  });

  it("still reads a Date and still rejects a number", () => {
    expect(day(new Date(2026, 3, 10))).toBe("2026-04-10");
    expect(day(0)).toBeNull();
  });
});

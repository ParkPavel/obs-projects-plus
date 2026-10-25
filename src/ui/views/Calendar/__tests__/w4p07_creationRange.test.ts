/**
 * w4-p07 (audit F08, decision 24.10 #14) — a new event keeps the range chosen
 * on the grid; a tap takes the view's creation length.
 *
 * Old code: a drag over 10:00–12:30 created 10:00–11:00 — the end was dropped
 * on the way (TimelineView, the creation preview) and the calendar always
 * wrote start + 1 hour.
 */
import { creationDurationOf, creationEnd, timeAfter } from "../creationRange";

describe("creationEnd", () => {
  it("keeps the end chosen by a drag (old code: start + 1 hour)", () => {
    expect(creationEnd("10:00", "12:30", undefined)).toBe("12:30");
  });

  it("takes the view's length for a tap", () => {
    expect(creationEnd("10:00", undefined, { creationDuration: 30 })).toBe("10:30");
    expect(creationEnd("10:00", undefined, undefined)).toBe("11:00");
  });

  it("writes no end without a start", () => {
    expect(creationEnd(undefined, "12:00", undefined)).toBeUndefined();
  });
});

describe("creationDurationOf", () => {
  it("offers 15, 30, 60, 90 and 120 minutes, one hour by default", () => {
    expect([15, 30, 60, 90, 120].map((m) => creationDurationOf({ creationDuration: m }))).toEqual([15, 30, 60, 90, 120]);
    expect(creationDurationOf({ creationDuration: 45 })).toBe(60);
    expect(creationDurationOf({})).toBe(60);
  });
});

describe("timeAfter", () => {
  it("wraps past midnight on a 24-hour clock", () => {
    expect(timeAfter("23:30", 60)).toBe("00:30");
    expect(timeAfter("09:05", 90)).toBe("10:35");
  });
});

import dayjs from "dayjs";
import { formatDateCell } from "../dateDisplay";

test.each([
  ["MMM DD, YYYY", "Jan 15, 2026"], ["DD MMMM YYYY", "15 January 2026"],
  ["D/M/YYYY", "15/1/2026"], ["[Month] MMM [day] D", "Month Jan day 15"],
])("date display supports formatter tokens and literals: %s", (displayFormat, expected) => {
  const locale = dayjs.locale();
  try { dayjs.locale("en"); expect(formatDateCell("2026-01-15", { withTime: false, displayFormat })).toBe(expected); }
  finally { dayjs.locale(locale); }
});

test("calendar digits and local Date parts keep their day", () => {
  expect(formatDateCell("2026-01-15T23:45:00-12:00", { withTime: false, displayFormat: "DD.MM.YYYY" })).toBe("15.01.2026 23:45");
  expect(formatDateCell(new Date(2026, 0, 15, 23, 45), { withTime: true, displayFormat: "DD.MM.YYYY" })).toBe("15.01.2026 23:45");
});

test("a display formatter does not silently roll an invalid stored day into another month", () => {
  expect(formatDateCell("2026-02-31", { withTime: false, displayFormat: "MMM D, YYYY" })).toBe("2026-02-31");
});

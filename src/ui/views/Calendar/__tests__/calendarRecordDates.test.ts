import { processCalendarData } from "../processor";
import { DataFieldType } from "src/lib/dataframe/dataframe";

const fields = [{ name: "visit", type: DataFieldType.String, repeated: false, derived: false, identifier: false }];
test("explicit mapped start values never borrow another property's date or a filename date", () => {
  const records = [{ id: "valid.md", values: { visit: "2026-10-26" } }, ...[undefined, null, "", "invalid"].map((visit, index) => ({ id: `2026-10-26 Foreign ${index}.md`, values: { visit, date: "2026-10-26" } }))];
  const result = processCalendarData({ fields, records }, { startDateField: "visit" });
  expect(result.processed.map(item => item.record.id)).toEqual(["valid.md"]);
});
test("an explicit mapped end is authoritative when absent or null", () => {
  const records = [undefined, null].map((finish, index) => ({ id: `item${index}.md`, values: { visit: "2026-10-25", finish, endDate: "2026-10-27" } }));
  const result = processCalendarData({ fields, records }, { startDateField: "visit", endDateField: "finish" });
  expect(result.processed.map(item => item.endDate)).toEqual([null, null]);
});
test("unconfigured legacy conventional dates and filename dates keep their previous results", () => {
  const records = [{ id: "conventional.md", values: { date: "2026-10-26", endDate: null, end: "2026-10-28" } }, { id: "Daily/2026-10-27 Entry.md", values: {} }];
  const result = processCalendarData({ fields, records }, {});
  expect(result.processed.map(item => [item.startDate?.format("YYYY-MM-DD"), item.endDate])).toEqual([["2026-10-26", null], ["2026-10-27", null]]);
});

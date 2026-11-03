import { filterSelectionDates } from "../selectionDates";
import { filterRecordsBySelection } from "../../Stats/statsSelectionReceiver";
import { filterByLinkedSelection } from "../../DatabaseCall/relationFilterAdapter";
import type { DataRecord } from "src/lib/dataframe/dataframe";

const records: DataRecord[] = [
  { id: "a", values: { date: "01.08.2026" } },
  { id: "b", values: { date: new Date(2026, 7, 31, 23) } },
  { id: "c", values: { date: "2026-09-01" } },
  { id: "d", values: { date: null } },
  { id: "e", values: { date: "31.02.2026" } },
];
it.each([
  ["[\"2026-08\",\"2026-09\"]", ["a", "b", "c"]],
  ["[\"__empty__\"]", ["d"]],
  ["[\"__invalid__\"]", ["e"]],
])("the chart bucket and both receiver paths agree for %s, without mutating original dates", (value, ids) => {
  const condition = { field: "date", operator: "is-any-of" as const, value, enabled: true };
  const before = records.map(record => record.values["date"]);
  expect(filterSelectionDates(records, condition, "month").map(record => record.id)).toEqual(ids);
  expect(filterByLinkedSelection(records, condition, [], "month").map(record => record.id)).toEqual(ids);
  expect(filterRecordsBySelection({ records, selection: { source: "chart:w", field: "date", op: "is-any-of", values: JSON.parse(value) as string[], dateGrouping: "month" }, myWidgetId: "stats" }).map(record => record.id)).toEqual(ids);
  expect(records.map(record => record.values["date"])).toEqual(before);
  expect(records[1]!.values["date"]).toBe(before[1]);
});

it("keeps ordinary category and legacy raw-date selection equality when bucket metadata is absent", () => {
  const condition = { field: "date", operator: "is" as const, value: "2026-09-01", enabled: true };
  expect(filterByLinkedSelection(records, condition, []).map(record => record.id)).toEqual(["c"]);
  expect(filterRecordsBySelection({ records, selection: { source: "chart:w", field: "date", op: "is", values: ["2026-09-01"] }, myWidgetId: "stats" }).map(record => record.id)).toEqual(["c"]);
});

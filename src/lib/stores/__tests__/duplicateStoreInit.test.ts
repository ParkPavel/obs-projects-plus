/**
 * stab-dup — opening the duplicate window selects nothing: a confirm makes
 * copies only on the days the user picked, never one on the source's own day.
 */
import dayjs from "dayjs";
import { get } from "svelte/store";

import { duplicateStore } from "src/lib/stores/duplicateStore";

type Processed = import("src/ui/views/Calendar/types").ProcessedRecord;
type Data = import("src/ui/views/Calendar/types").ProcessedCalendarData;

const day = dayjs("2026-10-07");
const source = {
  record: { id: "v.md", values: {} },
  startDate: day,
  endDate: day,
  timeInfo: { startTime: day.hour(10), endTime: day.hour(11), durationMinutes: 60, hasEmbeddedTime: false },
  spanInfo: null,
  color: null,
  lane: 0,
} as unknown as Processed;
const data = { processed: [source], grouped: {} } as unknown as Data;

afterEach(() => duplicateStore.reset());

describe("duplicateStore.init", () => {
  it("starts with no date selected, not the source's own day", () => {
    duplicateStore.init(source, data);
    expect(get(duplicateStore).selectedDates.size).toBe(0);
    expect(duplicateStore.getTargetDates()).toEqual([]);
  });

  it("a multi-day source does not pre-select its span either", () => {
    duplicateStore.init({ ...source, spanInfo: { spanDays: 3 } } as unknown as Processed, data);
    expect(get(duplicateStore).selectedDates.size).toBe(0);
  });
});

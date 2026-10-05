/**
 * P0-4 — the duration a drag carries comes from the processed start/end
 * difference, so an overnight or multi-hour event keeps its real length.
 *
 * Geometry: remPx 16 and 3 rem per hour, so one hour is 48 CSS pixels and a
 * pointer at y = h * 48 snaps to h:00 in a column whose top is at y 0.
 */

import dayjs from "dayjs";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { TimelineDragManager, type OnDragCommit } from "../TimelineDragManager";
import { EventRenderType, type ProcessedRecord } from "../../types";

const REM_PX = 16;
const HOUR_PX = 3 * REM_PX;
const X = 50;

function rect(top: number, left: number, width: number, height: number): DOMRect {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function placed<T extends HTMLElement>(el: T, box: DOMRect): T {
  Object.defineProperty(el, "getBoundingClientRect", { value: () => box });
  document.body.appendChild(el);
  return el;
}

function mouse(type: string, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: X, clientY: y, button: 0 });
}

function processedFor(start: dayjs.Dayjs, end: dayjs.Dayjs, record: DataRecord): ProcessedRecord {
  return {
    record,
    renderType: EventRenderType.TIMED,
    startDate: start,
    endDate: null,
    timeInfo: {
      startTime: start,
      endTime: end,
      durationMinutes: end.diff(start, "minute"),
      hasEmbeddedTime: false,
    },
    spanInfo: null,
    color: null,
    lane: 0,
  };
}

describe("TimelineDragManager — duration from the processed start/end difference", () => {
  const day = dayjs("2026-10-02T00:00");
  const record: DataRecord = { id: "visits/visit.md", values: {} };
  let manager: TimelineDragManager;
  let onCommit: jest.Mock<void, Parameters<OnDragCommit>>;
  let bar: HTMLButtonElement;

  beforeEach(() => {
    manager = new TimelineDragManager();
    onCommit = jest.fn<void, Parameters<OnDragCommit>>();
    manager.configure(
      { startHour: 0, endHour: 24, hourHeightRem: 3, remPx: REM_PX, isMobile: false },
      onCommit
    );
    const column = placed(document.createElement("div"), rect(0, 0, 100, 24 * HOUR_PX));
    manager.setDayColumns([{ day, element: column }]);
    bar = placed(document.createElement("button"), rect(0, 10, 80, HOUR_PX));
  });

  afterEach(() => {
    manager.destroy();
    document.body.innerHTML = "";
  });

  function drag(
    processed: ProcessedRecord,
    mode: "move" | "resize-top" | "resize-bottom",
    toHour: number
  ): Record<string, unknown> {
    // Press on the edge being dragged (the start for a move): the grabbed point
    // then follows the pointer exactly.
    const info = processed.timeInfo!;
    const startMin = info.startTime.hour() * 60 + info.startTime.minute();
    const pressMin = mode === "resize-bottom" ? startMin + info.endTime.diff(info.startTime, "minute") : startMin;
    const pressY = (pressMin / 60) * HOUR_PX;
    manager.initiate(record, processed, mouse("mousedown", pressY), mode, bar);
    document.dispatchEvent(mouse("mousemove", pressY + 20));
    document.dispatchEvent(mouse("mousemove", toHour * HOUR_PX));
    document.dispatchEvent(mouse("mouseup", toHour * HOUR_PX));
    expect(onCommit).toHaveBeenCalledTimes(1);
    return onCommit.mock.calls[0]?.[2] as Record<string, unknown>;
  }

  it("moves a 3 hour event and keeps all 3 hours", () => {
    const options = drag(
      processedFor(day.hour(10), day.hour(13), record),
      "move",
      14
    );
    expect(options).toEqual(expect.objectContaining({ startTime: "14:00", endTime: "17:00" }));
  });

  it("moves an overnight event (22:00 to 02:00) keeping its 4 hours", () => {
    // The clock faces alone say 22:00 -> 02:00 = -1200 minutes.
    const options = drag(
      processedFor(day.hour(22), day.add(1, "day").hour(2), record),
      "move",
      9
    );
    expect(options).toEqual(expect.objectContaining({ startTime: "09:00", endTime: "13:00" }));
  });

  it("an overnight event dragged to the end of the day stays inside the visible range", () => {
    const options = drag(
      processedFor(day.hour(22), day.add(1, "day").hour(2), record),
      "move",
      23
    );
    expect(options).toEqual(expect.objectContaining({ startTime: "20:00", endTime: "23:59" }));
  });

  it("a move grabbed in the middle shifts by the pointer travel, the start does not jump to the pointer", () => {
    // 10:00-12:00 bar, pressed one hour below its top, dragged two hours down.
    const middleBar = placed(document.createElement("button"), rect(10 * HOUR_PX, 10, 80, 2 * HOUR_PX));
    manager.initiate(record, processedFor(day.hour(10), day.hour(12), record), mouse("mousedown", 11 * HOUR_PX), "move", middleBar);
    document.dispatchEvent(mouse("mousemove", 11 * HOUR_PX + 20));
    document.dispatchEvent(mouse("mousemove", 13 * HOUR_PX));
    document.dispatchEvent(mouse("mouseup", 13 * HOUR_PX));
    expect(onCommit.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ startTime: "12:00", endTime: "14:00" }));
  });

  it("a bottom resize grabbed above the end moves the end by the pointer travel", () => {
    // 10:00-12:00, pressed at 11:30 (inside the handle's hit area), dragged one hour down.
    manager.initiate(record, processedFor(day.hour(10), day.hour(12), record), mouse("mousedown", 11.5 * HOUR_PX), "resize-bottom", bar);
    document.dispatchEvent(mouse("mousemove", 11.5 * HOUR_PX + 20));
    document.dispatchEvent(mouse("mousemove", 12.5 * HOUR_PX));
    document.dispatchEvent(mouse("mouseup", 12.5 * HOUR_PX));
    expect(onCommit.mock.calls[0]?.[2]).toEqual({ endTime: "13:00" });
  });

  it("resize-bottom of an overnight event never ends before its start", () => {
    const options = drag(
      processedFor(day.hour(22), day.add(1, "day").hour(2), record),
      "resize-bottom",
      9
    );
    // The bar's start is 22:00; the end cannot go above start + the minimum.
    expect(options["endTime"]).toBe("22:15");
  });
});

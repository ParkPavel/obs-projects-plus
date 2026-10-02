/**
 * ios-d1 — the touch gesture on a timeline event bar.
 *
 * Measured live before this file: a 700 ms press on a bar followed by a move
 * opened the record instead of moving the event. These cases pin the three
 * outcomes a finger can mean, against the manager EventBar drives:
 *
 *   - a short tap is a click: the release must stay default, or the browser
 *     drops the click that opens the record;
 *   - a long press arms the drag: the move that follows moves the event (not
 *     its edge, wherever the finger travels), and the click the browser may
 *     still send after the release is swallowed;
 *   - a pan that starts before the long press belongs to the scroller: it must
 *     never be promoted into a drag later, even when it is slow.
 *
 * Geometry: remPx 16 and 3 rem per hour, so one hour is 48 CSS pixels and the
 * 10:00–11:00 bar spans y 480–528 in a column whose top is at y 0.
 */

import dayjs from "dayjs";
import { get } from "svelte/store";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { TimelineDragManager, type OnDragCommit } from "../TimelineDragManager";
import { DND_CONSTANTS } from "../types";
import { EventRenderType, type ProcessedRecord } from "../../types";

const REM_PX = 16;
const HOUR_PX = 3 * REM_PX;
const BAR_TOP = 10 * HOUR_PX;
const BAR_CENTRE_Y = BAR_TOP + HOUR_PX / 2;
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

/** jsdom has no `Touch` constructor; the manager only reads the coordinates. */
function touch(type: string, y: number, cancelable = true): TouchEvent {
  const ev = new Event(type, { bubbles: true, cancelable });
  const point = [{ clientX: X, clientY: y }];
  const ended = type === "touchend" || type === "touchcancel";
  Object.defineProperty(ev, "touches", { value: ended ? [] : point });
  Object.defineProperty(ev, "changedTouches", { value: point });
  return ev as TouchEvent;
}

function mouse(type: string, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: X, clientY: y, button: 0 });
}

describe("TimelineDragManager — touch gesture on an event bar (ios-d1)", () => {
  const start = dayjs("2026-10-02T10:00");
  const record: DataRecord = { id: "visits/visit.md", values: {} };
  const processed: ProcessedRecord = {
    record,
    renderType: EventRenderType.TIMED,
    startDate: start,
    endDate: null,
    timeInfo: {
      startTime: start,
      endTime: start.add(1, "hour"),
      durationMinutes: 60,
      hasEmbeddedTime: true,
    },
    spanInfo: null,
    color: null,
    lane: 0,
  };

  let manager: TimelineDragManager;
  let onCommit: jest.Mock<void, Parameters<OnDragCommit>>;
  let bar: HTMLButtonElement;
  let onClick: jest.Mock<void, [Event]>;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimelineDragManager();
    onCommit = jest.fn<void, Parameters<OnDragCommit>>();
    manager.configure(
      { startHour: 0, endHour: 24, hourHeightRem: 3, remPx: REM_PX, isMobile: true },
      onCommit
    );
    const column = placed(document.createElement("div"), rect(0, 0, 100, 24 * HOUR_PX));
    manager.setDayColumns([{ day: start.startOf("day"), element: column }]);
    bar = placed(document.createElement("button"), rect(BAR_TOP, 10, 80, HOUR_PX));
    onClick = jest.fn<void, [Event]>();
    bar.addEventListener("click", onClick);
  });

  afterEach(() => {
    manager.destroy();
    // Let any pending click guard expire so it cannot leak into the next case.
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  const press = (y = BAR_CENTRE_Y): void => {
    manager.initiate(record, processed, touch("touchstart", y), "move", bar);
  };

  const clickBar = (): void => {
    bar.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  };

  describe("short tap", () => {
    it("leaves the release default, so the click that opens the record arrives", () => {
      press();
      jest.advanceTimersByTime(120);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);

      expect(end.defaultPrevented).toBe(false);
      expect(get(manager.state)).toBe("idle");
      clickBar();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a tap right after a drag of the same bar (quick re-grab) still opens it", () => {
      // The re-grab skips the long-press wait so a second drag can start at
      // once; a finger that only taps it again is still asking for the record.
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        bar.dispatchEvent(touch("touchmove", y));
      }
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + HOUR_PX));
      jest.advanceTimersByTime(1000); // past the click guard, inside the re-grab window
      expect(get(manager.longPressActive)).toBe(true);

      press();
      jest.advanceTimersByTime(120);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(false);
      clickBar();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("long press, then move", () => {
    it("moves the event — not its edge — and swallows the click after the release", () => {
      press();
      // The live probe held for 700 ms; the threshold is shorter.
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      expect(get(manager.longPressActive)).toBe(true);

      // Down by one hour in small steps, as a finger travels.
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        const move = touch("touchmove", y);
        bar.dispatchEvent(move);
        expect(move.defaultPrevented).toBe(true);
      }
      expect(get(manager.state)).toBe("dragging");
      expect(get(manager.activeMode)).toBe("move");

      const end = touch("touchend", BAR_CENTRE_Y + HOUR_PX);
      bar.dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);

      expect(onCommit).toHaveBeenCalledTimes(1);
      const call = onCommit.mock.calls[0];
      expect(call?.[1]).toBe(record);
      expect(call?.[2]).toEqual(
        expect.objectContaining({ startTime: "11:30", endTime: "12:30" })
      );

      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });

    it("a long press released without a move opens nothing", () => {
      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      const end = touch("touchend", BAR_CENTRE_Y);
      bar.dispatchEvent(end);

      expect(end.defaultPrevented).toBe(true);
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("the guard is this gesture's: a tap elsewhere right after the release goes through", () => {
      // The cancelled touchend sends no click, so nothing consumes the guard;
      // it must not swallow the next tap on a different event or control.
      const other = placed(document.createElement("button"), rect(900, 10, 80, HOUR_PX));
      const onOther = jest.fn<void, [Event]>();
      other.addEventListener("click", onOther);

      press();
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y));
      jest.advanceTimersByTime(100); // well inside the guard window

      other.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, clientX: X, clientY: 924 })
      );
      expect(onOther).toHaveBeenCalledTimes(1);
      // …while a click that does belong to the gesture is still taken.
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("pan before the threshold", () => {
    it("a pan past the touch slop is the scroller's and is never promoted into a drag", () => {
      press();
      jest.advanceTimersByTime(100);
      const pan = touch("touchmove", BAR_CENTRE_Y + 16);
      bar.dispatchEvent(pan);
      expect(pan.defaultPrevented).toBe(false);
      expect(get(manager.state)).toBe("idle");

      // A slow pan keeps the finger down past the long-press threshold.
      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS * 2);
      expect(get(manager.longPressActive)).toBe(false);
      const more = touch("touchmove", BAR_CENTRE_Y + 64);
      bar.dispatchEvent(more);
      expect(more.defaultPrevented).toBe(false);

      bar.dispatchEvent(touch("touchend", BAR_CENTRE_Y + 64));
      expect(onCommit).not.toHaveBeenCalled();
    });

    it("a move the browser already scrolls with (not cancelable) drops the pending press", () => {
      press();
      jest.advanceTimersByTime(100);
      bar.dispatchEvent(touch("touchmove", BAR_CENTRE_Y + 4, false));
      expect(get(manager.state)).toBe("idle");

      jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS * 2);
      expect(get(manager.longPressActive)).toBe(false);
      expect(onCommit).not.toHaveBeenCalled();
    });
  });

  describe("mouse, unchanged", () => {
    it("drags at once and swallows the click that follows the mouseup", () => {
      manager.initiate(record, processed, mouse("mousedown", BAR_CENTRE_Y), "move", bar);
      for (let y = BAR_CENTRE_Y + 4; y <= BAR_CENTRE_Y + HOUR_PX; y += 4) {
        document.dispatchEvent(mouse("mousemove", y));
      }
      expect(get(manager.state)).toBe("dragging");
      document.dispatchEvent(mouse("mouseup", BAR_CENTRE_Y + HOUR_PX));

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit.mock.calls[0]?.[2]).toEqual(
        expect.objectContaining({ startTime: "11:30", endTime: "12:30" })
      );
      clickBar();
      expect(onClick).not.toHaveBeenCalled();
    });
  });
});

import dayjs from "dayjs";
import { get } from "svelte/store";
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { pressMode, handleHitFromTarget } from "../pressMode";
import { TimelineDragManager, type OnDragCommit } from "../TimelineDragManager";
import { DND_CONSTANTS } from "../types";
import { EventRenderType, type ProcessedRecord } from "../../types";

const REM = 16;
const base = { remPx: REM, coarse: false, handleHit: null } as const;

describe("pressMode", () => {
  it("a press on the bottom handle in the lower half resizes the bottom", () => {
    // 96px bar: the handle's enlarged hit area reaches ~2rem above the bottom,
    // far outside the 1rem edge band.
    expect(pressMode({ ...base, barH: 96, relY: 96 - 2 * REM + 2, handleHit: "bottom" })).toBe(
      "resize-bottom"
    );
  });

  it("a press on the top handle in the upper half resizes the top", () => {
    expect(pressMode({ ...base, barH: 96, relY: 2 * REM - 2, handleHit: "top" })).toBe("resize-top");
  });

  it("a handle hit in the wrong half falls back to the band rule", () => {
    expect(pressMode({ ...base, barH: 96, relY: 20, handleHit: "bottom" })).toBe("move");
    expect(pressMode({ ...base, barH: 96, relY: 70, handleHit: "top" })).toBe("move");
  });

  it("the middle of a 24px bar off the handles moves", () => {
    expect(pressMode({ ...base, barH: 24, relY: 12 })).toBe("move");
    // the band is capped at 35% of the bar: 8.4px
    expect(pressMode({ ...base, barH: 24, relY: 8 })).toBe("resize-top");
    expect(pressMode({ ...base, barH: 24, relY: 16 })).toBe("resize-bottom");
  });

  it("uses the edge band off the handles", () => {
    expect(pressMode({ ...base, barH: 96, relY: 5 })).toBe("resize-top");
    expect(pressMode({ ...base, barH: 96, relY: 96 - 5 })).toBe("resize-bottom");
    expect(pressMode({ ...base, barH: 96, relY: 48 })).toBe("move");
  });

  it("touch has a wider band than mouse and agrees elsewhere", () => {
    const relY = 1.2 * REM;
    expect(pressMode({ ...base, barH: 200, relY })).toBe("move");
    expect(pressMode({ ...base, barH: 200, relY, coarse: true })).toBe("resize-top");
    for (const y of [0, 48, 100, 152, 200]) {
      expect(pressMode({ ...base, barH: 200, relY: y })).toBe(
        pressMode({ ...base, barH: 200, relY: y, coarse: true })
      );
    }
  });

  it("is a pure function of the press: the same input gives the same mode", () => {
    const input = { ...base, barH: 96, relY: 50, handleHit: null } as const;
    expect(pressMode(input)).toBe(pressMode({ ...input }));
  });
});

describe("handleHitFromTarget", () => {
  it("finds a handle inside the bar and ignores one outside it", () => {
    const bar = document.createElement("div");
    const bottom = document.createElement("div");
    bottom.className = "resize-handle-bottom";
    const top = document.createElement("div");
    top.className = "resize-handle-top";
    bar.append(bottom, top);
    const stray = document.createElement("div");
    stray.className = "resize-handle-bottom";

    expect(handleHitFromTarget(bottom, bar)).toBe("bottom");
    expect(handleHitFromTarget(top, bar)).toBe("top");
    expect(handleHitFromTarget(bar, bar)).toBeNull();
    expect(handleHitFromTarget(stray, bar)).toBeNull();
    expect(handleHitFromTarget(null, bar)).toBeNull();
  });
});

describe("TimelineDragManager — the mode is fixed at pointerDown", () => {
  const HOUR_PX = 3 * REM;
  const BAR_TOP = 10 * HOUR_PX; // a 10:00-12:00 bar: 96px tall
  const BAR_H = 2 * HOUR_PX;
  const X = 50;
  const start = dayjs("2026-10-02T10:00");
  const record: DataRecord = { id: "visits/visit.md", values: {} };
  const processed: ProcessedRecord = {
    record,
    renderType: EventRenderType.TIMED,
    startDate: start,
    endDate: null,
    timeInfo: {
      startTime: start,
      endTime: start.add(2, "hour"),
      durationMinutes: 120,
      hasEmbeddedTime: false,
    },
    spanInfo: null,
    color: null,
    lane: 0,
  };

  function box(top: number, left: number, width: number, height: number): DOMRect {
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

  function placed<T extends HTMLElement>(el: T, rectangle: DOMRect): T {
    Object.defineProperty(el, "getBoundingClientRect", { value: () => rectangle });
    document.body.appendChild(el);
    return el;
  }

  function touch(type: string, y: number): TouchEvent {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const point = [{ clientX: X, clientY: y }];
    const ended = type === "touchend" || type === "touchcancel";
    Object.defineProperty(ev, "touches", { value: ended ? [] : point });
    Object.defineProperty(ev, "changedTouches", { value: point });
    return ev as TouchEvent;
  }

  function mouse(type: string, y: number): MouseEvent {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: X, clientY: y, button: 0 });
  }

  let manager: TimelineDragManager;
  let onCommit: jest.Mock<void, Parameters<OnDragCommit>>;
  let bar: HTMLButtonElement;
  let bottomHandle: HTMLDivElement;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimelineDragManager();
    onCommit = jest.fn<void, Parameters<OnDragCommit>>();
    manager.configure(
      { startHour: 0, endHour: 24, hourHeightRem: 3, remPx: REM, isMobile: true },
      onCommit
    );
    const column = placed(document.createElement("div"), box(0, 0, 100, 24 * HOUR_PX));
    manager.setDayColumns([{ day: start.startOf("day"), element: column }]);
    bar = placed(document.createElement("button"), box(BAR_TOP, 10, 80, BAR_H));
    bottomHandle = document.createElement("div");
    bottomHandle.className = "resize-handle-bottom";
    bar.appendChild(bottomHandle);
  });

  afterEach(() => {
    manager.destroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = "";
  });

  it("a touch keeps the mode chosen at the press: the manager does not re-decide after the threshold", () => {
    // 60px below the bar top: past the middle, outside the 20px edge band, on
    // the bottom handle's hit area - EventBar's pressMode says resize-bottom.
    const y = BAR_TOP + 60;
    expect(pressMode({ relY: 60, barH: BAR_H, remPx: REM, coarse: true, handleHit: handleHitFromTarget(bottomHandle, bar) })).toBe("resize-bottom");
    bottomHandle.addEventListener("touchstart", (e) =>
      manager.initiate(record, processed, e as TouchEvent, "resize-bottom", bar)
    );
    bottomHandle.dispatchEvent(touch("touchstart", y));
    jest.advanceTimersByTime(DND_CONSTANTS.LONG_PRESS_MS + 200);
    for (let step = y + 4; step <= y + 40; step += 4) {
      bar.dispatchEvent(touch("touchmove", step));
    }
    expect(get(manager.activeMode)).toBe("resize-bottom");
  });

  it("the mode chosen by the press stays until release, whatever way the pointer travels", () => {
    manager.initiate(record, processed, mouse("mousedown", BAR_TOP + BAR_H - 2), "resize-bottom", bar);
    // Drag far up through the whole bar and above it.
    for (let y = BAR_TOP + BAR_H - 2; y >= BAR_TOP - HOUR_PX; y -= 8) {
      document.dispatchEvent(mouse("mousemove", y));
      expect(get(manager.activeMode)).toBe("resize-bottom");
    }
    document.dispatchEvent(mouse("mouseup", BAR_TOP - HOUR_PX));
    const options = onCommit.mock.calls[0]?.[2];
    expect(options).toBeDefined();
    expect(options).toHaveProperty("endTime");
    expect(options).not.toHaveProperty("startTime");
  });
});

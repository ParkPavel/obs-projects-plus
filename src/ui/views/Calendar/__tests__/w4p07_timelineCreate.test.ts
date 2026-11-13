/**
 * w4-p07 (audit F08, F09) — creating on the time grid, as the column sees it.
 *
 * F09 was tap-to-create. The report of 27.10 supersedes it: hold to create,
 * stretch with the same finger, release to open the form without a timer.
 * F08: the preview confirmed only the start; its end is handed on now, and its
 * length follows the view setting.
 */
import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import dayjs from "dayjs";
import { tick } from "svelte";

import DayColumn from "../components/Calendar/DayColumn.svelte";

async function tapAt(column: Element, clientY: number) {
  const touch = { clientX: 10, clientY, identifier: 0, target: column } as unknown as Touch;
  await fireEvent.touchStart(column, { touches: [touch], changedTouches: [touch] });
  await fireEvent.touchEnd(column, { touches: [], changedTouches: [touch] });
  await tick();
}

function column(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".projects-calendar-day-column, [data-date]");
  if (!el) throw new Error("no day column");
  return el;
}

describe("DayColumn — hold on a phone to create", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("shows a draft only after holding; release hands on its start AND end", async () => {
    const onRecordAdd = jest.fn();
    const day = dayjs("2026-10-26");
    const { container } = render(DayColumn, {
      props: { day, onRecordAdd, onDayTap: undefined, isMobile: true, creationDuration: 30, onRecordClick: undefined },
    });
    const el = column(container);
    const touch = { clientX: 10, clientY: 200, identifier: 0, target: el } as unknown as Touch;
    await fireEvent.touchStart(el, { touches: [touch] });
    jest.advanceTimersByTime(500);
    await tick();
    const preview = container.querySelector(".creation-preview");
    expect(preview).not.toBeNull();
    expect(onRecordAdd).not.toHaveBeenCalled();
    await fireEvent.touchEnd(el, { touches: [], changedTouches: [touch] });
    expect(onRecordAdd).toHaveBeenCalledTimes(1);
    const [, start, end] = onRecordAdd.mock.calls[0]!;
    expect(start).toMatch(/^\d{2}:\d{2}$/);
    const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    expect(minutes(end) - minutes(start)).toBe(30);
  });

  it("quick taps, native scrolling and cancelled holds never create", async () => {
    const onRecordAdd = jest.fn();
    const { container } = render(DayColumn, {
      props: { day: dayjs("2026-10-26"), onRecordAdd, isMobile: true, onRecordClick: undefined },
    });
    const el = column(container);
    await tapAt(el, 200);
    await fireEvent.click(el);
    jest.advanceTimersByTime(4000);
    await tick();
    expect(container.querySelector(".creation-preview")).toBeNull();
    const touch = { clientX: 10, clientY: 200, identifier: 0, target: el } as unknown as Touch;
    await fireEvent.touchStart(el, { touches: [touch] });
    await fireEvent.touchMove(el, { touches: [{ ...touch, clientY: 240 }] });
    jest.advanceTimersByTime(500);
    await tick();
    expect(container.querySelector(".creation-preview")).toBeNull();
    await fireEvent.touchStart(el, { touches: [touch] });
    jest.advanceTimersByTime(500);
    await tick();
    expect(container.querySelector(".creation-preview")).not.toBeNull();
    await fireEvent.touchCancel(el);
    await fireEvent.touchEnd(el, { changedTouches: [touch], touches: [] });
    expect(onRecordAdd).not.toHaveBeenCalled();
    expect(container.querySelector(".creation-preview")).toBeNull();
  });

  it("finger wobble after holding retains the configured creation duration", async () => {
    const onRecordAdd = jest.fn();
    const { container } = render(DayColumn, {
      props: { day: dayjs("2026-10-26"), onRecordAdd, isMobile: true, creationDuration: 90, onRecordClick: undefined },
    });
    const el = column(container);
    const touch = { clientX: 10, clientY: 480, identifier: 0, target: el } as unknown as Touch;
    await fireEvent.touchStart(el, { touches: [touch] });
    jest.advanceTimersByTime(500); await tick();
    await fireEvent.touchMove(el, { touches: [{ ...touch, clientX: 12, clientY: 481 }] });
    await fireEvent.touchEnd(el, { touches: [], changedTouches: [touch] });
    const [, start, end] = onRecordAdd.mock.calls[0]!;
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    expect(minutes(end) - minutes(start)).toBe(90);
  });

  it("a held finger stretches the draft before the form opens, using the actual root font", async () => {
    const onRecordAdd = jest.fn();
    const originalStyle = window.getComputedStyle.bind(window);
    const hostStyle = jest.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = originalStyle(element, pseudo);
      if (element === document.documentElement) Object.defineProperty(style, "fontSize", { value: "20px" });
      return style;
    });
    try {
      const { container } = render(DayColumn, {
        props: { day: dayjs("2026-10-26"), onRecordAdd, isMobile: true, onRecordClick: undefined },
      });
      const el = column(container);
      const touch = { clientX: 10, clientY: 600, identifier: 0, target: el } as unknown as Touch;
      await fireEvent.touchStart(el, { touches: [touch] });
      jest.advanceTimersByTime(500);
      await tick();
      await fireEvent.touchMove(el, { touches: [{ ...touch, clientY: 750 }] });
      expect(container.querySelector(".preview-time")?.textContent).toBe("10:00–12:30");
      await fireEvent.touchEnd(el, { touches: [], changedTouches: [touch] });
      expect(onRecordAdd).toHaveBeenCalledWith(expect.anything(), "10:00", "12:30");
    } finally { hostStyle.mockRestore(); }
  });

  it("with onDayTap (a read-only view), the tap opens the day instead", async () => {
    const onDayTap = jest.fn();
    const onRecordAdd = jest.fn();
    const { container } = render(DayColumn, {
      props: { day: dayjs("2026-10-26"), onRecordAdd, onDayTap, isMobile: true, onRecordClick: undefined },
    });
    await tapAt(column(container), 200);
    expect(onDayTap).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".creation-preview")).toBeNull();
  });
});

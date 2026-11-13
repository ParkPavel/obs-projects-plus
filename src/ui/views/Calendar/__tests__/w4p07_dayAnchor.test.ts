/**
 * w4-p07 (N13) — every way of opening a day hands on the press, so the day
 * window anchors at that day's cell.
 *
 * "+N", the keyboard and the year view opened the day with no event; the view
 * then anchored the window at the whole calendar, and it stood at the screen's
 * edge, far from the day. The view takes the cell (`[data-date]`) of the
 * press's target — the same box for the date, the background and "+N".
 */
import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import dayjs from "dayjs";

import Day from "../components/Calendar/Day.svelte";

jest.mock("dayjs", () => {
  const real = jest.requireActual("dayjs");
  return { __esModule: true, default: real };
});

function dayProps(onDayTap: jest.Mock, isMobile: boolean) {
  return {
    date: dayjs("2026-10-26"),
    records: [],
    checkField: undefined,
    onRecordClick: undefined,
    onRecordCheck: undefined,
    onRecordChange: undefined,
    onRecordAdd: undefined,
    dateFieldName: undefined,
    onDayTap,
    isMobile,
  };
}

function cellOfPress(onDayTap: jest.Mock): Element | null {
  const event = onDayTap.mock.calls[0]?.[2] as Event | undefined;
  const target = event?.target as HTMLElement | undefined;
  return target?.closest("[data-date]") ?? null;
}

describe("Day — the press reaches the view", () => {
  it("a click on the background hands on its event", async () => {
    const onDayTap = jest.fn();
    const { container } = render(Day, { props: dayProps(onDayTap, false) });
    const cell = container.querySelector("[data-date]")!;
    await fireEvent.click(cell);
    expect(onDayTap).toHaveBeenCalledTimes(1);
    expect(cellOfPress(onDayTap)).toBe(cell);
  });

  it("Enter on a phone hands on its event (old code: none)", async () => {
    const onDayTap = jest.fn();
    const { container } = render(Day, { props: dayProps(onDayTap, true) });
    const cell = container.querySelector("[data-date]")!;
    await fireEvent.keyDown(cell, { key: "Enter" });
    expect(onDayTap).toHaveBeenCalledTimes(1);
    expect(cellOfPress(onDayTap)).toBe(cell);
  });
});

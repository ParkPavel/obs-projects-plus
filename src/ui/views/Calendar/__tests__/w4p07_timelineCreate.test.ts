/**
 * w4-p07 (audit F08, F09) — creating on the time grid, as the column sees it.
 *
 * F09: on a phone the timeline handed every DayColumn an `onDayTap`, which
 * took a tap on empty time before the creation preview; creating by a tap
 * could not be reached. The timeline now leaves the tap to creation (the day
 * opens from its header) — here: without `onDayTap` a tap shows the preview.
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

describe("DayColumn — a tap on a phone creates", () => {
  it("shows the creation preview, then hands on its start AND end (old code: start only)", async () => {
    const onRecordAdd = jest.fn();
    const day = dayjs("2026-10-26");
    const { container } = render(DayColumn, {
      props: { day, onRecordAdd, onDayTap: undefined, isMobile: true, creationDuration: 30, onRecordClick: undefined },
    });
    await tapAt(column(container), 200);
    const preview = container.querySelector(".creation-preview");
    expect(preview).not.toBeNull();
    await fireEvent.click(container.querySelector(".preview-confirm")!);
    expect(onRecordAdd).toHaveBeenCalledTimes(1);
    const [, start, end] = onRecordAdd.mock.calls[0]!;
    expect(start).toMatch(/^\d{2}:\d{2}$/);
    const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    expect(minutes(end) - minutes(start)).toBe(30);
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

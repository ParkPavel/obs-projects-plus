/**
 * w4-calendar-draft — the draft a hold, a drag or a click on the time grid
 * opens. Nothing is written until confirm; confirm writes once, with every
 * mapped value; a refusal keeps the draft; a late result of an old session
 * touches nothing.
 */
import dayjs from "dayjs";
import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import { processCalendarData } from "../../processor";
import { EventRenderType, type CalendarConfig } from "../../types";
import {
  createCalendarDraft,
  draftMapping,
  draftPayload,
  draftRecord,
  isDraftId,
  type DraftBegin,
  type DraftMapping,
  type DraftPayload,
} from "../calendarDraft";

const UNTITLED = "Untitled";
const TODAY = dayjs("2026-10-28");
const config: CalendarConfig = {
  startDateField: "startDate",
  endDateField: "endDate",
  startTimeField: "startTime",
  endTimeField: "endTime",
  dateField: "created",
  checkField: "done",
  eventColorField: "color",
  iconField: "icon",
};

const field = (name: string, derived = false): DataField =>
  ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived });

function mapping(overrides: Partial<DraftMapping> = {}, fields: DataField[] = []): DraftMapping {
  return { ...draftMapping({ config, fields, creation: "created", check: "done" }), ...overrides };
}

function begin(m: DraftMapping = mapping(), extra: Partial<DraftBegin> = {}): DraftBegin {
  return {
    owner: "p|k",
    day: dayjs("2026-10-26"),
    startTime: "10:00",
    endTime: "11:00",
    durationMinutes: 60,
    name: "Meeting",
    templatePath: "Templates/Event.md",
    prefill: {},
    mapping: m,
    ...extra,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("the draft lifecycle — begin, stretch, release, move, edit, confirm", () => {
  it("writes nothing until confirm, then exactly one note with every mapped value", async () => {
    const ctl = createCalendarDraft();
    const save = jest.fn((_p: DraftPayload) => Promise.resolve());
    // Held at 23:30 and stretched to 00:30 (the grid hands the end as 24:30).
    ctl.begin(begin(mapping(), { startTime: "23:30", endTime: "24:30", prefill: { project: "Work", priority: 0, archived: false } }));
    // Stretched further at the bottom, then moved a day on (the month list's drop).
    ctl.move(dayjs("2026-10-26"), { endTime: "01:00" });
    ctl.move(dayjs("2026-10-27"));
    ctl.edit({ name: "Late call", done: false, color: "#ff8800", icon: "📞" });
    expect(save).not.toHaveBeenCalled();
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("saved");
    expect(save).toHaveBeenCalledTimes(1);
    const payload = save.mock.calls[0]![0];
    expect(payload.name).toBe("Late call");
    expect(payload.templatePath).toBe("Templates/Event.md");
    expect(payload.values).toEqual({
      project: "Work",
      priority: 0,
      archived: false,
      startDate: "2026-10-27",
      startTime: "23:30",
      // The end after midnight carries its own day.
      endDate: "2026-10-28",
      endTime: "01:00",
      // The creation date is today, not the event's start.
      created: "2026-10-28",
      done: false,
      color: "#ff8800",
      icon: "📞",
    });
    expect(ctl.getState().draft).toBeNull();
  });

  it("a click without an end takes the view's length, across midnight onto the next day", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping(), { startTime: "23:30", endTime: undefined, durationMinutes: 90 }));
    const values = draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values;
    expect(values).toMatchObject({ startDate: "2026-10-26", startTime: "23:30", endDate: "2026-10-27", endTime: "01:00" });
  });

  it("a timed move over midnight carries the end onto the next day", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin());
    ctl.move(dayjs("2026-10-26"), { startTime: "23:00", endTime: "00:30", endDate: dayjs("2026-10-27") });
    const values = draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values;
    expect(values).toMatchObject({ startDate: "2026-10-26", startTime: "23:00", endDate: "2026-10-27", endTime: "00:30" });
  });

  it("a timed move keeps the length; a new start keeps it too; an end before the start is clamped", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin());
    ctl.move(dayjs("2026-10-29"), { startTime: "14:00", endTime: "15:00", endDate: dayjs("2026-10-29") });
    let d = ctl.getState().draft!;
    expect([d.start.format("YYYY-MM-DD HH:mm"), d.end.format("YYYY-MM-DD HH:mm")]).toEqual(["2026-10-29 14:00", "2026-10-29 15:00"]);
    ctl.setStart(dayjs("2026-10-29T16:15"));
    d = ctl.getState().draft!;
    expect(d.end.format("HH:mm")).toBe("17:15");
    ctl.setEnd(dayjs("2026-10-29T09:00"));
    expect(ctl.getState().draft!.end.diff(ctl.getState().draft!.start, "minute")).toBe(15);
  });

  it("holding elsewhere while a draft is open moves it and keeps what was typed", () => {
    const ctl = createCalendarDraft();
    const first = ctl.begin(begin())!;
    ctl.edit({ name: "Typed" });
    const again = ctl.begin(begin(mapping(), { startTime: "15:00", endTime: "16:30" }))!;
    expect(again.session).toBe(first.session);
    expect(again.name).toBe("Typed");
    expect(again.start.format("HH:mm")).toBe("15:00");
  });
});

describe("cancel, refusals and one write at a time", () => {
  it("cancel writes nothing and leaves nothing to confirm", async () => {
    const ctl = createCalendarDraft();
    const save = jest.fn(() => Promise.resolve());
    ctl.begin(begin());
    ctl.cancel();
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("none");
    expect(save).not.toHaveBeenCalled();
  });

  it("a refused write keeps the draft and its values, shows why, and the retry writes once more", async () => {
    const ctl = createCalendarDraft();
    const save = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("vault refused")))
      .mockImplementationOnce(() => Promise.resolve());
    ctl.begin(begin());
    ctl.edit({ name: "Kept" });
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("failed");
    expect(ctl.getState()).toMatchObject({ saving: false, error: "vault refused" });
    expect(ctl.getState().draft?.name).toBe("Kept");
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("saved");
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toEqual(save.mock.calls[0]![0]);
  });

  it("a second confirm during the write is refused: one save call", async () => {
    const ctl = createCalendarDraft();
    const write = deferred();
    const save = jest.fn(() => write.promise);
    ctl.begin(begin());
    const first = ctl.confirm(save, TODAY, UNTITLED);
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("busy");
    // Nor does a drag change what is being written.
    ctl.move(dayjs("2026-11-01"));
    expect(ctl.getState().draft?.start.format("YYYY-MM-DD")).toBe("2026-10-26");
    write.resolve();
    expect(await first).toBe("saved");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("a late result of a cancelled session does not touch the next draft", async () => {
    const ctl = createCalendarDraft();
    const write = deferred();
    ctl.begin(begin());
    const old = ctl.confirm(() => write.promise, TODAY, UNTITLED);
    ctl.cancel();
    const next = ctl.begin(begin(mapping(), { name: "Next", startTime: "12:00", endTime: "13:00" }))!;
    write.reject(new Error("late refusal"));
    expect(await old).toBe("stale");
    expect(ctl.getState()).toMatchObject({ saving: false, error: null });
    expect(ctl.getState().draft?.session).toBe(next.session);
    expect(ctl.getState().draft?.name).toBe("Next");
  });

  it("a destroyed view takes no draft and a pending write cannot bring one back", async () => {
    const ctl = createCalendarDraft();
    const write = deferred();
    ctl.begin(begin());
    const pending = ctl.confirm(() => write.promise, TODAY, UNTITLED);
    ctl.destroy();
    write.resolve();
    expect(await pending).toBe("stale");
    expect(ctl.getState().draft).toBeNull();
    expect(ctl.begin(begin())).toBeNull();
  });
});

describe("what is written", () => {
  it.each(["due", "end", "endDate"])("does not treat the lone implicit date %s as two explicit mappings", async (name) => {
    const ctl = createCalendarDraft();
    const m = draftMapping({ config: undefined, fields: [field(name)], start: name, end: name });
    ctl.begin(begin(m));
    const save = jest.fn(() => Promise.resolve());
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("saved");
    expect(save).toHaveBeenCalledTimes(1);
    expect(m.start).toBe("startDate");
    expect(m.end).toBe(name);
  });
  it("refuses conflicting mappings instead of overwriting status with a colour", async () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping({ status: "stage", color: "stage" })));
    const save = jest.fn();
    expect(await ctl.confirm(save, TODAY, UNTITLED)).toBe("invalid");
    expect(save).not.toHaveBeenCalled();
    expect(ctl.getState().draft).not.toBeNull();
  });
  it("keeps textual status separate from completion and preserves false/zero defaults", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping({ status: "stage" }), { prefill: { stage: "Queued", done: false, effort: 0 } }));
    expect(ctl.getState().draft?.status).toBe("Queued");
    ctl.edit({ status: "Active" });
    expect(draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values).toMatchObject({ stage: "Active", done: false, effort: 0 });
    ctl.edit({ status: "" });
    expect(draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values["stage"]).toBeNull();
  });
  it("a computed property is shown, never written — not even from the defaults", () => {
    const ctl = createCalendarDraft();
    const m = mapping({}, [field("done", true), field("score", true)]);
    ctl.begin(begin(m, { prefill: { score: 5, done: true } }));
    const values = draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values;
    expect(values).not.toHaveProperty("done");
    expect(values).not.toHaveProperty("score");
  });

  it("start kept in the file name: the day leads the name once and no name property is written", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping({ start: "name" }), { name: "2026-10-01 Review" }));
    const payload = draftPayload(ctl.getState().draft!, TODAY, UNTITLED);
    expect(payload.name).toBe("2026-10-26 Review");
    expect(payload.values).not.toHaveProperty("name");
    expect(payload.values).toMatchObject({ startTime: "10:00", endDate: "2026-10-26", endTime: "11:00" });
  });

  it("defaults give the done state, colour and icon; clearing explicitly overrides a template colour", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping(), { prefill: { done: true, color: "#00aa00", icon: "⭐" } }));
    const d = ctl.getState().draft!;
    expect([d.done, d.color, d.icon]).toEqual([true, "#00aa00", "⭐"]);
    ctl.edit({ color: "" });
    const values = draftPayload(ctl.getState().draft!, TODAY, UNTITLED).values;
    expect(values["color"]).toBeNull();
    expect(values["done"]).toBe(true);
  });
});

describe("the calendar sees the draft as one more record", () => {
  const frameWith = (extra: DataFrame["records"]): DataFrame => ({
    fields: [],
    records: [{ id: "Notes/kept.md", values: { startDate: "2026-10-26", startTime: "08:00", endTime: "09:00" } }, ...extra],
  });

  it("is processed beside the stored notes, across midnight as a multi-day timed event", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping(), { startTime: "23:00", endTime: "24:30" }));
    const record = draftRecord(ctl.getState().draft!, UNTITLED);
    expect(isDraftId(record.id)).toBe(true);
    const data = processCalendarData(frameWith([record]), config);
    expect(data.processed.map((p) => p.record.id)).toEqual(["Notes/kept.md", record.id]);
    const drawn = data.index.get(record.id)!;
    expect(drawn.renderType).toBe(EventRenderType.MULTI_DAY_TIMED);
    expect(drawn.timeInfo?.startTime.format("YYYY-MM-DD HH:mm")).toBe("2026-10-26 23:00");
    expect(drawn.timeInfo?.endTime.format("YYYY-MM-DD HH:mm")).toBe("2026-10-27 00:30");
  });

  it("with the start in the file name, the day is read from the draft's title", () => {
    const ctl = createCalendarDraft();
    ctl.begin(begin(mapping({ start: "name" }), { name: "Review" }));
    const record = draftRecord(ctl.getState().draft!, UNTITLED);
    const data = processCalendarData({ fields: [], records: [record] }, { ...config, startDateField: "name" });
    expect(data.index.get(record.id)?.timeInfo?.startTime.format("YYYY-MM-DD HH:mm")).toBe("2026-10-26 10:00");
  });

  it("an id of a stored note is never a draft id", () => {
    expect(isDraftId("Notes/kept.md")).toBe(false);
    expect(isDraftId(undefined)).toBe(false);
  });
});

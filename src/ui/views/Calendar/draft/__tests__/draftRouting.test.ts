import dayjs from "dayjs";
import { createCalendarDraft, draftMapping, draftRecord, interceptDraft } from "../calendarDraft";

it("routes current drafts in memory, ignores old gestures, and lets only stored notes reach the file API", () => {
  const ctl = createCalendarDraft();
  const begin = () => ctl.begin({ owner: "p", day: dayjs("2026-10-28"), startTime: "10:00", durationMinutes: 60,
    name: "Draft", templatePath: "", prefill: {}, mapping: draftMapping({ config: undefined, fields: [] }) })!;
  const old = draftRecord(begin(), "Untitled");
  ctl.cancel();
  const current = draftRecord(begin(), "Untitled");
  const fileWrite = jest.fn();
  const move = (id: string) => {
    if (!interceptDraft(id, ctl, () => ctl.move(dayjs("2026-10-30")))) fileWrite(id);
  };
  move(old.id);
  expect(ctl.getState().draft?.start.format("YYYY-MM-DD")).toBe("2026-10-28");
  move(current.id);
  expect(ctl.getState().draft?.start.format("YYYY-MM-DD")).toBe("2026-10-30");
  expect(fileWrite).not.toHaveBeenCalled();
  move("Notes/existing.md");
  expect(fileWrite).toHaveBeenCalledTimes(1);
  expect(fileWrite).toHaveBeenCalledWith("Notes/existing.md");
  ctl.destroy();
});

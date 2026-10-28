import dayjs from "dayjs";
import { parse } from "yaml";
import { DataApi } from "src/lib/dataApi";
import { IFile } from "src/lib/filesystem/filesystem";
import { createCalendarDraft, draftMapping } from "src/ui/views/Calendar/draft/calendarDraft";

jest.mock("yaml", () => jest.requireActual("../../../node_modules/yaml/dist/index.js"));
class CreatedFile extends IFile {
  get basename(): string { return "new"; }
  get path(): string { return "new.md"; }
  async read(): Promise<string> { return ""; }
  async write(): Promise<void> { throw new Error("unexpected second write"); }
  async delete(): Promise<void> { throw new Error("unexpected delete"); }
  readTags(): Set<string> { return new Set(); }
  async process(): Promise<void> { throw new Error("unexpected second write"); }
}

it.each([false, true])("preserves untouched template values and clears only explicit edits (edited=%s)", async (edited) => {
  const ctl = createCalendarDraft();
  ctl.begin({ owner: "p", day: dayjs("2026-10-28"), startTime: "10:00", durationMinutes: 60,
    name: "new", templatePath: "Template.md", prefill: { count: 0, archived: false },
    mapping: draftMapping({ config: { statusField: "stage", iconField: "icon", eventColorField: "color", checkField: "done" }, fields: [] }) });
  if (edited) ctl.edit({ status: "", icon: "", color: "", done: false });
  const create = jest.fn(async (_path: string, _content: string) => new CreatedFile());
  const api = new DataApi({ create, getFile: () => null, getAllFiles: () => [] });
  const template = '---\nstage: Queued\nicon: star\ncolor: "#ff8800"\ndone: true\n---\nTemplate body';
  await ctl.confirm(({ values }) => api.createNote({ id: "new.md", values }, [], "", template), dayjs(), "Untitled");
  expect(create).toHaveBeenCalledTimes(1);
  const content = create.mock.calls[0]![1];
  const fields = parse(content.split("---")[1]!);
  expect(fields).toMatchObject(edited ? { stage: null, icon: null, color: null, done: false }
    : { stage: "Queued", icon: "star", color: "#ff8800", done: true });
  expect(fields).toMatchObject({ count: 0, archived: false, startDate: "2026-10-28", endDate: "2026-10-28" });
  expect(content).toContain("Template body");
  ctl.destroy();
});

import dayjs from "dayjs";
import { DEFAULT_PROJECT } from "src/settings/settings";
import type { ViewApi } from "src/lib/viewApi";
import { creationContextKey } from "../creationContext";
import { createCalendarDraft, draftMapping } from "src/ui/views/Calendar/draft/calendarDraft";

const project = { ...DEFAULT_PROJECT, id: "own", name: "Own" };
const condition = (value: string) => [{ field: "type", value, operator: "is" as const, enabled: true }];

it("preserves a draft across API wrapper/data refreshes but separates writers, destinations and required values", () => {
  const dataSource = {}, dataApi = {}, api = { dataSource, dataApi } as ViewApi;
  const key = creationContextKey(project, "own", [], condition("visit"), false, api);
  expect(creationContextKey({ ...project }, "own", [], condition("visit"), false, { dataSource, dataApi } as ViewApi)).toBe(key);
  expect(creationContextKey(project, "own", [], condition("visit"), false, { dataSource, dataApi: {} } as ViewApi)).not.toBe(key);
  expect(creationContextKey(project, "own", [], condition("call"), false, api)).not.toBe(key);
  expect(creationContextKey({ ...project, newNotesFolder: "Other" }, "own", [], condition("visit"), false, api)).not.toBe(key);
  expect(creationContextKey(project, "own", [], condition("visit"), true, api)).not.toBe(key);
  expect(creationContextKey(project, "other", [], condition("visit"), false, api)).not.toBe(key);
});

it.each([false, true])("a context change retires a calendar draft and its late response; rejected=%s", async rejected => {
  const ctl = createCalendarDraft(), api = {} as ViewApi, mapping = draftMapping({ config: undefined, fields: [] });
  const scope = (value: string) => creationContextKey(project, undefined, [], condition(value), false, api);
  const begin = (value: string) => ctl.begin({ owner: `${scope(value)}|mapping`, day: dayjs("2026-11-03"),
    name: "Draft", durationMinutes: 60, templatePath: "", mapping, prefill: { type: value } });
  begin("visit");
  let resolve!: () => void, reject!: (error: Error) => void;
  const write = jest.fn(() => new Promise<void>((done, fail) => { resolve = done; reject = fail; }));
  const pending = ctl.confirm(write, dayjs("2026-11-03"), "Untitled");
  expect(write.mock.calls).toHaveLength(1);
  expect(ctl.getState().draft!.owner.startsWith(`${scope("call")}|`)).toBe(false);
  ctl.cancel(); const fresh = begin("call");
  if (rejected) reject(new Error("disk busy")); else resolve();
  expect(await pending).toBe("stale"); expect(ctl.getState().draft).toBe(fresh);
  expect(ctl.getState().draft?.prefill).toEqual({ type: "call" }); ctl.destroy();
});

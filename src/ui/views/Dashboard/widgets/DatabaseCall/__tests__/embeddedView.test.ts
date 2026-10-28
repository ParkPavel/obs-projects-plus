import { initialEmbeddedConfig } from "../embeddedView";
import { resolveTabView, linkTab, unlinkTab } from "../linkedView";
import type { ViewTab } from "../../../types";
import { DEFAULT_VIEW } from "src/settings/settings";

test("new embedded calendars start with a time grid and a closed agenda", () => {
  expect(initialEmbeddedConfig("calendar")).toEqual({ interval: "week", displayMode: "bars", agendaOpen: false });
  expect(initialEmbeddedConfig("board")).toEqual({});
});
test("defaults do not override a linked view; unlink copies the current cover and layout", () => {
  const tab: ViewTab = { id: "tab", label: "Calendar", viewType: "calendar", config: initialEmbeddedConfig("calendar") };
  const view = { ...DEFAULT_VIEW, id: "source", name: "Source", type: "calendar", config: { interval: "day", displayMode: "headers", coverField: "poster" } };
  const linked = linkTab(tab, view);
  expect(resolveTabView(linked, [view]).config).toEqual(view.config);
  const local = unlinkTab(linked, [view]);
  expect(local.config).toEqual(view.config);
  expect(local.linkedViewId).toBeUndefined();
  expect(local.config).not.toBe(view.config);
});

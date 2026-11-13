import { cleanup, render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_PROJECT } from "src/settings/settings";
import { loadAppLocal, saveAppLocal } from "src/lib/appStorage";
import CalendarView from "../CalendarView.svelte";
import { settings } from "src/lib/stores/settings";
import { openContextMenu } from "src/lib/contextMenu";
import { newAgendaList } from "../agenda/newAgendaList";
import { isMobileDevice } from "src/lib/stores/ui";
import { toggle as toggleDrawer, close as closeDrawer, isOpenNow } from "src/lib/stores/agendaDrawer";

jest.mock("src/ui/modals/createNoteModal", () => ({ CreateNoteModal: jest.fn(), initialNoteName: jest.fn(), noteNameProblem: jest.fn() }));
jest.mock("src/lib/record/openRecord", () => ({ activateRecord: jest.fn(), openRecord: jest.fn(), modeFromNewLeaf: jest.fn() }));
jest.mock("src/lib/contextMenu", () => ({ openContextMenu: jest.fn() }));
jest.mock("src/lib/stores/ui", () => ({ ...jest.requireActual("src/lib/stores/ui"), isMobileDevice: require("svelte/store").writable(false) }));
jest.mock("dayjs", () => ({ __esModule: true, default: jest.requireActual("dayjs") }));
jest.mock("src/ui/components/Layout", () => ({
  ViewLayout: jest.requireActual("src/ui/components/Layout/ViewLayout.svelte").default,
  ViewContent: jest.requireActual("src/ui/components/Layout/ViewContent.svelte").default,
}));
jest.mock("src/ui/components/ErrorBoundary", () => ({ ErrorBoundary: jest.requireActual("src/ui/components/ErrorBoundary/ErrorBoundary.svelte").default }));
jest.mock("../components/DayPopup", () => ({ DayPopup: jest.requireActual("src/ui/views/Calendar/components/DayPopup/DayPopup.svelte").default }));
jest.mock("../components/DuplicatePopup", () => ({ DuplicatePopup: jest.requireActual("src/ui/views/Calendar/components/DuplicatePopup/DuplicatePopup.svelte").default }));
jest.mock("src/lib/appStorage", () => ({ loadAppLocal: jest.fn((key: string) => key.startsWith("obsidian-projects-calendar-state") ? JSON.stringify({ date: "2026-10-28", interval: "day", timestamp: Date.now(), version: 1 }) : "en"), saveAppLocal: jest.fn() }));
jest.mock("../components/Calendar/InfiniteCalendar.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("../components/Calendar/InfiniteHorizontalCalendar.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));
jest.mock("../components/Calendar/YearHeatmap.svelte", () => require("src/ui/components/EmptyState/EmptyState.svelte"));

beforeEach(() => {
  Object.assign(globalThis, { activeDocument: document, activeWindow: window });
  (isMobileDevice as import("svelte/store").Writable<boolean>).set(false);
  jest.useFakeTimers(); jest.clearAllMocks();
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); jest.clearAllTimers(); jest.useRealTimers(); });
const props = () => ({
  project: { ...DEFAULT_PROJECT, id: "project", name: "Project" },
  frame: { fields: [], records: [] }, api: {} as import("src/lib/viewApi").ViewApi,
  readonly: false, getRecordColor: () => null, embedded: true,
  config: { interval: "week" as const, centerOn: "today", agendaOpen: false }, onConfigChange: jest.fn(),
});

test("an embedded calendar neither restores project interval nor persists automatic centering", async () => {
  const p = props();
  const rendered = render(CalendarView, p);
  await tick();
  jest.advanceTimersByTime(0);
  await tick();
  expect(p.onConfigChange).not.toHaveBeenCalled();
  expect(jest.mocked(loadAppLocal).mock.calls.some(([key]) => key.startsWith("obsidian-projects-calendar-state"))).toBe(false);
  rendered.component.$destroy();
  expect(saveAppLocal).not.toHaveBeenCalled();
});

test("destroy cancels a user config callback queued immediately before a tab switch", async () => {
  const p = props();
  const rendered = render(CalendarView, p);
  await tick();
  await fireEvent.keyDown(rendered.container.querySelector('[role="application"]')!, { key: "+", ctrlKey: true });
  rendered.component.$destroy();
  jest.advanceTimersByTime(1);
  expect(p.onConfigChange).not.toHaveBeenCalled();
});

test("the same user zoom still notifies once while the embedded calendar remains mounted", async () => {
  const p = props();
  const rendered = render(CalendarView, p);
  await tick();
  await fireEvent.keyDown(rendered.container.querySelector('[role="application"]')!, { key: "+", ctrlKey: true });
  jest.advanceTimersByTime(1);
  expect(p.onConfigChange).toHaveBeenCalledTimes(1);
  expect(p.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ interval: "day" }));
});

test("standalone calendars retain restoration of their project navigation state", async () => {
  const p = props();
  render(CalendarView, { ...p, embedded: false });
  await tick();
  jest.advanceTimersByTime(1);
  expect(loadAppLocal).toHaveBeenCalledWith("obsidian-projects-calendar-state-project");
  expect(p.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ interval: "day", centerOn: null }));
});

test("a standalone user scale change queued immediately before close still reaches its callback", async () => {
  const p = props();
  const rendered = render(CalendarView, { ...p, embedded: false });
  await tick();
  jest.advanceTimersByTime(1);
  p.onConfigChange.mockClear();
  // Startup restored day scale. A user zoom-out queues week before unmount.
  await fireEvent.keyDown(rendered.container.querySelector('[role="application"]')!, { key: "-" });
  rendered.component.$destroy();
  jest.advanceTimersByTime(1);
  expect(p.onConfigChange).toHaveBeenCalledTimes(1);
  expect(p.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ interval: "week" }));
});

test("creating an embedded agenda list uses source defaults and stores it in the block, not either project", async () => {
  const p = props();
  const agenda = { mode: "custom" as const, standard: { inheritCalendarFilters: true }, custom: { lists: [] } };
  const source = { ...p.project, id: "other-source", agenda };
  const write = jest.spyOn(settings, "updateProject");
  const rendered = render(CalendarView, { ...p, agendaProject: source, config: { ...p.config, agendaOpen: true } });
  await tick();
  await fireEvent.click(rendered.container.querySelector(".custom-add-empty")!);
  const input = rendered.container.querySelector<HTMLInputElement>(".agenda-list-name input")!;
  await fireEvent.input(input, { target: { value: "Block only" } });
  await fireEvent.keyDown(input, { key: "Enter" });
  jest.advanceTimersByTime(1);
  expect(p.onConfigChange).toHaveBeenCalledWith(expect.objectContaining({
    localAgenda: expect.objectContaining({ custom: expect.objectContaining({ lists: [expect.objectContaining({ name: "Block only" })] }) }),
  }));
  expect(write).not.toHaveBeenCalled();
  expect(source.agenda.custom.lists).toEqual([]);
  expect(p.project).not.toHaveProperty("localAgenda");
});

test.each(["arrow-down", "trash-2"])("embedded agenda action %s updates local lists without writing the source or host", async (icon) => {
  const p = props();
  const lists = [newAgendaList("First", 0), newAgendaList("Second", 1)];
  const source = { ...p.project, id: "other-source", agenda: { mode: "custom" as const, standard: { inheritCalendarFilters: true }, custom: { lists } } };
  const write = jest.spyOn(settings, "updateProject");
  const rendered = render(CalendarView, { ...p, agendaProject: source, config: { ...p.config, agendaOpen: true } });
  await tick();
  await fireEvent.contextMenu(rendered.container.querySelector(".agenda-custom-list .list-header")!);
  const command = jest.mocked(openContextMenu).mock.calls[0]![0].find(item => "icon" in item && item.icon === icon);
  expect(command).toBeDefined();
  if (command && "onClick" in command) command.onClick?.();
  await tick();
  jest.advanceTimersByTime(205);
  const result = p.onConfigChange.mock.calls.at(-1)![0];
  expect(result.localAgenda.custom.lists.map((list: { name: string }) => list.name)).toEqual(icon === "arrow-down" ? ["Second", "First"] : ["Second"]);
  expect(write).not.toHaveBeenCalled();
  expect(source.agenda.custom.lists.map(list => list.name)).toEqual(["First", "Second"]);
});

test("mobile embedded drawers ignore the project key and close only their own session on destroy", async () => {
  (isMobileDevice as import("svelte/store").Writable<boolean>).set(true);
  const p = props();
  const first = render(CalendarView, { ...p, agendaKey: "block-first" });
  const second = render(CalendarView, { ...p, agendaKey: "block-second" });
  try {
    toggleDrawer(p.project.id); await tick();
    expect(document.querySelectorAll(".agenda")).toHaveLength(0);
    toggleDrawer("block-first"); await tick();
    expect(document.querySelectorAll(".agenda")).toHaveLength(1);
    expect(isOpenNow("block-second")).toBe(false);
    first.component.$destroy();
    expect(isOpenNow("block-first")).toBe(false);
    expect(isOpenNow(p.project.id)).toBe(true);
    expect(isOpenNow("block-second")).toBe(false);
  } finally {
    second.component.$destroy(); closeDrawer(p.project.id); closeDrawer("block-first");
  }
});

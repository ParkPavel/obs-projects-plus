import { cleanup, render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { DEFAULT_PROJECT } from "src/settings/settings";
import { loadAppLocal, saveAppLocal } from "src/lib/appStorage";
import CalendarView from "../CalendarView.svelte";

jest.mock("src/ui/modals/createNoteModal", () => ({ CreateNoteModal: jest.fn(), initialNoteName: jest.fn(), noteNameProblem: jest.fn() }));
jest.mock("src/lib/record/openRecord", () => ({ activateRecord: jest.fn(), openRecord: jest.fn(), modeFromNewLeaf: jest.fn() }));
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
  jest.useFakeTimers(); jest.clearAllMocks();
});
afterEach(() => { cleanup(); jest.clearAllTimers(); jest.useRealTimers(); });
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

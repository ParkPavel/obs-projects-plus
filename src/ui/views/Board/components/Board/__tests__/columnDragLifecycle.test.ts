import { tick } from "svelte";
import { SOURCES, TRIGGERS } from "svelte-dnd-action";

jest.mock("src/ui/views/helpers", () => ({ ...jest.requireActual("src/ui/views/helpers"),
  getRecordColorContext: { get: () => () => null, set: () => undefined },
  sortRecordsContext: { get: () => (records: unknown[]) => records, set: () => undefined }, showMobileNavMenu: jest.fn(), handleHoverLink: jest.fn(),
}));
jest.mock("obsidian", () => { const actual = jest.requireActual("src/__mocks__/obsidian"); class Component { load() {} unload() {} } return { ...actual, Component, Notice: jest.fn() }; }, { virtual: true });
jest.mock("src/ui/components/Flair", () => ({ Flair: jest.requireActual("src/ui/components/Flair/Flair.svelte").default }));
jest.mock("svelte-dnd-action", () => ({ ...jest.requireActual("svelte-dnd-action"),
  dragHandleZone: (node: HTMLElement, options: unknown) => {
    Object.assign(node, { __testZone: options });
    return { update(next: unknown) { Object.assign(node, { __testZone: next }); }, destroy() {} };
  },
}));
type Column = import("../types").Column;
type Component = { $destroy(): void; $set(props: Record<string, unknown>): void };
const Board = require("../Board.svelte").default as new (options: { target: HTMLElement; props: Record<string, unknown> }) => Component;
const mounted: Component[] = [];
function mount() {
  const target = document.createElement("div"); document.body.append(target);
  const columns: Column[] = [false, true].map((collapse, i) => ({ id: String(i), records: [], collapse, pinned: false, persisted: false }));
  const write = jest.fn(), component = new Board({ target, props: {
    project: { id: "project", name: "Project" }, dragContext: "original", columns, readonly: true, dataReadOnly: false, richText: false, columnWidth: 270,
    onRecordClick: jest.fn(), onRecordCheck: jest.fn(), onRecordUpdate: jest.fn(), onRecordAdd: jest.fn(), onSortColumns: write,
    onColumnAdd: jest.fn(), onColumnDelete: jest.fn(), onColumnRename: jest.fn(), onColumnCollapse: jest.fn(), onColumnPin: jest.fn(), onColumnPersist: jest.fn(),
    validateStatusField: () => ({}), includeFields: [], checkField: undefined, customHeader: undefined,
  } }); mounted.push(component);
  const zone = target.querySelector<HTMLElement>("section.projects--board:not(.projects--board--pinned)")!;
  const event = (type: string, items = [...columns].reverse(), source: string = SOURCES.POINTER, trigger?: string) => zone.dispatchEvent(new CustomEvent(type, { detail: { items, info: {
    trigger: trigger ?? (type === "consider" ? TRIGGERS.DRAG_STARTED : TRIGGERS.DROPPED_INTO_ZONE), id: "0", source,
  } } }));
  return { target, zone, component, columns, write, event, destroy() { mounted.splice(mounted.indexOf(component), 1); component.$destroy(); } };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { for (const component of mounted.splice(0)) component.$destroy(); jest.clearAllTimers(); jest.useRealTimers(); document.body.replaceChildren(); });
test("destroy before the delayed drop cancels the write", async () => {
  const board = mount(); board.event("consider"); board.event("finalize"); await tick(); board.destroy(); jest.runOnlyPendingTimers();
  expect(board.write).not.toHaveBeenCalled();
});
test("destroy after a completed write never saves that pending order twice", async () => {
  const board = mount(); board.event("consider"); board.event("finalize"); await tick(); jest.advanceTimersByTime(300); await tick();
  expect(board.write).toHaveBeenCalledTimes(1); board.destroy(); expect(board.write).toHaveBeenCalledTimes(1);
});
test.each([{ dataReadOnly: true }, { dragContext: "other field" }, { project: { id: "other-project", name: "Other" } }])("changing the owner/lock cancels a delayed drop: %p", async props => {
  const board = mount(); board.event("consider"); board.event("finalize"); await tick(); board.component.$set(props); await tick(); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).not.toHaveBeenCalled();
});
test.each(["blur", "pagehide", "pointercancel"])("%s cancels the active preview, ignores late finalize and restores saved collapse flags", async type => {
  const board = mount(); board.event("consider"); await tick();
  window.dispatchEvent(new Event(type)); await tick(); board.event("finalize"); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).not.toHaveBeenCalled();
  const wrappers = board.zone.querySelectorAll(".projects--board--column--dndwrapper");
  expect(wrappers[0]).not.toHaveClass("projects--board--column--dndwrapper--collapsed"); expect(wrappers[1]).toHaveClass("projects--board--column--dndwrapper--collapsed");
});
test("a foreign column cannot enter the saved order", async () => {
  const board = mount(); board.event("consider"); board.event("finalize", [board.columns[0]!, { ...board.columns[1]!, id: "foreign" }]); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).not.toHaveBeenCalled();
});
test("a new drag invalidates the preceding delayed write", async () => {
  const board = mount(); board.event("consider"); board.event("finalize");
  board.event("consider", board.columns); jest.advanceTimersByTime(300); await tick();
  expect(board.write).not.toHaveBeenCalled(); board.event("finalize", board.columns); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).not.toHaveBeenCalled();
});
test("column and card zones belong only to their own Board instance", async () => {
  const first = mount(), second = mount(); await tick();
  first.component.$set({ columns: first.columns.map(column => ({ ...column, collapse: false })) });
  second.component.$set({ columns: second.columns.map(column => ({ ...column, collapse: false })) }); await tick();
  const types = (target: HTMLElement) => Array.from(target.querySelectorAll<HTMLElement>("*"), element => (element as HTMLElement & { __testZone?: { type: string } }).__testZone?.type).filter(Boolean);
  const a = types(first.target), b = types(second.target);
  expect(a).toHaveLength(3); expect(new Set(a).size).toBe(2);
  expect(a.some(type => b.includes(type))).toBe(false);
});
test("a normal drop writes once and eventually restores each column's saved collapse state", async () => {
  const board = mount(); board.event("consider"); board.event("finalize"); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).toHaveBeenCalledTimes(1); expect(board.write).toHaveBeenCalledWith(["1", "0"]);
  expect(board.zone.querySelectorAll(".projects--board--column--dndwrapper--collapsed")).toHaveLength(1);
});
test("keyboard stop without a reorder restores the preview immediately and leaves no watchdog", async () => {
  const board = mount(); board.event("consider", board.columns, SOURCES.KEYBOARD);
  board.event("consider", board.columns, SOURCES.KEYBOARD, TRIGGERS.DRAG_STOPPED); await tick();
  expect(board.zone.querySelectorAll(".projects--board--column--dndwrapper--collapsed")).toHaveLength(1);
  expect(jest.getTimerCount()).toBe(0); expect(board.write).not.toHaveBeenCalled();
});
test("ending a keyboard reorder retains its one scheduled write without rearming the watchdog", async () => {
  const board = mount(); board.event("consider", [...board.columns].reverse(), SOURCES.KEYBOARD); board.event("finalize", [...board.columns].reverse(), SOURCES.KEYBOARD);
  board.event("consider", [...board.columns].reverse(), SOURCES.KEYBOARD, TRIGGERS.DRAG_STOPPED); jest.advanceTimersByTime(1500); await tick();
  expect(board.write).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

/**
 * w4-input2 (iPhone, 26.10): «Add list» opened a separate window with a name
 * line, fitted to the calendar strip — on a phone a sliver above the keyboard.
 * A list is now named where it lives: a row at the end of the agenda's lists
 * (new) or the list's own header (rename). The full editor is still there for
 * icon, colour and filters, and on a phone it takes the whole visible screen.
 */
import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import dayjs from "dayjs";
jest.mock("dayjs", () => {
  const actual = jest.requireActual("dayjs");
  return Object.assign(actual, { default: actual });
});
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false), isMobileDevice: writable(true) };
});
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, options?: { count?: number; total?: number }) => key === "formula-mode.matches" ? `Matches:${options?.count}/${options?.total}` : key }) };
});
jest.mock("src/lib/contextMenu", () => ({ openContextMenu: jest.fn() }));
jest.mock("../../gestures/GestureCoordinator", () => ({ pauseGestures: jest.fn(), resumeGestures: jest.fn() }));
const Sidebar = require("../../components/Timeline/AgendaSidebar.svelte").default;
const settle = async () => { await tick(); await tick(); };
const K = "views.calendar.agenda.custom.";
const originalActive = Object.getOwnPropertyDescriptor(globalThis, "activeDocument");

beforeEach(() => {
  Object.defineProperty(globalThis, "activeDocument", { configurable: true, value: document });
});
afterEach(() => {
  if (originalActive) Object.defineProperty(globalThis, "activeDocument", originalActive);
  else Reflect.deleteProperty(globalThis, "activeDocument");
  document.body.innerHTML = "";
});

const list = (id: string, name: string, order: number) => ({
  id, name, order, icon: { type: "lucide", value: "list" }, filterMode: "visual",
  filterGroup: { id: `g-${id}`, conjunction: "AND", filters: [], groups: [] }, collapsed: false,
});

async function mount(lists: unknown[] = []) {
  const saved: Array<{ id: string; name: string; order: number }> = [];
  const target = document.createElement("div");
  target.className = "calendar-zoom-container";
  document.body.append(target);
  const view = render(Sidebar, { target, props: {
    project: { id: "p", name: "Project", agenda: { mode: "custom", custom: { lists } } },
    currentDate: dayjs("2026-10-26"), fields: [], records: [],
  } });
  view.component.$on("saveList", (e: CustomEvent) => saved.push(e.detail.list));
  await settle();
  return { view, saved, target };
}

const nameInput = (root: ParentNode) => root.querySelector<HTMLInputElement>(".agenda-list-name input")!;

describe("custom agenda lists intersect the selected day with their conditions", () => {
  it("scopes empty and filtered lists to the day, includes spanning events and follows date navigation", async () => {
    const todo = { ...list("todo", "Todo", 0), filterGroup: { id:"g",conjunction:"AND",groups:[],filters:[{id:"s",field:"status",operator:"is",value:"todo",enabled:true}] } };
    const records = [
      {id:"today.md",values:{title:"Today",startDate:"2026-10-26",status:"todo"}},
      {id:"done.md",values:{title:"Done",startDate:"2026-10-26",status:"done"}},
      {id:"tomorrow.md",values:{title:"Tomorrow",startDate:"2026-10-27",status:"todo"}},
      {id:"span.md",values:{title:"Spanning",startDate:"2026-10-25",endDate:"2026-10-27",status:"todo"}},
      {id:"undated.md",values:{title:"Undated",status:"todo"}},
    ];
    const view=render(Sidebar,{props:{project:{id:"p",name:"Project",agenda:{mode:"custom",custom:{lists:[todo,list("all","All",1)]}}},
      currentDate:dayjs("2026-10-26"),records,fields:[],titleField:"title",dateField:"startDate"}});
    await settle();
    const shown=()=>Array.from(view.container.querySelectorAll(".agenda-custom-list"),el=>Array.from(el.querySelectorAll(".item-title"),t=>t.textContent));
    expect(shown()).toEqual([["Today","Spanning"],["Today","Done","Spanning"]]);
    await view.component.$set({currentDate:dayjs("2026-10-27")});await settle();
    expect(shown()).toEqual([["Tomorrow","Spanning"],["Tomorrow","Spanning"]]);
  });
});

test("versioned list and real editor preview share the selected subset, date and case-insensitive schema", async () => {
  jest.useFakeTimers();
  try {
    const expression = 'AND(SUM(@QTY) = 5, TODAY() = "2026-10-26")';
    const saved: unknown[] = [];
    const definition = { ...list("formula", "Formula", 0), filterMode: "advanced", filterFormula: expression, formulaVersion: "unified-v1" };
    const records = [
      { id: "a", values: { title: "First", startDate: "2026-10-26", qty: 2 } },
      { id: "b", values: { title: "Second", startDate: "2026-10-26", qty: 3 } },
      { id: "c", values: { title: "Tomorrow", startDate: "2026-10-27", qty: 100 } },
    ];
    const fields = [{ name: "qty", type: "number", repeated: false, derived: false, identifier: false }];
    const view = render(Sidebar, { props: { project: { id: "p", name: "Project", agenda: { mode: "custom", custom: { lists: [definition] } } },
      currentDate: dayjs("2026-10-26"), records, fields, titleField: "title", dateField: "startDate" } });
    view.component.$on("saveList", (event: CustomEvent) => saved.push(event.detail.list));
    await settle();
    expect(Array.from(view.container.querySelectorAll(".item-title"), element => element.textContent)).toEqual(["First", "Second"]);
    const { openContextMenu } = require("src/lib/contextMenu");
    openContextMenu.mockImplementation((items: Array<{ title?: string; onClick?: () => void }>) => {
      items.find(item => item.title === `${K}edit-list`)!.onClick!();
    });
    await fireEvent.contextMenu(view.container.querySelector(".list-header")!); await settle();
    const overlay = document.querySelector(".ppp-list-editor-overlay")!;
    jest.advanceTimersByTime(700); await settle();
    expect(overlay.querySelector(".ppp-formula-agenda-preview")?.textContent).toBe("Matches:2/2");
    await fireEvent.input(overlay.querySelector("#list-name")!, { target: { value: "Edited" } });
    await fireEvent.click(overlay.querySelector(".header-save")!); await settle();
    expect(saved).toEqual([expect.objectContaining({ name: "Edited", filterFormula: expression, formulaVersion: "unified-v1" })]);
    view.unmount();
  } finally { jest.useRealTimers(); }
});

async function type(input: HTMLInputElement, text: string) {
  input.focus();
  await fireEvent.input(input, { target: { value: text } });
}

test("«Add list» opens a name row in the agenda, not a window; Enter creates the list there", async () => {
  const { view, saved } = await mount([list("a", "Срочные", 0)]);
  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  expect(document.querySelector(".ppp-list-editor-overlay")).toBeNull();
  const row = view.container.querySelector(".custom-list-draft")!;
  expect(row).not.toBeNull();
  // The row sits after the lists, where the new list will appear.
  expect(view.container.querySelector(".custom-lists + .custom-list-draft")).toBe(row);
  const input = nameInput(row);
  expect(document.activeElement).toBe(input);
  await type(input, "  Тест ");
  await fireEvent.keyDown(input, { key: "Enter" }); await settle();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: "Тест", order: 1, filterMode: "visual" });
  expect(view.container.querySelector(".custom-list-draft")).toBeNull();
});

test("a taken name stays in the row, marked; an empty one or ✕ drops the row", async () => {
  const { view, saved } = await mount([list("a", "Срочные", 0)]);
  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  let input = nameInput(view.container);
  await type(input, "срочные");
  await fireEvent.keyDown(input, { key: "Enter" }); await settle();
  expect(saved).toHaveLength(0);
  expect(view.container.querySelector(".name-error")).toHaveTextContent(`${K}list-editor.name-exists`);
  expect(input.value).toBe("срочные");
  await fireEvent.click(view.container.querySelector(`[aria-label="${K}list-editor.cancel"]`)!); await settle();
  expect(view.container.querySelector(".custom-list-draft")).toBeNull();

  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  input = nameInput(view.container);
  input.blur(); await settle();
  expect(saved).toHaveLength(0);
  expect(view.container.querySelector(".custom-list-draft")).toBeNull();
});

test("leaving the row with a name keeps it (blur commits, as every field); ✓ does too", async () => {
  const { view, saved } = await mount();
  // The empty state's button names in place too, and the empty text yields to the row.
  await fireEvent.click(view.container.querySelector(".custom-add-empty")!); await settle();
  expect(view.container.querySelector(".custom-empty")).toBeNull();
  const input = nameInput(view.container);
  await type(input, "Дом");
  input.blur(); await settle();
  expect(saved.map(l => l.name)).toEqual(["Дом"]);

  await fireEvent.click(view.container.querySelector(".custom-add-empty")!); await settle();
  await type(nameInput(view.container), "Работа");
  const check = view.container.querySelector<HTMLElement>(`[aria-label="${K}list-editor.create"]`)!;
  // ✓ does not take the focus (a blur would commit before the click).
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  check.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  await fireEvent.click(check); await settle();
  expect(saved.map(l => l.name)).toEqual(["Дом", "Работа"]);
});

test("a tap on the row's buttons does not release the field on its way (touch)", async () => {
  const { view, saved } = await mount();
  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  const input = nameInput(view.container);
  await type(input, "Черновик");
  const cancel = view.container.querySelector<HTMLElement>(`[aria-label="${K}list-editor.cancel"]`)!;
  const press = (type: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: 5, clientY: 5, pointerId: 1 });
    cancel.dispatchEvent(e);
  };
  press("pointerdown"); press("pointerup");
  expect(document.activeElement).toBe(input);
  await fireEvent.click(cancel); await settle();
  expect(saved).toHaveLength(0);
});

test("the row's gear hands the typed name to the full editor, which on a phone takes the visible screen", async () => {
  const { view, target } = await mount();
  jest.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 0, top: 370, right: 390, bottom: 800, width: 390, height: 430 } as DOMRect);
  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  await type(nameInput(view.container), "Тест");
  await fireEvent.click(view.container.querySelector(`[aria-label="${K}edit-list"]`)!); await settle();
  const overlay = document.querySelector<HTMLElement>(".ppp-list-editor-overlay")!;
  expect(overlay.querySelector<HTMLInputElement>("#list-name")!.value).toBe("Тест");
  expect(overlay).toHaveClass("obsidian-projects-agenda-overlay--viewport");
  // Not the calendar strip that starts at 370 px (the sliver on the iPhone shot).
  expect(overlay.style.top).not.toBe("23.125rem");
  view.unmount();
});

test("«Rename list» turns the list's header into its name field", async () => {
  const { view, saved } = await mount([list("a", "Срочные", 0), list("b", "Дом", 1)]);
  const first = view.container.querySelector(".agenda-custom-list")!;
  const header = first.querySelector(".list-header")!;
  // The list menu, run as Obsidian's menu would: pick «Rename list».
  const { openContextMenu } = require("src/lib/contextMenu");
  openContextMenu.mockImplementation((items: unknown) => {
    const rename = (items as Array<{ title?: string; onClick?: () => void }>).find(i => i.title === `${K}rename-list`);
    rename?.onClick?.();
  });
  await fireEvent.contextMenu(header); await settle();
  const input = nameInput(first);
  expect(input.value).toBe("Срочные");
  expect(document.activeElement).toBe(input);
  await type(input, "дом");
  await fireEvent.keyDown(input, { key: "Enter" }); await settle();
  expect(saved).toHaveLength(0);
  await type(input, "Срочное");
  await fireEvent.keyDown(input, { key: "Enter" }); await settle();
  expect(saved).toEqual([expect.objectContaining({ id: "a", name: "Срочное", order: 0 })]);
  expect(first.querySelector(".agenda-list-name")).toBeNull();
});

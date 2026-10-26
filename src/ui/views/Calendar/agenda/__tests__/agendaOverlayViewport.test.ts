import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import dayjs from "dayjs";
// The Svelte CJS test compiler reads .default, while dayjs exports a function.
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
  return { i18n: writable({ t: (key: string) => key }) };
});
jest.mock("../../gestures/GestureCoordinator", () => ({ pauseGestures: jest.fn(), resumeGestures: jest.fn() }));
const Sidebar = require("../../components/Timeline/AgendaSidebar.svelte").default;
const settle = async () => { await tick(); await tick(); };
const originalActive = Object.getOwnPropertyDescriptor(globalThis, "activeDocument");
const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
let viewport: EventTarget & { width: number; height: number; offsetTop: number; offsetLeft: number };
beforeEach(() => {
  Object.defineProperty(globalThis, "activeDocument", { configurable: true, value: document });
  viewport = Object.assign(new EventTarget(), { width: 390, height: 240, offsetTop: 80, offsetLeft: 0 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
});
afterEach(() => {
  if (originalActive) Object.defineProperty(globalThis, "activeDocument", originalActive);
  else Reflect.deleteProperty(globalThis, "activeDocument");
  if (originalViewport) Object.defineProperty(window, "visualViewport", originalViewport);
  else Reflect.deleteProperty(window, "visualViewport");
  jest.restoreAllMocks();
});
async function open(target?: HTMLElement) {
  const view = render(Sidebar, { target, props: {
    project: { id: "p", name: "Project", agenda: { mode: "custom", custom: { lists: [] } } },
    currentDate: dayjs("2026-10-09"), fields: [], records: [],
  } });
  await settle();
  await fireEvent.click(view.container.querySelector(".custom-add-btn")!); await settle();
  // w4-input2: «Add list» names the list in place; the row's gear opens the editor.
  await fireEvent.click(view.container.querySelector('[aria-label="views.calendar.agenda.custom.edit-list"]')!); await settle();
  return view;
}

test("the real agenda editor fallback fits the visible viewport immediately and releases listeners", async () => {
  const view = await open();
  const overlay = document.querySelector<HTMLElement>(".ppp-list-editor-overlay")!;
  expect(overlay.style.top).toBe("5rem"); expect(overlay.style.height).toBe("15rem");
  viewport.offsetTop = 100; viewport.height = 160; viewport.dispatchEvent(new Event("resize"));
  expect(overlay.style.top).toBe("6.25rem"); expect(overlay.style.height).toBe("10rem");
  view.unmount(); viewport.height = 40; viewport.dispatchEvent(new Event("scroll"));
  expect(overlay.style.height).toBe("10rem");
});

test("calendar-container bounds are intersected with the unobscured viewport, not trusted blindly", async () => {
  // A computer: a phone's editor takes the whole visible screen (w4-input2 test).
  const { isMobileDevice } = require("src/lib/stores/ui");
  isMobileDevice.set(false);
  const target = document.createElement("div"); target.className = "calendar-zoom-container"; document.body.append(target);
  jest.spyOn(target, "getBoundingClientRect").mockReturnValue({ left: 20, top: 120, right: 380, bottom: 800, width: 360, height: 680 } as DOMRect);
  const view = await open(target);
  try {
    const overlay = document.querySelector<HTMLElement>(".ppp-list-editor-overlay")!;
    expect(overlay.style.top).toBe("7.5rem"); expect(overlay.style.height).toBe("12.5rem");
    viewport.offsetLeft = 40; viewport.width = 280; viewport.height = 180; viewport.dispatchEvent(new Event("scroll"));
    expect(overlay.style.left).toBe("2.5rem"); expect(overlay.style.width).toBe("17.5rem");
    expect(overlay.style.height).toBe("8.75rem");
  } finally { view.unmount(); target.remove(); isMobileDevice.set(true); }
});

test("a popout editor listens to its own viewport, not the main window", async () => {
  const frame = document.createElement("iframe"); document.body.append(frame);
  const own = frame.contentWindow!, doc = frame.contentDocument!;
  const ownViewport = Object.assign(new EventTarget(), { width: 320, height: 200, offsetTop: 40, offsetLeft: 8 });
  Object.defineProperty(own, "visualViewport", { configurable: true, value: ownViewport });
  const view = await open(doc.body);
  try {
    expect(document.querySelector(".ppp-list-editor-overlay")).toBeNull();
    const overlay = doc.querySelector<HTMLElement>(".ppp-list-editor-overlay")!;
    expect(overlay.style.top).toBe("2.5rem"); expect(overlay.style.height).toBe("12.5rem");
    viewport.height = 100; viewport.dispatchEvent(new Event("resize"));
    expect(overlay.style.height).toBe("12.5rem");
    ownViewport.height = 100; ownViewport.dispatchEvent(new Event("resize"));
    expect(overlay.style.height).toBe("6.25rem");
  } finally { view.unmount(); frame.remove(); }
});

test("the already-fitted editor does not add a second keyboard-sized blank scroll area", async () => {
  const view = await open();
  try {
    viewport.dispatchEvent(new Event("resize")); await settle();
    expect(document.querySelector<HTMLElement>(".editor-content")!.style.paddingBottom).toBe("");
  } finally { view.unmount(); }
});

test("focusing a field outside the visible bounds requests local scrolling", async () => {
  const view = await open();
  try {
    const input = document.querySelector<HTMLInputElement>(".agenda-list-editor input")!;
    jest.spyOn(input, "getBoundingClientRect").mockReturnValue({ top: 400, bottom: 430 } as DOMRect);
    const scroll = jest.fn(); Object.defineProperty(input, "scrollIntoView", { configurable: true, value: scroll });
    input.focus();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
  } finally { view.unmount(); }
});

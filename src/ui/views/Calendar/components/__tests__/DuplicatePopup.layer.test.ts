/**
 * The calendar duplicate window is its own top layer (stab-dup).
 *
 * It used to render inline in the day popup's component tree, inside the view's
 * stacking context, while the day popup lived in a portal layer of its own: the
 * window opened UNDER the popup it was called from, focus stayed on the popup's
 * action button, and Escape was a window-level listener.
 *
 * What is pinned, against the mounted component:
 *   - the window is a child of the body of its own document, not of the host;
 *   - focus is inside it right after it opens;
 *   - Escape is heard on the window and closes only the window: it does not
 *     reach the document, and an Escape aimed at something else closes nothing;
 *   - a click on the backdrop closes it, a click inside does not.
 *
 * jsdom has one window, so the popout half (the portal resolves the node's own
 * document) is pinned by A192_portalContract, not here. The month grid is a
 * stand-in: it is not what is under test.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import dayjs from "dayjs";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    }),
  };
});

// The store runs the phantom and collision engines over a whole calendar
// frame; the window only reads a selection count from it.
jest.mock("src/lib/stores/duplicateStore", () => {
  const { writable } = require("svelte/store");
  const state = writable({
    sourceRecord: null,
    sourceDate: null,
    editedTime: null,
    selectedDates: new Set<string>(["2026-03-12"]),
    hoveredDate: null,
    phantomRecords: new Map(),
    collisions: new Map(),
  });
  return {
    duplicateStore: {
      subscribe: state.subscribe,
      init: jest.fn(),
      reset: jest.fn(),
      getTargetDates: jest.fn(() => []),
      setStartTime: jest.fn(),
      setEndTime: jest.fn(),
    },
  };
});

jest.mock("../DuplicatePopup/DuplicateCalendarView.svelte", () =>
  require("./mocks/DuplicateCalendarView.mock.svelte")
);

const DuplicatePopup = require("../DuplicatePopup/DuplicatePopup.svelte").default;

const sourceRecord = {
  record: { id: "Visits/visit.md", values: {} },
  startDate: dayjs("2026-03-12"),
  timeInfo: null,
  spanInfo: null,
};
const existingData = { processed: [], grouped: {} };

describe("DuplicatePopup — the window is the top layer", () => {
  let host: HTMLDivElement;
  let component: { $on: (name: string, cb: (e: CustomEvent) => void) => void; $destroy: () => void };
  let closed: jest.Mock;

  async function open() {
    // The host stands for the calendar view: the window used to stay inside it.
    host = document.createElement("div");
    host.className = "projects-main";
    document.body.appendChild(host);
    // What had focus when the window opened: the day popup's action button.
    const opener = document.createElement("button");
    opener.textContent = "Действия";
    host.appendChild(opener);
    opener.focus();

    component = new DuplicatePopup({
      target: host,
      props: { visible: true, sourceRecord, existingData },
    });
    closed = jest.fn();
    component.$on("close", closed);
    await tick();
  }

  afterEach(() => {
    component?.$destroy();
    host?.remove();
    document.body.innerHTML = "";
  });

  test("it is mounted on the body, not inside the view that opened it", async () => {
    await open();
    const backdrop = document.querySelector(".duplicate-backdrop");
    expect(backdrop).not.toBeNull();
    expect(backdrop?.parentElement).toBe(document.body);
    expect(host.contains(backdrop)).toBe(false);
  });

  // w4-p06 (#34): the window takes the keyboard-visible area, the shared
  // popups' rule — a time field's keyboard no longer covers its footer.
  test("it is fitted to the visible viewport and follows the keyboard", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
    const viewport = Object.assign(new EventTarget(), { offsetTop: 0, offsetLeft: 0, width: 390, height: 800 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    try {
      await open();
      const backdrop = document.querySelector<HTMLElement>(".duplicate-backdrop")!;
      expect(backdrop.style.height).toBe("50rem");
      viewport.height = 480;
      viewport.dispatchEvent(new Event("resize"));
      expect(backdrop.style.height).toBe("30rem");
    } finally {
      if (descriptor) Object.defineProperty(window, "visualViewport", descriptor);
      else Reflect.deleteProperty(window, "visualViewport");
    }
  });

  test("it carries the shared modal root and the dialog semantics", async () => {
    await open();
    expect(document.querySelector(".duplicate-backdrop")).toHaveClass("ppp-modal");
    const dialog = document.querySelector(".duplicate-modal");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("focus is inside the window as soon as it opens", async () => {
    await open();
    const dialog = document.querySelector(".duplicate-modal") as HTMLElement;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  test("Escape inside the window closes the window and goes no further", async () => {
    await open();
    const reached = jest.fn();
    document.addEventListener("keydown", reached);
    const target = document.activeElement as HTMLElement;
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    document.removeEventListener("keydown", reached);
    expect(closed).toHaveBeenCalledTimes(1);
    // Obsidian, the day popup behind and anything else listening on the
    // document must not also act on the key.
    expect(reached).not.toHaveBeenCalled();
    await tick();
    expect(document.querySelector(".duplicate-backdrop")).toBeNull();
  });

  test("an Escape aimed outside the window closes nothing", async () => {
    await open();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(closed).not.toHaveBeenCalled();
    expect(document.querySelector(".duplicate-backdrop")).not.toBeNull();
  });

  test("a click on the backdrop closes it, a click inside does not", async () => {
    await open();
    const dialog = document.querySelector(".duplicate-modal") as HTMLElement;
    dialog.click();
    expect(closed).not.toHaveBeenCalled();
    (document.querySelector(".duplicate-backdrop") as HTMLElement).click();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});

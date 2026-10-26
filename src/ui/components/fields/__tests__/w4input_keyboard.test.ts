/**
 * w4-input — fields, suggestions and the keyboard follow Obsidian's own model.
 *
 * Obsidian's mobile app does not shrink the web view for the on-screen
 * keyboard: it reports the keyboard as `--keyboard-height` on the root and lays
 * its UI out by that. These tests stand in for the iPhone: the visual viewport
 * keeps the window's full height while `--keyboard-height` says 300 px.
 *
 * - The visible area ends at the keyboard (sheets, lists, the field's scroll).
 * - The "hide keyboard" control is Obsidian's element (`keyboard-toggle` in
 *   `.mobile-toolbar-floating-options`), shown only with a keyboard up, and its
 *   press takes the focus as Obsidian's does — no `inputmode` games.
 *
 * Why these fail on the old code: the visible area was the visual viewport
 * alone (the keyboard covered the sheet, its search and the list), and the
 * w4-p06 button was a "⌄" of ours that kept the focus with `inputmode="none"`.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import { writable } from "svelte/store";

const mockMobile = writable(false);
jest.mock("src/lib/stores/ui", () => ({
  get isMobile() {
    return mockMobile;
  },
}));

const FloatingPopup = require("src/ui/components/FloatingPopup/FloatingPopup.svelte").default;
const ComboField = require("../ComboField.svelte").default;
const TextField = require("../TextField.svelte").default;
const { visibleViewport } = require("src/ui/utils/visibleViewport");
const { keepInView } = require("../keepInView");
const PopoverList = require("src/ui/components/FloatingPopup/PopoverList.svelte").default;

const settle = async () => { await tick(); await tick(); };
const box = (top: number, height: number, left = 20, width = 300) =>
  ({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) });
const px = (rem: string) => parseFloat(rem) * 16;
const keyboard = (height: number) => document.documentElement.style.setProperty("--keyboard-height", `${height}px`);

const inner = Object.getOwnPropertyDescriptor(window, "innerHeight");
beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 400 });
});
afterEach(() => {
  if (inner) Object.defineProperty(window, "innerHeight", inner);
  document.documentElement.style.removeProperty("--keyboard-height");
  document.body.className = "";
  document.body.innerHTML = "";
  mockMobile.set(false);
  jest.restoreAllMocks();
});

describe("the visible area ends at Obsidian's keyboard", () => {
  test("--keyboard-height cuts the window; without it the window is whole", () => {
    expect(visibleViewport(window).bottom).toBe(800);
    keyboard(300);
    const area = visibleViewport(window);
    expect(area.bottom).toBe(500);
    expect(area.height).toBe(500);
  });

  test("a viewport panned by iOS keeps the keyboard's cut from its own top", () => {
    keyboard(300);
    const pan = { width: 400, height: 800, offsetTop: 120, offsetLeft: 0, addEventListener: jest.fn(), removeEventListener: jest.fn() };
    Object.defineProperty(window, "visualViewport", { configurable: true, value: pan });
    try {
      const area = visibleViewport(window);
      expect(area.top).toBe(120);
      expect(area.bottom).toBe(620);
    } finally {
      delete (window as { visualViewport?: unknown }).visualViewport;
    }
  });

  test("the shown keyboard-button strip is taken too, as Obsidian's toolbar is from a note", () => {
    keyboard(300);
    const bar = document.body.createDiv({ cls: "ppp-keyboard-bar" });
    bar.getBoundingClientRect = () => box(452, 48) as DOMRect;
    expect(visibleViewport(window).bottom).toBe(452);
    bar.hidden = true;
    expect(visibleViewport(window).bottom).toBe(500);
  });

  test("a phone sheet stands on the keyboard, and moves when the keyboard comes", async () => {
    mockMobile.set(true);
    const anchor = document.createElement("button");
    document.body.append(anchor);
    const view = render(FloatingPopup, { props: { open: true, triggerEl: anchor, role: "listbox" } });
    await settle();
    const layer = document.querySelector<HTMLElement>(".ppp-popup-backdrop")!;
    expect(px(layer.style.height)).toBeCloseTo(800, 0);
    keyboard(300);
    await new Promise((r) => setTimeout(r, 0));
    expect(px(layer.style.height)).toBeCloseTo(500, 0);
    view.unmount();
  });

  test("a suggestion list does not open under the keyboard: it stands over its field", async () => {
    keyboard(300);
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("ppp-combo") ? box(420, 40) : box(0, 160);
    });
    jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(160);
    const view = render(ComboField, { props: { value: "", options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }], allowCustom: true } });
    view.container.querySelector<HTMLInputElement>("input")!.focus();
    await settle();
    const popup = document.querySelector<HTMLElement>(".ppp-combo-popup")!;
    const top = px(popup.style.top);
    expect(top + Math.min(160, px(popup.style.maxHeight))).toBeLessThanOrEqual(420);
    view.unmount();
  });

  test("a focused field under the keyboard is scrolled into the visible part", () => {
    keyboard(300);
    const input = document.createElement("input");
    document.body.append(input);
    input.getBoundingClientRect = () => box(600, 40);
    const scrolled = jest.fn();
    input.scrollIntoView = scrolled;
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
    const action = keepInView(input);
    input.focus();
    expect(scrolled).toHaveBeenCalled();
    action.destroy();
    window.requestAnimationFrame = raf;
  });
});

describe("the keyboard button is Obsidian's", () => {
  const focusField = async () => {
    const view = render(TextField, { props: { value: "x" } });
    const input = view.container.querySelector<HTMLInputElement>("input")!;
    input.focus();
    await settle();
    return { view, input };
  };

  test("with a keyboard up: Obsidian's keyboard-toggle element; its press takes the focus, nothing else", async () => {
    document.body.classList.add("is-mobile");
    keyboard(300);
    const obsidian = require("obsidian");
    const { view, input } = await focusField();
    const option = document.querySelector<HTMLElement>(".ppp-keyboard-bar .mobile-toolbar-floating-options .mobile-toolbar-option")!;
    expect(option).not.toBeNull();
    expect(option.closest<HTMLElement>(".ppp-keyboard-bar")!.hidden).toBe(false);
    expect(obsidian.setIcon).toHaveBeenCalledWith(option, "keyboard-toggle");
    expect(input.getAttribute("inputmode")).not.toBe("none");
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    option.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    option.click();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(input);
    expect(input.getAttribute("inputmode")).not.toBe("none");
    expect(document.querySelector(".ppp-keyboard-bar")).toBeNull();
    view.unmount();
  });

  test("no keyboard reported (hardware keyboard, closed): the button waits hidden, and shows when it comes", async () => {
    document.body.classList.add("is-mobile");
    const { view } = await focusField();
    const bar = document.querySelector<HTMLElement>(".ppp-keyboard-bar")!;
    expect(bar.hidden).toBe(true);
    keyboard(300);
    window.dispatchEvent(new Event("keyboardDidShow"));
    expect(bar.hidden).toBe(false);
    view.unmount();
  });

  test("outside Obsidian's mobile app there is no button", async () => {
    keyboard(300);
    const { view } = await focusField();
    expect(document.querySelector(".ppp-keyboard-bar")).toBeNull();
    view.unmount();
  });
});

describe("a picker in a phone sheet is Obsidian's SuggestModal shape", () => {
  test("on a phone the search sits under the list; on a computer it leads", async () => {
    const items = [{ label: "client" }, { label: "price" }];
    mockMobile.set(true);
    const phone = render(PopoverList, { props: { items, searchable: true } });
    await settle();
    expect(phone.container.querySelector(".ppp-pop-picker")).toHaveClass("ppp-pop-picker--search-below");
    phone.unmount();
    mockMobile.set(false);
    const pc = render(PopoverList, { props: { items, searchable: true } });
    await settle();
    expect(pc.container.querySelector(".ppp-pop-picker")).not.toHaveClass("ppp-pop-picker--search-below");
    pc.unmount();
  });

  test("the sheet scrolls only the list; the search under it is ordered last", () => {
    const css = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "..", "..", "..", "styles.css"), "utf8");
    expect(css).toMatch(/\.ppp-popup--bottom-sheet:has\(> \.ppp-pop-picker\) \{[^}]*overflow: hidden/);
    expect(css).toMatch(/\.ppp-pop-picker > \.ppp-pop-list \{[^}]*overflow-y: auto/);
    expect(css).toMatch(/\.ppp-pop-picker--search-below > \.ppp-pop-search \{[^}]*order: 2/);
  });
});

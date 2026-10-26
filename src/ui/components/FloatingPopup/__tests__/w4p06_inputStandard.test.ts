/**
 * w4-p06 (N9, CONSOLIDATION §7 rows 11–12) — the input standard, as far as a
 * browser model can show it: a list stays against its field and within the
 * room left, at a sane height; list rows are rows, not raised buttons; a
 * suggestion list stands over its field on a computer too; when the keyboard
 * goes, the view comes back. (The keyboard button is w4-input's now:
 * fields/__tests__/w4input_keyboard.test.ts.)
 *
 * Why these fail on the old code: a popup taller than the room was clamped to
 * the window's top edge (0.5rem), far from its field, as tall as the window;
 * the global row rule lost to Obsidian's button rule; ComboField opened under
 * the field on a fine pointer; there was no keyboard button and no restore.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FloatingPopup = require("../FloatingPopup.svelte").default;
const ComboField = require("src/ui/components/fields/ComboField.svelte").default;
const { keepInView } = require("src/ui/components/fields/keepInView");

const settle = async () => { await tick(); await tick(); };
const box = (top: number, height: number, left = 300, width = 200) =>
  ({ top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) });
const px = (rem: string) => parseFloat(rem) * 16;

const sizeDescriptor = { inner: Object.getOwnPropertyDescriptor(window, "innerHeight") };
beforeEach(() => {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1360 });
});
afterEach(() => {
  if (sizeDescriptor.inner) Object.defineProperty(window, "innerHeight", sizeDescriptor.inner);
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

describe("w4-p06 — a popup stays against its anchor (N9, PC)", () => {
  test("a menu taller than the room is not moved to the window's top: it sits over its anchor, capped", async () => {
    // The agenda filter row's field chip at 577..597 in a 768 px window, and
    // a field list of 22 rows (≈ 900 px), as on the report's screenshot.
    const anchor = document.createElement("button");
    document.body.append(anchor);
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this === anchor ? box(577, 20, 600, 120) : box(0, 900, 0, 220);
    });
    jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
    const view = render(FloatingPopup, { props: { open: true, triggerEl: anchor, role: "menu" } });
    await settle();
    const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
    const top = px(popup.style.top);
    const maxHeight = px(popup.style.maxHeight);
    expect(maxHeight).toBeLessThanOrEqual(20 * 16);
    // Over the anchor (more room above): its bottom edge is the anchor's top.
    expect(top + maxHeight).toBeCloseTo(577 - 4, 0);
    expect(top).toBeGreaterThan(8);
    view.unmount();
  });

  test("with room under its anchor, a menu opens under it", async () => {
    const anchor = document.createElement("button");
    document.body.append(anchor);
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this === anchor ? box(100, 20, 600, 120) : box(0, 200, 0, 220);
    });
    jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
    const view = render(FloatingPopup, { props: { open: true, triggerEl: anchor, role: "menu" } });
    await settle();
    const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
    expect(px(popup.style.top)).toBeCloseTo(124, 0);
    view.unmount();
  });

  test("list rows are rows: the shared rule outranks Obsidian's button and drops its chrome", () => {
    const css = readFileSync(join(__dirname, "..", "..", "..", "..", "..", "styles.css"), "utf8");
    const rule = /\.ppp-pop-list \.ppp-pop-item \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/box-shadow:\s*none/);
    expect(rule).toMatch(/height:\s*auto/);
  });
});

describe("w4-p06 — a suggestion list stands over its field (the standard, PC too)", () => {
  test("on a fine pointer the list opens above the field when rows fit there", async () => {
    jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("ppp-combo") ? box(400, 28) : box(0, 80);
    });
    const view = render(ComboField, { props: { value: "", options: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }], allowCustom: true } });
    view.container.querySelector<HTMLInputElement>("input")!.focus();
    await settle();
    const popup = document.querySelector<HTMLElement>(".ppp-combo-popup")!;
    expect(px(popup.style.top)).toBeLessThan(400);
    view.unmount();
  });
});

describe("w4-p06 — the view's return (touch)", () => {
  test("when the keyboard goes, the scroll it caused is put back", () => {
    const scroller = document.createElement("div");
    const input = document.createElement("input");
    scroller.append(input);
    document.body.append(scroller);
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 600 });
    scroller.scrollTop = 120;
    let height = 800;
    const bounds = () => ({ top: 0, left: 0, right: 400, bottom: height, width: 400, height });
    let fieldTop = 600;
    input.getBoundingClientRect = () => box(fieldTop, 40);
    input.scrollIntoView = () => { scroller.scrollTop = 520; fieldTop = 200; };
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
    const action = keepInView(input, bounds);
    input.focus();
    height = 400; window.dispatchEvent(new Event("resize"));
    expect(scroller.scrollTop).toBe(520);
    height = 800; fieldTop = 200; window.dispatchEvent(new Event("resize"));
    expect(scroller.scrollTop).toBe(120);
    action.destroy();
    window.requestAnimationFrame = raf;
  });
});

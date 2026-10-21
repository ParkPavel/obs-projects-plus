import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});
const { isMobile } = require("src/lib/stores/ui");
const FloatingPopup = require("../FloatingPopup.svelte").default;
const ComboField = require("src/ui/components/fields/ComboField.svelte").default;
const PopupCombo = require("./PopupCombo.fixture.svelte").default;
const settle = async () => { await tick(); await tick(); };
const escape = (input: HTMLElement) => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

it("Escape closes an inner suggestion first, then the untouched parent popup", async () => {
  const view = render(PopupCombo); await settle();
  const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
  input.focus(); await settle();
  expect(document.querySelector('[role="listbox"]')).not.toBeNull();
  escape(input); await settle();
  expect(document.querySelector('[role="listbox"]')).toBeNull();
  expect(document.querySelector(".ppp-popup--floating")).not.toBeNull();
  escape(input); await settle();
  expect(document.querySelector(".ppp-popup--floating")).toBeNull();
  view.unmount();
});

it("only the most recently opened popup owns Escape", async () => {
  const first = render(FloatingPopup, { props: { open: true, ariaLabel: "Parent" } });
  await settle();
  const second = render(FloatingPopup, { props: { open: true, ariaLabel: "Child" } });
  await settle();
  document.querySelector<HTMLElement>('[aria-label="Child"]')!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); await settle();
  expect(document.querySelector('[aria-label="Parent"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Child"]')).not.toBeNull();
  escape(document.querySelector<HTMLElement>('[aria-label="Child"]')!); await settle();
  expect(document.querySelector('[aria-label="Parent"]')).not.toBeNull();
  expect(document.querySelector('[aria-label="Child"]')).toBeNull();
  escape(document.querySelector<HTMLElement>('[aria-label="Parent"]')!); await settle();
  expect(document.querySelector('[aria-label="Parent"]')).toBeNull();
  first.unmount(); second.unmount();
});

describe("keyboard-visible viewport, not the covered layout viewport", () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
  let viewport: EventTarget & { offsetTop: number; offsetLeft: number; width: number; height: number };
  beforeEach(() => {
    viewport = Object.assign(new EventTarget(), { offsetTop: 100, offsetLeft: 0, width: 300, height: 200 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  });
  afterEach(() => {
    isMobile.set(false);
    if (descriptor) Object.defineProperty(window, "visualViewport", descriptor);
    else Reflect.deleteProperty(window, "visualViewport");
  });

  it("the mobile backdrop follows keyboard resize and viewport panning, then removes listeners", async () => {
    isMobile.set(true);
    const view = render(FloatingPopup, { props: { open: true } }); await settle();
    const backdrop = document.querySelector<HTMLElement>(".ppp-popup-backdrop")!;
    expect(backdrop.style.top).toBe("6.25rem");
    expect(backdrop.style.height).toBe("12.5rem");
    viewport.height = 120; viewport.offsetTop = 140; viewport.dispatchEvent(new Event("resize")); await settle();
    expect(backdrop.style.height).toBe("7.5rem");
    expect(backdrop.style.top).toBe("8.75rem");
    view.unmount();
    viewport.height = 40; viewport.dispatchEvent(new Event("scroll"));
    expect(backdrop.style.height).toBe("7.5rem");
  });

  it("a combo list fits the visible area and follows its visualViewport events", async () => {
    const rect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const root = this.classList.contains("ppp-combo");
      return { left: root ? 250 : 0, top: root ? 220 : 0, right: root ? 450 : 200, bottom: root ? 248 : 80, width: 200, height: root ? 28 : 80, x: 0, y: 0, toJSON: () => ({}) };
    });
    try {
      const view = render(ComboField, { props: { value: "", options: [{ id: "a", label: "Alpha" }], allowCustom: true } });
      view.container.querySelector<HTMLInputElement>("input")!.focus(); await settle();
      const popup = document.querySelector<HTMLElement>(".ppp-combo-popup")!;
      expect(parseFloat(popup.style.left) * 16).toBeLessThanOrEqual(92);
      expect(popup.style.maxHeight).not.toBe("");
      const before = popup.style.top;
      // i3-input: the keyboard leaves the field visible but little room below
      // it — the list moves above the field.
      viewport.height = 300; viewport.dispatchEvent(new Event("resize")); await settle();
      expect(popup.style.top).not.toBe(before);
      // A keyboard that covers the field itself closes the list instead of
      // pinning it to the visible edge, away from its field.
      viewport.height = 100; viewport.dispatchEvent(new Event("resize")); await settle();
      expect(document.querySelector(".ppp-combo-popup")).toBeNull();
      view.unmount();
    } finally { rect.mockRestore(); }
  });

  it("the desktop popup also stays above the keyboard and follows viewport resize", async () => {
    const anchor = document.createElement("button"); document.body.append(anchor);
    const rect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return { left: 250, top: this === anchor ? 220 : 0, right: 450, bottom: this === anchor ? 248 : 80, width: 200, height: this === anchor ? 28 : 80, x: 0, y: 0, toJSON: () => ({}) };
    });
    try {
      const view = render(FloatingPopup, { props: { open: true, triggerEl: anchor } }); await settle();
      const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
      expect(parseFloat(popup.style.left) * 16).toBeLessThanOrEqual(92);
      expect(parseFloat(popup.style.top) * 16 + 80).toBeLessThanOrEqual(292);
      expect(popup.style.maxHeight).not.toBe("");
      const before = popup.style.top;
      viewport.height = 100; viewport.dispatchEvent(new Event("resize")); await settle();
      expect(popup.style.top).not.toBe(before);
      view.unmount();
    } finally { rect.mockRestore(); anchor.remove(); }
  });
});

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

it("ignores an IME acceptance Escape reported by keyCode 229 in the popup's document", async () => {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  const view = iframe.contentWindow! as Window & typeof globalThis;
  const target = doc.createElement("div");
  const trigger = doc.createElement("button");
  doc.body.append(target, trigger);
  const component = new FloatingPopup({ target, props: { open: true, triggerEl: trigger, ariaLabel: "Popout" } });

  try {
    await settle();
    expect(doc.querySelector('[aria-label="Popout"]')).not.toBeNull();
    trigger.dispatchEvent(new view.Event("compositionend", { bubbles: true }));
    const escape229 = new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    Object.defineProperty(escape229, "keyCode", { value: 229 });
    doc.body.dispatchEvent(escape229);
    await settle();
    expect(doc.querySelector('[aria-label="Popout"]')).not.toBeNull();
  } finally {
    component.$destroy();
    iframe.remove();
  }
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
      const root = this.classList.contains("ppp-combo-input");
      return { left: root ? 250 : 0, top: root ? 220 : 0, right: root ? 450 : 200, bottom: root ? 248 : 80, width: 200, height: root ? 28 : 80, x: 0, y: 0, toJSON: () => ({}) };
    });
    try {
      const view = render(ComboField, { props: { value: "", options: [{ id: "a", label: "Alpha" }], allowCustom: true } });
      const input = view.container.querySelector<HTMLInputElement>("input")!;
      input.focus(); await settle();
      const popup = document.querySelector<HTMLElement>(".ppp-combo-popup")!;
      expect(parseFloat(popup.style.left) * 16).toBeLessThanOrEqual(92);
      expect(popup.style.maxHeight).not.toBe("");
      const before = popup.style.top;
      // PP-INPUT-004: lack of upper room hides the suggestions; it never flips.
      expect(parseFloat(popup.style.top) * 16).toBeLessThan(220);
      viewport.offsetTop = 200; viewport.dispatchEvent(new Event("scroll")); await settle();
      expect(popup.style.top).not.toBe(before);
      expect(popup).toHaveAttribute("aria-hidden", "true");
      // A keyboard that covers the field itself closes the list instead of
      // pinning it to the visible edge, away from its field.
      viewport.offsetTop = 100; viewport.height = 100; viewport.dispatchEvent(new Event("resize")); await settle();
      expect(popup).toHaveAttribute("aria-hidden", "true");
      expect(document.activeElement).toBe(input);
      expect(view.container.querySelector("input")).toBe(input);
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

  it("an anchored mobile popup stays within the keyboard-visible viewport", async () => {
    isMobile.set(true);
    const anchor = document.createElement("button");
    document.body.append(anchor);
    const rect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this === anchor) {
        return { left: 250, top: 220, right: 450, bottom: 248, width: 200, height: 28, x: 0, y: 0, toJSON: () => ({}) };
      }
      return { left: 0, top: 0, right: 200, bottom: 80, width: 200, height: 80, x: 0, y: 0, toJSON: () => ({}) };
    });
    try {
      const view = render(FloatingPopup, {
        props: { open: true, triggerEl: anchor, mobilePresentation: "anchored", role: "listbox", autoFocus: false },
      });
      await settle();
      const popup = document.querySelector<HTMLElement>(".ppp-popup--floating")!;
      const top = parseFloat(popup.style.top) * 16;
      expect(popup.style.maxHeight).not.toBe("");
      expect(top + 80).toBeLessThanOrEqual(visibleBottom() - 8);
      expect(document.querySelector(".ppp-popup-backdrop")).toBeNull();
      expect(popup).not.toHaveAttribute("aria-modal");

      const before = popup.style.top;
      viewport.offsetTop = 140;
      viewport.dispatchEvent(new Event("resize"));
      await settle();
      expect(popup.style.top).not.toBe(before);
      expect(parseFloat(popup.style.top) * 16 + 80).toBeLessThanOrEqual(visibleBottom() - 8);

      view.unmount();
    } finally {
      rect.mockRestore();
      anchor.remove();
    }

    function visibleBottom(): number {
      return viewport.offsetTop + viewport.height;
    }
  });
});

/**
 * w4-p07 (N13) — the day window's side.
 *
 * The day window used "right-start": with no room on the right it flipped
 * left only if the left had room, and otherwise was clamped over whatever was
 * there; anchored at the whole calendar it landed at the screen's edge. Now
 * "side-start" takes right, else left, else below, else above — chosen once
 * per opening, so a list that changes length does not move the window across
 * its day. An anchor re-rendered away no longer drags it to the corner.
 */

import "@testing-library/jest-dom";
import { rootFontPx } from "src/ui/utils/cssLength";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FloatingPopup = require("../FloatingPopup.svelte").default;

async function flush(ms = 20) {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, ms));
  await Promise.resolve();
}

function rect(r: Partial<DOMRect>): DOMRect {
  return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}), ...r } as DOMRect;
}

/** A day cell at `left..right`, rows 100..180, in a 1024 × 768 window. */
function cell(left: number, right: number): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  el.getBoundingClientRect = () => rect({ top: 100, bottom: 180, left, right, width: right - left, height: 80 });
  return el;
}

/** Opens the window at `anchor`, a `width` × `height` box; returns its left/top in px. */
async function open(anchor: HTMLElement, width: number, height: number) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new FloatingPopup({ target, props: { open: true, triggerEl: anchor, placement: "side-start" } });
  await flush();
  const popup = document.querySelector(".ppp-popup--floating") as HTMLElement;
  popup.getBoundingClientRect = () => rect({ width, height });
  window.dispatchEvent(new Event("resize"));
  await flush();
  return { component, popup, position: () => position(popup) };
}

function position(popup: HTMLElement) {
  const root = rootFontPx(document);
  const style = popup.getAttribute("style") ?? "";
  const left = parseFloat(style.match(/left:\s*([\d.]+)rem/)?.[1] ?? "NaN") * root;
  const top = parseFloat(style.match(/top:\s*([\d.]+)rem/)?.[1] ?? "NaN") * root;
  return { left, top };
}

describe("FloatingPopup side-start (the day window)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });

  it("opens to the right of the day when the right has room", async () => {
    const { position } = await open(cell(100, 200), 320, 300);
    expect(position().left).toBeGreaterThan(200);
    expect(position().top).toBe(100);
  });

  it("opens to the left when only the left has room", async () => {
    const { position } = await open(cell(800, 900), 320, 300);
    expect(position().left + 320).toBeLessThanOrEqual(800);
  });

  it("opens under the day when neither side has room", async () => {
    // A wide cell in the middle: 280 px left of it, 284 px right of it.
    const { position } = await open(cell(300, 740), 320, 300);
    expect(position().top).toBeGreaterThanOrEqual(180);
  });

  it("keeps its side when the list grows past the right edge's room", async () => {
    const { popup, position } = await open(cell(300, 400), 320, 300);
    expect(position().top).toBe(100);
    // The box grew past both sides' room: chosen afresh it would go under the
    // day (top ≥ 180). It stays beside it, clamped inside the window.
    popup.getBoundingClientRect = () => rect({ width: 700, height: 300 });
    window.dispatchEvent(new Event("resize"));
    await flush();
    expect(position().top).toBe(100);
  });

  it("stays put when its day is re-rendered away", async () => {
    const anchor = cell(100, 200);
    const { popup } = await open(anchor, 320, 300);
    const before = popup.getAttribute("style");
    anchor.remove();
    window.dispatchEvent(new Event("scroll"));
    await flush();
    expect(popup.getAttribute("style")).toBe(before);
  });
});

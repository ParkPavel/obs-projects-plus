/**
 * cards-g5 — the card resize handle, mounted on its own inside a card box.
 *
 * jsdom has no PointerEvent constructor and no pointer capture, so pointer
 * events are MouseEvents carrying a `pointerId`, and capture is stubbed on the
 * handle element. jsdom does no layout either: the root font is the 16 CSS
 * pixel fallback and the card measures 0, so a card with no saved height
 * starts from the lower bound. What is pinned is behaviour: capture, a live
 * preview with no write, exactly one write on release, none on cancel or
 * Escape, the keyboard steps, and that nothing the handle receives reaches
 * the card. The handle's CSS is read from source at the end.
 */

import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { tick } from "svelte";

import { stripCssComments, svelteStyles } from "src/__tests__/support/cssScan";

type Mounted = { $destroy(): void; $set(props: Record<string, unknown>): void };
type ComponentClass = new (options: { target: HTMLElement; props: Record<string, unknown> }) => Mounted;

const CardResizeHandle = require("../CardResizeHandle.svelte").default as ComponentClass;

function mount(props: Record<string, unknown> = {}) {
  const card = document.createElement("article");
  card.className = "ppp-shared-card";
  document.body.appendChild(card);
  const onPreview = jest.fn();
  const onCommit = jest.fn();
  const component = new CardResizeHandle({ target: card, props: { onPreview, onCommit, ...props } });
  const handle = card.querySelector<HTMLElement>(".ppp-card-resize-handle") as HTMLElement;
  const capture = {
    set: jest.fn(),
    release: jest.fn(),
    has: jest.fn(() => true),
  };
  Object.assign(handle, {
    setPointerCapture: capture.set,
    releasePointerCapture: capture.release,
    hasPointerCapture: capture.has,
  });
  // What reaches the card: each of these would open it or start a long press.
  const reached: string[] = [];
  for (const type of ["pointerdown", "pointermove", "pointerup", "touchstart", "mousedown", "click", "keydown", "keypress"]) {
    card.addEventListener(type, () => reached.push(type));
  }
  return {
    card,
    handle,
    component,
    onPreview,
    onCommit,
    capture,
    reached,
    destroy() {
      component.$destroy();
      card.remove();
    },
  };
}

function pointer(type: string, x: number, y: number, init: { pointerId?: number; button?: number } = {}): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: init.button ?? 0 });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  return event;
}

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cards-g5 — the handle's semantics", () => {
  it("is a focusable slider with a name and the current height", () => {
    const m = mount({ view: { heightRem: 9 }, override: { heightRem: 10 } });
    expect(m.handle).toHaveAttribute("role", "slider");
    expect(m.handle).toHaveAttribute("tabindex", "0");
    expect(m.handle.getAttribute("aria-label")).toBeTruthy();
    expect(m.handle).toHaveAttribute("aria-valuemin", "6");
    expect(m.handle).toHaveAttribute("aria-valuemax", "40");
    expect(m.handle).toHaveAttribute("aria-valuenow", "10");
    expect(m.handle.getAttribute("aria-valuetext")).toBeTruthy();
    m.destroy();
  });

  it("an automatic height has no current value, and says so in text", () => {
    const m = mount();
    expect(m.handle).not.toHaveAttribute("aria-valuenow");
    expect(m.handle.getAttribute("aria-valuetext")).toBeTruthy();
    m.destroy();
  });

  it("is a separate control: no drag-handle role of the board's grip", () => {
    const m = mount();
    expect(m.handle).not.toHaveClass("board-card-grip");
    expect(m.handle).not.toHaveAttribute("aria-grabbed");
    m.destroy();
  });
});

describe("cards-g5 — pointer drag", () => {
  it("a press captures the pointer and stops there", async () => {
    const m = mount({ override: { heightRem: 10 } });
    const down = pointer("pointerdown", 100, 100);
    m.handle.dispatchEvent(down);
    expect(m.capture.set).toHaveBeenCalledWith(1);
    expect(down.defaultPrevented).toBe(true);
    expect(m.reached).toEqual([]);
    await tick();
    expect(m.handle).toHaveClass("ppp-card-resize-handle--active");
    m.destroy();
  });

  it("moves preview a snapped frame and write nothing", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 100, 132));
    expect(m.onPreview).toHaveBeenLastCalledWith({ heightRem: 12 });
    // Under one step from the last preview: no new preview.
    m.handle.dispatchEvent(pointer("pointermove", 100, 135));
    expect(m.onPreview).toHaveBeenCalledTimes(1);
    m.handle.dispatchEvent(pointer("pointermove", 100, 180));
    expect(m.onPreview).toHaveBeenLastCalledWith({ heightRem: 15 });
    expect(m.onCommit).not.toHaveBeenCalled();
    expect(m.reached).toEqual([]);
    m.destroy();
  });

  it("the release commits exactly once and ends the preview", () => {
    const m = mount({ override: { heightRem: 10, gridSpan: 2 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 100, 132));
    m.handle.dispatchEvent(pointer("pointermove", 100, 148));
    m.handle.dispatchEvent(pointer("pointerup", 100, 148));
    expect(m.onCommit).toHaveBeenCalledTimes(1);
    // The span this drag did not touch is kept as saved.
    expect(m.onCommit).toHaveBeenCalledWith({ heightRem: 13, gridSpan: 2 });
    expect(m.onPreview).toHaveBeenLastCalledWith(null);
    expect(m.capture.release).toHaveBeenCalledWith(1);
    expect(m.handle).not.toHaveClass("ppp-card-resize-handle--active");
    // The click that follows a release is the handle's, not the card's.
    m.handle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(m.reached).toEqual([]);
    m.destroy();
  });

  it("a press and release without travel writes nothing", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointerup", 100, 100));
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a card with no saved height starts from what it shows, and saves only what moved", () => {
    const m = mount({ view: {}, override: undefined });
    m.handle.dispatchEvent(pointer("pointerdown", 0, 0));
    // jsdom measures 0, which is the lower bound, 6 rem; +2 rem of travel.
    m.handle.dispatchEvent(pointer("pointermove", 0, 32));
    m.handle.dispatchEvent(pointer("pointerup", 0, 32));
    expect(m.onCommit).toHaveBeenCalledWith({ heightRem: 8 });
    m.destroy();
  });

  it("pointercancel restores: preview ended, nothing written", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 100, 164));
    m.handle.dispatchEvent(pointer("pointercancel", 100, 164));
    expect(m.onPreview).toHaveBeenLastCalledWith(null);
    m.handle.dispatchEvent(pointer("pointerup", 100, 164));
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("a cancel or lost capture of another pointer does not end the resize", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 100, 132));
    m.handle.dispatchEvent(pointer("pointercancel", 0, 0, { pointerId: 2 }));
    m.handle.dispatchEvent(pointer("lostpointercapture", 0, 0, { pointerId: 2 }));
    expect(m.onPreview).not.toHaveBeenCalledWith(null);
    m.handle.dispatchEvent(pointer("pointerup", 100, 132));
    expect(m.onCommit).toHaveBeenCalledTimes(1);
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 12 });
    m.destroy();
  });

  it("Escape during a drag restores: preview ended, the release writes nothing", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 100, 164));
    window.dispatchEvent(key("Escape"));
    expect(m.onPreview).toHaveBeenLastCalledWith(null);
    m.handle.dispatchEvent(pointer("pointerup", 100, 164));
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("ignores another pointer and a secondary button", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100, { button: 2 }));
    expect(m.capture.set).not.toHaveBeenCalled();
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100, { pointerId: 1 }));
    m.handle.dispatchEvent(pointer("pointermove", 100, 200, { pointerId: 2 }));
    m.handle.dispatchEvent(pointer("pointerup", 100, 200, { pointerId: 2 }));
    expect(m.onPreview).not.toHaveBeenCalled();
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("horizontal: sideways travel changes the span, one column per measured step", () => {
    const columnStep = jest.fn(() => 300);
    const m = mount({ horizontal: true, view: { heightRem: 10 }, columnStep });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 420, 100));
    expect(m.onPreview).toHaveBeenLastCalledWith({ gridSpan: 2 });
    m.handle.dispatchEvent(pointer("pointermove", 760, 100));
    m.handle.dispatchEvent(pointer("pointerup", 760, 100));
    expect(m.onCommit).toHaveBeenCalledTimes(1);
    // The view height was not touched, so the override does not copy it.
    expect(m.onCommit).toHaveBeenCalledWith({ gridSpan: 3 });
    expect(columnStep).toHaveBeenCalled();
    m.destroy();
  });

  it("not horizontal: sideways travel changes nothing", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(pointer("pointerdown", 100, 100));
    m.handle.dispatchEvent(pointer("pointermove", 900, 100));
    m.handle.dispatchEvent(pointer("pointerup", 900, 100));
    expect(m.onPreview).not.toHaveBeenCalled();
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });
});

describe("cards-g5 — keyboard", () => {
  it("ArrowUp/ArrowDown step the height by one rem, Shift by four; one write per key", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(key("ArrowUp"));
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 11 });
    m.handle.dispatchEvent(key("ArrowDown"));
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 9 });
    m.handle.dispatchEvent(key("ArrowUp", { shiftKey: true }));
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 14 });
    m.handle.dispatchEvent(key("ArrowDown", { shiftKey: true }));
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 6 });
    expect(m.onCommit).toHaveBeenCalledTimes(4);
    m.destroy();
  });

  it("a step past a bound writes nothing", () => {
    const m = mount({ override: { heightRem: 40 } });
    m.handle.dispatchEvent(key("ArrowUp"));
    expect(m.onCommit).not.toHaveBeenCalled();
    m.destroy();
  });

  it("Left/Right change the span only where the handle is horizontal", () => {
    const grid = mount({ horizontal: true, override: { heightRem: 10 } });
    grid.handle.dispatchEvent(key("ArrowRight"));
    expect(grid.onCommit).toHaveBeenLastCalledWith({ heightRem: 10, gridSpan: 2 });
    grid.handle.dispatchEvent(key("ArrowRight", { shiftKey: true }));
    expect(grid.onCommit).toHaveBeenLastCalledWith({ heightRem: 10, gridSpan: 4 });
    grid.destroy();

    const board = mount({ override: { heightRem: 10 } });
    const right = key("ArrowRight");
    board.handle.dispatchEvent(right);
    expect(board.onCommit).not.toHaveBeenCalled();
    expect(right.defaultPrevented).toBe(false);
    board.destroy();
  });

  it("Home returns the height to the view value; Shift+Home the span", () => {
    const m = mount({ horizontal: true, view: { heightRem: 8 }, override: { heightRem: 14, gridSpan: 2 } });
    m.handle.dispatchEvent(key("Home"));
    expect(m.onCommit).toHaveBeenLastCalledWith({ gridSpan: 2 });
    m.handle.dispatchEvent(key("Home", { shiftKey: true }));
    expect(m.onCommit).toHaveBeenLastCalledWith({ heightRem: 14 });
    m.destroy();
  });

  it("Delete and Backspace remove the card's override", () => {
    for (const k of ["Delete", "Backspace"]) {
      const m = mount({ override: { heightRem: 14 } });
      m.handle.dispatchEvent(key(k));
      expect(m.onCommit).toHaveBeenCalledTimes(1);
      expect(m.onCommit).toHaveBeenCalledWith(undefined);
      m.destroy();
    }
    const none = mount({ override: undefined });
    none.handle.dispatchEvent(key("Delete"));
    expect(none.onCommit).not.toHaveBeenCalled();
    none.destroy();
  });

  it("handled keys stop at the handle; others pass", () => {
    const m = mount({ override: { heightRem: 10 } });
    m.handle.dispatchEvent(key("ArrowUp"));
    expect(m.reached).toEqual([]);
    m.handle.dispatchEvent(key("Tab"));
    expect(m.reached).toEqual(["keydown"]);
    m.destroy();
  });
});

describe("cards-g5 — nothing reaches the card", () => {
  it("touchstart, mousedown and click stop at the handle (no long press, no grip arming, no open)", () => {
    const m = mount();
    m.handle.dispatchEvent(new Event("touchstart", { bubbles: true }));
    m.handle.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    m.handle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.handle.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", bubbles: true }));
    expect(m.reached).toEqual([]);
    m.destroy();
  });
});

describe("cards-g5 — the handle's CSS (source)", () => {
  const css = stripCssComments(svelteStyles(readFileSync(join(__dirname, "..", "CardResizeHandle.svelte"), "utf8")));

  it("only the handle refuses touch panning", () => {
    expect(css).toMatch(/\.ppp-card-resize-handle \{[^}]*touch-action: none;/);
    expect(css.match(/touch-action/g)).toHaveLength(1);
  });

  it("is a full finger target on a coarse pointer", () => {
    const coarse = css.slice(css.indexOf("@media (pointer: coarse)"));
    expect(coarse).toMatch(/width: var\(--ppp-touch-target-min\);/);
    expect(coarse).toMatch(/height: var\(--ppp-touch-target-min\);/);
  });

  it("hides at rest and reveals on hover only behind the fine-hover gate", () => {
    const gate = css.indexOf("@media (hover: hover) and (pointer: fine)");
    expect(gate).toBeGreaterThan(-1);
    const hovers = [...css.matchAll(/:hover/g)].map((m) => m.index ?? 0);
    expect(hovers.length).toBeGreaterThan(0);
    const gateEnd = css.indexOf("@media (pointer: coarse)");
    expect(hovers.every((at) => at > gate && at < gateEnd)).toBe(true);
    expect(css).toMatch(/\.ppp-card-resize-handle:focus-visible/);
  });

  it("stacks by DOM order: no z-index", () => {
    expect(css).not.toMatch(/z-index/);
    expect(css).toMatch(/position: absolute;/);
  });
});

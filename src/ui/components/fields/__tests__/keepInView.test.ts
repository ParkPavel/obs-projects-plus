/**
 * 3.7.2 B1b — keepInView: a focused field of the kit is scrolled back into the
 * visible part of its window when the on-screen keyboard shrinks the visual
 * viewport; nothing listens while the field is not focused; everything is
 * removed on blur and on destroy.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";
import { keepInView, type ViewportBounds } from "../keepInView";

const TextField = require("../TextField.svelte").default;
const NumberField = require("../NumberField.svelte").default;
const SearchField = require("../SearchField.svelte").default;

/** A stand-in visualViewport that counts its listeners. */
function fakeViewport() {
  const listeners = new Map<string, Set<EventListener>>();
  const vv = {
    width: 400,
    height: 800,
    offsetLeft: 0,
    offsetTop: 0,
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: EventListener) => listeners.get(type)?.delete(fn),
    fire: (type: string) => listeners.get(type)?.forEach((fn) => fn(new Event(type))),
    count: () => [...listeners.values()].reduce((n, s) => n + s.size, 0),
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  return vv;
}

function boxAt(el: HTMLElement, top: number, height = 40): void {
  el.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 200, width: 200, height, x: 0, y: top, toJSON: () => ({}) });
}

// i3-input: the check runs on the next frame; the tests run that frame at once.
const realRaf = window.requestAnimationFrame;
beforeEach(() => {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
});
afterEach(() => {
  window.requestAnimationFrame = realRaf;
  document.body.innerHTML = "";
  delete (window as { visualViewport?: unknown }).visualViewport;
});

describe("keepInView", () => {
  it("scrolls a focused field into view when the keyboard shrinks the viewport", async () => {
    const vv = fakeViewport();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.scrollIntoView = jest.fn();
    boxAt(input, 600);
    const action = keepInView(input);
    expect(vv.count()).toBe(0);
    input.focus();
    // Full height: the field at 600..640 is visible, nothing scrolls.
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    // i3-input: only the size change is listened to, not the pan (scroll).
    expect(vv.count()).toBe(1);
    // The keyboard takes the bottom half.
    vv.height = 400;
    vv.fire("resize");
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest", behavior: "auto" });
    input.blur();
    // w4-p06: the listeners go a microtask after the blur (a blur followed at
    // once by a focus — the keyboard button — keeps them).
    await Promise.resolve();
    expect(vv.count()).toBe(0);
    action.destroy();
  });

  it("reads bounds from the injected model and removes listeners on destroy", () => {
    const vv = fakeViewport();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.scrollIntoView = jest.fn();
    boxAt(input, 100);
    let bounds: ViewportBounds = { left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 };
    const action = keepInView(input, () => bounds);
    input.focus();
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    bounds = { left: 0, top: 200, width: 400, height: 300, right: 400, bottom: 500 };
    // i3-input: a pan (visualViewport scroll) is WebKit's own and is left alone.
    vv.fire("scroll");
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    vv.fire("resize");
    expect(input.scrollIntoView).toHaveBeenCalledTimes(1);
    action.destroy();
    expect(vv.count()).toBe(0);
    vv.fire("resize");
    expect(input.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["TextField", TextField, { value: "a" }],
    ["NumberField", NumberField, { value: 3 }],
    ["SearchField", SearchField, { query: "" }],
  ])("%s carries it", async (_name, Component, props) => {
    const vv = fakeViewport();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = new Component({ target, props });
    await tick();
    const input = target.querySelector("input") as HTMLInputElement;
    input.scrollIntoView = jest.fn();
    boxAt(input, 600);
    input.focus();
    vv.height = 300;
    vv.fire("resize");
    expect(input.scrollIntoView).toHaveBeenCalled();
    component.$destroy();
    expect(vv.count()).toBe(0);
  });
});

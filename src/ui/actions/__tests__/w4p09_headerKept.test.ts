/**
 * w4-p09 (audit F07, N1) — the view tabs stay in the phone's leaf header
 * through what Obsidian and themes do to it.
 *
 * F07's red scenario: replace the header after the first move and call
 * update(true) — the tabs stayed in the detached header. Also: a header
 * rebuilt without an update, a theme that hides the whole header row (the
 * strip goes back to the plugin bar), and no copy is ever made.
 *
 * N1: Things keeps the title container at opacity 0 until hover; Minimal
 * hides it with an option. The strip's container is kept shown by the
 * `ppp-tabs-in-header` rules — checked against CompactNavBar's source.
 *
 * Why these fail on the old code: attach() returned at once once a
 * placeholder existed, nothing watched the leaf, and the container had no
 * opacity/visibility rule of ours.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { moveToViewHeader } from "../moveToViewHeader";

const raf = window.requestAnimationFrame;
const nativeStyle = window.getComputedStyle.bind(window);
beforeEach(() => {
  // Only the theme's computed display is simulated; browser probes cover actual CSS.
  jest.spyOn(window, "getComputedStyle").mockImplementation(element => new Proxy(nativeStyle(element), {
    get(target, property) { return property === "display" && element.classList.contains("theme-title-hidden") ? "none" : Reflect.get(target, property, target); },
  }));
  let nextFrame = 0;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => { queueMicrotask(() => cb(0)); return nextFrame++; };
});
afterEach(() => {
  jest.restoreAllMocks();
  window.requestAnimationFrame = raf;
  document.body.innerHTML = "";
});

function header(): HTMLElement {
  const h = document.createElement("div");
  h.className = "view-header";
  const title = document.createElement("div");
  title.className = "view-header-title-container";
  h.append(title);
  return h;
}

function leafWithStrip() {
  const leaf = document.createElement("div");
  leaf.className = "workspace-leaf-content";
  const head = header();
  const bar = document.createElement("div");
  bar.className = "compact-navbar";
  const strip = document.createElement("div");
  strip.className = "compact-navbar-tabs";
  bar.append(strip);
  leaf.append(head, bar);
  document.body.append(leaf);
  return { leaf, head, bar, strip };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("w4-p09 — the tabs follow the header", () => {
  test("a title container hidden by the theme returns the original strip home and can restore it", async () => {
    const { head, bar, strip } = leafWithStrip(), action = moveToViewHeader(strip, true);
    try {
      const title = head.querySelector<HTMLElement>(".view-header-title-container")!;
      title.classList.add("theme-title-hidden"); await flush(); expect(bar.contains(strip)).toBe(true);
      title.classList.remove("theme-title-hidden"); await flush(); expect(head.contains(strip)).toBe(true);
    } finally { action.destroy(); }
  });
  test("style changes in view content do not schedule header placement", async () => {
    const { bar, strip } = leafWithStrip(), content = document.createElement("div"); bar.append(content);
    const request = jest.spyOn(window, "requestAnimationFrame"), action = moveToViewHeader(strip, true);
    try {
      await flush(); request.mockClear(); content.classList.add("view-content-animating"); await flush(); expect(request).not.toHaveBeenCalled();
    } finally { action.destroy(); request.mockRestore(); }
  });
  test("F07: the header replaced after the move — update(true) puts the strip into the new one", () => {
    const { leaf, head, strip } = leafWithStrip();
    const action = moveToViewHeader(strip, true);
    expect(head.contains(strip)).toBe(true);
    const fresh = header();
    head.replaceWith(fresh);
    action.update(true);
    expect(strip.isConnected).toBe(true);
    expect(fresh.querySelector(".view-header-title-container")!.contains(strip)).toBe(true);
    expect(leaf.querySelectorAll(".compact-navbar-tabs")).toHaveLength(1);
    action.destroy();
  });

  test("a header rebuilt by the host with no update is noticed and the strip re-placed", async () => {
    const { leaf, head, strip } = leafWithStrip();
    const action = moveToViewHeader(strip, true);
    const fresh = header();
    head.replaceWith(fresh);
    await flush();
    expect(fresh.contains(strip)).toBe(true);
    expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(true);
    action.destroy();
  });

  test("a theme hiding the whole header row: the strip goes back to the plugin bar, and returns", async () => {
    const { leaf, head, bar, strip } = leafWithStrip();
    const action = moveToViewHeader(strip, true);
    // The row hidden (display: none), with a theme's body class switched on.
    head.hidden = true;
    document.body.classList.add("theme-hides-header");
    await flush();
    expect(bar.contains(strip)).toBe(true);
    expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(false);
    head.hidden = false;
    document.body.classList.remove("theme-hides-header");
    await flush();
    expect(head.contains(strip)).toBe(true);
    action.destroy();
  });

  test("destroy brings the strip home and stops watching", async () => {
    const { leaf, head, bar, strip } = leafWithStrip();
    const action = moveToViewHeader(strip, true);
    action.destroy();
    expect(bar.contains(strip)).toBe(true);
    head.replaceWith(header());
    await flush();
    expect(bar.contains(strip)).toBe(true);
    expect(leaf.classList.contains("ppp-tabs-in-header")).toBe(false);
  });

  test("N1: the title container is kept shown in a leaf with the tabs, whatever the theme's opacity", () => {
    const source = readFileSync(join(__dirname, "..", "..", "components", "Navigation", "CompactNavBar.svelte"), "utf8");
    const rule = /:global\(\.ppp-tabs-in-header \.view-header-title-container\) \{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(rule).toMatch(/opacity:\s*1\s*!important/);
    expect(rule).toMatch(/visibility:\s*visible\s*!important/);
  });
});

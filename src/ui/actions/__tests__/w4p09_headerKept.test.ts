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
beforeEach(() => {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 0; };
});
afterEach(() => {
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

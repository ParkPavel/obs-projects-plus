/**
 * WidgetShell.test.ts — #067 F1 frame component.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return {
    i18n: writable({
      t: (key: string, options?: { defaultValue?: string }) =>
        options?.defaultValue ?? key,
    }),
  };
});

const WidgetShell = require("../WidgetShell.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new WidgetShell({
    target,
    props: { widgetId: "w-1", title: "My widget", ...props },
  });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("WidgetShell (#067 F1)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders host frame with header title and no raw type badge", () => {
    const { target, destroy } = mount({});
    expect(target.querySelector(".ppp-widget-host")).not.toBeNull();
    expect(target.querySelector(".ppp-widget-title")).toHaveTextContent("My widget");
    // The raw type identifier was a diagnostic, not product text (visual acceptance 2026-09-25).
    expect(target.querySelector(".ppp-widget-type-badge")).toBeNull();
    destroy();
  });

  it("dispatches toggleCollapse from the collapse button", () => {
    const { component, target, destroy } = mount({});
    const onToggle = jest.fn();
    component.$on("toggleCollapse", onToggle);
    target
      .querySelector(".ppp-widget-collapse-btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    destroy();
  });

  it("hides the content area when collapsed", () => {
    const { target, destroy } = mount({ collapsed: true });
    expect(target.querySelector(".ppp-widget-content")).toBeNull();
    expect(target.querySelector(".ppp-widget-host--collapsed")).not.toBeNull();
    destroy();
  });

  it("renders the lazy skeleton until the IntersectionObserver fires", () => {
    // jsdom has no IntersectionObserver — the mock below never fires,
    // so the shell must stay in skeleton state (DG-9 contract).
    const { target, destroy } = mount({});
    expect(target.querySelector(".ppp-widget-skeleton")).not.toBeNull();
    destroy();
  });

  // 3.7.1 idle CPU: the skeleton shimmered on `background-position` forever, which is
  // not composited: ~67 style recalcs a second for as long as any tile sat below the
  // fold. Old code failed here: the style carried `animation: ppp-shimmer ... infinite`.
  it("keeps the skeleton static: no infinite animation in the shell", () => {
    const source: string = require("fs").readFileSync(require("path").join(__dirname, "..", "WidgetShell.svelte"), "utf8");
    const style = source.slice(source.indexOf("<style>"));
    expect(style).not.toMatch(/infinite/);
    expect(style).not.toMatch(/@keyframes/);
    expect(style).not.toMatch(/animation\s*:/);
  });

  // Ratchet over the dashboard: an infinite animation may only move composited
  // properties (opacity, transform). The one that exists pulses opacity.
  it("allows no infinite non-composited animation in Dashboard styles", () => {
    const fs = require("fs");
    const path = require("path");
    const root = path.join(__dirname, "..", "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== "__tests__") walk(full); }
        else if (entry.name.endsWith(".svelte")) files.push(full);
      }
    };
    walk(root);
    const offenders: string[] = [];
    for (const file of files) {
      const text: string = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/animation\s*:\s*([\w-]+)[^;}]*\binfinite\b/g)) {
        const frames = text.match(new RegExp(`@keyframes\\s+${m[1]}\\s*\\{([^@]*?\\})\\s*\\}`));
        const body: string = frames?.[1] ?? "";
        if (!/\b(opacity|transform)\b/.test(body) || /\b(background|width|height|top|left|margin)/.test(body)) {
          offenders.push(`${path.basename(file)}: ${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("labels the host by the widget title for assistive tech", () => {
    const { target, destroy } = mount({});
    const host = target.querySelector(".ppp-widget-host")!;
    expect(host.getAttribute("aria-labelledby")).toBe("ppp-widget-title-w-1");
    expect(target.querySelector("#ppp-widget-title-w-1")).not.toBeNull();
    destroy();
  });

  it("does not commit a title during IME, and Escape followed by blur writes nothing", async () => {
    const { component, target, destroy } = mount({ renameSignal: 1 }); await tick();
    const changes = jest.fn(); component.$on("titleChange", changes);
    const input = target.querySelector<HTMLInputElement>("input")!;
    input.value = "Renamed"; input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick();
    expect(target.querySelector("input")).toBe(input); expect(changes).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("blur")); await tick();
    expect(changes).not.toHaveBeenCalled(); expect(target.querySelector("input")).toBeNull();
    destroy();
  });

  it("a title committed on Enter is not committed again by blur", async () => {
    const { component, target, destroy } = mount({ renameSignal: 1 }); await tick();
    const changes = jest.fn(); component.$on("titleChange", changes);
    const input = target.querySelector<HTMLInputElement>("input")!;
    input.value = "Renamed"; input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("blur")); await tick();
    expect(changes).toHaveBeenCalledTimes(1); expect(changes.mock.calls[0]![0].detail).toBe("Renamed");
    destroy();
  });
});

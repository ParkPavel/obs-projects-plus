/**
 * FloatingPopup smoke tests — verifies the popup engine renders, positions,
 * dismisses on outside click + Escape, and supports placement flip.
 *
 * Spec: .ai_internal/New-specification/POPUP_PATTERN_GUIDE.md
 * Ticket: #034.1 (Phase 4 — Popup standardisation).
 */

import "@testing-library/jest-dom";

// Make isMobile a writable store so tests can flip mobile/desktop modes.
jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return {
    isMobile: writable(false),
  };
});

const FloatingPopup = require("../FloatingPopup.svelte").default;
const { isMobile } = require("src/lib/stores/ui");

async function flush(ms = 0) {
  await Promise.resolve();
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  await Promise.resolve();
}

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new FloatingPopup({ target, props });
  return {
    component,
    target,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

function createTrigger(rect: Partial<DOMRect>): HTMLElement {
  const btn = document.createElement("button");
  btn.textContent = "trigger";
  // Need anchor in DOM so getBoundingClientRect returns measurable rect.
  document.body.appendChild(btn);
  // jsdom returns zeroed rects — override per test scenario.
  const full: DOMRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect;
  btn.getBoundingClientRect = () => full;
  return btn;
}

function stubPopupRect(target: HTMLElement, width = 200, height = 100) {
  // The .ppp-popup--floating div is the popup. Stub its rect.
  const popup = target.querySelector(".ppp-popup--floating") as HTMLElement | null;
  if (!popup) return null;
  popup.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect);
  return popup;
}

describe("FloatingPopup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    isMobile.set(false);
    // Default viewport to a sane desktop size.
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 768, configurable: true });
  });

  test("does not render content when closed", () => {
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const view = mount({ open: false, triggerEl: trigger, ariaLabel: "test" });

    expect(view.target.querySelector(".ppp-popup--floating")).toBeNull();
    view.destroy();
  });

  test("renders floating popup with role and aria-label when open", async () => {
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const view = mount({
      open: true,
      triggerEl: trigger,
      role: "menu",
      ariaLabel: "Test menu",
    });

    await flush(10);

    const popup = view.target.querySelector(".ppp-popup--floating");
    expect(popup).not.toBeNull();
    expect(popup?.getAttribute("role")).toBe("menu");
    expect(popup?.getAttribute("aria-label")).toBe("Test menu");

    view.destroy();
  });

  test("positions popup below trigger for bottom-start placement", async () => {
    const trigger = createTrigger({ top: 100, left: 50, bottom: 120, right: 150, width: 100, height: 20 });
    const view = mount({ open: true, triggerEl: trigger, placement: "bottom-start" });

    await flush(10);
    stubPopupRect(view.target, 160, 80);
    // Force one recompute by toggling open via prop assignment (Svelte 3 reactivity).
    view.component.$set({ placement: "bottom-start" });
    await flush(20);

    const popup = view.target.querySelector(".ppp-popup--floating") as HTMLElement;
    const styleAttr = popup?.getAttribute("style") ?? "";
    // top should be near trigger.bottom (120) + offset (~4px at 16px root font).
    expect(styleAttr).toMatch(/top:\s*\d+px/);
    expect(styleAttr).toMatch(/left:\s*\d+px/);

    view.destroy();
  });

  test("clamps a wide popup inside the right viewport edge (#098)", async () => {
    // Trigger sits near the right edge; popup is wider than the available
    // viewport space (vw - 2*margin), so the clamp must pin left AND emit a
    // max-width cap that prevents right overflow.
    const trigger = createTrigger({ top: 100, left: 980, bottom: 120, right: 1020, width: 40, height: 20 });
    const view = mount({ open: true, triggerEl: trigger, placement: "bottom-start" });

    await flush(10);
    // vw = 1024, margin ≈ 8px → available ≈ 1008px. Popup wants 1200px.
    stubPopupRect(view.target, 1200, 200);
    view.component.$set({ placement: "bottom-start" });
    await flush(20);

    const popup = view.target.querySelector(".ppp-popup--floating") as HTMLElement;
    const styleAttr = popup?.getAttribute("style") ?? "";

    const leftMatch = styleAttr.match(/left:\s*([\d.]+)px/);
    const capMatch = styleAttr.match(/max-width:\s*([\d.]+)px/);
    expect(leftMatch).not.toBeNull();
    expect(capMatch).not.toBeNull();

    const left = parseFloat(leftMatch![1]!);
    const cap = parseFloat(capMatch![1]!);
    const margin = 8; // 0.5rem at 16px root font
    // Left pinned at margin, and origin + cap stays inside the right margin.
    expect(left).toBeGreaterThanOrEqual(margin - 0.5);
    expect(left + cap).toBeLessThanOrEqual(1024 - margin + 0.5);

    view.destroy();
  });

  test("repositions on window resize while open (#098)", async () => {
    const trigger = createTrigger({ top: 100, left: 50, bottom: 120, right: 150, width: 100, height: 20 });
    const view = mount({ open: true, triggerEl: trigger, placement: "bottom-start" });

    await flush(10);
    const popup = stubPopupRect(view.target, 160, 80) as HTMLElement;
    const spy = jest.spyOn(popup, "getBoundingClientRect");

    window.dispatchEvent(new Event("resize"));
    await flush(20);

    // recompute() re-measured the popup in response to the resize event.
    expect(spy).toHaveBeenCalled();
    view.destroy();
  });

  test("removes the resize listener on destroy (#098)", async () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const trigger = createTrigger({ top: 100, left: 50, bottom: 120, right: 150, width: 100, height: 20 });
    const view = mount({ open: true, triggerEl: trigger });

    await flush(10);
    view.destroy();

    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    removeSpy.mockRestore();
  });

  test("dismisses on Escape key", async () => {
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const onClose = jest.fn();
    const view = mount({ open: true, triggerEl: trigger });
    view.component.$on("close", onClose);

    await flush(10);
    expect(view.target.querySelector(".ppp-popup--floating")).not.toBeNull();

    const evt = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(evt);
    await flush();

    expect(onClose).toHaveBeenCalled();
    view.destroy();
  });

  test("dismisses on outside mousedown but not on trigger mousedown", async () => {
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const onClose = jest.fn();
    const view = mount({ open: true, triggerEl: trigger });
    view.component.$on("close", onClose);

    await flush(10);

    // Mousedown on the trigger — must NOT close.
    const triggerEvt = new MouseEvent("mousedown", { bubbles: true });
    trigger.dispatchEvent(triggerEvt);
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    // Mousedown elsewhere — must close.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const outsideEvt = new MouseEvent("mousedown", { bubbles: true });
    outside.dispatchEvent(outsideEvt);
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  test("closeOnInnerClick=true closes when popup body is clicked", async () => {
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const onClose = jest.fn();
    const view = mount({
      open: true,
      triggerEl: trigger,
      closeOnInnerClick: true,
    });
    view.component.$on("close", onClose);

    await flush(10);
    const popup = view.target.querySelector(".ppp-popup--floating") as HTMLElement;
    expect(popup).not.toBeNull();

    popup.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(onClose).toHaveBeenCalled();
    view.destroy();
  });

  test("renders bottom-sheet on mobile with backdrop", async () => {
    isMobile.set(true);
    const trigger = createTrigger({ top: 100, left: 100, bottom: 120, right: 200, width: 100, height: 20 });
    const view = mount({ open: true, triggerEl: trigger });

    await flush(10);

    expect(view.target.querySelector(".ppp-popup-backdrop")).not.toBeNull();
    expect(view.target.querySelector(".ppp-popup--bottom-sheet")).not.toBeNull();
    expect(view.target.querySelector(".ppp-popup--floating")).toBeNull();

    view.destroy();
    isMobile.set(false);
  });
});

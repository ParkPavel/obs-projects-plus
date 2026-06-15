/**
 * WidgetShell.test.ts — #067 F1 frame component.
 */

import "@testing-library/jest-dom";

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
    props: { widgetId: "w-1", title: "My widget", widgetType: "stats", ...props },
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

  it("renders host frame with header title and type badge", () => {
    const { target, destroy } = mount({});
    expect(target.querySelector(".ppp-widget-host")).not.toBeNull();
    expect(target.querySelector(".ppp-widget-title")).toHaveTextContent("My widget");
    expect(target.querySelector(".ppp-widget-type-badge")).toHaveTextContent("(stats)");
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

  it("labels the host by the widget title for assistive tech", () => {
    const { target, destroy } = mount({});
    const host = target.querySelector(".ppp-widget-host")!;
    expect(host.getAttribute("aria-labelledby")).toBe("ppp-widget-title-w-1");
    expect(target.querySelector("#ppp-widget-title-w-1")).not.toBeNull();
    destroy();
  });
});

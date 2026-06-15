/**
 * WidgetHeaderActions.test.ts — #067 F1 header action cluster.
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

const WidgetHeaderActions = require("../WidgetHeaderActions.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new WidgetHeaderActions({
    target,
    props: { readonly: false, hasCog: true, hasPipeline: true, ...props },
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

function click(target: HTMLElement, selector: string) {
  const el = target.querySelector(selector);
  if (!el) throw new Error(`Expected ${selector} to exist`);
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("WidgetHeaderActions (#067 F1)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("dispatches one semantic event per button", () => {
    const { component, target, destroy } = mount({});
    const events: string[] = [];
    for (const name of ["toggleConfig", "togglePipeline", "toggleLock", "remove"]) {
      component.$on(name, () => events.push(name));
    }
    click(target, ".ppp-widget-settings-btn");
    click(target, ".ppp-widget-pipeline-btn");
    click(target, ".ppp-widget-lock-btn");
    click(target, ".ppp-widget-remove-btn");
    expect(events).toEqual(["toggleConfig", "togglePipeline", "toggleLock", "remove"]);
    destroy();
  });

  it("renders nothing actionable in readonly mode", () => {
    const { target, destroy } = mount({ readonly: true });
    expect(target.querySelectorAll("button")).toHaveLength(0);
    destroy();
  });

  it("hides cog and pipeline when the type opts out", () => {
    const { target, destroy } = mount({ hasCog: false, hasPipeline: false });
    expect(target.querySelector(".ppp-widget-settings-btn")).toBeNull();
    expect(target.querySelector(".ppp-widget-pipeline-btn")).toBeNull();
    expect(target.querySelector(".ppp-widget-lock-btn")).not.toBeNull();
    expect(target.querySelector(".ppp-widget-remove-btn")).not.toBeNull();
    destroy();
  });

  it("shows the step-count badge when the pipeline is active", () => {
    const { target, destroy } = mount({ pipelineStepCount: 3 });
    expect(target.querySelector(".ppp-widget-pipeline-count")).toHaveTextContent("3");
    expect(target.querySelector(".ppp-widget-pipeline-btn--active")).not.toBeNull();
    destroy();
  });

  it("reflects the locked state on the lock button", () => {
    const { target, destroy } = mount({ locked: true });
    expect(target.querySelector(".ppp-widget-lock-btn--locked")).not.toBeNull();
    destroy();
  });
});

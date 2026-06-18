import "@testing-library/jest-dom";

// #103 — FilterBridge must NOT mirror the global `view.filter` anymore. The single
// global-filter surface is ViewFilterBar pills in the view shell. This bridge only
// renders the transient local FilterTabs selection chip. These tests lock that
// invariant so the triple-duplication (pills + badge + SettingsMenu) cannot regress.

const FilterBridge = require("../FilterBridge.svelte").default;

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const events: { promote: number; clear: number } = { promote: 0, clear: 0 };
  const component = new FilterBridge({ target, props });
  component.$on("promote", () => (events.promote += 1));
  component.$on("clear", () => (events.clear += 1));
  return {
    target,
    events,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("FilterBridge (#103 — no global-filter duplication)", () => {
  test("renders nothing when there is no local filter-tab selection", () => {
    const m = mount({ activeFilterTab: null, readonly: false, canPromote: false });
    expect(m.target.querySelector(".ppp-filter-bridge")).toBeNull();
    m.destroy();
  });

  test("never renders a global-filter chip (single source of truth = pills)", () => {
    const m = mount({
      activeFilterTab: { field: "client", value: "Acme" },
      readonly: false,
      canPromote: true,
    });
    expect(m.target.querySelector(".ppp-filter-bridge-chip--global")).toBeNull();
    m.destroy();
  });

  test("renders the local filter-tab chip when a tab is selected", () => {
    const m = mount({
      activeFilterTab: { field: "client", value: "Acme" },
      readonly: false,
      canPromote: true,
    });
    expect(m.target.querySelector(".ppp-filter-bridge-chip--local")).not.toBeNull();
    m.destroy();
  });

  test("promote button fires only when promotable and not readonly", () => {
    const m = mount({
      activeFilterTab: { field: "client", value: "Acme" },
      readonly: false,
      canPromote: true,
    });
    const promote = m.target.querySelector<HTMLButtonElement>(".ppp-filter-bridge-promote");
    expect(promote).not.toBeNull();
    promote?.click();
    expect(m.events.promote).toBe(1);
    m.destroy();
  });

  test("readonly hides the promote action", () => {
    const m = mount({
      activeFilterTab: { field: "client", value: "Acme" },
      readonly: true,
      canPromote: true,
    });
    expect(m.target.querySelector(".ppp-filter-bridge-promote")).toBeNull();
    m.destroy();
  });
});

import "@testing-library/jest-dom";

import type { FilterCondition } from "src/settings/base/settings";

const FilterPills = require("../FilterPills.svelte").default;

const cond = (over: Partial<FilterCondition> = {}): FilterCondition => ({
  field: "status",
  operator: "is",
  value: "Active",
  enabled: true,
  ...over,
});

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const removed: number[] = [];
  let addClicks = 0;
  const component = new FilterPills({ target, props });
  component.$on("remove", (e: CustomEvent<number>) => removed.push(e.detail));
  component.$on("addClick", () => (addClicks += 1));
  return {
    target,
    removed,
    get addClicks() {
      return addClicks;
    },
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("FilterPills", () => {
  test("renders one pill per enabled condition with operator label", () => {
    const m = mount({ conditions: [cond(), cond({ field: "priority", operator: "gt", value: "5" })] });
    const pills = m.target.querySelectorAll(".ppp-filterpills-pill-text");
    expect(pills).toHaveLength(2);
    expect(pills[0]?.textContent).toContain("status");
    expect(pills[0]?.textContent).toContain("Active");
    m.destroy();
  });

  test("disabled conditions are not rendered", () => {
    const m = mount({ conditions: [cond({ enabled: false }), cond({ field: "x" })] });
    expect(m.target.querySelectorAll(".ppp-filterpills-pill-text")).toHaveLength(1);
    m.destroy();
  });

  test("clicking remove dispatches the pill index", () => {
    const m = mount({ conditions: [cond(), cond({ field: "x" })] });
    const xs = m.target.querySelectorAll<HTMLButtonElement>(".ppp-filterpills-pill-x");
    xs[1]?.click();
    expect(m.removed).toEqual([1]);
    m.destroy();
  });

  test("clicking add dispatches addClick", () => {
    const m = mount({ conditions: [] });
    const add = m.target.querySelector<HTMLButtonElement>(".ppp-filterpills-add");
    add?.click();
    expect(m.addClicks).toBe(1);
    m.destroy();
  });

  test("readonly hides remove buttons and add trigger", () => {
    const m = mount({ conditions: [cond()], readonly: true });
    expect(m.target.querySelector(".ppp-filterpills-pill-x")).toBeNull();
    expect(m.target.querySelector(".ppp-filterpills-add")).toBeNull();
    m.destroy();
  });

  test("readonly with no conditions renders nothing", () => {
    const m = mount({ conditions: [], readonly: true });
    expect(m.target.querySelector(".ppp-filterpills")).toBeNull();
    m.destroy();
  });
});

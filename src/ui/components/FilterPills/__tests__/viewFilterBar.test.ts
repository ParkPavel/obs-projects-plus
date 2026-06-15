import "@testing-library/jest-dom";

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/base/settings";

const ViewFilterBar = require("../ViewFilterBar.svelte").default;

const field = (name: string): DataField => ({
  name,
  type: DataFieldType.String,
  repeated: false,
  identifier: false,
  derived: false,
});

const filter = (): FilterDefinition => ({
  conjunction: "and",
  conditions: [
    { field: "status", operator: "is", value: "Active", enabled: true },
    { field: "title", operator: "contains", value: "x", enabled: true },
  ],
});

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const changes: Array<FilterDefinition | undefined> = [];
  const component = new ViewFilterBar({ target, props });
  component.$on("change", (e: CustomEvent<FilterDefinition | undefined>) => changes.push(e.detail));
  return {
    target,
    changes,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("ViewFilterBar", () => {
  test("renders a pill per enabled condition", () => {
    const m = mount({ filter: filter(), fields: [field("status"), field("title")] });
    expect(m.target.querySelectorAll(".ppp-filterpills-pill-text")).toHaveLength(2);
    m.destroy();
  });

  test("removing the last condition emits undefined (clears filter)", () => {
    const single: FilterDefinition = {
      conjunction: "and",
      conditions: [{ field: "status", operator: "is", value: "A", enabled: true }],
    };
    const m = mount({ filter: single, fields: [field("status")] });
    m.target.querySelector<HTMLButtonElement>(".ppp-filterpills-pill-x")?.click();
    expect(m.changes).toHaveLength(1);
    // Svelte's createEventDispatcher coerces an `undefined` detail to `null`.
    expect(m.changes[0]).toBeFalsy();
    m.destroy();
  });

  test("removing one of several keeps the rest", () => {
    const m = mount({ filter: filter(), fields: [field("status"), field("title")] });
    const xs = m.target.querySelectorAll<HTMLButtonElement>(".ppp-filterpills-pill-x");
    xs[0]?.click();
    expect(m.changes[0]?.conditions).toHaveLength(1);
    expect(m.changes[0]?.conditions[0]?.field).toBe("title");
    m.destroy();
  });

  test("readonly with no conditions renders nothing", () => {
    const m = mount({ filter: undefined, fields: [], readonly: true });
    expect(m.target.querySelector(".ppp-viewfilter")).toBeNull();
    m.destroy();
  });
});

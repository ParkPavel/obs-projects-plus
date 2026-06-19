import "@testing-library/jest-dom";

// #093 slice 3 — FieldComboInput keeps the native "select existing OR type a new
// field" behaviour while adding picker affordances. These tests lock the
// affordance contract: a type icon for an existing field, a "+ new field" badge
// (replacing the caret) when the name is new, and a caret otherwise.

const FieldComboInput = require("../FieldComboInput.svelte").default;

const FIELDS = [
  { name: "deadline", type: "date" },
  { name: "mrr", type: "number" },
];

function mount(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const changes: string[] = [];
  const component = new FieldComboInput({ target, props: { id: "fl-test", fields: FIELDS, ...props } });
  component.$on("change", (e: CustomEvent<string>) => changes.push(e.detail));
  return {
    target,
    changes,
    input: target.querySelector<HTMLInputElement>("input.field-combo-input"),
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

describe("FieldComboInput (#093 picker affordance)", () => {
  test("existing field: shows caret, no new-field badge", () => {
    const m = mount({ value: "deadline" });
    expect(m.target.querySelector(".field-combo-caret")).not.toBeNull();
    expect(m.target.querySelector(".new-field-badge")).toBeNull();
    m.destroy();
  });

  test("new field name: shows badge, hides caret", () => {
    const m = mount({ value: "totally-new" });
    expect(m.target.querySelector(".new-field-badge")).not.toBeNull();
    expect(m.target.querySelector(".field-combo-caret")).toBeNull();
    m.destroy();
  });

  test("empty value: caret shown, no badge", () => {
    const m = mount({ value: "" });
    expect(m.target.querySelector(".field-combo-caret")).not.toBeNull();
    expect(m.target.querySelector(".new-field-badge")).toBeNull();
    m.destroy();
  });

  test("datalist lists every field; input is associated for label `for`", () => {
    const m = mount({ value: "" });
    expect(m.target.querySelectorAll("datalist option")).toHaveLength(FIELDS.length);
    expect(m.input?.id).toBe("fl-test-input");
    m.destroy();
  });

  test("change event dispatches the current value", () => {
    const m = mount({ value: "" });
    if (m.input) {
      m.input.value = "mrr";
      m.input.dispatchEvent(new Event("input", { bubbles: true }));
      m.input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    expect(m.changes).toContain("mrr");
    m.destroy();
  });
});

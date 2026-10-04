import "@testing-library/jest-dom";
import { readFileSync } from "fs";
import { join } from "path";
import { tick } from "svelte";

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
    component,
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

describe("FieldComboInput — a datalist pick is accepted at once", () => {
  const pick = (input: HTMLInputElement, value: string, inputType?: string) => {
    input.focus();
    input.value = value;
    const event = inputType
      ? new InputEvent("input", { bubbles: true, inputType })
      : new Event("input", { bubbles: true });
    input.dispatchEvent(event);
  };

  test("picking an existing field commits without waiting for blur, and only once", () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    pick(input, "deadline", "insertReplacementText");
    expect(m.changes).toEqual(["deadline"]);
    // The blur's change after the pick writes nothing more.
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(m.changes).toEqual(["deadline"]);
    m.destroy();
  });

  test("a pick reported as a plain input event (no inputType) also commits", () => {
    const m = mount({ value: "" });
    pick(m.input as HTMLInputElement, "mrr");
    expect(m.changes).toEqual(["mrr"]);
    m.destroy();
  });

  test("typing does not commit per keystroke, even when it spells a field; blur commits", () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    pick(input, "mr", "insertText");
    pick(input, "mrr", "insertText");
    expect(m.changes).toEqual([]);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(m.changes).toEqual(["mrr"]);
    m.destroy();
  });

  test("an Enter that accepts an IME candidate does not commit; the Enter after composition does", () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    pick(input, "日付", "insertCompositionText");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true }));
    const legacy = new KeyboardEvent("keydown", { key: "Enter", bubbles: true });
    Object.defineProperty(legacy, "keyCode", { value: 229 });
    input.dispatchEvent(legacy);
    expect(m.changes).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(m.changes).toEqual(["日付"]);
    m.destroy();
  });

  test("a new field name is still accepted, on Enter or blur", () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    pick(input, "brand-new", "insertText");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(m.changes).toEqual(["brand-new"]);
    m.destroy();
  });
});

// settings-binds: the field owns its draft. A parent that passed a reactive
// declaration through `bind:value` had it re-run on the next flush and the
// saved value written back over the edit, so the real host lost every pick
// and typed name that committed after a flush. Each test below lets Svelte
// flush (`await tick()`) between the keystroke and the commit, which the
// tests above never did.
describe("FieldComboInput — the draft survives re-renders until it commits", () => {
  const typeInto = (input: HTMLInputElement, value: string, inputType = "insertText") => {
    input.value = value;
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType }));
  };
  const enter = (input: HTMLInputElement) =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

  test("a typed name is still there after a flush; the badge follows it; Enter commits it", async () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    input.focus();
    typeInto(input, "brand");
    await tick();
    expect(input.value).toBe("brand");
    expect(m.target.querySelector(".new-field-badge")).not.toBeNull();
    expect(m.changes).toEqual([]);
    enter(input);
    expect(m.changes).toEqual(["brand"]);
    m.destroy();
  });

  test("a prop update while focused does not clobber the draft", async () => {
    const m = mount({ value: "deadline" });
    const input = m.input as HTMLInputElement;
    input.focus();
    typeInto(input, "mr");
    m.component.$set({ value: "" });
    await tick();
    expect(input.value).toBe("mr");
    m.component.$set({ value: "deadline" });
    await tick();
    expect(input.value).toBe("mr");
    // The blur's change commits the edit, not the prop.
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    await tick();
    expect(m.changes).toEqual(["mr"]);
    expect(input.value).toBe("mr");
    m.destroy();
  });

  test("a committed draft survives a parent re-render that still passes the old value", async () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    input.focus();
    typeInto(input, "brand-new");
    enter(input);
    m.component.$set({ value: "" });
    await tick();
    expect(input.value).toBe("brand-new");
    input.blur();
    await tick();
    expect(input.value).toBe("brand-new");
    expect(m.changes).toEqual(["brand-new"]);
    m.destroy();
  });

  test("a prop update while blurred is adopted, and adopting is not a commit", async () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    m.component.$set({ value: "deadline" });
    await tick();
    expect(input.value).toBe("deadline");
    expect(m.target.querySelector(".field-combo-caret")).not.toBeNull();
    expect(m.target.querySelector(".new-field-badge")).toBeNull();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(m.changes).toEqual([]);
    m.component.$set({ value: "brand-new" });
    await tick();
    expect(input.value).toBe("brand-new");
    expect(m.target.querySelector(".new-field-badge")).not.toBeNull();
    expect(m.changes).toEqual([]);
    m.destroy();
  });

  test("a prop changed while focused, with nothing edited, is shown on blur", async () => {
    const m = mount({ value: "" });
    const input = m.input as HTMLInputElement;
    input.focus();
    m.component.$set({ value: "mrr" });
    await tick();
    expect(input.value).toBe("");
    input.blur();
    await tick();
    expect(input.value).toBe("mrr");
    expect(m.changes).toEqual([]);
    m.destroy();
  });

  test("a re-render that hands the same value down again leaves the draft alone", async () => {
    const m = mount({ value: "deadline" });
    const input = m.input as HTMLInputElement;
    typeInto(input, "mr");
    m.component.$set({ value: "deadline", placeholder: "x" });
    await tick();
    expect(input.value).toBe("mr");
    m.destroy();
  });

  test("the component never assigns its value prop", () => {
    // A text check of the source, because a Svelte 3 component without
    // accessors does not expose its props: the only write to `value` in the
    // script is the declaration, and the input is not bound to it.
    const text = readFileSync(join(__dirname, "..", "FieldComboInput.svelte"), "utf8");
    const script = (/<script[^>]*>([\s\S]*?)<\/script>/.exec(text)?.[1] ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, "");
    const writes = [...script.matchAll(/(?<![.\w$])value\s*(?:=(?![=>])|\+=|\+\+|--)/g)].map((m) => m[0]);
    expect(writes).toEqual(["value ="]);
    expect(script).toMatch(/export let value = ""/);
    expect(text).not.toMatch(/bind:value(?![\w$])/);
  });
});

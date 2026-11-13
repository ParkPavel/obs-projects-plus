/**
 * stab-forms, step 5 — ValueSuggestField: free text with the values a field
 * already holds as suggestions. `input` follows every edit, `commit` reports
 * the settled text once (pick, Enter, blur); Escape restores; a parent that
 * hands back a stale value cannot take the typed text away.
 */

import "@testing-library/jest-dom";

import {
  comboInputs,
  enter,
  listbox,
  mountCollecting,
  optionLabels,
  optionRows,
  press,
  settle,
  tap,
  typeInto,
} from "./support/comboKit";

const ValueSuggestField = require("../ValueSuggestField.svelte").default;

function mount(props: Record<string, unknown> = {}) {
  const m = mountCollecting<string>(ValueSuggestField, { value: "", suggestions: ["Alpha", "Beta"], ...props }, "commit");
  const inputs: string[] = [];
  m.component.$on("input", (e: CustomEvent<string>) => inputs.push(e.detail));
  return { ...m, inputs, box: () => comboInputs(m.target)[0]! };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ValueSuggestField", () => {
  test("typing reports each edit and filters; nothing is committed yet", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Al");
    await settle();
    expect(m.inputs).toEqual(["Al"]);
    expect(optionLabels()).toEqual(["Alpha"]);
    expect(m.events).toEqual([]);
    m.destroy();
  });

  test("a pick commits once with the picked value; the blur after it adds nothing", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Be");
    await settle();
    tap(optionRows()[0]!);
    m.box().blur();
    await settle();
    expect(m.events).toEqual(["Beta"]);
    expect(m.inputs).toEqual(["Be", "Beta"]);
    m.destroy();
  });

  test("Enter commits free text; Tab and blur after it add nothing", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Gamma");
    press(m.box(), "Enter");
    press(m.box(), "Tab");
    m.box().blur();
    await settle();
    expect(m.events).toEqual(["Gamma"]);
    m.destroy();
  });

  test("blur commits typed text once", async () => {
    const m = mount();
    await enter(m.box());
    typeInto(m.box(), "Zed");
    m.box().blur();
    await settle();
    expect(m.events).toEqual(["Zed"]);
    m.destroy();
  });

  test("Escape closes the list, then restores the entry text; nothing is committed", async () => {
    const m = mount({ value: "Alpha" });
    await enter(m.box());
    typeInto(m.box(), "Be");
    await settle();
    expect(listbox()).not.toBeNull();
    press(m.box(), "Escape");
    await settle();
    expect(listbox()).toBeNull();
    press(m.box(), "Escape");
    await settle();
    expect(m.box().value).toBe("Alpha");
    m.box().blur();
    await settle();
    expect(m.events).toEqual([]);
    m.destroy();
  });

  test("a stale value from the parent while focused does not replace the draft", async () => {
    const m = mount({ value: "Alpha" });
    await enter(m.box());
    typeInto(m.box(), "Alp");
    await settle();
    m.component.$set({ value: "Zzz" });
    await settle();
    expect(m.box().value).toBe("Alp");
    m.destroy();
  });

  test("no suggestions: a plain text box that still commits", async () => {
    const m = mount({ suggestions: [] });
    await enter(m.box());
    expect(listbox()).toBeNull();
    typeInto(m.box(), "x");
    press(m.box(), "Enter");
    expect(m.events).toEqual(["x"]);
    m.destroy();
  });
});

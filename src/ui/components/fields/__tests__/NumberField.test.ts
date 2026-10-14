/**
 * 3.7.2 B1b — NumberField: text draft, number commit through toNumber, digit
 * keyboard without type="number", bounds and empty handled by the field.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const NumberField = require("../NumberField.svelte").default;

function mount(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new NumberField({ target, props: { value: 5, ...props } });
  const commits: Array<number | null> = [];
  const inputs: Array<number | null> = [];
  component.$on("commit", (e: CustomEvent<number | null>) => commits.push(e.detail));
  component.$on("input", (e: CustomEvent<number | null>) => inputs.push(e.detail));
  const input = target.querySelector("input") as HTMLInputElement;
  return { component, input, commits, inputs };
}

async function type(el: HTMLInputElement, text: string): Promise<void> {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}
const enter = (el: HTMLElement) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("NumberField", () => {
  it("is a text input with a decimal keyboard, showing the number", () => {
    const m = mount({ value: 2.5 });
    expect(m.input).toHaveAttribute("type", "text");
    expect(m.input).toHaveAttribute("inputmode", "decimal");
    expect(m.input.value).toBe("2.5");
  });

  it("commits a typed number once on Enter, a comma read as a point", async () => {
    const m = mount();
    m.input.focus();
    await type(m.input, "1,5");
    enter(m.input);
    m.input.blur();
    expect(m.commits).toEqual([1.5]);
    expect(m.inputs).toEqual([1.5]);
  });

  it("rejects text that is not a number and restores it on blur", async () => {
    const m = mount();
    m.input.focus();
    await type(m.input, "abc");
    enter(m.input);
    await tick();
    expect(m.input).toHaveAttribute("aria-invalid", "true");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.input.value).toBe("5");
  });

  it("applies min, integer and allowEmpty", async () => {
    const m = mount({ min: 4, integer: true, allowEmpty: true });
    expect(m.input).toHaveAttribute("inputmode", "numeric");
    m.input.focus();
    await type(m.input, "3");
    enter(m.input);
    await type(m.input, "4.5");
    enter(m.input);
    await type(m.input, "");
    enter(m.input);
    expect(m.commits).toEqual([null]);
  });
});

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
  it("commits a completed outside tap even when the host keeps native focus, but scrolling or its own popup keeps the draft", async () => {
    const m = mount({ suggestions: ["12"] }); const outside = document.createElement("div"); document.body.appendChild(outside);
    const pointer = (target: HTMLElement, kind: string, y = 10) => {
      const event = new Event(kind, { bubbles: true, cancelable: true });
      Object.assign(event, { pointerId: 1, clientX: 10, clientY: y }); target.dispatchEvent(event);
    };
    try {
      m.input.focus(); await type(m.input, "12"); await tick();
      pointer(outside, "pointerdown", 100); pointer(outside, "pointerup", 200);
      expect(document.activeElement).toBe(m.input); expect(m.commits).toEqual([]);
      const row = document.querySelector<HTMLElement>('[role="option"]')!;
      pointer(row, "pointerdown"); pointer(row, "pointerup");
      expect(document.activeElement).toBe(m.input); expect(m.commits).toEqual([]);
      pointer(outside, "pointerdown"); pointer(outside, "pointerup"); await tick();
      expect(m.commits).toEqual([12]); expect(document.activeElement).not.toBe(m.input);
    } finally { m.component.$destroy(); outside.remove(); }
  });
  it("offers only valid numeric suggestions on its original input and commits a number once", async () => {
    const m = mount({ value: 5, suggestions: ["0", "12", "wrong", "Infinity"] });
    m.input.focus(); await tick(); await tick();
    expect(m.input).toHaveAttribute("role", "combobox");
    expect(Array.from(document.querySelectorAll('[role="option"]')).map(row => row.textContent)).toEqual(["0", "12"]);
    (document.querySelectorAll<HTMLElement>('[role="option"]')[0])?.click(); await tick(); m.input.blur();
    expect(m.commits).toEqual([0]); expect(document.querySelector('input')).toBe(m.input);
  });
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

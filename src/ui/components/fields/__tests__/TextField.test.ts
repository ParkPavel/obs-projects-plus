/**
 * stab-forms — TextField: one draft, one commit per interaction, Escape
 * restores, IME owns Enter/Escape. Every case awaits a flush between the
 * keystroke and the commit, which is the host's timing (R0.34).
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const TextField = require("../TextField.svelte").default;

type Commit = { value: string; reason: string };

function mount(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new TextField({ target, props: { value: "a", placeholder: "p", disabled: false, ...props } });
  const commits: Commit[] = [];
  const inputs: string[] = [];
  let cancels = 0;
  component.$on("commit", (e: CustomEvent<Commit>) => commits.push(e.detail));
  component.$on("input", (e: CustomEvent<string>) => inputs.push(e.detail));
  component.$on("cancel", () => (cancels += 1));
  const input = target.querySelector("input") as HTMLInputElement;
  return {
    target,
    component,
    input,
    commits,
    inputs,
    cancels: () => cancels,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const type = (el: HTMLInputElement, text: string) => {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (el: HTMLElement, k: string, init: KeyboardEventInit & { keyCode?: number } = {}) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, "keyCode", { value: init.keyCode });
  el.dispatchEvent(e);
  return e;
};

describe("TextField", () => {
  test("is seeded from the value and passes placeholder, disabled and inputmode through", () => {
    const m = mount({ inputMode: "decimal", disabled: true });
    expect(m.input.value).toBe("a");
    expect(m.input).toHaveAttribute("placeholder", "p");
    expect(m.input).toHaveAttribute("inputmode", "decimal");
    expect(m.input).toBeDisabled();
    m.destroy();
  });

  test("typing emits input(draft) and never commits; Enter commits once and the blur after it adds nothing", async () => {
    const m = mount();
    m.input.focus();
    type(m.input, "ab");
    await tick();
    type(m.input, "abc");
    await tick();
    expect(m.inputs).toEqual(["ab", "abc"]);
    expect(m.commits).toEqual([]);
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "abc", reason: "enter" }]);
    m.input.blur();
    await tick();
    expect(m.commits).toHaveLength(1);
    m.destroy();
  });

  test("blur commits an edit, with reason blur, and an unchanged blur commits nothing", async () => {
    const m = mount();
    m.input.focus();
    m.input.blur();
    expect(m.commits).toEqual([]);
    m.input.focus();
    type(m.input, "b");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "b", reason: "blur" }]);
    m.destroy();
  });

  test("a prop update while focused keeps the draft; the edit is what commits", async () => {
    const m = mount();
    m.input.focus();
    type(m.input, "mine");
    await tick();
    m.component.$set({ value: "from elsewhere" });
    await tick();
    expect(m.input.value).toBe("mine");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "mine", reason: "blur" }]);
    expect(m.input.value).toBe("mine");
    m.destroy();
  });

  test("a prop update while blurred is shown and is not a commit", async () => {
    const m = mount();
    m.component.$set({ value: "next" });
    await tick();
    expect(m.input.value).toBe("next");
    expect(m.commits).toEqual([]);
    m.destroy();
  });

  test("Escape restores the text the field had on entry, emits cancel, and the blur after it commits nothing", async () => {
    const m = mount();
    m.input.focus();
    type(m.input, "changed");
    await tick();
    key(m.input, "Escape");
    await tick();
    expect(m.input.value).toBe("a");
    expect(m.cancels()).toBe(1);
    m.input.blur();
    expect(m.commits).toEqual([]);
    m.destroy();
  });

  test("an Escape that restored something is consumed; an untouched field lets it through", async () => {
    const m = mount();
    const seen = jest.fn();
    m.target.addEventListener("keydown", seen);
    m.input.focus();
    key(m.input, "Escape");
    expect(seen).toHaveBeenCalledTimes(1);
    type(m.input, "changed");
    key(m.input, "Escape");
    expect(seen).toHaveBeenCalledTimes(1);
    m.destroy();
  });

  test("i2-input (D03): iOS Return with keyCode 229 and no composition commits", async () => {
    const m = mount();
    m.input.focus();
    type(m.input, "завтра");
    key(m.input, "Enter", { keyCode: 229 });
    expect(m.commits).toEqual([{ value: "завтра", reason: "enter" }]);
    m.destroy();
  });

  test("IME: the Enter that accepts a candidate does not commit; the next one does", async () => {
    const m = mount();
    m.input.focus();
    type(m.input, "日本");
    key(m.input, "Enter", { isComposing: true });
    // Safari: compositionend comes right before the Enter that accepts the candidate.
    m.input.dispatchEvent(new Event("compositionend", { bubbles: true }));
    key(m.input, "Enter", { keyCode: 229 });
    expect(m.commits).toEqual([]);
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "日本", reason: "enter" }]);
    m.destroy();
  });

  test("IME: between compositionstart and compositionend neither Enter nor Escape acts", async () => {
    const m = mount();
    m.input.focus();
    m.input.dispatchEvent(new Event("compositionstart", { bubbles: true }));
    type(m.input, "に");
    key(m.input, "Enter");
    key(m.input, "Escape");
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.cancels()).toBe(0);
    expect(m.input.value).toBe("に");
    m.input.dispatchEvent(new Event("compositionend", { bubbles: true }));
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "に", reason: "enter" }]);
    m.destroy();
  });

  test("validate: a rejected draft is not committed and is marked invalid; blur restores the value", async () => {
    const m = mount({ validate: (text: string) => /^\d*$/.test(text) });
    m.input.focus();
    type(m.input, "12x");
    key(m.input, "Enter");
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.input).toHaveAttribute("aria-invalid", "true");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.input.value).toBe("a");
    expect(m.input).not.toHaveAttribute("aria-invalid");
    m.destroy();
  });

  test("validate: an accepted draft commits", async () => {
    const m = mount({ value: "1", validate: (text: string) => /^\d*$/.test(text) });
    m.input.focus();
    type(m.input, "12");
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "12", reason: "enter" }]);
    m.destroy();
  });
});

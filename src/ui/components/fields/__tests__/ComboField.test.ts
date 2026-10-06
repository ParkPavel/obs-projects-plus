/**
 * stab-forms — ComboField: ARIA combobox over a portalled listbox, active
 * option by arrow keys, Enter/Escape/Tab, pointer and touch selection that
 * commits once, IME guard, draft kept across prop refreshes.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const ComboField = require("../ComboField.svelte").default;

const OPTIONS = [
  { id: "todo", label: "Todo" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
];

type Commit = { value: string; reason: string };

function mount(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const component = new ComboField({
    target,
    props: { value: "Todo", options: OPTIONS, allowCustom: true, ...props },
  });
  const commits: Commit[] = [];
  const selects: string[] = [];
  const drafts: string[] = [];
  let cancels = 0;
  component.$on("commit", (e: CustomEvent<Commit>) => commits.push(e.detail));
  component.$on("select", (e: CustomEvent<{ id: string }>) => selects.push(e.detail.id));
  component.$on("draftChange", (e: CustomEvent<string>) => drafts.push(e.detail));
  component.$on("cancel", () => (cancels += 1));
  const input = target.querySelector("input") as HTMLInputElement;
  return {
    target,
    component,
    input,
    commits,
    selects,
    drafts,
    cancels: () => cancels,
    destroy() {
      component.$destroy();
      target.remove();
    },
  };
}

const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
const labels = () => options().map((o) => o.textContent);
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
const open = async (m: ReturnType<typeof mount>) => {
  m.input.focus();
  await tick();
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ComboField — ARIA and the portalled popup", () => {
  test("closed: a combobox that is not expanded and controls nothing", () => {
    const m = mount();
    expect(m.input).toHaveAttribute("role", "combobox");
    expect(m.input).toHaveAttribute("aria-expanded", "false");
    expect(m.input).not.toHaveAttribute("aria-controls");
    expect(listbox()).toBeNull();
    m.destroy();
  });

  test("open: aria-expanded, aria-controls names the listbox, options are role=option with stable ids", async () => {
    const m = mount();
    await open(m);
    const list = listbox();
    expect(list).not.toBeNull();
    expect(m.input).toHaveAttribute("aria-expanded", "true");
    expect(m.input).toHaveAttribute("aria-controls", list!.id);
    expect(m.input).toHaveAttribute("aria-haspopup", "listbox");
    const ids = options().map((o) => o.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    // Stable: the same options produce the same ids after the list re-renders.
    m.component.$set({ options: [...OPTIONS] });
    await tick();
    expect(options().map((o) => o.id)).toEqual(ids);
    m.destroy();
  });

  test("the listbox is portalled to the body of the anchor's document and carries a registered root class", async () => {
    const m = mount();
    await open(m);
    const list = listbox()!;
    expect(list.parentElement).toBe(document.body);
    expect(m.target.contains(list)).toBe(false);
    expect(list.classList.contains("ppp-popup")).toBe(true);
    m.destroy();
    expect(listbox()).toBeNull();
  });

  test("the popup is positioned from the anchor, in rem", async () => {
    const m = mount();
    await open(m);
    await tick();
    await tick();
    const style = listbox()!.getAttribute("style") ?? "";
    expect(style).toMatch(/top:\s*[\d.-]+rem/);
    expect(style).toMatch(/left:\s*[\d.-]+rem/);
    expect(style).not.toMatch(/px/);
    m.destroy();
  });

  test("a field that already holds a value offers every option; typing filters", async () => {
    const m = mount();
    await open(m);
    expect(labels()).toEqual(["Todo", "Doing", "Done"]);
    type(m.input, "do");
    await tick();
    expect(labels()).toEqual(["Todo", "Doing", "Done"]);
    type(m.input, "doi");
    await tick();
    expect(labels()).toEqual(["Doing"]);
    expect(m.drafts).toEqual(["do", "doi"]);
    m.destroy();
  });

  test("no matching option: the popup is not shown and aria-expanded is false", async () => {
    const m = mount();
    await open(m);
    type(m.input, "zzz");
    await tick();
    expect(listbox()).toBeNull();
    expect(m.input).toHaveAttribute("aria-expanded", "false");
    m.destroy();
  });

  test("loading shows the list with a busy marker", async () => {
    const m = mount({ options: [], loading: true });
    await open(m);
    expect(listbox()).toHaveAttribute("aria-busy", "true");
    m.destroy();
  });
});

describe("ComboField — keyboard", () => {
  test("ArrowDown/ArrowUp move the active option, named by aria-activedescendant, wrapping", async () => {
    const m = mount({ value: "" });
    await open(m);
    expect(m.input).not.toHaveAttribute("aria-activedescendant");
    key(m.input, "ArrowDown");
    await tick();
    expect(m.input).toHaveAttribute("aria-activedescendant", options()[0]!.id);
    key(m.input, "ArrowDown");
    key(m.input, "ArrowDown");
    key(m.input, "ArrowDown");
    await tick();
    expect(m.input).toHaveAttribute("aria-activedescendant", options()[0]!.id);
    key(m.input, "ArrowUp");
    await tick();
    expect(m.input).toHaveAttribute("aria-activedescendant", options()[2]!.id);
    m.destroy();
  });

  test("Enter chooses the active option: select, then one commit with reason select; the popup closes", async () => {
    const m = mount({ value: "" });
    await open(m);
    key(m.input, "ArrowDown");
    key(m.input, "ArrowDown");
    key(m.input, "Enter");
    await tick();
    expect(m.selects).toEqual(["doing"]);
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]);
    expect(m.input.value).toBe("Doing");
    expect(listbox()).toBeNull();
    m.input.blur();
    await tick();
    expect(m.commits).toHaveLength(1);
    m.destroy();
  });

  test("Enter with no active option commits the typed text when allowCustom", async () => {
    const m = mount({ value: "" });
    await open(m);
    type(m.input, "brand-new");
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "brand-new", reason: "enter" }]);
    expect(m.selects).toEqual([]);
    m.input.blur();
    expect(m.commits).toHaveLength(1);
    m.destroy();
  });

  test("typing an exact option and pressing Enter reports it as a select too", async () => {
    const m = mount({ value: "" });
    await open(m);
    type(m.input, "Done");
    key(m.input, "Enter");
    expect(m.selects).toEqual(["done"]);
    expect(m.commits).toEqual([{ value: "Done", reason: "enter" }]);
    m.destroy();
  });

  test("Escape closes the popup first and cancels, restoring the entry text, second", async () => {
    const m = mount();
    await open(m);
    type(m.input, "Do");
    await tick();
    const first = key(m.input, "Escape");
    await tick();
    expect(first.defaultPrevented).toBe(true);
    expect(listbox()).toBeNull();
    expect(m.cancels()).toBe(0);
    expect(m.input.value).toBe("Do");
    key(m.input, "Escape");
    await tick();
    expect(m.cancels()).toBe(1);
    expect(m.input.value).toBe("Todo");
    m.input.blur();
    expect(m.commits).toEqual([]);
    m.destroy();
  });

  test("Tab commits the typed text and does not trap focus", async () => {
    const m = mount({ value: "" });
    await open(m);
    type(m.input, "x1");
    const tab = key(m.input, "Tab");
    expect(tab.defaultPrevented).toBe(false);
    expect(m.commits).toEqual([{ value: "x1", reason: "tab" }]);
    m.input.blur();
    expect(m.commits).toHaveLength(1);
    m.destroy();
  });

  test("Tab takes an option the user arrowed to", async () => {
    const m = mount({ value: "" });
    await open(m);
    key(m.input, "ArrowDown");
    key(m.input, "ArrowDown");
    key(m.input, "Tab");
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]);
    m.destroy();
  });

  test("blur commits an edit once, and an unchanged blur nothing", async () => {
    const m = mount();
    await open(m);
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    m.input.focus();
    type(m.input, "Other");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "Other", reason: "blur" }]);
    m.destroy();
  });

  test("commitUnchanged reports an unchanged blur, once", async () => {
    const m = mount({ commitUnchanged: true });
    await open(m);
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "Todo", reason: "blur" }]);
    m.destroy();
  });

  test("allowCustom=false: the top match is active while typing, a non-option is never committed, blur restores", async () => {
    const m = mount({ allowCustom: false });
    await open(m);
    type(m.input, "doi");
    await tick();
    expect(m.input).toHaveAttribute("aria-activedescendant", options()[0]!.id);
    type(m.input, "nothing");
    key(m.input, "Enter");
    expect(m.commits).toEqual([]);
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.input.value).toBe("Todo");
    m.destroy();
  });

  test("allowCustom=false: Enter takes the active top match", async () => {
    const m = mount({ allowCustom: false });
    await open(m);
    type(m.input, "doi");
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]);
    m.destroy();
  });
});

describe("ComboField — pointer and touch", () => {
  test("a press selects before the input blurs: it is prevented, so focus stays, and commits once", async () => {
    const m = mount();
    await open(m);
    const row = options()[1]!;
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    row.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(m.input);
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]);
    // The click that ends the same tap is the same selection.
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    m.input.blur();
    await tick();
    expect(m.commits).toHaveLength(1);
    expect(m.selects).toEqual(["doing"]);
    m.destroy();
  });

  test("a click with no press before it (touch, assistive technology) selects too", async () => {
    const m = mount();
    await open(m);
    options()[2]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(m.commits).toEqual([{ value: "Done", reason: "select" }]);
    m.destroy();
  });

  test("picking again after the list reopens commits again", async () => {
    const m = mount();
    await open(m);
    options()[1]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    await tick();
    m.input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    options()[2]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(m.commits.map((c) => c.value)).toEqual(["Doing", "Done"]);
    m.destroy();
  });

  test("a press inside the popup never moves focus off the input", async () => {
    const m = mount();
    await open(m);
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    listbox()!.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    m.destroy();
  });
});

describe("ComboField — IME", () => {
  test("between compositionstart and compositionend Enter, Escape and the arrows do nothing", async () => {
    const m = mount({ value: "" });
    await open(m);
    m.input.dispatchEvent(new Event("compositionstart", { bubbles: true }));
    type(m.input, "に");
    key(m.input, "ArrowDown");
    key(m.input, "Enter");
    key(m.input, "Escape");
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.cancels()).toBe(0);
    expect(m.input.value).toBe("に");
    expect(m.input).not.toHaveAttribute("aria-activedescendant");
    m.input.dispatchEvent(new Event("compositionend", { bubbles: true }));
    key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "に", reason: "enter" }]);
    m.destroy();
  });

  test("the Enter that accepts a candidate (isComposing, keyCode 229) neither commits nor activates an option", async () => {
    const m = mount({ value: "" });
    await open(m);
    key(m.input, "ArrowDown");
    key(m.input, "Enter", { isComposing: true });
    key(m.input, "Enter", { keyCode: 229 });
    expect(m.commits).toEqual([]);
    expect(m.selects).toEqual([]);
    m.destroy();
  });
});

describe("ComboField — the draft", () => {
  test("a prop refresh while focused keeps the draft; the edit is what commits", async () => {
    const m = mount();
    await open(m);
    type(m.input, "mine");
    await tick();
    m.component.$set({ value: "from elsewhere" });
    await tick();
    expect(m.input.value).toBe("mine");
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "mine", reason: "blur" }]);
    m.destroy();
  });

  test("a prop refresh while blurred is shown and is not a commit or a draftChange", async () => {
    const m = mount();
    m.component.$set({ value: "Done" });
    await tick();
    expect(m.input.value).toBe("Done");
    expect(m.commits).toEqual([]);
    expect(m.drafts).toEqual([]);
    m.destroy();
  });

  test("an untouched field focused during a refresh shows the parent's value after blur, without committing", async () => {
    const m = mount();
    await open(m);
    m.component.$set({ value: "Done" });
    await tick();
    expect(m.input.value).toBe("Todo");
    m.input.blur();
    await tick();
    expect(m.input.value).toBe("Done");
    expect(m.commits).toEqual([]);
    m.destroy();
  });

  test("disabled never opens", async () => {
    const m = mount({ disabled: true });
    m.input.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(listbox()).toBeNull();
    expect(m.input).toBeDisabled();
    m.destroy();
  });
});

describe("ComboField — multi", () => {
  test("a pick toggles and keeps the list open; nothing is committed; chosen options are aria-selected", async () => {
    const m = mount({ value: "", multi: true, selectedIds: ["doing"] });
    await open(m);
    expect(listbox()).toHaveAttribute("aria-multiselectable", "true");
    expect(options().map((o) => o.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    options()[0]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    options()[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await tick();
    expect(m.selects).toEqual(["todo"]);
    expect(m.commits).toEqual([]);
    expect(listbox()).not.toBeNull();
    key(m.input, "ArrowDown");
    key(m.input, "Enter");
    expect(m.selects).toEqual(["todo", "todo"]);
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    m.destroy();
  });
});

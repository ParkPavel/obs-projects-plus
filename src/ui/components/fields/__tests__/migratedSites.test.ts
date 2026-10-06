/**
 * stab-forms (rollout steps 2-3) — regression tests for the sites that moved
 * onto the shared primitives. Each case names the old behaviour it would have
 * failed on:
 *
 * - FieldComboInput: a native datalist; Escape had no restore path; blur relied
 *   on the native `change` for a typed name.
 * - CellChoiceDropdown: Enter committed during an IME composition; blur
 *   scheduled a second commit 150 ms later, after a pick had already committed.
 * - RelationPickerPopover: Enter always chose the first filtered result; no
 *   composition guard; no active-option navigation.
 * - PopoverList: items were bound to `mousedown` only (keyboard activation of a
 *   focused item and a touch click did nothing); the search had no arrow keys.
 * - TableControlBar / AgendaIconPicker: hand-built search inputs.
 */

import "@testing-library/jest-dom";
import { tick } from "svelte";

const FieldComboInput = require("src/ui/components/Navigation/SettingsMenu/tabs/FieldComboInput.svelte").default;
const CellChoiceDropdown = require("src/ui/views/Dashboard/widgets/DatabaseCall/CellChoiceDropdown.svelte").default;
const RelationPickerPopover = require("src/ui/views/Dashboard/widgets/DatabaseCall/RelationPickerPopover.svelte").default;
const PopoverList = require("src/ui/components/FloatingPopup/PopoverList.svelte").default;
const TableControlBar = require("src/ui/views/Dashboard/widgets/DatabaseCall/TableControlBar.svelte").default;
const AgendaIconPicker = require("src/ui/views/Calendar/agenda/AgendaIconPicker.svelte").default;

const key = (el: HTMLElement, k: string, init: KeyboardEventInit & { keyCode?: number } = {}) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, "keyCode", { value: init.keyCode });
  el.dispatchEvent(e);
  return e;
};
const type = (el: HTMLInputElement, text: string) => {
  el.value = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
};
const press = (el: HTMLElement) => el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await tick();
  await tick();
};

function host() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  return target;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FieldComboInput", () => {
  const FIELDS = [
    { name: "deadline", type: "date" },
    { name: "mrr", type: "number" },
  ];
  function mount(value = "deadline") {
    const target = host();
    const component = new FieldComboInput({ target, props: { id: "fc", fields: FIELDS, value } });
    const changes: string[] = [];
    component.$on("change", (e: CustomEvent<string>) => changes.push(e.detail));
    return { target, component, changes, input: target.querySelector("input") as HTMLInputElement };
  }

  test("no native datalist and no list attribute: the suggestions are the shared listbox", async () => {
    const m = mount("");
    expect(m.target.querySelector("datalist")).toBeNull();
    expect(m.input.hasAttribute("list")).toBe(false);
    expect(m.input).toHaveAttribute("role", "combobox");
    m.input.focus();
    await tick();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(rows().map((r) => r.textContent)).toEqual(["deadline", "mrr"]);
    m.component.$destroy();
  });

  test("Escape restores the name the field had on entry; nothing is committed, not even by the blur after it", async () => {
    const m = mount("deadline");
    m.input.focus();
    type(m.input, "brand-new");
    await tick();
    expect(m.target.querySelector(".new-field-badge")).not.toBeNull();
    key(m.input, "Escape");
    key(m.input, "Escape");
    await tick();
    expect(m.input.value).toBe("deadline");
    expect(m.target.querySelector(".new-field-badge")).toBeNull();
    m.input.blur();
    await tick();
    expect(m.changes).toEqual([]);
    m.component.$destroy();
  });

  test("a typed name commits on blur without a native change event", async () => {
    const m = mount("");
    m.input.focus();
    type(m.input, "brand-new");
    m.input.blur();
    await tick();
    expect(m.changes).toEqual(["brand-new"]);
    m.component.$destroy();
  });

  test("an arrowed pick commits once", async () => {
    const m = mount("");
    m.input.focus();
    await tick();
    key(m.input, "ArrowDown");
    key(m.input, "ArrowDown");
    key(m.input, "Enter");
    m.input.blur();
    await tick();
    expect(m.changes).toEqual(["mrr"]);
    m.component.$destroy();
  });
});

describe("CellChoiceDropdown", () => {
  function mount() {
    const target = host();
    const component = new CellChoiceDropdown({ target, props: { draft: "Todo", options: ["Todo", "Doing", "Done"] } });
    const commits: string[] = [];
    let cancels = 0;
    component.$on("commit", (e: CustomEvent<string>) => commits.push(e.detail));
    component.$on("cancel", () => (cancels += 1));
    const input = target.querySelector("input") as HTMLInputElement;
    return { target, component, commits, cancels: () => cancels, input };
  }

  test("the Enter that accepts an IME candidate does not commit; the Enter after composition does, once", async () => {
    const m = mount();
    await settle();
    m.input.focus();
    type(m.input, "完了");
    key(m.input, "Enter", { isComposing: true });
    key(m.input, "Enter", { keyCode: 229 });
    expect(m.commits).toEqual([]);
    key(m.input, "Enter");
    expect(m.commits).toEqual(["完了"]);
    m.component.$destroy();
  });

  test("a pick followed by the blur commits once, now and after the old 150 ms delay", async () => {
    const m = mount();
    await settle();
    m.input.focus();
    await tick();
    press(rows().find((r) => r.textContent === "Doing") as HTMLElement);
    m.input.blur();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(m.commits).toEqual(["Doing"]);
    m.component.$destroy();
  });

  test("a blur that changed nothing is reported at once, without a timer", async () => {
    const m = mount();
    await settle();
    m.input.focus();
    m.input.blur();
    expect(m.commits).toEqual(["Todo"]);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(m.commits).toEqual(["Todo"]);
    m.component.$destroy();
  });

  test("Escape cancels and the blur after it commits nothing", async () => {
    const m = mount();
    await settle();
    m.input.focus();
    type(m.input, "x");
    key(m.input, "Escape");
    m.input.blur();
    expect(m.cancels()).toBe(1);
    expect(m.commits).toEqual([]);
    m.component.$destroy();
  });

  test("the options are a listbox and a touch click picks one", async () => {
    const m = mount();
    await settle();
    m.input.focus();
    await tick();
    expect(m.input).toHaveAttribute("role", "combobox");
    click(rows().find((r) => r.textContent === "Done") as HTMLElement);
    expect(m.commits).toEqual(["Done"]);
    m.component.$destroy();
  });
});

describe("RelationPickerPopover", () => {
  const field = { name: "rel", type: "relation", repeated: false, identifier: false, derived: false, typeConfig: { relation: { targetProjectId: "p" } } };
  const api = {
    resolveExternalFrame: async () => ({ records: [{ id: "x/Alpha.md" }, { id: "Beta.md" }, { id: "Gamma.md" }] }),
  };
  async function mount() {
    const target = host();
    const component = new RelationPickerPopover({
      target,
      props: { field, value: null, api, frame: { fields: [], records: [] } },
    });
    const commits: unknown[] = [];
    let cancels = 0;
    component.$on("commit", (e: CustomEvent<unknown>) => commits.push(e.detail));
    component.$on("cancel", () => (cancels += 1));
    await settle();
    const input = target.querySelector("input.ppp-rel-picker-search") as HTMLInputElement;
    return { target, component, commits, cancels: () => cancels, input };
  }
  const items = (m: { target: HTMLElement }) => Array.from(m.target.querySelectorAll<HTMLElement>(".ppp-rel-picker-item"));

  test("Enter takes the top match until the user moves, then the active option", async () => {
    const first = await mount();
    key(first.input, "Enter");
    expect(first.commits).toEqual(["[[Alpha]]"]);
    first.component.$destroy();

    const moved = await mount();
    key(moved.input, "ArrowDown");
    key(moved.input, "Enter");
    expect(moved.commits).toEqual(["[[Beta]]"]);
    moved.component.$destroy();
  });

  test("the active option is named by aria-activedescendant, wraps, and follows the filter", async () => {
    const m = await mount();
    expect(m.input).toHaveAttribute("role", "combobox");
    const list = m.target.querySelector('[role="listbox"]') as HTMLElement;
    expect(m.input).toHaveAttribute("aria-controls", list.id);
    expect(m.input).toHaveAttribute("aria-activedescendant", items(m)[0]!.id);
    key(m.input, "ArrowUp");
    await tick();
    expect(m.input).toHaveAttribute("aria-activedescendant", items(m)[2]!.id);
    expect(items(m)[2]).toHaveClass("ppp-rel-picker-item--active");
    type(m.input, "ga");
    await tick();
    expect(items(m).map((i) => i.textContent?.trim())).toEqual(["Gamma"]);
    key(m.input, "Enter");
    expect(m.commits).toEqual(["[[Gamma]]"]);
    m.component.$destroy();
  });

  test("IME: Enter and Escape during composition do nothing; afterwards they act", async () => {
    const m = await mount();
    key(m.input, "Enter", { isComposing: true });
    key(m.input, "Enter", { keyCode: 229 });
    key(m.input, "Escape", { isComposing: true });
    expect(m.commits).toEqual([]);
    expect(m.cancels()).toBe(0);
    key(m.input, "Escape");
    expect(m.cancels()).toBe(1);
    m.component.$destroy();
  });

  test("a press on an option still picks it", async () => {
    const m = await mount();
    press(items(m)[1]!);
    expect(m.commits).toEqual(["[[Beta]]"]);
    m.component.$destroy();
  });
});

describe("PopoverList", () => {
  const make = () => {
    const picked: string[] = [];
    const items = [
      { label: "Apple", handler: () => picked.push("handler:Apple") },
      { label: "Banana" },
      { label: "Apricot" },
    ];
    return { items, picked };
  };
  function mount(props: Record<string, unknown>) {
    const target = host();
    const component = new PopoverList({ target, props });
    const selects: string[] = [];
    component.$on("select", (e: CustomEvent<{ item: { label: string } }>) => selects.push(e.detail.item.label));
    return { target, component, selects };
  }
  const buttons = (m: { target: HTMLElement }) => Array.from(m.target.querySelectorAll<HTMLButtonElement>(".ppp-pop-item"));

  test("a click with no press before it (Enter or Space on a focused item, a touch click) selects", async () => {
    const { items, picked } = make();
    const m = mount({ items });
    await tick();
    click(buttons(m)[1]!);
    expect(m.selects).toEqual(["Banana"]);
    click(buttons(m)[0]!);
    expect(m.selects).toEqual(["Banana", "Apple"]);
    expect(picked).toEqual(["handler:Apple"]);
    m.component.$destroy();
  });

  test("a tap is a press and a click, and selects once", async () => {
    const { items } = make();
    const m = mount({ items });
    await tick();
    const tap = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    buttons(m)[1]!.dispatchEvent(tap);
    expect(tap.defaultPrevented).toBe(true);
    click(buttons(m)[1]!);
    expect(m.selects).toEqual(["Banana"]);
    m.component.$destroy();
  });

  test("the search is the shared field, and arrows plus Enter pick from the filtered list", async () => {
    const { items } = make();
    const m = mount({ items, searchable: true });
    await settle();
    expect(m.target.querySelector(".ppp-search-field")).not.toBeNull();
    const input = m.target.querySelector("input.ppp-pop-search-input") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    type(input, "ap");
    await tick();
    expect(buttons(m).map((b) => b.textContent?.trim())).toEqual(["Apple", "Apricot"]);
    key(input, "ArrowDown");
    await tick();
    expect(buttons(m)[1]).toHaveClass("ppp-pop-item--active");
    key(input, "Enter");
    expect(m.selects).toEqual(["Apricot"]);
    m.component.$destroy();
  });

  test("Enter during an IME composition picks nothing", async () => {
    const { items } = make();
    const m = mount({ items, searchable: true });
    await settle();
    const input = m.target.querySelector("input.ppp-pop-search-input") as HTMLInputElement;
    type(input, "ap");
    await tick();
    key(input, "Enter", { isComposing: true });
    key(input, "Enter", { keyCode: 229 });
    expect(m.selects).toEqual([]);
    key(input, "Enter");
    expect(m.selects).toEqual(["Apple"]);
    m.component.$destroy();
  });

  test("the clear button empties the query and shows every item again", async () => {
    const { items } = make();
    const m = mount({ items, searchable: true });
    await settle();
    const input = m.target.querySelector("input.ppp-pop-search-input") as HTMLInputElement;
    type(input, "ban");
    await tick();
    expect(buttons(m)).toHaveLength(1);
    (m.target.querySelector(".ppp-search-field-clear") as HTMLElement).click();
    await tick();
    expect(buttons(m)).toHaveLength(3);
    m.component.$destroy();
  });
});

describe("TableControlBar search", () => {
  test("opens the shared search field focused, reports each query, and Escape closes it (not during composition)", async () => {
    const target = host();
    const component = new TableControlBar({ target, props: { sortCriteria: [], recordCount: 3 } });
    const searches: string[] = [];
    component.$on("search", (e: CustomEvent<string>) => searches.push(e.detail));
    (target.querySelector(".ppp-t2-cb-btn") as HTMLElement).click();
    await settle();
    expect(target.querySelector(".ppp-search-field")).not.toBeNull();
    const input = target.querySelector(".ppp-search-field input") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    type(input, "ab");
    expect(searches).toEqual(["ab"]);
    key(input, "Escape", { isComposing: true });
    expect(target.querySelector(".ppp-search-field")).not.toBeNull();
    key(input, "Escape");
    await tick();
    expect(target.querySelector(".ppp-search-field")).toBeNull();
    expect(searches).toEqual(["ab", ""]);
    component.$destroy();
  });
});

describe("AgendaIconPicker search", () => {
  test("filters the icon grid through the shared search field", async () => {
    const target = host();
    const component = new AgendaIconPicker({ target, props: { currentIcon: undefined } });
    await tick();
    expect(target.querySelector(".ppp-search-field")).not.toBeNull();
    const all = target.querySelectorAll(".icon-btn:not(.emoji)").length;
    type(target.querySelector(".ppp-search-field input") as HTMLInputElement, "clipboard");
    await tick();
    const shown = Array.from(target.querySelectorAll<HTMLElement>(".icon-btn:not(.emoji)")).map((b) => b.title);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(all);
    expect(shown.every((t) => t.includes("clipboard"))).toBe(true);
    component.$destroy();
  });
});

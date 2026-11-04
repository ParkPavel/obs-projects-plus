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
  await tick(); await tick(); await tick();
};

test("a human label commits its canonical value once and a later blurred prop can replace it", async () => {
  const m = mount({ value: "", options: [{ id: "today+1", value: "today+1", label: "Завтра" }] });
  try {
    await open(m); type(m.input, "Завтра"); await tick(); m.input.blur(); await tick();
    expect(m.commits).toEqual([{ value: "today+1", reason: "select" }]);
    expect(m.input.value).toBe("today+1");
    m.component.$set({ value: "today+2" }); await tick(); expect(m.input.value).toBe("today+2");
  } finally { m.destroy(); }
});

test("typed validation rejects Enter/Tab/selection without converting an invalid draft into a clear", async () => {
  const m = mount({ value: "12", options: [{ id: "bad", label: "wrong" }, { id: "good", label: "24" }], validate: (text: string) => /^\d+$/.test(text), inputMode: "decimal" });
  try {
    await open(m); type(m.input, "-"); await tick(); key(m.input, "Enter"); await tick();
    expect(m.commits).toEqual([]); expect(m.input).toHaveAttribute("aria-invalid", "true");
    expect(m.component.commitForNavigation()).toBe(false); expect(m.input).toHaveAttribute("inputmode", "decimal");
    m.component.reset("12"); m.input.blur(); await open(m);
    options().find(row => row.textContent === "wrong")!.click(); expect(m.commits).toEqual([]);
  } finally { m.destroy(); }
});

test("a table-style rejected blur keeps the draft and refocus/Escape restores its original baseline", async () => {
  const m = mount({ value: "12", options: [], validate: (text: string) => /^\d+$/.test(text), preserveInvalidOnBlur: true });
  try {
    await open(m); type(m.input, "-"); await tick(); m.input.blur(); await tick();
    expect(m.commits).toEqual([]); expect(m.input.value).toBe("-"); expect(m.input).toHaveAttribute("aria-invalid", "true");
    await open(m); key(m.input, "Escape"); await tick(); key(m.input, "Escape"); await tick();
    expect(m.input.value).toBe("12"); expect(m.commits).toEqual([]);
  } finally { m.destroy(); }
});

afterEach(() => {
  document.body.innerHTML = "";
});

test.each(["massazh", "vfccf;", "масаж"])("searches %s in the original input and commits the canonical label", async query => {
  const m = mount({ value: "", options: [{ id: "service-id", label: "Массаж" }], allowCustom: false });
  try {
    await open(m);
    type(m.input, query); await tick(); await tick(); await tick();
    expect(m.target.querySelector("input")).toBe(m.input);
    expect(document.activeElement).toBe(m.input);
    expect(labels()).toEqual(["Массаж"]);
    key(m.input, "Enter");
    expect(m.selects).toEqual(["service-id"]);
    expect(m.commits.map(commit => commit.value)).toEqual(["Массаж"]);
  } finally { m.destroy(); }
});

test("bounds the first page and can still find a canonical option beyond it", async () => {
  const m = mount({ value: "", options: Array.from({ length: 500 }, (_, id) => ({ id: `id-${id}`, label: `Service ${id}` })), allowCustom: false });
  try {
    await open(m);
    expect(options()).toHaveLength(50);
    type(m.input, "Service 499"); await tick(); await tick(); await tick();
    key(m.input, "Enter");
    expect(m.selects).toEqual(["id-499"]);
    expect(m.commits.map(commit => commit.value)).toEqual(["Service 499"]);
  } finally { m.destroy(); }
});

test("a reactive schema update invalidates indexed labels even when the array is reused", async () => {
  const source = [{ id: "service-id", label: "Массаж" }];
  const m = mount({ value: "", options: source, allowCustom: false });
  try {
    await open(m); type(m.input, "massazh"); await tick(); await tick(); await tick();
    expect(labels()).toEqual(["Массаж"]);
    source[0] = { id: "service-id", label: "Йога" };
    m.component.$set({ options: source }); await tick(); await tick(); await tick();
    expect(options()).toHaveLength(0);
    expect(m.target.querySelector("input")).toBe(m.input);
    expect(m.input.value).toBe("massazh");
    type(m.input, "yoga"); await tick(); await tick(); await tick();
    expect(labels()).toEqual(["Йога"]);
    key(m.input, "Enter"); expect(m.selects).toEqual(["service-id"]);
  } finally { m.destroy(); }
});

describe("ComboField — ARIA and the portalled popup", () => {
  const rect = (top: number, height: number) => ({ top, bottom: top + height, left: 20, right: 220, width: 200, height, x: 20, y: top, toJSON: () => ({}) });
  const settlePlacement = async () => { await tick(); await tick(); await tick(); };

  test("shrinks above the original field even when there is much more room below", async () => {
    const measured = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "INPUT" || this.classList.contains("ppp-combo") ? rect(80, 40) : rect(0, 160);
    });
    const m = mount();
    try {
      await open(m); await settlePlacement();
      const popup = listbox()!;
      const px = (value: string) => parseFloat(value) * 16;
      expect(px(popup.style.top) + px(popup.style.maxHeight)).toBeLessThan(80);
      expect(px(popup.style.maxHeight)).toBeGreaterThan(0);
      expect(m.target.querySelector("input")).toBe(m.input);
      expect(document.activeElement).toBe(m.input);
    } finally { m.destroy(); measured.mockRestore(); }
  });

  test.each([1, 0.5])("scrolls the original field into available room at container scale %s", async scale => {
    const m = mount();
    const scroller = document.createElement("div");
    m.target.before(scroller); scroller.append(m.target);
    scroller.scrollTop = 50 / scale;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "offsetHeight", { configurable: true, value: 160 / scale });
    const measured = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "INPUT" || this.classList.contains("ppp-combo") ? rect(60 - scroller.scrollTop * scale, 40) : rect(0, 160);
    });
    try {
      await open(m); await settlePlacement();
      expect(scroller.scrollTop).toBeLessThan(50 / scale);
      expect(m.target.querySelector("input")).toBe(m.input);
      expect(listbox()).not.toHaveAttribute("aria-hidden", "true");
    } finally { m.destroy(); measured.mockRestore(); scroller.remove(); }
  });

  test("when no upper room can be made, hides suggestions and keeps the input, query and caret", async () => {
    const measured = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "INPUT" || this.classList.contains("ppp-combo") ? rect(10, 40) : rect(0, 160);
    });
    const m = mount();
    try {
      await open(m); type(m.input, "Do"); m.input.setSelectionRange(1, 2);
      await settlePlacement();
      expect(m.input).toHaveAttribute("aria-expanded", "false");
      expect(listbox()).toHaveAttribute("aria-hidden", "true");
      expect(document.activeElement).toBe(m.input);
      expect(m.input).toHaveValue("Do");
      expect([m.input.selectionStart, m.input.selectionEnd]).toEqual([1, 2]);
      expect(m.commits).toEqual([]);
    } finally { m.destroy(); measured.mockRestore(); }
  });

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

  test("scrolling the portalled list in a secondary document does not reposition it", async () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const ownerDocument = iframe.contentDocument!;
    const ownerView = iframe.contentWindow! as Window & typeof globalThis;
    const rafDescriptor = Object.getOwnPropertyDescriptor(ownerView, "requestAnimationFrame");
    Object.defineProperty(ownerView, "requestAnimationFrame", { configurable: true, value: () => 0 });
    const target = ownerDocument.createElement("div");
    ownerDocument.body.appendChild(target);
    const component = new ComboField({
      target,
      props: { value: "Todo", options: OPTIONS, allowCustom: true },
    });

    try {
      const input = target.querySelector("input")!;
      input.focus();
      await tick();
      await tick();
      const measureAnchor = jest.fn(() => ({
        top: 100, bottom: 130, left: 20, right: 220, width: 200, height: 30,
        x: 20, y: 100, toJSON: () => ({}),
      }));
      input.getBoundingClientRect = measureAnchor;
      const popup = ownerDocument.querySelector<HTMLElement>('[role="listbox"]')!;
      for (let attempt = 0; attempt < 10 && !popup.style.top; attempt++) await tick();
      expect(popup.style.top).not.toBe("");
      await tick();
      await Promise.resolve();
      await tick();
      const before = measureAnchor.mock.calls.length;
      popup.dispatchEvent(new ownerView.Event("scroll", { bubbles: true }));
      await tick();
      await Promise.resolve();
      await tick();
      expect(measureAnchor).toHaveBeenCalledTimes(before);
    } finally {
      component.$destroy();
      if (rafDescriptor) Object.defineProperty(ownerView, "requestAnimationFrame", rafDescriptor);
      else Reflect.deleteProperty(ownerView, "requestAnimationFrame");
      iframe.remove();
    }
  });

  test("a field that already holds a value offers every option; typing filters", async () => {
    const m = mount();
    await open(m);
    expect(labels()).toEqual(["Todo", "Doing", "Done"]);
    type(m.input, "do");
    await tick();
    expect(labels()).toEqual(["Doing", "Done", "Todo"]);
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

  test("i3-input — allowCustom=false: blur keeps text that plainly means one option instead of throwing it away", async () => {
    const m = mount({ allowCustom: false });
    await open(m);
    type(m.input, "doi"); // only «Doing» still matches
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]);
    m.destroy();

    const n = mount({ allowCustom: false });
    await open(n);
    type(n.input, "done"); // the same label in another case
    n.input.blur();
    await tick();
    expect(n.commits).toEqual([{ value: "Done", reason: "select" }]);
    n.destroy();
  });

  test("i3-input — allowCustom=false: an ambiguous text is still restored on blur", async () => {
    const m = mount({ allowCustom: false });
    await open(m);
    type(m.input, "do"); // «Doing» and «Done»
    m.input.blur();
    await tick();
    expect(m.commits).toEqual([]);
    expect(m.input.value).toBe("Todo");
    m.destroy();
  });

  test("i3-input — a field removed while an edit is pending commits it", async () => {
    const m = mount();
    await open(m);
    type(m.input, "Typed");
    m.component.$destroy();
    expect(m.commits).toEqual([{ value: "Typed", reason: "blur" }]);
    m.target.remove();
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
  test("live queries receive the entire completed control value once, never partial composition text", async () => {
    const m = mount({ value: "prefix " }); await open(m);
    m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    type(m.input, "prefix か"); await tick(); expect(m.drafts).toEqual([]);
    m.input.value = "prefix かな";
    m.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "かな" }));
    type(m.input, "prefix かな"); await tick(); expect(m.drafts).toEqual(["prefix かな"]);
    m.input.blur(); expect(m.commits).toEqual([{ value: "prefix かな", reason: "blur" }]); m.destroy();
  });
  test.each(["readOnly", "destroy"])("a deferred composition cannot write after %s retires its interaction", async retirement => {
    const m = mount(); await open(m); m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    type(m.input, "か"); m.input.blur();
    if (retirement === "readOnly") { m.component.$set({ readOnly: true }); await tick(); } else m.destroy();
    m.input.value = "かな"; m.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "かな" }));
    expect(m.commits).toEqual([]); expect(m.drafts).toEqual([]); if (retirement === "readOnly") m.destroy();
  });
  test("a containing form cannot navigate or hide the active composition", async () => {
    const m = mount(); await open(m); m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    m.component.commitForNavigation(); await tick(); expect(listbox()).not.toBeNull(); expect(m.commits).toEqual([]); m.destroy();
  });
  test("an early blur waits for the final composition value without reopening its popup", async () => {
    const m = mount(); await open(m); m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    type(m.input, "か"); m.input.blur(); await tick(); expect(m.commits).toEqual([]);
    m.input.value = "かな"; m.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "かな" })); await tick();
    expect(m.commits).toEqual([{ value: "かな", reason: "blur" }]); expect(listbox()).toBeNull(); m.destroy();
  });
  test("a typed unique option chosen on blur leaves the interaction, so a later saved value is adopted", async () => {
    const m = mount({ allowCustom: false }); await open(m); type(m.input, "doin"); await tick();
    m.input.blur(); await tick(); expect(m.selects).toEqual(["doing"]);
    m.component.$set({ value: "Done" }); await tick(); expect(m.input.value).toBe("Done"); m.destroy();
  });
  test.each(["mousedown", "click"])("%s cannot commit a suggestion during an active composition", async eventName => {
    const m = mount(); await open(m); const option = options().find(row => row.textContent === "Doing")!;
    m.input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    option.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true })); expect(m.commits).toEqual([]);
    m.input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(m.commits).toEqual([{ value: "Doing", reason: "select" }]); m.destroy();
  });
  test("a case-ambiguous query does not silently choose the first option on blur", async () => {
    const m = mount({ value: "Legacy", allowCustom: false, options: [{ id: "a", label: "READY" }, { id: "b", label: "Ready" }] });
    await open(m); type(m.input, "ready"); m.input.blur(); await tick();
    expect(m.commits).toEqual([]); expect(m.input.value).toBe("Legacy"); m.destroy();
  });
  test("a configured choice can be cleared without picking an implicit first result", async () => {
    const m = mount({ allowCustom: false, allowEmpty: true }); await open(m); type(m.input, ""); await tick(); key(m.input, "Enter");
    expect(m.commits).toEqual([{ value: "", reason: "enter" }]); expect(m.selects).toEqual([]); m.destroy();
  });
  test("an unchanged unlisted value stays outside the options and can leave its editor", async () => {
    const m = mount({ value: "Legacy", allowCustom: false, allowUnlistedUnchanged: true, commitUnchanged: true });
    await open(m); expect(labels()).not.toContain("Legacy"); m.input.blur(); await tick();
    expect(m.commits).toEqual([{ value: "Legacy", reason: "blur" }]); m.destroy();
  });
  test("a queued mount cannot focus an input after its interaction was destroyed", async () => {
    const m = mount({ focusOnMount: true }), focus = jest.spyOn(m.input, "focus"); m.destroy(); await tick(); await tick(); expect(focus).not.toHaveBeenCalled();
  });
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
    // Safari: compositionend comes right before the Enter that accepts the candidate.
    m.input.dispatchEvent(new Event("compositionend", { bubbles: true }));
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

describe("ComboField dirty flag (stab-forms live finding)", () => {
  it("marks typed, uncommitted text and clears the mark on Escape and on commit", async () => {
    const f = mount({ value: "Todo", allowCustom: false });
    f.input.focus();
    f.input.dispatchEvent(new FocusEvent("focus"));
    type(f.input, "Todox");
    await tick();
    expect(f.input.getAttribute("data-ppp-dirty")).toBe("true");
    key(f.input, "Escape");
    await tick();
    if (f.input.getAttribute("data-ppp-dirty")) key(f.input, "Escape");
    await tick();
    expect(f.input.getAttribute("data-ppp-dirty")).toBeNull();
    expect(f.input.value).toBe("Todo");
    type(f.input, "Todo");
    await tick();
    key(f.input, "Enter");
    await tick();
    expect(f.input.getAttribute("data-ppp-dirty")).toBeNull();
    f.destroy();
  });
});

/**
 * stab-forms, step 5 — the agenda filter row on the shared primitives, and the
 * report "Agenda filter input takes focus but not text" (P1 #12).
 *
 * The value box was an `<input>` the row rendered itself, with its suggestion
 * popup and its field-search input built by hand with `createElement` and its
 * own key handling. It is now ValueSuggestField (a ComboField, which owns the
 * typed text) and the field list is the shared PopoverList with SearchField.
 *
 * The chain is traced end to end here: the FilterRow `update` event goes through
 * FilterGroupEditor to the AgendaFilterEditor `change` event, which carries the
 * typed value up to the list editor's state, and a parent that
 * echoes a STALE filter back while the user is still typing cannot take the
 * text away.
 *
 * Why these fail on the old code: the value box had no `role="combobox"` (the
 * first `comboInputs(...)[0]` is undefined and throws); the field search was an
 * `input.ppp-popover-search-input` appended to the body by hand, so the
 * SearchField (`[role="searchbox"]`) is not found; and the old input was bound
 * to the `filter.value` prop, so a stale echo reset it to the old text (the
 * "focus but no text" symptom) where the ComboField keeps its own draft.
 */

import "@testing-library/jest-dom";

import { DataFieldType } from "src/lib/dataframe/dataframe";
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
} from "src/ui/components/fields/__tests__/support/comboKit";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FilterRow = require("../FilterRow.svelte").default;
const AgendaFilterEditor = require("../AgendaFilterEditor.svelte").default;

const field = (name: string) => ({ name, type: DataFieldType.String, repeated: false, identifier: false, derived: false });
const fields = [field("status"), field("title")];
const records = [
  { id: "a", values: { status: "Alpha", title: "x" } },
  { id: "b", values: { status: "Beta", title: "y" } },
];
const filter = { id: "f1", field: "status", operator: "is", value: "" };

type Filter = { id: string; field: string; operator: string; value: unknown };

afterEach(() => {
  document.body.innerHTML = "";
});

describe("FilterRow — value box", () => {
  const mount = () => mountCollecting<Filter>(FilterRow, { filter, fields, records, prefix: "" }, "update");

  test("a combobox over the values the field holds; nothing is appended to the body by hand", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    expect(optionLabels()).toEqual(["Alpha", "Beta"]);
    expect(document.querySelector("input.ppp-popover-search-input")).toBeNull();
    m.destroy();
  });

  test("typing reaches the parent as the new filter value", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    expect(m.events).toHaveLength(1);
    expect(m.events[0]).toEqual({ ...filter, value: "Al" });
    m.destroy();
  });

  test("a pick writes once more with the picked value; the commit and the blur add nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    tap(optionRows()[0]!);
    box.blur();
    await settle();
    expect(m.events.map((e) => e.value)).toEqual(["Al", "Alpha"]);
    m.destroy();
  });

  test("Enter on text outside the list writes it once", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Gamma");
    press(box, "Enter");
    box.blur();
    await settle();
    expect(m.events.map((e) => e.value)).toEqual(["Gamma"]);
    m.destroy();
  });

  test("Escape closes the list, then restores the entry text", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "A");
    await settle();
    expect(listbox()).not.toBeNull();
    press(box, "Escape");
    await settle();
    expect(listbox()).toBeNull();
    expect(box.value).toBe("A");
    press(box, "Escape");
    await settle();
    expect(box.value).toBe("");
    expect(m.events[m.events.length - 1]?.value).toBe("");
    m.destroy();
  });

  test("a stale echo from the parent while typing does not take the text away", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Alp");
    await settle();
    // The parent never took the edit: it hands the old filter back.
    m.component.$set({ filter: { ...filter } });
    await settle();
    expect(box.value).toBe("Alp");
    m.destroy();
  });
});

describe("FilterRow — field list", () => {
  const mount = () => mountCollecting<Filter>(FilterRow, { filter, fields, records, prefix: "" }, "update");

  test("the chip opens the shared search list: a SearchField, not a hand-built input", async () => {
    const m = mount();
    m.target.querySelector<HTMLElement>(".chip--field")!.click();
    await settle();
    expect(document.querySelector('[role="searchbox"]')).not.toBeNull();
    expect(document.querySelector("input.ppp-popover-search-input")).toBeNull();
    expect(document.querySelectorAll(".ppp-pop-item")).toHaveLength(2);
    m.destroy();
  });

  test("typing filters; Enter picks the top match and writes the field once", async () => {
    const m = mount();
    m.target.querySelector<HTMLElement>(".chip--field")!.click();
    await settle();
    const search = document.querySelector<HTMLInputElement>('[role="searchbox"]')!;
    typeInto(search, "ti");
    await settle();
    expect(Array.from(document.querySelectorAll(".ppp-pop-item")).map((e) => e.textContent?.trim())).toEqual(["title"]);
    press(search, "Enter");
    await settle();
    expect(m.events).toHaveLength(1);
    expect(m.events[0]).toMatchObject({ id: "f1", field: "title", value: "" });
    expect(document.querySelector('[role="searchbox"]')).toBeNull();
    m.destroy();
  });

  test("Escape closes the list and writes nothing", async () => {
    const m = mount();
    m.target.querySelector<HTMLElement>(".chip--field")!.click();
    await settle();
    const search = document.querySelector<HTMLInputElement>('[role="searchbox"]')!;
    typeInto(search, "ti");
    press(search, "Escape");
    await settle();
    expect(document.querySelector('[role="searchbox"]')).toBeNull();
    expect(m.events).toEqual([]);
    expect(document.activeElement).toBe(m.target.querySelector(".chip--field"));
    m.destroy();
  });
});

describe("AgendaFilterEditor — P1 #12: the typed value reaches the list state", () => {
  const group = { id: "g1", conjunction: "AND", filters: [filter], groups: [] };
  const mount = () => mountCollecting<{ filters: Filter[] }>(AgendaFilterEditor, { filterGroup: group, fields, records }, "change");

  test("typing in the value box emits a change whose filter carries the text", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Be");
    await settle();
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.filters[0]?.value).toBe("Be");
    expect(m.events[0]?.filters[0]?.id).toBe("f1");
    m.destroy();
  });

  test("the text stays in the box through the re-render the edit causes", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Be");
    await settle();
    typeInto(box, "Bet");
    await settle();
    expect(box.value).toBe("Bet");
    expect(m.events.map((e) => e.filters[0]?.value)).toEqual(["Be", "Bet"]);
    m.destroy();
  });
});

describe("FilterRow — operator menu on the shared popup", () => {
  const activeDocDescriptor = Object.getOwnPropertyDescriptor(globalThis, "activeDocument");
  beforeEach(() => {
    // Mimic the old Obsidian-only DOM extension, so RED tests its menu behavior.
    Object.defineProperty(globalThis, "activeDocument", { configurable: true, value: {
      body: document.body,
      createElement: (tag: string) => {
        const node = document.createElement(tag);
        Object.assign(node, { addClass: (...classes: string[]) => node.classList.add(...classes) });
        return node;
      },
    } });
  });
  afterEach(() => {
    if (activeDocDescriptor) Object.defineProperty(globalThis, "activeDocument", activeDocDescriptor);
    else Reflect.deleteProperty(globalThis, "activeDocument");
  });
  test("keyboard arrows navigate and button activation selects once, no-value operators clear the old value", async () => {
    const m = mountCollecting<Filter>(FilterRow, { filter: { ...filter, value: "Alpha" }, fields, records }, "update");
    const trigger = m.target.querySelector<HTMLElement>(".chip--operator")!;
    trigger.focus(); trigger.click(); await settle();
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu).not.toBeNull(); expect(document.querySelector(".ppp-filter-popover")).toBeNull();
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(document.activeElement).toBe(items[0]);
    press(items[0]!, "ArrowDown"); expect(document.activeElement).toBe(items[1]);
    press(items[1]!, "Home"); expect(document.activeElement).toBe(items[0]);
    items[0]!.click(); await settle();
    expect(m.events).toEqual([{ ...filter, operator: "is-empty", value: null }]);
    expect(document.querySelector('[role="menu"]')).toBeNull(); expect(document.activeElement).toBe(trigger);
    m.destroy();
  });

  test("IME Escape does not close; normal Escape cancels, a touch-style click preserves a required value", async () => {
    const m = mountCollecting<Filter>(FilterRow, { filter: { ...filter, value: "Alpha" }, fields, records }, "update");
    const trigger = m.target.querySelector<HTMLElement>(".chip--operator")!;
    trigger.click(); await settle();
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!; expect(menu).not.toBeNull();
    press(menu, "Escape", { isComposing: true }); await settle(); expect(document.querySelector('[role="menu"]')).not.toBeNull();
    press(menu, "Escape"); await settle(); expect(document.querySelector('[role="menu"]')).toBeNull(); expect(m.events).toEqual([]);
    trigger.click(); await settle();
    (document.querySelectorAll<HTMLElement>('[role="menuitem"]')[4])!.click(); await settle();
    expect(m.events).toEqual([{ ...filter, operator: "contains", value: "Alpha" }]);
    m.destroy(); expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  test("a row moved to another window opens and dismisses its operator menu in that document, not the global activeDocument", async () => {
    const m = mountCollecting<Filter>(FilterRow, { filter, fields, records }, "update");
    const iframe = document.createElement("iframe"); document.body.append(iframe);
    const ownDoc = iframe.contentDocument!;
    ownDoc.body.append(m.target);
    const trigger = m.target.querySelector<HTMLElement>(".chip--operator")!;
    trigger.focus(); trigger.click(); await settle();
    const menu = ownDoc.querySelector<HTMLElement>('[role="menu"]'); expect(menu).not.toBeNull();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    const ownView = iframe.contentWindow! as Window & typeof globalThis;
    menu!.dispatchEvent(new ownView.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await settle();
    expect(ownDoc.querySelector('[role="menu"]')).toBeNull(); expect(m.events).toEqual([]);
    expect(ownDoc.activeElement).toBe(trigger);
    m.destroy(); iframe.remove();
  });
});

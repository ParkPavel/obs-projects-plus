/**
 * stab-forms, step 5 — the value box of a FilterPanel condition is the shared
 * ValueSuggestField (a ComboField): typing filters the suggestions and writes
 * after the debounce, a pick or Enter writes at once and exactly once, and
 * Escape restores the text the box had on entry.
 *
 * Why these fail on the old code: the box was a bare `<input class="value-input">`
 * with a hand-driven FloatingPopup for suggestions, so there is no
 * `role="combobox"` to find (the first `comboInputs(...)[0]` call is undefined
 * and throws), its popup was a `role="menu"` rather than a listbox, a pick did
 * not stop the pending typed write from landing after it, and Escape did
 * nothing to the text.
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
} from "src/ui/components/fields/__tests__/support/comboKit";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FilterPanel = require("../FilterPanel.svelte").default;

type Def = { conditions: Array<{ field: string; operator: string; value?: string }> };

const fields = [{ name: "title", type: "string" }];
const records = [
  { id: "a", values: { title: "Alpha" } },
  { id: "b", values: { title: "Beta" } },
];
const value = { conjunction: "and", conditions: [{ field: "title", operator: "is", value: "", enabled: true }], groups: [] };

function mount() {
  return mountCollecting<Def>(FilterPanel, { value, fields, records }, "update");
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = "";
});

describe("FilterPanel — value box", () => {
  test("the value box is a combobox over the values the field holds", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    expect(optionLabels()).toEqual(["Alpha", "Beta"]);
    expect(listbox()).toHaveAttribute("role", "listbox");
    m.destroy();
  });

  test("typing filters the suggestions and writes once, after the debounce", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    expect(optionLabels()).toEqual(["Alpha"]);
    expect(m.events).toEqual([]);
    jest.advanceTimersByTime(150);
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.conditions[0]?.value).toBe("Al");
    m.destroy();
  });

  test("a pick writes at once and exactly once; the typed write pending before it is superseded", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    tap(optionRows()[0]!);
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.conditions[0]?.value).toBe("Alpha");
    box.blur();
    await settle();
    jest.advanceTimersByTime(500);
    expect(m.events).toHaveLength(1);
    m.destroy();
  });

  test("Enter on typed text writes it once; the blur after it adds nothing", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Gamma");
    press(box, "Enter");
    box.blur();
    await settle();
    jest.advanceTimersByTime(500);
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.conditions[0]?.value).toBe("Gamma");
    m.destroy();
  });

  test("Escape closes the list, then restores the entry text; only the original value is ever written", async () => {
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
    box.blur();
    await settle();
    jest.advanceTimersByTime(500);
    expect(m.events.every((d) => d.conditions[0]?.value === "")).toBe(true);
    m.destroy();
  });
});

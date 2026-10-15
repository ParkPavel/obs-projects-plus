/**
 * stab-forms, step 5 — the value box of a colour rule is the shared
 * ValueSuggestField (a ComboField): the rule follows the typing, a pick lands
 * once (the commit that settles it carries the same text and writes nothing
 * more), and Escape restores the text the box had on entry.
 *
 * Why these fail on the old code: the box was a bare `<input class="value-input">`
 * whose suggestions came from a hand-driven FloatingPopup menu, so there is no
 * `role="combobox"` to find (the first `comboInputs(...)[0]` is undefined and
 * throws), and it wrote on every `input` event with no commit to settle it, so a
 * pick wrote a second time when the popup handler ran.
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

const ColorFiltersTab = require("../ColorFiltersTab.svelte").default;

type Def = { conditions: Array<{ condition: { value?: string } }> };

const fields = [{ name: "title", type: "string" }];
const records = [
  { id: "a", values: { title: "Alpha" } },
  { id: "b", values: { title: "Beta" } },
];
const value = {
  conditions: [{ color: "#ff0000", condition: { field: "title", operator: "is", value: "", enabled: true } }],
};

const mount = () => mountCollecting<Def>(ColorFiltersTab, { value, fields, records }, "update");
const last = (events: Def[]): string | undefined => events[events.length - 1]?.conditions[0]?.condition.value;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ColorFiltersTab — value box", () => {
  test("a combobox over the values the field holds", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    expect(optionLabels()).toEqual(["Alpha", "Beta"]);
    m.destroy();
  });

  test("typing updates the rule", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    expect(optionLabels()).toEqual(["Alpha"]);
    expect(last(m.events)).toBe("Al");
    m.destroy();
  });

  test("a pick writes the value once; the commit and the blur after it write nothing more", async () => {
    const m = mount();
    const box = comboInputs(m.target)[0]!;
    await enter(box);
    typeInto(box, "Al");
    await settle();
    const before = m.events.length;
    tap(optionRows()[0]!);
    expect(m.events).toHaveLength(before + 1);
    expect(last(m.events)).toBe("Alpha");
    box.blur();
    await settle();
    expect(m.events).toHaveLength(before + 1);
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
    expect(last(m.events)).toBe("");
    m.destroy();
  });
});

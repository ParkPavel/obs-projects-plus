/**
 * w4-filters (N11) — one value cell for a condition: a date compared with a
 * day takes a date formula (with its suggestions) in the view's filter and the
 * colour rules, as it did only in the agenda; other values are the suggestion
 * box.
 *
 * Why these fail on the old code: the view's filter and the colour rules drew
 * the suggestion box for every value, dates included.
 */

import "@testing-library/jest-dom";
import { comboInputs, mountCollecting } from "src/ui/components/fields/__tests__/support/comboKit";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FilterPanel = require("../FilterPanel.svelte").default;
const ColorFiltersTab = require("src/ui/components/Navigation/SettingsMenu/tabs/ColorFiltersTab.svelte").default;

const fields = [{ name: "due", type: "date" }, { name: "title", type: "string" }];
const records = [{ id: "a", values: { title: "Alpha" } }];
const cond = (field: string, operator: string) => ({ field, operator, value: "", enabled: true });

afterEach(() => {
  document.body.innerHTML = "";
});

const formulaInputs = (root: ParentNode) => root.querySelectorAll(".date-formula-input");

describe("w4-filters — the condition's value cell", () => {
  test("view filter: a date before a day takes a formula; text takes the suggestion box", () => {
    const value = { conjunction: "and", conditions: [cond("due", "is-before"), cond("title", "is")], groups: [] };
    const m = mountCollecting(FilterPanel, { value, fields, records }, "update");
    expect(formulaInputs(m.target)).toHaveLength(1);
    expect(comboInputs(m.target)).toHaveLength(1);
    m.destroy();
  });

  test("a relative date operator needs no value; 'last N days' takes a number in the box", () => {
    const value = { conjunction: "and", conditions: [cond("due", "is-today"), cond("due", "is-last-n-days")], groups: [] };
    const m = mountCollecting(FilterPanel, { value, fields, records }, "update");
    expect(formulaInputs(m.target)).toHaveLength(0);
    m.destroy();
  });

  test("colour rules: the same cell", () => {
    const value = { conditions: [{ color: "#f00", condition: cond("due", "is-on") }] };
    const m = mountCollecting(ColorFiltersTab, { value, fields, records }, "update");
    expect(formulaInputs(m.target)).toHaveLength(1);
    m.destroy();
  });
});

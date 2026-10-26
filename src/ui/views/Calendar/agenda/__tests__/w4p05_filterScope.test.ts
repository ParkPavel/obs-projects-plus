/**
 * w4-p05 (audit F11, P05) — the agenda's value box offers what the main filter
 * panel and the colour rules offer: the project's values, no templates, no
 * other project's notes.
 *
 * The fixture is one vault with two projects and a template folder: the
 * calendar's records are project A's; project B's notes and the template hold
 * values of the same field.
 *
 * Why these fail on the old code: the agenda added every markdown file of the
 * vault, so "Foreign" (project B), "Template only" and the Templater text
 * appeared in it and not in the filter panel; the panel ignored the field's
 * declared options.
 */

import "@testing-library/jest-dom";
import { app } from "src/lib/stores/obsidian";
import { comboInputs, enter, mountCollecting, optionLabels } from "src/ui/components/fields/__tests__/support/comboKit";

jest.mock("src/lib/stores/ui", () => {
  const { writable } = require("svelte/store");
  return { isMobile: writable(false) };
});

const FilterRow = require("../FilterRow.svelte").default;
const FilterPanel = require("src/ui/components/FilterPanel/FilterPanel.svelte").default;
const ColorFiltersTab = require("src/ui/components/Navigation/SettingsMenu/tabs/ColorFiltersTab.svelte").default;

const vault: Record<string, Record<string, unknown>> = {
  "A/visit-1.md": { status: "Alpha" },
  "A/visit-2.md": { status: "Beta" },
  "B/order.md": { status: "Foreign" },
  "Templates/visit.md": { status: "Template only" },
  "A/draft.md": { status: "<% tp.system.prompt('status') %>" },
};
const fakeApp = {
  vault: { getMarkdownFiles: () => Object.keys(vault).map((path) => ({ path })) },
  metadataCache: { getFileCache: (f: { path: string }) => ({ frontmatter: vault[f.path] }) },
  internalPlugins: { getPluginById: (id: string) => (id === "templates" ? { enabled: true, instance: { options: { folder: "Templates" } } } : null) },
};

const field = { name: "status", type: "string", repeated: false, identifier: false, derived: false, typeConfig: { options: ["Planned"] } };
// Project A's records as the view reads them (the draft holds template text).
const records = ["A/visit-1.md", "A/visit-2.md", "A/draft.md"].map((id) => ({ id, values: { ...vault[id] } }));
const expected = ["Planned", "Alpha", "Beta"];

beforeEach(() => {
  app.set(fakeApp as never);
});
afterEach(() => {
  document.body.innerHTML = "";
});

async function offered(component: unknown, props: Record<string, unknown>): Promise<string[]> {
  const m = mountCollecting(component as never, props, "update");
  const box = comboInputs(m.target)[0]!;
  await enter(box);
  const labels = optionLabels();
  m.destroy();
  return labels;
}

describe("w4-p05 — one list of suggestions on every filter surface", () => {
  test("agenda filter row: the project's values after the declared options", async () => {
    const filter = { id: "f1", field: "status", operator: "is", value: "" };
    expect(await offered(FilterRow, { filter, fields: [field], records, prefix: "" })).toEqual(expected);
  });

  test("main filter panel: the same list", async () => {
    const value = { conjunction: "and", conditions: [{ field: "status", operator: "is", value: "", enabled: true }], groups: [] };
    expect(await offered(FilterPanel, { value, fields: [field], records })).toEqual(expected);
  });

  test("colour rules: the same list", async () => {
    const value = { conditions: [{ color: "#f00", condition: { field: "status", operator: "is", value: "", enabled: true } }] };
    expect(await offered(ColorFiltersTab, { value, fields: [field], records })).toEqual(expected);
  });
});

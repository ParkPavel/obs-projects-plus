import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { getOperatorLabel, getSortOrderLabel } from "src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers";
import type { FilterDefinition } from "src/settings/base/settings";

const FilterPanel = require("../FilterPanel.svelte").default;
const SortTab = require("src/ui/components/Navigation/SettingsMenu/tabs/SortTab.svelte").default;
const ColorFiltersTab = require("src/ui/components/Navigation/SettingsMenu/tabs/ColorFiltersTab.svelte").default;
const fields = [{ name: "status", type: "string" }, { name: "Status", type: "number" }, { name: "date", type: "date" }];
const condition = { field: "status", operator: "is", value: "old", enabled: true };
const cases = [
  { name: "filter", component: FilterPanel, value: { conjunction: "and", conditions: [condition], groups: [] }, part: ".chip--op", label: getOperatorLabel("contains"), code: "contains" },
  { name: "sort", component: SortTab, value: { criteria: [{ field: "status", order: "asc", enabled: true }] }, part: ".chip--order", label: getSortOrderLabel("desc"), code: "desc" },
  { name: "colors", component: ColorFiltersTab, value: { conditions: [{ color: "#abcdef", condition }] }, part: ".chip--op", label: getOperatorLabel("contains"), code: "contains" },
];
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);
type Row = { field: string; operator?: string; order?: string };
type Definition = { criteria?: Row[]; conditions?: Array<Row | { condition: Row }> };
function latest(events: Definition[], kind: string): Row | undefined {
  const value = events[events.length - 1]; if (kind === "sort") return value?.criteria?.[0];
  const first = value?.conditions?.[0]; return first && "condition" in first ? first.condition : first;
}
async function pick(input: HTMLInputElement, label: string) {
  input.focus(); await flush();
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent === label)!;
  expect(option).toBeDefined(); option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); await flush();
}
it.each(cases)("$name keeps the property chooser in its original row and preserves the exact selected YAML key", async scenario => {
  const view = render(scenario.component, { props: { value: scenario.value, fields, records: [] } }), changes: Definition[] = [];
  view.component.$on("update", (event: CustomEvent<Definition>) => changes.push(event.detail)); await flush();
  const input = view.container.querySelector<HTMLInputElement>('.chip--field input[role="combobox"]'); expect(input).not.toBeNull();
  await pick(input!, "Status"); expect(latest(changes, scenario.name)?.field).toBe("Status"); expect(changes).toHaveLength(1);
  expect(view.container.querySelector(".chip--field input")).toBe(input); expect(document.activeElement).toBe(input);
  expect(document.querySelector(".ppp-popup input")).toBeNull(); view.unmount();
});
it.each(cases)("$name stores the operator/order code rather than its translated label", async scenario => {
  const view = render(scenario.component, { props: { value: scenario.value, fields, records: [] } }), changes: Definition[] = [];
  view.component.$on("update", (event: CustomEvent<Definition>) => changes.push(event.detail)); await flush();
  const input = view.container.querySelector<HTMLInputElement>(`${scenario.part} input[role="combobox"]`); expect(input).not.toBeNull();
  await pick(input!, scenario.label); const value = latest(changes, scenario.name);
  expect(scenario.name === "sort" ? value?.order : value?.operator).toBe(scenario.code); expect(changes).toHaveLength(1); view.unmount();
});

it.each([0, 1])("a chooser inside group depth %i changes only that condition and resets an incompatible operator", async depth => {
  const old = { ...condition, operator: "contains" as const };
  const nested: FilterDefinition = { conjunction: "and", conditions: [{ ...old }] };
  const value: FilterDefinition = { conjunction: "and", conditions: [{ ...old }], groups: [{ ...nested, groups: [nested] }] };
  const view = render(FilterPanel, { props: { value, fields, records: [] } }), changes: FilterDefinition[] = [];
  try {
    view.component.$on("update", (event: CustomEvent<FilterDefinition>) => changes.push(event.detail)); await flush();
    const inputs = view.container.querySelectorAll<HTMLInputElement>('.chip--field input[role="combobox"]');
    await pick(inputs[depth + 1]!, "date"); expect(changes).toHaveLength(1);
    const saved = changes[0]!, firstGroup = saved.groups![0]!;
    const edited = depth ? firstGroup.groups![0]!.conditions[0] : firstGroup.conditions[0];
    expect(edited).toMatchObject({ field: "date", operator: "is-empty", value: "" });
    expect(saved.conditions[0]).toEqual(old);
    expect(depth ? firstGroup.conditions[0] : firstGroup.groups![0]!.conditions[0]).toEqual(old);
  } finally { view.unmount(); }
});

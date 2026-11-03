import "@testing-library/jest-dom";
import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { applyFilter } from "src/lib/engine/filterEvaluator";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { FilterCondition, FilterDefinition } from "src/settings/base/settings";

const BlockFilterBar = require("../BlockFilterBar.svelte").default;
const fields = [{ name: "status", type: DataFieldType.String, repeated: false, identifier: false, derived: false }];
const cond = (value: string, enabled = true): FilterCondition => ({ field: "status", operator: "is", value, enabled });
const group: FilterDefinition = { conjunction: "or", conditions: [cond("open"), cond("planned")] };
const flush = async () => { await tick(); await tick(); await tick(); };
afterEach(cleanup);

async function open(view: { container: HTMLElement }) { view.container.querySelector<HTMLButtonElement>(".ppp-blockfilter-button")!.click(); await flush(); }

test("a read-only group-only filter is visible, counts enabled descendants and preserves AND/OR in its summary", async () => {
  const filter: FilterDefinition = { conjunction: "and", conditions: [], groups: [{ ...group, conditions: [cond("open"), cond("ignored", false)], groups: [{ conjunction: "and", conditions: [cond("planned")] }] }] };
  const view = render(BlockFilterBar, { props: { filter, fields, readonly: true } });
  expect(view.container.querySelector(".ppp-blockfilter-count")?.textContent).toBe("2"); await open(view);
  const summary = document.querySelector(".ppp-blockfilter-popover")!;
  expect(summary.querySelectorAll(".ppp-filterpills-pill")).toHaveLength(2);
  const groups = summary.querySelectorAll('.ppp-filter-summary[role="group"]'); expect(groups).toHaveLength(3);
  expect(groups[1]).toHaveAttribute("aria-label", get(i18n).t("components.filter.or"));
  expect(summary.querySelector(".ppp-filterpills button, input")).toBeNull();
});

test("editing a nested condition preserves a group-only definition even with all its conditions disabled", async () => {
  const filter: FilterDefinition = { conjunction: "and", conditions: [], groups: [{ conjunction: "or", conditions: [cond("open")] }] };
  const view = render(BlockFilterBar, { props: { filter, fields } }), changes: Array<FilterDefinition | undefined> = [];
  view.component.$on("change", (e: CustomEvent<FilterDefinition | undefined>) => changes.push(e.detail)); await open(view);
  document.querySelector<HTMLButtonElement>(".ppp-blockfilter-popover .filter-group .row-toggle")!.click(); await flush();
  expect(changes).toHaveLength(1); expect(changes[0]?.conditions).toEqual([]);
  expect(changes[0]?.groups?.[0]).toEqual({ conjunction: "or", conditions: [cond("open", false)], groups: [] });
});

test("deleting the last root condition keeps the nested OR and its actual record slice", async () => {
  const filter: FilterDefinition = { conjunction: "and", conditions: [cond("closed")], groups: [group] };
  const view = render(BlockFilterBar, { props: { filter, fields } }), changes: Array<FilterDefinition | undefined> = [];
  view.component.$on("change", (e: CustomEvent<FilterDefinition | undefined>) => changes.push(e.detail)); await open(view);
  document.querySelector<HTMLButtonElement>(".ppp-blockfilter-popover .filter-row .row-delete")!.click(); await flush();
  const saved = changes[0]; expect(saved).toBeDefined(); expect(saved?.conditions).toEqual([]);
  const records = ["open", "planned", "closed"].map(status => ({ id: status, values: { status } }));
  expect(applyFilter({ fields, records }, saved!).records.map(record => record.id)).toEqual(["open", "planned"]);
});

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";
import { writable } from "svelte/store";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import { EMPTY_SELECTION } from "../../../canvasSelectionStore";
type ChartConfig = import("../../../types").ChartConfig;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type SelectionState = import("../../../canvasSelectionStore").SelectionState;
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }) };
});
const Panel = require("../ChartConfig.svelte").default;
const Fixture = require("./ChartFeedback.fixture.svelte").default;
const { getConfigPanel } = require("../../configPanelRegistry");
const source: DataFrame = {
  fields: [
    { name: "status", type: DataFieldType.String, repeated: false, derived: false, identifier: false },
    { name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false },
  ],
  records: [{ id: "a", values: { status: "A", amount: 10 } }, { id: "b", values: { status: "A", amount: 30 } }, { id: "c", values: { status: "B", amount: 20 } }],
};
const initial = (): ChartConfig => getConfigPanel("chart").initDefaults(source.fields);
const settle = async () => { await tick(); await tick(); };
function axis(root: HTMLElement, name: string): HTMLSelectElement {
  const select = Array.from(root.querySelectorAll("label")).find(label => label.querySelector("span")?.textContent === `views.dashboard.chart.${name}`)?.querySelector("select");
  if (!select) throw new Error(`No axis selector ${name}`);
  return select;
}
async function choose(select: HTMLSelectElement, value: string) {
  select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); await settle();
}

it("constructs an actual SVG through the settings: X=status, Y=amount, sum=40/20, then line", async () => {
  const { container } = render(Fixture, { props: { source } }); await settle();
  await choose(axis(container, "x-axis"), "status");
  await choose(axis(container, "y-axis"), "amount");
  await choose(axis(container, "aggregation"), "sum");
  const bars = Array.from(container.querySelectorAll<SVGRectElement>(".ppp-chart-bar__rect"));
  expect(bars.map(bar => bar.getAttribute("aria-label"))).toEqual(["A", "B"]);
  expect(bars.map(bar => bar.nextElementSibling?.textContent)).toEqual(["40", "20"]);
  expect(bars.every(bar => Number(bar.getAttribute("height")) > 0)).toBe(true);
  await choose(axis(container, "type"), "line");
  expect(container.querySelector(".ppp-chart-line path")).not.toBeNull();
  expect(container.querySelector(".ppp-chart-bar")).toBeNull();
});

it("offers only supported text aggregations, retains an invalid stored choice with an explanation and no write", async () => {
  const config = { ...initial(), yAxis: { property: "status", aggregation: "sum" as const } };
  const view = render(Panel, { props: { config, fields: source.fields } });
  const changes = jest.fn(); view.component.$on("change", changes); await settle();
  const select = axis(view.container, "aggregation");
  expect(select.value).toBe("sum");
  expect(Array.from(select.options).filter(option => !option.disabled).map(option => option.value)).toEqual(["count_total", "count_unique"]);
  expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("not supported");
  expect(changes).not.toHaveBeenCalled(); expect(config.yAxis.aggregation).toBe("sum");
  await choose(select, "count_unique"); expect(changes.mock.calls[0]![0].detail.yAxis).toEqual({ property: "status", aggregation: "count_unique" });
});

it("an explicit switch to a text axis replaces an incompatible numeric operation, and count explains empties", async () => {
  const view = render(Panel, { props: { config: { ...initial(), yAxis: { property: "amount", aggregation: "sum" } }, fields: source.fields } });
  const changes = jest.fn(); view.component.$on("change", changes);
  await choose(axis(view.container, "y-axis"), "status");
  expect(changes.mock.calls[0]![0].detail.yAxis).toEqual({ property: "status", aggregation: "count_total" });
  view.component.$set({ config: initial() }); await settle();
  expect(axis(view.container, "y-axis").options[0]!.textContent).toBe("Count all");
  expect(view.container.querySelector(".ppp-chart-aggregation-hint")?.textContent).toContain("including");
});

it("repeatedly mounting and closing a chart releases every selection subscription", async () => {
  const state = writable(EMPTY_SELECTION), off = jest.fn();
  const selection = { ...state, setSelection: jest.fn(), clearSelection: jest.fn(), subscribe: jest.fn((run: (value: SelectionState) => void) => {
    const stop = state.subscribe(run); return () => { stop(); off(); };
  }) };
  for (let i = 0; i < 3; i++) {
    const view = render(Fixture, { props: { source, selection } }); await settle(); view.unmount();
  }
  expect(selection.subscribe).toHaveBeenCalledTimes(3); expect(off).toHaveBeenCalledTimes(3);
});

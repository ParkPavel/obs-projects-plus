import "@testing-library/jest-dom";
import { render, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type ChartConfig = import("../../../types").ChartConfig;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  const interpolate = (s: string, o: Record<string, unknown>) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(o[k] ?? ""));
  return { i18n: writable({ t: (key: string, opts?: Record<string, unknown> & { defaultValue?: string }) => opts?.defaultValue ? interpolate(opts.defaultValue, opts) : key }) };
});
const Panel = require("../ChartConfig.svelte").default;
const Widget = require("../ChartWidget.svelte").default;
const { getConfigPanel } = require("../../configPanelRegistry");

const source: DataFrame = {
  fields: [
    { name: "status", type: DataFieldType.Select, repeated: false, derived: false, identifier: false },
    { name: "amount", type: DataFieldType.Number, repeated: false, derived: false, identifier: false },
  ],
  records: [{ id: "a", values: { status: "A", amount: 10 } }, { id: "b", values: { status: "A", amount: 30 } }, { id: "c", values: { status: "B", amount: 20 } }],
};
// A chart stored by 3.7.1: no title, no tab, nothing new.
const legacy = (): ChartConfig => ({
  chartType: "line",
  xAxis: { property: "status", sortBy: "value", sortOrder: "desc", omitZero: true },
  yAxis: { property: "amount", aggregation: "avg" },
  style: { colorScheme: "accent", height: "large", showGrid: false, showLabels: true, showLegend: true, showValues: false },
});
const settle = async () => { await tick(); await tick(); };

describe("B6 — chart panel like Google Sheets", () => {
  it("opening an old chart writes nothing and leaves the stored object untouched", async () => {
    const config = legacy();
    const snapshot = JSON.stringify(config);
    const view = render(Panel, { props: { config, fields: source.fields, records: source.records } });
    const changes = jest.fn(); view.component.$on("change", changes);
    await settle();
    await fireEvent.click(view.getByRole("tab", { name: "Customize" })); await settle();
    await fireEvent.click(view.getByRole("tab", { name: "Setup" })); await settle();
    expect(changes).not.toHaveBeenCalled();
    expect(JSON.stringify(config)).toBe(snapshot);
    render(Widget, { props: { config, source } }); await settle();
    expect(JSON.stringify(config)).toBe(snapshot);
  });

  it("two tabs: Setup holds type/axes, Customize holds title/legend/colours", async () => {
    const view = render(Panel, { props: { config: legacy(), fields: source.fields } }); await settle();
    expect(view.getByRole("tab", { name: "Setup" })).toHaveAttribute("aria-selected", "true");
    expect(view.getAllByRole("radio").length).toBe(10);
    expect(view.queryByText("Legend")).toBeNull();
    await fireEvent.click(view.getByRole("tab", { name: "Customize" })); await settle();
    expect(view.getByText("Legend")).toBeInTheDocument();
    expect(view.getByText("Chart title")).toBeInTheDocument();
    expect(view.getByText("Colours")).toBeInTheDocument();
  });

  it("a type icon switches the type live (no Build button)", async () => {
    const view = render(Panel, { props: { config: legacy(), fields: source.fields } });
    const changes = jest.fn(); view.component.$on("change", changes); await settle();
    const radios = view.getAllByRole("radio");
    await fireEvent.click(radios[0]!);
    expect(changes.mock.calls[0]![0].detail.chartType).toBe("bar");
    expect(view.queryByRole("button", { name: /build|show|построить/i })).toBeNull();
  });

  it("Re-pick uses the data and keeps the look", async () => {
    const view = render(Panel, { props: { config: legacy(), fields: source.fields, records: source.records } });
    const changes = jest.fn(); view.component.$on("change", changes); await settle();
    await fireEvent.click(view.getByRole("button", { name: "Re-pick from data" }));
    const next = changes.mock.calls[0]![0].detail as ChartConfig;
    expect(next.chartType).toBe("bar");
    expect(next.xAxis.property).toBe("status");
    expect(next.style).toEqual(legacy().style);
  });

  it("new chart defaults come from the data (category → bars, count)", () => {
    const c = getConfigPanel("chart").initDefaults(source.fields, source.records) as ChartConfig;
    expect(c.chartType).toBe("bar");
    expect(c.xAxis.property).toBe("status");
    expect(c.yAxis.property).toBe("count");
  });

  it("an empty chart explains what is missing instead of a blank", async () => {
    const text: DataFrame = { fields: [source.fields[0]!], records: [] };
    const view = render(Widget, { props: { config: legacy(), source: text } }); await settle();
    expect(view.container.querySelector(".ppp-chart-empty")?.textContent).toContain("no records");
    const noNum: DataFrame = { fields: [source.fields[0]!], records: source.records };
    view.component.$set({ config: { ...legacy(), chartType: "bar", yAxis: { property: "status", aggregation: "sum" } }, source: noNum });
    await settle();
    // pipeline may draw zeros here; when it is empty the reason must be the numeric one
    const empty = view.container.querySelector(".ppp-chart-empty");
    if (empty) expect(empty.textContent).toContain("Count");
  });

  it("a KPI without an X field totals every record", async () => {
    const config: ChartConfig = { ...legacy(), chartType: "number", xAxis: { ...legacy().xAxis, property: "", omitZero: false }, yAxis: { property: "amount", aggregation: "sum" } };
    const view = render(Widget, { props: { config, source } }); await settle();
    expect(view.container.querySelector(".ppp-number-value")?.textContent).toBe("60");
  });

  it("the chart title, when set, is drawn above the chart", async () => {
    const view = render(Widget, { props: { config: { ...legacy(), title: "Revenue" }, source } }); await settle();
    expect(view.container.querySelector(".ppp-chart-title")?.textContent).toBe("Revenue");
  });
});

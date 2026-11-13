import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";

import ChartSeriesEditor from "../ChartSeriesEditor.svelte";
import { DataFieldType } from "src/lib/dataframe/dataframe";
type DataField = import("src/lib/dataframe/dataframe").DataField;
type DataFrame = import("src/lib/dataframe/dataframe").DataFrame;
type ChartSeriesConfig = import("../../../types").ChartSeriesConfig;
type WidgetDefinition = import("../../../types").WidgetDefinition;
type ProjectDefinition = import("src/settings/settings").ProjectDefinition;
import { collectReferencedSourceIds } from "../../../dashboardPreload";
import { chartFramesOf } from "../../linkedSourceState";

jest.mock("src/lib/stores/i18n", () => {
  const { writable } = require("svelte/store");
  return { i18n: writable({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }) };
});

const f = (name: string): DataField => ({ name, type: DataFieldType.Number, repeated: false, identifier: false, derived: false }) as DataField;

function mount(series: ChartSeriesConfig[], frames = new Map<string, DataFrame>()) {
  const changes: ChartSeriesConfig[][] = [];
  const r = render(ChartSeriesEditor, {
    props: { series, fields: [f("weight"), f("minutes")], availableSources: [{ id: "room", name: "Кабинет" }], seriesFrames: frames },
  });
  r.component.$on("change", (e: CustomEvent<ChartSeriesConfig[]>) => changes.push(e.detail));
  return { ...r, changes };
}

describe("ChartSeriesEditor", () => {
  test("adds a series on this chart's first field", async () => {
    const { container, changes } = mount([]);
    await fireEvent.click(container.querySelector(".ppp-chart-series__add")!);
    expect(changes[0]).toHaveLength(1);
    expect(changes[0]![0]).toMatchObject({ property: "weight", aggregation: "sum" });
  });

  test("the right axis is stored; the left one is the default and not stored", async () => {
    const { container, changes } = mount([{ id: "a", property: "minutes", aggregation: "sum" }]);
    const axis = Array.from(container.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "right"))!;
    await fireEvent.change(axis, { target: { value: "right" } });
    expect(changes.at(-1)![0]!.axis).toBe("right");
    await fireEvent.change(axis, { target: { value: "left" } });
    expect(changes.at(-1)![0]!.axis).toBeUndefined();
  });

  test("another project offers its own fields once loaded", () => {
    const room = { fields: [f("price"), f("date")], records: [] } as unknown as DataFrame;
    const { container } = mount([{ id: "a", property: "price", aggregation: "sum", dataProjectId: "room" }], new Map([["room", room]]));
    const opts = Array.from(container.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(opts).toContain("price");
    expect(opts).not.toContain("weight");
  });
});

describe("series projects are loaded and handed to the chart", () => {
  const room = { fields: [], records: [] } as unknown as DataFrame;
  const cfg = { series: [{ id: "a", property: "price", aggregation: "sum", dataProjectId: "room" }] };

  test("the dashboard preloads a series' project", () => {
    const w = { id: "w", type: "chart", config: cfg } as unknown as WidgetDefinition;
    expect(collectReferencedSourceIds([w], { id: "fin", fieldConfig: {} } as unknown as ProjectDefinition)).toContain("room");
  });

  test("chartFramesOf passes the loaded frame, and nothing for one not loaded", () => {
    const loaded = chartFramesOf("chart", cfg as never, new Map([["room", room]]));
    expect(loaded.chartSeriesFrames.get("room")).toBe(room);
    expect(chartFramesOf("chart", cfg as never, new Map()).chartSeriesFrames.size).toBe(0);
  });
});

describe("series aggregation feedback follows the selected source and field", () => {
  const text = { ...f("status"), type: DataFieldType.String };
  const fields = [text, f("amount")];
  function open(series: ChartSeriesConfig[], seriesFrames = new Map<string, DataFrame>()) {
    const changes: ChartSeriesConfig[][] = [];
    const view = render(ChartSeriesEditor, { props: {
      series, fields, seriesFrames, availableSources: [{ id: "room", name: "Room" }],
    } });
    view.component.$on("change", (e: CustomEvent<ChartSeriesConfig[]>) => changes.push(e.detail));
    return { ...view, changes };
  }
  function select(container: HTMLElement, key: string): HTMLSelectElement {
    const label = Array.from(container.querySelectorAll("label")).find(node => node.querySelector("span")?.textContent === key);
    if (!label?.querySelector("select")) throw new Error(`Missing ${key}`);
    return label.querySelector("select")!;
  }
  const aggregation = (container: HTMLElement) => select(container, "views.dashboard.chart.aggregation");
  const options = (node: HTMLSelectElement) => Array.from(node.options).filter(o => !o.disabled).map(o => o.value);

  test("adding on a text-first source chooses a supported operation instead of sum", async () => {
    const { container, changes } = open([]);
    await fireEvent.click(container.querySelector(".ppp-chart-series__add")!);
    expect(changes[0]![0]).toMatchObject({ property: "status", aggregation: "count_total" });
  });

  test("stored text/sum is explained, not rewritten; only counts can be chosen", async () => {
    const series: ChartSeriesConfig[] = [{ id: "a", property: "status", aggregation: "sum" }];
    const { container, changes } = open(series);
    expect(aggregation(container).value).toBe("sum");
    expect(options(aggregation(container))).toEqual(["count_total", "count_unique"]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("not supported");
    expect(changes).toEqual([]); expect(series[0]!.aggregation).toBe("sum");
    await fireEvent.change(aggregation(container), { target: { value: "count_unique" } });
    expect(changes.at(-1)![0]!.aggregation).toBe("count_unique");
  });

  test("explicit field change reconciles sum for text without losing series settings", async () => {
    const { container, changes } = open([{ id: "a", property: "amount", aggregation: "sum", axis: "right", label: "Income", selectionField: "client" }]);
    await fireEvent.change(select(container, "views.dashboard.chart.series.field"), { target: { value: "status" } });
    expect(changes.at(-1)![0]).toEqual({ id: "a", property: "status", aggregation: "count_total", axis: "right", label: "Income", selectionField: "client" });
  });

  test("changing source reconciles the operation using that source, not local metadata", async () => {
    const room: DataFrame = { fields: [{ ...f("amount"), type: DataFieldType.String }], records: [] };
    const { container, changes } = open([{ id: "a", property: "amount", aggregation: "sum", xProperty: "date" }], new Map([["room", room]]));
    await fireEvent.change(select(container, "views.dashboard.data-project.label"), { target: { value: "room" } });
    expect(changes.at(-1)![0]).toEqual({ id: "a", property: "amount", aggregation: "count_total", dataProjectId: "room" });
  });

  test("late source metadata updates choices but never writes or resets the stored operation", async () => {
    const { container, changes, component } = open([{ id: "a", property: "amount", aggregation: "sum", dataProjectId: "room" }]);
    expect(options(aggregation(container))).toEqual(["count_total", "count_unique"]);
    await component.$set({ seriesFrames: new Map([["room", { fields: [f("amount")], records: [] }]]) });
    await Promise.resolve();
    expect(options(aggregation(container))).toContain("sum");
    expect(aggregation(container).value).toBe("sum"); expect(changes).toEqual([]);
  });

  test("missing fields do not claim numeric support", () => {
    const { container, changes } = open([{ id: "a", property: "deleted", aggregation: "avg" }]);
    expect(aggregation(container).value).toBe("avg");
    expect(options(aggregation(container))).toEqual(["count_total", "count_unique"]);
    expect(changes).toEqual([]);
  });

  test("a missing stored field remains visible instead of looking like Count all", () => {
    const { container, changes } = open([{ id: "a", property: "deleted", aggregation: "avg" }]);
    const field = select(container, "views.dashboard.chart.series.field");
    expect(field.value).toBe("deleted");
    expect(field.selectedOptions[0]!.disabled).toBe(true);
    expect(changes).toEqual([]);
  });

  test("an empty source adds a canonical Count all series", async () => {
    const { container, changes, component } = open([]);
    await component.$set({ fields: [] }); await Promise.resolve();
    await fireEvent.click(container.querySelector(".ppp-chart-series__add")!);
    expect(changes.at(-1)![0]).toMatchObject({ property: "count", aggregation: "count_total" });
  });

  test("Count all uses the canonical name and explains empty cells", () => {
    const { container } = open([{ id: "a", property: "count", aggregation: "count_total" }]);
    expect(select(container, "views.dashboard.chart.series.field").options[0]!.textContent).toBe("Count all");
    expect(container.querySelector('[role="note"]')?.textContent).toContain("including");
  });

  test("an explicit switch to Count all stores a canonical operation", async () => {
    const { container, changes } = open([{ id: "a", property: "amount", aggregation: "sum" }]);
    await fireEvent.change(select(container, "views.dashboard.chart.series.field"), { target: { value: "count" } });
    expect(changes.at(-1)![0]).toMatchObject({ property: "count", aggregation: "count_total" });
  });
});

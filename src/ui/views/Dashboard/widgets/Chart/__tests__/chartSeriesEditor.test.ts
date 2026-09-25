import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/svelte";

import ChartSeriesEditor from "../ChartSeriesEditor.svelte";
import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import type { ChartSeriesConfig, WidgetDefinition } from "../../../types";
import type { ProjectDefinition } from "src/settings/settings";
import { collectReferencedSourceIds } from "../../../dashboardPreload";
import { chartFramesOf } from "../../linkedSourceState";

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

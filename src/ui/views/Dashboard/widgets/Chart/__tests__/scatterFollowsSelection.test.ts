/**
 * Codex review of 696a7f4 (follow selection): a scatter chart with a linked
 * selection kept every client's points after a client was picked — the
 * scatter path received the unnarrowed source.
 */

import "@testing-library/jest-dom";
import { render } from "@testing-library/svelte";

import { DataFieldType, type DataFrame, type DataValue } from "src/lib/dataframe/dataframe";
import { SELECTION_CONTEXT_KEY, createSelectionStore, dataTableSourceId } from "../../../canvasSelectionStore";
import type { ChartConfig } from "../../../types";
import ChartWidget from "../ChartWidget.svelte";

const visits = {
  fields: ["client", "minutes", "wellbeing"].map((name) => ({
    name, type: name === "client" ? DataFieldType.String : DataFieldType.Number, repeated: false, identifier: false, derived: false,
  })),
  records: [
    { id: "v1.md", values: { client: "[[Анна]]" as DataValue, minutes: 30, wellbeing: 6 } },
    { id: "v2.md", values: { client: "[[Анна]]" as DataValue, minutes: 45, wellbeing: 7 } },
    { id: "v3.md", values: { client: "[[Борис]]" as DataValue, minutes: 60, wellbeing: 8 } },
  ],
} as unknown as DataFrame;

const config = {
  chartType: "scatter",
  xAxis: { property: "minutes", sortBy: "label", sortOrder: "asc", omitZero: false },
  yAxis: { property: "wellbeing", aggregation: "sum" },
  style: { colorScheme: "categorical", height: "medium", showGrid: false, showLabels: false, showLegend: false, showValues: false },
  showTrendLine: false,
  showR2: false,
  linkedSelection: { sourceWidgetId: "clients", relationField: "client" },
} as unknown as ChartConfig;

test("picking a client leaves only that client's points", () => {
  const store = createSelectionStore();
  store.setSelection({ source: dataTableSourceId("clients"), field: "name", values: ["Анна"] });
  const { container } = render(ChartWidget, {
    props: { config, source: visits, widgetId: "chart" },
    context: new Map([[SELECTION_CONTEXT_KEY, store]]),
  });
  expect(container.querySelectorAll(".ppp-chart-scatter circle")).toHaveLength(2);
});

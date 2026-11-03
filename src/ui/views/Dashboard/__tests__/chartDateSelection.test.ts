import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { createSelectionStore, EMPTY_SELECTION } from "../canvasSelectionStore";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import Dashboard from "./fixtures/DateSelectionDashboard.svelte";
type ChartConfig = import("../types").ChartConfig;
jest.mock("../widgets/DatabaseCall/DataTableContent.svelte", () => require("./fixtures/SelectionFrameProbe.svelte"));
jest.mock("src/ui/views/Board/BoardView.svelte", () => require("./fixtures/SelectionFrameProbe.svelte"));
jest.mock("src/ui/views/Calendar/CalendarView.svelte", () => require("./fixtures/SelectionFrameProbe.svelte"));
jest.mock("src/ui/views/Gallery/GalleryView.svelte", () => require("./fixtures/SelectionFrameProbe.svelte"));
jest.mock("src/lib/stores/i18n", () => ({ i18n: require("svelte/store").writable({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));
afterEach(cleanup);
const flush = async () => { await tick(); await tick(); await tick(); };
const examples = [
  ["month", ["2026-08-01", "2026-08-31", "2026-09-01"], "2026-08"],
  ["week", ["2020-12-31", "2021-01-01", "2021-01-04"], "2020-W53"],
  ["day", ["2026-08-01T09:00:00", "2026-08-01T23:00:00", "2026-08-02"], "2026-08-01"],
  ["quarter", ["2026-08-01", "2026-09-30", "2026-10-01"], "2026-Q3"],
  ["year", ["2025-01-01", "2025-12-31", "2026-01-01"], "2025"],
  [undefined, ["2026-08-01", "2026-08-31", "2026-09-01"], "2026-08"],
] as const;

it.each(examples)("actual chart → store → KPI/database uses %s grouping rather than raw-date equality", async (granularity, dates, label) => {
  const source = { fields: [
    { name: "date", type: DataFieldType.Date, derived: false, repeated: false, identifier: false },
    { name: "amount", type: DataFieldType.Number, derived: false, repeated: false, identifier: false },
  ], records: dates.map((date, i) => ({ id: `${i}.md`, values: { date, amount: (i + 1) * 10 } })) };
  const config: ChartConfig = { chartType: "bar", xAxis: { property: "date", sortBy: "label", sortOrder: "asc", omitZero: false,
    ...(granularity ? { dateGranularity: granularity } : {}) }, yAxis: { property: "amount", aggregation: "sum" },
    style: { height: "small", colorScheme: "auto", showGrid: true, showLabels: true, showLegend: false, showValues: true } };
  const selection = createSelectionStore(), view = render(Dashboard, { props: { source, config, selection } }); await flush();
  const amount = () => view.container.querySelector(".ppp-stats-value")!.textContent;
  const cohort = () => JSON.parse(view.container.querySelector("[data-selection-cohort]")!.textContent!);
  expect(amount()).toBe("60"); expect(cohort()).toEqual(["0.md", "1.md", "2.md"]);
  const bar = view.container.querySelector<SVGRectElement>(`.ppp-chart-bar__rect[aria-label="${label}"]`)!; expect(bar).not.toBeNull();
  await fireEvent.click(bar); await flush();
  expect(amount()).toBe("30"); expect(cohort()).toEqual(["0.md", "1.md"]);
  await fireEvent.click(bar); await flush();
  expect(amount()).toBe("60"); expect(cohort()).toEqual(["0.md", "1.md", "2.md"]);
  selection.set(EMPTY_SELECTION);
});

import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkProjectCoreJson } from "../projectCoreCheck";
import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { suggestChart } from "src/ui/views/Dashboard/widgets/Chart/chartSuggest";
import { defaultStatsConfig } from "src/ui/views/Dashboard/widgets/Stats/statsDefaults";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));
const widget = (type: string, config: unknown, id = "w") => ({ id, type, title: "W", layout: { x: 0, y: 0, w: 12, h: 8 }, config });
const inspect = (config: unknown, type = "dashboard") => checkProjectCoreJson(JSON.stringify({ ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type, config }] }));
const at = (...path: (string | number)[]) => ["views", 0, "config", ...path];
const tab = (viewType: string, config: unknown = {}) => ({ id: "t", label: "Tab", viewType, config });

test("empty persisted pages and unconfigured widgets/tabs retain absence without synthesizing defaults", () => {
  expect(inspect({}).issues).toEqual([]);
  for (const type of ["text", "divider", "chart", "stats", "filter-tabs", "database-call", "cover-banner", "checklist", "data-table"]) expect(inspect({ widgets: [widget(type, {})] }).issues).toEqual([]);
  for (const viewType of ["table", "board", "gallery", "calendar", "chart", "stats", "list", "timeline"]) expect(inspect({ widgets: [widget("database-call", { viewTabs: [tab(viewType)] })] }).issues).toEqual([]);
});

test("database-call supports both independent source forms and optional inline source as actually persisted by the factory", () => {
  const w = { ...widget("database-call", { sourceConfig: { kind: "folder", config: { path: "", recursive: true } }, viewTabs: [tab("table")], activeTabId: "t" }), sourceConfig: { projectId: "", sourceId: "" } };
  expect(inspect({ widgets: [w] }).issues).toEqual([]);
  expect(inspect({ widgets: [widget("database-call", { viewTabs: [tab("table")] })] }).issues).toEqual([]);
});

test("real chart and statistics factories are accepted across all suggested chart shapes", () => {
  const field = (name: string, type: DataFieldType): DataField => ({ name, type, identifier: false, repeated: false, derived: false });
  const cases = [[], [field("State", DataFieldType.Status)], [field("Due", DataFieldType.Date), field("Amount", DataFieldType.Number)], [field("X", DataFieldType.Number), field("Y", DataFieldType.Number)], [field("X", DataFieldType.Number)]];
  for (const fields of cases) {
    expect(inspect({ widgets: [widget("chart", suggestChart(fields)), widget("stats", defaultStatsConfig(fields), "stats")] }).issues).toEqual([]);
  }
});

test("chart series and persisted scatter extensions are checked without resolving their external frames", () => {
  const config = { ...suggestChart([]), chartType: "scatter", colorBy: "State", sizeBy: "Amount", showTrendLine: true, showR2: false, pointRadius: 5, opacity: 0.8, correlation: { rightSourceId: "external", on: { leftKey: "id", rightKey: "id" } }, series: [{ id: "s", property: "Amount", aggregation: "sum", dataProjectId: "external", axis: "right", selectionField: "Rel" }] };
  expect(inspect({ widgets: [widget("chart", config)] }).issues).toEqual([]);
  config.series.push({ ...config.series[0]! });
  expect(inspect({ widgets: [widget("chart", config)] }).issues).toEqual([{ location: at("widgets", 0, "config", "series", 1, "id"), code: "duplicate-id" }]);
});

test("source reference is not confused with an inline definition", () => {
  const w = { ...widget("database-call", { sourceConfig: { projectId: "p" } }), sourceConfig: { kind: "folder" } };
  expect(inspect({ widgets: [w] }).issues).toEqual(expect.arrayContaining([
    { location: at("widgets", 0, "sourceConfig", "projectId"), code: "missing-field" },
    { location: at("widgets", 0, "config", "sourceConfig", "kind"), code: "invalid-type" },
  ]));
});

test("table maps, presets and conditional formats use their own typed vocabularies", () => {
  const table = { fieldConfig: { "": { width: 120, widthRem: 8, hide: false, pinned: true } }, aggregations: { X: "count_numeric" }, defaultValues: { X: "" }, conditionalFormats: [{ id: "rule", field: "X", conditions: [{ operator: "is", value: "", style: { bold: true } }] }], subBases: [{ old: [1, false] }], activeSubBaseId: "legacy" };
  expect(inspect({ table, fieldPresets: [{ id: "preset", label: "", fieldConfig: table.fieldConfig, wrapText: false }], activeFieldPresetId: "preset" }).issues).toEqual([]);
  expect(inspect({ table: { aggregations: { X: "SUM" } } }).issues).toEqual([{ location: at("table", "aggregations", "X"), code: "unknown-kind" }]);
  expect(inspect({ table: { conditionalFormats: [{ id: "rule", field: "X", conditions: [{ operator: "unknown", style: {} }] }] } }).issues).toEqual([{ location: at("table", "conditionalFormats", 0, "conditions", 0, "operator"), code: "unknown-kind" }]);
});

test.each([
  [{ widgets: [widget("text", {}), widget("divider", {})] }, ["widgets", 1, "id"]],
  [{ widgets: [widget("database-call", { viewTabs: [tab("table"), tab("gallery")] })] }, ["widgets", 0, "config", "viewTabs", 1, "id"]],
  [{ fieldPresets: [{ id: "p", label: "A" }, { id: "p", label: "B" }] }, ["fieldPresets", 1, "id"]],
  [{ formulaFields: [{ name: "X", expression: "" }, { name: "X", expression: "" }] }, ["formulaFields", 1, "name"]],
] as const)("local repeated identity has an exact diagnostic %#", (config, path) => {
  expect(inspect(config).issues).toContainEqual({ location: at(...path), code: "duplicate-id" });
});

test("retired config is explicitly opaque while its common transformation envelope remains checked", () => {
  for (const type of ["comparison", "view-port", "summary-row", "data-list", "sub-base-canvas", "yaml-visualizer", "timeline"]) {
    const w = { ...widget(type, { future: { kept: true }, viewTabs: false, sourceConfig: "opaque" }), transform: { steps: [{ type: "compute", columns: [{ name: "X", expression: "[not executed" }] }] } };
    expect(inspect({ widgets: [w] }).issues).toEqual([]);
    expect(w.config).toEqual({ future: { kept: true }, viewTabs: false, sourceConfig: "opaque" });
  }
});

test("unknown widget discriminator is retained without invoking a prototype method or inspecting its payload", () => {
  for (const type of ["future", "constructor", "toString", "__proto__"]) expect(inspect({ widgets: [widget(type, { viewTabs: "opaque" })] }).issues).toEqual([{ location: at("widgets", 0, "type"), code: "unknown-kind" }]);
});

test("unknown keys are diagnosed once rather than twice by envelope and payload passes", () => {
  expect(inspect({ widgets: [{ ...widget("text", {}), future: true }] }).issues).toEqual([{ location: at("widgets", 0, "future"), code: "unknown-field" }]);
  expect(inspect({ widgets: [widget("database-call", { viewTabs: [{ ...tab("table"), future: true }] })] }).issues).toEqual([{ location: at("widgets", 0, "config", "viewTabs", 0, "future"), code: "unknown-field" }]);
});

test("legacy data-table overlay stays under config.table, distinct from a database-call tab", () => {
  expect(inspect({ widgets: [widget("data-table", { table: { fieldConfig: { X: { hide: true } } }, subFilter: { conditions: [] } })] }).issues).toEqual([]);
  expect(inspect({ widgets: [widget("data-table", { table: { fieldConfig: { X: { hide: "true" } } } })] }).issues).toEqual([{ location: at("widgets", 0, "config", "table", "fieldConfig", "X", "hide"), code: "invalid-type" }]);
});

test("historical table view shapes are recognized without silently migrating their type or payload", () => {
  const legacy = { fieldConfig: { X: { width: 150.5, hide: false, pinned: true } }, sortField: "X", sortAsc: false, orderFields: ["X"] };
  expect(inspect(legacy, "table").issues).toEqual([]);
  expect(inspect({ widgets: [widget("text", { content: "" })], layoutVersion: 1 }, "table").issues).toEqual([]);
  expect(inspect({ widgets: [{ type: "database-call", config: { sourceConfig: false } }] }, "table").issues).toEqual([{ location: at("widgets"), code: "unknown-field" }]);
  expect(legacy.sortAsc).toBe(false);
});

test("layout, linked selection and statistics cards diagnose malformed present values", () => {
  const w = { ...widget("stats", { cards: [{ id: "c", label: "", field: "X", aggregation: "sum", showTrend: "false" }], columns: 5, linkedSelection: { sourceWidgetId: "master", relationField: "R", relationSide: "wrong" } }), layout: { x: "0", y: 0, w: 12, h: 8 } };
  expect(inspect({ widgets: [w] }).issues).toEqual(expect.arrayContaining([
    { location: at("widgets", 0, "layout", "x"), code: "invalid-type" },
    { location: at("widgets", 0, "config", "cards", 0, "showTrend"), code: "invalid-type" },
    { location: at("widgets", 0, "config", "columns"), code: "invalid-type" },
    { location: at("widgets", 0, "config", "linkedSelection", "relationSide"), code: "unknown-kind" },
  ]));
});

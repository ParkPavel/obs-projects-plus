import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkProjectCoreJson } from "../projectCoreCheck";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));

const widget = (steps: unknown) => ({ id: "w", type: "text", title: "T", layout: { x: 0, y: 0, w: 12, h: 8 }, config: { content: "" }, transform: { steps } });
const inspectWidgets = (widgets: unknown[]) => checkProjectCoreJson(JSON.stringify({ ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets } }] }));
const structural = (widgets: unknown[]) => inspectWidgets(widgets).issues;
const inspect = (steps: unknown) => inspectWidgets([widget(steps)]);
const run = (steps: unknown) => structural([widget(steps)]);
const at = (...rest: (string | number)[]) => ["views", 0, "config", "widgets", 0, "transform", ...rest];
const step = (...rest: (string | number)[]) => [...at("steps", 0), ...rest];

const aggregation = (name: string) => ({ type: "aggregate", columns: [{ sourceField: "Amount", outputName: "Out", function: name }] });
const compute = (column: Record<string, unknown>) => ({ type: "compute", columns: [column] });
const unpivot = (group: Record<string, unknown>) => ({ type: "unpivot", fieldGroups: [group], keepFields: ["id"] });
const join = (fields: Record<string, unknown>) => ({ type: "join", rightSourceId: "right", on: { leftKey: "id", rightKey: "key" }, how: "left", ...fields });

test.each([
  ["unnest", { type: "unnest", field: "items", fields: ["a", "b"], prefix: "n_", keepOriginal: true }],
  ["unpivot", unpivot({ pattern: "set_(\\d+)_reps", outputName: "reps" })],
  ["compute", compute({ name: "total", expression: "a + b", formulaVersion: "unified-v1" })],
  ["filter", { type: "filter", conditions: { conjunction: "and", conditions: [{ field: "Status", operator: "is", value: "Done", enabled: true }] } }],
  ["group-by", { type: "group-by", fields: ["Status"], dateGrouping: { field: "Due", granularity: "month", outputField: "Due month" } }],
  ["aggregate", aggregation("SUM")],
  ["pivot", { type: "pivot", categoryField: "Status", valueField: "Amount", aggregation: "AVG" }],
  ["join", join({ aggregation: "COUNT", suffix: "_r" })],
])("persisted %s step keeps its stored shape without diagnostics", (_name, value) => {
  expect(run([value])).toEqual([]);
});

test("a checked Dashboard pipeline does not grant whole-project completeness", () => {
  expect(inspect([]).issues).toEqual([]);
  expect(inspect([]).complete).toBe(false);
});

test("all eight steps in one pipeline stay structurally clean and complete stays false", () => {
  const steps = [
    { type: "unnest", field: "items" },
    unpivot({ pattern: "(x)", outputName: "v" }),
    compute({ name: "c", expression: "a" }),
    { type: "filter", conditions: { conjunction: "or", conditions: [{ field: "F", operator: "is-empty", enabled: false }] } },
    { type: "group-by", fields: ["F"] },
    aggregation("MEDIAN"),
    { type: "pivot", categoryField: "F", valueField: "V", aggregation: "MAX" },
    join({}),
  ];
  expect(run(steps)).toEqual([]);
  expect(inspect(steps).complete).toBe(false);
});

test("pipeline is read from widget.transform, not from widget.config.transform", () => {
  const misplaced = { id: "w", type: "text", title: "T", layout: { x: 0, y: 0, w: 12, h: 8 }, config: { content: "", transform: { steps: [{ type: "nope" }] } } };
  expect(structural([misplaced])).toEqual([{ location: ["views", 0, "config", "widgets", 0, "config", "transform"], code: "unknown-field" }]);
  expect(run([{ type: "nope" }])).toEqual([{ location: step("type"), code: "unknown-kind" }]);
});

test.each(["SUM", "AVG", "MEDIAN", "MIN", "MAX", "RANGE", "COUNT", "COUNT_DISTINCT", "FIRST", "LAST", "STD_DEV", "PCT_EMPTY", "PCT_NOT_EMPTY"])("aggregate accepts the pipeline function %s", name => {
  expect(run([aggregation(name)])).toEqual([]);
});

test("lowercase rollup vocabulary is rejected by the pipeline aggregation", () => {
  for (const name of ["sum", "count_total", "show_original", "first_value"]) {
    expect(run([aggregation(name)])).toEqual([{ location: step("columns", 0, "function"), code: "unknown-kind" }]);
  }
});

test("pivot and join aggregation use the same uppercase alphabet", () => {
  expect(run([{ type: "pivot", categoryField: "F", valueField: "V", aggregation: "PCT_NOT_EMPTY" }])).toEqual([]);
  expect(run([{ type: "pivot", categoryField: "F", valueField: "V", aggregation: "percent_empty" }])).toEqual([{ location: step("aggregation"), code: "unknown-kind" }]);
  expect(run([join({ aggregation: "range" })])).toEqual([{ location: step("aggregation"), code: "unknown-kind" }]);
});

test("unknown and prototype-looking discriminators are diagnosed as unknown kinds", () => {
  for (const type of ["nope", "toString", "constructor", "__proto__", "valueOf", "hasOwnProperty"]) {
    expect(run([{ type }])).toEqual([{ location: step("type"), code: "unknown-kind" }]);
  }
});

test("a step discriminator must be a string", () => {
  for (const type of [undefined, null, 1, true, ["unnest"]]) expect(run([{ type }])).toEqual([{ location: step("type"), code: "invalid-type" }]);
  expect(run([{}])).toEqual([{ location: step("type"), code: "invalid-type" }]);
  expect(run([null])).toEqual([{ location: step(), code: "invalid-type" }]);
});

test("compute formulaVersion accepts unified-v1 and an absent version, rejects unknown ones", () => {
  expect(run([compute({ name: "c", expression: "a" })])).toEqual([]);
  expect(run([compute({ name: "c", expression: "a", formulaVersion: "unified-v1" })])).toEqual([]);
  expect(run([compute({ name: "c", expression: "a", formulaVersion: "unified-v2" })])).toEqual([{ location: step("columns", 0, "formulaVersion"), code: "unknown-kind" }]);
});

test("formula and regex payloads are stored as text and never executed", () => {
  for (const expression of ["[regex", "((unclosed", "process.exit(1)", "constructor.constructor('x')()"]) expect(run([compute({ name: "c", expression })])).toEqual([]);
  for (const pattern of ["[unclosed", "(", ".*", "\\d+", "constructor"]) expect(run([unpivot({ pattern, outputName: "v" })])).toEqual([]);
});

test.each([
  [{ type: "unnest" }, ["field"], "missing-field"],
  [{ type: "unnest", field: 1 }, ["field"], "invalid-type"],
  [{ type: "unnest", field: "items", fields: "a" }, ["fields"], "invalid-type"],
  [{ type: "unnest", field: "items", keepOriginal: "true" }, ["keepOriginal"], "invalid-type"],
  [{ type: "unpivot", keepFields: ["id"] }, ["fieldGroups"], "missing-field"],
  [unpivot({ outputName: "v" }), ["fieldGroups", 0, "pattern"], "missing-field"],
  [unpivot({ pattern: "a", outputName: 1 }), ["fieldGroups", 0, "outputName"], "invalid-type"],
  [{ type: "unpivot", fieldGroups: [], keepFields: [1] }, ["keepFields", 0], "invalid-type"],
  [compute({ expression: "a" }), ["columns", 0, "name"], "missing-field"],
  [compute({ name: "c" }), ["columns", 0, "expression"], "missing-field"],
  [{ type: "compute" }, ["columns"], "missing-field"],
  [{ type: "filter" }, ["conditions"], "missing-field"],
  [{ type: "filter", conditions: { conditions: [{ field: "F", operator: "future", enabled: true }] } }, ["conditions", "conditions", 0, "operator"], "unknown-kind"],
  [{ type: "filter", conditions: { conditions: [{ field: "F", operator: "is", enabled: "yes" }] } }, ["conditions", "conditions", 0, "enabled"], "invalid-type"],
  [{ type: "group-by" }, ["fields"], "missing-field"],
  [{ type: "group-by", fields: [1] }, ["fields", 0], "invalid-type"],
  [{ type: "aggregate", columns: [{ outputName: "o", function: "SUM" }] }, ["columns", 0, "sourceField"], "missing-field"],
  [{ type: "pivot", categoryField: "c" }, ["valueField"], "missing-field"],
  [{ type: "pivot", categoryField: "c", valueField: "v" }, ["aggregation"], "missing-field"],
  [join({ how: "outer" }), ["how"], "unknown-kind"],
  [{ type: "join", rightSourceId: "r", on: { leftKey: "a" }, how: "left" }, ["on", "rightKey"], "missing-field"],
  [{ type: "join", rightSourceId: "r", on: { rightKey: "b" }, how: "left" }, ["on", "leftKey"], "missing-field"],
  [{ type: "join", on: { leftKey: "a", rightKey: "b" }, how: "left" }, ["rightSourceId"], "missing-field"],
  [join({ suffix: 1 }), ["suffix"], "invalid-type"],
  [{ type: "unnest", field: "items", extra: true }, ["extra"], "unknown-field"],
] as [Record<string, unknown>, (string | number)[], string][])("malformed %# is diagnosed at its persisted location", (value, suffix, code) => {
  expect(run([value])).toContainEqual({ location: step(...suffix), code });
});

test("disabled steps are still inspected structurally", () => {
  expect(run([{ type: "unnest", disabled: true }])).toEqual([{ location: step("field"), code: "missing-field" }]);
  expect(run([{ type: "aggregate", disabled: true, columns: [{ sourceField: "a", outputName: "o", function: "sum" }] }])).toEqual([{ location: step("columns", 0, "function"), code: "unknown-kind" }]);
  expect(run([{ type: "unnest", field: "items", disabled: true }])).toEqual([]);
});

test("date grouping requires its field and an allowed granularity", () => {
  const group = (dateGrouping: unknown) => ({ type: "group-by", fields: ["F"], dateGrouping });
  expect(run([group({ field: "Due", granularity: "week" })])).toEqual([]);
  expect(run([group({ granularity: "week" })])).toEqual([{ location: step("dateGrouping", "field"), code: "missing-field" }]);
  expect(run([group({ field: "Due", granularity: "hour" })])).toEqual([{ location: step("dateGrouping", "granularity"), code: "unknown-kind" }]);
  expect(run([group({ field: 1, granularity: "year" })])).toEqual([{ location: step("dateGrouping", "field"), code: "invalid-type" }]);
  expect(run([group({ field: "Due", granularity: "year", outputField: 1 })])).toEqual([{ location: step("dateGrouping", "outputField"), code: "invalid-type" }]);
});

test("the pipeline requires a steps array on the widget", () => {
  const withoutTransform = { id: "w", type: "text", title: "T", layout: { x: 0, y: 0, w: 12, h: 8 }, config: { content: "" } };
  expect(structural([withoutTransform])).toEqual([]);
  const raw = (transform: unknown) => ({ ...withoutTransform, transform });
  expect(structural([raw({})])).toEqual([{ location: at("steps"), code: "missing-field" }]);
  expect(structural([raw({ steps: {} })])).toEqual([{ location: at("steps"), code: "invalid-type" }]);
  expect(structural([raw({ steps: "unnest" })])).toEqual([{ location: at("steps"), code: "invalid-type" }]);
});

test("inspection is deterministic and never rewrites the saved document", () => {
  const steps = [join({ aggregation: "COUNT" }), compute({ name: "c", expression: "[regex" })];
  const text = JSON.stringify({ ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets: [widget(steps)] } }] });
  const snapshot = JSON.parse(text);
  const first = checkProjectCoreJson(text).issues;
  expect(checkProjectCoreJson(text).issues).toEqual(first);
  expect(JSON.parse(text)).toEqual(snapshot);
  expect(JSON.stringify(snapshot)).toBe(text);
  expect(snapshot.views[0].config.widgets[0].transform.steps).toEqual(steps);
});

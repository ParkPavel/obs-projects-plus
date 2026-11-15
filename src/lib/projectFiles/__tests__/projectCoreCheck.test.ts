import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkProjectCoreJson } from "../projectCoreCheck";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));
const project = () => ({ ...DEFAULT_PROJECT, id: "p", name: "Project" });
const inspect = (value: unknown) => checkProjectCoreJson(JSON.stringify(value));
const invalidAt = (value: unknown, location: (string | number)[], code = "invalid-type") => expect(inspect(value).issues).toContainEqual({ location, code });

test("valid root/defaults are inspected without claiming complete validation or changing JSON", () => {
  const text = JSON.stringify(project()), result = checkProjectCoreJson(text);
  expect(result).toEqual({ stage: "project-core-check", coverage: "root-fields-agenda-sources-and-supported-view-configs", complete: false, issues: [] });
  expect(text).toBe(JSON.stringify(project())); expect(Object.isFrozen(result.issues)).toBe(true);
});

test.each([null, [], false, 4, "project"])("non-object root %p is diagnosed", value => invalidAt(value, []));
test.each(["id", "name", "defaultName", "isDefault", "newNotesFolder"])("missing required %s is not defaulted", key => {
  const p: Record<string, unknown> = project(); delete p[key]; invalidAt(p, [key], "missing-field");
});
test.each([
  ["isDefault", "false"], ["autosave", 1], ["uniqueIdCounter", -1], ["uniqueIdCounter", 1.5],
  ["templates", "Note.md"], ["excludedNotes", [4]], ["additionalSources", {}], ["fieldConfig", []],
] as const)("rejects wrong structural type in %s", (key, value) => {
  const at: (string | number)[] = [key]; if (key === "excludedNotes") at.push(0);
  invalidAt({ ...project(), [key]: value }, at);
});

test("unknown fields, discriminators and prototype-like keys remain diagnostics, not setters or guesses", () => {
  const p = project(), text = JSON.stringify({ ...p, future: { preserved: true } }).replace('"future":', '"__proto__":');
  expect(checkProjectCoreJson(text).issues).toContainEqual({ location: ["__proto__"], code: "unknown-field" });
  invalidAt({ ...p, dataSource: { kind: ["folder"], config: {} } }, ["dataSource", "kind"]);
  invalidAt({ ...p, dataSource: { kind: "extension", config: { opaque: 1 } } }, ["dataSource", "kind"], "unknown-kind");
  invalidAt({ ...p, dataSource: { kind: "folder", config: { path: "", recursive: false, extension: true } } }, ["dataSource", "config", "extension"], "unknown-field");
});

test.each([
  { kind: "folder", config: { path: "", recursive: false } },
  { kind: "tag", id: "tag", name: "", config: { tag: "", hierarchy: true } },
  { kind: "dataview", config: { query: 'TABLE "never executed"', filter: { conditions: [], groups: [] } } },
  { kind: "native-query", config: { from: { kind: "folder", path: "Work", recursive: true }, limit: -1.5 } },
  { kind: "native-query", config: { from: { kind: "tag", tag: "work", hierarchy: false }, where: { conjunction: "or", conditions: [] }, limit: 0 } },
  { kind: "derived", config: { from: "project", where: { conditions: [] } } },
])("supports persisted source shape $kind without execution", dataSource => expect(inspect({ ...project(), dataSource }).issues).toEqual([]));

test("filters validate disabled conditions and nested groups without compiling regex or expressions", () => {
  const condition = { field: "field", operator: "regex", enabled: false, value: "[invalid regex" };
  const dataSource = { kind: "dataview", config: { query: "invalid DQL", filter: { conjunction: "and", conditions: [condition], groups: [{ conditions: [{ ...condition, operator: "is-checked", value: "" }] }] } } };
  expect(inspect({ ...project(), dataSource }).issues).toEqual([]);
  invalidAt({ ...project(), dataSource: { ...dataSource, config: { ...dataSource.config, filter: { ...dataSource.config.filter, conjunction: ["and"] } } } }, ["dataSource", "config", "filter", "conjunction"]);
  invalidAt({ ...project(), dataSource: { ...dataSource, config: { ...dataSource.config, filter: { conditions: [{ ...condition, operator: ["is"], value: 4 }] } } } }, ["dataSource", "config", "filter", "conditions", 0, "operator"]);
});

test("source identity checks use IDs rather than display names and diagnose missing/self/reserved/duplicate references", () => {
  const p = { ...project(), dataSource: { id: "a", name: "same", kind: "folder", config: { path: "", recursive: true } }, additionalSources: [{ id: "b", name: "same", kind: "derived", config: { from: "a", where: { conditions: [] } } }] };
  expect(inspect(p).issues).toEqual([]);
  invalidAt({ ...p, additionalSources: [{ ...p.additionalSources[0], id: "a" }] }, ["additionalSources", 0, "id"], "duplicate-id");
  for (const from of ["missing", "b"]) invalidAt({ ...p, additionalSources: [{ ...p.additionalSources[0], config: { from, where: { conditions: [] } } }] }, ["additionalSources", 0, "config", "from"], "invalid-reference");
  invalidAt({ ...p, dataSource: { ...p.dataSource, id: "project" } }, ["dataSource", "id"], "invalid-reference");
});

test("derived source cycles are diagnosed without rejecting an acyclic chain or inline source ID reuse", () => {
  const a = { id: "a", kind: "derived", config: { from: "b", where: { conditions: [] } } }, b = { id: "b", kind: "derived", config: { from: "a", where: { conditions: [] } } };
  const result = inspect({ ...project(), dataSource: a, additionalSources: [b] });
  expect(result.issues.filter(issue => issue.code === "invalid-reference")).toHaveLength(2);
  expect(inspect({ ...project(), dataSource: a, additionalSources: [{ ...b, config: { ...b.config, from: "project" } }] }).issues).toEqual([]);
});

test("view envelopes, colors, sorting and inline sources are checked while payloads remain explicitly unchecked", () => {
  const view = { ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets: [{ type: "database-call", config: { sourceConfig: { kind: "tag", config: { tag: "work", hierarchy: "bad" } } } }] } };
  const p = { ...project(), views: [view], fieldConfig: { Done: {} }, agenda: {} };
  expect(inspect(p).issues).toContainEqual({ location: ["views", 0, "config"], code: "section-unchecked" });
  invalidAt(p, ["views", 0, "config", "widgets", 0, "config", "sourceConfig", "config", "hierarchy"]);
  invalidAt({ ...p, views: [view, view] }, ["views", 1, "id"], "duplicate-id");
  invalidAt({ ...p, views: [{ ...view, sort: { criteria: [{ field: "x", enabled: false, order: ["asc"] }] } }] }, ["views", 0, "sort", "criteria", 0, "order"]);
  invalidAt({ ...p, views: [{ ...view, colors: { conditions: [{ color: "red", condition: { field: "x", enabled: "yes", operator: "is" } }] } }] }, ["views", 0, "colors", "conditions", 0, "condition", "enabled"]);
  invalidAt({ ...p, fieldConfig: { Done: null } }, ["fieldConfig", "Done"]);
});

test.each(["table", "custom"])("%s payload is opaque even when it contains widget-looking extension keys", type => {
  const config = { widgets: [{ type: "database-call", config: { sourceConfig: { kind: "tag", config: { tag: "opaque", hierarchy: "extension-value" } } } }] };
  const result = inspect({ ...project(), views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type, config }] });
  expect(result.issues).toEqual([...(type === "custom" ? [{ location: ["views", 0, "type"], code: "unknown-kind" }] : []), { location: ["views", 0, "config"], code: "section-unchecked" }]);
});

test("optional date and palette inheritance are preserved with strict present-value types", () => {
  expect(inspect({ ...project(), colorFavorites: [], dateFormat: { writeFormat: "", preset: "custom", includeTime: false } }).issues).toEqual([]);
  invalidAt({ ...project(), dateFormat: { writeFormat: "Y", preset: ["iso"] } }, ["dateFormat", "preset"]);
  invalidAt({ ...project(), colorFavorites: [{ name: "red", color: 4 }] }, ["colorFavorites", 0, "color"]);
  invalidAt({ ...project(), agenda: null }, ["agenda"]);
});

test("property settings preserve inheritance, empty values and inactive typed settings without executing formulas", () => {
  const fieldConfig = {
    Empty: {}, Text: { options: ["", "A"], richText: false, fileLinks: true, time: false },
    State: { type: "status", statusGroups: { todo: [], inProgress: [""], complete: [] } },
    Created: { type: "autotime", autoTime: "created" }, Modified: { type: "autotime", autoTime: "modified" },
    ID: { type: "unique_id", uniqueIdPrefix: "" }, Formula: { type: "formula", formula: "[invalid syntax", formulaVersion: "unified-v1" },
    Unversioned: { formula: "" }, Dormant: { type: "string", autoTime: "created", formula: "" },
  };
  const text = JSON.stringify({ ...project(), fieldConfig });
  expect(checkProjectCoreJson(text).issues).toEqual([]);
  expect(JSON.stringify({ ...project(), fieldConfig })).toBe(text);
  expect(inspect({ ...project(), fieldConfig }).complete).toBe(false);
});

test.each([
  ["richText", "false", []], ["fileLinks", null, []], ["time", 0, []],
  ["uniqueIdPrefix", 1, []], ["formula", [], []], ["type", 1, []], ["autoTime", ["created"], []],
  ["formulaVersion", {}, []], ["options", "A", []], ["options", ["A", false], [1]],
  ["statusGroups", [], []], ["statusGroups", { todo: "A" }, ["todo"]], ["statusGroups", { complete: [null] }, ["complete", 0]],
] as const)("strict present-value types for field %s", (key, value, suffix) => {
  invalidAt({ ...project(), fieldConfig: { X: { [key]: value } } }, ["fieldConfig", "X", key, ...suffix]);
});

test.each(["extension", "__proto__", "constructor"])("unknown property type %s is diagnosed without conversion", type => {
  invalidAt({ ...project(), fieldConfig: { X: { type } } }, ["fieldConfig", "X", "type"], "unknown-kind");
});

test("unknown versions, groups and future fields remain diagnostics without being rewritten", () => {
  const text = JSON.stringify({ ...project(), fieldConfig: { X: { formulaVersion: "future-v2", autoTime: "future", statusGroups: { future: [] }, extension: { keep: 1 } } } });
  expect(checkProjectCoreJson(text).issues).toEqual([
    { location: ["fieldConfig", "X", "extension"], code: "unknown-field" },
    { location: ["fieldConfig", "X", "autoTime"], code: "unknown-kind" },
    { location: ["fieldConfig", "X", "formulaVersion"], code: "unknown-kind" },
    { location: ["fieldConfig", "X", "statusGroups", "future"], code: "unknown-field" },
  ]);
  expect(JSON.parse(text).fieldConfig.X.extension).toEqual({ keep: 1 });
});

test("relation config validates nested filters and present values without external graph resolution", () => {
  const relation = { targetProjectId: "missing-project", displayField: "", inverseFieldName: "", inverseDisplayField: "name", targetSubBaseFilter: { conditions: [], groups: [{ conditions: [] }] } };
  expect(inspect({ ...project(), fieldConfig: { X: { relation } } }).issues).toEqual([]);
  invalidAt({ ...project(), fieldConfig: { X: { relation: {} } } }, ["fieldConfig", "X", "relation", "targetProjectId"], "missing-field");
  invalidAt({ ...project(), fieldConfig: { X: { relation: { ...relation, inverseFieldName: false } } } }, ["fieldConfig", "X", "relation", "inverseFieldName"]);
  invalidAt({ ...project(), fieldConfig: { X: { relation: { ...relation, targetSubBaseFilter: { conditions: [{ field: "x", enabled: false, operator: "future" }] } } } } }, ["fieldConfig", "X", "relation", "targetSubBaseFilter", "conditions", 0, "operator"], "unknown-kind");
});

test.each(["count_total", "first_value", "last_value", "show_original", "show_unique", "avg"])("rollup %s retains native kernels and backlink shape", fn => {
  const rollup = { relationField: "", targetField: "", function: fn, mode: "show_original", separator: "", orderBy: "", backlink: { projectId: "p", relationField: "Visits" } };
  expect(inspect({ ...project(), fieldConfig: { X: { rollup } } }).issues).toEqual([]);
});

test.each([
  [{}, ["relationField"], "missing-field"],
  [{ relationField: "R" }, ["targetField"], "missing-field"],
  [{ relationField: "R", targetField: "X" }, ["function"], "missing-field"],
  [{ relationField: "R", targetField: "X", function: "average" }, ["function"], "unknown-kind"],
  [{ relationField: "R", targetField: "X", function: "avg", mode: "avg" }, ["mode"], "unknown-kind"],
  [{ relationField: "R", targetField: "X", function: "avg", mode: ["average"] }, ["mode"], "invalid-type"],
  [{ relationField: "R", targetField: "X", function: "avg", targetProjectId: null }, ["targetProjectId"], "invalid-type"],
  [{ relationField: "R", targetField: "X", function: "avg", mode: "sum" }, ["function"], "invalid-reference"],
  [{ relationField: "", targetField: "X", function: "avg", backlink: { projectId: "p" } }, ["backlink", "relationField"], "missing-field"],
] as const)("rollup diagnoses structure and distinguishes kernels from UI mode ids %#", (rollup, location, code) => {
  invalidAt({ ...project(), fieldConfig: { X: { rollup } } }, ["fieldConfig", "X", "rollup", ...location], code);
});

test("equivalent rollup modes preserve their kernel and absence does not manufacture a mode", () => {
  for (const rollup of [{ relationField: "R", targetField: "X", function: "avg", mode: "average" }, { relationField: "R", targetField: "X", function: "min", mode: "earliest" }, { relationField: "R", targetField: "X", function: "last_value" }]) {
    expect(inspect({ ...project(), fieldConfig: { X: { rollup } } }).issues).toEqual([]);
  }
});

test("typed property diagnostics share the global budget even under prototype-looking field names", () => {
  const value = JSON.parse('{"__proto__":{"relation":null},"constructor":{"options":[1]}}');
  invalidAt({ ...project(), fieldConfig: value }, ["fieldConfig", "__proto__", "relation"]);
  invalidAt({ ...project(), fieldConfig: value }, ["fieldConfig", "constructor", "options", 0]);
  expect(() => inspect({ ...project(), fieldConfig: Object.fromEntries(Array.from({ length: 2049 }, (_, i) => [String(i), { richText: 0, time: 1 }])) })).toThrow("too many");
});

test("input, depth, node and diagnostic budgets refuse oversized results", () => {
  expect(() => checkProjectCoreJson(" ".repeat(2 * 1024 * 1024 + 1))).toThrow("too large");
  expect(() => checkProjectCoreJson(JSON.stringify({ text: "界".repeat(800000) }))).toThrow("too large");
  expect(() => checkProjectCoreJson("[".repeat(34) + "0" + "]".repeat(34))).toThrow("too complex");
  expect(() => inspect({ ...project(), opaque: Array(16384).fill(0) })).toThrow("too complex");
  expect(() => inspect({ ...project(), ...Object.fromEntries(Array.from({ length: 4097 }, (_, i) => ["x" + i, 0])) })).toThrow("too many");
  expect(() => checkProjectCoreJson('{"opaque":1e999}')).toThrow("non-finite");
  expect(() => checkProjectCoreJson("{broken")).toThrow();
});

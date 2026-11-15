import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkProjectCoreJson } from "../projectCoreCheck";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));
const condition = (value: unknown = null) => ({ id: "c", field: "Done", operator: "is", value });
const group = () => ({ id: "g", conjunction: "AND", filters: [condition()], groups: [] });
const row = () => ({ id: "l", name: "List", icon: { type: "emoji", value: "" }, filterMode: "visual", filterGroup: group(), order: -1.5 });
const agenda = () => ({ mode: "custom", standard: { inheritCalendarFilters: false }, custom: { lists: [row()] } });
const project = (extra: Record<string, unknown>) => ({ ...DEFAULT_PROJECT, id: "p", name: "Project", ...extra });
const inspect = (extra: Record<string, unknown>) => checkProjectCoreJson(JSON.stringify(project(extra)));
const checkAgenda = (value: unknown) => inspect({ agenda: value });

test.each([null, "", 12, false, ["a", ""], true])("Agenda preserves stored value %p without evaluation or coercion", value => {
  const cfg = agenda(); cfg.custom.lists[0]!.filterGroup.filters = [condition(value)];
  expect(checkAgenda(cfg).issues).toEqual([]);
  expect(checkAgenda(cfg).complete).toBe(false);
});

test("advanced formula syntax is not evaluated, while unsupported version remains visible", () => {
  const cfg = { mode: "custom", custom: { lists: [{ ...row(), filterMode: "advanced", filterFormula: "[not executed", formulaVersion: "unified-v1" }] } };
  expect(checkAgenda(cfg).issues).toEqual([]);
  cfg.custom.lists[0]!.formulaVersion = "future";
  expect(checkAgenda(cfg).issues).toContainEqual({ location: ["agenda", "custom", "lists", 0, "formulaVersion"], code: "unknown-kind" });
});

test("legacy flat lists retain aliases and omitted condition metadata", () => {
  const { filterMode: _mode, filterGroup: _group, ...base } = row();
  const cfg = { mode: "custom", custom: { lists: [{ ...base, filters: [{ field: "Done", operator: "equals" }, { operator: "is_empty", field: "x", value: null }] }] } };
  const text = JSON.stringify(project({ agenda: cfg }));
  expect(checkProjectCoreJson(text).issues).toEqual([]);
  expect(JSON.parse(text).agenda.custom.lists[0].filters[0]).toEqual({ field: "Done", operator: "equals" });
});

test("empty and inherited Agenda settings do not manufacture lists or modes", () => {
  for (const cfg of [{ mode: "standard" }, { mode: "custom", custom: { lists: [] } }]) expect(checkAgenda(cfg).issues).toEqual([]);
  expect(inspect({}).issues).toEqual([]);
  expect(checkAgenda({}).issues).toEqual([{ location: ["agenda", "mode"], code: "missing-field" }]);
});

test.each([
  [null, [], "invalid-type"],
  [{ mode: "future" }, ["mode"], "unknown-kind"],
  [{ mode: "standard", standard: { inheritCalendarFilters: 1 } }, ["standard", "inheritCalendarFilters"], "invalid-type"],
  [{ mode: "custom", custom: { lists: {} } }, ["custom", "lists"], "invalid-type"],
  [{ mode: "custom", custom: { lists: [{ ...row(), collapsed: "false" }] } }, ["custom", "lists", 0, "collapsed"], "invalid-type"],
  [{ mode: "custom", custom: { lists: [{ ...row(), order: "1" }] } }, ["custom", "lists", 0, "order"], "invalid-type"],
  [{ mode: "custom", custom: { lists: [{ ...row(), icon: { type: "future", value: "" } }] } }, ["custom", "lists", 0, "icon", "type"], "unknown-kind"],
  [{ mode: "custom", custom: { lists: [{ ...row(), filterGroup: { ...group(), groups: false } }] } }, ["custom", "lists", 0, "filterGroup", "groups"], "invalid-type"],
  [{ mode: "custom", custom: { lists: [{ ...row(), filterGroup: { ...group(), conjunction: "or" } }] } }, ["custom", "lists", 0, "filterGroup", "conjunction"], "unknown-kind"],
] as const)("Agenda malformed present values are diagnosed %#", (value, suffix, code) => {
  expect(checkAgenda(value).issues).toContainEqual({ location: ["agenda", ...suffix], code });
});

test("nested group diagnostics keep exact locations and disabled conditions are still inspected", () => {
  const cfg = { ...agenda(), custom: { lists: [{ ...row(), filterGroup: { ...group(), filters: [], groups: [{ ...group(), filters: [{ ...condition({ invalid: 1 }), enabled: false, operator: "future" }] }] } }] } };
  expect(checkAgenda(cfg).issues).toEqual([
    { location: ["agenda", "custom", "lists", 0, "filterGroup", "groups", 0, "filters", 0, "operator"], code: "unknown-kind" },
    { location: ["agenda", "custom", "lists", 0, "filterGroup", "groups", 0, "filters", 0, "value"], code: "invalid-type" },
  ]);
});

test("shared modern operator and alias vocabularies are accepted without rewriting", () => {
  for (const operator of ["is-any-of", "is-this-quarter", "is-next-n-days", "not_contains", "greater_or_equal"]) {
    const cfg = agenda(); cfg.custom.lists[0]!.filterGroup.filters[0]!.operator = operator;
    expect(checkAgenda(cfg).issues).toEqual([]);
  }
});

test("modern conditions need their persisted ID and value, while string lists reject non-string members", () => {
  const cfg = { mode: "custom", custom: { lists: [{ ...row(), filterGroup: { ...group(), filters: [{ field: "x", operator: "is-empty" }, { ...condition([1]), id: "other" }] } }] } };
  expect(checkAgenda(cfg).issues).toEqual(expect.arrayContaining([
    { location: ["agenda", "custom", "lists", 0, "filterGroup", "filters", 0, "id"], code: "missing-field" },
    { location: ["agenda", "custom", "lists", 0, "filterGroup", "filters", 0, "value"], code: "missing-field" },
    { location: ["agenda", "custom", "lists", 0, "filterGroup", "filters", 1, "value", 0], code: "invalid-type" },
  ]));
});

test("list IDs are unique per Agenda while separate local calendars may reuse their original IDs", () => {
  const cfg = agenda(); cfg.custom.lists.push(row());
  expect(checkAgenda(cfg).issues).toContainEqual({ location: ["agenda", "custom", "lists", 1, "id"], code: "duplicate-id" });
  const single = agenda();
  const views = [0, 1].map(index => ({ ...DEFAULT_VIEW, id: "v" + index, name: "Calendar", type: "calendar", config: { localAgenda: single } }));
  expect(inspect({ agenda: single, views }).issues.filter(issue => issue.code !== "section-unchecked")).toEqual([]);
});

test("local Agenda is inspected only in calendar views and typed database-call calendar tabs", () => {
  const localAgenda = { mode: false };
  const widgets = [{ type: "database-call", config: { viewTabs: [{ viewType: "calendar", config: { localAgenda } }, { viewType: "table", config: { localAgenda } }] } }];
  const view = (type: string, config: unknown) => ({ ...DEFAULT_VIEW, id: "v", name: "V", type, config });
  expect(inspect({ views: [view("calendar", { localAgenda })] }).issues).toContainEqual({ location: ["views", 0, "config", "localAgenda", "mode"], code: "invalid-type" });
  expect(inspect({ views: [view("dashboard", { widgets })] }).issues).toEqual([
    { location: ["views", 0, "config"], code: "section-unchecked" },
    { location: ["views", 0, "config", "widgets", 0, "config", "viewTabs", 0, "config", "localAgenda", "mode"], code: "invalid-type" },
  ]);
  for (const type of ["table", "custom"]) expect(inspect({ views: [view(type, { widgets, localAgenda })] }).issues.filter(issue => issue.location.includes("localAgenda"))).toEqual([]);
  expect(inspect({ views: [view("board", { localAgenda })] }).issues).toEqual([{ location: ["views", 0, "config", "localAgenda"], code: "unknown-field" }]);
});

test("unknown Agenda fields are retained as diagnostics under the shared structural budget", () => {
  expect(checkAgenda({ mode: "standard", extension: { keep: true } }).issues).toEqual([{ location: ["agenda", "extension"], code: "unknown-field" }]);
  let nested: unknown = group();
  for (let i = 0; i < 35; i++) nested = { ...group(), filters: [], groups: [nested] };
  expect(() => checkAgenda({ mode: "custom", custom: { lists: [{ ...row(), filterGroup: nested }] } })).toThrow("too complex");
});

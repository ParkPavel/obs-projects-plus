import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import { previewPackageReferences } from "../packageRemap";

const encoderBefore = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: encoderBefore, configurable: true }));
const project = (id: string, extra: Record<string, unknown> = {}): ProjectDefinition => ({ ...DEFAULT_PROJECT, id, name: id, ...extra }) as ProjectDefinition;
const view = (id: string, widgets: unknown[], type = "dashboard") => ({ id, type, name: id, config: { widgets } });
const widget = (id: string, type: string, config: Record<string, unknown> = {}, extra = {}) => ({ id, type, config, ...extra });
const tab = (id: string, viewType = "table", extra = {}) => ({ id, viewType, config: {}, ...extra });
const preview = (projects: ProjectDefinition[], archives: ProjectDefinition[] = []) => {
  let i = 0;
  return previewPackageReferences(projects, { projects: [], archives }, () => `clone-${++i}`);
};
const cfg = (p: ProjectDefinition) => p.views[0]!.config['widgets'] as Record<string, unknown>[];

test("rewrites self/cross-project relations, rollups, backlinks and named/derived sources without touching input", () => {
  const input = [project("a", { isDefault: true, uniqueIdCounter: 73,
    fieldConfig: { self: { relation: { targetProjectId: "a" } }, other: { rollup: { targetProjectId: "b::s", backlink: { projectId: "b", relationField: "a" } } } },
    dataSource: { id: "primary", kind: "folder", config: { path: "a", recursive: true } },
    additionalSources: [{ id: "derived", kind: "derived", config: { from: "primary", where: { field: "a" } } }, { id: "merged", kind: "derived", config: { from: "project" } }],
    templates: ["a"], excludedNotes: ["b"], unknown: { id: "a", text: "[[a#anchor|alias]]" },
  }), project("b", { additionalSources: [{ id: "s", kind: "tag", config: { tag: "a" } }] })];
  const before = JSON.stringify(input), result = preview(input), [a] = result.projects, plan = result.plan;
  expect(result.stage).toBe("reference-preview"); expect(result.issues).toEqual([]);
  expect(a!.id).toBe(plan.projectId("a")); expect(a!.isDefault).toBe(false); expect(a!.uniqueIdCounter).toBe(73);
  expect(a!.fieldConfig['self']!.relation!.targetProjectId).toBe(plan.projectId("a"));
  expect(a!.fieldConfig['other']!.rollup!.targetProjectId).toBe(plan.baseReference("b::s"));
  expect(a!.fieldConfig['other']!.rollup!.backlink!.projectId).toBe(plan.projectId("b"));
  expect(a!.additionalSources![0]!.config).toMatchObject({ from: plan.sourceId("a", "primary"), where: { field: "a" } });
  expect(a!.additionalSources![1]!.config).toMatchObject({ from: "project" });
  expect(a).toMatchObject({ templates: ["a"], excludedNotes: ["b"], unknown: { id: "a", text: "[[a#anchor|alias]]" } });
  expect(JSON.stringify(input)).toBe(before);
});

test.each([false, true])("linked-view remap uses external source project regardless processing order (reverse=%s)", reverse => {
  const a = project("a", { views: [view("same", [widget("block", "database-call", { viewTabs: [tab("t", "board", { linkedViewId: "same" })], activeTabId: "t" }, { sourceConfig: { projectId: "b", sourceId: "s" } })])] });
  const b = project("b", { views: [{ id: "same", type: "board", config: {}, name: "Other" }], additionalSources: [{ id: "s", kind: "folder", config: { path: "" } }] });
  const result = preview(reverse ? [b, a] : [a, b]), p = result.plan;
  expect(result.issues).toEqual([]);
  const block = cfg(result.projects.find(item => item.id === p.projectId("a"))!)[0]!;
  expect(block['id']).toBe(p.widgetId("a", "same", "block"));
  expect(block['sourceConfig']).toEqual({ projectId: p.projectId("b"), sourceId: p.sourceId("b", "s") });
  expect(block['config']).toMatchObject({ activeTabId: p.tabId("a", "same", "block", "t"), viewTabs: [{ id: p.tabId("a", "same", "block", "t"), linkedViewId: p.viewId("b", "same") }] });
});

test("maps chart inputs, series, correlation, host selection and disabled joins exactly once", () => {
  const input = [project("a", { views: [view("v:one", [widget("master", "data-table"), widget("chart", "chart", {
    dataProjectId: "b", series: [{ id: "kept", dataProjectId: "b::part", property: "b" }],
    correlation: { rightSourceId: "b::block:v:table", on: { leftKey: "a" } },
    linkedSelection: { sourceWidgetId: "master", relationField: "b" }, title: "b",
  }, { transform: { steps: [{ type: "join", disabled: true, rightSourceId: "b", on: { leftKey: "b" } }, { type: "compute", expression: "b" }] } })])] }),
  project("b", { views: [view("v", [widget("table", "database-call")])], additionalSources: [{ id: "part", kind: "tag", config: { tag: "a" } }] })];
  const r = preview(input), p = r.plan, chart = cfg(r.projects[0]!)[1]!;
  expect(r.issues).toEqual([]);
  expect(chart['config']).toEqual({ dataProjectId: p.projectId("b"), series: [{ id: "kept", dataProjectId: p.baseReference("b::part"), property: "b" }], correlation: { rightSourceId: p.baseReference("b::block:v:table"), on: { leftKey: "a" } }, linkedSelection: { sourceWidgetId: p.widgetId("a", "v:one", "master"), relationField: "b" }, title: "b" });
  expect(chart['transform']).toEqual({ steps: [{ type: "join", disabled: true, rightSourceId: p.projectId("b"), on: { leftKey: "b" } }, { type: "compute", expression: "b" }] });
});

test("non-db sourceId stays in host context even when dormant projectId names another project", () => {
  const source = { id: "s", kind: "folder", config: { path: "" } };
  const r = preview([project("a", { dataSource: source, views: [view("v", [widget("chart", "chart", {}, { sourceConfig: { projectId: "b", sourceId: "s" } })])] }), project("b", { dataSource: source })]);
  expect(r.issues).toEqual([]);
  expect(cfg(r.projects[0]!)[0]!['sourceConfig']).toEqual({ projectId: r.plan.projectId("b"), sourceId: r.plan.sourceId("a", "s") });
});

test("maps retained chart/stats tab config and linked selection in host canvas context", () => {
  const r = preview([project("a", { views: [view("v", [widget("master", "data-table"), widget("block", "database-call", { viewTabs: [
    tab("chart", "chart", { config: { dataProjectId: "b", series: [{ dataProjectId: "a" }], linkedSelection: { sourceWidgetId: "master" } } }),
    tab("stats", "stats", { config: { dataProjectId: "a", linkedSelection: { sourceWidgetId: "master" } } }),
  ] })])] }), project("b")]);
  expect(r.issues).toEqual([]);
  const tabs = (cfg(r.projects[0]!)[1]!['config'] as Record<string, unknown>)['viewTabs'] as Record<string, unknown>[];
  expect(tabs[0]!['config']).toMatchObject({ dataProjectId: r.plan.projectId("b"), series: [{ dataProjectId: r.plan.projectId("a") }], linkedSelection: { sourceWidgetId: r.plan.widgetId("a", "v", "master") } });
  expect(tabs[1]!['config']).toMatchObject({ dataProjectId: r.plan.projectId("a") });
});

test("missing destinations produce structured blocking diagnostics and preserve unresolved text", () => {
  const r = preview([project("a", { fieldConfig: { 'x/y': { relation: { targetProjectId: "foreign" } } }, views: [view("v", [widget("chart", "chart", { dataProjectId: "foreign" })])] })], [project("foreign")]);
  expect(r.issues).toEqual([
    { projectId: "a", code: "unresolved-reference", location: ["fieldConfig", "x/y", "relation", "targetProjectId"] },
    { projectId: "a", code: "unresolved-reference", location: ["views", 0, "config", "widgets", 0, "config", "dataProjectId"] },
  ]);
  expect(r.projects[0]!.fieldConfig['x/y']!.relation!.targetProjectId).toBe("foreign");
});

test("diagnoses unknown views/widgets/sources/steps while preserving their opaque config", () => {
  const r = preview([project("a", { dataSource: { id: "opaque", kind: "extension", config: { projectId: "a" } }, views: [
    { id: "custom", type: "extension", config: { targetProjectId: "a" } },
    view("v", [widget("custom", "extension", { targetProjectId: "a" }), widget("known", "data-table", {}, { transform: { steps: [{ type: "future", rightSourceId: "a" }] } })]),
  ] })]);
  expect(r.issues.filter(issue => issue.code === "unsupported-config")).toHaveLength(4);
  expect(r.projects[0]!.views[0]!.config).toEqual({ targetProjectId: "a" });
  expect(cfg({ ...r.projects[0]!, views: [r.projects[0]!.views[1]!] })[0]!['config']).toEqual({ targetProjectId: "a" });
});

test("qualified source plus linkedView/sourceId is reported rather than guessing contextual ownership", () => {
  const r = preview([project("a", { views: [view("v", [widget("block", "database-call", { viewTabs: [tab("t", "board", { linkedViewId: "v" })] }, { sourceConfig: { projectId: "b::s", sourceId: "s" } })])] }),
    project("b", { dataSource: { id: "s", kind: "folder", config: { path: "" } }, views: [{ id: "v", type: "board", config: {} }] })]);
  expect(r.issues.map(issue => issue.code)).toEqual(["unsupported-context", "unsupported-context"]);
});

test("linked view type mismatch or missing view cannot silently bind to host", () => {
  const r = preview([project("a", { views: [view("v", [widget("block", "database-call", { viewTabs: [tab("t", "board", { linkedViewId: "v" })] })])] })]);
  expect(r.issues.map(issue => issue.code)).toEqual(["unresolved-reference"]);
});

test.each([
  { linkedSelection: {} }, { correlation: {} }, { series: "bad" }, { series: [null] }, { dataProjectId: 7 },
])("invalid chart reference shapes are diagnostics: %j", config => {
  const r = preview([project("a", { views: [view("v", [widget("w", "chart", config)])] })]);
  expect(r.issues).toHaveLength(1); expect(r.issues[0]!.code).toBe("invalid-shape");
});

test.each([{ activeTabId: "missing" }, { viewTabs: [], activeTabId: "missing" }, { viewTabs: [tab("t", "future")] }, { sourceConfig: { kind: "folder", config: {} } }])("reports unsupported or unresolved db config: %j", config => {
  expect(preview([project("a", { views: [view("v", [widget("w", "database-call", config)])] })]).issues).toHaveLength(1);
});

test("empty inherit/disabled selections stay empty and destination default is unchanged", () => {
  const existing = project("existing", { isDefault: true });
  let i = 0;
  const r = previewPackageReferences([project("a", { isDefault: true, views: [view("v", [widget("w", "stats", { dataProjectId: "", linkedSelection: { sourceWidgetId: "" } }, { sourceConfig: { projectId: "", sourceId: "" } })])] })], { projects: [existing], archives: [] }, () => `new-${++i}`);
  expect(r.issues).toEqual([]); expect(existing.isDefault).toBe(true); expect(r.projects[0]!.isDefault).toBe(false);
  expect(cfg(r.projects[0]!)[0]!['config']).toEqual({ dataProjectId: "", linkedSelection: { sourceWidgetId: "" } });
});

test("preview is detached from later input edits and enforces payload bound", () => {
  const input = project("a", { unknown: { label: "before" } }), r = preview([input]);
  (input as unknown as Record<string, { label: string }>)['unknown']!.label = "after";
  expect(r.projects[0]).toMatchObject({ unknown: { label: "before" } });
  expect(() => preview([project("a", { huge: "x".repeat(2 * 1024 * 1024) })])).toThrow("too large");
});

test("selection and active tabs use owning canvas/block scopes, not reused display IDs", () => {
  const r = preview([project("a", { views: ["first", "second"].map(id => view(id, [widget("master", "data-table"), widget("w", "database-call", {
    linkedSelection: { sourceWidgetId: "master" }, activeTabId: "same", viewTabs: [tab("same")],
  })])) })]);
  expect(r.issues).toEqual([]);
  for (const [index, id] of ["first", "second"].entries()) {
    const block = (r.projects[0]!.views[index]!.config['widgets'] as Record<string, unknown>[])[1]!;
    expect(block['config']).toMatchObject({ linkedSelection: { sourceWidgetId: r.plan.widgetId("a", id, "master") }, activeTabId: r.plan.tabId("a", id, "w", "same") });
  }
});

test("missing named/derived source and selection targets remain blocking even if defaults exist", () => {
  const r = preview([project("a", {
    additionalSources: [{ id: "s", kind: "derived", config: { from: "gone" } }],
    views: [view("v", [widget("w", "stats", { linkedSelection: { sourceWidgetId: "gone" } }, { sourceConfig: { projectId: "", sourceId: "gone" } })])],
  })]);
  expect(r.issues.map(issue => issue.code)).toEqual(["unresolved-reference", "unresolved-reference", "unresolved-reference"]);
});

test("diagnostic count is bounded instead of returning an unbounded invalid preview", () => {
  const fields = Object.fromEntries(Array.from({ length: 4097 }, (_, i) => [String(i), null]));
  expect(() => preview([project("a", { fieldConfig: fields })])).toThrow("too many reference issues");
});

test.each([0, false, null])("invalid activeTabId is diagnosed without viewTabs too: %j", activeTabId => {
  const r = preview([project("a", { views: [view("v", [widget("w", "database-call", { activeTabId })])] })]);
  expect(r.issues.map(issue => issue.code)).toEqual(["invalid-shape"]);
});

test("bounds successful references, not just errors, before expansion can grow without limit", () => {
  const fields = Object.fromEntries(Array.from({ length: 4097 }, (_, i) => [String(i), { relation: { targetProjectId: "a" } }]));
  expect(() => preview([project("a", { fieldConfig: fields })])).toThrow("too many mapped references");
});

test("enforces payload byte limit AFTER replacing short IDs with long ones", () => {
  const fields = Object.fromEntries(Array.from({ length: 3000 }, (_, i) => [String(i), { relation: { targetProjectId: "a" } }]));
  const input = project("a", { fieldConfig: fields, unknown: "x".repeat(1800000) });
  const before = JSON.stringify(input);
  expect(new TextEncoder().encode(JSON.stringify(input)).length).toBeLessThan(2 * 1024 * 1024);
  expect(() => previewPackageReferences([input], { projects: [], archives: [] }, () => "n".repeat(128))).toThrow("reference preview too large");
  expect(JSON.stringify(input)).toBe(before);
});

test("enforces total output byte limit when each expanded project still fits its own limit", () => {
  const input = Array.from({ length: 9 }, (_, index) => {
    const id = `p${index}`;
    return project(id, { unknown: "x".repeat(1820000), fieldConfig: Object.fromEntries(Array.from({ length: 400 }, (_, i) => [String(i), { relation: { targetProjectId: id } }])) });
  });
  const incoming = input.reduce((sum, p) => sum + new TextEncoder().encode(JSON.stringify(p)).length, 0);
  expect(incoming).toBeLessThan(16 * 1024 * 1024);
  let i = 0;
  expect(() => previewPackageReferences(input, { projects: [], archives: [] }, () => `n${++i}`.padEnd(128, "n"))).toThrow("reference preview too large");
});

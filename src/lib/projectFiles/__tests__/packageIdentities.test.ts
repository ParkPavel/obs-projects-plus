import { DEFAULT_PROJECT, type ProjectDefinition } from "src/settings/settings";
import { createPackageIdentityPlan as createPlan, type PackageIdentityKind } from "../packageIdentities";

const createPackageIdentityPlan = (imported: ProjectDefinition[], destination: ProjectDefinition[], allocate: (kind: PackageIdentityKind) => string) =>
  createPlan(imported, { projects: destination, archives: [] }, allocate);

const project = (id: string, views: unknown[] = [], extra: Record<string, unknown> = {}): ProjectDefinition =>
  ({ ...DEFAULT_PROJECT, id, name: id, views, ...extra }) as ProjectDefinition;
const view = (id: string, widgets: unknown[] = []) => ({ id, name: id, type: "dashboard", config: { widgets } });
const widget = (id: string, tabs: unknown[] = []) => ({ id, type: "database-call", config: { viewTabs: tabs } });
const allocator = () => { let count = 0; return () => `fresh-${++count}`; };
const source = (id: string) => ({ id, kind: "folder", config: { path: "", recursive: true } });

test("maps project, source, view, widget and tab identities without altering opaque config", () => {
  const imported = project("p", [view("v", [widget("w", [{ id: "tab", config: { text: "p", link: "[[p#heading|alias]]" } }])])],
    { dataSource: source("primary"), additionalSources: [source("secondary")], unknown: { id: "p" } });
  const before = JSON.stringify(imported);
  const plan = createPackageIdentityPlan([imported], [], allocator());
  expect(plan.identities.map(item => item.kind)).toEqual(["project", "source", "source", "view", "widget", "tab"]);
  expect(plan.baseReference("p")).toBe(plan.projectId("p"));
  expect(plan.baseReference("p::primary")).toBe(`${plan.projectId("p")}::${plan.sourceId("p", "primary")}`);
  expect(plan.baseReference("p::secondary")).toBe(`${plan.projectId("p")}::${plan.sourceId("p", "secondary")}`);
  expect(plan.tabId("p", "v", "w", "tab")).toMatch(/^fresh-/);
  expect(JSON.stringify(imported)).toBe(before);
});

test("scope separates reused source/view/widget/tab IDs across projects and views", () => {
  const views = [view("v", [widget("w", [{ id: "t" }])]), view("v:other", [widget("w", [{ id: "t" }])])];
  const plan = createPackageIdentityPlan([project("p", views, { dataSource: source("s") }), project("q", views, { dataSource: source("s") })], [], allocator());
  expect(plan.sourceId("p", "s")).not.toBe(plan.sourceId("q", "s"));
  expect(plan.viewId("p", "v")).not.toBe(plan.viewId("q", "v"));
  expect(plan.widgetId("p", "v", "w")).not.toBe(plan.widgetId("p", "v:other", "w"));
  expect(plan.tabId("p", "v", "w", "t")).not.toBe(plan.tabId("q", "v", "w", "t"));
  expect(plan.baseReference("p::block:v:other:w")).toBe(`${plan.projectId("p")}::block:${plan.viewId("p", "v:other")}:${plan.widgetId("p", "v:other", "w")}`);
});

test("allocations avoid ALL original identities and active/archived destination identities", () => {
  const candidates = ["p", "old-source", "old-view", "old-widget", "old-tab", "archived", "safe"];
  const destination = [project("active", [view("old-view", [widget("old-widget", [{ id: "old-tab" }])])], { dataSource: source("old-source") }), project("archived")];
  const allocate = jest.fn(() => candidates.shift()!);
  const plan = createPlan([project("p")], { projects: destination.slice(0, 1), archives: destination.slice(1) }, allocate);
  expect(plan.projectId("p")).toBe("safe");
  expect(allocate).toHaveBeenCalledTimes(7);
});

test("same template can be independently cloned when previous clone is included in destination", () => {
  const first = createPackageIdentityPlan([project("p")], [], allocator());
  const next = createPackageIdentityPlan([project("p")], [project(first.projectId("p"))], allocator());
  expect(next.projectId("p")).not.toBe(first.projectId("p"));
});

test("never falls through to an existing destination project, source or block", () => {
  const plan = createPackageIdentityPlan([project("p", [view("v", [widget("w")])])], [project("outside")], allocator());
  for (const ref of ["outside", "outside::part", "outside::block:v:w", "p::part", "p::block:gone:w", "p::block:v:gone"]) {
    expect(() => plan.baseReference(ref)).toThrow(/unresolved import/);
  }
});

test("a chart widget cannot masquerade as a database-call block", () => {
  const plan = createPackageIdentityPlan([project("p", [view("v", [{ id: "w", type: "chart", config: {} }])])], [], allocator());
  expect(() => plan.baseReference("p::block:v:w")).toThrow("unresolved import block");
});

test("derived literal project is preserved, but named source is mapped and host must exist", () => {
  const plan = createPackageIdentityPlan([project("p", [], { dataSource: source("s") })], [], allocator());
  expect(plan.derivedFrom("p", "project")).toBe("project");
  expect(plan.derivedFrom("p", "s")).toBe(plan.sourceId("p", "s"));
  expect(() => plan.derivedFrom("missing", "project")).toThrow("unresolved import identity");
  expect(() => plan.derivedFrom("p", "missing")).toThrow("unresolved import identity");
});

test("no anonymous source identity is invented; custom viewTabs data remains opaque", () => {
  const plan = createPackageIdentityPlan([project("p", [view("v", [{ id: "custom", type: "third-party", config: { viewTabs: "opaque" } }])])], [], allocator());
  expect(plan.identities.map(item => item.kind)).toEqual(["project", "view", "widget"]);
});

test.each([
  [project("p"), project("p")],
  [project("p", [view("v"), view("v")])],
  [project("p", [], { dataSource: source("s"), additionalSources: [source("s")] })],
  [project("p", [view("v", [widget("w"), widget("w")])])],
  [project("p", [view("v", [widget("w", [{ id: "t" }, { id: "t" }])])])],
])("refuses duplicate identities in their own scope before allocating: %j", (...input) => {
  const allocate = jest.fn(allocator());
  expect(() => createPackageIdentityPlan(input, [], allocate)).toThrow();
  expect(allocate).not.toHaveBeenCalled();
});

test.each([
  project("p::q"),
  project("p", [], { dataSource: source("project") }),
  project("p", [], { dataSource: source("block:bad") }),
  project("p", [view("v", [widget("w:bad")])]),
  project("p", [view("v", [widget("w", [{ id: "" }])])]),
  project("p", [view("v", [null])]),
  project("p", [view("v", [{ id: "w", type: "database-call", config: { viewTabs: "bad" } }])]),
])("refuses ambiguous or malformed structural identities: %j", input => {
  expect(() => createPackageIdentityPlan([input], [], allocator())).toThrow();
});

test("preflights destination too, refusing duplicate destination identities before allocation", () => {
  const allocate = jest.fn(allocator());
  expect(() => createPackageIdentityPlan([project("p")], [project("q"), project("q")], allocate)).toThrow();
  expect(allocate).not.toHaveBeenCalled();
});

test("collision retry is bounded and globally includes already allocated IDs", () => {
  const allocate = jest.fn(() => "same");
  expect(() => createPackageIdentityPlan([project("p", [view("v")])], [], allocate)).toThrow("allocation exhausted");
  expect(allocate).toHaveBeenCalledTimes(33);
});

test.each(["", "project", "bad:id", "bad::id", "a".repeat(129), "кириллица"])('refuses unusable generated identity "%s"', id => {
  expect(() => createPackageIdentityPlan([project("p")], [], () => id)).toThrow("invalid allocated identity");
});

test("bounds project count and identity count before any allocation", () => {
  const allocate = jest.fn(allocator());
  expect(() => createPackageIdentityPlan([], [], allocate)).toThrow("project count");
  expect(() => createPackageIdentityPlan(Array.from({ length: 101 }, (_, i) => project(`p${i}`)), [], allocate)).toThrow("project count");
  const widgets = Array.from({ length: 16384 }, (_, i) => widget(`w${i}`));
  expect(() => createPackageIdentityPlan([project("p", [view("v", widgets)])], [], allocate)).toThrow("too many import identities");
  expect(allocate).not.toHaveBeenCalled();
});

test("supports long compound references and keys with prototype-like names", () => {
  const p = "p".repeat(512), v = "v".repeat(512), w = "w".repeat(512);
  const plan = createPackageIdentityPlan([project(p, [view(v, [widget(w)])]), project("__proto__")], [], allocator());
  expect(plan.baseReference(`${p}::block:${v}:${w}`)).toMatch(/^fresh-\d+::block:fresh-\d+:fresh-\d+$/);
  expect(plan.projectId("__proto__")).toMatch(/^fresh-/);
});

test.each(["", "p::", "p::block:", "p::block:v:", "p::block::w"])('refuses malformed references "%s"', ref => {
  const plan = createPackageIdentityPlan([project("p")], [], allocator());
  expect(() => plan.baseReference(ref)).toThrow();
});

test("plan is immutable and detached from subsequent source edits", () => {
  const imported = project("p", [view("v", [widget("w")])]);
  const plan = createPackageIdentityPlan([imported], [], allocator());
  const before = plan.baseReference("p::block:v:w");
  (imported.views[0]!.config['widgets'] as unknown[]).splice(0);
  expect(plan.baseReference("p::block:v:w")).toBe(before);
  expect(Object.isFrozen(plan)).toBe(true);
  expect(Object.isFrozen(plan.identities)).toBe(true);
  expect(plan.identities.every(item => Object.isFrozen(item) && Object.isFrozen(item.scope))).toBe(true);
});

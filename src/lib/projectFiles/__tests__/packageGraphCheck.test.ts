import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW, type ProjectDefinition } from "src/settings/settings";
import { checkPackageGraph } from "../packageGraphCheck";
import { suggestChart } from "src/ui/views/Dashboard/widgets/Chart/chartSuggest";

const savedEncoder = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: TextEncoder }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { configurable: true, value: savedEncoder }));
const project = (id: string, extra: Record<string, unknown> = {}) => ({ ...DEFAULT_PROJECT, id, name: id, ...extra }) as ProjectDefinition;
const widget = (id: string, target = "", config: Record<string, unknown> = {}) => ({ id, type: "database-call", title: id, layout: { x: 0, y: 0, w: 12, h: 8 }, config, sourceConfig: { projectId: target } });
const views = (widgets: unknown[]) => [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets } }];

test("closed graph is read-only and retains mutual project relations", () => {
  const input = [project("a", { fieldConfig: { R: { relation: { targetProjectId: "b" } } } }), project("b", { fieldConfig: { R: { relation: { targetProjectId: "a" } } } })];
  const before = JSON.stringify(input), result = checkPackageGraph(input);
  expect(result).toMatchObject({ stage: "package-graph-check", complete: false, referencesChecked: true, issues: [] });
  expect(result.coreChecks.every(item => item.check.issues.length === 0)).toBe(true);
  expect(JSON.stringify(input)).toBe(before);
});

test.each([
  { sourceConfig: { projectId: "", sourceId: "missing" } },
  { config: { activeTabId: "missing" } },
  { config: { viewTabs: [{ id: "t", label: "T", viewType: "board", config: {}, linkedViewId: "missing" }] } },
])("locally dangling references are blocked independently of package project dependencies: %j", patch => {
  const result = checkPackageGraph([project("a", { views: views([{ ...widget("w"), ...patch }]) })]);
  expect(result.referencesChecked).toBe(true);
  expect(result.issues).toEqual([expect.objectContaining({ projectId: "a", code: "unresolved-reference" })]);
});

test("an external project cannot be supplied by the recipient vault", () => {
  const result = checkPackageGraph([project("a", { fieldConfig: { R: { relation: { targetProjectId: "outside" } } } })]);
  expect(result.issues).toContainEqual({ projectId: "a", location: ["fieldConfig", "R", "relation", "targetProjectId"], code: "unresolved-reference" });
});

test.each([false, true])("block reading loops are diagnosed (mutual=%s)", mutual => {
  const input = [project("a", { views: views([widget("w", mutual ? "b::block:v:w" : "a::block:v:w")]) })];
  if (mutual) input.push(project("b", { views: views([widget("w", "a::block:v:w")]) }));
  const result = checkPackageGraph(input);
  expect(result.referencesChecked).toBe(true);
  expect(result.issues).toHaveLength(mutual ? 2 : 1);
  expect(result.issues.every(issue => issue.code === "block-read-cycle")).toBe(true);
});

test.each([8, 9])("block read depth follows the runtime boundary for %i downstream blocks", count => {
  const widgets = Array.from({ length: count + 1 }, (_, i) => widget(`w${i}`, i < count ? `a::block:v:w${i + 1}` : ""));
  const result = checkPackageGraph([project("a", { views: views(widgets) })]);
  expect(result.issues).toHaveLength(count === 8 ? 0 : 1);
});

test("a chart's input also obeys the block-chain limit", () => {
  const widgets = Array.from({ length: 9 }, (_, i) => widget(`w${i}`, i < 8 ? `a::block:v:w${i + 1}` : ""));
  const chart = { id: "chart", type: "chart", title: "Chart", layout: { x: 0, y: 0, w: 12, h: 8 }, config: { ...suggestChart([]), dataProjectId: "a::block:v:w0" } };
  const result = checkPackageGraph([project("a", { views: views([...widgets, chart]) })]);
  expect(result.coreChecks[0]!.check.issues).toEqual([]);
  expect(result.issues).toEqual([{ projectId: "a", code: "block-read-cycle", location: ["views", 0, "config", "widgets", 9] }]);
});

test("invalid and unknown envelopes stop reference traversal without executing their contents", () => {
  const p = project("a", { views: views([{ ...widget("w"), type: "extension", config: { sourceConfig: { kind: "query", text: "never executed" } } }]) });
  const result = checkPackageGraph([p]);
  expect(result.referencesChecked).toBe(false);
  expect(result.coreChecks[0]!.check.issues).toContainEqual({ location: ["views", 0, "config", "widgets", 0, "type"], code: "unknown-kind" });
  expect(result.issues).toEqual([]);
});

test("malformed and duplicate project identities cannot allocate a preview", () => {
  expect(() => checkPackageGraph([project("a"), project("a")])).toThrow("duplicate import identity");
  expect(() => checkPackageGraph([])).toThrow("project count");
  expect(() => checkPackageGraph([project("a", { uniqueIdCounter: Infinity })])).toThrow("non-finite");
});

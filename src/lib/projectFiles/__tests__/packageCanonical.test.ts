import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { canonicalPackageProject } from "../packageCanonical";
import { checkPackageGraph } from "../packageGraphCheck";

const saved = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: saved, configurable: true }));
test("historical table settings become a stable scoped data-table widget before identity remapping", () => {
  const project = { ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "Table", type: "table", config: { fieldConfig: { Name: { width: 100, pinned: true } }, sortField: "Name", sortAsc: false, orderFields: ["Name"] } }] };
  const before = JSON.stringify(project), a = canonicalPackageProject(project), b = canonicalPackageProject(project);
  expect(a).toEqual(b); expect(a.views[0]!.type).toBe("dashboard");
  expect(a.views[0]!.config['table']).toMatchObject(project.views[0]!.config);
  expect(a.views[0]!.config['widgets']).toEqual([expect.objectContaining({ id: "legacy-table", type: "data-table" })]);
  expect(checkPackageGraph([a]).issues).toEqual([]); expect(checkPackageGraph([a]).coreChecks[0]!.check.issues).toEqual([]);
  expect(JSON.stringify(project)).toBe(before);
});
test("exactly empty pages stay empty; unsupported legacy keys remain diagnostic and lossless", () => {
  const project = { ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "Page", type: "table", config: {} }] };
  expect(canonicalPackageProject(project).views[0]!.config['widgets']).toEqual([]);
  const unknown = { ...project, views: [{ ...project.views[0]!, config: { futureOption: 1 } }] };
  expect(canonicalPackageProject(unknown)).toEqual(unknown);
  expect(checkPackageGraph([canonicalPackageProject(unknown)]).coreChecks[0]!.check.issues.length).toBeGreaterThan(0);
});

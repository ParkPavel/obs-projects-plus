import { TextEncoder } from "node:util";
import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { checkPackageGraph } from "../packageGraphCheck";

const saved = window.TextEncoder;
beforeAll(() => Object.defineProperty(window, "TextEncoder", { value: TextEncoder, configurable: true }));
afterAll(() => Object.defineProperty(window, "TextEncoder", { value: saved, configurable: true }));

test("a wide shared DAG near the reference budget remains a valid closed package", () => {
  const projects = Array.from({ length: 100 }, (_, pi) => ({ ...DEFAULT_PROJECT, id: `p${pi}`, name: `P${pi}`, views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: {
    widgets: Array.from({ length: 20 }, (_, wi) => {
      const layer = pi >= 93 && wi < 16 ? pi - 93 : -1;
      const targets = layer === 6 ? [] : layer >= 0 ? Array.from({ length: 16 }, (_, i) => `p${pi + 1}::block:v:w${i}`) : ["p93::block:v:w0"];
      return { id: `w${wi}`, type: "database-call", title: "Data", layout: { x: 0, y: 0, w: 12, h: 8 }, config: {}, sourceConfig: { projectId: targets[0] ?? "" },
        ...(targets.length > 1 ? { transform: { steps: targets.slice(1).map(rightSourceId => ({ type: "join", rightSourceId, on: { leftKey: "x", rightKey: "x" }, how: "left" })) } } : {}) };
    }),
  } }] }));
  const before = Date.now(), result = checkPackageGraph(projects);
  console.info("Package graph shared-DAG probe", { projects: 100, widgets: 2000, reads: 3424, elapsedMs: Date.now() - before });
  expect(result.referencesChecked).toBe(true); expect(result.issues).toEqual([]);
  expect(result.coreChecks.every(item => item.check.issues.length === 0)).toBe(true);
});

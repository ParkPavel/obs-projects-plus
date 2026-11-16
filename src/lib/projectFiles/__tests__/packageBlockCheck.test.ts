import { DEFAULT_PROJECT, DEFAULT_VIEW } from "src/settings/settings";
import { blockReadCycle, blockRefId } from "src/lib/relations/blockRefs";
import { createPackageBlockCheck } from "../packageBlockCheck";

const reference = (id: string) => blockRefId("p", "v", id);
function corpus(edges: readonly (readonly string[])[]) {
  return [{ ...DEFAULT_PROJECT, id: "p", name: "P", views: [{ ...DEFAULT_VIEW, id: "v", name: "V", type: "dashboard", config: { widgets: edges.map((targets, i) => ({
    id: String(i), type: "database-call", title: "Data", layout: { x: 0, y: 0, w: 12, h: 8 }, config: {}, sourceConfig: { projectId: targets[0] ? reference(targets[0]) : "" },
    transform: { steps: targets.slice(1).map(target => ({ type: "join", rightSourceId: reference(target), on: { leftKey: "x", rightKey: "x" }, how: "left" })) },
  })) } }] }];
}
test("indexed checks match the runtime oracle on loops, missing nodes, shared DAGs and the 8/9 target boundary", () => {
  const graphs: string[][][] = [[[]], [["0"]], [["1"], ["0"]], [["1", "2"], ["3"], ["3"], []], [["missing"]]];
  for (let n = 2; n <= 10; n++) graphs.push(Array.from({ length: n }, (_, i) => i + 1 < n ? [String(i + 1)] : []));
  for (let seed = 0; seed < 16; seed++) graphs.push(Array.from({ length: 7 }, (_, i) => [String((i * 3 + seed) % 8), String((i + seed * 2) % 8)]));
  for (const graph of graphs) {
    const projects = corpus(graph), before = JSON.stringify(projects), check = createPackageBlockCheck(projects);
    for (const self of [undefined, ...graph.map((_, i) => reference(String(i))), reference("ghost")]) for (const target of [...graph.map((_, i) => reference(String(i))), reference("missing"), "p", "invalid::block:"]) {
      expect(check(self, target)).toBe(blockReadCycle(projects, self, target));
    }
    expect(JSON.stringify(projects)).toBe(before);
  }
});

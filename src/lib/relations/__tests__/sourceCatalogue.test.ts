/**
 * i3-data — one source catalogue, block refs, and the loop guard.
 */
import { sourceCatalogue } from "../baseRef";
import { blockReadCycle, blockRecordsProject, blockRefId, parseBlockRef, refsReadBy } from "../blockRefs";

const dbBlock = (id: string, title: string, source?: string, extra: Record<string, unknown> = {}) => ({
  id, type: "database-call", title, layout: { x: 0, y: 0, w: 1, h: 1 }, config: { viewTabs: [], ...extra },
  ...(source ? { sourceConfig: { projectId: source } } : {}),
});

function projects(aSource?: string, bSource?: string) {
  return [
    {
      id: "p1", name: "Кабинет",
      dataSource: { kind: "folder", id: "main", config: { path: "К" } },
      additionalSources: [
        { kind: "derived", id: "s2", name: "Активные клиенты", config: { from: "project", where: { conjunction: "and", conditions: [] } } },
      ],
      views: [{
        id: "v1", name: "Обзор", type: "dashboard", filter: { conditions: [] },
        config: { widgets: [
          dbBlock("A", "Активные", aSource),
          dbBlock("B", "Долги", bSource),
          { id: "C", type: "chart", title: "График", layout: {}, config: { dataProjectId: blockRefId("p1", "v1", "A") } },
        ] },
      }],
    },
    { id: "p2", name: "Трекер", dataSource: { kind: "folder", config: { path: "T" } }, views: [] },
  ] as never;
}

describe("block refs", () => {
  it("round-trips and rejects project / source refs", () => {
    const ref = blockRefId("p1", "v1", "w-1");
    expect(ref).toBe("p1::block:v1:w-1");
    expect(parseBlockRef(ref)).toEqual({ projectId: "p1", viewId: "v1", widgetId: "w-1" });
    expect(parseBlockRef("p1")).toBeNull();
    expect(parseBlockRef("p1::s2")).toBeNull();
    expect(parseBlockRef("p1::block:")).toBeNull();
  });

  it("collects every ref a widget reads", () => {
    const w = {
      id: "x", type: "chart", sourceConfig: { projectId: "a" },
      config: { dataProjectId: "b", correlation: { rightSourceId: "c" }, series: [{ dataProjectId: "d" }] },
      transform: { steps: [{ type: "join", rightSourceId: "e" }, { type: "filter" }] },
    };
    expect(refsReadBy(w).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("sourceCatalogue — the one list", () => {
  it("lists projects, sources and saved selections, and every block as a filtered source", () => {
    const list = sourceCatalogue(projects());
    expect(list.map((o) => [o.kind, o.value, o.label])).toEqual([
      ["project", "p1", "Кабинет"],
      ["source", "p1::s2", "Кабинет · Активные клиенты"],
      ["block", "p1::block:v1:A", "Кабинет · Block «Активные» (filtered)"],
      ["block", "p1::block:v1:B", "Кабинет · Block «Долги» (filtered)"],
      ["project", "p2", "Трекер"],
    ]);
  });

  it("takes the block label from the caller (locale) and limits blocks to one project", () => {
    const list = sourceCatalogue(projects(), { blockLabel: (t) => `Блок «${t}»`, blocksOfProject: "p1", omitProjectSources: "p1" });
    expect(list.map((o) => o.label)).toEqual(["Кабинет · Блок «Активные»", "Кабинет · Блок «Долги»", "Трекер"]);
  });

  it("never offers the reader itself nor a block that reads it — no loop can be picked", () => {
    const ps = projects(undefined, blockRefId("p1", "v1", "A")); // B reads A
    const forA = sourceCatalogue(ps, { reader: blockRefId("p1", "v1", "A") }).map((o) => o.value);
    expect(forA).not.toContain("p1::block:v1:A");
    expect(forA).not.toContain("p1::block:v1:B");
    const forB = sourceCatalogue(ps, { reader: blockRefId("p1", "v1", "B") }).map((o) => o.value);
    expect(forB).toContain("p1::block:v1:A");
  });
});

describe("blockReadCycle — the loop guard", () => {
  const A = blockRefId("p1", "v1", "A");
  const B = blockRefId("p1", "v1", "B");

  it("A reads B reads A is a loop from either side; a one-way read is not", () => {
    const loop = projects(B, A);
    expect(blockReadCycle(loop, A, B)).toBe(true);
    expect(blockReadCycle(loop, B, A)).toBe(true);
    const oneWay = projects(B, undefined);
    expect(blockReadCycle(oneWay, A, B)).toBe(false);
  });

  it("a block reading itself, or a target sitting in a loop of its own, is refused", () => {
    expect(blockReadCycle(projects(A, undefined), undefined, A)).toBe(true);
    // A chart (C) reading A while A ↔ B loop.
    expect(blockReadCycle(projects(B, A), blockRefId("p1", "v1", "C"), A)).toBe(true);
  });

  it("a missing block or a plain project ends the walk", () => {
    expect(blockReadCycle(projects(), A, "p2")).toBe(false);
    expect(blockReadCycle(projects(), A, blockRefId("p1", "v1", "gone"))).toBe(false);
  });

  it("writes are safe only while the chain stays in the project", () => {
    expect(blockRecordsProject(projects(), A)).toBe("p1");
    expect(blockRecordsProject(projects("p2"), A)).toBeUndefined();
    expect(blockRecordsProject(projects(undefined, A), B)).toBe("p1");
    expect(blockRecordsProject(projects(B, A), A)).toBeUndefined(); // a loop is never writable
  });
});

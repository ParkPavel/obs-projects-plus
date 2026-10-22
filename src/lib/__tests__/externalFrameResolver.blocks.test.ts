/**
 * i3-data — a block as a base (static resolution), block loops, multi-level
 * rollups with a depth/loop guard, and formula properties in external frames.
 */
import { resolveExternalFrame, SourceCycleError } from "../externalFrameResolver";

jest.mock("src/lib/datasources/folder/datasource", () => ({ FolderDataSource: jest.fn() }));
jest.mock("src/lib/datasources/tag/datasource", () => ({ TagDataSource: jest.fn() }));
jest.mock("src/lib/datasources/dataview/datasource", () => ({ DataviewDataSource: jest.fn() }));
const { FolderDataSource } = require("src/lib/datasources/folder/datasource");

const field = (name: string, type: string) => ({ name, type, repeated: type === "list", identifier: false, derived: false });
const deps = (projects: unknown[]) => ({ fileSystem: {}, preferences: {}, projects, dataviewApi: undefined, app: undefined }) as never;
const project = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, dataSource: { kind: "folder", config: { path: id } }, views: [], ...extra });

let frames: Record<string, unknown> = {};
let queries: string[] = [];
beforeEach(() => {
  queries = [];
  (FolderDataSource as jest.Mock).mockImplementation((_fs: unknown, p: { id: string }) => ({
    queryAll: async () => { queries.push(p.id); return frames[p.id]; },
  }));
});

describe("a database-call block as a base", () => {
  const clients = {
    fields: [field("status", "string"), field("debt", "number")],
    records: [
      { id: "C/Anna.md", values: { status: "active", debt: 100 } },
      { id: "C/Boris.md", values: { status: "active", debt: 0 } },
      { id: "C/Vera.md", values: { status: "archived", debt: 50 } },
    ],
  };
  const dashboard = (widgets: unknown[], filter = { conditions: [] }) => ({
    id: "v1", name: "Обзор", type: "dashboard", filter, config: { widgets },
  });
  const cond = (field: string, operator: string, value: string) => ({ field, operator, value, enabled: true });

  it("reads the dashboard's frame narrowed by the view filter and the block's own filter", async () => {
    frames = { p: clients };
    const p = project("p", { views: [dashboard(
      [{ id: "A", type: "database-call", title: "Долги", config: { subFilter: { conjunction: "and", conditions: [cond("debt", "gt", "0")] } } }],
      { conditions: [cond("status", "is", "active")] } as never,
    )] });
    const out = await resolveExternalFrame("p::block:v1:A", deps([p]));
    expect(out?.records.map((r) => r.id)).toEqual(["C/Anna.md"]);
  });

  it("a gone block is no base; a loop of blocks is an error, not a hang", async () => {
    frames = { p: clients };
    const loop = project("p", { views: [dashboard([
      { id: "A", type: "database-call", title: "A", config: {}, sourceConfig: { projectId: "p::block:v1:B" } },
      { id: "B", type: "database-call", title: "B", config: {}, sourceConfig: { projectId: "p::block:v1:A" } },
    ])] });
    expect(await resolveExternalFrame("p::block:v1:gone", deps([loop]))).toBeNull();
    await expect(resolveExternalFrame("p::block:v1:A", deps([loop]))).rejects.toBeInstanceOf(SourceCycleError);
  });

  it("a relation into a filtered block of the same project resolves its target to the filtered rows", async () => {
    frames = { p: clients };
    const p = project("p", {
      fieldConfig: { referrer: { relation: { targetProjectId: "p::block:v1:A" } } },
      views: [dashboard([{ id: "A", type: "database-call", title: "Активные", config: { subFilter: { conjunction: "and", conditions: [cond("status", "is", "active")] } } }])],
    });
    const out = await resolveExternalFrame("p::block:v1:A", deps([p]));
    expect(out?.records.map((r) => r.id)).toEqual(["C/Anna.md", "C/Boris.md"]);
  });

  it("i3-close: a block whose pipeline joins another project reads that project as its right side", async () => {
    frames = {
      p: clients,
      tariffs: { fields: [field("status", "string"), field("rate", "number")], records: [{ id: "T/a.md", values: { status: "active", rate: 7 } }] },
    };
    const p = project("p", { views: [dashboard([{
      id: "A", type: "database-call", title: "С тарифом", config: {},
      transform: { steps: [{ type: "join", rightSourceId: "tariffs", on: { leftKey: "status", rightKey: "status" }, how: "inner" }] },
    }])] });
    const out = await resolveExternalFrame("p::block:v1:A", deps([p, project("tariffs")]));
    // An inner join on status: the two active clients match the one tariff.
    expect(out?.records).toHaveLength(2);
    expect(queries).toContain("tariffs");
  });
});

describe("multi-level rollups", () => {
  const tasks = { fields: [field("hours", "number")], records: [
    { id: "T/T1.md", values: { hours: 2 } }, { id: "T/T2.md", values: { hours: 3 } }, { id: "T/T3.md", values: { hours: 5 } },
  ] };
  const stages = { fields: [field("tasks", "list")], records: [
    { id: "S/S1.md", values: { tasks: ["[[T1]]", "[[T2]]"] } }, { id: "S/S2.md", values: { tasks: ["[[T3]]"] } },
  ] };
  const plans = { fields: [field("stages", "list")], records: [{ id: "P/Plan.md", values: { stages: ["[[S1]]", "[[S2]]"] } }] };
  const stageCfg = {
    tasks: { relation: { targetProjectId: "tasks" } },
    stageHours: { rollup: { relationField: "tasks", targetField: "hours", function: "sum" } },
  };
  const planCfg = {
    stages: { relation: { targetProjectId: "stages" } },
    planHours: { rollup: { relationField: "stages", targetField: "stageHours", function: "sum" } },
  };

  it("a rollup of a rollup computes, each project queried once", async () => {
    frames = { tasks, stages, plans };
    const ps = [project("tasks"), project("stages", { fieldConfig: stageCfg }), project("plans", { fieldConfig: planCfg })];
    const out = await resolveExternalFrame("plans", deps(ps));
    expect(out?.records[0]?.values["planHours"]).toBe(10);
    expect(queries.sort()).toEqual(["plans", "stages", "tasks"]);
  });

  it("two projects rolling each other up terminate", async () => {
    frames = {
      a: { fields: [field("b", "list"), field("n", "number")], records: [{ id: "A/a1.md", values: { b: ["[[b1]]"], n: 1 } }] },
      b: { fields: [field("a", "list"), field("m", "number")], records: [{ id: "B/b1.md", values: { a: ["[[a1]]"], m: 2 } }] },
    };
    const ps = [
      project("a", { fieldConfig: { b: { relation: { targetProjectId: "b" } }, fromB: { rollup: { relationField: "b", targetField: "fromA", function: "sum" } } } }),
      project("b", { fieldConfig: { a: { relation: { targetProjectId: "a" } }, fromA: { rollup: { relationField: "a", targetField: "n", function: "sum" } } } }),
    ];
    const out = await resolveExternalFrame("a", deps(ps));
    expect(out?.records[0]?.values["fromB"]).toBe(1);
  });
});

it("a formula property is computed in an external frame, after its rollups", async () => {
  frames = { p: { fields: [field("price", "number"), field("qty", "number")], records: [{ id: "x.md", values: { price: 10, qty: 3 } }] } };
  const p = project("p", { fieldConfig: { total: { formula: "price * qty", type: "formula" } } });
  const out = await resolveExternalFrame("p", deps([p]));
  expect(out?.records[0]?.values["total"]).toBe(30);
});

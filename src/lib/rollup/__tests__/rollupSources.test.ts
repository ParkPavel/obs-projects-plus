import {
  applyRollupSource,
  rollupFunctionIsPositional,
  rollupSourceProjectId,
  rollupSourceValue,
  rollupSources,
} from "src/lib/rollup/rollupSources";
import type { RollupFieldConfig } from "src/settings/base/settings";

const projects = [
  { id: "clients", name: "Клиенты", fieldConfig: { referrer: { relation: { targetProjectId: "clients" } } } },
  { id: "visits", name: "Визиты", fieldConfig: { client: { relation: { targetProjectId: "clients" } }, room: {} } },
  { id: "finance", name: "Финансы", fieldConfig: { source: { relation: { targetProjectId: "visits" } } } },
];

describe("rollupSources", () => {
  const sources = rollupSources(["tasks"], projects, "clients");

  test("this project's relation fields come first, as forward sources", () => {
    expect(sources[0]).toMatchObject({ kind: "forward", relationField: "tasks" });
  });

  test("every relation pointing here, in any project, is a backlink source", () => {
    const back = sources.filter((s) => s.kind === "backlink").map((s) => s.kind === "backlink" && `${s.projectId}.${s.relationField}`);
    expect(back).toEqual(["clients.referrer", "visits.client"]);
  });

  test("relations pointing elsewhere are not offered", () => {
    expect(sources.some((s) => s.kind === "backlink" && s.projectId === "finance")).toBe(false);
  });

  test("no current project, no backlinks", () => {
    expect(rollupSources([], projects, "").length).toBe(0);
  });
});

describe("picking a source", () => {
  const forward: RollupFieldConfig = { relationField: "tasks", targetField: "hours", function: "sum" };

  test("a backlink replaces the forward relation and keeps field and function", () => {
    const [back] = rollupSources([], projects, "clients").filter((s) => s.kind === "backlink" && s.projectId === "visits");
    const next = applyRollupSource(forward, back!.value)!;
    expect(next).toEqual({ relationField: "", targetField: "hours", function: "sum", backlink: { projectId: "visits", relationField: "client" } });
    expect(rollupSourceValue(next)).toBe(back!.value);
  });

  test("a forward relation replaces a backlink", () => {
    const back: RollupFieldConfig = { ...forward, relationField: "", backlink: { projectId: "visits", relationField: "client" } };
    const [tasks] = rollupSources(["tasks"], projects, "clients");
    const next = applyRollupSource(back, tasks!.value)!;
    expect(next.backlink).toBeUndefined();
    expect(next.relationField).toBe("tasks");
  });

  test("a relation named like a backlink value stays a forward source (blui-review)", () => {
    const tricky = 'backlink:["visits","client"]';
    const [src] = rollupSources([tricky], projects, "clients");
    const next = applyRollupSource(forward, src!.value)!;
    expect(next.backlink).toBeUndefined();
    expect(next.relationField).toBe(tricky);
    expect(rollupSourceValue(next)).toBe(src!.value);
  });

  test("every forward source round-trips through the picker value", () => {
    for (const name of ["tasks", "a:b", '"q"', "backlink:x"]) {
      const [src] = rollupSources([name], [], "");
      expect(rollupSourceValue(applyRollupSource(undefined, src!.value)!)).toBe(src!.value);
    }
  });

  test("an empty pick clears the rollup", () => {
    expect(applyRollupSource(forward, "")).toBeNull();
  });

  test("the source project: backlink project, or the relation's target", () => {
    const back: RollupFieldConfig = { ...forward, relationField: "", backlink: { projectId: "visits", relationField: "client" } };
    expect(rollupSourceProjectId(back, () => "ignored")).toBe("visits");
    expect(rollupSourceProjectId(forward, (f) => (f === "tasks" ? "tasks-project" : undefined))).toBe("tasks-project");
  });

  test("first and last value depend on order", () => {
    expect(rollupFunctionIsPositional("last_value")).toBe(true);
    expect(rollupFunctionIsPositional("sum")).toBe(false);
  });
});

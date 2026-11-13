import { baseRefId, baseRefOptions, parseBaseRef } from "../baseRef";

it("D19: a target is a project or one of its sources; old ids read as before", () => {
  expect(parseBaseRef("p1")).toEqual({ projectId: "p1" });
  expect(parseBaseRef("p1::s2")).toEqual({ projectId: "p1", sourceId: "s2" });
  expect(baseRefId({ projectId: "p1", sourceId: "s2" })).toBe("p1::s2");
  const projects = [{
    id: "p1", name: "Кабинет",
    dataSource: { kind: "folder", id: "main", config: { path: "К" } },
    additionalSources: [
      { kind: "derived", id: "s2", name: "Активные клиенты", config: { from: "project", where: { conjunction: "and", conditions: [] } } },
      { kind: "folder", config: { path: "Без id" } },
    ],
  }] as never;
  expect(baseRefOptions(projects).map((o) => [o.value, o.label])).toEqual([
    ["p1", "Кабинет"],
    ["p1::s2", "Кабинет · Активные клиенты"],
  ]);
});

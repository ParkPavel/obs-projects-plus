// crossSubBase.test.ts — R5-010 bidirectional relation resolution tests.

import {
  buildParentIndex,
  resolveTargets,
  resolveAcrossSubBases,
  resolveInverseAcrossSubBases,
} from "./crossSubBase";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import type { SubBaseDefinition } from "src/lib/database/subBase";
import { EMPTY_FILTER } from "src/lib/database/subBase";
import type { FilterDefinition } from "src/settings/base/settings";

// ── Helpers ────────────────────────────────────────────────

function makeRecord(id: string, values: Record<string, unknown> = {}): DataRecord {
  return { id, values: { name: id, ...values } };
}

function makeFrame(records: DataRecord[]): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: true, derived: false },
      { name: "project", type: DataFieldType.Relation, repeated: false, identifier: false, derived: false },
      { name: "tasks", type: DataFieldType.Relation, repeated: false, identifier: false, derived: false },
    ],
    records,
  };
}

function makeSubBase(id: string, filterField?: string, filterValue?: string): SubBaseDefinition {
  const filter: FilterDefinition = filterField
    ? {
        conjunction: "and",
        conditions: [{
          field: filterField,
          operator: "is",
          value: filterValue ?? "",
          enabled: true,
        }],
      }
    : EMPTY_FILTER;

  return {
    id,
    name: id,
    filter,
    sort: { criteria: [] },
    inheritColumns: true,
    columnIds: [],
  };
}

// ── buildParentIndex ───────────────────────────────────────

describe("buildParentIndex", () => {
  test("indexes by basename (without extension)", () => {
    const frame = makeFrame([makeRecord("vault/Tasks/Task A.md")]);
    const idx = buildParentIndex(frame);
    expect(idx.has("task a")).toBe(true);
  });

  test("indexes by name field", () => {
    const r = makeRecord("vault/r1.md", { name: "Custom Name" });
    const frame = makeFrame([r]);
    const idx = buildParentIndex(frame);
    expect(idx.get("custom name")).toBe(r);
  });
});

// ── resolveTargets ─────────────────────────────────────────

describe("resolveTargets", () => {
  const r1 = makeRecord("proj/Alpha.md");
  const r2 = makeRecord("proj/Beta.md");
  const frame = makeFrame([r1, r2]);

  test("resolves wikilink by basename", () => {
    const idx = buildParentIndex(frame);
    const results = resolveTargets("[[Alpha]]", idx);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe(r1);
  });

  test("resolves list of wikilinks", () => {
    const idx = buildParentIndex(frame);
    const results = resolveTargets(["[[Alpha]]", "[[Beta]]"], idx);
    expect(results).toHaveLength(2);
  });

  test("returns empty for unknown target", () => {
    const idx = buildParentIndex(frame);
    expect(resolveTargets("[[Unknown]]", idx)).toHaveLength(0);
  });

  test("returns empty for null", () => {
    const idx = buildParentIndex(frame);
    expect(resolveTargets(null, idx)).toHaveLength(0);
  });
});

// ── resolveAcrossSubBases (forward) ───────────────────────

describe("resolveAcrossSubBases", () => {
  const taskA = makeRecord("proj/TaskA.md", { type: "bug" });
  const taskB = makeRecord("proj/TaskB.md", { type: "feature" });
  const frame = makeFrame([taskA, taskB]);

  const subBugs = makeSubBase("bugs", "type", "bug");
  const subFeatures = makeSubBase("features", "type", "feature");

  test("partitions resolved targets by subBase filter", () => {
    const results = resolveAcrossSubBases(
      ["[[TaskA]]", "[[TaskB]]"],
      frame,
      [subBugs, subFeatures]
    );
    expect(results).toHaveLength(2);
    const bugs = results.find((r) => r.subBaseId === "bugs");
    const features = results.find((r) => r.subBaseId === "features");
    expect(bugs?.targets).toHaveLength(1);
    expect(features?.targets).toHaveLength(1);
  });

  test("returns empty targets for unresolved links", () => {
    const results = resolveAcrossSubBases("[[Unknown]]", frame, [subBugs]);
    expect(results[0]?.targets).toHaveLength(0);
  });
});

// ── resolveInverseAcrossSubBases (R5-010) ─────────────────

describe("resolveInverseAcrossSubBases", () => {
  // Setup: Project has tasks. Each task has a "project" relation field.
  // We want to find all tasks (sources) that reference a given project (target).
  const projectA = makeRecord("proj/ProjectA.md");
  const task1 = makeRecord("proj/Task1.md", { project: "[[ProjectA]]", type: "bug" });
  const task2 = makeRecord("proj/Task2.md", { project: "[[ProjectA]]", type: "feature" });
  const task3 = makeRecord("proj/Task3.md", { project: "[[OtherProject]]", type: "bug" });

  const frame = makeFrame([task1, task2, task3]);
  const subBugs = makeSubBase("bugs", "type", "bug");
  const subFeatures = makeSubBase("features", "type", "feature");

  test("finds all tasks referencing the target project", () => {
    const results = resolveInverseAcrossSubBases(
      projectA,
      "project",
      frame,
      [subBugs, subFeatures]
    );
    const bugs = results.find((r) => r.subBaseId === "bugs");
    const features = results.find((r) => r.subBaseId === "features");
    // task1 is bug, task2 is feature — both reference ProjectA
    expect(bugs?.targets).toHaveLength(1);
    expect(bugs?.targets[0]).toBe(task1);
    expect(features?.targets).toHaveLength(1);
    expect(features?.targets[0]).toBe(task2);
  });

  test("excludes records not referencing the target", () => {
    // task3 references OtherProject — should NOT appear
    const results = resolveInverseAcrossSubBases(
      projectA,
      "project",
      frame,
      [subBugs]
    );
    const bugs = results.find((r) => r.subBaseId === "bugs");
    const ids = bugs?.targets.map((t) => t.id);
    expect(ids).not.toContain(task3.id);
  });

  test("returns empty arrays when no sources reference the target", () => {
    const isolatedProject = makeRecord("proj/Isolated.md");
    const results = resolveInverseAcrossSubBases(
      isolatedProject,
      "project",
      frame,
      [subBugs, subFeatures]
    );
    for (const r of results) {
      expect(r.targets).toHaveLength(0);
    }
  });

  test("resolves by target name field (not only basename)", () => {
    const namedProject = makeRecord("proj/Named.md", { name: "MyProject" });
    const taskRef = makeRecord("proj/TaskRef.md", { project: "[[MyProject]]" });
    const testFrame = makeFrame([taskRef]);
    const results = resolveInverseAcrossSubBases(
      namedProject,
      "project",
      testFrame,
      [makeSubBase("all")]
    );
    expect(results[0]?.targets).toHaveLength(1);
  });
});

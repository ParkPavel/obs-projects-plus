/**
 * #141 — rollup configured through the UI never computed.
 *
 * The first two cases are the regressions the ticket asks for: a cross-project
 * rollup with no stored `targetProjectId` (the only shape any modal can
 * produce), and a rollup whose relation points back at the current project.
 * Both returned an untouched frame before this module existed.
 */
import { describe, expect, it } from "@jest/globals";

import { DataFieldType, type DataFrame } from "src/lib/dataframe/dataframe";

import { applyRollupColumns, resolveRollupTargetProjectId } from "./rollupColumns";
import type { FieldConfigRelationMap } from "./viewHelpers";

const field = (name: string, type: DataFieldType, repeated = false) => ({
  name,
  type,
  identifier: name === "name",
  derived: false,
  repeated,
  typeConfig: {},
});

/** Clients — carries the relation to sessions and the rollup over them. */
const clients = (): DataFrame => ({
  fields: [
    field("name", DataFieldType.String),
    field("sessions", DataFieldType.Relation, true),
  ],
  records: [
    { id: "Clients/Ivan.md", values: { name: "Ivan", sessions: ["[[S1]]", "[[S2]]"] } },
    { id: "Clients/Anna.md", values: { name: "Anna", sessions: ["[[S3]]"] } },
  ],
});

const sessions = (): DataFrame => ({
  fields: [field("name", DataFieldType.String), field("pain", DataFieldType.Number)],
  records: [
    { id: "S1.md", values: { name: "S1", pain: 6 } },
    { id: "S2.md", values: { name: "S2", pain: 4 } },
    { id: "S3.md", values: { name: "S3", pain: 8 } },
  ],
});

describe("resolveRollupTargetProjectId", () => {
  it("falls back to the target of the relation the rollup names", () => {
    const fieldConfig: FieldConfigRelationMap = {
      sessions: { relation: { targetProjectId: "p-sessions" } },
      "Number of sessions": {
        rollup: { relationField: "sessions", targetField: "name", function: "count" },
      },
    };
    expect(
      resolveRollupTargetProjectId(
        fieldConfig["Number of sessions"]!.rollup!,
        fieldConfig
      )
    ).toBe("p-sessions");
  });

  it("ignores a stored targetProjectId that disagrees with the relation", () => {
    // Cross-model review, 2026-08-27: honouring the stored id looked free
    // because no code ever wrote one. It is not — a hand-edited id pointing
    // elsewhere resolves the relation's WikiLinks against a different project,
    // where basename matching yields a plausible, wrong number and no error.
    const fieldConfig: FieldConfigRelationMap = {
      sessions: { relation: { targetProjectId: "p-sessions" } },
      rolled: {
        rollup: {
          relationField: "sessions",
          targetField: "name",
          function: "count",
          targetProjectId: "p-somewhere-else",
        },
      },
    };
    expect(resolveRollupTargetProjectId(fieldConfig["rolled"]!.rollup!, fieldConfig)).toBe(
      "p-sessions"
    );
  });

  it("returns undefined when the named relation has no target", () => {
    const fieldConfig: FieldConfigRelationMap = {
      rolled: { rollup: { relationField: "missing", targetField: "name", function: "count" } },
    };
    expect(
      resolveRollupTargetProjectId(fieldConfig["rolled"]!.rollup!, fieldConfig)
    ).toBeUndefined();
  });
});

describe("applyRollupColumns", () => {
  it("computes a cross-project rollup that stores no targetProjectId", () => {
    const fieldConfig: FieldConfigRelationMap = {
      sessions: { relation: { targetProjectId: "p-sessions" } },
      "Number of sessions": {
        rollup: { relationField: "sessions", targetField: "name", function: "count" },
      },
    };
    const out = applyRollupColumns(
      clients(),
      fieldConfig,
      "p-clients",
      new Map([["p-sessions", sessions()]])
    );
    expect(out.records[0]!.values["Number of sessions"]).toBe(2);
    expect(out.records[1]!.values["Number of sessions"]).toBe(1);
  });

  it("aggregates a numeric target field, not only counts", () => {
    const fieldConfig: FieldConfigRelationMap = {
      sessions: { relation: { targetProjectId: "p-sessions" } },
      "Total pain": {
        rollup: { relationField: "sessions", targetField: "pain", function: "sum" },
      },
    };
    const out = applyRollupColumns(
      clients(),
      fieldConfig,
      "p-clients",
      new Map([["p-sessions", sessions()]])
    );
    expect(out.records[0]!.values["Total pain"]).toBe(10);
    expect(out.records[1]!.values["Total pain"]).toBe(8);
  });

  it("computes a rollup whose relation points back at the current project", () => {
    // Self-relation: `extractRelationTargetIds` excludes it from the fetch set,
    // so the external map is empty and the current frame is the target.
    const tasks: DataFrame = {
      fields: [
        field("name", DataFieldType.String),
        field("blocks", DataFieldType.Relation, true),
        field("estimate", DataFieldType.Number),
      ],
      records: [
        { id: "T1.md", values: { name: "T1", blocks: ["[[T2]]", "[[T3]]"], estimate: 1 } },
        { id: "T2.md", values: { name: "T2", blocks: [], estimate: 3 } },
        { id: "T3.md", values: { name: "T3", blocks: [], estimate: 5 } },
      ],
    };
    const fieldConfig: FieldConfigRelationMap = {
      blocks: { relation: { targetProjectId: "p-tasks" } },
      "Blocked estimate": {
        rollup: { relationField: "blocks", targetField: "estimate", function: "sum" },
      },
    };
    const out = applyRollupColumns(tasks, fieldConfig, "p-tasks", new Map());
    expect(out.records[0]!.values["Blocked estimate"]).toBe(8);
    expect(out.records[1]!.values["Blocked estimate"]).toBe(0);
  });

  it("leaves the frame untouched when the rollup cannot be resolved", () => {
    const fieldConfig: FieldConfigRelationMap = {
      orphan: { rollup: { relationField: "nope", targetField: "name", function: "count" } },
    };
    const input = clients();
    expect(applyRollupColumns(input, fieldConfig, "p-clients", new Map())).toBe(input);
  });

  it("does not depend on the key order of fieldConfig", () => {
    // The real order hazard: `FieldConfig` allows a relation and a rollup on
    // the SAME field, so one rollup can overwrite the WikiLink another one
    // resolves through. The old inline loop passed the progressively-mutated
    // frame along and therefore depended on key order; this reads a snapshot.
    const tasks: DataFrame = {
      fields: [
        field("name", DataFieldType.String),
        field("blocks", DataFieldType.Relation, true),
        field("estimate", DataFieldType.Number),
      ],
      records: [
        { id: "T1.md", values: { name: "T1", blocks: ["[[T2]]", "[[T3]]"], estimate: 1 } },
        { id: "T2.md", values: { name: "T2", blocks: [], estimate: 3 } },
        { id: "T3.md", values: { name: "T3", blocks: [], estimate: 5 } },
      ],
    };
    // `blocks` carries BOTH the relation and a rollup that overwrites it, and
    // `Blocked estimate` resolves through the very same field.
    const base: FieldConfigRelationMap = {
      blocks: {
        relation: { targetProjectId: "p-tasks" },
        rollup: { relationField: "blocks", targetField: "estimate", function: "count" },
      },
      "Blocked estimate": {
        rollup: { relationField: "blocks", targetField: "estimate", function: "sum" },
      },
    };
    const reversed: FieldConfigRelationMap = {
      "Blocked estimate": base["Blocked estimate"],
      blocks: base["blocks"],
    };

    const a = applyRollupColumns(tasks, base, "p-tasks", new Map());
    const b = applyRollupColumns(tasks, reversed, "p-tasks", new Map());

    expect(b.records.map((r) => r.values)).toEqual(a.records.map((r) => r.values));
    // Both rollups resolved the links the user wrote, not each other's output.
    expect(a.records[0]!.values["Blocked estimate"]).toBe(8);
    expect(a.records[0]!.values["blocks"]).toBe(2);
  });
});

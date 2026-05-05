// Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.1 — round-trips a FieldConfig
// through declaration + spread + delete to lock the contract for the new
// optional `relation` and `rollup` keys against `exactOptionalPropertyTypes`.

import type {
  FieldConfig,
  RelationFieldConfig,
  RollupFieldConfig,
} from "../base/settings";

describe("FieldConfig — relation + rollup (Stage A / M0.1)", () => {
  it("accepts a config with neither key (backward compatibility)", () => {
    const fc: FieldConfig = {};
    expect(fc).toEqual({});
    expect(fc.relation).toBeUndefined();
    expect(fc.rollup).toBeUndefined();
  });

  it("accepts a config with only legacy keys (StringFieldConfig)", () => {
    const fc: FieldConfig = { options: ["a", "b"], richText: true };
    expect(fc.options).toEqual(["a", "b"]);
    expect(fc.richText).toBe(true);
    expect(fc.relation).toBeUndefined();
  });

  it("accepts a config with only legacy keys (DateFieldConfig)", () => {
    const fc: FieldConfig = { time: true };
    expect(fc.time).toBe(true);
    expect(fc.rollup).toBeUndefined();
  });

  it("accepts a config with relation set", () => {
    const relation: RelationFieldConfig = { targetProjectId: "proj-clients" };
    const fc: FieldConfig = { relation };
    expect(fc.relation).toEqual({ targetProjectId: "proj-clients" });
  });

  it("accepts a relation with displayField override", () => {
    const fc: FieldConfig = {
      relation: { targetProjectId: "proj-tasks", displayField: "title" },
    };
    expect(fc.relation?.displayField).toBe("title");
  });

  it("accepts a config with rollup set (sum function)", () => {
    const rollup: RollupFieldConfig = {
      relationField: "linkedTasks",
      targetField: "estimate",
      function: "sum",
    };
    const fc: FieldConfig = { rollup };
    expect(fc.rollup?.function).toBe("sum");
    expect(fc.rollup?.targetProjectId).toBeUndefined();
  });

  it("accepts a rollup with targetProjectId override and separator", () => {
    const fc: FieldConfig = {
      rollup: {
        relationField: "tags",
        targetProjectId: "proj-tags",
        targetField: "name",
        function: "concat_unique",
        separator: " | ",
      },
    };
    expect(fc.rollup?.targetProjectId).toBe("proj-tags");
    expect(fc.rollup?.separator).toBe(" | ");
  });

  it("accepts both relation and rollup on the same field", () => {
    const fc: FieldConfig = {
      relation: { targetProjectId: "proj-clients" },
      rollup: {
        relationField: "client",
        targetField: "revenue",
        function: "avg",
      },
    };
    expect(fc.relation).toBeDefined();
    expect(fc.rollup).toBeDefined();
  });

  it("composes with legacy keys (StringFieldConfig + relation)", () => {
    const fc: FieldConfig = {
      options: ["draft", "active", "done"],
      relation: { targetProjectId: "proj-projects" },
    };
    expect(fc.options).toEqual(["draft", "active", "done"]);
    expect(fc.relation?.targetProjectId).toBe("proj-projects");
  });

  it("supports conditional spread under exactOptionalPropertyTypes", () => {
    // Mental simulation of the §A.1 risk-register R-2 pattern: when a builder
    // conditionally adds `relation`, it must use spread (never explicit
    // `relation: undefined`) because `exactOptionalPropertyTypes: true`.
    const maybeRelation: RelationFieldConfig | undefined =
      Math.random() < 2 ? { targetProjectId: "proj-x" } : undefined;
    const base = { options: ["x"] };
    const fc: FieldConfig = {
      ...base,
      ...(maybeRelation ? { relation: maybeRelation } : {}),
    };
    expect(fc.options).toEqual(["x"]);
    expect(fc.relation).toEqual({ targetProjectId: "proj-x" });
  });

  it("round-trips through JSON serialization (forward-compat with persistence)", () => {
    const fc: FieldConfig = {
      options: ["a"],
      relation: { targetProjectId: "p1", displayField: "name" },
      rollup: {
        relationField: "rel",
        targetField: "amount",
        function: "sum",
      },
    };
    const restored = JSON.parse(JSON.stringify(fc)) as FieldConfig;
    expect(restored).toEqual(fc);
  });

  it("treats unknown extra keys as preserved by JSON round-trip", () => {
    // Simulates an older plugin reading a newer settings blob that contains
    // future keys. The new keys survive serialization untouched.
    const fc = JSON.parse(
      JSON.stringify({
        options: ["a"],
        relation: { targetProjectId: "p", futureKey: 42 },
      })
    ) as FieldConfig;
    expect(fc.relation?.targetProjectId).toBe("p");
  });
});

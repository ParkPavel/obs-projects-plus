/**
 * smartSuggest.test.ts — #059 SmartSuggest rule engine (Vision §6).
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { computeSuggestions } from "../smartSuggest";

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false };
}

/**
 * #155 — a relation that names a target. An unconfigured Relation field cannot
 * produce a linked block, so it no longer produces a suggestion either.
 */
function relationField(name: string, targetProjectId = "p-clients"): DataField {
  return {
    name,
    type: DataFieldType.Relation,
    repeated: false,
    identifier: false,
    derived: false,
    typeConfig: { relation: { targetProjectId } },
  };
}

function widget(type: string, config: Record<string, unknown> = {}) {
  return { type: type as never, config };
}

describe("computeSuggestions (#059)", () => {
  describe("numeric-stats rule", () => {
    it("suggests a Stats block when a numeric field exists and no stats widget does", () => {
      const result = computeSuggestions(
        [field("name", DataFieldType.String), field("price", DataFieldType.Number)],
        [widget("database-call")],
        []
      );
      expect(result).toContainEqual({
        kind: "numeric-stats",
        fieldName: "price",
        widgetType: "stats",
      });
    });

    it("stays silent without a numeric field", () => {
      const result = computeSuggestions(
        [field("name", DataFieldType.String)],
        [],
        []
      );
      expect(result.find((s) => s.kind === "numeric-stats")).toBeUndefined();
    });

    it("stays silent when a stats widget is already on the canvas", () => {
      const result = computeSuggestions(
        [field("price", DataFieldType.Number)],
        [widget("stats")],
        []
      );
      expect(result.find((s) => s.kind === "numeric-stats")).toBeUndefined();
    });

    it("respects a persisted dismissal", () => {
      const result = computeSuggestions(
        [field("price", DataFieldType.Number)],
        [],
        ["numeric-stats"]
      );
      expect(result.find((s) => s.kind === "numeric-stats")).toBeUndefined();
    });

    it("reports the first numeric field by schema order", () => {
      const result = computeSuggestions(
        [field("price", DataFieldType.Number), field("qty", DataFieldType.Number)],
        [],
        []
      );
      expect(result[0]?.fieldName).toBe("price");
    });
  });

  describe("relation-block rule", () => {
    it("suggests a database-call block when a configured relation field exists", () => {
      const result = computeSuggestions([relationField("client")], [], []);
      expect(result).toContainEqual({
        kind: "relation-block",
        fieldName: "client",
        widgetType: "database-call",
        relationTargetProjectId: "p-clients",
      });
    });

    it("stays silent for a relation field with no target (#155)", () => {
      // Accepting this suggestion used to add an EMPTY database-call: the strip
      // promised related records and delivered a blank block, which reads as a
      // broken feature rather than an unconfigured field.
      const result = computeSuggestions(
        [field("client", DataFieldType.Relation)],
        [],
        []
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeUndefined();
    });

    it("stays silent when a linked database-call block already exists", () => {
      const result = computeSuggestions(
        [relationField("client")],
        [
          widget("database-call", {
            linkedSelection: { sourceWidgetId: "w-1", relationField: "client" },
          }),
        ],
        []
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeUndefined();
    });

    it("still suggests when database-call blocks exist but none is linked", () => {
      const result = computeSuggestions(
        [relationField("client")],
        [widget("database-call")],
        []
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeDefined();
    });

    it("respects a persisted dismissal", () => {
      const result = computeSuggestions(
        [relationField("client")],
        [],
        ["relation-block"]
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeUndefined();
    });

    it("includes relationTargetProjectId when relation field has targetProjectId configured", () => {
      const relField: DataField = {
        name: "client",
        type: DataFieldType.Relation,
        repeated: false,
        identifier: false,
        derived: false,
        typeConfig: { relation: { targetProjectId: "proj-sessions" } } as never,
      };
      const result = computeSuggestions([relField], [], []);
      const suggestion = result.find((s) => s.kind === "relation-block");
      expect(suggestion?.relationTargetProjectId).toBe("proj-sessions");
    });

    it("omits relationTargetProjectId when relation field has no typeConfig", () => {
      const result = computeSuggestions([field("client", DataFieldType.Relation)], [], []);
      const suggestion = result.find((s) => s.kind === "relation-block");
      expect(suggestion?.relationTargetProjectId).toBeUndefined();
    });
  });

  it("returns both suggestions ordered numeric-first when both rules fire", () => {
    const result = computeSuggestions(
      [field("price", DataFieldType.Number), relationField("client")],
      [],
      []
    );
    expect(result.map((s) => s.kind)).toEqual(["numeric-stats", "relation-block"]);
  });

  it("returns an empty list for an empty schema", () => {
    expect(computeSuggestions([], [], [])).toEqual([]);
  });
});

/**
 * smartSuggest.test.ts — #059 SmartSuggest rule engine (Vision §6).
 */

import { DataFieldType, type DataField } from "src/lib/dataframe/dataframe";
import { computeSuggestions } from "../smartSuggest";

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false };
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
    it("suggests a database-call block when a relation field exists", () => {
      const result = computeSuggestions(
        [field("client", DataFieldType.Relation)],
        [],
        []
      );
      expect(result).toContainEqual({
        kind: "relation-block",
        fieldName: "client",
        widgetType: "database-call",
      });
    });

    it("stays silent when a linked database-call block already exists", () => {
      const result = computeSuggestions(
        [field("client", DataFieldType.Relation)],
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
        [field("client", DataFieldType.Relation)],
        [widget("database-call")],
        []
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeDefined();
    });

    it("respects a persisted dismissal", () => {
      const result = computeSuggestions(
        [field("client", DataFieldType.Relation)],
        [],
        ["relation-block"]
      );
      expect(result.find((s) => s.kind === "relation-block")).toBeUndefined();
    });
  });

  it("returns both suggestions ordered numeric-first when both rules fire", () => {
    const result = computeSuggestions(
      [field("price", DataFieldType.Number), field("client", DataFieldType.Relation)],
      [],
      []
    );
    expect(result.map((s) => s.kind)).toEqual(["numeric-stats", "relation-block"]);
  });

  it("returns an empty list for an empty schema", () => {
    expect(computeSuggestions([], [], [])).toEqual([]);
  });
});

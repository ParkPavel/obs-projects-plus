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
      // Without a project context only the outgoing link is visible: read the
      // target from the master's side (F3b).
      expect(result).toContainEqual({
        kind: "relation-block",
        fieldName: "client",
        widgetType: "database-call",
        relationTargetProjectId: "p-clients",
        relationWiring: { readProjectId: "p-clients", relationField: "client", relationSide: "master" },
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

  describe("date-chart rule", () => {
    it("suggests a chart when a Date field exists and no chart plots it", () => {
      const result = computeSuggestions(
        [field("name", DataFieldType.String), field("dueDate", DataFieldType.Date)],
        [],
        []
      );
      expect(result).toContainEqual({
        kind: "date-chart",
        fieldName: "dueDate",
        widgetType: "chart",
      });
    });

    it("carries the numeric field for the Y axis when one exists", () => {
      const result = computeSuggestions(
        [field("dueDate", DataFieldType.Date), field("pain", DataFieldType.Number)],
        [],
        []
      );
      expect(result).toContainEqual({
        kind: "date-chart",
        fieldName: "dueDate",
        widgetType: "chart",
        numericFieldName: "pain",
      });
    });

    it("stays silent without a Date field", () => {
      const result = computeSuggestions([field("name", DataFieldType.String)], [], []);
      expect(result.find((s) => s.kind === "date-chart")).toBeUndefined();
    });

    it("stays silent when a chart already plots that field on its X axis", () => {
      const result = computeSuggestions(
        [field("dueDate", DataFieldType.Date)],
        [widget("chart", { xAxis: { property: "dueDate" } })],
        []
      );
      expect(result.find((s) => s.kind === "date-chart")).toBeUndefined();
    });

    it("still suggests when a chart exists but plots a different field", () => {
      const result = computeSuggestions(
        [field("dueDate", DataFieldType.Date)],
        [widget("chart", { xAxis: { property: "status" } })],
        []
      );
      expect(result.find((s) => s.kind === "date-chart")).toBeDefined();
    });

    it("respects a persisted dismissal", () => {
      const result = computeSuggestions(
        [field("dueDate", DataFieldType.Date)],
        [],
        ["date-chart"]
      );
      expect(result.find((s) => s.kind === "date-chart")).toBeUndefined();
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

// ── M2-C7/C8 (architect F1–F3): which project the linked block reads ──────
describe("relation-block wiring with the project context", () => {
  const ctx = (projects: Array<{ id: string; name: string; fieldConfig?: Record<string, { relation?: { targetProjectId?: string } }> }>, host = "p-clients") =>
    ({ hostProjectId: host, projects });

  test("incoming: a project whose field points here is read through that field", () => {
    const r = computeSuggestions([], [], [], ctx([
      { id: "p-clients", name: "Клиенты" },
      { id: "p-sessions", name: "Сеансы", fieldConfig: { client: { relation: { targetProjectId: "p-clients" } } } },
    ]));
    expect(r.find((s) => s.kind === "relation-block")?.relationWiring).toEqual({ readProjectId: "p-sessions", readProjectName: "Сеансы", relationField: "client" });
  });

  test("a relation inside this project reads this project (no source, stays writable)", () => {
    const r = computeSuggestions([], [], [], ctx([{ id: "p-cab", name: "Кабинет", fieldConfig: { client: { relation: { targetProjectId: "p-cab" } } } }], "p-cab"));
    expect(r.find((s) => s.kind === "relation-block")?.relationWiring).toEqual({ relationField: "client" });
  });

  test("outgoing with a field pointing back: read the target through that field", () => {
    const r = computeSuggestions([relationField("client", "p-clients")], [], [], ctx([
      { id: "p-sessions", name: "Сеансы", fieldConfig: { client: { relation: { targetProjectId: "p-clients" } } } },
      { id: "p-clients", name: "Клиенты", fieldConfig: { sessions: { relation: { targetProjectId: "p-sessions" } } } },
    ], "p-sessions"));
    expect(r.find((s) => s.kind === "relation-block")?.relationWiring).toEqual({ readProjectId: "p-clients", readProjectName: "Клиенты", relationField: "sessions" });
  });

  test("outgoing with no way back: read the target from the master's side (F3b)", () => {
    const r = computeSuggestions([relationField("client", "p-clients")], [], [], ctx([
      { id: "p-sessions", name: "Сеансы", fieldConfig: { client: { relation: { targetProjectId: "p-clients" } } } },
      { id: "p-clients", name: "Клиенты" },
    ], "p-sessions"));
    expect(r.find((s) => s.kind === "relation-block")?.relationWiring).toEqual({ readProjectId: "p-clients", readProjectName: "Клиенты", relationField: "client", relationSide: "master" });
  });
});

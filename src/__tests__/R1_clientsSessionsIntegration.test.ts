/**
 * R1_clientsSessionsIntegration.test.ts
 *
 * Ticket #115 — Clients → Sessions end-to-end acceptance.
 *
 * Tests the complete relation chain:
 *   parseRelationLinks / canonicalLinkKey (raw parsing)
 *   enrichFrameWithRelations / enrichFrameWithAllRelations (cross-project resolution)
 *   enrichWithBacklinks (inverse relation metadata)
 *   composeEffectiveFilter (canvas selection → receiver filter)
 *
 * These tests use domain-authentic Clients ↔ Sessions fixture data and do NOT
 * duplicate scenarios already covered by:
 *   src/lib/relations/__tests__/relationContract.test.ts
 *   src/lib/engine/__tests__/crossProjectResolver.test.ts
 *   src/ui/views/Dashboard/__tests__/canvasSelectionStore.test.ts
 */

import { describe, expect, it } from "@jest/globals";

import { DataFieldType, type DataField, type DataFrame } from "src/lib/dataframe/dataframe";
import { parseRelationLinks, canonicalLinkKey } from "src/lib/relations/parseRelationLinks";
import {
  enrichFrameWithRelations,
  enrichFrameWithAllRelations,
  derivedFieldName,
} from "src/lib/engine/crossProjectResolver";
import { enrichWithBacklinks } from "src/lib/dashboard-engine/relationResolver";
import {
  composeEffectiveFilter,
  dataTableSourceId,
  type SelectionState,
} from "src/ui/views/Dashboard/canvasSelectionStore";
import type { LinkedSelectionConfig } from "src/ui/views/Dashboard/types";
import type { DataRecord } from "src/lib/dataframe/dataframe";

// ── Fixture data ───────────────────────────────────────────────────────────

const clientsFrame = (): DataFrame => ({
  fields: [
    {
      name: "name",
      type: DataFieldType.String,
      identifier: true,
      derived: false,
      repeated: false,
      typeConfig: {},
    },
    {
      name: "company",
      type: DataFieldType.String,
      identifier: false,
      derived: false,
      repeated: false,
      typeConfig: {},
    },
  ],
  records: [
    { id: "Clients/Alice.md", values: { name: "Alice", company: "ACME" } },
    { id: "Clients/Bob.md", values: { name: "Bob", company: "Globex" } },
  ],
});

const clientRelationField: DataField = {
  name: "client",
  type: DataFieldType.Relation,
  identifier: false,
  derived: false,
  repeated: false,
  typeConfig: {
    relation: {
      targetProjectId: "clients-project-id",
      displayField: "name",
    },
  },
};

const sessionsFrame = (): DataFrame => ({
  fields: [
    {
      name: "title",
      type: DataFieldType.String,
      identifier: true,
      derived: false,
      repeated: false,
      typeConfig: {},
    },
    {
      name: "date",
      type: DataFieldType.String,
      identifier: false,
      derived: false,
      repeated: false,
      typeConfig: {},
    },
    clientRelationField,
  ],
  records: [
    { id: "Sessions/Session1.md", values: { title: "Session 1", date: "2026-08-01", client: "[[Alice]]" } },
    { id: "Sessions/Session2.md", values: { title: "Session 2", date: "2026-08-15", client: "[[Alice]]" } },
    { id: "Sessions/Session3.md", values: { title: "Session 3", date: "2026-08-20", client: "[[Bob]]" } },
  ],
});

// ── Test 1: WikiLink resolution via parseRelationLinks ─────────────────────

describe("R1 — WikiLink resolution (parseRelationLinks)", () => {
  it('parseRelationLinks("[[Alice]]") returns ["Alice"]', () => {
    expect(parseRelationLinks("[[Alice]]")).toEqual(["Alice"]);
  });

  it('parseRelationLinks("[[People/Alice|Alice]]") returns the canonical path ["People/Alice"] (alias is stripped, not promoted)', () => {
    // The alias "|Alice" is discarded; parseRelationLinks returns the link target path.
    // Alias-based display is handled at render time, not during link parsing.
    expect(parseRelationLinks("[[People/Alice|Alice]]")).toEqual(["People/Alice"]);
  });
});

// ── Test 2: Canonical key disambiguation ──────────────────────────────────

describe("R1 — canonicalLinkKey disambiguation", () => {
  it("canonicalLinkKey('Alice') equals canonicalLinkKey('[[Alice]]')", () => {
    expect(canonicalLinkKey("Alice")).toBe(canonicalLinkKey("[[Alice]]"));
  });
});

// ── Test 3: Cross-project enrichment ──────────────────────────────────────

describe("R1 — enrichFrameWithRelations (cross-project resolution)", () => {
  it("Sessions 1 and 2 resolve to Alice record; Session 3 resolves to Bob", () => {
    const enriched = enrichFrameWithRelations(
      sessionsFrame(),
      "client",
      { targetProjectId: "clients-project-id", displayField: "name" },
      clientsFrame()
    );

    const derivedField = derivedFieldName("client");

    const session1 = enriched.records[0]!;
    const session2 = enriched.records[1]!;
    const session3 = enriched.records[2]!;

    const resolved1 = session1.values[derivedField] as unknown as DataRecord[];
    const resolved2 = session2.values[derivedField] as unknown as DataRecord[];
    const resolved3 = session3.values[derivedField] as unknown as DataRecord[];

    expect(Array.isArray(resolved1)).toBe(true);
    expect(resolved1[0]?.values["name"]).toBe("Alice");

    expect(Array.isArray(resolved2)).toBe(true);
    expect(resolved2[0]?.values["name"]).toBe("Alice");

    expect(Array.isArray(resolved3)).toBe(true);
    expect(resolved3[0]?.values["name"]).toBe("Bob");
  });
});

// ── Test 4: Inverse backlinks — enrichWithBacklinks on a self-referencing frame ─

describe("R1 — inverse backlinks (enrichWithBacklinks / enrichFrameWithAllRelations)", () => {
  it("enrichWithBacklinks on clientsFrame with 'client' field does not crash and returns a DataFrame", () => {
    // enrichWithBacklinks operates on a single frame: it finds records within
    // that frame linking to each other via the named field. Since clientsFrame
    // has no self-referencing 'client' field, backlinks should be empty but
    // the function must not throw.
    const result = enrichWithBacklinks(clientsFrame(), ["client"]);
    expect(result).toBeDefined();
    expect(result.records.length).toBe(clientsFrame().records.length);
  });

  it("enrichFrameWithAllRelations produces __resolved__client on sessions frame", () => {
    const externalFrames = new Map<string, DataFrame>([
      ["clients-project-id", clientsFrame()],
    ]);
    const enriched = enrichFrameWithAllRelations(sessionsFrame(), externalFrames);
    const derivedField = derivedFieldName("client");

    // Derived field registered in schema
    const registeredField = enriched.fields.find((f) => f.name === derivedField);
    expect(registeredField).toBeDefined();
    expect(registeredField?.derived).toBe(true);

    // All three records got enriched
    for (const record of enriched.records) {
      const val = record.values[derivedField];
      expect(val).toBeDefined();
    }
  });
});

// ── Test 5: composeEffectiveFilter with valid linkedSelection ──────────────

describe("R1 — composeEffectiveFilter with valid linkedSelection", () => {
  it("active Alice selection on 'widget-a' produces filter condition on 'client' field", () => {
    // Simulates: Clients block (widget-a) selects Alice → Sessions block (widget-b) should
    // receive filter { field: "client", operator: "is", value: "Alice" }.
    const canvasSelection: SelectionState = {
      source: dataTableSourceId("widget-a"),
      field: "name",
      values: ["Alice"],
      op: "is",
    };
    const linkedSelection: LinkedSelectionConfig = {
      sourceWidgetId: "widget-a",
      relationField: "client",
    };

    const result = composeEffectiveFilter({
      userFilters: [],
      selection: canvasSelection,
      myWidgetId: "widget-b",
      linkedSelection,
      validationResult: "valid",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      field: "client",
      operator: "is",
      value: "Alice",
      enabled: true,
    });
  });
});

// ── Test 6: Invalid validationResult skips linked filter ──────────────────

describe("R1 — composeEffectiveFilter skips linked filter when validationResult is not valid", () => {
  it("validationResult='missing-relation' → linked condition not applied on the relation field", () => {
    const canvasSelection: SelectionState = {
      source: dataTableSourceId("widget-a"),
      field: "name",
      values: ["Alice"],
      op: "is",
    };
    const linkedSelection: LinkedSelectionConfig = {
      sourceWidgetId: "widget-a",
      relationField: "client",
    };

    const result = composeEffectiveFilter({
      userFilters: [],
      selection: canvasSelection,
      myWidgetId: "widget-b",
      linkedSelection,
      validationResult: "missing-relation",
    });

    // The linked condition on the "client" field must NOT be applied.
    // The canvas-selection fallback fires instead (uses selection.field = "name").
    const clientCondition = result.find((c) => c.field === "client");
    expect(clientCondition).toBeUndefined();
  });

  it("validationResult=undefined (absent) → linked condition not applied", () => {
    const canvasSelection: SelectionState = {
      source: dataTableSourceId("widget-a"),
      field: "name",
      values: ["Alice"],
      op: "is",
    };
    const linkedSelection: LinkedSelectionConfig = {
      sourceWidgetId: "widget-a",
      relationField: "client",
    };

    const result = composeEffectiveFilter({
      userFilters: [],
      selection: canvasSelection,
      myWidgetId: "widget-b",
      linkedSelection,
      // validationResult deliberately omitted
    });

    const clientCondition = result.find((c) => c.field === "client");
    expect(clientCondition).toBeUndefined();
  });
});

// ── Test 7: Count rollup via resolved field ────────────────────────────────

describe("R1 — count rollup via __resolved__client derived field", () => {
  it("Alice has 2 resolved sessions; Bob has 1 resolved session", () => {
    const enriched = enrichFrameWithRelations(
      sessionsFrame(),
      "client",
      { targetProjectId: "clients-project-id", displayField: "name" },
      clientsFrame()
    );

    const derivedField = derivedFieldName("client");

    // Collect all resolved targets across sessions
    const aliceCount = enriched.records.filter((record) => {
      const resolved = record.values[derivedField] as unknown as DataRecord[] | undefined;
      return Array.isArray(resolved) && resolved.some((r) => r.values["name"] === "Alice");
    }).length;

    const bobCount = enriched.records.filter((record) => {
      const resolved = record.values[derivedField] as unknown as DataRecord[] | undefined;
      return Array.isArray(resolved) && resolved.some((r) => r.values["name"] === "Bob");
    }).length;

    expect(aliceCount).toBe(2); // Session 1 + Session 2
    expect(bobCount).toBe(1);   // Session 3 only
  });
});

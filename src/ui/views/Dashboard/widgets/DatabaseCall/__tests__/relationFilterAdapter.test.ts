/**
 * relationFilterAdapter.test.ts — #106 Selection Bus Scenario A fix.
 *
 * Covers the linked-selection filter path: Relation fields normalise both
 * sides to the canonical relation key (wikilink/alias/case insensitive),
 * non-Relation fields pass through to `matchesCondition` unchanged (preserving
 * Select/Status case-sensitivity and Scenario B parity).
 */

import {
  DataFieldType,
  type DataField,
  type DataRecord,
  type DataValue,
  type Optional,
} from "src/lib/dataframe/dataframe";
import type { FilterCondition } from "src/settings/settings";
import { filterByLinkedSelection } from "../relationFilterAdapter";

function field(name: string, type: DataFieldType): DataField {
  return { name, type, repeated: false, identifier: false, derived: false };
}

function rec(id: string, values: Record<string, Optional<DataValue>>): DataRecord {
  return { id, values };
}

const clientField = field("client", DataFieldType.Relation);
const statusField = field("status", DataFieldType.Status);

function isCond(fieldName: string, value: string): FilterCondition {
  return { field: fieldName, operator: "is", value, enabled: true };
}

function isAnyOfCond(fieldName: string, values: string[]): FilterCondition {
  return { field: fieldName, operator: "is-any-of", value: JSON.stringify(values), enabled: true };
}

describe("filterByLinkedSelection — Relation field", () => {
  test("matches a wikilink string cell against a bare selection value (Scenario A)", () => {
    const records = [
      rec("r1", { client: "[[Acme Studio]]" }),
      rec("r2", { client: "[[Beta Co]]" }),
    ];
    const out = filterByLinkedSelection(records, isCond("client", "Acme Studio"), [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("matches an array-of-wikilinks cell", () => {
    const records = [
      rec("r1", { client: ["[[Acme Studio]]", "[[Other]]"] }),
      rec("r2", { client: ["[[Beta Co]]"] }),
    ];
    const out = filterByLinkedSelection(records, isCond("client", "Acme Studio"), [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("is alias-aware: [[Acme Studio|Acme]] matches selection 'Acme Studio'", () => {
    const records = [rec("r1", { client: "[[Acme Studio|Acme]]" })];
    const out = filterByLinkedSelection(records, isCond("client", "Acme Studio"), [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("is case-insensitive on the relation key", () => {
    const records = [rec("r1", { client: "[[acme studio]]" })];
    const out = filterByLinkedSelection(records, isCond("client", "ACME STUDIO"), [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("is-any-of matches any of several selected clients", () => {
    const records = [
      rec("r1", { client: "[[Acme Studio]]" }),
      rec("r2", { client: "[[Beta Co]]" }),
      rec("r3", { client: "[[Gamma]]" }),
    ];
    const cond = isAnyOfCond("client", ["Acme Studio", "Gamma"]);
    const out = filterByLinkedSelection(records, cond, [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  test("empty / missing relation cell does not match", () => {
    const records = [
      rec("r1", { client: undefined }),
      rec("r2", { client: "" }),
      rec("r3", {}),
    ];
    const out = filterByLinkedSelection(records, isCond("client", "Acme Studio"), [clientField]);
    expect(out).toEqual([]);
  });

  test("does not mutate the original record values", () => {
    const original = rec("r1", { client: "[[Acme Studio]]" });
    filterByLinkedSelection([original], isCond("client", "Acme Studio"), [clientField]);
    expect(original.values["client"]).toBe("[[Acme Studio]]");
  });
});

describe("filterByLinkedSelection — non-Relation passthrough", () => {
  test("Status field keeps case-sensitive matching (no canonicalisation)", () => {
    const records = [
      rec("r1", { status: "Done" }),
      rec("r2", { status: "done" }),
    ];
    // Exact-case match → only the exact "Done" record (passthrough preserves
    // matchesCondition's case-sensitive string equality).
    const out = filterByLinkedSelection(records, isCond("status", "Done"), [statusField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("unknown field (not in fields list) passes through to matchesCondition", () => {
    const records = [rec("r1", { foo: "bar" }), rec("r2", { foo: "baz" })];
    const out = filterByLinkedSelection(records, isCond("foo", "bar"), []);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("filterByLinkedSelection — malformed wikilink edge cases", () => {
  test("malformed link without closing brackets does not match and does not throw", () => {
    const records = [rec("r1", { client: "[[Acme Studio" })];
    expect(() => {
      const out = filterByLinkedSelection(records, isCond("client", "Acme Studio"), [clientField]);
      expect(out).toEqual([]);
    }).not.toThrow();
  });

  test("bare path without wikilink syntax still matches by canonicalised path", () => {
    const records = [rec("r1", { client: "Projects/Acme Studio" })];
    const out = filterByLinkedSelection(records, isCond("client", "Projects/Acme Studio"), [clientField]);
    expect(out.map((r) => r.id)).toEqual(["r1"]);
  });

  test("empty string selection value matches empty/missing cell but not a wikilink", () => {
    const records = [
      rec("r1", { client: "" }),
      rec("r2", { client: "[[Acme Studio]]" }),
    ];
    const out = filterByLinkedSelection(records, isCond("client", ""), [clientField]);
    expect(out.map((r) => r.id)).toEqual([]);
  });
});

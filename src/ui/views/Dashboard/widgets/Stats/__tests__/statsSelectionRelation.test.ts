/**
 * #153 — Stats compared selection values with `String(cell)`, while the
 * relation filter path canonicalises both sides. A card could therefore
 * aggregate a different cohort than the table next to it was highlighting:
 * `[[Ivan Petrov]]` and `[[Clients/Ivan Petrov|Ivan]]` point at one note and
 * compared as two.
 *
 * The widening is deliberately narrow: plain strings keep exact matching,
 * because `parseRelationLinks` splits them on commas and that would silently
 * change ordinary String fields.
 */
import type { DataRecord } from "src/lib/dataframe/dataframe";
import { filterRecordsBySelection } from "../statsSelectionReceiver";
import { dataTableSourceId, type SelectionState } from "../../../canvasSelectionStore";

const record = (id: string, values: DataRecord["values"]): DataRecord => ({ id, values });

function selection(values: string[]): SelectionState {
  return {
    source: dataTableSourceId("other-widget"),
    field: "client",
    values,
  } as unknown as SelectionState;
}

describe("#153 Stats matches relation cells by canonical key", () => {
  it("matches an aliased link against a bare one, case-insensitively", () => {
    // This is exactly what `canonicalLinkKey` equalises: the wikilink brackets,
    // the `|alias` suffix and case. It does NOT equalise a path with a
    // basename — the relation filter path has the same limit, and agreeing
    // with it is the point of this ticket.
    const records = [
      record("s1.md", { client: "[[Ivan Petrov|Ivan]]" }),
      record("s2.md", { client: "[[Anna]]" }),
    ];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["[[ivan petrov]]"]),
      myWidgetId: "stats-1",
    });

    expect(out.map((r) => r.id)).toEqual(["s1.md"]);
  });

  it("matches inside a multi-link cell", () => {
    const records = [
      record("s1.md", { client: ["[[Anna]]", "[[Ivan Petrov|Ivan]]"] }),
      record("s2.md", { client: ["[[Boris]]"] }),
    ];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["[[Ivan Petrov]]"]),
      myWidgetId: "stats-1",
    });

    expect(out.map((r) => r.id)).toEqual(["s1.md"]);
  });

  it("keeps exact matching for plain strings", () => {
    // "Ivan, Petrov" must not match a selection of "Ivan": splitting plain
    // strings on commas is relation-only behaviour.
    const records = [
      record("s1.md", { client: "Ivan, Petrov" }),
      record("s2.md", { client: "Ivan" }),
    ];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["Ivan"]),
      myWidgetId: "stats-1",
    });

    expect(out.map((r) => r.id)).toEqual(["s2.md"]);
  });

  it("still returns everything when nothing is selected", () => {
    const records = [record("s1.md", { client: "[[Anna]]" })];

    const out = filterRecordsBySelection({
      records,
      selection: { source: null, field: null, values: [] } as unknown as SelectionState,
      myWidgetId: "stats-1",
    });

    expect(out).toBe(records);
  });
});

// Added after cross-verification (CV-1, 2026-08-28): the first version of this
// fix only canonicalised selection values that already looked like wikilinks.
// The real driver never sends one — `rowSelectionValue` publishes a bare
// basename — so the fix was inert in the only path that matters.
describe("#153 the real driver shape: a bare basename", () => {
  it("matches a wikilink cell against the basename the table publishes", () => {
    const records = [
      record("s1.md", { client: "[[Ivan Petrov]]" }),
      record("s2.md", { client: "[[Anna]]" }),
    ];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["Ivan Petrov"]),
      myWidgetId: "stats-1",
    });

    expect(out.map((r) => r.id)).toEqual(["s1.md"]);
  });

  it("matches an aliased link cell against the basename", () => {
    const records = [record("s1.md", { client: ["[[Ivan Petrov|Ivan]]"] })];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["ivan petrov"]),
      myWidgetId: "stats-1",
    });

    expect(out.map((r) => r.id)).toEqual(["s1.md"]);
  });

  it("still does not split a plain string cell on commas", () => {
    const records = [record("s1.md", { client: "Ivan, Petrov" })];

    const out = filterRecordsBySelection({
      records,
      selection: selection(["Ivan"]),
      myWidgetId: "stats-1",
    });

    expect(out).toEqual([]);
  });
});

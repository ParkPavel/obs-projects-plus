/**
 * #170 step 2 — the saved filter, and the one thing about it that must never
 * be "optimised".
 *
 * The first test in this file is the important one. Revision 1 of the brief
 * proposed resolving a saved selection in the datasource layer, and Gate 0
 * refuted it: acquisition filters run before a frame exists, so a condition
 * naming a rollup would match nothing — silently, looking exactly like a
 * filter that legitimately found no records. This pins that the derived source
 * sees the ENRICHED frame, which is the only reason the essay's own example
 * ("clients whose last session was long ago") can be expressed at all.
 */

import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/base/settings";
import type { DerivedDataSource } from "src/settings/v3/settings";

import { derivedSources, isAcquirable, resolveDerived } from "../derivedSource";
import type { IdentifiedFrame } from "../sourceSelection";

const field = (name: string, type: DataFieldType = DataFieldType.String) => ({
  name,
  type,
  identifier: name === "name",
  derived: name.startsWith("__") || name === "sessionCount",
  repeated: false,
  typeConfig: {},
});

/**
 * A project frame as it looks AFTER enrichment: `sessionCount` is a rollup, a
 * derived column that does not exist in any file on disk.
 */
const ENRICHED: DataFrame = {
  fields: [field("name"), field("sessionCount", DataFieldType.Number)],
  records: [
    { id: "Clients/Acme.md", values: { name: "Acme", sessionCount: 7 } },
    { id: "Clients/Orbit.md", values: { name: "Orbit", sessionCount: 0 } },
    { id: "Archive/Old.md", values: { name: "Old", sessionCount: 0 } },
  ],
};

const PARTS: IdentifiedFrame[] = [
  {
    id: "src-clients",
    frame: {
      fields: [field("name")],
      records: [
        { id: "Clients/Acme.md", values: { name: "Acme" } },
        { id: "Clients/Orbit.md", values: { name: "Orbit" } },
      ],
    },
  },
  {
    id: "src-archive",
    frame: {
      fields: [field("name")],
      records: [{ id: "Archive/Old.md", values: { name: "Old" } }],
    },
  },
];

const where = (field: string, operator: string, value?: string): FilterDefinition =>
  ({
    conjunction: "and",
    conditions: [{ field, operator, ...(value === undefined ? {} : { value }), enabled: true }],
  }) as FilterDefinition;

const derived = (from: string, filter: FilterDefinition): DerivedDataSource =>
  ({ kind: "derived", id: "sel-1", name: "Active", config: { from, where: filter } }) as DerivedDataSource;

describe("#170 step 2 — it narrows the ENRICHED frame, which is the whole point", () => {
  it("a filter on a ROLLUP column works — the case acquisition-time filtering could not express", () => {
    // `sessionCount` exists only after enrichment. If this source were resolved
    // in the datasource layer the column would not be there yet and this would
    // silently return nothing, which is Gate 0's refutation of revision 1.
    const r = resolveDerived(derived("project", where("sessionCount", "gt", "0")), {
      enriched: ENRICHED,
      parts: PARTS,
    });
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Clients/Acme.md"]);
  });

  it("narrowing ONE source still sees the derived columns of the project", () => {
    // The part carries acquired records only. Selecting the enriched rows by
    // the part's ids is what keeps a rollup filter working when the saved
    // filter reads a single source rather than the whole project.
    const r = resolveDerived(derived("src-clients", where("sessionCount", "gt", "0")), {
      enriched: ENRICHED,
      parts: PARTS,
    });
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Clients/Acme.md"]);
  });

  it("narrowing one source cannot reach records of another", () => {
    const r = resolveDerived(derived("src-archive", where("name", "is-not-empty")), {
      enriched: ENRICHED,
      parts: PARTS,
    });
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Archive/Old.md"]);
  });
});

describe("#170 step 2 — three states, because two of them look identical on screen", () => {
  it("matched nothing is a real answer, and says so", () => {
    const r = resolveDerived(derived("project", where("sessionCount", "gt", "999")), {
      enriched: ENRICHED,
      parts: PARTS,
    });
    expect(r.kind).toBe("empty");
    expect(r.kind === "empty" && r.frame.records).toEqual([]);
  });

  it("reading from a source that is gone is broken, and names what failed", () => {
    // A user can fix a configuration. Telling them "0 records" would send them
    // to look at their data instead, which is the wrong place entirely.
    const r = resolveDerived(derived("src-deleted", where("name", "is-not-empty")), {
      enriched: ENRICHED,
      parts: PARTS,
    });
    expect(r.kind).toBe("broken");
    expect(r.kind === "broken" && r.reason).toContain("src-deleted");
  });

  it("a frame that has not arrived is pending, not empty", () => {
    // The enriched frame lands after the external frames it waits on. An empty
    // table during that window is a third thing wearing the same face.
    const r = resolveDerived(derived("project", where("name", "is-not-empty")), {
      enriched: undefined,
      parts: [],
    });
    expect(r.kind).toBe("pending");
  });
});

describe("#170 step 2 — it is not acquired, and the layer is told so explicitly", () => {
  it("a derived source is never handed to the datasource factory", () => {
    // It would fall through to "unresolvable" and be dropped, which works by
    // accident. Accidents survive until someone adds a default branch.
    expect(isAcquirable({ kind: "derived" })).toBe(false);
    for (const kind of ["folder", "tag", "dataview", "native-query"]) {
      expect({ kind, acquirable: isAcquirable({ kind }) }).toEqual({ kind, acquirable: true });
    }
  });

  it("the derived sources of a project are found among the rest", () => {
    const all = [
      { kind: "folder" },
      { kind: "derived", id: "a", config: { from: "project", where: where("name", "is-not-empty") } },
      { kind: "tag" },
    ];
    expect(derivedSources(all).map((d) => d.id)).toEqual(["a"]);
  });
});

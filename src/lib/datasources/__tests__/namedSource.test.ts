/**
 * #184 step 1 — the first consumer #170's functions have ever had.
 *
 * Everything here is about the ORDER in which the existing pure functions are
 * asked, because that is the only thing this module adds and both orderings it
 * fixes fail silently:
 *
 *   - `sourceExists` looks only in `parts`, and a derived source is never in
 *     `parts`. Asking it before checking for a saved filter reports every
 *     saved filter as permanently broken.
 *   - `selectSourceFrame` returns the raw acquired part. Rendering that strips
 *     every derived column the moment a block points at a source, and nothing
 *     about the screen says so.
 *
 * Both have a test that fails on the wrong order rather than on a typo.
 */

import type { DataFrame } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/settings/base/settings";
import type { DataSource as StoredDataSource } from "src/settings/v3/settings";

import { buildDerivedSource, projectSourceOptions, resolveNamedSource } from "../namedSource";
import type { IdentifiedFrame } from "../sourceSelection";

const field = (name: string, type: DataFieldType = DataFieldType.String, derived = false) => ({
  name,
  type,
  identifier: name === "name",
  derived,
  repeated: false,
  typeConfig: {},
});

/**
 * The project frame AFTER enrichment: `sessionCount` is a rollup that exists
 * in no file on disk, which is exactly the column a raw part would not have.
 */
const ENRICHED: DataFrame = {
  fields: [field("name"), field("sessionCount", DataFieldType.Number, true)],
  records: [
    { id: "Clients/Acme.md", values: { name: "Acme", sessionCount: 7 } },
    { id: "Clients/Orbit.md", values: { name: "Orbit", sessionCount: 0 } },
    { id: "Archive/Old.md", values: { name: "Old", sessionCount: 0 } },
  ],
};

/** Acquired frames carry only what the vault query produced — no rollup. */
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
    frame: { fields: [field("name")], records: [{ id: "Archive/Old.md", values: { name: "Old" } }] },
  },
];

const where = (f: string, operator: string, value?: string): FilterDefinition =>
  ({
    conjunction: "and",
    conditions: [{ field: f, operator, ...(value === undefined ? {} : { value }), enabled: true }],
  }) as FilterDefinition;

const SOURCES: StoredDataSource[] = [
  { kind: "folder", id: "src-clients", name: "Clients", config: { path: "Clients", recursive: true } },
  { kind: "folder", id: "src-archive", config: { path: "Archive", recursive: true } },
  {
    kind: "derived",
    id: "sel-active",
    name: "Active",
    config: { from: "project", where: where("sessionCount", "gt", "0") },
  },
] as unknown as StoredDataSource[];

const run = (sourceId: string | undefined, enriched: DataFrame | undefined = ENRICHED) =>
  resolveNamedSource({ enriched, parts: PARTS, sources: SOURCES, sourceId });

describe("#184 — a block that names no source is byte-for-byte unchanged", () => {
  it("is handed the very same frame object, not a copy of it", () => {
    // `toBe`. Option C was chosen partly because it migrates nothing, and
    // "migrates nothing" is only true if the untouched path is untouched.
    // A rebuilt-but-equal frame would also re-render every widget on every tick.
    const r = run(undefined);
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame).toBe(ENRICHED);
  });

  it("is handed the frame even when the project has no sources at all", () => {
    // A block with no source has always rendered whatever it was given.
    const r = resolveNamedSource({ enriched: ENRICHED, parts: [], sources: [], sourceId: undefined });
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame).toBe(ENRICHED);
  });
});

describe("#184 — the rows come from the enriched frame, never from the raw part", () => {
  it("a named ordinary source keeps the columns enrichment added", () => {
    // The failure this catches is invisible on screen: point a block at a
    // folder source and its rollup columns quietly go blank, because
    // `selectSourceFrame` returns what the vault query produced.
    const r = run("src-clients");
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.frame.records.map((x) => x.id)).toEqual(["Clients/Acme.md", "Clients/Orbit.md"]);
    expect(r.frame.fields.map((f) => f.name)).toContain("sessionCount");
    expect(r.frame.records[0]?.values["sessionCount"]).toBe(7);
  });

  it("selects only that source's records", () => {
    const r = run("src-archive");
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Archive/Old.md"]);
  });

  it("a source that acquired nothing is empty, and names itself", () => {
    const r = resolveNamedSource({
      enriched: ENRICHED,
      parts: [{ id: "src-clients", frame: { fields: [field("name")], records: [] } }],
      sources: SOURCES,
      sourceId: "src-clients",
    });
    expect(r.kind).toBe("empty");
    expect(r.kind === "empty" && r.label).toBe("Clients");
  });
});

describe("#184 — a saved filter is checked BEFORE sourceExists", () => {
  it("resolves instead of reporting itself permanently broken", () => {
    // THE order trap. A derived source is excluded from acquisition on purpose,
    // so it is never in `parts` and `sourceExists` always answers false for it.
    // Ask that first and every saved filter is broken forever.
    const r = run("sel-active");
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Clients/Acme.md"]);
  });

  it("and it narrows by a ROLLUP, which is why it resolves here and not at acquisition", () => {
    // `sessionCount` exists only after enrichment. This is #170's Gate 0
    // refutation carried into the live path: resolved in the datasource layer
    // this filter would match nothing, silently.
    const r = run("sel-active");
    expect(r.kind === "ok" && r.frame.records).toHaveLength(1);
  });

  it("a saved filter that matches nothing is empty, not broken", () => {
    const sources = [
      ...SOURCES,
      {
        kind: "derived",
        id: "sel-none",
        name: "Nobody",
        config: { from: "project", where: where("sessionCount", "gt", "999") },
      },
    ] as unknown as StoredDataSource[];
    const r = resolveNamedSource({ enriched: ENRICHED, parts: PARTS, sources, sourceId: "sel-none" });
    expect(r.kind).toBe("empty");
    expect(r.kind === "empty" && r.label).toBe("Nobody");
  });

  it("a saved filter reading a source that is gone is broken, and says which", () => {
    const sources = [
      ...SOURCES,
      {
        kind: "derived",
        id: "sel-dangling",
        config: { from: "src-deleted", where: where("name", "is-not-empty") },
      },
    ] as unknown as StoredDataSource[];
    const r = resolveNamedSource({
      enriched: ENRICHED,
      parts: PARTS,
      sources,
      sourceId: "sel-dangling",
    });
    expect(r.kind).toBe("broken");
    expect(r.kind === "broken" && r.reason).toContain("src-deleted");
  });
});

describe("#184 — four states, because three of them look like an empty table", () => {
  it("an id nothing answers to is broken, not empty", () => {
    const r = run("src-deleted");
    expect(r.kind).toBe("broken");
    expect(r.kind === "broken" && r.reason).toContain("src-deleted");
  });

  it("has no `pending` case, and that is a finding rather than an omission", () => {
    // The first cut mirrored `resolveDerived`'s four states, including
    // `pending`. Adversarial review showed it had no producer:
    // `DataFrameProvider` renders the widget tree only inside its `{:then}`,
    // and sets `dataFrame` and `frameParts` in one synchronous step, so a host
    // never runs with a missing frame. The test that "covered" it reached the
    // state by calling this function with `undefined` — proving the mapping,
    // not the screen. `enriched` is required now, so the type says so, and
    // this asserts the union really has three cases and not four.
    const kinds = ["ok", "empty", "broken"];
    const seen = [
      run(undefined).kind,
      resolveNamedSource({
        enriched: ENRICHED,
        parts: [{ id: "src-clients", frame: { fields: [field("name")], records: [] } }],
        sources: SOURCES,
        sourceId: "src-clients",
      }).kind,
      run("src-deleted").kind,
    ];
    expect(seen.sort()).toEqual([...kinds].sort());
  });

  it("labels a source that has no name with what it reads", () => {
    // `src-archive` was stored without a name. "Source 2" would say less than
    // the folder the user picked.
    const r = run("src-archive");
    expect(r.kind === "ok" && r.label).toBe("Archive");
  });
});

describe("#184 — overlapping sources, which the merge deduplicates", () => {
  it("a record two sources both matched is shown by both", () => {
    // `mergeDataFrames` keeps one copy per id, first wins, so the enriched
    // frame holds Acme once. Intersecting by id therefore returns it for
    // whichever source is asked — and that is correct: a note in a folder AND
    // carrying a tag genuinely belongs to both sources. The risk raised in
    // review was that dedup could hide it from the second one; it cannot,
    // because every part's ids are all present in the merge.
    const overlapping: IdentifiedFrame[] = [
      { id: "by-folder", frame: { fields: [field("name")], records: [{ id: "Clients/Acme.md", values: { name: "Acme" } }] } },
      { id: "by-tag", frame: { fields: [field("name")], records: [{ id: "Clients/Acme.md", values: { name: "Acme" } }] } },
    ];
    const sources = [
      { kind: "folder", id: "by-folder", config: { path: "Clients", recursive: true } },
      { kind: "tag", id: "by-tag", config: { tag: "#client", hierarchy: false } },
    ] as unknown as StoredDataSource[];

    for (const id of ["by-folder", "by-tag"]) {
      const r = resolveNamedSource({ enriched: ENRICHED, parts: overlapping, sources, sourceId: id });
      expect({ id, ids: r.kind === "ok" ? r.frame.records.map((x) => x.id) : null }).toEqual({
        id,
        ids: ["Clients/Acme.md"],
      });
    }
  });
});

describe("#184 step 2 — the object a saved filter is stored as", () => {
  const filter = where("status", "is", "open");

  it("is a derived source carrying the filter unchanged", () => {
    const built = buildDerivedSource("  Active clients  ", filter, "id-1");
    expect(built.kind).toBe("derived");
    expect(built.id).toBe("id-1");
    expect(built.config.from).toBe("project");
    // The same definition, not a rebuild: a copy would drop keys a future
    // filter shape adds without anything failing.
    expect(built.config.where).toBe(filter);
  });

  it("trims the name, because a label is what the user reads", () => {
    expect(buildDerivedSource("  Active  ", filter, "id-2").name).toBe("Active");
  });

  it("is immediately resolvable by the module that will read it", () => {
    // The two halves of #184 meet here: what step 2 writes, step 1 resolves.
    const built = buildDerivedSource("Busy", where("sessionCount", "gt", "0"), "sel-new");
    const r = resolveNamedSource({
      enriched: ENRICHED,
      parts: PARTS,
      sources: [...SOURCES, built] as unknown as StoredDataSource[],
      sourceId: "sel-new",
    });
    expect(r.kind).toBe("ok");
    expect(r.kind === "ok" && r.frame.records.map((x) => x.id)).toEqual(["Clients/Acme.md"]);
  });
});

describe("#184 — what a picker may offer, and what it must explain", () => {
  const project = (extra: unknown[]) =>
    ({
      id: "p1",
      name: "Clients",
      dataSource: SOURCES[0],
      additionalSources: extra,
    }) as never;

  it("offers every source that carries an id, primary included", () => {
    const opts = projectSourceOptions(project([SOURCES[1], SOURCES[2]]));
    expect(opts.pickable.map((p) => p.id)).toEqual(["src-clients", "src-archive", "sel-active"]);
    expect(opts.sources).toHaveLength(3);
  });

  it("labels each one the way the block will", () => {
    // The same `sourceLabel` the resolver uses, so the name in the picker and
    // the name in the "nothing here" hint cannot disagree.
    const opts = projectSourceOptions(project([SOURCES[1]]));
    expect(opts.pickable.map((p) => p.label)).toEqual(["Clients", "Archive"]);
  });

  it("drops a source with no id — and says the project HAS one", () => {
    // A source stored before #170 cannot be referenced, so it must not appear.
    // Silently shorter is the version that reads as a bug, which is what
    // `hasUnaddressable` exists to let the UI explain.
    const legacy = { kind: "folder", config: { path: "Old", recursive: false } };
    const opts = projectSourceOptions(project([legacy]));
    expect(opts.pickable.map((p) => p.id)).toEqual(["src-clients"]);
    expect(opts.hasUnaddressable).toBe(true);
  });

  it("says nothing is missing when nothing is", () => {
    expect(projectSourceOptions(project([SOURCES[1]])).hasUnaddressable).toBe(false);
  });

  it("survives having no project at all", () => {
    // The panel renders before a project resolves; an exception here would take
    // the whole canvas down.
    const opts = projectSourceOptions(undefined);
    expect(opts).toEqual({ sources: [], pickable: [], hasUnaddressable: false });
  });
});

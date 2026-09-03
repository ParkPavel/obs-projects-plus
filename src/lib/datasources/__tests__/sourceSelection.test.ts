/**
 * #170 step 1 — addressing one source, and above all NOT changing what happens
 * when nobody addresses one.
 *
 * The back-compat case is written first and asserted hardest, because it is the
 * claim the whole decision rests on: option C was chosen over a saved-selection
 * entity partly because it migrates nothing, and "migrates nothing" is only
 * true if a config with no `sourceId` still yields the merged frame it always
 * did. That is proven here before the new path is exercised, not after.
 */

import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import type { DataSource as StoredDataSource } from "src/settings/v3/settings";

import {
  selectSourceFrame,
  sourceExists,
  sourceLabel,
  type IdentifiedFrame,
} from "../sourceSelection";

const field = (name: string) => ({
  name,
  type: DataFieldType.String,
  identifier: name === "name",
  derived: false,
  repeated: false,
  typeConfig: {},
});

const frameOf = (...ids: string[]): DataFrame => ({
  fields: [field("name")],
  records: ids.map((id): DataRecord => ({ id, values: { name: id } })),
});

const CLIENTS = frameOf("Clients/Acme.md", "Clients/Orbit.md");
const ARCHIVE = frameOf("Archive/Clients/Old.md");
const MERGED = frameOf("Clients/Acme.md", "Clients/Orbit.md", "Archive/Clients/Old.md");

const PARTS: IdentifiedFrame[] = [
  { id: "src-primary", frame: CLIENTS },
  { id: "src-archive", frame: ARCHIVE },
];

describe("#170 step 1 — a config that names no source is untouched", () => {
  it("undefined selects the merge, which is what every stored block has", () => {
    expect(selectSourceFrame(MERGED, PARTS, undefined)).toBe(MERGED);
  });

  it("an empty string is not an address either", () => {
    // A config written by a UI that stored "" for "none" must not be read as a
    // source that happens to have no id.
    expect(selectSourceFrame(MERGED, PARTS, "")).toBe(MERGED);
  });

  it("a project whose sources were never named still merges", () => {
    // Every source stored before #170 has no id. Selecting anything in such a
    // project must not produce an empty table.
    const unnamed: IdentifiedFrame[] = [
      { id: undefined, frame: CLIENTS },
      { id: undefined, frame: ARCHIVE },
    ];
    expect(selectSourceFrame(MERGED, unnamed, undefined)).toBe(MERGED);
    expect(selectSourceFrame(MERGED, unnamed, "src-archive")).toBe(MERGED);
  });
});

describe("#170 step 1 — a config that names one gets that one", () => {
  it("selects the named source and not the merge", () => {
    expect(selectSourceFrame(MERGED, PARTS, "src-archive")).toBe(ARCHIVE);
    expect(selectSourceFrame(MERGED, PARTS, "src-primary")).toBe(CLIENTS);
  });

  it("selecting is a lookup, never a re-query", () => {
    // The provider acquires once. If this ever returned a NEW frame the widget
    // would re-render on every tick, and the merge would be computed twice.
    const picked = selectSourceFrame(MERGED, PARTS, "src-archive");
    expect(picked).toBe(ARCHIVE);
    expect(picked.records).toBe(ARCHIVE.records);
  });
});

describe("#170 step 1 — a source that no longer exists", () => {
  it("degrades to the whole project rather than to nothing", () => {
    // An empty table looks like a filter that matched nothing, and the user
    // would go hunting for the wrong bug. Showing the project is wrong in a way
    // they can see and fix.
    expect(selectSourceFrame(MERGED, PARTS, "deleted-source")).toBe(MERGED);
  });

  it("and the caller can still tell the difference", () => {
    expect(sourceExists(PARTS, "deleted-source")).toBe(false);
    expect(sourceExists(PARTS, "src-archive")).toBe(true);
    expect(sourceExists(PARTS, undefined)).toBe(true);
  });
});

describe("#170 step 1 — what a source is called", () => {
  const folder = (path: string, name?: string): StoredDataSource =>
    ({ kind: "folder", config: { path, recursive: true }, ...(name ? { name } : {}) }) as StoredDataSource;

  it("its name when it has one", () => {
    expect(sourceLabel(folder("Archive/Clients", "Archive"))).toBe("Archive");
  });

  it("what it reads when it does not", () => {
    // Every source stored before #170 is unnamed, and "Source 2" would say
    // less than the path the user chose when they added it.
    expect(sourceLabel(folder("Archive/Clients"))).toBe("Archive/Clients");
    expect(sourceLabel({ kind: "tag", config: { tag: "#client", hierarchy: true } } as StoredDataSource))
      .toBe("#client");
  });

  it("a whitespace-only name is not a name", () => {
    expect(sourceLabel(folder("Clients", "   "))).toBe("Clients");
  });
});

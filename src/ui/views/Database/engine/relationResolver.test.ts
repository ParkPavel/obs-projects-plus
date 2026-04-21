import type { DataFrame, DataRecord } from "src/lib/dataframe/dataframe";
import { DataFieldType } from "src/lib/dataframe/dataframe";
import {
  extractWikiLinks,
  resolveRelations,
  getRelationTargets,
} from "./relationResolver";

// ── Helpers ─────────────────────────────────────────────

function makeDF(records: DataRecord[]): DataFrame {
  return {
    fields: [
      { name: "name", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "links", type: DataFieldType.String, repeated: false, identifier: false, derived: false },
      { name: "score", type: DataFieldType.Number, repeated: false, identifier: false, derived: false },
    ],
    records,
  };
}

function rec(id: string, name: string, links: string, score = 0): DataRecord {
  return { id, values: { name, links, score } };
}

// ── extractWikiLinks ────────────────────────────────────

describe("extractWikiLinks", () => {
  it("should extract simple links", () => {
    expect(extractWikiLinks("See [[Alpha]] and [[Beta]]")).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("should extract links with aliases", () => {
    expect(extractWikiLinks("[[My Note|alias]]")).toEqual(["My Note"]);
  });

  it("should extract links with heading anchors", () => {
    expect(extractWikiLinks("[[Note#Section]]")).toEqual(["Note"]);
  });

  it("should extract links with heading + alias", () => {
    expect(extractWikiLinks("[[Note#Section|display]]")).toEqual(["Note"]);
  });

  it("should return empty for no links", () => {
    expect(extractWikiLinks("plain text")).toEqual([]);
  });

  it("should handle empty string", () => {
    expect(extractWikiLinks("")).toEqual([]);
  });

  it("should handle multiple links on same line", () => {
    expect(
      extractWikiLinks("[[A]], [[B]], [[C]]")
    ).toEqual(["A", "B", "C"]);
  });

  it("should trim whitespace in link targets", () => {
    expect(extractWikiLinks("[[ Spaced Note ]]")).toEqual(["Spaced Note"]);
  });
});

// ── resolveRelations ────────────────────────────────────

describe("resolveRelations", () => {
  const df = makeDF([
    rec("folder/Alpha.md", "Alpha", "[[Beta]] [[Gamma]]", 10),
    rec("folder/Beta.md", "Beta", "[[Alpha]]", 20),
    rec("folder/Gamma.md", "Gamma", "", 30),
    rec("folder/Delta.md", "Delta", "[[NonExistent]]", 40),
  ]);

  it("should resolve existing links to records", () => {
    const results = resolveRelations(df, "links");
    const alphaResult = results.find((r) => r.sourceId === "folder/Alpha.md");
    expect(alphaResult).toBeDefined();
    expect(alphaResult!.relations).toHaveLength(2);
    expect(alphaResult!.relations[0]!.linkText).toBe("Beta");
    expect(alphaResult!.relations[0]!.target?.id).toBe("folder/Beta.md");
    expect(alphaResult!.relations[1]!.linkText).toBe("Gamma");
    expect(alphaResult!.relations[1]!.target?.id).toBe("folder/Gamma.md");
  });

  it("should return undefined target for unresolved links", () => {
    const results = resolveRelations(df, "links");
    const deltaResult = results.find((r) => r.sourceId === "folder/Delta.md");
    expect(deltaResult).toBeDefined();
    expect(deltaResult!.relations[0]!.linkText).toBe("NonExistent");
    expect(deltaResult!.relations[0]!.target).toBeUndefined();
  });

  it("should skip records with no links", () => {
    const results = resolveRelations(df, "links");
    const gammaResult = results.find((r) => r.sourceId === "folder/Gamma.md");
    expect(gammaResult).toBeUndefined();
  });

  it("should be case-insensitive when matching", () => {
    const df2 = makeDF([
      rec("folder/test.md", "Test", "[[alpha]]"),
      rec("folder/Alpha.md", "Alpha", ""),
    ]);
    const results = resolveRelations(df2, "links");
    expect(results[0]!.relations[0]!.target?.id).toBe("folder/Alpha.md");
  });
});

// ── getRelationTargets ──────────────────────────────────

describe("getRelationTargets", () => {
  const df = makeDF([
    rec("a.md", "A", "[[B]] [[C]]", 10),
    rec("b.md", "B", "", 20),
    rec("c.md", "C", "", 30),
  ]);

  it("should return array of target records", () => {
    const targets = getRelationTargets(df.records[0]!, "links", df);
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.id)).toEqual(["b.md", "c.md"]);
  });

  it("should return empty array for no links", () => {
    const targets = getRelationTargets(df.records[1]!, "links", df);
    expect(targets).toEqual([]);
  });

  it("should filter out unresolved links", () => {
    const df2 = makeDF([
      rec("x.md", "X", "[[Y]] [[Missing]]"),
      rec("y.md", "Y", ""),
    ]);
    const targets = getRelationTargets(df2.records[0]!, "links", df2);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.id).toBe("y.md");
  });
});

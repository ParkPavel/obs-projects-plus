import {
  DEFAULT_RELATION_KEY,
  appendRelation,
  formatWikilink,
  parseWikilink,
  readRelations,
  removeRelation,
} from "../relations";

describe("parseWikilink / formatWikilink", () => {
  it("parses a simple wikilink", () => {
    expect(parseWikilink("[[Foo]]")).toEqual({ path: "Foo" });
  });

  it("parses a wikilink with alias", () => {
    expect(parseWikilink("[[Foo/Bar|Bar]]")).toEqual({
      path: "Foo/Bar",
      alias: "Bar",
    });
  });

  it("returns null for non-wikilinks", () => {
    expect(parseWikilink("plain string")).toBeNull();
    expect(parseWikilink("[[]]")).toBeNull();
    expect(parseWikilink("[[ ]]")).toBeNull();
  });

  it("formatWikilink round-trips", () => {
    expect(formatWikilink({ path: "X" })).toBe("[[X]]");
    expect(formatWikilink({ path: "X", alias: "y" })).toBe("[[X|y]]");
  });
});

describe("readRelations", () => {
  it("reads from default key", () => {
    expect(readRelations({ links: ["[[A]]", "[[B]]"] })).toEqual([
      { path: "A" },
      { path: "B" },
    ]);
  });

  it("tolerates a single string under the key", () => {
    expect(readRelations({ refs: "[[A]]" }, "refs")).toEqual([{ path: "A" }]);
  });

  it("returns empty for missing or null", () => {
    expect(readRelations(null)).toEqual([]);
    expect(readRelations({}, "links")).toEqual([]);
    expect(readRelations({ links: null })).toEqual([]);
  });

  it("skips unparseable entries", () => {
    expect(readRelations({ links: ["plain", "[[Good]]", null, 42] })).toEqual([
      { path: "Good" },
    ]);
  });
});

describe("appendRelation", () => {
  it("adds a new relation as a wikilink string array", () => {
    const result = appendRelation({}, "links", { path: "A" });
    expect(result).toEqual(["[[A]]"]);
  });

  it("preserves existing relations", () => {
    const result = appendRelation(
      { links: ["[[A]]"] },
      "links",
      { path: "B" },
    );
    expect(result).toEqual(["[[A]]", "[[B]]"]);
  });

  it("is idempotent — same path is not duplicated", () => {
    const result = appendRelation(
      { links: ["[[A]]", "[[B]]"] },
      "links",
      { path: "A" },
    );
    expect(result).toEqual(["[[A]]", "[[B]]"]);
  });

  it("preserves alias on append", () => {
    const result = appendRelation({}, "links", { path: "A", alias: "alpha" });
    expect(result).toEqual(["[[A|alpha]]"]);
  });

  it("uses DEFAULT_RELATION_KEY constant", () => {
    expect(DEFAULT_RELATION_KEY).toBe("links");
  });
});

describe("removeRelation", () => {
  it("removes the matching path", () => {
    expect(
      removeRelation({ links: ["[[A]]", "[[B]]"] }, "links", "A"),
    ).toEqual(["[[B]]"]);
  });

  it("returns empty array when last entry removed", () => {
    expect(removeRelation({ links: ["[[A]]"] }, "links", "A")).toEqual([]);
  });

  it("ignores unknown paths", () => {
    expect(
      removeRelation({ links: ["[[A]]"] }, "links", "Ghost"),
    ).toEqual(["[[A]]"]);
  });
});

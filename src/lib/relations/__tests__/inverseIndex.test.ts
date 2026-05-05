import {
  buildInverseIndex,
  extractTargets,
  lookupInverse,
  normalizeTargetPath,
  type BuildInverseIndexInput,
} from "../inverseIndex";

describe("normalizeTargetPath", () => {
  it("strips .md extension", () => {
    expect(normalizeTargetPath("Folder/Note.md")).toBe("Folder/Note");
  });

  it("leaves non-md paths untouched", () => {
    expect(normalizeTargetPath("Folder/Note")).toBe("Folder/Note");
    expect(normalizeTargetPath("img.png")).toBe("img.png");
  });
});

describe("extractTargets", () => {
  it("parses a single wikilink string", () => {
    expect(extractTargets("[[Foo]]")).toEqual(["Foo"]);
  });

  it("parses an array of wikilinks, dedupes, preserves order", () => {
    expect(extractTargets(["[[A]]", "[[B]]", "[[A]]"])).toEqual(["A", "B"]);
  });

  it("ignores non-wikilink scalars and non-string array entries", () => {
    expect(extractTargets("plain")).toEqual([]);
    expect(extractTargets(["[[A]]", null, 42, "noise"])).toEqual(["A"]);
  });

  it("strips heading and alias", () => {
    expect(extractTargets("[[Note#heading|alias]]")).toEqual(["Note"]);
  });

  it("returns empty for unsupported shapes", () => {
    expect(extractTargets(null)).toEqual([]);
    expect(extractTargets({ x: 1 })).toEqual([]);
  });
});

describe("buildInverseIndex", () => {
  const notes: BuildInverseIndexInput[] = [
    { path: "Projects/Acme.md", frontmatter: { links: ["[[Team/John]]", "[[Roadmap]]"] } },
    { path: "Projects/Globex.md", frontmatter: { links: ["[[Team/John]]"] } },
    { path: "Daily/2026-05-01.md", frontmatter: null },
    { path: "Notes/Standalone.md", frontmatter: { other: "no-relations" } },
  ];

  it("builds inverse mapping using default key", () => {
    const idx = buildInverseIndex(notes);
    expect(idx.get("Team/John")).toEqual([
      { sourcePath: "Projects/Acme.md", viaKey: "links" },
      { sourcePath: "Projects/Globex.md", viaKey: "links" },
    ]);
    expect(idx.get("Roadmap")).toEqual([
      { sourcePath: "Projects/Acme.md", viaKey: "links" },
    ]);
  });

  it("respects the keys option", () => {
    const customNotes: BuildInverseIndexInput[] = [
      { path: "A.md", frontmatter: { parent: "[[Root]]" } },
      { path: "B.md", frontmatter: { parent: "[[Root]]", links: ["[[Other]]"] } },
    ];
    const idx = buildInverseIndex(customNotes, { keys: ["parent"] });
    expect(idx.get("Root")?.length).toBe(2);
    expect(idx.has("Other")).toBe(false);
  });

  it("supports multiple keys per scan", () => {
    const customNotes: BuildInverseIndexInput[] = [
      { path: "A.md", frontmatter: { links: ["[[X]]"], related: "[[X]]" } },
    ];
    const idx = buildInverseIndex(customNotes, { keys: ["links", "related"] });
    const entries = idx.get("X") ?? [];
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.viaKey).sort()).toEqual(["links", "related"]);
  });

  it("dedupes within a single source's array", () => {
    const idx = buildInverseIndex([
      { path: "A.md", frontmatter: { links: ["[[X]]", "[[X]]"] } },
    ]);
    expect(idx.get("X")).toEqual([{ sourcePath: "A.md", viaKey: "links" }]);
  });

  it("uses the resolver when provided", () => {
    const resolveLinkPath = jest.fn((text: string) => `Resolved/${text}.md`);
    const idx = buildInverseIndex(
      [{ path: "A.md", frontmatter: { links: ["[[Foo]]"] } }],
      { resolveLinkPath },
    );
    expect(resolveLinkPath).toHaveBeenCalledWith("Foo", "A.md");
    expect(idx.get("Resolved/Foo")).toBeDefined();
  });

  it("falls back to raw target when resolver returns null", () => {
    const idx = buildInverseIndex(
      [{ path: "A.md", frontmatter: { links: ["[[Foo]]"] } }],
      { resolveLinkPath: () => null },
    );
    expect(idx.get("Foo")).toBeDefined();
  });
});

describe("lookupInverse", () => {
  const idx = buildInverseIndex([
    { path: "A.md", frontmatter: { links: ["[[Target]]"] } },
  ]);

  it("looks up by raw path with .md", () => {
    expect(lookupInverse(idx, "Target.md")).toEqual([
      { sourcePath: "A.md", viaKey: "links" },
    ]);
  });

  it("looks up by normalised path", () => {
    expect(lookupInverse(idx, "Target")).toEqual([
      { sourcePath: "A.md", viaKey: "links" },
    ]);
  });

  it("returns empty for unknown notes", () => {
    expect(lookupInverse(idx, "Ghost.md")).toEqual([]);
  });
});

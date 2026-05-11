/**
 * Tests for GridFileCell logic:
 * - parseWikiLinks: parses [[target|display]] patterns from a string
 * - handleDrop formatting: wraps dragged file paths as [[link]]
 *
 * The parsing function is defined inline in GridFileCell.svelte.
 * These tests verify its CONTRACT so any refactor stays correct.
 */

interface WikiLink { target: string; display: string; raw: string }

function parseWikiLinks(str: string): WikiLink[] {
  const re = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
  const out: WikiLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    out.push({ target: m[1]!.trim(), display: (m[2] ?? m[1]!).trim(), raw: m[0] });
  }
  return out;
}

/** Mirrors the drop-handler logic from GridFileCell */
function formatDropLink(rawPath: string): string {
  const target = rawPath.trim().replace(/\.md$/, "");
  return `[[${target}]]`;
}

describe("GridFileCell — parseWikiLinks", () => {
  test("returns empty array for empty string", () => {
    expect(parseWikiLinks("")).toHaveLength(0);
  });

  test("returns empty array for plain text without wiki links", () => {
    expect(parseWikiLinks("just some text")).toHaveLength(0);
  });

  test("parses a single link without display text", () => {
    const result = parseWikiLinks("[[My Note]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.target).toBe("My Note");
    expect(result[0]!.display).toBe("My Note");
    expect(result[0]!.raw).toBe("[[My Note]]");
  });

  test("parses a link with display alias", () => {
    const result = parseWikiLinks("[[path/to/note|Friendly Name]]");
    expect(result).toHaveLength(1);
    expect(result[0]!.target).toBe("path/to/note");
    expect(result[0]!.display).toBe("Friendly Name");
  });

  test("parses multiple links from a single string", () => {
    const result = parseWikiLinks("[[Note A]] and [[Note B|B alias]]");
    expect(result).toHaveLength(2);
    expect(result[0]!.target).toBe("Note A");
    expect(result[1]!.target).toBe("Note B");
    expect(result[1]!.display).toBe("B alias");
  });

  test("trims whitespace from target and display", () => {
    const result = parseWikiLinks("[[ spaced target | spaced display ]]");
    expect(result[0]!.target).toBe("spaced target");
    expect(result[0]!.display).toBe("spaced display");
  });

  test("ignores incomplete bracket patterns", () => {
    expect(parseWikiLinks("[[incomplete")).toHaveLength(0);
    expect(parseWikiLinks("incomplete]]")).toHaveLength(0);
  });
});

describe("GridFileCell — handleDrop formatting (TDT-07)", () => {
  test("wraps plain file name as wiki-link", () => {
    expect(formatDropLink("My Note")).toBe("[[My Note]]");
  });

  test("strips .md extension", () => {
    expect(formatDropLink("My Note.md")).toBe("[[My Note]]");
  });

  test("preserves path separators", () => {
    expect(formatDropLink("folder/subfolder/Note.md")).toBe("[[folder/subfolder/Note]]");
  });

  test("trims whitespace from input", () => {
    expect(formatDropLink("  Note.md  ")).toBe("[[Note]]");
  });
});

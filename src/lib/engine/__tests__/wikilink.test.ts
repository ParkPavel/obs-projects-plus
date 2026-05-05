/**
 * wikilink — engine-layer kernel coverage (REFACTOR-105).
 *
 * Pins canonical parser/formatter/stripper semantics for every
 * downstream caller (relations, inverse index, datasource helpers,
 * dashboard relation resolver, calendar agenda filter, cross-project
 * resolver, property-type sniffer).
 */

import {
  parseWikilink,
  formatWikilink,
  extractWikilinks,
  stripToPath,
  stripToDisplay,
  isWikilink,
  WIKILINK_RE_ANCHORED,
  WIKILINK_RE_GLOBAL,
} from "../wikilink";

describe("wikilink — kernel", () => {
  // ── parseWikilink ────────────────────────────────────
  describe("parseWikilink", () => {
    test("simple", () => {
      expect(parseWikilink("[[Foo]]")).toEqual({ path: "Foo" });
    });
    test("with path segments", () => {
      expect(parseWikilink("[[Projects/Acme]]")).toEqual({ path: "Projects/Acme" });
    });
    test("with alias", () => {
      expect(parseWikilink("[[Foo/Bar|Bar]]")).toEqual({ path: "Foo/Bar", alias: "Bar" });
    });
    test("strips outer whitespace", () => {
      expect(parseWikilink("  [[X]]  ")).toEqual({ path: "X" });
    });
    test("trims path body", () => {
      expect(parseWikilink("[[  X  ]]")).toEqual({ path: "X" });
    });
    test("drops #heading from path", () => {
      expect(parseWikilink("[[Note#Section]]")).toEqual({ path: "Note" });
    });
    test("drops #heading and keeps alias", () => {
      expect(parseWikilink("[[Note#Section|Display]]")).toEqual({
        path: "Note",
        alias: "Display",
      });
    });
    test("rejects plain string", () => {
      expect(parseWikilink("plain")).toBeNull();
    });
    test("rejects empty wikilink", () => {
      expect(parseWikilink("[[]]")).toBeNull();
    });
    test("rejects whitespace-only body", () => {
      expect(parseWikilink("[[ ]]")).toBeNull();
    });
    test("rejects partial brackets", () => {
      expect(parseWikilink("[Foo]")).toBeNull();
    });
    test("rejects mismatched brackets", () => {
      expect(parseWikilink("[[Foo]")).toBeNull();
    });
    test("malformed empty alias [[Foo|]] — current contract: pipe absorbed into path", () => {
      // Pre-refactor regex behaviour preserved verbatim. Obsidian does
      // not emit this shape in practice, so the degraded output is
      // acceptable. Pinned here to detect future regressions.
      expect(parseWikilink("[[Foo|]]")).toEqual({ path: "Foo|" });
    });
  });

  // ── formatWikilink ───────────────────────────────────
  describe("formatWikilink", () => {
    test("path only", () => {
      expect(formatWikilink({ path: "X" })).toBe("[[X]]");
    });
    test("path with alias", () => {
      expect(formatWikilink({ path: "X", alias: "y" })).toBe("[[X|y]]");
    });
    test("nested path", () => {
      expect(formatWikilink({ path: "A/B/C" })).toBe("[[A/B/C]]");
    });
    test("round-trips parseWikilink (no alias)", () => {
      const orig = "[[Projects/Acme]]";
      expect(formatWikilink(parseWikilink(orig)!)).toBe(orig);
    });
    test("round-trips parseWikilink (with alias)", () => {
      const orig = "[[Projects/Acme|Acme]]";
      expect(formatWikilink(parseWikilink(orig)!)).toBe(orig);
    });
  });

  // ── isWikilink ───────────────────────────────────────
  describe("isWikilink", () => {
    test("true for [[X]]", () => expect(isWikilink("[[X]]")).toBe(true));
    test("true for [[X|y]]", () => expect(isWikilink("[[X|y]]")).toBe(true));
    test("false for plain", () => expect(isWikilink("plain")).toBe(false));
    test("false for partial", () => expect(isWikilink("[[Foo")).toBe(false));
  });

  // ── extractWikilinks ─────────────────────────────────
  describe("extractWikilinks", () => {
    test("single", () => {
      expect(extractWikilinks("see [[Foo]]")).toEqual(["Foo"]);
    });
    test("multiple in order", () => {
      expect(extractWikilinks("[[A]] then [[B]] and [[C]]")).toEqual(["A", "B", "C"]);
    });
    test("with alias drops alias", () => {
      expect(extractWikilinks("[[Foo|Display]]")).toEqual(["Foo"]);
    });
    test("with #heading drops heading", () => {
      expect(extractWikilinks("[[Note#Section]]")).toEqual(["Note"]);
    });
    test("returns [] for plain text", () => {
      expect(extractWikilinks("no links here")).toEqual([]);
    });
    test("respects max cap", () => {
      const src = "[[A]] [[B]] [[C]] [[D]]";
      expect(extractWikilinks(src, 2)).toEqual(["A", "B"]);
    });
    test("re-entrant — repeated calls return same result", () => {
      const src = "[[A]] [[B]]";
      expect(extractWikilinks(src)).toEqual(["A", "B"]);
      expect(extractWikilinks(src)).toEqual(["A", "B"]);
    });
  });

  // ── stripToPath ──────────────────────────────────────
  describe("stripToPath", () => {
    test("canonical target from [[X]]", () => {
      expect(stripToPath("[[Foo]]")).toBe("Foo");
    });
    test("canonical target drops alias", () => {
      expect(stripToPath("[[Foo|Bar]]")).toBe("Foo");
    });
    test("plain string trimmed and returned", () => {
      expect(stripToPath("  plain  ")).toBe("plain");
    });
    test("nested path preserved", () => {
      expect(stripToPath("[[A/B/C]]")).toBe("A/B/C");
    });
    test("non-wikilink with brackets returned as-is (trimmed)", () => {
      expect(stripToPath("[Foo]")).toBe("[Foo]");
    });
  });

  // ── stripToDisplay ───────────────────────────────────
  describe("stripToDisplay", () => {
    test("returns alias when present", () => {
      expect(stripToDisplay("[[Foo/Bar|Display]]")).toBe("Display");
    });
    test("returns path when no alias", () => {
      expect(stripToDisplay("[[Foo]]")).toBe("Foo");
    });
    test("returns plain string unchanged (trimmed)", () => {
      expect(stripToDisplay("  hello  ")).toBe("hello");
    });
    test("nested path preserved without alias", () => {
      expect(stripToDisplay("[[A/B]]")).toBe("A/B");
    });
  });

  // ── Regex exports — sanity ───────────────────────────
  describe("regex exports", () => {
    test("anchored pattern matches single wikilink", () => {
      expect(WIKILINK_RE_ANCHORED.test("[[X]]")).toBe(true);
    });
    test("anchored pattern rejects multi-wikilink string", () => {
      expect(WIKILINK_RE_ANCHORED.test("[[X]] [[Y]]")).toBe(false);
    });
    test("global pattern is global", () => {
      expect(WIKILINK_RE_GLOBAL.global).toBe(true);
    });
  });
});

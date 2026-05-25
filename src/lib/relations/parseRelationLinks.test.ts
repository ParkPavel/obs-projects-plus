// #045.3 — Unit tests for the canonical relation-value parser.

import { parseRelationLinks } from "./parseRelationLinks";

describe("parseRelationLinks", () => {
  describe("null / empty", () => {
    it("returns [] for null", () => {
      expect(parseRelationLinks(null)).toEqual([]);
    });
    it("returns [] for undefined", () => {
      expect(parseRelationLinks(undefined)).toEqual([]);
    });
    it("returns [] for empty string", () => {
      expect(parseRelationLinks("")).toEqual([]);
    });
    it("returns [] for empty array", () => {
      expect(parseRelationLinks([])).toEqual([]);
    });
  });

  describe("array input", () => {
    it("returns string array as-is", () => {
      expect(parseRelationLinks(["A", "B"])).toEqual(["A", "B"]);
    });
    it("strips wikilink wrappers in array items", () => {
      expect(parseRelationLinks(["[[A]]", "[[B]]"])).toEqual(["A", "B"]);
    });
    it("strips alias suffix in array items", () => {
      expect(parseRelationLinks(["[[A|Alpha]]", "[[B|Beta]]"])).toEqual(["A", "B"]);
    });
    it("coerces non-string array items", () => {
      expect(parseRelationLinks([1, 2, 3])).toEqual(["1", "2", "3"]);
    });
    it("drops null/empty items inside arrays", () => {
      expect(parseRelationLinks(["A", "", null as unknown as string, "B"])).toEqual(["A", "B"]);
    });
    it("trims whitespace in array items", () => {
      expect(parseRelationLinks(["  A  ", " B"])).toEqual(["A", "B"]);
    });
  });

  describe("wikilink string input", () => {
    it("extracts a single wikilink body", () => {
      expect(parseRelationLinks("[[A]]")).toEqual(["A"]);
    });
    it("extracts multiple wikilinks separated by spaces", () => {
      expect(parseRelationLinks("[[A]] [[B]]")).toEqual(["A", "B"]);
    });
    it("extracts multiple wikilinks separated by commas", () => {
      expect(parseRelationLinks("[[A]], [[B]], [[C]]")).toEqual(["A", "B", "C"]);
    });
    it("strips alias suffix in wikilink strings", () => {
      expect(parseRelationLinks("[[A|Alpha]] [[B|Beta]]")).toEqual(["A", "B"]);
    });
    it("ignores text outside wikilinks when at least one is present", () => {
      expect(parseRelationLinks("prefix [[A]] middle [[B]] suffix")).toEqual(["A", "B"]);
    });
  });

  describe("comma-split fallback", () => {
    it("splits plain comma-separated string", () => {
      expect(parseRelationLinks("A, B, C")).toEqual(["A", "B", "C"]);
    });
    it("trims whitespace around items", () => {
      expect(parseRelationLinks("  A  ,  B  ")).toEqual(["A", "B"]);
    });
    it("drops empty fragments", () => {
      expect(parseRelationLinks("A,,B,,,")).toEqual(["A", "B"]);
    });
    it("treats single token without comma as one item", () => {
      expect(parseRelationLinks("OnlyOne")).toEqual(["OnlyOne"]);
    });
  });

  describe("other primitives", () => {
    it("coerces a number to single-element array", () => {
      expect(parseRelationLinks(42)).toEqual(["42"]);
    });
    it("coerces a boolean to single-element array", () => {
      expect(parseRelationLinks(true)).toEqual(["true"]);
    });
  });
});

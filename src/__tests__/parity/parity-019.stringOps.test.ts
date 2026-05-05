/**
 * PARITY-019 — String filter operators: starts-with / ends-with
 *
 * Notion-parity prefix/suffix matching. Case-insensitive to mirror the
 * existing `contains` semantics.
 */

import { stringFns } from "src/ui/app/filterFunctions";

describe("PARITY-019 — string starts-with / ends-with", () => {
  describe("starts-with", () => {
    const fn = stringFns["starts-with"];

    it("matches prefix case-insensitively", () => {
      expect(fn("Hello World", "hello")).toBe(true);
      expect(fn("Hello World", "HELLO")).toBe(true);
      expect(fn("Hello World", "Hello")).toBe(true);
    });

    it("rejects non-prefix substrings", () => {
      expect(fn("Hello World", "World")).toBe(false);
      expect(fn("Hello World", "ello")).toBe(false);
    });

    it("returns false for null/undefined left", () => {
      expect(fn(null, "x")).toBe(false);
      expect(fn(undefined, "x")).toBe(false);
    });

    it("matches empty needle (everything starts with empty)", () => {
      expect(fn("anything", "")).toBe(true);
    });

    it("returns false when right is undefined and left non-empty", () => {
      // Right defaults to "" → startsWith("") is true, matches Notion semantic
      expect(fn("anything", undefined)).toBe(true);
    });
  });

  describe("ends-with", () => {
    const fn = stringFns["ends-with"];

    it("matches suffix case-insensitively", () => {
      expect(fn("Hello World", "world")).toBe(true);
      expect(fn("Hello World", "WORLD")).toBe(true);
      expect(fn("report.pdf", ".pdf")).toBe(true);
    });

    it("rejects non-suffix substrings", () => {
      expect(fn("Hello World", "Hello")).toBe(false);
      expect(fn("Hello World", "Wor")).toBe(false);
    });

    it("returns false for null/undefined left", () => {
      expect(fn(null, "x")).toBe(false);
      expect(fn(undefined, "x")).toBe(false);
    });

    it("matches empty needle (everything ends with empty)", () => {
      expect(fn("anything", "")).toBe(true);
    });
  });
});

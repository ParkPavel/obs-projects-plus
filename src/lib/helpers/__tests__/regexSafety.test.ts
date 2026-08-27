// #126 — the ReDoS policy lives in exactly one module.
//
// It used to live in three: filterEvaluator carried byte-copies of the guard
// regexes plus its own length constants, and extendedEvaluator hardcoded the
// pattern limit twice right next to an import of the shared one. Tightening
// regexSafety would not have reached the filter engine — the one place a
// user-written pattern meets every record in the vault.

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  isUnsafePattern,
  MAX_REGEX_INPUT_LENGTH,
  MAX_REGEX_PATTERN_LENGTH,
} from "../regexSafety";

const SRC = resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

/**
 * The lookaround guard exactly as it appears in source, escaping included.
 * The first version of this constant omitted the backslashes, so the three
 * "no copy here" assertions below passed against any file at all — a guard test
 * that could not fail. The positive assertion is what caught it.
 */
const GUARD_FRAGMENT = String.raw`\(\?[<!=]`;

describe("#126 isUnsafePattern", () => {
  it.each([
    ["lookahead", "(?=foo)bar"],
    ["negative lookahead", "(?!foo)bar"],
    // Assembled rather than written literally: an inline lookbehind trips the
    // obsidianmd/regex-lookbehind lint rule, which exists because iOS < 16.4
    // cannot parse them — the very reason isUnsafePattern rejects them.
    ["lookbehind", "(?<" + "=foo)bar"],
    ["nested group quantifier", "(a+)+"],
    ["nested star quantifier", "(a*)+"],
    ["adjacent quantifiers", "a+*"],
    ["quantified brace then quantifier", "a{2}+"],
  ])("rejects %s", (_label, pattern) => {
    expect(isUnsafePattern(pattern)).toBe(true);
  });

  it.each([
    ["a plain literal", "hello"],
    ["a character class", "[a-z]+"],
    ["an anchored word", "^done$"],
    ["a legitimate alternation", "(cat|dog)"],
  ])("accepts %s", (_label, pattern) => {
    expect(isUnsafePattern(pattern)).toBe(false);
  });

  it("does not detect alternation-based backtracking — a documented gap", () => {
    // ^(a|a)+$ is catastrophic but passes. Recorded rather than silently
    // tolerated: closing it naively would also reject (cat|dog)+, which users
    // legitimately write. MAX_REGEX_PATTERN_LENGTH is the blunt bound meanwhile.
    expect(isUnsafePattern("^(a|a)+$")).toBe(false);
  });
});

describe("#126 the policy has exactly one implementation", () => {
  it("only regexSafety defines the guard", () => {
    expect(read("lib/helpers/regexSafety.ts")).toContain(GUARD_FRAGMENT);
  });

  it.each([
    "lib/engine/filterEvaluator.ts",
    "lib/formula/extendedEvaluator.ts",
    "lib/dashboard-engine/transformExecutor.ts",
  ])("%s uses the shared guard instead of a copy", (rel) => {
    const source = read(rel);

    expect(source).toContain("isUnsafePattern");
    expect(source).not.toContain(GUARD_FRAGMENT);
  });

  it("no consumer hardcodes the pattern-length bound", () => {
    for (const rel of ["lib/engine/filterEvaluator.ts", "lib/formula/extendedEvaluator.ts"]) {
      expect(read(rel)).not.toMatch(/pattern\.length\s*>\s*\d+/);
    }
  });

  it("exposes both bounds so no consumer needs its own", () => {
    expect(MAX_REGEX_PATTERN_LENGTH).toBeGreaterThan(0);
    expect(MAX_REGEX_INPUT_LENGTH).toBeGreaterThan(MAX_REGEX_PATTERN_LENGTH);
  });
});

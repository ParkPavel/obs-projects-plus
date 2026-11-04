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
  compileSafeRegex,
  getRegexPatternIssue,
  isUnsafePattern,
  MAX_REGEX_INPUT_LENGTH,
  MAX_REGEX_PATTERN_LENGTH,
} from "../regexSafety";

const SRC = resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

const ANALYZER_FRAGMENT = "function analyzePattern";

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
    ["overlapping alternatives in a repeated group", "^(a|aa)+$"],
    // R22 probe: these short ambiguous alternatives passed the former
    // heuristic but stalled native RegExp on a short near-match.
    ["duplicate alternatives in a repeated group", "^(a|a)+$"],
    ["duplicate multi-character alternatives in a repeated group", "^(ab|ab)+$"],
    ["overlapping repeated atoms", "^a*a*a*b$"],
    ["overlapping repeats separated by their own literal", "^a+aa+$"],
    ["escaped overlapping separator", "^a+\\x61a+$"],
    ["backreferences", "^(a+)\\1$"],
  ])("rejects %s", (_label, pattern) => {
    expect(isUnsafePattern(pattern)).toBe(true);
  });

  it.each([
    ["a plain literal", "hello"],
    ["a character class", "[a-z]+"],
    ["an anchored word", "^done$"],
    ["repeats separated by a disjoint literal", "^a+ba+$"],
    ["a legitimate alternation", "(cat|dog)"],
    ["disjoint alternatives in a repeated group", "^(?:cat|dog)+$"],
    ["escaped regex syntax", String.raw`^\(\+\)\*$`],
    ["legacy non-Unicode brace escape", String.raw`\u{61}`],
    ["quantifier characters inside a class", "^[+*]+$"],
  ])("accepts %s", (_label, pattern) => {
    expect(isUnsafePattern(pattern)).toBe(false);
  });

  it("keeps disjoint alternatives safe when matching case-insensitively", () => {
    expect(isUnsafePattern("^(?:cat|dog)+$", "i")).toBe(false);
    expect(isUnsafePattern("^[a-z]+$", "i")).toBe(false);
  });

  it("rejects case-insensitive overlapping alternatives in a repeated group", () => {
    expect(isUnsafePattern("^(a|A)+$", "i")).toBe(true);
  });

  it("rejects case-insensitive overlap between a range and a literal", () => {
    expect(isUnsafePattern("^(?:[a-z]|A)+$", "i")).toBe(true);
  });

  it("rejects repeated non-ASCII alternatives when case folding is unknown", () => {
    expect(isUnsafePattern("^(?:é|è)+$", "i")).toBe(true);
  });
});

describe("#126 the policy has exactly one implementation", () => {
  it("only regexSafety defines the structural analyzer", () => {
    expect(read("lib/helpers/regexSafety.ts")).toContain(ANALYZER_FRAGMENT);
  });

  it.each([
    "lib/engine/filterEvaluator.ts",
    "lib/formula/computedFunctions.ts",
    "lib/dashboard-engine/transformExecutor.ts",
  ])("%s uses the shared guard instead of a copy", (rel) => {
    const source = read(rel);

    expect(source).toContain("compileSafeRegex");
    expect(source).not.toContain(ANALYZER_FRAGMENT);
  });

  it("no consumer hardcodes the pattern-length bound", () => {
    for (const rel of ["lib/engine/filterEvaluator.ts", "lib/formula/computedFunctions.ts"]) {
      expect(read(rel)).not.toMatch(/pattern\.length\s*>\s*\d+/);
    }
  });

  it("exposes both bounds so no consumer needs its own", () => {
    expect(MAX_REGEX_PATTERN_LENGTH).toBeGreaterThan(0);
    expect(MAX_REGEX_INPUT_LENGTH).toBeGreaterThan(MAX_REGEX_PATTERN_LENGTH);
  });

  it("compiles only valid patterns within the shared safety policy", () => {
    expect(compileSafeRegex("^alpha$", "i")).toMatchObject({ ok: true });
    expect(getRegexPatternIssue("[")).toBe("invalid");
    expect(getRegexPatternIssue("^(a|a)+$")).toBe("unsafe");
    expect(getRegexPatternIssue("a".repeat(MAX_REGEX_PATTERN_LENGTH + 1))).toBe("too-long");
  });

  it("compiles exact-match patterns with grouped alternatives and preserved captures", () => {
    const result = compileSafeRegex("(foo|bar)(\\d+)", "", { fullMatch: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.regex.exec("bar2")?.[1]).toBe("bar");
    expect(result.regex.exec("xbar2")).toBeNull();
    expect(result.regex.exec("foo2tail")).toBeNull();
  });

  it("applies the pattern limit to user text, not the exact-match wrapper", () => {
    expect(compileSafeRegex("a".repeat(MAX_REGEX_PATTERN_LENGTH), "", { fullMatch: true }).ok).toBe(true);
  });
  it.each([
    ["foo", "i", "FOO foo"],
    ["\\s", "g", "x\ufeff\u00a0 y"],
    [".", "g", "😀x"],
    ["^([a-z]+)-(\\d+)$", "i", "Item-42"],
    ["\\q", "", "q"],
    ["^\\d{1,2}:\\d{2}$", "", "09:30"],
    ["(?<word>foo)", "g", "foo foo"],
  ])("admitted %s /%s keeps native matching, captures and replacement", (pattern, flags, text) => {
    const result = compileSafeRegex(pattern, flags);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(text.match(result.regex)).toEqual(text.match(new RegExp(pattern, flags)));
    const replacement = compileSafeRegex(pattern, flags); if (!replacement.ok) throw new Error("Admission changed");
    expect(text.replace(replacement.regex, "<$&:$1>")).toBe(text.replace(new RegExp(pattern, flags), "<$&:$1>"));
  });
  it("does not execute Unicode set syntax without analysis support", () => {
    expect(compileSafeRegex("alpha", "v").ok).toBe(false);
  });
});

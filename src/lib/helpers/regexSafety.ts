// src/lib/helpers/regexSafety.ts

/**
 * Validate a regex pattern for safety.
 * Rejects lookbehind/lookahead (iOS <16.4 compat) and nested quantifiers (ReDoS).
 */
export function isUnsafePattern(pattern: string): boolean {
  // Lookahead/lookbehind — iOS <16.4 compat
  if (/\(\?[<!=]/.test(pattern)) return true;
  // Adjacent quantifiers: a++, a*+, a{2}+, etc.
  if (/(\+|\*|\{[^}]*\})\s*(\+|\*|\{)/.test(pattern)) return true;
  // Nested group quantifiers: (a+)+, (a*)+, (a{n})*
  if (/\([^)]*(\+|\*|\{[^}]*\})\)\s*(\+|\*|\{)/.test(pattern)) return true;
  return false;
}

/** Maximum input string length for regex operations */
export const MAX_REGEX_INPUT_LENGTH = 10_000;

/**
 * Maximum length of a user-supplied pattern.
 *
 * A long pattern is not unsafe by itself, but every extra construct multiplies
 * the backtracking `isUnsafePattern` cannot see — most notably alternation
 * (`^(a|a)+$` passes the checks above). This bound is the blunt second line of
 * defence for exactly that.
 *
 * Known gap, deliberately left open: alternation inside a quantified group is
 * not detected. Closing it naively would also reject legitimate patterns like
 * `(cat|dog)+` that users write in their own formulas, so it needs a real
 * analyser rather than another regex. It is now a one-file change (#126).
 */
export const MAX_REGEX_PATTERN_LENGTH = 200;

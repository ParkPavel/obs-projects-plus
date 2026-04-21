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

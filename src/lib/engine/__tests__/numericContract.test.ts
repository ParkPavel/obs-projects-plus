/**
 * The numeric-coercion contract (#180a, T1 of SPEC_MATH_SPREADSHEET_2026-09-02 §2.2).
 *
 * `NUMERIC_COERCION_CASES` is the project's ONE table of what counts as a
 * number. Every suite that asserts coercion behaviour imports it from here
 * rather than restating cases: a copied table is a second implementation of the
 * contract, and five coexisting implementations are what this ticket exists to
 * remove (§2.3).
 *
 * The expected column is `toNumber`'s result. The cases are the §2.2 minimum
 * list plus the string forms of the grammar's own edges, and each rejection is
 * a defect this codebase actually shipped:
 *
 *   - `"12abc"` → null. `parseFloat` returned 12 at ingest AND in the kernel.
 *     The user rejected it 2026-09-02; Excel and Sheets both IGNORE text rather
 *     than parse a prefix (§1 [1][2]).
 *   - `""` / `"  "` → null, not 0. `Number("") === 0` was the pipeline's silent
 *     zero. An empty cell is not a zero and is not in a denominator (§1.2).
 *   - `"0x10"` → null. `Number` said 16 and `parseFloat` said 0 — two
 *     implementations, two wrong answers.
 *   - `"1,5"` → null (text). BACKLOG #180 RESOLVED 2026-09-02 (2): frontmatter
 *     is YAML, and a comma makes `[1,5]` and `"1,5"` indistinguishable.
 *   - `"1e3"` → 1000. Same block (3): the grammar carries the exponent.
 *   - `NaN` / `Infinity` → null. Both were pushed straight into SUM, poisoning
 *     the whole reduction; after ingest ran `parseFloat`, every `hours: abc`
 *     WAS a literal NaN.
 *   - `true` / `false` → null. Excel ignores logical values in AVERAGE [1];
 *     booleans are served by count_checked / percent_true.
 *   - `Date` → null. Dates are served by earliest / latest / date_range.
 */

import { isNumeric, toNumber, toNumbers } from "src/lib/engine/numeric";

export interface NumericCoercionCase {
  /** Human-readable input, used as the test name. */
  readonly label: string;
  readonly input: unknown;
  /** What `toNumber` must return. */
  readonly expected: number | null;
}

export const NUMERIC_COERCION_CASES: readonly NumericCoercionCase[] = [
  // Finite JS numbers pass through untouched.
  { label: "1", input: 1, expected: 1 },
  { label: "0", input: 0, expected: 0 },
  { label: "-1", input: -1, expected: -1 },
  { label: "1.5", input: 1.5, expected: 1.5 },
  { label: ".5", input: 0.5, expected: 0.5 },
  { label: "1e3", input: 1e3, expected: 1000 },

  // Strings: trimmed, then matched whole against the grammar.
  { label: '"1"', input: "1", expected: 1 },
  { label: '" 1 "', input: " 1 ", expected: 1 },
  { label: '"-1.5"', input: "-1.5", expected: -1.5 },
  { label: '"+1"', input: "+1", expected: 1 },
  { label: '".5"', input: ".5", expected: 0.5 },
  { label: '"1."', input: "1.", expected: 1 },
  { label: '"1e3"', input: "1e3", expected: 1000 },
  { label: '"1E-3"', input: "1E-3", expected: 0.001 },
  { label: '"0"', input: "0", expected: 0 },

  // Strings that are not numbers. Each is a shipped defect (see header).
  { label: '"" (empty)', input: "", expected: null },
  { label: '"  " (blank)', input: "  ", expected: null },
  { label: '"12abc" (prefix parse)', input: "12abc", expected: null },
  { label: '"abc"', input: "abc", expected: null },
  { label: '"0x10" (hex)', input: "0x10", expected: null },
  { label: '"1,5" (decimal comma)', input: "1,5", expected: null },
  { label: '"1_000" (separator)', input: "1_000", expected: null },
  { label: '"NaN"', input: "NaN", expected: null },
  { label: '"Infinity"', input: "Infinity", expected: null },
  { label: '"2026-01-01" (date string)', input: "2026-01-01", expected: null },
  { label: '"." (no digits)', input: ".", expected: null },
  { label: '"1e" (dangling exponent)', input: "1e", expected: null },
  { label: '"-" (sign only)', input: "-", expected: null },

  // Non-finite numbers are not numbers.
  { label: "NaN", input: NaN, expected: null },
  { label: "Infinity", input: Infinity, expected: null },
  { label: "-Infinity", input: -Infinity, expected: null },

  // Booleans, dates, absence, containers.
  { label: "true", input: true, expected: null },
  { label: "false", input: false, expected: null },
  { label: "null", input: null, expected: null },
  { label: "undefined", input: undefined, expected: null },
  { label: "Date", input: new Date("2026-01-01T00:00:00Z"), expected: null },
  { label: "{}", input: {}, expected: null },
  { label: "[]", input: [], expected: null },
  { label: "[1]", input: [1], expected: null },
];

describe("toNumber — the project's only definition of a number (#180a)", () => {
  it.each(NUMERIC_COERCION_CASES)("$label", ({ input, expected }) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe("isNumeric agrees with toNumber on every case", () => {
  it.each(NUMERIC_COERCION_CASES)("$label", ({ input, expected }) => {
    expect(isNumeric(input)).toBe(expected !== null);
  });
});

describe("toNumbers keeps the numbers and drops the rest", () => {
  it("maps and drops in one pass, preserving order", () => {
    const input = NUMERIC_COERCION_CASES.map((c) => c.input);
    const expected = NUMERIC_COERCION_CASES.map((c) => c.expected).filter(
      (n): n is number => n !== null
    );
    expect(toNumbers(input)).toEqual(expected);
  });

  it("returns an empty array when nothing is numeric", () => {
    expect(toNumbers(["", "abc", null, undefined, true, {}])).toEqual([]);
  });

  it("does not flatten nested arrays — an array is not a number", () => {
    expect(toNumbers([[1, 2], 3])).toEqual([3]);
  });
});

describe("the named regressions, spelled out (#180a acceptance)", () => {
  it('"12abc" is not 12', () => {
    expect(toNumber("12abc")).toBeNull();
  });

  it('"" is not 0', () => {
    expect(toNumber("")).toBeNull();
  });

  it('"1e3" is 1000', () => {
    expect(toNumber("1e3")).toBe(1000);
  });

  it('"1,5" is text', () => {
    expect(toNumber("1,5")).toBeNull();
  });

  it("NaN is not a number", () => {
    expect(toNumber(NaN)).toBeNull();
  });
});

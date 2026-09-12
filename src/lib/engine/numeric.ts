/**
 * The project's ONE definition of "this value is a number" (#180a).
 *
 * ## Why one rule
 *
 * Five implementations coexisted, each with its own answer
 * (`SPEC_MATH_SPREADSHEET_2026-09-02.md` §2.3): `parseFloat` at ingest
 * (`datasources/helpers.ts`) and in the kernel (`engine/aggregate.ts`),
 * `Number` plus a `!== ""` guard in the footer
 * (`dashboard-engine/aggregation.ts`), `Number` with NO such guard in the
 * pipeline (`dashboard-engine/transformExecutor.ts`), and
 * `parseFloat(String(x ?? ""))` on the scatter axes (`chartDataPipeline.ts`).
 * So `"12abc"` was 12 in two of them and NaN in two, `""` was 0 in one and
 * dropped in another, and `"0x10"` was 16 here and 0 there — two
 * implementations, two wrong answers. Each was individually green, which is
 * why no gate saw it. This module is the only place the question is answered.
 *
 * ## The references
 *
 * Text is never parsed as a number. Excel: "If a range or cell reference
 * argument contains text, logical values, or empty cells, those values are
 * IGNORED". Google Sheets: "Any text encountered in the value arguments will be
 * IGNORED". Neither parses a prefix, so `parseFloat("12abc") === 12` had no
 * reference behind it — it was a defect (spec §1, rows 1-2; user's rejection in
 * `BACKLOG.md` #180, RESOLVED 2026-09-02). Excel also states that empty cells
 * are ignored rather than counted as zero, which is why `""` is `null` here and
 * not `0`: an empty cell is not a zero and does not belong in a denominator.
 *
 * ## The boundary — what this module is NOT for
 *
 * Class B sites LEX SOURCE TEXT rather than interpret user data: the `NUMBER`
 * token in `helpers/formulaParser.ts`, the offset token in
 * `helpers/dateFormulaParser.ts`, date validity in `frontmatter/codec.ts`.
 * A lexer has already decided it is looking at a numeric literal; applying a
 * data rule there would be a category error. Those sites keep their own parse
 * and carry a `// coercion-exempt: <reason>` marker, which is what
 * `R0_15_oneNumericCoercion.test.ts` scans for.
 *
 * Because the formula lexer turns a numeric literal into a JS `number` before
 * evaluation, routing a formula argument through `toNumber` is a no-op for
 * literals and applies the rule only to field values — which is why
 * `formula/extendedEvaluator.ts` can route its argument coercion wholesale.
 */

/**
 * A number written out in full, and nothing else: an optional sign, digits with
 * an optional fractional part (or a bare fraction), and an optional exponent.
 *
 * Whole-string by construction — that is the entire point. Anchored at both
 * ends, it rejects `"12abc"` (the prefix parse this ticket removes), `"0x10"`,
 * `"1_000"`, `"NaN"` and `"Infinity"`. It rejects `"1,5"` because frontmatter
 * is YAML and a decimal comma makes `[1,5]` and `"1,5"` indistinguishable
 * (BACKLOG #180, RESOLVED 2026-09-02, decision 2); it accepts `"1e3"` as 1000
 * by the same block, decision 3.
 *
 * Linear, with no nested quantifier and no alternation that can match the same
 * text two ways, so it cannot backtrack catastrophically.
 */
const NUMBER_GRAMMAR = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * The value as a number, or `null` when it is not one.
 *
 * Finite numbers pass through. Strings are trimmed and must match
 * {@link NUMBER_GRAMMAR} whole. Everything else — booleans, `Date`s, `null`,
 * `undefined`, objects and arrays — is not a number.
 *
 * `NaN` and `±Infinity` are NOT numbers: both were previously pushed straight
 * into `SUM`, where a single one poisons the entire reduction, and after ingest
 * ran `parseFloat` every `hours: abc` in a Number field WAS a literal `NaN`.
 *
 * @public
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (s === "" || !NUMBER_GRAMMAR.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Map over the values and drop the ones that are not numbers, preserving order.
 * The only way to get a `number[]` out of user data.
 *
 * Does not flatten: an array element is not a number, so `[[1, 2], 3]` yields
 * `[3]`. Callers holding nested data flatten it themselves, deliberately.
 *
 * @public
 */
export function toNumbers(values: readonly unknown[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    const n = toNumber(value);
    if (n !== null) out.push(n);
  }
  return out;
}

/**
 * Whether the value is a number under this rule. For the numeric-ness tests
 * that must not drift away from the parse — a site that asks "is this numeric?"
 * with its own expression is how the fifth implementation appeared.
 *
 * @public
 */
export function isNumeric(value: unknown): boolean {
  return toNumber(value) !== null;
}

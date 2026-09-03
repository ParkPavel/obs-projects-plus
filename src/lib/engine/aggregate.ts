/**
 * Aggregation kernel — single source of truth for rollup-style reductions.
 *
 * Anchored in: docs/ARCHITECTURE_V4.md §1 (Unified DataEngine) and the
 * legacy IMPLEMENTATION_BLUEPRINT §A.3 (R-6 mitigation).
 *
 * v4.0 (REFACTOR-101) — moved from `src/ui/views/Dashboard/engine/rollup.ts`.
 * The previous location now re-exports for back-compat; new code MUST
 * import from this module.
 *
 * This file carries NO dependency on the view layer: it only consumes
 * `DataValue` / `Optional` from `lib/dataframe`. That isolation is what
 * lets the engine layer ship without pulling Svelte/Obsidian glue.
 *
 * Semantic invariants (do NOT change without bumping aggregate semver):
 *   - `nonNull` filters strictly `undefined`/`null`. An empty string does not
 *     fill a cell; `false` does — an unchecked box is an answer (#180c, the
 *     user's D4). `isFilled` is that rule, shared by the four operators that
 *     ask it, and `count` counts everything non-null regardless.
 *   - Numeric coercion is NOT this module's decision. It belongs to
 *     `engine/numeric.ts`, which is the project's only definition of a
 *     number (#180a). Until 2026-09-02 this header said coercion "accepts
 *     JS numbers and parseable strings" — it was documenting the defect as
 *     the contract, because the private `toNumbers` here used `parseFloat`
 *     and so read `"12abc"` as 12, `"2026-01-01"` as 2026 and `"1_000"` as
 *     1. Text is now ignored rather than parsed, as Excel and Sheets both
 *     specify (SPEC_MATH_SPREADSHEET_2026-09-02 §1).
 *   - All numeric outputs format integers as-is and floats to 2 decimals.
 *   - `value` is the datum and `formattedValue` is how it is written down.
 *     Since #180b no operator returns a display string as its `value`: the
 *     percent family returns a number 0-100 with `"NN%"` beside it
 *     (SPEC_MATH_SPREADSHEET_2026-09-02 §3.2 item 2). `concat` / `show_*` are
 *     not an exception — their datum genuinely is text.
 *   - EMPTY input yields `null` + "—", never a number that looks like an
 *     answer: `avg`/`min`/`max`/`range` over no numeric value (#180a), and
 *     since #180b the percent operators over no population (§3.2 item 3).
 *     `sum` keeps `0` deliberately — the additive identity is a real total of
 *     nothing (BACKLOG #180, RESOLVED 2026-09-02).
 *     `median` joined them in #180c, which closed the three gaps #180a and
 *     #180b had recorded rather than hidden.
 */

import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { toNumbers } from "src/lib/engine/numeric";

// ── Types ─────────────────────────────────────────────────

export type RollupFunction =
  | "count"
  /** R5-004 — total record count including null/empty. */
  | "count_total"
  | "count_values"
  | "count_unique"
  | "count_empty"
  | "percent_empty"
  | "percent_not_empty"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "range"
  | "percent_true"
  | "concat"
  | "concat_unique"
  /** NPLAN-C3 — show all original values as a visual list. */
  | "show_original"
  /** NPLAN-C3 — show unique values as a visual chip list. */
  | "show_unique";

export interface RollupConfig {
  /** Relation field containing wiki-links */
  readonly relationField: string;
  /** Field on the target records to aggregate */
  readonly targetField: string;
  /** Aggregation function */
  readonly function: RollupFunction;
  /** Separator for concat functions */
  readonly separator?: string;
}

export interface RollupResult {
  readonly value: string | number | boolean | null;
  readonly formattedValue: string;
}

// ── Aggregation ─────────────────────────────────────────

/**
 * Apply a rollup aggregation kernel to a list of raw values.
 *
 * @public
 */
export function aggregate(
  values: Optional<DataValue>[],
  config: RollupConfig
): RollupResult {
  const fn = config.function;
  const sep = config.separator ?? ", ";

  const nonNull = values.filter(
    (v): v is DataValue => v !== undefined && v !== null
  );

  switch (fn) {
    case "count":
      return fmtNum(nonNull.length);

    case "count_total":
      return fmtNum(values.length);

    case "count_values":
      return fmtNum(nonNull.filter(isFilled).length);

    case "count_empty": {
      const filled = nonNull.filter(isFilled).length;
      return fmtNum(values.length - filled);
    }

    case "percent_empty": {
      if (values.length === 0) return fmtEmpty();
      const filled = nonNull.filter(isFilled).length;
      return fmtPct(((values.length - filled) / values.length) * 100);
    }

    case "percent_not_empty": {
      if (values.length === 0) return fmtEmpty();
      const filled = nonNull.filter(isFilled).length;
      return fmtPct((filled / values.length) * 100);
    }

    case "count_unique": {
      const set = new Set(nonNull.map(String));
      return fmtNum(set.size);
    }

    case "sum":
      return fmtNum(sumNumbers(nonNull));

    case "avg": {
      const nums = toNumbers(nonNull);
      if (nums.length === 0) return fmtEmpty();
      return fmtNum(nums.reduce((a, b) => a + b, 0) / nums.length);
    }

    case "min": {
      const nums = toNumbers(nonNull);
      return nums.length > 0 ? fmtNum(Math.min(...nums)) : fmtEmpty();
    }

    case "max": {
      const nums = toNumbers(nonNull);
      return nums.length > 0 ? fmtNum(Math.max(...nums)) : fmtEmpty();
    }

    case "median": {
      const nums = toNumbers(nonNull).sort((a, b) => a - b);
      if (nums.length === 0) return fmtEmpty();
      const mid = Math.floor(nums.length / 2);
      const val =
        nums.length % 2 === 0
          ? ((nums[mid - 1] ?? 0) + (nums[mid] ?? 0)) / 2
          : (nums[mid] ?? 0);
      return fmtNum(val);
    }

    case "range": {
      const nums = toNumbers(nonNull);
      if (nums.length === 0) return fmtEmpty();
      return fmtNum(Math.max(...nums) - Math.min(...nums));
    }

    case "percent_true": {
      if (nonNull.length === 0) return fmtEmpty();
      const trueCount = nonNull.filter(
        (v) => v === true || v === "true"
      ).length;
      return fmtPct((trueCount / nonNull.length) * 100);
    }

    case "concat":
      return fmtStr(nonNull.map(String).join(sep));

    case "concat_unique": {
      const unique = [...new Set(nonNull.map(String))];
      return fmtStr(unique.join(sep));
    }

    case "show_original":
      return fmtStr(nonNull.map(String).join(sep));

    case "show_unique": {
      const uniq = [...new Set(nonNull.map(String))];
      return fmtStr(uniq.join(sep));
    }

    default:
      return { value: null, formattedValue: "" };
  }
}

// ── Helpers ─────────────────────────────────────────────

function sumNumbers(values: DataValue[]): number {
  return toNumbers(values).reduce((a, b) => a + b, 0);
}

/**
 * Does this value fill its cell? One predicate for the four operators that ask
 * — `count_values`, `count_empty`, `percent_empty`, `percent_not_empty` — so
 * they cannot drift apart, which is the whole shape of #180.
 *
 * **An unchecked box is an answer, not a blank** (BACKLOG #180, RESOLVED
 * 2026-09-02, D4). Until #180c the four read `v !== "" && v !== false`, so over
 * `[false]` this kernel reported 100% empty while the footer, which never
 * excluded `false`, reported 0% — the same question, two answers, visible in
 * the product. `count_checked` / `percent_true` exist for the other question,
 * "how many are true", and are unaffected.
 */
function isFilled(v: DataValue): boolean {
  return v !== "";
}

/**
 * No numeric input at all. Distinct from a numeric zero, and printed as the
 * placeholder the footer has always used for "nothing here" (`aggregation.ts`
 * has surfaced `null` + "—" for min/max/range since before this rule existed).
 *
 * #180a made this reachable where it was not. Before it, a Number field
 * holding `abc` became `NaN` at ingest and `NaN` survived `toNumbers`, so an
 * average of nothing rendered the visible nonsense `NaN`. Now the value is
 * dropped, the list is genuinely empty, and returning 0 would print a number
 * that looks like an answer. `sum` keeps 0 deliberately — the additive
 * identity is a real total of nothing (BACKLOG #180, RESOLVED 2026-09-02).
 * Found by the Codex adversarial review of #180a, which named the footer path
 * `computeAggregations` where the guard `computeAggregateValue` already had
 * was missing.
 *
 * #180b extends the same answer to the percent operators over an empty
 * population (§3.2 item 3). `"0%"` of nothing is not a small percentage, it is
 * a claim about a population that does not exist — and it is indistinguishable
 * in the cell from a real 0%, which is the one thing a reader would act on.
 */
function fmtEmpty(): RollupResult {
  return { value: null, formattedValue: "—" };
}

/**
 * A percentage is a number, and `"NN%"` is how it is written down (#180b,
 * SPEC_MATH_SPREADSHEET_2026-09-02 §3.2 item 2).
 *
 * Until now the percent operators put `"57%"` in `value` — the display string
 * standing in for the datum — while `RollupResult` had carried a
 * `formattedValue` field for exactly that purpose since it was written. Every
 * consumer therefore had to parse the sign back off to get at the number
 * (`RollupCellRenderer.parsePercent`, `GridRollupCell.parsePercent`), and the
 * two other implementations of the same operators already returned a number
 * (`dashboard-engine/aggregation.ts`, `transformExecutor.ts` `PCT_*`). The
 * kernel was the odd one out.
 *
 * `value` keeps the unrounded percentage so it agrees digit for digit with
 * `computeAggregateValue`; rounding is a property of the writing-down, not of
 * the number, so it happens here and only here. The rendered string is
 * byte-identical to what the old `Math.round(...) + "%"` produced.
 */
function fmtPct(pct: number): RollupResult {
  return { value: pct, formattedValue: `${Math.round(pct)}%` };
}


function fmtNum(n: number): RollupResult {
  return {
    value: n,
    formattedValue: Number.isInteger(n) ? String(n) : n.toFixed(2),
  };
}

function fmtStr(s: string): RollupResult {
  return { value: s, formattedValue: s };
}

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
 *   - `nonNull` filters strictly `undefined`/`null`; empty strings and
 *     `false` ARE counted by `count` (only `count_values` excludes them).
 *   - Numeric coercion is NOT this module's decision. It belongs to
 *     `engine/numeric.ts`, which is the project's only definition of a
 *     number (#180a). Until 2026-09-02 this header said coercion "accepts
 *     JS numbers and parseable strings" — it was documenting the defect as
 *     the contract, because the private `toNumbers` here used `parseFloat`
 *     and so read `"12abc"` as 12, `"2026-01-01"` as 2026 and `"1_000"` as
 *     1. Text is now ignored rather than parsed, as Excel and Sheets both
 *     specify (SPEC_MATH_SPREADSHEET_2026-09-02 §1).
 *   - All numeric outputs format integers as-is and floats to 2 decimals.
 *   - The EMPTY-input policy (what `avg`/`min`/`max` return for no numeric
 *     input, and the string-valued percent operators) is untouched by #180a
 *     and belongs to #180b. Dropping a `NaN` that used to be kept can make
 *     that existing policy fire where it previously did not.
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
      return fmtNum(nonNull.filter((v) => v !== "" && v !== false).length);

    case "count_empty": {
      const filled = nonNull.filter((v) => v !== "" && v !== false).length;
      return fmtNum(values.length - filled);
    }

    case "percent_empty": {
      if (values.length === 0) return fmtStr("0%");
      const filled = nonNull.filter((v) => v !== "" && v !== false).length;
      return fmtStr(Math.round(((values.length - filled) / values.length) * 100) + "%");
    }

    case "percent_not_empty": {
      if (values.length === 0) return fmtStr("0%");
      const filled = nonNull.filter((v) => v !== "" && v !== false).length;
      return fmtStr(Math.round((filled / values.length) * 100) + "%");
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
      if (nums.length === 0) return fmtNum(0);
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
      if (nonNull.length === 0) return fmtStr("0%");
      const trueCount = nonNull.filter(
        (v) => v === true || v === "true"
      ).length;
      return fmtStr(
        Math.round((trueCount / nonNull.length) * 100) + "%"
      );
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
 */
function fmtEmpty(): RollupResult {
  return { value: null, formattedValue: "—" };
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

/**
 * filterEvaluator — the filter evaluation kernel (REFACTOR-104).
 *
 * The single place a `FilterDefinition` is evaluated against a `DataRecord`.
 * "One filter engine" is invariant 2 in CLAUDE.md, and it is an invariant
 * because a second copy does not announce itself: it diverges on one operator,
 * for one field type, and the symptom is records quietly missing from a view.
 * Every filtering surface routes here - project filters, dashboard widget
 * scope, the pipeline's `filter` step, the Calendar agenda, cross-project
 * resolution and rollup, the Dataview and native-query datasources. Roughly a
 * dozen modules import this file; do not add a thirteenth implementation.
 *
 * `filterCompose.ts` decides WHICH conditions apply; this file decides whether
 * a record satisfies them.
 *
 * The rules that make the behaviour what it is, all of them load-bearing:
 *
 * - **Dispatch order in `matchesCondition` is the specification.** Emptiness
 *   first, then list-typed values, then `is-any-of`, then string operators
 *   against array values, then the by-type branches, and only then the
 *   absent-value rule. Each branch exists because the one after it gives the
 *   wrong answer for that case - most sharply, the array/string branch must
 *   precede the scalar string branch, or every Relation field silently matches
 *   nothing. Reordering this function is a behaviour change, not a cleanup.
 * - **R2.1c: a negative operator on an absent field returns TRUE.** Absence is
 *   not equality, so `is-not "x"` holds for a record that has no value at all.
 *   Inverting this drops every record whose field is not yet populated, which
 *   is exactly the bug the rule was introduced for.
 * - **Regex safety lives in `lib/helpers/regexSafety.ts` (#126),** never
 *   inline here. This is the one place a user pattern meets every record in
 *   the vault, so a ReDoS guard that does not reach it does not exist.
 * - **`stringFns["is-any-of"]` is an unreachable placeholder.** The operator is
 *   handled by a dedicated branch above the dispatch table, because its
 *   argument is a JSON-encoded array rather than a string. Implementing the
 *   table entry does nothing; the branch is what runs.
 * - **Unknown operator/type combinations return `false`** after a dev-only
 *   warning. A filter that cannot be understood hides records rather than
 *   showing all of them, so a new operator must be added to a dispatch branch
 *   here, not only to the settings union.
 */

import { produce } from "immer";
import dayjs, { type Dayjs } from "dayjs";
import { isDateFormula, parseDateFormula } from "src/lib/formula";
import {
  type DataFrame,
  type DataRecord,
  type DataValue,
  type Optional,
  isNumber,
  isOptionalString,
  isOptionalNumber,
  isOptionalBoolean,
  isOptionalDate,
  isOptionalList,
} from "src/lib/dataframe/dataframe";
import {
  isBooleanFilterOperator,
  isNumberFilterOperator,
  isStringFilterOperator,
  isDateFilterOperator,
  isListFilterOperator,
  type BaseFilterOperator,
  type BooleanFilterOperator,
  type FilterCondition,
  type FilterDefinition,
  type NumberFilterOperator,
  type StringFilterOperator,
  type DateFilterOperator,
  type ListFilterOperator,
} from "src/settings/settings";

import { isEmpty as kernelIsEmpty, isNotEmpty as kernelIsNotEmpty } from "src/lib/engine/emptiness";
import { toNumber } from "src/lib/engine/numeric";
import {
  isUnsafePattern,
  MAX_REGEX_INPUT_LENGTH,
  MAX_REGEX_PATTERN_LENGTH,
} from "src/lib/helpers/regexSafety";

// dayjs isoWeek + quarterOfYear plugins are extended globally in main.ts

/**
 * Per-call semantic overrides. Kept as options rather than separate operators
 * so that one saved filter means the same thing everywhere except where a view
 * deliberately reads it differently.
 */
export interface FilterOpts {
  /** When false, `is-upcoming` excludes the baseDate day (strictly future). Default true (Notion-style). */
  upcomingInclusive?: boolean;
}

/**
 * Evaluate ONE condition against one record. The dispatch order inside this
 * function is the specification of the filter language - see the module
 * header before rearranging it.
 *
 * `baseDateCtx` is the "today" that relative date operators and date formulas
 * resolve against. Passing it explicitly, instead of reading the clock here,
 * is what makes the date operators testable and keeps every condition in one
 * evaluation anchored to the same instant.
 */
export function matchesCondition(
  cond: FilterCondition,
  record: DataRecord,
  baseDateCtx?: Dayjs,
  opts?: FilterOpts
): boolean {
  const { operator } = cond;

  const value: Optional<DataValue> = record.values[cond.field];

  if (operator === "is-empty" || operator === "is-not-empty") {
    return baseFns[operator](value);
  }

  if (isOptionalList(value) && isListFilterOperator(operator)) {
    if (operator === "has-keyword") {
      return listFns[operator](value ?? [], cond.value);
    } else {
      let parsed: DataValue[] | undefined;
      try {
        parsed = cond.value ? JSON.parse(cond.value) : undefined;
      } catch {
        parsed = undefined;
      }
      return listFns[operator](value ?? [], parsed);
    }
  }

  // ── Stage A.9 — is-any-of: field value must be one of a JSON-encoded list ──
  // cond.value = JSON.stringify(string[]) e.g. '["Done","In progress"]'.
  // For array fields (Relation), matches if any element is in the candidate list.
  if (operator === "is-any-of") {
    let candidates: string[];
    try {
      candidates = cond.value ? (JSON.parse(cond.value) as string[]) : [];
    } catch {
      candidates = [];
    }
    if (candidates.length === 0) return false;
    if (Array.isArray(value)) {
      const items = (value as unknown[]).map((v) => (v == null ? "" : String(v)));
      return candidates.some((c) => items.includes(c));
    }
    const strVal = value == null ? "" : String(value);
    return candidates.includes(strVal);
  }

  // ── Stage A.10 — string operators against array values ─────────────
  // Relation/Repeated-String fields are stored as string[]. When the user
  // picks a string-style operator (`is`, `is-not`, `contains`,
  // `not-contains`) we apply it elementwise: ANY-match for affirmative,
  // ALL-must-fail for negative. Without this branch the runtime drops
  // records silently because the list type-guard above only handles list
  // operators.
  if (Array.isArray(value) && isStringFilterOperator(operator)) {
    const arr = value as Array<unknown>;
    if (arr.length === 0) {
      // Empty array: no element to match. Affirmative → false, negative
      // → true. The base "is-empty" branch above only fires when the
      // user picked an explicit emptiness operator.
      return operator === "is-not" || operator === "not-contains";
    }
    const items = arr.map((v) => (v == null ? "" : String(v)));
    if (operator === "is" || operator === "contains") {
      return items.some((s) => stringFns[operator](s, cond.value));
    }
    // negative: all items must fail the affirmative check
    return items.every((s) => stringFns[operator](s, cond.value));
  }

  if (isOptionalString(value) && isStringFilterOperator(operator)) {
    return stringFns[operator](value, cond.value);
  } else if (isOptionalNumber(value) && isNumberFilterOperator(operator)) {
    // #180a: `Number(cond.value)` read the operand the user typed into the
    // filter by a rule the aggregate no longer uses. A filter comparing
    // "12abc" has to agree with an aggregate ignoring it, or axis A and axis C
    // disagree about the same row (FILTER_ORDER_ADR). `?? undefined` keeps the
    // existing "no operand" path for a non-numeric one, which is what the
    // falsy `cond.value` check already did for "".
    return numberFns[operator](value, toNumber(cond.value) ?? undefined);
  } else if (isOptionalBoolean(value) && isBooleanFilterOperator(operator)) {
    return booleanFns[operator](value);
  } else if (isOptionalDate(value) && isDateFilterOperator(operator)) {
    // Resolve date formula in cond.value when baseDateCtx is available
    let rv = cond.value;
    if (rv && baseDateCtx && isDateFormula(rv)) {
      const result = parseDateFormula(rv, baseDateCtx);
      if (result.success && result.date) {
        rv = result.date.format("YYYY-MM-DD");
      }
    }
    // Calendar-style strict upcoming (today excluded) when opts.upcomingInclusive === false
    if (operator === "is-upcoming" && opts?.upcomingInclusive === false) {
      if (!value) return false;
      return dayjs(value).isAfter(baseDateCtx ?? dayjs(), "day");
    }
    return dateFns[operator](value, rv, baseDateCtx);
  }

  // ── Stage A.10 / R2.1c — undefined value against typed operator ────
  // When a record has no value for the field and the user picked a
  // negative-semantics operator, the correct answer is `true`
  // (absence ≠ "x"). Returning `false` here used to silently drop the
  // record from views that filter on Stage A fields not yet populated.
  if (value === undefined || value === null) {
    if (
      operator === "is-not" ||
      operator === "not-contains" ||
      operator === "is-not-on" ||
      operator === "neq" ||
      operator === "has-none-of"
    ) {
      return true;
    }
    return false;
  }

  if (process.env["NODE_ENV"] !== "production") {
    console.warn(`[FilterEngine] Unhandled filter: operator="${operator}", field="${cond.field}"`);
  }
  return false;
}

/**
 * Evaluate a whole filter - conditions plus nested groups - against a record.
 *
 * Three behaviours that are decisions, not accidents:
 *
 * - **An empty filter matches everything.** No conditions and no groups is the
 *   identity, so "no filter configured" shows all records rather than none.
 * - **Disabled conditions are dropped before evaluation,** so a condition the
 *   user switched off cannot influence the conjunction - and `enabled` absent
 *   counts as enabled, which is what keeps filters saved before the flag
 *   existed working.
 * - **Runaway nesting resolves to `true`,** not `false`. Past 20 levels the
 *   group is treated as matching, because the fail-safe for a malformed filter
 *   is to show the records, not to hide the user's data behind a depth limit.
 *
 * `_depth` is internal recursion bookkeeping; callers pass nothing.
 */
export function matchesFilterConditions(
  filter: FilterDefinition,
  record: DataRecord,
  baseDateCtx?: Dayjs,
  opts?: FilterOpts,
  _depth = 0
): boolean {
  if (_depth >= 20) return true; // safety: prevent infinite recursion

  const validConds = filter.conditions.filter((cond) => {
    return cond?.enabled ?? true;
  });

  const condResults = validConds.map((cond) => matchesCondition(cond, record, baseDateCtx, opts));
  const groupResults = (filter.groups ?? []).map((group) =>
    matchesFilterConditions(group, record, baseDateCtx, opts, _depth + 1)
  );
  const allResults = [...condResults, ...groupResults];

  if (!allResults.length) return true;

  if (filter.conjunction === "or") {
    return allResults.some((r) => r);
  }
  return allResults.every((r) => r);
}

/**
 * REFACTOR-104 AC alias: canonical entry point for new code. Equivalent
 * to `matchesFilterConditions(filter, record)`; named to match the
 * ticket's signature `evaluateFilter(record, ir)`.
 */
export function evaluateFilter(
  record: DataRecord,
  filter: FilterDefinition,
  baseDateCtx?: Dayjs,
  opts?: FilterOpts
): boolean {
  return matchesFilterConditions(filter, record, baseDateCtx, opts);
}

/**
 * Filter a whole frame, returning a new one - `produce` keeps the input
 * untouched, which is what lets callers hold the unfiltered frame and
 * re-filter cheaply.
 *
 * Only fields already on the record are visible here. Relation columns are
 * resolved by the enrichment stage that runs BEFORE any filter in the
 * canonical order `enrich -> A -> C -> B -> sort -> render`
 * (FILTER_ORDER_ADR.md); calling this on an unenriched frame silently sees no
 * `__resolved__*` values rather than failing.
 *
 * Note it takes no `baseDateCtx`, so relative date operators resolve against
 * the current clock. Where "today" must be pinned, call
 * `matchesFilterConditions` per record instead.
 */
export function applyFilter(
  frame: DataFrame,
  filter: FilterDefinition
): DataFrame {
  return produce(frame, (draft) => {
    draft.records = draft.records.filter((record) =>
      matchesFilterConditions(filter, record)
    );
  });
}

/**
 * Emptiness, for any field type. Delegated to `lib/engine/emptiness.ts`
 * (REFACTOR-106) because "empty" has to mean the same thing to a filter, a
 * rollup and a `percent_empty` aggregate - an empty string, an empty list and
 * an absent key are all empty, and `0` and `false` are not.
 *
 * These two are checked before any type dispatch, so they work on a field
 * whose type the record does not determine.
 */
export const baseFns: Record<
  BaseFilterOperator,
  (value: Optional<DataValue>) => boolean
> = {
  // REFACTOR-106: delegated to canonical emptiness kernel.
  "is-empty": (value) => kernelIsEmpty(value),
  "is-not-empty": (value) => kernelIsNotEmpty(value),
};

/**
 * #126: the guards live in `lib/helpers/regexSafety.ts`, not here. This file
 * used to carry byte-copies of the three checks plus its own length constants,
 * so tightening the shared policy would silently not reach the filter engine —
 * the one place a pattern meets every record in the vault.
 */
function safeRegexTest(pattern: string, input: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return false;
  if (isUnsafePattern(pattern)) return false;
  try {
    return new RegExp(pattern, "i").test(input.slice(0, MAX_REGEX_INPUT_LENGTH));
  } catch {
    return false;
  }
}

/**
 * String operators. Matching is case-INSENSITIVE for `contains`,
 * `starts-with`, `ends-with` and `regex`, and case-SENSITIVE for `is` and
 * `is-not`, which compare the raw values. That asymmetry is deliberate -
 * equality on a Select or Status value must distinguish two options that
 * differ only in case - and it is the kind of thing a "consistency" refactor
 * quietly breaks.
 *
 * Every entry also decides what an absent value means, and the affirmative and
 * negative operators answer differently: `is`/`contains` are false, while
 * `is-not`/`not-contains` are true, which is R2.1c applied at the leaf.
 *
 * `is-any-of` is a placeholder that never runs; see the module header.
 */
export const stringFns: Record<
  StringFilterOperator,
  (left: Optional<string>, right?: string) => boolean
> = {
  is: (left, right) => (left ? left == right : false),
  // is-any-of is handled by a dedicated branch in matchesCondition before stringFns dispatch.
  "is-any-of": () => false,
  "is-not": (left, right) => (left ? left != right : true),
  contains: (left, right) => (left ? left.toLowerCase().includes((right ?? "").toLowerCase()) : false),
  "not-contains": (left, right) => (left ? !left.toLowerCase().includes((right ?? "").toLowerCase()) : true),
  // PARITY-019 — Notion-parity prefix/suffix matching, case-insensitive.
  "starts-with": (left, right) => (left ? left.toLowerCase().startsWith((right ?? "").toLowerCase()) : false),
  "ends-with": (left, right) => (left ? left.toLowerCase().endsWith((right ?? "").toLowerCase()) : false),
  // R5-003 — regex with ReDoS guards; promoted from Calendar agenda filterEngine.
  regex: (left, right) => (left && right ? safeRegexTest(right, left) : false),
};

/**
 * Numeric comparison. The ordering operators demand that BOTH sides really are
 * numbers, so a missing or non-numeric side is false rather than coerced -
 * without that, `undefined < 5` would be a silent `true` for every record with
 * no value. `eq` / `neq` compare directly, so a record with no value is `neq`
 * to any number the user typed - R2.1c again, and `neq` is additionally listed
 * in the absent-value branch of `matchesCondition` so the answer is the same
 * whichever path a record takes.
 */
export const numberFns: Record<
  NumberFilterOperator,
  (left: Optional<number>, right?: number) => boolean
> = {
  eq: (left, right) => left === right,
  neq: (left, right) => left !== right,
  lt: (left, right) => isNumber(left) && isNumber(right) && left < right,
  gt: (left, right) => isNumber(left) && isNumber(right) && left > right,
  lte: (left, right) => isNumber(left) && isNumber(right) && left <= right,
  gte: (left, right) => isNumber(left) && isNumber(right) && left >= right,
};

/**
 * Checkbox operators. Both test identity against a literal, so an ABSENT
 * checkbox satisfies neither: a record whose frontmatter has no such key is
 * not "unchecked", it is unanswered. Use `is-empty` to find those. Changing
 * `is-not-checked` to `!== true` would fold the two states together and is the
 * obvious-looking edit to resist.
 */
export const booleanFns: Record<
  BooleanFilterOperator,
  (value: Optional<boolean>) => boolean
> = {
  "is-checked": (value) => value === true,
  "is-not-checked": (value) => value === false,
};

/**
 * Date operators. Four conventions hold across the whole table:
 *
 * - **Every comparison is at day granularity.** `dayjs(...).isSame(x, "day")`
 *   throughout, so a time component never makes two dates on the same calendar
 *   day differ.
 * - **`baseDate` is "today", supplied by the caller** and defaulting to the
 *   clock only when absent. Relative operators must never read the clock
 *   themselves, or two conditions in one filter can straddle midnight.
 * - **Rolling windows include today** at the near end: `is-past-*` runs
 *   backwards from today inclusive, `is-next-*` forwards from today inclusive.
 *   That is the Notion reading, and it is why the bounds are written with an
 *   extra day rather than as a plain `isBefore`.
 * - **`is-not-on` is true for an absent date**, alone among these, because it
 *   is the one negative operator here (R2.1c). Everything else is false when
 *   there is no date to compare.
 *
 * `is-upcoming` includes today by default. Setting `upcomingInclusive` to
 * false in `FilterOpts` makes it strictly future, which is what the Calendar
 * uses; that override is applied in `matchesCondition`, before this table is
 * reached.
 */
export const dateFns: Record<
  DateFilterOperator,
  (left: Optional<Date>, rawValue?: string, baseDate?: Dayjs) => boolean
> = {
  "is-on": (left, rv) => {
    if (!left || !rv) return false;
    return dayjs(left).isSame(dayjs(rv), "day");
  },
  "is-not-on": (left, rv) => {
    if (!left || !rv) return true;
    return !dayjs(left).isSame(dayjs(rv), "day");
  },
  "is-before": (left, rv) => {
    if (!left || !rv) return false;
    return dayjs(left).isBefore(dayjs(rv), "day");
  },
  "is-after": (left, rv) => {
    if (!left || !rv) return false;
    return dayjs(left).isAfter(dayjs(rv), "day");
  },
  "is-on-and-before": (left, rv) => {
    if (!left || !rv) return false;
    const l = dayjs(left), r = dayjs(rv);
    return l.isBefore(r, "day") || l.isSame(r, "day");
  },
  "is-on-and-after": (left, rv) => {
    if (!left || !rv) return false;
    const l = dayjs(left), r = dayjs(rv);
    return l.isAfter(r, "day") || l.isSame(r, "day");
  },
  // ── Relative date operators ──
  "is-today": (left, _rv, baseDate) => {
    if (!left) return false;
    return dayjs(left).isSame(baseDate ?? dayjs(), "day");
  },
  "is-this-week": (left, _rv, baseDate) => {
    if (!left) return false;
    const now = baseDate ?? dayjs();
    return dayjs(left).isoWeek() === now.isoWeek() && dayjs(left).year() === now.year();
  },
  "is-this-month": (left, _rv, baseDate) => {
    if (!left) return false;
    return dayjs(left).isSame(baseDate ?? dayjs(), "month");
  },
  "is-this-quarter": (left, _rv, baseDate) => {
    if (!left) return false;
    const now = baseDate ?? dayjs();
    return dayjs(left).quarter() === now.quarter() && dayjs(left).year() === now.year();
  },
  "is-this-year": (left, _rv, baseDate) => {
    if (!left) return false;
    return dayjs(left).isSame(baseDate ?? dayjs(), "year");
  },
  // Notion-style rolling windows: past_* = last N days inclusive of today, next_* = next N days inclusive of today.
  "is-past-week": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isBefore(today, "day"))
      && d.isAfter(today.subtract(7, "day"), "day");
  },
  "is-past-month": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isBefore(today, "day"))
      && d.isAfter(today.subtract(1, "month").subtract(1, "day"), "day");
  },
  "is-past-year": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isBefore(today, "day"))
      && d.isAfter(today.subtract(1, "year").subtract(1, "day"), "day");
  },
  "is-next-week": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isAfter(today, "day"))
      && d.isBefore(today.add(7, "day").add(1, "day"), "day");
  },
  "is-next-month": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isAfter(today, "day"))
      && d.isBefore(today.add(1, "month").add(1, "day"), "day");
  },
  "is-next-year": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isSame(today, "day") || d.isAfter(today, "day"))
      && d.isBefore(today.add(1, "year").add(1, "day"), "day");
  },
  "is-last-n-days": (left, rv, baseDate) => {
    // #180a: `parseInt(rv, 10)` read "7 days" as 7. The operand is user-typed
    // data like every other filter operand; `|| n <= 0` below already rejects
    // a non-number, so `?? 0` keeps that path.
    const n = toNumber(rv) ?? 0;
    if (!left || !n || n <= 0) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return d.isAfter(today.subtract(n, "day"), "day") && (d.isBefore(today, "day") || d.isSame(today, "day"));
  },
  "is-next-n-days": (left, rv, baseDate) => {
    const n = toNumber(rv) ?? 0;
    if (!left || !n || n <= 0) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return (d.isAfter(today, "day") || d.isSame(today, "day")) && d.isBefore(today.add(n, "day"), "day");
  },
  "is-overdue": (left, _rv, baseDate) => {
    if (!left) return false;
    return dayjs(left).isBefore(baseDate ?? dayjs(), "day");
  },
  "is-upcoming": (left, _rv, baseDate) => {
    if (!left) return false;
    const d = dayjs(left);
    const now = baseDate ?? dayjs();
    return d.isAfter(now, "day") || d.isSame(now, "day");
  },
};

/**
 * Set operators over a list field. The right-hand side is an ARRAY, which the
 * caller obtains by `JSON.parse`-ing the stored condition value - list
 * conditions are persisted as a JSON string, and a value that fails to parse
 * arrives here as `undefined`.
 *
 * With no right-hand side, `has-any-of` and `has-all-of` are false and
 * `has-none-of` is true: each is the honest answer for "compared against
 * nothing", and it keeps `has-none-of` the exact complement of `has-any-of`.
 * Membership is by strict equality, so `"1"` and `1` are different elements.
 */
export const listFns_multitext: Record<
  Exclude<ListFilterOperator, "has-keyword">,
  (left: Optional<DataValue>[], right?: Optional<DataValue>[]) => boolean
> = {
  "has-any-of": (left, right) => {
    return right ? right.some((value) => left.includes(value)) : false;
  },
  "has-all-of": (left, right) => {
    return right ? right.every((value) => left.includes(value)) : false;
  },
  "has-none-of": (left, right) => {
    return !(right ? right.some((value) => left.includes(value)) : false);
  },
};

/**
 * Substring search across a list's elements: true when ANY element contains
 * the keyword, case-insensitively.
 *
 * Split from `listFns_multitext` because its right-hand side is a bare string,
 * not a JSON array - which is exactly why `matchesCondition` special-cases
 * `has-keyword` and skips the `JSON.parse` it applies to the other list
 * operators.
 */
export const listFns_text: Record<
  "has-keyword",
  (left: Optional<DataValue>[], right?: string) => boolean
> = {
  "has-keyword": (left, right) => {
    return right
      ? left.some((value) => String(value).toLowerCase().includes(String(right).toLowerCase()))
      : false;
  },
};

/**
 * The two halves merged, so `matchesCondition` can index one table by
 * operator. The halves stay separate above because their right-hand types
 * differ; this union is the lookup, not a third vocabulary.
 */
export const listFns = {
  ...listFns_multitext,
  ...listFns_text,
};

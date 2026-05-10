/**
 * filterEvaluator — canonical filter evaluation kernel (REFACTOR-104).
 *
 * Single source of truth for evaluating `FilterDefinition` against
 * `DataRecord`. Used by:
 *   - `src/ui/app/filterFunctions.ts` (back-compat re-export facade)
 *   - `src/ui/views/Dashboard/engine/transformExecutor.ts::executeFilter`
 *
 * AC (per docs/PHASE_3_TICKETS.md REFACTOR-104):
 *   - R2.1c semantics preserved: negative-semantics operators on
 *     undefined fields return TRUE so that records without the field
 *     populated are not silently dropped.
 *   - `transformExecutor.executeFilter` is ≤30 LOC — already enforced
 *     by delegation to `matchesFilterConditions`.
 *   - ≥60 cases in `__tests__/filterEvaluator.test.ts`.
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

// dayjs isoWeek + quarterOfYear plugins are extended globally in main.ts

export interface FilterOpts {
  /** When false, `is-upcoming` excludes the baseDate day (strictly future). Default true (Notion-style). */
  upcomingInclusive?: boolean;
}

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
    return numberFns[operator](
      value,
      cond.value ? Number(cond.value) : undefined
    );
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

export const baseFns: Record<
  BaseFilterOperator,
  (value: Optional<DataValue>) => boolean
> = {
  // REFACTOR-106: delegated to canonical emptiness kernel.
  "is-empty": (value) => kernelIsEmpty(value),
  "is-not-empty": (value) => kernelIsNotEmpty(value),
};

const MAX_REGEX_LENGTH = 200;
const MAX_REGEX_INPUT = 10000;

function safeRegexTest(pattern: string, input: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) return false;
  // Reject lookbehind / lookahead constructs that can amplify catastrophic backtracking.
  if (/\(\?[<!=]/.test(pattern)) return false;
  // Reject nested quantifiers like (a+)+ or a*{,5}*
  if (/(\+|\*|\{[^}]*\})\s*(\+|\*|\{)/.test(pattern)) return false;
  if (/\([^)]*(\+|\*|\{[^}]*\})\)\s*(\+|\*|\{)/.test(pattern)) return false;
  try {
    return new RegExp(pattern, "i").test(input.slice(0, MAX_REGEX_INPUT));
  } catch {
    return false;
  }
}

export const stringFns: Record<
  StringFilterOperator,
  (left: Optional<string>, right?: string) => boolean
> = {
  is: (left, right) => (left ? left == right : false),
  "is-not": (left, right) => (left ? left != right : true),
  contains: (left, right) => (left ? left.toLowerCase().includes((right ?? "").toLowerCase()) : false),
  "not-contains": (left, right) => (left ? !left.toLowerCase().includes((right ?? "").toLowerCase()) : true),
  // PARITY-019 — Notion-parity prefix/suffix matching, case-insensitive.
  "starts-with": (left, right) => (left ? left.toLowerCase().startsWith((right ?? "").toLowerCase()) : false),
  "ends-with": (left, right) => (left ? left.toLowerCase().endsWith((right ?? "").toLowerCase()) : false),
  // R5-003 — regex with ReDoS guards; promoted from Calendar agenda filterEngine.
  regex: (left, right) => (left && right ? safeRegexTest(right, left) : false),
};

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

export const booleanFns: Record<
  BooleanFilterOperator,
  (value: Optional<boolean>) => boolean
> = {
  "is-checked": (value) => value === true,
  "is-not-checked": (value) => value === false,
};

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
    const n = rv ? parseInt(rv, 10) : 0;
    if (!left || !n || n <= 0) return false;
    const d = dayjs(left), today = baseDate ?? dayjs();
    return d.isAfter(today.subtract(n, "day"), "day") && (d.isBefore(today, "day") || d.isSame(today, "day"));
  },
  "is-next-n-days": (left, rv, baseDate) => {
    const n = rv ? parseInt(rv, 10) : 0;
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

export const listFns = {
  ...listFns_multitext,
  ...listFns_text,
};

// Compatibility implementations extracted before replacing the legacy traversal.
import type { FormulaNode } from "./syntax";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { valueText } from "src/lib/valueText";
import { toNumber } from "src/lib/engine/numeric";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
export type LegacyFunction = (args: FormulaNode[], evaluate: (node: FormulaNode) => Optional<DataValue>, base: dayjs.Dayjs) => Optional<DataValue>;


  /**
   * Smart equality: case-insensitive strings, type coercion, date-aware.
   * Matches behavior of visual-mode 'is' operator for consistency.
   */

  export function legacyEquals(left: unknown, right: unknown): boolean {
    // Both null/undefined
    if (left == null && right == null) return true;
    if (left == null || right == null) return false;

    // Both strings → case-insensitive, trimmed
    if (typeof left === 'string' && typeof right === 'string') {
      const l = left.trim().toLowerCase();
      const r = right.trim().toLowerCase();
      if (l === r) return true;
      // Date-aware: both look like dates → compare as day
      const dl = dayjs(left);
      const dr = dayjs(right);
      if (dl.isValid() && dr.isValid() && isDateLikeStr(left) && isDateLikeStr(right)) {
        return dl.isSame(dr, 'day');
      }
      return false;
    }

    // Number ↔ String coercion (#180a: one rule — `"12abc" = 12` is false,
    // and `"" = 0` is false rather than true via `Number("") === 0`).
    if (typeof left === 'number' && typeof right === 'string') {
      const num = toNumber(right);
      return num !== null && left === num;
    }
    if (typeof left === 'string' && typeof right === 'number') {
      const num = toNumber(left);
      return num !== null && num === right;
    }

    // Boolean ↔ String coercion
    if (typeof left === 'boolean' && typeof right === 'string') {
      return left === (right.toLowerCase() === 'true');
    }
    if (typeof left === 'string' && typeof right === 'boolean') {
      return (left.toLowerCase() === 'true') === right;
    }

    return left === right;
  }


  /** Check if string looks like a date (ISO format or YYYY-MM-DD) */
  function isDateLikeStr(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(s.trim());
  }


  /**
   * Smart comparison for `>`, `<`, `>=`, `<=`.
   * Numbers compared numerically; dates compared by day; strings by locale.
   * Returns negative, zero, or positive like compareTo.
   */

  export function legacyCompare(left: unknown, right: unknown): number {
    // Both null → equal
    if (left == null && right == null) return 0;
    if (left == null) return -1;
    if (right == null) return 1;

    // Number ↔ Number
    if (typeof left === 'number' && typeof right === 'number') {
      return left - right;
    }

    // Number ↔ String coercion (#180a). When the string is not a number the
    // comparison falls through to the string/date branches below, as before.
    if (typeof left === 'number' && typeof right === 'string') {
      const num = toNumber(right);
      if (num !== null) return left - num;
    }
    if (typeof left === 'string' && typeof right === 'number') {
      const num = toNumber(left);
      if (num !== null) return num - right;
    }

    // Date strings
    if (typeof left === 'string' && typeof right === 'string') {
      const dl = dayjs(left);
      const dr = dayjs(right);
      if (dl.isValid() && dr.isValid() && isDateLikeStr(left) && isDateLikeStr(right)) {
        return dl.valueOf() - dr.valueOf();
      }
      // Fallback: locale-aware string compare
      return left.localeCompare(right, undefined, { sensitivity: 'base' });
    }

    // Fallback to string coercion
    return valueText(left).localeCompare(valueText(right));
  }


  // Helper to safely get argument
  function getArg(args: FormulaNode[], index: number): FormulaNode {
    const arg = args[index];
    if (!arg) throw new Error(`Missing argument at index ${index}`);
    return arg;
  }
export const LEGACY_FUNCTIONS: Record<string, LegacyFunction> = {
  AND: (args, evaluate, _base) => {
          return args.every(arg => evaluate(arg) === true);
        },
  OR: (args, evaluate, _base) => {
          return args.some(arg => evaluate(arg) === true);
        },
  NOT: (args, evaluate, _base) => {
          if (args.length !== 1) throw new Error('NOT expects 1 argument');
          return !evaluate(getArg(args, 0));
        },
  IS_EMPTY: (args, evaluate, _base) => {
          if (args.length !== 1) throw new Error('IS_EMPTY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          return val === null || val === undefined || val === '' ||
                 (Array.isArray(val) && val.length === 0);
        },
  IS_NOT_EMPTY: (args, evaluate, _base) => {
          if (args.length !== 1) throw new Error('IS_NOT_EMPTY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          return !(val === null || val === undefined || val === '' ||
                   (Array.isArray(val) && val.length === 0));
        },
  CONTAINS: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('CONTAINS expects 2 arguments');
          const haystack = valueText(evaluate(getArg(args, 0)) ?? '').toLowerCase();
          const needle = valueText(evaluate(getArg(args, 1)) ?? '').toLowerCase();
          return haystack.includes(needle);
        },
  NOT_CONTAINS: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('NOT_CONTAINS expects 2 arguments');
          const haystack = valueText(evaluate(getArg(args, 0)) ?? '').toLowerCase();
          const needle = valueText(evaluate(getArg(args, 1)) ?? '').toLowerCase();
          return !haystack.includes(needle);
        },
  STARTS_WITH: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('STARTS_WITH expects 2 arguments');
          const str = valueText(evaluate(getArg(args, 0)) ?? '');
          const prefix = valueText(evaluate(getArg(args, 1)) ?? '');
          return str.startsWith(prefix);
        },
  ENDS_WITH: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('ENDS_WITH expects 2 arguments');
          const str = valueText(evaluate(getArg(args, 0)) ?? '');
          const suffix = valueText(evaluate(getArg(args, 1)) ?? '');
          return str.endsWith(suffix);
        },
  TODAY: (_args, _evaluate, base) => {
          return base.format('YYYY-MM-DD');
        },
  NOW: (_args, _evaluate, base) => {
          return base.toISOString();
        },
  TOMORROW: (_args, _evaluate, base) => {
          return base.add(1, 'day').format('YYYY-MM-DD');
        },
  YESTERDAY: (_args, _evaluate, base) => {
          return base.subtract(1, 'day').format('YYYY-MM-DD');
        },
  IS_TODAY: (args, evaluate, base) => {
          if (args.length !== 1) throw new Error('IS_TODAY expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val as dayjs.ConfigType);
          return date.isValid() && date.isSame(base, 'day');
        },
  IS_THIS_WEEK: (args, evaluate, base) => {
          if (args.length !== 1) throw new Error('IS_THIS_WEEK expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val as dayjs.ConfigType);
          return date.isValid() && date.isSame(base, 'week');
        },
  IS_THIS_MONTH: (args, evaluate, base) => {
          if (args.length !== 1) throw new Error('IS_THIS_MONTH expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val as dayjs.ConfigType);
          return date.isValid() && date.isSame(base, 'month');
        },
  IS_BEFORE: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('IS_BEFORE expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          const date2 = dayjs(evaluate(getArg(args, 1)) as dayjs.ConfigType);
          return date1.isValid() && date2.isValid() && date1.isBefore(date2, 'day');
        },
  IS_AFTER: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('IS_AFTER expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          const date2 = dayjs(evaluate(getArg(args, 1)) as dayjs.ConfigType);
          return date1.isValid() && date2.isValid() && date1.isAfter(date2, 'day');
        },
  IS_ON_AND_BEFORE: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('IS_ON_AND_BEFORE expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          const date2 = dayjs(evaluate(getArg(args, 1)) as dayjs.ConfigType);
          return date1.isValid() && date2.isValid() && date1.isSameOrBefore(date2, 'day');
        },
  IS_ON_AND_AFTER: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('IS_ON_AND_AFTER expects 2 arguments');
          const date1 = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          const date2 = dayjs(evaluate(getArg(args, 1)) as dayjs.ConfigType);
          return date1.isValid() && date2.isValid() && date1.isSameOrAfter(date2, 'day');
        },
  IS_OVERDUE: (args, evaluate, base) => {
          if (args.length !== 1) throw new Error('IS_OVERDUE expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val as dayjs.ConfigType);
          return date.isValid() && date.isBefore(base, 'day');
        },
  IS_UPCOMING: (args, evaluate, base) => {
          if (args.length !== 1) throw new Error('IS_UPCOMING expects 1 argument');
          const val = evaluate(getArg(args, 0));
          if (!val) return false;
          const date = dayjs(val as dayjs.ConfigType);
          return date.isValid() && date.isAfter(base, 'day');
        },
  DATE_ADD: (args, evaluate, _base) => {
          if (args.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, amount, unit)');
          const date = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          // #180a: `?? NaN` keeps the existing shape — a non-numeric amount
          // already produced an Invalid Date here. What changes is that `""`
          // and a missing field no longer count as "add zero days".
          const amount = toNumber(evaluate(getArg(args, 1))) ?? NaN;
          const unit = valueText(evaluate(getArg(args, 2))) as dayjs.ManipulateType;
          return date.add(amount, unit).format('YYYY-MM-DD');
        },
  DATE_SUB: (args, evaluate, _base) => {
          if (args.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, amount, unit)');
          const date = dayjs(evaluate(getArg(args, 0)) as dayjs.ConfigType);
          const amount = toNumber(evaluate(getArg(args, 1))) ?? NaN;
          const unit = valueText(evaluate(getArg(args, 2))) as dayjs.ManipulateType;
          return date.subtract(amount, unit).format('YYYY-MM-DD');
        },
  HAS_ANY_OF: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('HAS_ANY_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return (arr1 as unknown[]).some(item => (arr2 as unknown[]).includes(item));
        },
  HAS_ALL_OF: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('HAS_ALL_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return (arr2 as unknown[]).every(item => (arr1 as unknown[]).includes(item));
        },
  HAS_NONE_OF: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('HAS_NONE_OF expects 2 arguments');
          const arr1 = evaluate(getArg(args, 0));
          const arr2 = evaluate(getArg(args, 1));
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return !(arr1 as unknown[]).some(item => (arr2 as unknown[]).includes(item));
        }
};

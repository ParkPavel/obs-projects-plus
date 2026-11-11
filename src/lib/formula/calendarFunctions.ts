/** Calendar predicates share the canonical runtime and its fixed reference date. */
import type { FormulaNode } from "./syntax";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
import { valueText } from "src/lib/valueText";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
export type CalendarFunction = (args: FormulaNode[], evaluate: (node: FormulaNode) => Optional<DataValue>, base: dayjs.Dayjs) => Optional<DataValue>;
function getArg(args: FormulaNode[], index: number): FormulaNode {
  const arg = args[index];
  if (!arg) throw new Error(`Missing argument at index ${index}`);
  return arg;
}
export const CALENDAR_FUNCTIONS: Readonly<Record<string, CalendarFunction>> = {
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
  NOT_CONTAINS: (args, evaluate, _base) => {
          if (args.length !== 2) throw new Error('NOT_CONTAINS expects 2 arguments');
          const haystack = valueText(evaluate(getArg(args, 0)) ?? '').toLowerCase();
          const needle = valueText(evaluate(getArg(args, 1)) ?? '').toLowerCase();
          return !haystack.includes(needle);
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
        },
};

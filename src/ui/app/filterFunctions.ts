import { produce } from "immer";
import dayjs from "dayjs";
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

// dayjs isoWeek + quarterOfYear plugins are extended globally in main.ts

export function matchesCondition(
  cond: FilterCondition,
  record: DataRecord
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
    return dateFns[operator](value, cond.value);
  }

  if (process.env["NODE_ENV"] !== "production") {
    console.warn(`[FilterEngine] Unhandled filter: operator="${operator}", field="${cond.field}"`);
  }
  return false;
}

export function matchesFilterConditions(
  filter: FilterDefinition,
  record: DataRecord,
  _depth = 0
): boolean {
  if (_depth >= 20) return true; // safety: prevent infinite recursion

  const validConds = filter.conditions.filter((cond) => {
    return cond?.enabled ?? true;
  });

  const condResults = validConds.map((cond) => matchesCondition(cond, record));
  const groupResults = (filter.groups ?? []).map((group) =>
    matchesFilterConditions(group, record, _depth + 1)
  );
  const allResults = [...condResults, ...groupResults];

  if (!allResults.length) return true;

  if (filter.conjunction === "or") {
    return allResults.some((r) => r);
  }
  return allResults.every((r) => r);
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
  "is-empty": (value) =>
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0),
  "is-not-empty": (value) =>
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0),
};

export const stringFns: Record<
  StringFilterOperator,
  (left: Optional<string>, right?: string) => boolean
> = {
  is: (left, right) => (left ? left == right : false),
  "is-not": (left, right) => (left ? left != right : true),
  contains: (left, right) => (left ? left.toLowerCase().includes((right ?? "").toLowerCase()) : false),
  "not-contains": (left, right) => (left ? !left.toLowerCase().includes((right ?? "").toLowerCase()) : true),
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
  (left: Optional<Date>, rawValue?: string) => boolean
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
  "is-today": (left) => {
    if (!left) return false;
    return dayjs(left).isSame(dayjs(), "day");
  },
  "is-this-week": (left) => {
    if (!left) return false;
    return dayjs(left).isoWeek() === dayjs().isoWeek() && dayjs(left).year() === dayjs().year();
  },
  "is-this-month": (left) => {
    if (!left) return false;
    return dayjs(left).isSame(dayjs(), "month");
  },
  "is-this-quarter": (left) => {
    if (!left) return false;
    return dayjs(left).quarter() === dayjs().quarter() && dayjs(left).year() === dayjs().year();
  },
  "is-last-n-days": (left, rv) => {
    const n = rv ? parseInt(rv, 10) : 0;
    if (!left || !n || n <= 0) return false;
    const d = dayjs(left), today = dayjs();
    return d.isAfter(today.subtract(n, "day"), "day") && (d.isBefore(today, "day") || d.isSame(today, "day"));
  },
  "is-next-n-days": (left, rv) => {
    const n = rv ? parseInt(rv, 10) : 0;
    if (!left || !n || n <= 0) return false;
    const d = dayjs(left), today = dayjs();
    return (d.isAfter(today, "day") || d.isSame(today, "day")) && d.isBefore(today.add(n, "day"), "day");
  },
  "is-overdue": (left) => {
    if (!left) return false;
    return dayjs(left).isBefore(dayjs(), "day");
  },
  "is-upcoming": (left) => {
    if (!left) return false;
    const d = dayjs(left);
    return d.isAfter(dayjs(), "day") || d.isSame(dayjs(), "day");
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

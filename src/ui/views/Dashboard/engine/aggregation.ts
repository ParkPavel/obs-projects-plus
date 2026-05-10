// src/ui/views/Dashboard/engine/aggregation.ts

import type {
  DataFrame,
  DataField,
  DataValue,
} from "src/lib/dataframe/dataframe";
import { aggregate, type RollupFunction } from "src/lib/engine/aggregate";
import type {
  AggregationConfig,
  AggregationResult,
  ColumnAggregation,
} from "../types";

/**
 * ColumnAggregationEngine — computes per-column summaries for DataTable footer.
 * Runs in parallel with TransformPipeline (not part of it).
 *
 * v4.0 (REFACTOR-102): kernel-overlapping operators (sum, avg, median,
 * min, max, range, count_unique) delegate to `lib/engine/aggregate.ts`.
 * Footer-specific operators (count_total, count_values, count_checked,
 * count_unchecked, percent_checked, percent_unchecked, percent_empty,
 * percent_not_empty, earliest, latest, date_range) remain inline because
 * they either have no kernel equivalent or carry footer-specific
 * semantics (e.g. footer `count_total` = total records incl. nulls;
 * kernel `count` = non-null count — see R5-004 for the rename).
 */

/**
 * Operators whose math the kernel owns. Mapping value is the kernel
 * `RollupFunction` to forward to.
 */
const KERNEL_OPS: Partial<Record<ColumnAggregation, RollupFunction>> = {
  count_unique: "count_unique",
  sum: "sum",
  avg: "avg",
  median: "median",
  min: "min",
  max: "max",
  range: "range",
};

/**
 * For min/max/range the footer surfaces a null + "—" placeholder when
 * there's no numeric input, while the kernel returns 0. We keep the
 * footer behaviour because users read the footer cell as "no data" vs
 * "zero", and downstream tests pin null on empty.
 */
const NULL_ON_EMPTY: ReadonlySet<ColumnAggregation> = new Set([
  "min",
  "max",
  "range",
]);

export function computeAggregations(
  frame: DataFrame,
  config: AggregationConfig
): AggregationResult {
  const result: Record<
    string,
    { function: ColumnAggregation; value: string | number | null; formattedValue: string }
  > = {};

  for (const field of frame.fields) {
    const fn = config[field.name];
    if (!fn || fn === "none") continue;

    const values = frame.records.map((r) => r.values[field.name]);
    const computed = computeColumn(values, fn, field);

    result[field.name] = {
      function: fn,
      value: computed.value,
      formattedValue: computed.formatted,
    };
  }

  return result;
}

function computeColumn(
  values: (DataValue | undefined | null)[],
  fn: ColumnAggregation,
  _field: DataField
): { value: string | number | null; formatted: string } {
  // Kernel-delegated branch: run the canonical aggregate() and re-format
  // the raw numeric output through the footer's locale-aware formatter.
  const kernelFn = KERNEL_OPS[fn];
  if (kernelFn) {
    if (NULL_ON_EMPTY.has(fn) && extractNumbers(values).length === 0) {
      return { value: null, formatted: "—" };
    }
    const kernelResult = aggregate(values, {
      relationField: "",
      targetField: "",
      function: kernelFn,
    });
    const value = kernelResult.value;
    if (typeof value === "number") return fmt(value);
    return { value: null, formatted: "—" };
  }

  const nonEmpty = values.filter((v) => v != null && v !== "");

  switch (fn) {
    case "count_total":
      return fmt(values.length);

    case "count_values":
      return fmt(nonEmpty.length);

    case "count_checked":
      return fmt(values.filter((v) => v === true).length);

    case "count_unchecked":
      return fmt(values.filter((v) => v === false).length);

    case "percent_checked": {
      const bools = values.filter((v) => typeof v === "boolean");
      if (bools.length === 0) return fmt(0, "0%");
      const pct = (bools.filter((v) => v === true).length / bools.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "percent_unchecked": {
      const bools = values.filter((v) => typeof v === "boolean");
      if (bools.length === 0) return fmt(0, "0%");
      const pct = (bools.filter((v) => v === false).length / bools.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "percent_empty": {
      if (values.length === 0) return fmt(0, "0%");
      const pct = ((values.length - nonEmpty.length) / values.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "percent_not_empty": {
      if (values.length === 0) return fmt(0, "0%");
      const pct = (nonEmpty.length / values.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "earliest": {
      const dates = extractDates(values);
      if (dates.length === 0) return { value: null, formatted: "—" };
      const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
      return { value: earliest.toISOString(), formatted: formatDate(earliest) };
    }

    case "latest": {
      const dates = extractDates(values);
      if (dates.length === 0) return { value: null, formatted: "—" };
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      return { value: latest.toISOString(), formatted: formatDate(latest) };
    }

    case "date_range": {
      const dates = extractDates(values);
      if (dates.length < 2) return { value: null, formatted: "—" };
      const min = Math.min(...dates.map((d) => d.getTime()));
      const max = Math.max(...dates.map((d) => d.getTime()));
      const days = Math.round((max - min) / (1000 * 60 * 60 * 24));
      return fmt(days, `${days}d`);
    }

    default:
      return { value: null, formatted: "—" };
  }
}

/**
 * Compute a single aggregate value from raw column values.
 * Used by StatsCard, SummaryRow, and anywhere per-column aggregation is needed.
 *
 * v4.0 (REFACTOR-102): mirrors `computeColumn`'s delegation layout but
 * returns the raw value (no formatted string) for callers that own
 * their own rendering.
 */
export function computeAggregateValue(
  values: (DataValue | undefined | null)[],
  fn: ColumnAggregation
): number | string | null {
  const kernelFn = KERNEL_OPS[fn];
  if (kernelFn) {
    if (NULL_ON_EMPTY.has(fn) && extractNumbers(values).length === 0) return null;
    const out = aggregate(values, {
      relationField: "",
      targetField: "",
      function: kernelFn,
    }).value;
    // avg with no numeric input: kernel returns 0; legacy contract returned null.
    if (fn === "avg" && extractNumbers(values).length === 0) return null;
    return typeof out === "number" ? out : null;
  }

  const nonEmpty = values.filter((v) => v != null && v !== "");

  switch (fn) {
    case "count_total": return values.length;
    case "count_values": return nonEmpty.length;
    case "count_checked": return values.filter((v) => v === true).length;
    case "count_unchecked": return values.filter((v) => v === false).length;
    case "percent_empty":
      return values.length ? ((values.length - nonEmpty.length) / values.length) * 100 : null;
    case "percent_not_empty":
      return values.length ? (nonEmpty.length / values.length) * 100 : null;
    case "percent_checked": {
      const bools = values.filter((v) => typeof v === "boolean");
      return bools.length ? (bools.filter((v) => v === true).length / bools.length) * 100 : null;
    }
    case "percent_unchecked": {
      const bools = values.filter((v) => typeof v === "boolean");
      return bools.length ? (bools.filter((v) => v === false).length / bools.length) * 100 : null;
    }
    default: return null;
  }
}

function extractNumbers(values: (DataValue | undefined | null)[]): number[] {
  const result: number[] = [];
  for (const v of values) {
    if (typeof v === "number") {
      result.push(v);
    } else if (typeof v === "string") {
      const n = Number(v);
      if (!isNaN(n) && v !== "") result.push(n);
    }
  }
  return result;
}

function extractDates(values: (DataValue | undefined | null)[]): Date[] {
  const result: Date[] = [];
  for (const v of values) {
    if (v instanceof Date && !isNaN(v.getTime())) {
      result.push(v);
    } else if (typeof v === "string") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) result.push(d);
    }
  }
  return result;
}

function fmt(
  value: number | null,
  formatted?: string
): { value: number | null; formatted: string } {
  if (value == null) return { value: null, formatted: "—" };
  return {
    value,
    formatted: formatted ?? formatNumber(value),
  };
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
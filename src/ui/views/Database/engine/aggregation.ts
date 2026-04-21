// src/ui/views/Database/engine/aggregation.ts

import type {
  DataFrame,
  DataField,
  DataValue,
} from "src/lib/dataframe/dataframe";
import type {
  AggregationConfig,
  AggregationResult,
  ColumnAggregation,
} from "../types";

/**
 * ColumnAggregationEngine — computes per-column summaries for DataTable footer.
 * Runs in parallel with TransformPipeline (not part of it).
 */
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
  field: DataField
): { value: string | number | null; formatted: string } {
  const nonEmpty = values.filter(
    (v) => v != null && v !== ""
  );

  switch (fn) {
    case "count":
      return fmt(values.length);

    case "count_values":
      return fmt(nonEmpty.length);

    case "count_unique": {
      const unique = new Set(nonEmpty.map(String));
      return fmt(unique.size);
    }

    case "sum": {
      const nums = extractNumbers(values);
      const sum = nums.reduce((a, b) => a + b, 0);
      return fmt(sum);
    }

    case "avg": {
      const nums = extractNumbers(values);
      return fmt(nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
    }

    case "median": {
      const nums = extractNumbers(values).sort((a, b) => a - b);
      if (nums.length === 0) return fmt(0);
      const mid = Math.floor(nums.length / 2);
      return fmt(
        nums.length % 2 !== 0
          ? nums[mid]!
          : ((nums[mid - 1]!) + (nums[mid]!)) / 2
      );
    }

    case "min": {
      const nums = extractNumbers(values);
      return fmt(nums.length > 0 ? Math.min(...nums) : null);
    }

    case "max": {
      const nums = extractNumbers(values);
      return fmt(nums.length > 0 ? Math.max(...nums) : null);
    }

    case "range": {
      const nums = extractNumbers(values);
      return fmt(
        nums.length > 0 ? Math.max(...nums) - Math.min(...nums) : null
      );
    }

    case "count_checked": {
      const checked = values.filter((v) => v === true).length;
      return fmt(checked);
    }

    case "count_unchecked": {
      const unchecked = values.filter((v) => v === false).length;
      return fmt(unchecked);
    }

    case "percent_checked": {
      const bools = values.filter(
        (v) => typeof v === "boolean"
      );
      if (bools.length === 0) return fmt(0, "0%");
      const pct = (bools.filter((v) => v === true).length / bools.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "percent_unchecked": {
      const bools = values.filter(
        (v) => typeof v === "boolean"
      );
      if (bools.length === 0) return fmt(0, "0%");
      const pct =
        (bools.filter((v) => v === false).length / bools.length) * 100;
      return fmt(pct, `${Math.round(pct)}%`);
    }

    case "percent_empty": {
      if (values.length === 0) return fmt(0, "0%");
      const pct =
        ((values.length - nonEmpty.length) / values.length) * 100;
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
 */
export function computeAggregateValue(
  values: (DataValue | undefined | null)[],
  fn: ColumnAggregation
): number | string | null {
  const nonEmpty = values.filter((v) => v != null && v !== "");
  const nums = extractNumbers(values);

  switch (fn) {
    case "count": return values.length;
    case "count_values": return nonEmpty.length;
    case "count_unique": return new Set(nonEmpty.map(String)).size;
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "avg": return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    case "median": {
      if (!nums.length) return null;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    }
    case "min": return nums.length > 0 ? Math.min(...nums) : null;
    case "max": return nums.length > 0 ? Math.max(...nums) : null;
    case "range": return nums.length > 0 ? Math.max(...nums) - Math.min(...nums) : null;
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

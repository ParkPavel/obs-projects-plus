/**
 * RollupEngine — aggregate field values from relation targets.
 *
 * Given a record's relation field (wiki-links) and a target field to aggregate,
 * computes a summary value (sum, avg, count, min, max, etc.) from the linked records.
 */

import type { DataFrame, DataRecord, DataValue, Optional } from "src/lib/dataframe/dataframe";
import { getRelationTargets, getRelationTargetsWithIndex, buildRecordIndex } from "./relationResolver";

// ── Types ─────────────────────────────────────────────────

export type RollupFunction =
  | "count"
  | "count_values"
  | "count_unique"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "range"
  | "percent_true"
  | "concat"
  | "concat_unique";

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

// ── Public API ──────────────────────────────────────────

/**
 * Compute a rollup for a single source record.
 */
export function computeRollup(
  record: DataRecord,
  config: RollupConfig,
  df: DataFrame
): RollupResult {
  const targets = getRelationTargets(record, config.relationField, df);
  const rawValues = targets.map((t) => t.values[config.targetField]);
  return aggregate(rawValues, config);
}

/**
 * Compute rollups for all records in the DataFrame, returning a map of recordId → result.
 * Builds the record index ONCE — O(n) instead of O(n²).
 */
export function computeRollupColumn(
  df: DataFrame,
  config: RollupConfig
): Map<string, RollupResult> {
  const index = buildRecordIndex(df);
  const map = new Map<string, RollupResult>();
  for (const record of df.records) {
    const targets = getRelationTargetsWithIndex(record, config.relationField, index);
    const rawValues = targets.map((t) => t.values[config.targetField]);
    map.set(record.id, aggregate(rawValues, config));
  }
  return map;
}

// ── Aggregation ─────────────────────────────────────────

function aggregate(
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

    case "count_values":
      return fmtNum(nonNull.filter((v) => v !== "" && v !== false).length);

    case "count_unique": {
      const set = new Set(nonNull.map(String));
      return fmtNum(set.size);
    }

    case "sum":
      return fmtNum(sumNumbers(nonNull));

    case "avg": {
      const nums = toNumbers(nonNull);
      if (nums.length === 0) return fmtNum(0);
      return fmtNum(nums.reduce((a, b) => a + b, 0) / nums.length);
    }

    case "min": {
      const nums = toNumbers(nonNull);
      return nums.length > 0 ? fmtNum(Math.min(...nums)) : fmtNum(0);
    }

    case "max": {
      const nums = toNumbers(nonNull);
      return nums.length > 0 ? fmtNum(Math.max(...nums)) : fmtNum(0);
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
      if (nums.length === 0) return fmtNum(0);
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

    default:
      return { value: null, formattedValue: "" };
  }
}

// ── Helpers ─────────────────────────────────────────────

function toNumbers(values: DataValue[]): number[] {
  const result: number[] = [];
  for (const v of values) {
    if (typeof v === "number") {
      result.push(v);
    } else if (typeof v === "string") {
      const n = parseFloat(v);
      if (!isNaN(n)) result.push(n);
    }
  }
  return result;
}

function sumNumbers(values: DataValue[]): number {
  return toNumbers(values).reduce((a, b) => a + b, 0);
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

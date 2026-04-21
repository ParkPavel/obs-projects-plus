// src/ui/views/Database/engine/transformTypes.ts

import type { FilterDefinition } from "src/settings/settings";

// ── Pipeline ─────────────────────────────────────────────────

export interface TransformPipeline {
  readonly steps: readonly TransformStep[];
}

export type TransformStep =
  | UnnestStep
  | UnpivotStep
  | ComputeStep
  | FilterStep
  | GroupByStep
  | AggregateStep
  | PivotStep;

// ── Steps ────────────────────────────────────────────────────

export interface UnnestStep {
  readonly type: "unnest";
  /** Field containing an array of objects to expand into rows */
  readonly field: string;
  /** Only extract these keys from nested objects (all if omitted) */
  readonly fields?: readonly string[];
  /** Prefix for extracted field names (default: none) */
  readonly prefix?: string;
  /** Keep the original array field in output (default: false) */
  readonly keepOriginal?: boolean;
}

export interface UnpivotStep {
  readonly type: "unpivot";
  readonly fieldGroups: readonly FieldGroup[];
  readonly keepFields: readonly string[];
}

export interface FieldGroup {
  readonly pattern: string;
  readonly outputName: string;
}

export interface ComputeStep {
  readonly type: "compute";
  readonly columns: readonly ComputedColumn[];
}

export interface ComputedColumn {
  readonly name: string;
  readonly expression: string;
}

export interface FilterStep {
  readonly type: "filter";
  readonly conditions: FilterDefinition;
}

export interface GroupByStep {
  readonly type: "group-by";
  readonly fields: readonly string[];
  readonly dateGrouping?: DateGrouping;
}

export interface DateGrouping {
  readonly field: string;
  readonly granularity: "day" | "week" | "month" | "quarter" | "year";
  readonly outputField?: string;
}

export interface AggregateStep {
  readonly type: "aggregate";
  readonly columns: readonly AggregateColumn[];
}

export interface AggregateColumn {
  readonly sourceField: string;
  readonly outputName: string;
  readonly function: AggregationFunction;
}

export interface PivotStep {
  readonly type: "pivot";
  readonly categoryField: string;
  readonly valueField: string;
  readonly aggregation: AggregationFunction;
}

// ── Pipeline Aggregation (UPPERCASE, for TransformPipeline) ──

export type AggregationFunction =
  | "SUM"
  | "AVG"
  | "MEDIAN"
  | "MIN"
  | "MAX"
  | "RANGE"
  | "COUNT"
  | "COUNT_DISTINCT"
  | "FIRST"
  | "LAST"
  | "STD_DEV"
  | "PCT_EMPTY"
  | "PCT_NOT_EMPTY";

// ── Result ───────────────────────────────────────────────────

export interface TransformResult {
  readonly data: DataFrame;
  readonly derivedFields: readonly DataField[];
  readonly meta: TransformMeta;
}

export interface TransformMeta {
  readonly stepsExecuted: number;
  readonly executionTimeMs: number;
  readonly inputRowCount: number;
  readonly outputRowCount: number;
  readonly warnings: readonly string[];
}

// Re-export DataFrame types used in transforms
import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";

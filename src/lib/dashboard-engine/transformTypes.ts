// src/ui/views/Dashboard/engine/transformTypes.ts

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
  | PivotStep
  | JoinStep;

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

// ── JOIN (Pillar 5 — cross-type correlation) ─────────────────

/**
 * Inner or left join between the pipeline's current DataFrame (left) and a
 * pre-resolved right-hand DataFrame, referenced by opaque `rightSourceId`.
 *
 * The right frame is **not** part of the step payload (DataSource is not
 * serialisable). The executor looks it up via the `TransformContext.rightFrames`
 * map, keyed by `rightSourceId`. UI layers resolve the map before calling the
 * executor.
 *
 * If `aggregation` is set and multiple right-hand rows match a single left-hand
 * row, values from matching right rows are reduced per numeric column before
 * merge. Non-numeric columns take the first match. When omitted, the join
 * degenerates to a cartesian expansion (one output row per match pair).
 */
export interface JoinStep {
  readonly type: "join";
  /** Opaque identifier of the right-hand DataSource; resolved via TransformContext. */
  readonly rightSourceId: string;
  readonly on: {
    readonly leftKey: string;
    readonly rightKey: string;
  };
  readonly how: "inner" | "left";
  /** Aggregate right-hand matches before merge. Default: no aggregation (expand). */
  readonly aggregation?: AggregationFunction;
  /** Suffix appended to right-hand field names that collide with left-hand names. Default: "__r". */
  readonly suffix?: string;
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

// ── Execution context (Pillar 5) ─────────────────────────────

/**
 * Side-channel passed to `executeTransform` so steps that depend on external
 * frames (currently only `JoinStep`) can resolve them without knowing about
 * datasource machinery.
 */
export interface TransformContext {
  /** rightSourceId → pre-resolved DataFrame. Undefined entries trigger a warning in executeJoin. */
  readonly rightFrames?: ReadonlyMap<string, DataFrame>;
}

// Re-export DataFrame types used in transforms
import type { DataFrame, DataField } from "src/lib/dataframe/dataframe";

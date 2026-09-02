/**
 * transformTypes.ts — the shape of a dashboard pipeline, as it is STORED.
 *
 * These types are not internal to the executor: a pipeline is written into the
 * widget's saved settings and read back on every load, so this file is a
 * persistence format. Renaming a property here does not refactor a program, it
 * invalidates every dashboard a user has already built. Add optional
 * properties; treat the required ones as fixed.
 *
 * Four things that have already cost time:
 *
 * - **The discriminator is `type`, and a pipeline lives in `widget.transform`,
 *   not `widget.config`.** Both are easy to get wrong when seeding a vault by
 *   hand or through the REST API, and both fail the same silent way: the
 *   migrator does not recognise the step, drops it, and the run "passes" while
 *   testing nothing. `MANUAL_TESTING_PIPELINE.md` records this as a seeding
 *   trap; it is a trap for code that constructs steps too.
 * - **There used to be a second exported type called `TransformStep`,** the
 *   unbuilt v4 engine IR, keyed on `kind` with a nested `payload`. Because the
 *   two shapes partly overlap, importing the wrong one type-checked. #179
 *   (2026-09-02) renamed that one to `TransformStepIR` and left this one alone:
 *   this is the stored shape, so its name is part of the persistence format,
 *   not a local choice. #178 (2026-09-02) then deleted the IR outright — it had
 *   no consumers and described an engine that was never built; its text is kept
 *   at `docs/internal/archive/ENGINE_CONTRACTS_V4_DESIGN.md`. The collision is
 *   gone, but `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts` still
 *   forbids a new one, which is what keeps this name safe to rely on.
 * - **`AggregationFunction` is UPPERCASE on purpose,** and it is a THIRD
 *   aggregation vocabulary, not an alias. `lib/engine/aggregate.ts` has
 *   lowercase `RollupFunction` and dashboard footers have `ColumnAggregation`.
 *   The pipeline does not delegate to the kernel: `computeAggFn` in
 *   `transformExecutor.ts` implements this set itself. So a fix to SUM or AVG
 *   in the kernel does not reach a pipeline, and vice versa.
 * - **Every step is deeply `readonly`,** which is what lets the executor pass
 *   pipelines around and cache on them without defensive copies. Producing a
 *   new pipeline means building a new object, never mutating one.
 *
 * `disabled` is on the shared base rather than on each step so that turning a
 * step off is non-destructive: it stays in the stored pipeline, in place, and
 * the user can turn it back on.
 */

import type { FilterDefinition } from "src/settings/settings";

// ── Pipeline ─────────────────────────────────────────────────

/**
 * An ordered pipeline. Order is meaningful and is the order stored: each step
 * receives the frame the previous one produced, so a filter before a group-by
 * and the same filter after it are different programs.
 */
export interface TransformPipeline {
  readonly steps: readonly TransformStep[];
}

/**
 * One step, discriminated by `type`. Adding a member here means teaching
 * `executeStep` in `transformExecutor.ts` to run it, in the same change: that
 * switch is exhaustive with no `default`, so the compiler is the only thing
 * enforcing the match. A step carrying a `type` outside this union - from an
 * older or hand-edited save - makes `executeStep` return `undefined`, and the
 * loop assigns it to the frame it will read next.
 *
 * There is no second `TransformStep` to confuse this with any more: the v4 IR
 * that used to carry the name, later `TransformStepIR` and keyed on `kind`, was
 * deleted by #178. See the module header.
 */
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

/**
 * Shared mixin for every transform step. `disabled` is additive and optional:
 * absent means enabled. Disabled steps are skipped by the executor
 * (non-destructive — they stay in the pipeline so the user can re-enable).
 */
export interface TransformStepBase {
  readonly disabled?: boolean;
}

/**
 * Expand a field holding an array of objects into one row per element, the
 * parent's other fields copied onto each. The row count grows, so an unnest
 * before an aggregate and after it give different totals.
 */
export interface UnnestStep extends TransformStepBase {
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

/**
 * Turn repeated columns into rows - the wide-to-long reshape for frontmatter
 * that numbers its fields (`set_1_reps`, `set_2_reps`, ...).
 *
 * Each group's `pattern` must contain one capture group, and what it captures
 * is the INDEX that ties columns together: every field sharing an index
 * becomes one output row. A pattern with no capture group matches nothing, and
 * an unpivot that matches nothing warns and passes the frame through
 * unchanged - so a typo shows up as "no rows appeared", not as an error.
 */
export interface UnpivotStep extends TransformStepBase {
  readonly type: "unpivot";
  readonly fieldGroups: readonly FieldGroup[];
  /** Fields copied unchanged onto every output row (the record's identity). */
  readonly keepFields: readonly string[];
}

/** One family of indexed columns and the single column they collapse into. */
export interface FieldGroup {
  /** Regex over field names with ONE capture group for the index. */
  readonly pattern: string;
  /** Name of the column the group's values land in. */
  readonly outputName: string;
}

/** Add columns computed by formula. Runs before `filter`, so its outputs are filterable. */
export interface ComputeStep extends TransformStepBase {
  readonly type: "compute";
  readonly columns: readonly ComputedColumn[];
}

/** A derived column: the name it takes, and the formula expression behind it. */
export interface ComputedColumn {
  readonly name: string;
  readonly expression: string;
}

/**
 * Drop rows. `conditions` is the ordinary `FilterDefinition` - this step is
 * evaluated by the one filter engine (`filterEvaluator`), not by a private
 * copy, which is invariant 2 in CLAUDE.md.
 */
export interface FilterStep extends TransformStepBase {
  readonly type: "filter";
  readonly conditions: FilterDefinition;
}

/**
 * Partition rows by field values. On its own it only establishes the grouping;
 * an `aggregate` step after it is what collapses each group to one row.
 */
export interface GroupByStep extends TransformStepBase {
  readonly type: "group-by";
  readonly fields: readonly string[];
  readonly dateGrouping?: DateGrouping;
}

/** Bucket a date field by calendar period instead of by exact value. */
export interface DateGrouping {
  readonly field: string;
  readonly granularity: "day" | "week" | "month" | "quarter" | "year";
  /** Column the bucket label is written to; defaults to overwriting `field`. */
  readonly outputField?: string;
}

/** Collapse each group to one row, one output column per `AggregateColumn`. */
export interface AggregateStep extends TransformStepBase {
  readonly type: "aggregate";
  readonly columns: readonly AggregateColumn[];
}

/** Which field to summarise, under what name, with which function. */
export interface AggregateColumn {
  readonly sourceField: string;
  readonly outputName: string;
  readonly function: AggregationFunction;
}

/**
 * Long-to-wide: the distinct values of `categoryField` become columns, each
 * holding `valueField` reduced by `aggregation`. Last in the canonical order -
 * the output column names depend on the data, so steps after a pivot cannot
 * name the columns they would act on.
 */
export interface PivotStep extends TransformStepBase {
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
export interface JoinStep extends TransformStepBase {
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

/**
 * The pipeline's aggregation alphabet. UPPERCASE is what distinguishes it on
 * sight from `RollupFunction` (kernel, lowercase) and `ColumnAggregation`
 * (table footers) - three vocabularies that overlap in meaning and share no
 * code. `computeAggFn` in `transformExecutor.ts` implements this one; adding a
 * member here means implementing it there, and does NOT inherit anything from
 * `lib/engine/aggregate.ts`.
 *
 * These names are stored in saved pipelines, so they cannot be renamed to
 * match the other two vocabularies without a migration.
 */
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

/**
 * What `executeTransform` returns. Unlike the step types this is runtime-only:
 * it is never stored, so it can change shape freely.
 */
export interface TransformResult {
  readonly data: DataFrame;
  /**
   * Fields present in the output that were not in the input, computed by
   * difference. This is how a config panel offers the columns a pipeline
   * invented (`compute` outputs, pivot categories) without re-deriving them.
   */
  readonly derivedFields: readonly DataField[];
  readonly meta: TransformMeta;
}

/**
 * Execution telemetry. `warnings` is the pipeline's only diagnostic channel -
 * steps report a bad pattern, an unresolved join or an out-of-order sequence
 * here and then carry on, so an empty result with warnings is the normal shape
 * of a misconfigured pipeline. Surface them; do not treat a returned frame as
 * proof the pipeline did what the user asked.
 */
export interface TransformMeta {
  /** Steps actually run: disabled steps are excluded before counting. */
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

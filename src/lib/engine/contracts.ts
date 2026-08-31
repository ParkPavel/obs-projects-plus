/**
 * contracts.ts — the v4 "Unified DataEngine" type layer, ALMOST ALL OF IT
 * UNCONSUMED. Read this paragraph before believing the rest of the header.
 *
 * The design below was written as the normative Layer 0 for a unified engine.
 * That engine was not built. Verified against the tree on 2026-08-31: outside
 * this file, the only symbols anyone imports are `RecordId` and `ProjectId`
 * (`lib/relations/contracts.ts`, `lib/colors/contracts.ts`), and `ProjectId`
 * is itself only re-exported from `settings/base/settings`. `FilterIR`,
 * `RollupIR`, `FormulaIR`, `AggregateFn`, `SortIR`, `GroupIR`, `ComputeIR`,
 * `AggregateIR`, `TransformStep`, `EngineDiagnostic`, `DataEngineRequest` and
 * `DataEngineResult` have zero consumers.
 *
 * So the words "NORMATIVE" and "single source of truth" below describe an
 * intent, not the code. What is actually canonical today:
 *
 * | This file says | What the product runs |
 * |---|---|
 * | `AggregateFn` is the kernel alphabet | `RollupFunction` in `lib/engine/aggregate.ts` |
 * | `FilterIR` / `FilterCondition` with `op` | `FilterDefinition` in `settings/base/settings.ts`, evaluated by `filterEvaluator.ts` |
 * | `TransformStep` with `kind` + `payload` | `TransformStep` with `type` in `lib/dashboard-engine/transformTypes.ts` |
 *
 * That last row is a live hazard rather than a curiosity: two exported types
 * share the name `TransformStep`, and importing this one compiles in places
 * where it is simply wrong. The stored, executed pipeline step is the one in
 * `transformTypes.ts`.
 *
 * The file is kept, not deleted, because `RecordId` genuinely lives here (see
 * its own note) and because the design is the record of a decision. Anything
 * planned in terms of these types should first check whether the type still
 * describes the product - most of the REFACTOR-1xx tickets referenced below
 * did not land.
 *
 * NORMATIVE source of truth for cross-cutting engine types: filter IR,
 * aggregation kernel, rollup IR, formula IR, transform pipeline and the
 * top-level DataEngine request/result envelopes.
 *
 * Per ARCHITECTURE_V4 §1.2 and PHASE_3_TICKETS REFACTOR-005:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports. This file imports type-only symbols from:
 *       * `src/lib/dataframe/dataframe`        (DataFrame primitives)
 *       * `src/settings/base/settings`         (legacy FilterOperator, ProjectId)
 *       * `src/lib/database/rollupMode`        (RollupModeId taxonomy)
 *       * `src/lib/helpers/formulaParser`      (FormulaNode AST)
 *   - Consumer migrations land in later tickets (REFACTOR-101..107, 201..205).
 *
 * Design notes:
 *   - `FilterCondition` here uses `op` / `value?: DataValue`. The legacy
 *     `FilterCondition` in `src/settings/base/settings.ts` (with
 *     `operator` / `value?: string`) remains valid until the filter
 *     unification ticket (REFACTOR-104) bridges them via an adapter.
 *   - `AggregateFn` is the canonical aggregation alphabet. The Notion-style
 *     `RollupModeId` maps onto this set via `getRollupMode(mode).fn`
 *     (R2.1b invariant; enforced at runtime by `assertRollupInvariant`).
 *   - `DataSource` and `ProjectSchema` are kept as structural placeholders
 *     to avoid pulling `lib/datasources/` into Layer 0 and creating
 *     circular import risk. REFACTOR-007 will narrow these via the
 *     public types package.
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §1
 * @see docs/PHASE_3_TICKETS.md REFACTOR-005
 */

import type {
  DataField,
  DataFieldType,
  DataFrame,
  DataValue,
} from "src/lib/dataframe/dataframe";
import type {
  FilterOperator as LegacyFilterOperator,
  ProjectId,
} from "src/settings/base/settings";
import type { RollupModeId } from "src/lib/database/rollupMode";
import type { FormulaNode } from "src/lib/formula";

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for ergonomics (consumers import a single barrel).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pass-through re-exports so a consumer can take engine types from one barrel.
 * These add no meaning of their own - each is defined in the module it is
 * imported from above, and that module stays the place to change it.
 */
export type { DataFieldType, DataFrame, DataValue, ProjectId, RollupModeId, FormulaNode };

/**
 * Canonical filter operator alphabet.
 *
 * v4.0 reuses the union already enumerated in `settings/base/settings.ts`,
 * which is the merge of every operator emitted by `filterFunctions.ts`,
 * `transformExecutor.ts` and the relative-date parity additions.
 *
 * REFACTOR-104 will tighten this set to a closed 30-op canonical surface
 * once `evaluateFilter` lands.
 */
export type FilterOperator = LegacyFilterOperator;

// ─────────────────────────────────────────────────────────────────────────────
// Identity / schema placeholders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable, vault-scoped identity of a single record (file path or UUID).
 * Defined here (and not in `settings/base`) because relations and engine
 * diagnostics need it before the relations contract module loads.
 */
export type RecordId = string;

/**
 * Minimal schema descriptor consumed by engine steps.
 *
 * The full schema (fields, identifiers, projection metadata) lives in the
 * project model; this surface is the read-only slice the engine needs.
 */
export interface ProjectSchema {
  readonly fields: readonly DataField[];
}

/**
 * Opaque reference to a data source (folder / tag / dataview / ...).
 *
 * Placeholder: the concrete `DataSource` abstract class lives in
 * `src/lib/datasources/index.ts`. To keep Layer 0 free of runtime
 * dependencies on the data-source layer, the engine contract treats
 * sources as opaque values and lets the resolver in `lib/engine/`
 * narrow them at runtime.
 */
export type DataSource = unknown;

// ─────────────────────────────────────────────────────────────────────────────
// Filter IR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single atomic filter condition in the canonical IR.
 *
 * Distinct from the legacy `FilterCondition` in `settings/base/settings.ts`:
 *   - field name property is `op` (not `operator`).
 *   - `value` accepts the full `DataValue` union (not just `string`).
 *   - Negative-op semantics on undefined fields follow R2.1c: the
 *     evaluator returns `true` when the field is absent and the op is
 *     negative (`is-not`, `not-contains`, `has-none-of`, ...).
 */
export interface FilterCondition {
  readonly field: string;
  readonly op: FilterOperator;
  readonly value?: DataValue;
  readonly enabled: boolean;
}

/**
 * Recursive filter intermediate representation.
 *
 * `conditions` are leaf predicates joined by `conjunction`; `groups`
 * are nested IRs joined by the same conjunction. An empty IR
 * (no conditions, no groups) is the identity filter (matches all).
 */
export interface FilterIR {
  readonly conjunction: "and" | "or";
  readonly conditions: readonly FilterCondition[];
  readonly groups: readonly FilterIR[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical aggregation alphabet.
 *
 * Single source of truth for the kernel surface used by:
 *   - column footers (`Database/engine/aggregation.ts`)
 *   - rollup engine (`Database/engine/rollup.ts`)
 *   - formula functions SUM / AVG / MIN / MAX / MEDIAN
 *
 * After REFACTOR-101..103 every consumer delegates to a single
 * `aggregate(values, fn)` kernel keyed on this union.
 */
export type AggregateFn =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "count"
  | "count_unique"
  | "count_empty"
  | "count_not_empty"
  | "first"
  | "last"
  | "list"
  | "list_unique"
  | "range"
  | "earliest"
  | "latest";

// ─────────────────────────────────────────────────────────────────────────────
// Rollup IR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rollup intermediate representation.
 *
 * Invariant R2.1b: `getRollupMode(mode).fn === fn`. Settings migrators
 * fill `mode` from `fn` for legacy saves; runtime asserts in dev builds.
 */
export interface RollupIR {
  readonly relationField: string;
  readonly targetField: string;
  readonly fn: AggregateFn;
  readonly mode: RollupModeId;
  readonly separator?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formula IR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formula intermediate representation.
 *
 * The AST is produced by `parseFormula()` in `lib/helpers/formulaParser`.
 * `expectedType` is an optional type-narrowing hint used by the renderer
 * to format the result (e.g. as a date even when the AST returns a number).
 */
export interface FormulaIR {
  readonly ast: FormulaNode;
  readonly expectedType?: DataFieldType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort / Group / Compute / Aggregate step payloads
// ─────────────────────────────────────────────────────────────────────────────

/** One level of an ordering. Unconsumed - see the module header. */
export interface SortKey {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/**
 * Multi-key ordering, most significant key first. Unconsumed: sorting in the
 * product is carried on the view's own settings, not as an engine step.
 */
export interface SortIR {
  readonly keys: readonly SortKey[];
}

/** Grouping by one field, optionally ordering the groups. Unconsumed. */
export interface GroupIR {
  readonly field: string;
  readonly direction?: "asc" | "desc";
}

/** A formula-derived column: where the result lands, and the AST behind it. Unconsumed. */
export interface ComputeIR {
  readonly outputField: string;
  readonly formula: FormulaIR;
}

/** A rollup written into a named column. Unconsumed. */
export interface AggregateIR {
  readonly outputField: string;
  readonly rollup: RollupIR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NOT the pipeline step the product runs. The executed and stored step type is
 * `TransformStep` in `src/lib/dashboard-engine/transformTypes.ts`, which is
 * discriminated by `type` and carries its payload flat rather than nested. Two
 * exported types with one name: check the import path before using either.
 *
 * This version is the v4 IR and has no consumers.
 */
export type TransformStep =
  | { readonly kind: "filter"; readonly payload: FilterIR }
  | { readonly kind: "sort"; readonly payload: SortIR }
  | { readonly kind: "group"; readonly payload: GroupIR }
  | { readonly kind: "compute"; readonly payload: ComputeIR }
  | { readonly kind: "aggregate"; readonly payload: AggregateIR };

// ─────────────────────────────────────────────────────────────────────────────
// Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

/** Severity of an engine diagnostic. Unconsumed. */
export type EngineDiagnosticSeverity = "info" | "warning" | "error";

/**
 * A structured, machine-codeable engine message. Unconsumed: the pipeline that
 * exists reports through `TransformMeta.warnings`, a flat `string[]` with no
 * code and no severity. If diagnostics are ever built for real, this is the
 * shape that was intended - and `warnings` is what would have to migrate.
 */
export interface EngineDiagnostic {
  readonly severity: EngineDiagnosticSeverity;
  /** Stable machine code, e.g. `E_REGEX_UNSAFE`, `W_FIELD_MISSING`. */
  readonly code: string;
  /** Human-readable message; should be i18n-keyed where surfaced in UI. */
  readonly message: string;
  /** Optional context: field name, record id, step kind. */
  readonly context?: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine envelope
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The envelope a single engine call was to take: a source, the schema to read
 * it with, and the steps to run. Unconsumed - there is no `DataEngine` entry
 * point in the tree; callers assemble frames and call `executeTransform`
 * directly.
 */
export interface DataEngineRequest {
  readonly source: DataSource;
  readonly schema: ProjectSchema;
  readonly steps: readonly TransformStep[];
  /**
   * Optional cache key. When provided, the engine may return a cached
   * `DataEngineResult` whose `meta.fromCache` is `true`. Keys must be
   * deterministic over `(source, schema, steps)`.
   */
  readonly cacheKey?: string;
}

/** Execution telemetry for one engine call. Unconsumed. */
export interface DataEngineResultMeta {
  readonly fromCache: boolean;
  readonly durationMs: number;
}

/** Result envelope: the frame, its diagnostics, and how it was produced. Unconsumed. */
export interface DataEngineResult {
  readonly frame: DataFrame;
  readonly diagnostics: readonly EngineDiagnostic[];
  readonly meta: DataEngineResultMeta;
}

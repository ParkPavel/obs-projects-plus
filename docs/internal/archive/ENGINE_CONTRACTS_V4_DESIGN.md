# The v4 "Unified DataEngine" type layer — the design, and why it was never built

> Archived 2026-09-02 by ticket **#178**. This document is a record, not an instruction. Nothing
> here describes code that runs; every type below was erased at compile time and had zero live
> consumers on the day it was deleted.

## What these files were

Three type-only modules, 515 lines, written as the normative "Layer 0" of a v4 architecture:

| Original path | Lines | Declared role |
|---|---|---|
| `src/lib/engine/contracts.ts` | 351 | filter IR, aggregation alphabet, rollup/formula IR, transform pipeline, DataEngine request/result envelopes |
| `src/lib/relations/contracts.ts` | 83 | relation edges and the vault-scoped relation index |
| `src/lib/colors/contracts.ts` | 81 | colour tokens, palettes, palette persistence |

They formed a closed set: `relations/contracts.ts` and `colors/contracts.ts` had **zero** importers,
and `engine/contracts.ts` was imported by exactly those two, type-only, for `ProjectId` and
`RecordId`. Deleting any one alone would have broken the other two; deleting all three broke
nothing.

## Why it was never built, and why finishing it was rejected

Three reasons, each checked against the tree rather than assumed:

1. **Building the filter half violates invariant 2 (one filter engine).** `FilterCondition` /
   `FilterIR` below key on `op` with a `DataValue` payload. The shape the product actually stores is
   `FilterDefinition` in `src/settings/base/settings.ts`, evaluated by
   `src/lib/engine/filterEvaluator.ts`. Implementing the IR would have created a second filter
   representation — precisely the thing the invariant forbids.

2. **`AggregateFn` is not a superset of the live alphabet — it is a different one.** The persisted
   vocabulary is `RollupFunction` (`src/lib/engine/aggregate.ts`), reached through
   `RollupConfig.function`. `RollupFunction` carries `count_total`, `count_values`,
   `percent_empty` / `percent_not_empty`, `percent_true`, `concat`, `concat_unique`,
   `show_original`, `show_unique` — none of which appear in `AggregateFn`; `AggregateFn` carries
   `count_not_empty`, `first`, `last`, `list`, `list_unique`, `earliest`, `latest` — none of which
   exist live. Adopting `AggregateFn` would have renamed values already written into users' vaults.

3. **No scene in the product contract asks for a DataEngine.**
   `docs/internal/PRODUCT_RESET_2026-07-18.md` is the active contract, and none of its scenes needs
   a unified engine entry point. Callers assemble frames and call `executeTransform` directly.

Two further facts closed the question rather than leaving it open:

- The live relation index is nothing like the contract below. `RelationIndex` here is a class-shaped
  `forward` / `inverse` / `rebuild` / `invalidate` interface; `src/lib/relations/inverseIndex.ts` is
  pure functions over a `Map`. Nothing live implemented the dead contract, and nothing was moving
  toward it.
- The future `colors/contracts.ts` was kept for arrived, and went around it.
  `docs/ARCHITECTURE_V5.md` §3.6 (R5-005) planned to revive it as the single palette source; the
  ticket shipped as `src/lib/stores/palettes.ts`, which declares its own shape and never touches
  the contract.

## The decision

- **Who:** the user, 2026-09-02, recorded in `docs/internal/BACKLOG.md` under `### #178` as
  `RESOLVED 2026-09-02 (пользователь)`.
- **What:** delete the three files; preserve their text here.
- **Condition set with the decision:** verify usage leaks by *calls in code*, not only by exports —
  dynamic imports, string references to paths and names, `typeof` / `keyof`, tests, mocks, docs,
  build configs. That map was produced by the Codex `code-mapper` role and is kept verbatim at
  `docs/internal/codex-reports/CX-MAP-178.md`. Its verdict: all three deletable as one set.
- **Plan it followed:** `docs/internal/PLAN_178_ENGINE_CONTRACTS_2026-09-02.md` (option B with C's
  archival half).

Nothing migrates: none of these symbols was ever a persisted value, so no vault key changes. The
`DataTableConfig.subBases` precedent — keys kept because a shipped alpha wrote them — does not apply
here, because none of these keys ever reached a vault.

## A note on the headers below

Read the `@see` lines with that in mind: `docs/ARCHITECTURE_V4.md` and `docs/PHASE_3_TICKETS.md`
**do not exist anywhere in the repository** and did not exist before this deletion either (checked
2026-09-02). The REFACTOR-1xx / 2xx / 4xx tickets those headers promise as the migration path have
no surviving record. The files' own references were already dangling — which is part of why the
design below is a record and not a roadmap.

The bodies that follow are verbatim, under their original paths.

---

## `src/lib/engine/contracts.ts`

```ts
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
 * `AggregateIR`, `TransformStepIR`, `EngineDiagnostic`, `DataEngineRequest` and
 * `DataEngineResult` have zero consumers.
 *
 * So the words "NORMATIVE" and "single source of truth" below describe an
 * intent, not the code. What is actually canonical today:
 *
 * | This file says | What the product runs |
 * |---|---|
 * | `AggregateFn` is the kernel alphabet | `RollupFunction` in `lib/engine/aggregate.ts` |
 * | `FilterIR` / `FilterCondition` with `op` | `FilterDefinition` in `settings/base/settings.ts`, evaluated by `filterEvaluator.ts` |
 * | `TransformStepIR` with `kind` + `payload` | `TransformStep` with `type` in `lib/dashboard-engine/transformTypes.ts` |
 *
 * That last row used to be a live hazard rather than a curiosity: both types
 * were exported under the name `TransformStep`, so importing this one
 * type-checked in places where it was simply wrong. #179 (2026-09-02) renamed
 * this one to `TransformStepIR`, matching its `FilterIR` / `RollupIR` /
 * `AggregateIR` siblings, so the wrong import no longer resolves silently.
 * `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts` keeps it that way.
 * The stored, executed pipeline step is still the one in `transformTypes.ts`.
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
 * discriminated by `type` and carries its payload flat rather than nested.
 *
 * This version is the v4 IR and has no consumers. The `IR` suffix is not
 * decoration: until #179 both types were exported as `TransformStep`, and
 * because their fields partly overlap, importing the wrong one compiled. The
 * suffix also matches the siblings this type actually belongs with —
 * `FilterIR`, `SortIR`, `GroupIR`, `ComputeIR`, `AggregateIR`.
 */
export type TransformStepIR =
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
  readonly steps: readonly TransformStepIR[];
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
```

## `src/lib/relations/contracts.ts`

```ts
/**
 * Canonical type contracts for the relations layer (v4.0 / Layer 0).
 *
 * NORMATIVE source of truth for cross-record / cross-SubBase relation
 * resolution and inverse indexing.
 *
 * Per ARCHITECTURE_V4 §3.2 and PHASE_3_TICKETS REFACTOR-006:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports.
 *   - Consumer migrations land in REFACTOR-204 (cross-SubBase resolver),
 *     REFACTOR-105 (wiki-link unify), REFACTOR-107 (coverage gap fill).
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §3
 * @see docs/PHASE_3_TICKETS.md REFACTOR-006
 */

import type { ProjectId, RecordId } from "src/lib/engine/contracts";

export type { ProjectId, RecordId };

/**
 * Discriminator for the kind of relation being expressed.
 *
 * `"row"` is the only kind in v4.0; `"property"` is reserved for a future
 * property↔property relation (e.g. computed-from-formula references).
 */
export type RelationKind = "row" | "property";

/**
 * One directed edge in the relation graph.
 *
 * The semantics of a `RelationRef` are:
 *   "the field `sourceField` on record (`sourceProjectId`,
 *    `sourceRecordId`) points at record (`target.projectId`,
 *    `target.recordId`)."
 *
 * The relation index keyed on `target.recordId` yields the **inverse**
 * (back-reference) view: every place a given record is referenced from.
 */
export interface RelationRef {
  readonly type: RelationKind;
  readonly sourceProjectId: ProjectId;
  readonly sourceRecordId: RecordId;
  readonly sourceField: string;
  readonly target: {
    readonly projectId: ProjectId;
    readonly recordId: RecordId;
  };
}

/**
 * Minimal record shape consumed by the index for `rebuild()`.
 * Concrete records (`DataRecord`) satisfy this shape structurally.
 */
export interface RelationIndexableRecord {
  readonly id: RecordId;
  readonly values: Readonly<Record<string, unknown>>;
}

/**
 * Vault-scoped relation index.
 *
 * Implementations must guarantee:
 *   - `forward(id, field)` is O(1) average lookup.
 *   - `inverse(id)` is O(1) average lookup over the back-reference set.
 *   - `rebuild(records)` is at most O(n × avg-relation-fields-per-record).
 *   - `invalidate(id)` removes both forward and inverse entries for the
 *     given source record id (NOT the target side).
 */
export interface RelationIndex {
  /** Outgoing relations from a single source record/field. */
  forward(sourceRecordId: RecordId, field: string): readonly RelationRef[];

  /** All incoming relations pointing AT a target record. */
  inverse(targetRecordId: RecordId): readonly RelationRef[];

  /** Full rebuild from scratch; idempotent. */
  rebuild(records: readonly RelationIndexableRecord[]): void;

  /** Drop forward entries originating from this record id. */
  invalidate(recordId: RecordId): void;
}
```

## `src/lib/colors/contracts.ts`

```ts
/**
 * Canonical type contracts for the unified color system (v4.0 / Layer 0).
 *
 * NORMATIVE source of truth for color tokens, palettes and palette
 * persistence. After REFACTOR-401, all color math and allowlists move
 * into `lib/colors/` and consume this contract.
 *
 * Per ARCHITECTURE_V4 §5 and PHASE_3_TICKETS REFACTOR-006:
 *   - Types ONLY. Zero runtime code. Zero side effects.
 *   - No circular imports.
 *
 * @since 4.0
 * @see docs/ARCHITECTURE_V4.md §5
 * @see docs/PHASE_3_TICKETS.md REFACTOR-006
 */

import type { ProjectId } from "src/lib/engine/contracts";

export type { ProjectId };

/**
 * Stable identifier for a built-in preset color (e.g. "red", "blue-2").
 *
 * The exact alphabet of preset ids is defined by the persistence layer
 * (REFACTOR-401). Treated here as an opaque branded string so callers
 * cannot accidentally pass arbitrary text where a preset is required.
 */
export type PresetColorId = string & { readonly __brand: "PresetColorId" };

/**
 * Single color expressed as one of three tagged shapes.
 *
 *   - `css-var`: late-bound to whatever the active Obsidian theme
 *     resolves the variable to. Recommended for theme-aware UI.
 *   - `hex`:    literal `#rrggbb` / `#rrggbbaa` for user-picked colors.
 *   - `preset`: one of the bundled palette ids (resolved by the
 *     persistence layer at render time).
 *
 * The shape is the discriminator; `kind` is the field tag.
 */
export type ColorToken =
  | { readonly kind: "css-var"; readonly name: `--${string}` }
  | { readonly kind: "hex"; readonly value: `#${string}` }
  | { readonly kind: "preset"; readonly id: PresetColorId };

/**
 * Named, ordered collection of color tokens.
 */
export interface ColorPalette {
  readonly id: string;
  readonly name: string;
  readonly swatches: readonly ColorToken[];
}

/**
 * Persistence scope for palettes / favorites.
 *
 * `"global"` palettes live in plugin settings; per-project palettes
 * live in the project definition and override globals when present.
 */
export type PaletteScope = "global" | ProjectId;

/**
 * Snapshot returned by `PaletteStore.load`.
 */
export interface PaletteSnapshot {
  readonly palettes: readonly ColorPalette[];
  readonly favorites: readonly ColorToken[];
}

/**
 * Persistence interface for palettes and favorites.
 *
 * REFACTOR-401 lands the concrete `lib/colors/persistence.ts`
 * implementation; this contract is what `ColorPicker.svelte` and
 * `RecordItem.svelte` will consume.
 */
export interface PaletteStore {
  load(scope: PaletteScope): Promise<PaletteSnapshot>;
  save(scope: PaletteScope, snapshot: PaletteSnapshot): Promise<void>;
}
```

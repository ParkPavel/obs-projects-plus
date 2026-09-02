# CX-MAP-178 — code-mapper usage trace for the three contracts files (main @ 6c6a82f)

Run 2026-09-02 through `.codex/run-role.mjs --role code-mapper`, Codex session 01a061dd-667a-74c1-9980-19ed6c45ebe5. Condition set by the user: check usage leaks by calls in code, not only by exports. Verdict: all three DELETABLE as one set.

## SYMBOL

`src/lib/engine/contracts.ts`

- `DataFieldType`, `DataFrame`, `DataValue`, `ProjectId`, `RollupModeId`, `FormulaNode` — re-export: `:90`. Origins: `dataframe.ts:85,31,124`; `settings.ts:6`; `rollupMode.ts:30`; `formulaParser.ts:25`.
- `FilterOperator :102`; `RecordId :113`; `ProjectSchema :121`; `DataSource :134`; `FilterCondition :150`; `FilterIR :164`; `AggregateFn :185`; `RollupIR :213`; `FormulaIR :232`; `SortKey :242`; `SortIR :251`; `GroupIR :256`; `ComputeIR :262`; `AggregateIR :268`; `TransformStepIR :288`; `EngineDiagnosticSeverity :300`; `EngineDiagnostic :308`; `DataEngineRequest :328`; `DataEngineResultMeta :341`; `DataEngineResult :347`.

`src/lib/relations/contracts.ts`

- `ProjectId`, `RecordId` — re-export: `:20`.
- `RelationKind :28`; `RelationRef :41`; `RelationIndexableRecord :56`; `RelationIndex :71`.

`src/lib/colors/contracts.ts`

- `ProjectId` — re-export: `:19`.
- `PresetColorId :28`; `ColorToken :41`; `ColorPalette :49`; `PaletteScope :61`; `PaletteSnapshot :66`; `PaletteStore :78`.

## CALLERS

- `engine/contracts.ProjectId`
  - `src/lib/colors/contracts.ts:17` — `import type { ProjectId } from "src/lib/engine/contracts";`
  - `src/lib/relations/contracts.ts:18` — `import type { ProjectId, RecordId } from "src/lib/engine/contracts";`

- `engine/contracts.RecordId`
  - `src/lib/relations/contracts.ts:18` — same type-only import.

- `engine/contracts.{DataFieldType, DataFrame, DataValue, RollupModeId, FormulaNode, FilterOperator, ProjectSchema, DataSource, FilterCondition, FilterIR, AggregateFn, RollupIR, FormulaIR, SortKey, SortIR, GroupIR, ComputeIR, AggregateIR, TransformStepIR, EngineDiagnosticSeverity, EngineDiagnostic, DataEngineRequest, DataEngineResultMeta, DataEngineResult}` — `NONE`.

- `relations/contracts.{ProjectId, RecordId, RelationKind, RelationRef, RelationIndexableRecord, RelationIndex}` — `NONE`.

- `colors/contracts.{ProjectId, PresetColorId, ColorToken, ColorPalette, PaletteScope, PaletteSnapshot, PaletteStore}` — `NONE`.

- Dynamic `import()`, `require()`, `jest.mock()`, and re-export specifiers for all three module paths — `NONE`.

- `typeof`, `keyof`, `satisfies` references to target-specific symbols — `NONE`.

- Declaration merging — `NONE`. The only matching `DataEngineRequest` outside the module is a synthetic string in `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts:116`; the suite states re-exports and declaration scopes are excluded at `:27-31`, `:60-64`.

- Test-only textual references:
  - `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts:6` — comment naming `engine/contracts.ts`.
  - `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts:115-123` — synthetic `TransformStepIR` / `DataEngineRequest`.
  - `src/__tests__/R0_14_duplicateExportedTypeNames.test.ts:130-145` — reconstructed pre-#179 filename and `TransformStep`; no import.

- Non-executing configuration text:
  - `.codex/run-role.mjs:26` — usage-example `--paths src/lib/engine/contracts.ts,...`.
  - `.codex/agents/code-mapper.toml:38-42` — known-trap documentation.

## FLOW

- All three modules are type-only. Their imports are `import type` at `engine/contracts.ts:68-79`, `relations/contracts.ts:18`, and `colors/contracts.ts:17`.
- No target file contains a `const`, `let`, `var`, `function`, `class`, `enum`, value import, or value export.
- Store / API / disk flow from these modules: `NONE`.
- Internal type graph:
  - `FilterOperator :102` → `FilterCondition :152` → `FilterIR :166-167` → `TransformStepIR :289` → `DataEngineRequest.steps :331`.
  - `AggregateFn :185` → `RollupIR.fn :216` → `AggregateIR.rollup :270` → `TransformStepIR :293`.
  - `FormulaNode` → `FormulaIR.ast :233` → `ComputeIR.formula :264` → `TransformStepIR :292`.
  - `RelationKind :28` → `RelationRef.type :42`; `RelationRef :41` → `RelationIndex.forward/inverse :73,76`.
  - `PresetColorId :28` → `ColorToken :44` → `ColorPalette.swatches :52` / `PaletteSnapshot.favorites :68` → `PaletteStore :79-80`.

- Runtime-undefined symbols if these were treated as ESM side-effect modules: `NONE`. Every listed symbol erases during TypeScript compilation; no runtime binding exists.

## DEAD

- `src/lib/relations/contracts.ts` — zero importers.
- `src/lib/colors/contracts.ts` — zero importers.
- `src/lib/engine/contracts.ts` — only the two type-only imports above; both importers are themselves zero-importer modules.
- Zero direct importers are distinct from identical names elsewhere: `ProjectId` remains defined at `src/settings/base/settings.ts:6`, independently of the engine re-export.

## PARALLEL

- Filter contract: dead `FilterCondition` / `FilterIR` use `op` and `DataValue` at `engine/contracts.ts:150-168`; live `FilterDefinition` / `FilterCondition` use `operator` and string value at `settings/base/settings.ts:34-38,215-220`, evaluated by `filterEvaluator.ts:2-14`.
- Transform contract: dead `TransformStepIR` is `kind`-discriminated at `engine/contracts.ts:288-293`; live stored `TransformStep` is `type`-discriminated at `dashboard-engine/transformTypes.ts:50-73`.
- Aggregation: dead `AggregateFn :185-201`; live kernel `RollupFunction` at `engine/aggregate.ts:27-58`; separate dashboard vocabulary at `transformTypes.ts:225-245`, executed by `computeAggFn` at `transformExecutor.ts:804-825`.
- Relations: dead class-shaped `RelationIndex :71-83`; live `InverseIndex` map and functions at `relations/inverseIndex.ts:24-32,109-157`; live relation model starts at `relations/relationContract.ts:43-68`.
- Colors: dead palette interfaces at `colors/contracts.ts:41-80`; live favorites store, including localStorage read/write, at `stores/palettes.ts:2-9,25-46`.

## UNKNOWN

- Static reading cannot rule out a module path assembled from arbitrary runtime strings, external plugins, or code outside this checkout.
- Documentation-only module citations exist in `docs/internal/PLAN_178_ENGINE_CONTRACTS_2026-09-02.md:1,20-25,33-40,63,87`, `docs/internal/CONTEXT.md:103`, `docs/internal/BACKLOG.md:3360-3364,3390`, `docs/internal/PRE_RELEASE_AUDIT_2026-08-31.md:66,259`, `docs/internal/RELATION_CONTRACT_ANALYSIS_111.md:21`, and `docs/ARCHITECTURE_V5.md:251`. They do not create TypeScript dependencies.

**VERDICT**

- `src/lib/relations/contracts.ts` — **DELETABLE**.
- `src/lib/colors/contracts.ts` — **DELETABLE**.
- `src/lib/engine/contracts.ts` — **DELETABLE as the three-file deletion set**; **NOT DELETABLE alone** while `relations/contracts.ts:18` and `colors/contracts.ts:17` remain.

Falsifier: any newly found executable module specifier or runtime side effect targeting one of these files.

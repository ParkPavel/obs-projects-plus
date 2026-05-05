# Contract Registry — v4.0

Single index of every cross-module contract. Update with each new contract or breaking change.

| Contract | File | Status | Consumers |
|---|---|---|---|
| `FilterIR`, `FilterCondition`, `FilterOperator`, `FormulaIR`, `RollupIR`, `TransformStep`, `DataEngineRequest`/`DataEngineResult` | `src/lib/engine/contracts.ts` (LIVE since REFACTOR-005) | STABLE | filterFunctions, transformExecutor, DataTable widget, Calendar agenda, formulaEngine, aggregation, settings migrator, transformCache, chartDataPipeline |
| `RelationRef` / `RelationIndex` | `src/lib/relations/contracts.ts` (LIVE since REFACTOR-006) | STABLE | inverseIndexStore, crossProjectResolver, VisualizerPane |
| `FrontmatterReader` / `FrontmatterWriter` / `WriteOpts` | `src/lib/frontmatter/contracts.ts` (LIVE since REFACTOR-006) | DRAFT — runtime impl in REFACTOR-202 | cellEditorWriter, EditNote, view save handlers |
| `ColorToken` / `ColorPalette` / `ColorPersistence` | `src/lib/colors/contracts.ts` (LIVE since REFACTOR-006) | STABLE | ColorPicker, RecordItem, conditionalFormat |
| `ProjectViewProps<T>` / `ViewApi` | `src/customViewApi.ts` (LIVE) | STABLE-V3 | all custom views; mirrored at v3.0.0 in `obsidian-projects-types/index.ts` (REFACTOR-007) |
| `ProjectDefinition<V>` (v3) | `src/settings/v3/settings.ts` (LIVE) | STABLE | All view systems |
| `DataFrame`, `DataField`, `DataRecord`, `DataValue` | `src/lib/dataframe/dataframe.ts` (LIVE) | STABLE | Universal |
| `RollupModeId` taxonomy | `src/lib/database/rollupMode.ts` (LIVE) | STABLE | UI rollup config picker; engine validates fn↔mode |
| `isUnsafePattern` ReDoS guard | `src/lib/helpers/regexSafety.ts` (LIVE) | STABLE | filterFunctions; **MUST** be adopted by formulaEngine + FilterRow.svelte (REFACTOR-001/002) |
| `aggregate(values, config)` kernel + `RollupFunction` | `src/lib/engine/aggregate.ts` (LIVE since REFACTOR-101) | STABLE | Dashboard footer aggregation, formulaEngine SUM/AVG/MIN/MAX/MEDIAN, crossProjectRollup |
| `evaluateFilter`, `matchesCondition`, `applyFilter`, operator tables | `src/lib/engine/filterEvaluator.ts` (LIVE since REFACTOR-104) | STABLE | `ui/app/filterFunctions.ts` (23-LOC facade), `Dashboard/engine/transformExecutor.executeFilter`, Calendar agenda |
| `parseWikilink`, `formatWikilink`, `extractWikilinks`, `stripToPath`, `stripToDisplay`, `isWikilink`, `WIKILINK_RE_*` | `src/lib/engine/wikilink.ts` (LIVE since REFACTOR-105) | STABLE | visualizer/relations, relations/inverseIndex, Dashboard/relationResolver, visualizer/propertyTypes, engine/crossProjectResolver, datasources/helpers, Calendar/agenda/filterEngine |
| `isNullish`, `isEmpty`, `isNotEmpty` predicates | `src/lib/engine/emptiness.ts` (LIVE since REFACTOR-106) | STABLE | viewSort (`isNullish`), filterEvaluator `baseFns` (`isEmpty`/`isNotEmpty`), Calendar agenda filterEngine (`isEmpty`) |
| `joinKey(value)` equality-key normaliser | `src/ui/views/Dashboard/engine/joinKey.ts` (LIVE) | STABLE | JoinStep (Pillar 5 — cross-type correlation), scatter correlation |

## Invariants (machine-checkable)

1. **R2.1b** — `RollupIR.fn === getRollupMode(RollupIR.mode).fn`. Enforced by `assertRollupInvariant`.
2. **R2.1c** — `evaluateFilter(record, {op: 'is-not'|'does-not-contain', field: K, value: V})` returns `true` when `record.values[K] === undefined`.
3. **AGG-1** — `aggregate([], fn)` for any fn returns `null` (canonical empty result), never throws.
4. **AGG-2** — `aggregate([x], 'sum') === aggregate([x], 'avg') === toNumber(x)` for numeric x.
5. **API-1** — `obsidian-projects-types` major version increments on every removal/rename of public symbol.
6. **REGEX-1** — `new RegExp(s)` MUST be preceded by `if (isUnsafePattern(s)) return fallback;`.
7. **JSON-1** — `JSON.parse` MUST be wrapped in try/catch with explicit fallback value.
8. **A11Y-1** — Any element with `outline: none;` MUST have a `:focus-visible` rule asserting outline.

## Public exports (semver guards)

| Symbol | Source | Removal blocked unless |
|---|---|---|
| `ProjectsPlusPlugin` | `src/main.ts` | major bump |
| `VIEW_TYPE_PROJECTS`, `VIEW_TYPE_VISUALIZER_PANE`, `VIEW_TYPE_DASHBOARD` (renamed from DATABASE) | `src/view.ts` | major bump |
| All exports of `obsidian-projects-types/index.ts` | package | major bump |

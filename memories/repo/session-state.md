# Session State — V5 Refactor Master

> Refresh this file at every handoff. One-page summary of where we are.

## Live status (2026-05-07 — session 5 docs)

- **session_phase**: Documentation audit complete. Session 3 re-prompt ready. Awaiting analytical session 3.
- **jest baseline**: 102 suites / 1650 tests PASS.
- **px-budget**: 191 (locked).
- **tsc -noEmit -skipLibCheck**: clean.

## Q1-Q4 Signoff (2026-05-06)

| Q | Decision |
|---|---|
| Q1 | Documentation standardized for Obsidian community: EN-primary public docs, internal planning in `docs/internal/`, archive in `docs/archive/`. Priority = Obsidian community plugin standard. |
| Q2 | User guide deferred. Plugin is raw — update after V5.4+ (post Table rebuild). |
| Q3 | Plugin version stays in 3.x.x branch throughout V5 cycle. |
| Q4 | Sub-bases = separate widget (not nested DashboardCanvas recursion). |

## V5 vision (one-liner)

Перенос плагина с парадигмы "Database view с виджетами" на **"Dashboard-as-canvas + Matryoshka sub-bases"** с адаптивным поглощением Dataview: каждая заметка с frontmatter — мини-база, между внутренними базами живут двусторонние relations и rollups; Dataview = query-backend с Notion-семантикой поверх.

## Session sequence

| Сессия | Роль | Статус |
|--------|------|--------|
| 1–4 | Рефакторинг V5.0–V5.3 (engine, filters, formula, settings) | ✅ DONE |
| 5 | Документация: аудит, исправление, SESSION_REPROMPT | ✅ DONE (эта сессия) |
| 6 | Аналитическая: разработка MODERNIZATION_PLAN_V5.md — запускать через `docs/internal/SESSION_REPROMPT.md` | ⬜ NEXT |
| 7+ | Разработка по согласованному плану | ⬜ FUTURE |

## Documentation structure (post-audit)

```
docs/
  DOCS_INDEX.md           — EN, single navigation point
  ARCHITECTURE_V5.md      — target architecture (contributor)
  CODE_STANDARDS.md (+RU) — engineering standards
  api.md (+ru)            — Custom View API (public)
  user-guide.md (+EN)     — user guide (deferred until V5.4+)
  internal/
    MASTER_MAP_V5.md              — refactor session map (agent/maintainer)
    REFACTOR_BACKLOG_V5.md        — R5-001..R5-015 tickets
    DESIGN_CONCEPT_NOTION_AESTHETIC.md — visual reference
    NOTION_PARITY.md              — gap analysis
    DATAVIEW_ABSORPTION_PLAN.md   — adaptive absorption strategy ← NEW
    SESSION_REPROMPT.md           — zero entry point for session 6 ← NEW
  archive/                — all V1-V4 historical docs (read-only)
```

## V5.1 COMPLETE (2026-05-06)

| R5 | Title | Status |
|---|---|---|
| R5-007 | ReDoS guards + JSON.parse safety | DONE |
| R5-006 | Migrate `new Menu()` callsites | DONE — zero `new Menu(` in src/ outside contextMenu.ts |
| R5-015 | Replace `(view as any).$set` with typed `updateProps` | DONE — `customViewApi.ts` + 5 view classes |
| R5-004 | Footer count semantic divergence | DEFERRED → R5-001 (table rebuild) |

### V5.1 architecture note (R5-006)

- `openContextMenuDeferred` added to `contextMenu.ts` — handles deferred right-click pattern (Calendar Day.svelte)
- `BoardColumn.onColumnMenu` API changed: `() => Menu` → `(event: MouseEvent) => void`
- `GridRow.onRowMenu`/`onCellMenu` changed: return `void`, accept `event` param
- `GridHeader/GridColumnHeader` chain updated to match
- Legacy `menuOnContextMenu` kept in helpers.ts (still used by GridRow for deferred row/cell menus — will be removed in R5-001)

## V5.2 R5-014 COMPLETE (2026-05-06)

| Test file | Tests | Status |
|---|---|---|
| `src/ui/app/useView.test.ts` | 8 | DONE |
| `src/lib/datasources/folder/datasource.test.ts` | 14 | DONE |
| `src/lib/datasources/dataview/datasource.test.ts` | 12 | DONE |
| `src/ui/app/viewHelpers.test.ts` | 15 | DONE |

### R5-014 note

- `View.svelte` reactive logic extracted to `src/ui/app/viewHelpers.ts`:
  `extractRelationTargetIds(projectId, fieldConfig)` + `getRecordColor(record, colorFilter, matchesFn)`
- `View.svelte` now delegates to these helpers; logic is identical
- `App.test.ts` / full `View.test.ts` deferred — require Svelte component mounting infrastructure not yet set up

## V5.2 R5-002 Phase 1 COMPLETE (2026-05-06)

| R5 | Title | Status |
|---|---|---|
| R5-002 | Unify formula stack — canonical import migration | Phase 1 DONE |

### R5-002 scope (Phase 1 done)

- `src/lib/formula/index.ts` — added `parseDateFormula`, `isDateFormula`, `getDateFormulaSuggestions`, `testDateFormula`, `DateFormulaResult`, `DateFormulaSuggestion` re-exports from `dateFormulaParser`
- All 8 consumer files migrated from `helpers/formulaParser` / `helpers/dateFormulaParser` to `src/lib/formula`:
  - `src/lib/engine/contracts.ts`
  - `src/ui/views/Calendar/agenda/AdvancedFilterEditor.svelte`
  - `src/ui/views/Calendar/agenda/DateFormulaInput.svelte`
  - `src/ui/views/Calendar/agenda/filterEngine.ts`
  - `src/ui/views/Dashboard/engine/formulaEngine.ts`
  - `src/ui/views/Dashboard/engine/formulaSerializer.ts`
  - `src/ui/views/Dashboard/widgets/FormulaNode.svelte`
  - `src/ui/views/Dashboard/widgets/FormulaVisualEditor.svelte`
- `evaluateFormula` marked `@deprecated` in `formulaParser.ts`
- Phase 2 (moving `evaluateValue` from `formulaEngine.ts` to `lib/formula`) deferred

## V5.3 R5-005 COMPLETE (2026-05-06)

| R5 | Title | Status |
|---|---|---|
| R5-005 | Unified Color/Palette system | DONE |

## V5.3 R5-008 COMPLETE (2026-05-06)

| R5 | Title | Status |
|---|---|---|
| R5-008 | Settings migration v3→v4 | DONE |

### R5-008 scope
- `src/settings/v4/settings.ts` — new version schema (structurally identical to v3, version: 4)
- `src/settings/settings.ts` — `LatestProjectsPluginSettings` now v4, `migrateV3ToV4` added, chain updated
- `src/ui/app/useView.ts` — removed dead `"table" → "database"` runtime remap
- `src/settings/settings.migrate.test.ts` — 5 new v4 tests

## R5-001 assessment (2026-05-06)

- `TableView.svelte` = 424 LOC (not 1800 as estimated)
- `DataTableWidget.svelte` already imports `DataGrid` from `Table/components/DataGrid/`
- `tableView.ts` already has deprecation banner placed
- Only `DataTableWidget.svelte` imports from `views/Table/` (outside Table/ itself)
- R5-001 scope: remove `TableView.svelte` + `tableView.ts`, keep `DataGrid/` shared library
- Status: V5.4, straightforward, no surprises

## R5-003 blocker analysis (2026-05-06)

- `filterEvaluator.ts` dateFns all use `dayjs()` hardcoded — adding `baseDateCtx` requires threading it through 20+ dateFns functions
- `AgendaFilter.value` = `string | number | boolean | string[] | null` vs `FilterCondition.value` = `string` — type bridge needed
- `regex` operator is agenda-only (not in `FilterOperator`) — must stay in filterEngine.ts
- `filterEngine.test.ts` has 503 lines of tests — good safety net for refactor
- Recommended approach: add `baseDateCtx?: Dayjs` to `dateFns` signatures, update `matchesCondition`, then thin-wrap filterEngine.ts

## Remaining top debts

| ID | Title | R5 | Phase |
|---|---|---|---|
| K-1 | Legacy DataGrid Table view (~424 LOC) | R5-001 | V5.4 |
| K-2 | 4 fragmented formula surfaces | R5-002 | V5.2 Phase 1 ✓ |
| K-3 | Calendar agenda parallel filterEngine | R5-003 | V5.2 |
| K-4 | Footer count semantic divergence | R5-004 | V5.1 (deferred) |
| K-8 | Legacy `view.type === "table"` remap | R5-008 | V5.3 ✓ |
| K-9 | App/View/useView without unit tests | R5-014 | V5.2 ✓ |
| K-15 | DashboardCanvas.svelte ~700 LOC | R5-013 | V5.2 |

## Constraints enforced

- All architectural decisions affecting >2 modules → `architect` subagent before code.
- After each major block → `context-keeper` subagent for preservation.
- `styles.css` is hand-maintained source; `esbuild.config.mjs::mergeCSS()` appends tokens via marker.
- PX-budget ratchet locked at 191.
- TypeScript strict — zero new `@ts-ignore`.

## Lessons (full list → memories/repo/LESSONS_LEARNED.md)

Key invariants for next session:
- Use Write tool only — never PowerShell Set-Content (BOM issue L-001)
- Verify agent file-path findings before coding (L-002)
- `indexOf(-1)` sorts unknowns FIRST — use `=== -1 ? Infinity : idx` to sort last (L-003)
- `DataFieldType` is enum — `DataFieldType.String` not `"string"` (L-004)
- `DataField` requires `identifier: boolean` (L-005)
- Sub-bases ARE implemented (SubBaseTabs.svelte, DataTableWidget.svelte) — don't treat as future (L-012)
- `TableView.svelte` = 424 LOC not 1800 — always measure before estimating (L-008)

## Verified code map (2026-05-07)

```
src/
  main.ts                         — plugin entry, CommandManager facade
  view.ts                         — view registration, "database"+"dashboard" aliases
  customViewApi.ts                — ProjectView base class, updateProps() (typed, replaces $set)
  managers/
    CommandManager.ts             — show-command lifecycle (D-014)
  settings/
    v4/settings.ts               — current schema (version:4, migrated from v3)
    settings.ts                  — LatestProjectsPluginSettings, migration chain v1→v4
    base/settings.ts             — FilterCondition (legacy, string value), FilterOperator enum
  lib/
    dataframe/dataframe.ts        — DataFrame, DataField, DataRecord, DataValue (STABLE)
    engine/
      contracts.ts               — FilterIR, FilterCondition, TransformStep, DataEngineRequest/Result
      filterEvaluator.ts         — evaluateFilter, matchesCondition, applyFilter (canonical)
      aggregate.ts               — aggregate(values, config), RollupFunction (STABLE)
      wikilink.ts                — stripToPath, stripToDisplay, parseWikilink (STABLE)
      emptiness.ts               — isNullish (sort), isEmpty/isNotEmpty (filter) (STABLE)
      crossProjectResolver.ts    — cross-project relation lookup
      crossProjectRollup.ts      — cross-entity rollup
    database/
      subBase.ts (139 LOC)       — SubBaseDefinition, SubBaseFilter types + factory
      subBasePartition.ts        — partition utilities
      rollupMode.ts              — RollupModeId taxonomy (STABLE)
      cellEditor.ts              — cell editor logic
    formula/
      index.ts                   — canonical re-export (all consumers import from here)
      extendedEvaluator.ts       — 90+ formula functions (IF, PMT, IRR, MAP, FILTER, LET, STYLE…)
    helpers/
      formulaParser.ts           — @deprecated evaluateFormula; FormulaNode AST
      dateFormulaParser.ts       — preprocessor (today, sow, eom, today+1w)
      regexSafety.ts             — isUnsafePattern, MAX_REGEX_INPUT_LENGTH (REGEX-1 invariant)
    colors/
      contracts.ts               — ColorToken, ColorPalette, ColorPersistence
    relations/
      inverseIndex.ts            — bidirectional link index
      crossSubBase.ts            — cross-sub-base relation lookup
    frontmatter/
      contracts.ts               — FrontmatterReader/Writer/WriteOpts (DRAFT — impl in R5-future)
    datasources/
      frontmatter/datasource.ts  — folder source (pp_created_time/pp_last_edited_time auto-fields)
      dataview/datasource.ts     — Dataview source (optional dep)
      helpers.ts                 — relation indexing (uses stripToPath)
    contextMenu.ts               — openContextMenu(), openContextMenuDeferred() (R5-006 DONE)
  ui/
    app/
      App.svelte                 — project switcher, top-level mount
      View.svelte                — single-view render, delegates to viewHelpers
      viewHelpers.ts             — extractRelationTargetIds, getRecordColor (R5-014)
      useView.ts                 — ProjectView lifecycle hook (R5-014 tested)
      DataFrameProvider.svelte   — datasource load + JSON.parse guard (R5-007)
      filterFunctions.ts         — 23-LOC facade over filterEvaluator (STABLE)
    views/
      Table/ (DEPRECATED, V5.4)
        TableView.svelte (424 LOC) — legacy table, deprecation banner present
        tableView.ts              — view class, deprecation banner
        components/DataGrid/      — shared with Dashboard DataTableWidget (keep on R5-001)
      Board/                     — Kanban, persist, zoom, collapse
      Calendar/
        components/              — Timeline, Day, multi-day bars
        agenda/
          filterEngine.ts        — agenda-specific filter (R5-003 target, still parallel engine)
          AdvancedFilterEditor.svelte — imports from lib/formula (R5-002 done)
      Gallery/
      Dashboard/ (752 LOC DashboardCanvas)
        DashboardCanvas.svelte   — layout + DnD only target after R5-013
        dashboardView.ts (87 LOC) — view class
        types.ts                 — all TS interfaces (DatabaseViewConfig, WidgetDefinition…)
        engine/
          transformExecutor.ts   — 8 pipeline steps (unnest/unpivot/compute/filter/group/agg/pivot/join)
          aggregation.ts         — 15+ footer aggregation functions
          chartDataPipeline.ts   — chart-ready data preparation
          conditionalFormat.ts   — cell-level styling rules
          formulaEngine.ts       — thin wrapper → lib/formula (R5-002 Phase 1)
          relationResolver.ts    — backlink enrichment
          joinKey.ts             — equality normaliser for JoinStep
          rollup.ts              — cross-project rollup field computation
          transformCache.ts      — memoization
          virtualScroll.ts       — viewport rendering >500 rows
        widgets/
          widgetRegistry.ts (109 LOC) — 8 widget types registered here
          DataTable/
            DataTableWidget.svelte (1118 LOC) — main table, sub-base handlers (lines 621-651)
            SubBaseTabs.svelte (177 LOC)       — sub-base tab UI (IMPLEMENTED, working)
          Chart/ChartWidget.svelte             — 10 chart types
          Stats/StatsWidget.svelte             — KPI cards
          Comparison/ComparisonWidget.svelte   — side-by-side metrics
          Checklist/ChecklistWidget.svelte     — checkbox list
          ViewPort/ViewPortWidget.svelte       — embeds other views (max 4 per canvas)
          FilterTabs/FilterTabsWidget.svelte   — local filter selector (max 1 per canvas)
          SummaryRow/SummaryRowWidget.svelte   — aggregation footer (max 1 per canvas)
      VisualizerPane/            — YAML Visualizer as Properties pane alternative
      YamlVisualizer/            — auxiliary YAML viewer
    components/
      FormulaEditor/             — formula UI (R5-002 preparation)
      ColorPicker/               — consumes lib/colors palette store (R5-005 done)
  lib/stores/palettes.ts         — global palette store (R5-005 done)
```


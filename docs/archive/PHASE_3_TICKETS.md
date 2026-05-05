# Phase 3 — REFACTOR Ticket Queue

> **Status**: NORMATIVE execution plan for v4.0 refactor.
> **Created**: 2026-05-03 (Refactoring Session v4.0 / Phase 3).
> **Constraint**: Each ticket ≤ 500 LOC delta, completable in one agent session.
> Tests must NEVER decrease (≥1176 at all times).
> P0 tickets gate any user-readiness audit.

Notation:
- COMPLEXITY: XS≤50 LOC · S≤150 · M≤300 · L≤500 · XL>500 (split required)
- DEPENDS_ON: ticket IDs that must merge first

---

## LAYER 0 — Foundation (Types, Contracts, P0 Security)

### REFACTOR-001 — P0 ReDoS hardening in formulaEngine
- **LAYER**: 0 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **CURRENT**: `src/ui/views/Database/engine/formulaEngine.ts` L745, L754 — `new RegExp(args[1])` without guard.
- **TARGET**: wrap in `isUnsafePattern()` from `lib/helpers/regexSafety.ts` + try/catch returning empty/false on failure.
- **AC**:
  1. Both `REGEX_MATCH` and `REGEX_REPLACE` short-circuit when `isUnsafePattern(pattern)` returns true.
  2. Invalid regex returns engine error code `E_REGEX_UNSAFE`, never throws.
  3. New `__tests__/formulaEngine.regex.test.ts` covers `(a+)+$`, `(a|a)*`, valid `^[a-z]+$`, invalid syntax.
  4. Build + all tests pass.
- **RISK**: low.

### REFACTOR-002 — P0 ReDoS hardening in FilterRow.svelte
- **LAYER**: 0 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **CURRENT**: `src/ui/views/Calendar/agenda/FilterRow.svelte` L250 `new RegExp(filterValue, 'i')` no guard.
- **TARGET**: same approach as REFACTOR-001 + fall back to literal `includes()` when pattern unsafe/invalid.
- **AC**:
  1. Unsafe/invalid pattern degrades to substring contains, never throws.
  2. UI displays small inline warning icon next to the field.
  3. New unit test for the helper extracted into `lib/helpers/safeRegexFilter.ts`.

### REFACTOR-003 — P0 settings migration try/catch
- **LAYER**: 0 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **CURRENT**: `src/settings/settings.ts::migrateSettings()` no guard inside chain; `loadData()` boundary OK but mid-pipeline throw uncaught.
- **TARGET**: each migrator wrapped in `Either<Error, T>`; on failure log + emit user notice + restore last-known-good from a `.backup.json` snapshot kept after each successful save.
- **AC**:
  1. Malformed input never crashes plugin onload.
  2. New `__tests__/settings.migrate.test.ts` covers 5 corruption shapes (string instead of object, missing version, version=99, partial v2, circular).
  3. Backup file written on save success (debounced).

### REFACTOR-004 — Atomic rename Database View → Dashboard View
- **LAYER**: 0 · **COMPLEXITY**: M · **DEPENDS_ON**: —
- **CURRENT**: 
  - folder `src/ui/views/Database/`
  - `databaseView.ts`, `DatabaseViewCanvas.svelte`
  - `VIEW_TYPE_DATABASE` constant
  - i18n keys `views.database.*`
- **TARGET**: rename via `git mv` (history preserved); update all imports; backward-compat reader for `view.type === "database"`.
- **AC**:
  1. `git mv` only — no rewrites.
  2. v3 saves with `"database"` type still load (idempotent migrate to `"dashboard"`).
  3. All 4 locales updated; parity guard passes.
  4. All 1176+ tests pass.
  5. `MASTER_MAP.md` paths updated.
- **RISK**: medium (broad import surface).

### REFACTOR-005 — `lib/engine/contracts.ts`
- **LAYER**: 0 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: Create `FilterIR`, `RollupIR`, `FormulaIR`, `TransformStep`, `DataEngineRequest/Result`. No semantic implementation; types only.
- **AC**: type-only export; `tsc` clean; no runtime side-effects.

### REFACTOR-006 — `lib/relations/contracts.ts` + `lib/frontmatter/contracts.ts` + `lib/colors/contracts.ts`
- **LAYER**: 0 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: parallel contract files for Phase 2 sections 3-5.

### REFACTOR-007 — Sync `obsidian-projects-types/index.ts` with internal API
- **LAYER**: 0 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **CURRENT**: types package frozen at v2; missing `dateFormat`, `agenda`, `DataQueryResult.dataGeneration/hasSort/hasFilter/filterConditions`, `ProjectViewProps.saveViewFilter/getRecordColor/sortRecords/getRecord`.
- **TARGET**: re-export from `src/customViewApi.ts`; bump package major to 3.0.
- **AC**: package builds; `customViewApi.ts` becomes the single source of truth; deprecation notice in old file.

### REFACTOR-008 — CommandManager unify (delete dead duplicate)
- **LAYER**: 0 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **CURRENT**: `main.ts` L479-620 `ensureCommands` lives; `managers/CommandManager.ts` is dead duplicate.
- **TARGET**: move logic into CommandManager; `main.ts` calls `commandManager.ensureCommands(this, settings)`. Delete duplicate from main.ts.
- **AC**: 0 duplicate methods between files; commands sync identically; new `__tests__/commandManager.test.ts`.

---

## LAYER 1 — Core Engine (Unified DataEngine)

### REFACTOR-101 — Move `aggregate()` to `lib/engine/aggregate.ts`
- **LAYER**: 1 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **CURRENT**: `src/ui/views/Database/engine/rollup.ts` exports `aggregate()`.
- **TARGET**: move kernel; old file re-exports for back-compat. NO semantic change.
- **AC**: all callers still resolve; import path canonicalised.

### REFACTOR-102 — Aggregation unify
- **LAYER**: 1 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-101
- **CURRENT**: `Database/engine/aggregation.ts` reimplements sum/avg/min/max/count.
- **TARGET**: delegate to `aggregate()`. Remove ~150 LOC.
- **AC**: 
  1. Footer values match formula values match rollup values for same input. New regression test pins this.
  2. ≥56 cases in `__tests__/aggregate.test.ts`.

### REFACTOR-103 — formulaEngine SUM/AVG/MIN/MAX/MEDIAN delegate
- **LAYER**: 1 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-102
- **TARGET**: replace inline impls with `aggregate(values, fn)`. 
- **AC**: existing formula engine tests pass; semantic parity with footer.

### REFACTOR-104 — Filter unify (`evaluateFilter`)
- **LAYER**: 1 · **COMPLEXITY**: L · **DEPENDS_ON**: REFACTOR-005
- **CURRENT**: `lib/datasources/filterFunctions.ts::matchesCondition` + inline switch in `transformExecutor.executeFilter`.
- **TARGET**: extract `lib/engine/filterEvaluator.ts::evaluateFilter(record, ir, schema)`; both surfaces consume.
- **AC**:
  1. R2.1c semantics preserved (negative ops on undefined fields).
  2. New `__tests__/filterEvaluator.test.ts` ≥60 cases.
  3. transformExecutor.executeFilter is now ≤30 LOC.

### REFACTOR-105 — Wiki-link parser unify
- **LAYER**: 1 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: `lib/wikilinks/parseWikiLink.ts`; `relationResolver.ts` and `inverseIndex.ts` consume.
- **AC**: 3-call-site convergence; new `__tests__/parseWikiLink.test.ts` covers anchor/alias/escape edge cases.

### REFACTOR-106 — Emptiness predicate unify
- **LAYER**: 1 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: `lib/values/emptiness.ts::isEmpty`; codemod replaces scattered `=== ""`, `EMPTY_TEXT_RE`, `nonEmpty.filter`.
- **AC**: `grep -r "=== \"\""` count drops by ≥80%.

### REFACTOR-107 — Engine coverage gap fill
- **LAYER**: 1 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-101..105
- **TARGET**: add tests for `relationResolver`, `crossProjectResolver`, `crossProjectRollup`, `inverseIndex`, `formulaParser`, `subBasePartition`, `joinKey`.
- **AC**: ≥7 new test files; each ≥5 cases; total +60 tests.

---

## LAYER 2 — Data Model

### REFACTOR-201 — Rollup mode↔fn migration
- **LAYER**: 2 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: settings v3 migrator fills `rollup.mode` from `rollup.function` when missing; runtime invariant `assertRollupInvariant`.
- **AC**: new `__tests__/rollup.invariant.test.ts`; old saves load with mode populated.

### REFACTOR-202 — FrontmatterWriter (codec + writer + retry)
- **LAYER**: 2 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-006
- **TARGET**: `lib/frontmatter/{codec,writer,reader,observer}.ts`.
- **AC**: type round-trip tests; race retry test; debounced change emit.

### REFACTOR-203 — `cellEditorWriter` migrate to FrontmatterWriter
- **LAYER**: 2 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-202
- **TARGET**: thin wrapper.
- **AC**: 0 direct `processFrontMatter` calls outside `lib/frontmatter/`.

### REFACTOR-204 — Cross-SubBase relation resolver
- **LAYER**: 2 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-006, REFACTOR-105
- **TARGET**: `lib/relations/crossSubBase.ts` per Phase 2 §3.3.
- **AC**: tests for same-base, cross-base, cross-SubBase scenarios.

### REFACTOR-205 — FileSystemWatcher cleanup
- **LAYER**: 2 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **TARGET**: store watcher reference in plugin; dispose in `onunload()`.
- **AC**: reload-cycle test confirms no listener leak.

---

## LAYER 3 — Views & Widgets

### REFACTOR-301 — DashboardCanvas (renamed) state cleanup
- **LAYER**: 3 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-004
- **TARGET**: clean fire-and-forget Promise patterns; document state graph.
- **AC**: explicit error boundaries on async paths; no `void async IIFE` without `.catch`.

### REFACTOR-302 — StrictGrid catch-up to Notion parity
- **LAYER**: 3 · **COMPLEXITY**: L · **DEPENDS_ON**: REFACTOR-104
- **TARGET**: pinned cols, multi-col sort, virtualization confirmed, conditional formatting wired, footer aggregate via `aggregate()`.
- **AC**: 13/14 features in §6.2 ticked; ≥30 new tests.

### REFACTOR-303 — Calendar a11y sweep (5 components)
- **LAYER**: 3 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: replace bare `outline:none` with global `:focus-visible` rule + remove local declarations.
- **AC**: `grep -r "outline: none" src/ui/views/Calendar` → 0; visual regression test of focus ring.

### REFACTOR-304 — FieldControl reactive sync fix
- **LAYER**: 3 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **CURRENT**: `let cachedValue = isDate(value) ? value : null` (L31).
- **TARGET**: `$: cachedValue = ...`.
- **AC**: regression test "parent changes value, child re-renders".

### REFACTOR-305 — EditNote async/await + a11y
- **LAYER**: 3 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-202
- **TARGET**: await `performSave()` at all call sites; replace 2000px hardcode with rem token; add `:focus-visible`.
- **AC**: race-condition test (close-during-save) passes.

### REFACTOR-306 — Legacy Table deprecation banner
- **LAYER**: 3 · **COMPLEXITY**: XS · **DEPENDS_ON**: REFACTOR-302
- **TARGET**: console.warn + settings migrator option `useStrictGrid: true` default for new dashboards.

---

## LAYER 4 — Widgets & UX

### REFACTOR-401 — Color picker math consolidation
- **LAYER**: 4 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-006
- **TARGET**: `lib/colors/{math,allowlist,persistence}.ts`; `RecordItem.svelte` HSV duplicate removed; `ColorPicker.svelte` migrated to shared math.
- **AC**: `RecordItem.svelte` LOC drops ≥250; new `__tests__/colors.math.test.ts`.

### REFACTOR-402 — Formula editor convergence
- **LAYER**: 4 · **COMPLEXITY**: L · **DEPENDS_ON**: REFACTOR-104
- **TARGET**: consolidate `FormulaEditor.svelte` and `FormulaBar.svelte` into one component variant.
- **AC**: single component used in Visualizer, Database, modal contexts.

### REFACTOR-403 — i18n holes sweep
- **LAYER**: 4 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-004
- **TARGET**: ~25 hardcoded strings (Russian leaks, English in calendar/modals) → i18n keys; all 4 locales filled.
- **AC**: parity check passes; new keys count = 4× count_per_locale.

### REFACTOR-404 — px → rem/em token codemod
- **LAYER**: 4 · **COMPLEXITY**: M · **DEPENDS_ON**: —
- **TARGET**: scripts/convert-px-to-rem.ps1 already exists; run + visual regression.
- **AC**: hardcoded px count drops by ≥80%.

---

## LAYER 5 — Audit gates

### REFACTOR-501 — User-readiness audit pass 1
- **LAYER**: 5 · **COMPLEXITY**: M · **DEPENDS_ON**: all of L0-L4
- **TARGET**: dispatch `auditor` subagent with full criteria list; address each finding.
- **AC**: 0 P0 + ≤2 P1 findings remaining.

### REFACTOR-502 — Notion parity gate
- **LAYER**: 5 · **COMPLEXITY**: S · **DEPENDS_ON**: PARITY-001..017
- **TARGET**: scorecard against Notion features (см. [docs/NOTION_PARITY.md](NOTION_PARITY.md)).
- **AC**: ≥90% feature parity (current baseline 72.7%, см. NOTION_PARITY §8); written report.

---

## LAYER 6 — Notion Parity Tickets

> **Ссылка на gap-analysis:** [docs/NOTION_PARITY.md](NOTION_PARITY.md). Phases B-F roadmap из MASTER §6.

### PARITY-001 — URL/Email/Phone field rendering
- **PRIORITY**: P0 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **CURRENT**: `DataFieldType.String` без specialised UI.
- **TARGET**: Расширить `DataFieldType` enum (`Url`, `Email`, `Phone`); `CellRenderer.svelte` рендерит `<a href>` (URL), `mailto:` (Email), `tel:` (Phone) с иконкой и hover preview. Auto-detect через FieldConfig.format hint.
- **AC**:
  1. CellRenderer для Url/Email/Phone — clickable link.
  2. Inline cell editor сохраняет plain string.
  3. Filter operators (`is`/`contains`/`is_empty`) работают.
  4. Settings UI: dropdown типа поля включает 3 новых варианта.
  5. Migration: существующие String-поля не ломаются (default остаётся String).

### PARITY-002 — RichText annotations (low priority)
- **PRIORITY**: P2 · **COMPLEXITY**: L · **DEPENDS_ON**: PARITY-001
- **TARGET**: inline bold/italic/code/colored ranges в title-cell. Хранение через markdown-syntax в frontmatter, рендеринг через MarkdownRenderer.
- **AC**: cell editor использует contenteditable; export/import сохраняет markdown.

### PARITY-003 — Status groups (todo/in-progress/complete)
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: расширить `FieldConfig.statusOptions` → `statusGroups: StatusGroup[]`; Board view группирует колонки по группам с visual separator.
- **AC**: 3 предустановленных группы + кастомные; backward-compat (опции без группы → "ungrouped").

### PARITY-004 — Relative date filters
- **PRIORITY**: P0 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-104 (FilterIR) recommended, но можно standalone
- **CURRENT**: операторы только absolute (`is-before`, `is-after`).
- **TARGET**: добавить операторы: `past-week`, `past-month`, `past-year`, `next-week`, `next-month`, `next-year`, `this-week`, `this-month`, `this-year`. Реализовать через `dayjs().subtract(...)` границы → date range comparison. UI: select operator → no-arg input.
- **AC**:
  1. 9 новых операторов работают в обоих filter engines (frontmatter/dataview).
  2. Test coverage: 9 unit-tests + edge cases (timezone, end-of-day boundary).
  3. i18n keys для всех 9 в en/ru/uk/zh-CN.

### PARITY-005 — Files field UI
- **PRIORITY**: P2 · **COMPLEXITY**: M · **DEPENDS_ON**: PARITY-001
- **TARGET**: dedicated cell renderer для multi-file поля: список chips с иконкой типа файла, drop-zone, click → open в Obsidian.
- **AC**: drag-drop из системы; preview для image/pdf.

### PARITY-006 — Two-way (dual_property) relations
- **PRIORITY**: P0 · **COMPLEXITY**: L · **DEPENDS_ON**: REFACTOR-006 (relations contracts)
- **CURRENT**: relation = wiki-link string, односторонне.
- **TARGET**: при `FieldConfig.relation.dual=true` + `targetField` — bidirectional write через `processFrontMatter` (см. MASTER §6.3 C1). RelationIndex обновляется при vault events.
- **AC**:
  1. Add link in A → B автоматически получает back-ref.
  2. Remove link → back-ref удаляется.
  3. Не создаёт infinite loops (mutex/queue).
  4. Test coverage: cross-source, missing target, rename source.
  5. Settings UI: чекбокс "Two-way relation" + targetField selector.

### PARITY-007 — Rollup full function set
- **PRIORITY**: P0 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-102 (aggregation unify)
- **CURRENT**: rollup.ts покрывает count/sum/avg/min/max/median/range/earliest/latest/date_range/unique.
- **TARGET**: добавить `show_original`, `show_unique` (массивы), `checked`/`unchecked`/`percent_checked`/`percent_unchecked`, `count_per_group`/`percent_per_group`/`sum_per_group` (группированные).
- **AC**: 9 новых функций с тестами; UI rollup-picker отображает все.

### PARITY-008 — Auto-fields (created_time / last_edited_time)
- **PRIORITY**: P1 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: virtual fields в DataFrame: `__created_time`, `__last_edited_time` из `TFile.stat.ctime/mtime`. Auto-populate при render, не сохраняются в frontmatter.
- **AC**: фильтрация/сортировка/group работают; не пишутся в YAML.

### PARITY-009 — unique_id field
- **PRIORITY**: P1 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: новый `DataFieldType.UniqueId` + `FieldConfig.uniqueIdConfig: { prefix?: string, counter: number }`. На create-record увеличивает счётчик в `ProjectDefinition`. Read-only.
- **AC**: атомарность инкремента (lock); миграция при rename project.

### PARITY-010 — Button field (post-Automation)
- **PRIORITY**: P3 · **COMPLEXITY**: M · **DEPENDS_ON**: PARITY-026
- **TARGET**: cell с кнопкой запускающей AutomationAction[].

### PARITY-011 — Page cover/icon (Table view)
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: `FieldConfig.coverField` + `iconField`. Render в Table — миниатюра в title-cell.

### PARITY-012 — Table sub-items (tree rendering)
- **PRIORITY**: P2 · **COMPLEXITY**: L · **DEPENDS_ON**: PARITY-006
- **TARGET**: parent/child через relation поле; tree-view с expand/collapse в DataTableWidget.
- **AC**: отступы 1.5rem/уровень; aggregate row spans subtree; bulk reparent через drag.

### PARITY-013 — Board card cover + horizontal layout
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: PARITY-011
- **TARGET**: image cover; toggle "Vertical/Horizontal" group orientation.

### PARITY-014 — Gallery card-size variants
- **PRIORITY**: P2 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **TARGET**: small/medium/large preset CSS vars.

### PARITY-015 — Timeline (Gantt) view
- **PRIORITY**: P1 · **COMPLEXITY**: XL (split required) · **DEPENDS_ON**: REFACTOR-005, PARITY-008
- **TARGET**: новый view-type. См. MASTER §6.4 D1. Compoenenty: TimelineView.ts, TimelineCanvas.svelte, TimelineHeader.svelte, TimelineRows.svelte, TimelineBars.svelte. Granularity: day/week/biweek/month/quarter/year. Drag bars → updateRecord(start/end). Pure CSS Grid (no D3).
- **SPLIT**:
  - PARITY-015a — view skeleton + header + rows (M)
  - PARITY-015b — bars + drag (M)
  - PARITY-015c — granularity switcher + grouping + today indicator (M)

### PARITY-016 — List view
- **PRIORITY**: P1 · **COMPLEXITY**: S · **DEPENDS_ON**: REFACTOR-302
- **TARGET**: minimal table — only title + visible properties inline; compact rows; нет column headers.

### PARITY-017 — Nested filter groups
- **PRIORITY**: P1 · **COMPLEXITY**: M · **DEPENDS_ON**: REFACTOR-104 (FilterIR)
- **TARGET**: рекурсивный `FilterNode` (см. MASTER §6.4 D2). Backward-compat migration `{conjunction, conditions}` → `{root: {[conj]: conditions}}`. UI: nested groups с indent.
- **AC**: depth ≥ 5 levels; correct evaluation; migrate existing filters.

### PARITY-018 — Filter by formula result (1st-class)
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: PARITY-017
- **TARGET**: FilterCondition operator на formula-field — auto-evaluate перед фильтрацией.

### PARITY-019 — Filter by rollup result
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: PARITY-007
- **TARGET**: rollup-field как filter target.

### PARITY-020 — Sort by formula UI
- **PRIORITY**: P2 · **COMPLEXITY**: XS · **DEPENDS_ON**: REFACTOR-005
- **TARGET**: dropdown в sort UI отображает formula fields.

### PARITY-021 — List functions in formulaEngine (`zip`, `extract`)
- **PRIORITY**: P2 · **COMPLEXITY**: XS · **DEPENDS_ON**: —
- **TARGET**: добавить 2 функции в formulaEngine с тестами.

### PARITY-022 — `lets()` formula construct
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: `lets(x = expr1, y = expr2, ..., body)` — local bindings.

### PARITY-023 — Inline insert column left/right
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: column context menu → "Insert left"/"Insert right" → quick FieldEditor modal.

### PARITY-024 — Bulk row select + actions
- **PRIORITY**: P2 · **COMPLEXITY**: M · **DEPENDS_ON**: —
- **TARGET**: checkbox column; selection-state store; actions toolbar (delete, move, set-property, export).

### PARITY-025 — Row drag handle in Table
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: dragHandle на каждой row (только когда сортировка отключена); reorder персистится через manual ordering field.

### PARITY-026 — AutomationEngine (Phase E)
- **PRIORITY**: P3 · **COMPLEXITY**: XL (split) · **DEPENDS_ON**: REFACTOR-205, REFACTOR-005
- **TARGET**: `lib/automation/automationEngine.ts`. Triggers: record-created/modified/deleted/property-changed. Actions: set-property/create-record/notice/template. См. MASTER §6.5 E1.
- **SPLIT**:
  - PARITY-026a — engine core + trigger registry
  - PARITY-026b — actions + safe execution
  - PARITY-026c — settings UI (rules editor)

### PARITY-027 — Slash command palette
- **PRIORITY**: P3 · **COMPLEXITY**: M · **DEPENDS_ON**: —
- **TARGET**: input listens for `/` → popover с filterable command list (insert column, change view, add filter, ...).
- **NOTE**: дублирует Obsidian command palette — оценить ROI перед реализацией.

### PARITY-028 — Per-database templates
- **PRIORITY**: P2 · **COMPLEXITY**: S · **DEPENDS_ON**: —
- **TARGET**: ProjectDefinition.recordTemplates: { name, frontmatter, body }[]. UI: "+ New" dropdown с list of templates.

---

## Execution order (dependency-resolved)

```
Tier 0 (parallel-safe):    001, 002, 003, 005, 006, 007, 008, 105, 106, 205, 303, 304, 404
                           PARITY-004, PARITY-008, PARITY-014, PARITY-021
Tier 1:                    004 (rename), 101
                           PARITY-001, PARITY-009, PARITY-016, PARITY-020, PARITY-022, PARITY-025
Tier 2:                    102, 104, 201, 202, 401, 403
                           PARITY-007 (after 102), PARITY-011, PARITY-023, PARITY-024
Tier 3:                    103, 107, 203, 204, 301
                           PARITY-006 (after 006-contracts), PARITY-013, PARITY-017 (after 104)
Tier 4:                    302, 305, 402, 306
                           PARITY-002, PARITY-003, PARITY-005, PARITY-012, PARITY-015a/b/c, PARITY-018, PARITY-019, PARITY-028
Tier 5 (gates):            501, 502
Optional Tier 6:           PARITY-010, PARITY-026a/b/c, PARITY-027
```

Total: 35 REFACTOR + 28 PARITY = 63 tickets. Estimated LOC delta: ~22 000 (с учётом dedup yield ~−5 000 → net ~17 000).

**Целевой результат после всех Tier 0-4 + PARITY P0+P1:** Notion parity ≥90% (см. [NOTION_PARITY.md](NOTION_PARITY.md) §8).

**Phase 3 complete (extended).**

# Текущий контекст — для агентов

> Обновлено: **2026-06-05 (#047 audit/icon-sweep ✅ DONE, branch fix/audit-ux-critical-bugs — awaiting user merge)**
> Предыдущий снимок: `.ai_internal/Archive/OLD-CONTEXT-2026-05-21-pre-sweep.md`
> Снимок Phase 1: `.ai_internal/Archive/OLD-CONTEXT-STATE.md`

## Состояние main

- HEAD: **`7756cd6`** — `Rebuild bundled main.js` (post merge стека M-DATAVIEW-BRIDGE + #022.6 + #039)
- `origin/main` = `main` (синхронизирован). Local `main` is at `49c1ec7` (docs audit commit).
- Active fix branch: `fix/audit-ux-critical-bugs` (off `main`/`49c1ec7`) — 2 commits, **awaiting user merge into main**.
- Pending merge (also awaiting user): `feat/046-demo-project-refactor` (commit `6336165`).
- Working tree: clean.
- Plugin version: `3.5.1-alpha`.

## Гейты (baseline on main @ 7756cd6, pre-#046)

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | 0 errors ✅ |
| `npm test` | **139 suites / 2099 tests PASS** ✅ |
| `npm run build` | OK ✅ |
| `@ts-ignore` в src | 0 ✅ |
| PX-budget (`R0_3_pxBudget.test.ts`) | ≤186, locked ✅ |

## Завершённые milestones

| Milestone | Статус | Итоговый merge |
|---|---|---|
| M-ENGINE-CLEANUP | ✅ DONE | (старые) |
| M-COLOR-SETTINGS | ✅ DONE | (старые) |
| M-CANVAS-REACTIVE Phase 1 (#016) | ✅ DONE | feat/016 |
| M-CANVAS-REACTIVE Phase 2 (#031) | ✅ DONE | feat/031.1–.4 |
| Phase 3 — FreeCanvas (#032) | ✅ DONE | feat/032.1–.4 |
| Phase 4 — Popup standardisation (#034) + #040 inline badges | ✅ DONE | feat/034 + 034.2a/b + 034.3 |
| **Phase 5 — Interactive Dashboard (#044)** | ✅ DONE | feat/044.1, .2, .3a, .4, .5, .3b |
| #042 project-title clip | ✅ DONE | fix/042 |
| #043 demo project + command | ✅ DONE | feat/043-* |
| #033 WidgetLayout migration grid → rem | ✅ DONE | `layoutMigration.ts` + tests |
| #009 Sub-base canvas | ✅ DONE | SubBaseCanvasWidget + deriveSubBasePartition + crossSubBase (3 suites / 31 tests) |
| #010 Bidirectional relations | ✅ DONE | resolveInverseAcrossSubBases + 3-tier matching |
| **M-TABLE-REWRITE (#001 DataTable widget)** | ✅ DONE | Column virtualization + group headers; legacy DataGrid archived |
| **#045.1 DataviewEnhancedSource factory + graceful degradation** | ✅ DONE (2026-05-22) | feat/045-1-dataview-enhanced-source @ 90ddb1d |
| **#045.5 Unified DV filter semantics via filterEvaluator** | ✅ DONE (2026-05-25) | feat/045-5-unified-dv-filter-semantics @ dc2d04b |
| **#045.3 Relation UI pill-chip** | ✅ DONE (2026-05-25) | feat/045-3-relation-ui-pill-chip @ 0f87c53 |
| **#022 Formula Constructor series** | ✅ DONE (2026-05-26) | feat/022-2..#022.5 merged; #022.6 stacked READY FOR PR |
| &nbsp;&nbsp;#022.2 archive dead formula code (208 LOC) | ✅ DONE | feat/022-2 @ 346b285 |
| &nbsp;&nbsp;#022.3 Ctrl+Space + snippet catalog | ✅ DONE | feat/022-3 @ 732cd6d |
| &nbsp;&nbsp;#022.4 FloatingPopup suggestion dropdown | ✅ DONE | feat/022-4 @ 801e03d |
| &nbsp;&nbsp;#022.5 JSDOM unit tests for FormulaConstructor | ✅ DONE | feat/022-5 @ 404e74e |
| &nbsp;&nbsp;#022.6 AdvancedFilterEditor → FormulaConstructor | ✅ READY FOR PR (stacked) | feat/022-6 @ 8a4d9a4 |
| **#039 Window resize smoothness (rAF + atomic moveResize)** | ✅ READY FOR PR (stacked on #022.6) | fix/039-window-resize-smoothness @ 1a62706 |
| **#047 UX audit fixes: emoji→lucide icon sweep, i18n gaps, P0/P1 bug fixes** | ✅ DONE (2026-06-05) — awaiting user merge | fix/audit-ux-critical-bugs @ 555e8f4 |

## M-DATAVIEW-BRIDGE — ✅ COMPLETE

NEEDS-ANALYSIS complete (`docs/internal/NEEDS-ANALYSIS/M-DATAVIEW-BRIDGE.md`).
Sub-tickets per gap matrix:

| Ticket | Title | Status |
|---|---|---|
| #045.1 | DataviewEnhancedSource factory + graceful degradation | ✅ DONE |
| #045.2 | Native-query lightweight layer (`nativeQuery.ts`) | ✅ DONE |
| **#045.3** | **Relation UI pill-chip (`RelationListView.svelte`)** | ✅ DONE |
| #045.4 | Rollup UI (`RollupCellRenderer` + `ConfigureField`) | ✅ DONE |
| #045.5 | Unified DV filter semantics via filterEvaluator canonical kernel | ✅ DONE |
| #045.6 | Status semantics / Board 3-tier grouping | ✅ DONE |

## Активные тикеты

**#047 — UX audit fixes** (M-UX / P0-P1-P2 sweep / Complexity M) — ✅ DONE, awaiting merge
- Branch: `fix/audit-ux-critical-bugs` (off `main`/`49c1ec7`)
- Commits: `008ba39` (duplicate Dashboard + ViewTabBar icons + i18n), `555e8f4` (full emoji→lucide sweep + i18n widget types + P1 invariant fix)
- P0: `AddView.svelte` deduplicate `Object.values($customViews)` by viewType; normalize "database"→"dashboard"; default type "dashboard"
- P1: `DataTableWidget.svelte` replaced `new Menu()` (invariant violation) with `openContextMenu()` from `src/lib/contextMenu.ts`
- P2: emoji→Lucide `<Icon>` sweep in WidgetHost, DashboardToolbar, FilterBridge, ViewTabBar, VisualizerPane, ErrorBoundary, Schema (7 files)
- i18n: `en.json`/`ru.json` — views.dashboard.name "Database"→"Dashboard"; +8 missing widget type keys (data-list, sub-base-canvas, yaml-visualizer, database-call, timeline, cover-banner, text, divider)
- Test mock: `src/__mocks__/obsidian-svelte.js` noopComponent → proper Svelte-compatible constructor (required by `new Icon(...)`)
- Gates: tsc 0 ✅ / 139 suites / 2099 tests PASS ✅ / build 0 errors ✅

**#046 — Demo project full refactor** (M-UX / P2 / Complexity M) — 🔄 awaiting user merge
- Branch: `feat/046-demo-project-refactor` (commit `6336165`)
- Goal: collapse 67-file / 12-view mishmash demo → single coherent B2B agency / studio domain, ~28-30 files, exactly **5 views**.
- `demoProject.ts` 1937 LOC → <700 LOC. `demoVerticals.ts` removed or <100 LOC.
- See карточку в `obs-projects-plus/docs/internal/BACKLOG.md`.

### Remaining audit findings (not yet ticketed — for next session):
- **F-02 (P1)**: `native-query` datasource has no UI entry point in `CreateProject.svelte` — users can't select it from UI
- **F-08 (P2)**: filter operator labels hardcoded in Russian in `filterHelpers.ts` — should use i18n keys
- **F-13 (P3)**: `FieldSettingsPanel.svelte` is dead code — not imported anywhere

Очередь P1 для M-V35-HOTFIX-UX исчерпана. P2 sweep: #046 + #047 в работе → awaiting merges.

## Метрики (актуальные)

| Метрика | Значение |
|---|---|
| Jest suites | 139 PASS |
| Jest tests | 2099 PASS |
| TSC errors | 0 |
| Build | OK |
| PX-budget (svelte+css) | ≤186 (locked) |
| Plugin version | 3.5.1-alpha |

## Открытые риски

- M-V35-HOTFIX-UX не закрыт формально в backlog (нужен sweep, низкий приоритет).
- BACKLOG.md не содержит карточек #045.1–#045.6 как отдельных тикетов
  (только упоминание в parent #045). После закрытия #045.5 — добавить sweep.
- **F-02 (P1)**: `native-query` datasource не имеет UI-точки входа в `CreateProject.svelte`.
  Пользователи не могут выбрать его через UI — требует отдельного тикета.
- **F-08 (P2)**: операторы фильтров захардкожены на русском в `filterHelpers.ts`.
- **F-13 (P3)**: `FieldSettingsPanel.svelte` — мёртвый код, не импортируется.
- Ветки `fix/audit-ux-critical-bugs` и `feat/046-demo-project-refactor` не смёржены в `main` — ждут действия пользователя.

## Запреты на этот цикл

- ❌ Прямые коммиты/пуши в `main` (хук блокирует).
- ❌ Удаление файлов в обход `.ai_internal/Archive/` без явного `OK`.
- ❌ Не править `filterEvaluator.ts` внутренности (engine — single source of truth).
  Допускается только потребление как библиотеки.
- ❌ Не повышать PX-budget без CHANGELOG-обоснования.
- ❌ Не добавлять `@ts-ignore` в `src/`.

## Точки входа для следующего агента

1. `.ai_internal/MASTER-MAP.md` — навигация по документам.
2. `obs-projects-plus/docs/internal/BACKLOG.md` — список milestones и тикетов.
3. `obs-projects-plus/docs/internal/NEEDS-ANALYSIS/M-DATAVIEW-BRIDGE.md` — Gap 6 для #045.5.
4. `obs-projects-plus/docs/internal/DATAVIEW_ABSORPTION_PLAN.md` — gap matrix + V5.8 scope.
5. `obs-projects-plus/CLAUDE.md` — стек/гейты/инварианты проекта.

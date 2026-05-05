# REFACTOR_BACKLOG_V5

> **Версия**: V5.0-foundation
> **Дата**: 2026-05-05
> **Статус**: ACTIVE — приоритизированный backlog для рефакторинг-сессии V5.
> **Замещает**: `IMPLEMENTATION_PLAN_CURRENT.md`, `PHASE_1_MAPPING.md`, `PHASE_3_TICKETS.md`.

---

## 0. Легенда

- **ID**: R5-XXX — стабильный идентификатор задачи.
- **Phase**: V5.1…V5.7 (см. [MASTER_MAP_V5.md §5](MASTER_MAP_V5.md#5-фазы-v5)).
- **Severity (исходного бага)**: P0/P1/P2/P3 (см. K-* в `MASTER_MAP_V5.md §4`).
- **Complexity**: XS (≤30 LOC), S (≤200), M (≤500), L (≤1500), XL (>1500).
- **Status**: BACKLOG / IN-PROGRESS / DONE / DEFERRED.

---

## 1. Foundation (V5.0) — Эта фаза

### V5.0-DOC-001 — Архивировать устаревшие docs
- **Status**: IN-PROGRESS
- **Action**: `git mv` следующих файлов в `docs/archive/`:
  - `MASTER_MAP.md`
  - `ARCHITECTURE.md`
  - `ARCHITECTURE_V4.md`
  - `IMPLEMENTATION_PLAN_CURRENT.md`
  - `PHASE_1_MAPPING.md`
  - `PHASE_3_TICKETS.md`
- **AC**: В `docs/` остаются: V5 docs, CODE_STANDARDS, api, user-guide, DESIGN_CONCEPT, NOTION_PARITY, DOCS_INDEX.

### V5.0-DOC-002 — Переписать DOCS_INDEX.md
- **Status**: BACKLOG
- **AC**: Один логичный раздел вместо склеенных двух версий. Ссылки на V5 docs первыми.

---

## 2. Cleanup (V5.1)

### R5-007 — ReDoS guards on formulaEngine + JSON.parse safety
- **Source**: K-7 (P1 sec) + K-12 (P2 sec)
- **Files**:
  - `src/ui/views/Dashboard/engine/formulaEngine.ts:781,790` — добавить `isUnsafePattern` + `MAX_REGEX_INPUT_LENGTH` guard.
  - `src/ui/app/DataFrameProvider.svelte:51` — try/catch на `JSON.parse(text)`.
  - `src/lib/engine/filterEvaluator.ts:70` — try/catch на `JSON.parse(cond.value)` (graceful fallback).
- **Complexity**: XS
- **Depends on**: —
- **Blocks**: —
- **AC**: тест на `evil.*evil.*evil(...)+$` паттерн возвращает безопасный fallback; тест на corrupted JSON в FrameProvider не падает.

### R5-006 — Migrate `new Menu()` callsites to `openContextMenu`
- **Source**: K-6 (P2)
- **Files** (7 offenders):
  - `src/ui/components/TagsInput/Tag/Tag.svelte:21`
  - `src/ui/views/Table/components/DataGrid/DataGrid.svelte:69,158,187` (NB: будет удалён в R5-001 — пропустить если порядок — после R5-001)
  - `src/ui/views/helpers.ts:144`
  - `src/ui/modals/components/EditNote.svelte:405`
  - `src/ui/views/Board/components/Board/BoardColumn.svelte:49`
  - `src/ui/views/Calendar/agenda/AgendaCustomList.svelte:118`
  - `src/ui/views/Calendar/components/Calendar/Day.svelte:449`
- **Complexity**: M
- **Depends on**: —
- **Blocks**: —
- **AC**: ноль вхождений `new Menu(` в `src/` за пределами `src/lib/contextMenu.ts`.

### R5-004 — Fix footer aggregation `count` semantic divergence
- **Source**: K-4 (P1)
- **Files**:
  - `src/ui/views/Dashboard/engine/aggregation.ts` — переименовать footer `count` → `count_total`; добавить `count` совпадающий с kernel non-null.
  - `src/settings/v3/migrate.ts` (или новый v4) — настройки `aggregations: ["count"]` → `["count_total"]` для существующих пользователей.
- **Complexity**: S
- **Depends on**: —
- **Blocks**: —
- **AC**: `aggregation.test.ts` обновлён; миграционный тест добавлен.

### R5-015 — Replace `(view as any).$set` with typed update method
- **Source**: K-11 / K-16 (P3)
- **Files**:
  - `src/customViewApi.ts` — abstract `update(props)`.
  - `src/ui/app/useView.ts:99` — заменить cast на typed call.
  - Каждый ProjectView потомок (Dashboard/Board/Calendar/Gallery) — реализовать `update`.
- **Complexity**: M
- **Depends on**: —
- **Blocks**: Svelte 4 migration (post-V5).

---

## 3. Engine unification (V5.2)

### R5-002 — Unify formula stack
- **Source**: K-2 (P2)
- **Files**:
  - `src/lib/formula/index.ts` — добавить `evaluateBoolean`, `evaluateValue`, `preprocessDateFormula`.
  - `src/lib/helpers/formulaParser.ts` — `evaluateFormula` помечается @deprecated, делегирует в lib/formula.
  - `src/ui/views/Dashboard/engine/formulaEngine.ts` — становится тонким wrapper'ом.
  - `src/lib/helpers/dateFormulaParser.ts` — становится preprocessor'ом.
  - UI: `FormulaEditor.svelte` подключается в `FormulaBar.svelte`, `AdvancedFilterEditor.svelte`, `DateFormulaInput.svelte`.
- **Complexity**: XL
- **Depends on**: R5-014 (нужны smoke tests на App/View чтобы не сломать)
- **Blocks**: R5-003

### R5-003 — Merge Calendar agenda filterEngine into filterEvaluator
- **Source**: K-3 (P1)
- **Files**:
  - `src/lib/engine/filterEvaluator.ts` — добавить `baseDate` ctx parameter.
  - `src/ui/views/Calendar/agenda/filterEngine.ts` — становится thin wrapper (только baseDate-relative parsing).
  - `src/ui/views/Calendar/agenda/AgendaCustomList.svelte` — импорт из kernel.
- **Complexity**: M
- **Depends on**: R5-002
- **Blocks**: —

### R5-013 — Decompose DashboardCanvas.svelte
- **Source**: K-15 (P2) + K-10 (fire-and-forget)
- **Files**:
  - `src/ui/views/Dashboard/DashboardCanvas.svelte` — оставить только layout/dnd (~250 LOC).
  - Новый `src/ui/views/Dashboard/dashboardCommands.ts` — command-bus subscribers.
  - Новый `src/ui/views/Dashboard/dashboardPreload.ts` — right-frame preload + generation token.
  - Заодно — `Notice()` на rejected promises вместо `console.error`.
- **Complexity**: L
- **Depends on**: R5-002 (formula bar упростится)
- **Blocks**: R5-009

### R5-014 — Tests on UI-critical paths
- **Source**: K-9 (P2)
- **Files**: новые `__tests__` для:
  - `App.svelte` (smoke + project switch)
  - `View.svelte` (cross-project enrichment + filter cascade)
  - `useView.ts` (ProjectView lifecycle)
  - `DataFrameProvider.svelte` (datasource load + JSON.parse guard)
  - `lib/datasources/folder/datasource.ts`
  - `lib/datasources/dataview/datasource.ts`
- **Complexity**: L
- **Depends on**: —
- **Blocks**: R5-001, R5-002, R5-009 (можно начинать параллельно).

---

## 4. Color/Settings foundation (V5.3)

### R5-005 — Unified Color/Palette system
- **Source**: K-5 (P2)
- **Files**:
  - `src/lib/colors/contracts.ts` — оживить (потребители).
  - `src/lib/stores/palettes.ts` — новый store (default palette из tokens).
  - `src/ui/components/ColorPicker/ColorPicker.svelte` — потреблять store.
  - `src/ui/views/Calendar/components/DayPopup/RecordItem.svelte` — мигрировать favorites.
  - `src/ui/components/Navigation/SettingsMenu/tabs/ColorFiltersTab.svelte` — потреблять store.
  - `src/ui/components/FieldControl/FieldControl.svelte` — заменить hardcoded `#3b82f6`.
- **Complexity**: M
- **Depends on**: —
- **Blocks**: R5-001 (DataTable widget будет потреблять palette).

### R5-008 — Settings migration v3 → v4
- **Source**: K-8 (P2)
- **Files**:
  - `src/settings/v4/` — новая версия миграции.
  - `src/settings/settings.ts` — chain v3→v4.
  - Миграция: `view.type === "table"` → `"dashboard"` с шаблоном "single DataTable widget"; обновлённая структура palettes.
- **Complexity**: M
- **Depends on**: R5-005
- **Blocks**: R5-001

---

## 5. Table rewrite (V5.4)

### R5-001 — Replace legacy DataGrid with Dashboard DataTable widget
- **Source**: K-1 (P1)
- **Files**:
  - удалить `src/ui/views/Table/` целиком (~1800 LOC).
  - удалить ремап в `src/ui/app/useView.ts`.
  - Dashboard's `src/ui/views/Dashboard/widgets/DataTable/` — финализировать (column virtualization, group headers).
- **Complexity**: L
- **Depends on**: R5-005, R5-008, R5-014
- **Blocks**: R5-009

---

## 6. Sub-bases (V5.5)

### R5-009 — Sub-base canvas (Matryoshka first deliverable)
- **Source**: видение V5
- **Files**:
  - `src/lib/database/subBase.ts` — расширить (relations field).
  - Новый `src/ui/views/Dashboard/widgets/SubBaseCanvas/` widget.
  - `src/main.ts` — реализовать subscriber для `add-sub-base` команды.
  - `src/ui/views/Dashboard/DashboardCanvas.svelte` — поддержка nested canvas.
- **Complexity**: XL (~1500 LOC)
- **Depends on**: R5-001, R5-008, R5-013
- **Blocks**: R5-010

---

## 7. Cross-base relations (V5.6)

### R5-010 — Bidirectional relations + rollups across sub-bases
- **Source**: видение V5 (Matryoshka principle)
- **Files**:
  - `src/lib/relations/crossSubBase.ts` — расширить.
  - `src/lib/engine/crossProjectRollup.ts` — generalize → `crossEntityRollup` (project + sub-base).
  - UI: relation picker модал + rollup field config UI в Dashboard.
- **Complexity**: XL (~800 LOC)
- **Depends on**: R5-009
- **Blocks**: —

---

## 8. YAML Visualizer как Properties pane (V5.7)

### R5-011 — YAML Visualizer как widget внутри Dashboard
- **Source**: видение V5
- **Files**:
  - переместить `src/ui/views/YamlVisualizer/` → `src/ui/views/Dashboard/widgets/YamlVisualizer/`.
  - зарегистрировать в `widgetRegistry`.
- **Complexity**: S
- **Depends on**: R5-001
- **Blocks**: R5-012

### R5-012 — Replace Obsidian Properties pane with YAML Visualizer (optional default)
- **Source**: видение V5
- **Files**:
  - `src/ui/settings/` — toggle "Use YAML Visualizer as Properties pane" (default off → V5.7 default on).
  - `src/main.ts` — auto-show на file open.
  - `src/ui/views/VisualizerPane/` — side-by-side embed.
- **Complexity**: M
- **Depends on**: R5-011
- **Blocks**: —

---

## 9. Граф зависимостей (текстовый)

```
R5-014 (tests) ──┬──► R5-002 (formula) ──┬──► R5-003 (calendar filter)
                 │                        └──► R5-013 (canvas split) ──► R5-009 (sub-base)
                 │                                                       │
R5-007 (security) (independent)                                          ├──► R5-010 (cross-base)
                                                                         │
R5-006 (menus) (independent)                                             │
                                                                         │
R5-004 (count) (independent)                                             │
                                                                         │
R5-015 (typed update) (independent)                                      │
                                                                         │
R5-005 (palette) ──► R5-008 (settings v4) ──► R5-001 (table rewrite) ────┘
                                                                  │
                                                                  └──► R5-011 (YAML widget) ──► R5-012 (Properties replace)
```

## 10. Метрика прогресса

В конце каждой фазы фиксируется в `memories/repo/session-state.md`:
- Закрытые R5-* IDs.
- LOC delta (`-X / +Y`).
- Изменение PX-budget ratchet.
- Состояние тестов (`npx jest` suite/test counts).
- Любые открытые риски / новые K-* issue IDs.

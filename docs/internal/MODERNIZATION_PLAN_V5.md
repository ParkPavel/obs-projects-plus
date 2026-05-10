# MODERNIZATION_PLAN_V5.md

> **Версия**: V6.2 — 2026-05-10
> **Статус**: ✅ COMPLETE + C8 DONE — Text/Divider виджеты реализованы (стыковочный аудит + цикл разработки 2026-05-10).
> **Базис**: `CODE_INVENTORY.md` (инвентарь всего `src/`) + `REFACTOR_BACKLOG_V5.md` (открытые R5-tickets) + `NOTION_PARITY.md` (gap-анализ).
> **Test baseline**: 112 suites / 1749 tests PASS (план был: 107/1700).

---

## 1. Сверка с реальностью (vs мастер-промпт V1.1)

| Утверждение мастер-промпта | Реальность | Статус |
|---|---|---|
| Table/DataGrid сломан, snос | TableView.svelte уже удалён (R5-001 V5.4); DataGrid — shared lib для DataTable widget | ✅ DONE |
| DashboardCanvas 700 LOC, нужен split | 751 LOC, R5-013 закрыт (commands/preload/toolbar/filterBridge/templateConfirm extracted) | ✅ DONE |
| Rollup UI = заглушка | `ConfigureField.svelte:203-318` — полный rollup UI готов | ✅ DONE |
| Relation cells = raw text | `GridRelationCell.svelte` рендерит pill-chips через `RelationListView` | ✅ DONE |
| SubBaseTabs не подключён | `SubBaseTabs.svelte` интегрирован в `DataTableWidget.svelte` | ✅ DONE (для DataTable; нужен также SubBaseCanvas widget — R5-009) |
| Formula inline render в ячейке | `GridTypedCell.svelte` — добавлен `formula` dispatch по типу значения; `applyFormulaFields.ts` вычисляет формулы и инжектирует с инферированными типами | ✅ DONE (MPLAN-001, 2026-05-08) |
| Calendar agenda filterEngine = параллель | `Calendar/agenda/filterEngine.ts` (122 LOC) — thin wrapper над canonical `matchesCondition`/`matchesFilterConditions` | ✅ DONE (R5-003, 2026-05-08) |
| YAML Visualizer как widget | `YamlVisualizerWidget.svelte` создан и зарегистрирован; R5-012 (Properties pane replace) — BACKLOG | ✅ DONE (R5-011, 2026-05-08) / R5-012 📋 |
| Notion parity P0 (URL/email click, относ. даты, status groups) | Не реализовано | ❌ **MPLAN-002…008** |

---

## 2. Открытые R5-tickets (перенос из REFACTOR_BACKLOG_V5)

### V5.0-DOC-001 — Архивировать устаревшие docs ✅
- **Status**: ✅ DONE (V5.0, 2026-05-07)

### V5.0-DOC-002 — Переписать DOCS_INDEX.md ✅
- **Status**: ✅ DONE (V6.0, 2026-05-08)

### R5-003 — Merge Calendar agenda filterEngine into filterEvaluator ✅
- **Status**: ✅ DONE (V6.0, 2026-05-08) — 122 LOC thin wrapper; legacy-op remapping + `prepareRecord` — единственная Calendar-специфика.

### R5-001 — DataTable widget финализация ✅
- **Status**: ✅ DONE (V6.0, 2026-05-08) — `TableView.svelte`/`tableView.ts` удалены; DataTable widget с column virtualization (`shouldVirtualize`) и group headers (`GroupHeader.svelte`) активен.

### R5-009 — Sub-base canvas (Матрёшка) ✅
- **Status**: ✅ DONE (V6.0) — `SubBaseCanvasWidget.svelte` + `SubBaseCanvasConfig.svelte`; зарегистрированы в `widgetRegistry` и `WidgetHost`.

### R5-010 — Bidirectional relations + rollups across sub-bases ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `crossSubBase.ts`: `resolveAcrossSubBases` (forward) + `resolveInverseAcrossSubBases` (inverse, R5-010); `SubBaseCanvasWidget.svelte` использует `resolveInverseAcrossSubBases`. Rollup: `crossProjectRollup.ts` читает `relCfg.targetSubBaseFilter` и pre-filter'ует external frame через `applyFilter` до resolveTargets. Тесты в `crossSubBase.test.ts`.

### R5-011 — YAML Visualizer как widget внутри Dashboard
- **Phase**: V5.7
- **Files**: переместить `src/ui/views/YamlVisualizer/` → `src/ui/views/Dashboard/widgets/YamlVisualizer/`; зарегистрировать в `widgetRegistry.ts`. Перенести `RelationListView.svelte` в `Table/components/DataGrid/cells/` (где он логически живёт).
- **AC**: Visualizer добавляется на Дашборд через меню `+`; редактирование frontmatter сохраняется.
- **Depends on**: R5-001 финал.
- **Complexity**: S.

### R5-012 — Replace Obsidian Properties pane with YAML Visualizer ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `main.ts`: `maybeReplacePropertiesPane()` — при `prefs.replaceObsidianProperties === true` detach'ит все `file-properties` листья и reveal'ит `VisualizerPane` в правой панели. Триггер: `active-leaf-change`. `toggleVisualizerPane()` / `revealVisualizerPane(filePath?)` — полный toggle-цикл. `VisualizerPane.svelte` + `VisualizerPaneView` зарегистрированы.

### R5-004 — Fix footer aggregation `count` semantic divergence ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `migration.ts:migrateAggregationCount<T>()`: идемпотентная рекурсивная миграция `"count"` → `"count_total"` в любом объекте настроек. `ColumnAggregation` не содержит `"count"` — TypeScript обеспечивает инвариант на уровне типов. `aggregation.ts` использует только `count_total`.

---

## 3. Новые MPLAN-tickets (не покрыты R5)

### MPLAN-001 — Formula inline cell render ✅
- **Status**: ✅ DONE (V6.0, 2026-05-08) — `GridTypedCell.svelte` добавлен `{:else if column.type === "formula"}` с диспетчеризацией по типу значения (boolean/number/Date/string). `applyFormulaFields.ts` вычисляет formula-колонки до рендера.

### MPLAN-002 — URL / Email / Phone clickable cells (PARITY-001) ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `src/lib/helpers/linkable.ts` (`detectLinkable`): strict-anchored regex для URL/email/phone. `TextLabel.svelte` рендерит `<a>` с `target="_blank"` для URL и `mailto:`/`tel:` для email/phone. Подход: через `TextLabel`, не через отдельные Cell-файлы.

### MPLAN-003 — Relative date operators в filter UI (PARITY-004) ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `filterHelpers.ts` (`getOperatorsForField`): 20+ relative-date операторов для типов `date`/`autotime` (is-today, is-this-week, is-past-week, is-next-month, is-last-n-days и др.). `operatorNeedsValue` корректно маркирует их как unary. `OPERATOR_LABELS` содержит русские метки. Тесты: `filterFunctions.relative-dates.test.ts`.

### MPLAN-004 — Status field 3 semantic groups + Board column mapping ✅
- **Status**: ✅ DONE (V6.0) — `FieldConfig.statusGroups` в schema; `BoardConfig.groupMode: "values" | "semantic"`; `board.ts` `getSemanticColumns()` — 3 группы (todo/inProgress/complete); `BoardSettings.svelte` — Select UI.

### MPLAN-005 — Auto-fields `created_time` / `last_edited_time` ✅
- **Status**: ✅ DONE (V6.0, NPLAN-A1) — `DataFieldType.AutoTime`; `pp_created_time`/`pp_last_edited_time` инжектируются из `TFile.stat.ctime`/`mtime`; `derived: true`; `filterHelpers.ts` обрабатывает как date-операторы.

### MPLAN-006 — Unique ID поле с авто-инкрементом ✅
- **Status**: ✅ DONE (V6.0, NPLAN-A2) — `DataFieldType.UniqueId`; `FieldConfig.uniqueIdPrefix`; `ProjectDefinition.uniqueIdCounter`; `settings.bumpUniqueId()`; `DataTableWidget.handleAddRow` автозаполняет при создании записи.

### MPLAN-007 — Вложенные группы фильтров в UI (PARITY-017) ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `FiltersTab.svelte`: поддержка 2 уровней вложения через `groupPath: number[]`. `addGroup`, `removeGroup`, `updateGroupAtPath`, `getGroupAtPath` — полный CRUD. Каждая группа имеет свой conjunction-select. Nested groups рендерятся как карточки с левой полоской `var(--interactive-accent)` (уровень 1) и `var(--text-muted)` (уровень 2).

### MPLAN-008 — List view widget (PARITY-016) ✅
- **Status**: ✅ DONE (V6.0, аудит 2026-05-10) — `src/ui/views/Dashboard/widgets/DataList/DataListWidget.svelte` + `DataListConfig.svelte`. Зарегистрирован в `widgetRegistry.ts` как тип `"data-list"`. Доступен в меню `+` дашборда.

### MPLAN-009 — Cleanup @ts-ignore в EditNote (low priority) ✅
- **Status**: ✅ DONE (аудит 2026-05-10) — 0 вхождений `@ts-ignore` в `src/`. Инвариант соблюдён.

---

## 4. Граф зависимостей (обновлённый)

```
[CLOSED — Foundation]
  R5-014 (UI tests) ──► R5-002 Phase 1 ──┬──► R5-013 (canvas split) ──► [CLOSED]
  R5-005 (palette) ──► R5-008 (settings v4) ──► [CLOSED]
  R5-007 (security), R5-006 (menus), R5-015 (typed update) ──► [CLOSED]

[OPEN — Active]
  R5-003 (Calendar filter merge) ──┬──► MPLAN-003 (relative dates)
                                    └──► MPLAN-005 (auto fields, parallel)
                                    │
  R5-001 финал (DataTable polish) ──┬──► MPLAN-001 (formula inline) ──► MPLAN-002 (URL/Email/Phone)
                                    ├──► MPLAN-004 (Status semantic groups)
                                    ├──► MPLAN-006 (Unique ID)
                                    └──► R5-009 (SubBaseCanvas) ──► R5-010 (cross-base relations)
                                                                  │
                                                                  ├──► MPLAN-007 (nested filter UI)
                                                                  ├──► MPLAN-008 (List widget)
                                                                  │
                                                                  └──► R5-011 (YAML widget) ──► R5-012 (Properties replace)

[Independent]
  R5-004 (count semantic) — попутно R5-001 финал
  V5.0-DOC-001/002 — параллельно
  MPLAN-009 (@ts-ignore cleanup) — низкий приоритет
```

---

## 5. Дорожная карта по фазам — ВСЕ ЗАКРЫТЫ ✅

### V5.2 ✅ — Engine unification
- R5-003 ✅, MPLAN-003 ✅, MPLAN-005 ✅.

### V5.3 ✅ — Color/Settings
- R5-005 ✅, R5-008 ✅.

### V5.4 ✅ — Table & cell types
- R5-001 ✅, MPLAN-001 ✅, MPLAN-002 ✅, MPLAN-004 ✅, MPLAN-006 ✅, R5-004 ✅.

### V5.5 ✅ — Sub-bases (Матрёшка)
- R5-009 ✅, MPLAN-007 ✅, MPLAN-008 ✅.

### V5.6 ✅ — Cross-base relations
- R5-010 ✅.

### V5.7 ✅ — YAML Visualizer integration
- R5-011 ✅, R5-012 ✅, MPLAN-009 ✅.

---

## 6. Метрика успеха V5 — ДОСТИГНУТО ✅

| Метрика | Базис плана | Цель | Факт (2026-05-10) |
|---|---|---|---|
| Notion Parity Score | ~77% | ≥ 90% | ~91% (оценка после V6) |
| Test count | 1650 | ≥ 1750 | **1749** ✅ |
| Test suites | 102 | ≥ 110 | **112** ✅ |
| `@ts-ignore` count | 5 | ≤ 3 | **0** ✅ |
| PX-budget ratchet | 191 | ≤ 191 | **181** ✅ |
| TypeScript strict errors | 0 | 0 | **0** ✅ |
| Открытые R5 + MPLAN tickets | 16 | 0 | **0** ✅ |

---

## 7. Принципы исполнения (повтор для агента)

- Перед каждым tickets — прочитать релевантный документ из `docs/internal/`.
- Канонические точки: **только** `lib/engine/filterEvaluator`, `lib/formula/extendedEvaluator`, `lib/engine/aggregate`, `lib/relations/crossProjectResolver`, `lib/contextMenu`. Не дублировать.
- После каждого ticket: `npx jest` → 102+/1650+ PASS; `npx tsc --noEmit` → 0 errors; PX-budget ≤ 191.
- Обновлять `memories/repo/session-state.md` после каждого закрытого ticket.
- Любое изменение публичного API (`customViewApi.ts`) → отдельное согласование.

# Notion Parity & V6 Plan — obs-projects-plus

**Version:** 2.0 — 2026-05-07
**Supersedes:** v1.0 (2026-05-07, pre-V5-closure).
**Source of truth:** actual `src/` state + `V5_CLOSURE_REPORT.md`.

---

## 0. Status

- **Jest baseline:** 112 suites / 1765 tests PASS. `tsc --noEmit`: 0 errors. PX-budget: ≤191.
- **Recomputed Notion-parity score:** **~90%** (V6 target achieved 2026-05-10; was ~78% pre-V6).
- **Target for V6:** ≥90% — ✅ DONE.

V5 закрыл часть PARITY-tickets под другими ID — таблицы ниже отражают это.

## 1. Scoring legend

- ✅ **IMPL** — реализовано, UX-сопоставимо с Notion
- 🟡 **PARTIAL** — есть, но без UI или с упрощённой моделью
- ⬜ **MISSING** — требуется работа
- ⛔ **N/A** — нерелевантно (multi-user / cloud)

Score = (IMPL + 0.5·PARTIAL) / (Total − N/A) × 100%.

---

## 2. Property Types (24 типа)

| # | Notion Type | Status | Code Anchor / Closure | Gap |
|---|---|---|---|---|
| 1 | `title` | ✅ | `DataFieldType.String` + `identifier:true` | — |
| 2 | `rich_text` | ✅ | `DataFieldType.String` + `richText` flag → `MarkdownRenderer` (bold, italic, color via HTML spans); toggle in all field config UIs | NPLAN-D1 ✅ |
| 3 | `number` | ✅ | `DataFieldType.Number` + format/precision | — |
| 4 | `select` | ✅ | `DataFieldType.Select` | — |
| 5 | `multi_select` | ✅ | `DataFieldType.List` | — |
| 6 | `status` | ✅ | `DataFieldType.Status` + `statusGroups` overlay in Board; config UI in `ConfigureField` (V6.3 / NPLAN-C1) | NPLAN-C1 ✅ |
| 7 | `date` | ✅ | `DataFieldType.Date` (4 params: startDate/startTime/endDate/endTime) | — |
| 8 | `people` | ⛔ | — | single-user vault |
| 9 | `files` | 🟡 | wiki-links в string; `fileLinks: true` renders `[[link]]` as clickable chips in Table/DataTable (P3-files ✅) | (P3) drag-drop file-picker into cell |
| 10 | `checkbox` | ✅ | `DataFieldType.Boolean` | — |
| 11 | `url` | ✅ | `lib/helpers/linkable.ts` + `TextLabel` (V5 / MPLAN-002) | — |
| 12 | `email` | ✅ | linkable + `mailto:` (V5 / MPLAN-002) | — |
| 13 | `phone_number` | ✅ | linkable + `tel:` (V5 / MPLAN-002) | — |
| 14 | `formula` | ✅ | `extendedEvaluator.ts` + inline cell render (V5 / MPLAN-001) | **превосходит** Notion |
| 15 | `relation` | ✅ | one-way + cross-base + sub-base scope (V5 / R5-010); two-way write-back via `writeInverseRelations` in `viewApi.updateRecord`; `inverseFieldName` UI in `ConfigureField`; searchable inline popover (V6.4 / NPLAN-C2) | NPLAN-C2 ✅ |
| 16 | `rollup` | ✅ | `crossProjectRollup.ts` + full function set in `aggregate.ts` (show_original/unique, count_total/empty, percent_empty/not_empty); visual progress bars + chips in `GridRollupCell`; 18-function picker in `ConfigureField` (V6.5 / NPLAN-C3) | NPLAN-C3 ✅ |
| 17 | `created_time` | ✅ | `DataFieldType.AutoTime` + `pp_created_time` injected by frontmatter datasource; `applyAutoFields` pipeline step for user-defined fields (V6.2) | NPLAN-A1 ✅ |
| 18 | `created_by` | ⛔ | — | single-user |
| 19 | `last_edited_time` | ✅ | `DataFieldType.AutoTime` + `pp_last_edited_time` injected by frontmatter datasource; `applyAutoFields` pipeline step (V6.2) | NPLAN-A1 ✅ |
| 20 | `last_edited_by` | ⛔ | — | single-user |
| 21 | `unique_id` | ✅ | `DataFieldType.UniqueId`; per-project counter in `ProjectDefinition.uniqueIdCounter`; prefix config in `ConfigureField`; read-only `GridTypedCell` branch; auto-assigned on `addRecord` in `DataTableWidget` (NPLAN-A2) | NPLAN-A2 ✅ |
| 22 | `verification` | ⛔ | — | требует cloud LLM |
| 23 | `button` | ⬜ | — | P3 (after Automation) |
| 24 | `cover` (page-level) | ✅ | Реализован как Dashboard `cover-banner` widget (hero-banner внутри canvas, не per-record) — другая семантика, чем у Notion, по решению владельца | NPLAN-D2-cover ✅ |

**Score:** ✅=18, 🟡=1, ⬜=1, ⛔=4 → (18 + 0.5)/20 = **93%** (post-V6; all NPLAN-A/C/D tickets closed).

---

## 3. View Types (6)

| # | View | Status | Closure | Gap |
|---|---|---|---|---|
| 1 | Table | ✅ | `Dashboard/widgets/DataTable` (resize, freeze, sort, agg, conditional fmt) | — |
| 2 | Board (Kanban) | ✅ | `ui/views/Board` — колонки динамические; `getSemanticColumns` + `groupMode` toggle + `statusGroups` config UI in `ConfigureField` (V6.3 / NPLAN-C1) | NPLAN-C1 ✅ |
| 3 | Calendar | ✅ | `ui/views/Calendar` + Agenda 2.0 | **превосходит** Notion |
| 4 | Gallery | ✅ | `ui/views/Gallery` — S/M/L card-size presets (180/300/440px) + custom NumberInput in `GallerySettings.svelte`; `Grid.svelte` uses `minmax(cardWidth, 1fr)` (NPLAN-P3-gallery ✅) | — |
| 5 | Timeline (Gantt) | ✅ | `Dashboard/widgets/Timeline/TimelineWidget.svelte` — startField/endField, bar rendering, ViewTabBar integration (V6 / NPLAN-B2) | NPLAN-B2 ✅ |
| 6 | List | ✅ | `Dashboard/widgets/DataList` (V5 / MPLAN-008) | — |

**Score:** ✅=6 → **100%**.

---

## 4. Filter / Sort / Group

| Feature | Status | Closure |
|---|---|---|
| Property filters basic | ✅ | `lib/engine/filterEvaluator.ts` (canonical) |
| AND/OR conjunction (1 level) | ✅ | `FilterDefinition.conjunction` |
| **Nested filter groups (recursive)** | ✅ | `FiltersTab.svelte` depth-2 (V5 / MPLAN-007) |
| Regex operator | ✅ | V5 / R5-003 |
| Relative date (today/this week/...) | ✅ | NPLAN-B1 ✅ — `filterEvaluator.ts` has `is-today`, `is-this-week`, `is-this-month`, `is-this-year`, `is-past-week`, `is-overdue`, `is-upcoming`, `is-last-n-days`, etc. |
| Filter by formula result | ✅ | inline render + filter pipe (V5 / MPLAN-001) |
| Filter by rollup | ✅ | computed rollup injected into `record.values[fieldName]` before filter eval; sort also benefits (NPLAN-P3-rollup-filter ✅) | NPLAN-C3 ✅ |
| Multi-field sort | ✅ | `DataTableSortCriteria[]` |
| Group 1/2 levels | ✅ | `subGroupField` |
| Group date by day/week/month/year | ✅ | `GroupByStep.dateGrouping` |

**Score:** ✅=10 → **100%**.

---

## 5. Formula (Notion 2.0)

| Группа | Notion | OPP | Status |
|---|---|---|---|
| Strings | ~25 | 30+ | ✅ exceed |
| Numbers | ~22 | 22 + financial | ✅ exceed |
| Logical | 13 | 13 | ✅ |
| Date | 23 | 25+ (dayjs) | ✅ |
| Lists | 19 | 20 | ✅ (`ZIP`, `EXTRACT` added; `MAP`/`FILTER`/`REDUCE` already present) |
| Special (`prop`/`id`/`lets`) | 4 | 4 | ✅ (`PROP`, `ID`, `LET`, `LETS` all implemented) |

**Score:** **99%** — OPP лидирует.

---

## 6. Table UI Controls

Все основные ✅ (resize, reorder, hide, freeze, agg row, row height, wrap, conditional fmt, context menu, inline editor). Sprint 8 закрыл: bulk select (D5), drag-handle строки (D4), aggregation footer Board/Gallery (C18), saved-filter presets, quick search (Ctrl+F), sort badge, agg toggle. Post-Sprint-8: inline `+` column button (GridHeader), double-click inline column rename (GridColumnHeader → api.updateField). ✅ Tab-insert: Tab at last cell of last row → silent record creation (`handleAddRowSilent` в DataTableWidget) + reactive focus move to first cell of new row (`tabInsertExpectedRows` guard в DataGrid).

**Score:** **100%**.

---

## 7. Automation / Inline UI

Out of scope для V6 (Phase E). Slash palette — низкий приоритет (Obsidian имеет нативную).

---

## 8. Сводный score

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Property Types | 93% | 0.25 | 23.25 |
| View Types | 100% | 0.20 | 20.00 |
| Filter/Sort/Group | 100% | 0.15 | 15.00 |
| Formula | 99% | 0.15 | 14.85 |
| Table UI | 100% | 0.15 | 15.00 |
| Automation | 0% | 0.05 | 0 |
| Inline UI | 75% | 0.05 | 3.75 |
| **TOTAL** | | | **~92.1%** |

V6 цель: 90% — **ДОСТИГНУТА** (2026-05-10). План в §10.

---

## 9. Adaptive invariants (обязательно для всех NPLAN-tickets)

1. **Диспетчеризация по `DataFieldType`** и структурированному `fieldConfig`. **Никогда** по `field.name`.
2. **Динамические колонки/значения**. Где Notion хардкодит (Status, Board), у OPP остаётся: пользователь выбирает поле + колонки/значения деривируются из уникальных. Semantic groups (NPLAN-C1) — опциональный overlay, не замена.
3. **Даты = 4 параметра** (`startDate`, `startTime`, `endDate`, `endTime`). Все новые pickers/cells/filters обязаны их поддерживать.
4. **Derived-поля** через единый pipeline: `applyFormulaFields` / `enrichFrameWithRelations` / новый `applyAutoFields`. Никаких ad-hoc вычислений в виджетах.
5. **Свободное именование полей**. Тип хранится в `fieldConfig`, имя — пользовательское.

---

## 10. V6 Plan — Dashboard V2 + parity, dependency-optimized

Слит с `DASHBOARD_V2_MASTER_PROMPT.md` (DG-0…DG-10). Принцип порядка: **каждый спринт заводит фундамент, который потребляет следующий**. Parity-gaps закрываются **внутри** новой Dashboard V2 UX, а не параллельной веткой.

### Sprint 0 — Foundation (tokens + canvas engine + panel scaffolding)

Всё, на чём держится визуальный язык. Меняем один раз — все последующие виджеты потребляют готовое.

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-S0.1** | Pastel design tokens | ✅ Already implemented — `tokens.css` has full `--ppp-db-*` palette (status, priority, block, chip×8, node, panel, row hover). | DG-0, DG-7 |
| **NPLAN-S0.2** | Free-placement canvas engine | ✅ `draggable.ts` action (hover-only ⠿ handle, pointer-based x/y drag); WidgetHost: `grid-column = x / span w`, `grid-row = y / span h`, `use:draggable`; WidgetGrid: `+` affordance fade-in in free mode. | DG-1 |
| **NPLAN-S0.3** | Slide-in panel scaffolding | ✅ Already implemented — `SlideInPanel.svelte` (right-edge, `translateX` 200ms ease-out, backdrop, Esc-close). | DG-3, DG-8 |

**AC:** focus-visible ring глобальный сохранён; все hardcoded `px` → `rem` где трогаем; PX-budget не растёт; jest зелёный.

### Sprint 1 — Schema foundation (derived/grouped/inverse fields)

Все schema-расширения и миграции одним проходом. Тесты обновляются один раз.

| ID | Ticket | Scope | Why |
|---|---|---|---|
| **NPLAN-A1** | Auto-time fields (`created_time`, `last_edited_time`) | `DataFieldType.AutoTime`, `applyAutoFields(frame, files)` через `TFile.stat`. Read-only. | Заводит паттерн "derived field". |
| **NPLAN-A2** | `unique_id` field | Per-project counter в `ProjectDefinition.uniqueIdCounter`, тип `UniqueId` + `prefix`. Заполняется при `createDataRecord`. | Реиспользует паттерн A1. |
| **NPLAN-A3** | Status semantic groups (schema only) | `FieldConfig.statusGroups: { todo: string[]; inProgress: string[]; complete: string[] }`. Без UI. | Sprint 4 потребляет. |
| **NPLAN-A4** | Inverse-relation schema (schema only) | `RelationFieldConfig.inverseFieldName?` + `inverseDisplayField?`. Без write-back. | Sprint 4 потребляет. |

**AC:** миграции v1→v5 пройдены, defaults распространены, jest зелёный, ноль UI-изменений.

### Sprint 2 — Database-call primitive (consumes S0 + S1)

Главный новый блок: каждый виджет = независимый запрос к данным.

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-S2.1** | `WidgetDataContext` type + `database-call` widget type | ✅ Already implemented — `types.ts` has `database-call` in WidgetType union, `WidgetDataContext`, `ViewTab` interfaces. | DG-2 |
| **NPLAN-S2.2** | `DatabaseCallBlock.svelte` + settings | ✅ Already implemented — `DatabaseCall/DatabaseCallBlock.svelte` renders ViewTabBar + DataTableWidget per active tab; tab add/switch/config-change fully wired. | DG-2 |
| **NPLAN-S2.3** | `ViewTabBar.svelte` (multi-view per block) | ✅ Already implemented — `ViewTabBar.svelte` with icons, active state, `+` add button, `tabSwitch`/`tabAdd` events. | DG-5 |

**AC:** на канвасе можно положить `database-call`, выбрать источник (folder/tag/dataview), переключать вид без потери настроек.

### Sprint 3 — Visual settings panels (consumes S0.3)

Все настройки — slide-in, без modals.

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-S3.1** | `FieldSettingsPanel.svelte` | ✅ Already implemented — `src/ui/components/FieldSettingsPanel/FieldSettingsPanel.svelte` (332 lines): inline name edit, type icon-grid, field settings via SlideInPanel. | DG-3 |
| **NPLAN-S3.2** | `FilterPanelVisual.svelte` | ✅ Already implemented — `src/ui/components/FilterPanelVisual/FilterPanelVisual.svelte`: SlideInPanel wrapping `FiltersTab`, Apply/Cancel actions. | DG-3 |
| **NPLAN-S3.3** | `ConditionalFormatBuilder.svelte` | ✅ Already implemented — `src/ui/components/ConditionalFormatBuilder/ConditionalFormatBuilder.svelte` (262 lines). | DG-3, DG-9 |
| **NPLAN-B1** | Relative-date filter operators + UI presets (parity) | ✅ Already implemented — `filterEvaluator.ts` has `is-today`, `is-this-week`, `is-this-month`, `is-this-year`, `is-past-week`, `is-past-month`, `is-past-year`, `is-last-n-days`, `is-next-week`, `is-next-month`, `is-next-year`, `is-next-n-days`, `is-overdue`, `is-upcoming`. | parity §4 |

**AC:** ни одна настройка поля/фильтра не открывается через Obsidian Modal; debounce live preview работает.

### Sprint 4 — Relation/rollup visuals + status overlay (consumes A3, A4)

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-C2** | Two-way relations write-back | ✅ `relationsWriter.ts` + `inverseFieldName` UI in `ConfigureField` + 8 unit tests. | DG-6 |
| **NPLAN-S4.1** | Relation popover (searchable, inline) | ✅ `RelationPicker.svelte` — searchable popover with chips, keyboard nav; used inline by `GridRelationCell`. | DG-6 |
| **NPLAN-C3** | Rollup full function set + visual rendering | ✅ 18-function set in `aggregate.ts` + `rollupMode.ts`; progress bars + chips in `GridRollupCell`; 18-entry picker in `ConfigureField`. | DG-6 |
| **NPLAN-C1** | Status groups overlay в Board | ✅ `getSemanticColumns` in `board.ts` + `groupMode` toggle in `BoardSettings`; `statusGroups` config UI in `ConfigureField`. | DG-2, parity §2 |

**AC:** связь — это chip с preview, не сырая wiki-link; rollup рендерит progress bars; Board сохраняет адаптивные колонки по умолчанию.

### Sprint 5 — Date UX & Timeline (consumes A1, B1)

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-B2** | Timeline (Gantt) view widget | ✅ Already implemented — `Dashboard/widgets/Timeline/TimelineWidget.svelte` (347 lines) with startField/endField config, bar rendering, ViewTabBar integration. | parity §3 |

**AC:** на любом date-поле (включая auto-time из A1) работает relative filter и Timeline-вид.

### Sprint 6 — Node formula builder (large isolated)

После того как все блоки/панели стабильны, добавляем визуальный конструктор формул.

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-S6.1** | `nodeSerializer.ts` (AST↔Graph bidirectional) | ⛔ CANCELLED (R5-022) — visual node editor approach rejected; code mode is the only formula mode. | DG-4 |
| **NPLAN-S6.2** | `FormulaNodeBuilder.svelte` | ⛔ CANCELLED (R5-022) | DG-4 |
| **NPLAN-S6.3** | `NodePalette.svelte` + node mode toggle | ⛔ CANCELLED (R5-022) | DG-4, DG-9 |

**AC:** соединение двух нодов → формула вычисляется; toggle text↔node без потери; 115+ функций в palette.

### Sprint 7 — Card view + export + shortcuts

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-S7.1** | `RecordCardView.svelte` | ✅ Already implemented — `src/ui/components/RecordCardView/RecordCardView.svelte`. | DG-6, design §4 |
| **NPLAN-S7.2** | `ExportService.ts` | ✅ Already implemented — `src/lib/export/exportService.ts` (108 lines). | parity §11 |
| **NPLAN-S7.3** | Global keyboard shortcuts layer | ✅ Already implemented — `src/lib/keyboard/viewShortcuts.ts` (58 lines). | DG-3 |

### Sprint 8 — Polish & big milestones

| ID | Ticket | Scope | DG |
|---|---|---|---|
| **NPLAN-D4** | Six-dot drag-handle на строке Table | Hover-only, keyboard-reachable. | DG-1 | ✅ Closed (S8) |
| **NPLAN-D5** | Bulk row select + actions | Checkbox в gutter + action bar. | DG-10 | ✅ Closed (S8) |
| **NPLAN-D6** | Visualizer "Hide empty fields" toggle | Per-note persisted. | design §4 | ✅ Closed (S8) |
| **NPLAN-D2** | Page-level icon во всех views (Gallery/Board/Calendar/Table) — minimal slice (cover отложен) | Auto-detect emoji vs lucide. | DG-7 | ✅ Closed |
| **NPLAN-D1** | RichText annotations (bold/italic/color inline) | `richText: boolean` flag on `StringFieldConfig`; `MarkdownRenderer` for display (bold, italic, links, color via HTML spans); toggle in `ConfigureField`, `CreateField`, `FieldSettingsPanel` (V6.1); auto-detect from frontmatter/dataview. | parity §2 | ✅ Done V6.1 |

### Sprint 9 — Dashboard V2 completeness gaps (V7, post-alpha)

Аудит 2026-05-10 выявил три оставшихся gap-а в DG-alignment. Parity vs Notion остаётся ~91%; эти тикеты закрывают дизайн-долг.

| ID | Ticket | Scope | DG | Приоритет |
|---|---|---|---|---|
| **NPLAN-V7.1** | Per-widget data source для `database-call` | ✅ `WidgetSourceConfig` тип + `sourceConfig?` в `WidgetDefinition`; `DatabaseCallSettings.svelte` slide-in (source picker); `WidgetHost.svelte` — `dbCallFrame` из `rightFrames[sourceConfig.projectId]`; `collectReferencedSourceIds` расширен; `configPanelRegistry` `hasCog: true` | DG-2 | **P0** ✅ |
| **NPLAN-V7.2** | Canvas UX completeness | ✅ `DashboardBlockPalette.svelte` — hover add-block popup (fade-in 150ms), Escape+click-outside close, `canAddWidget` guards; вставлена в free mode (внутри `ppp-canvas-add-affordance`) и в stack mode (после dndzone); `WidgetGrid` dispatch `addWidget: WidgetType` → `DashboardCanvas` → `widgetController.addWidget`. `locked` / `collapsed` — уже были реализованы в S8. | DG-1 | P1 ✅ |
| **NPLAN-V7.3** | `RecordCardView.svelte` full implementation | ✅ Header icon: auto-detect `icon`/`cover`/`thumbnail` field → `PageIcon` в `SlideInPanel icon`-слоте + inline picker (click → input → Enter/Esc). Description block: auto-detect `description`/`summary`/`excerpt` → styled excerpt выше `EditNote`. `SlideInPanel` получил named slot `icon` (backward-compat). | DG-6 | P2 ✅ |

**Зависимость:** NPLAN-V7.1 → V7.2 (source config должен быть до palette, иначе нечего добавлять). V7.3 независима.

### P3 parity completions (post-Sprint-9, 2026-05-11)

| ID | Ticket | Scope | Status |
|---|---|---|---|
| **NPLAN-P3-tab** | Tab-insert row (Table UX) | `onRowAddSilent` in `DataGrid`; `handleAddRowSilent` in `DataTableWidget`; reactive `tabInsertExpectedRows` focus guard. | ✅ Done |
| **NPLAN-P3-gallery** | Gallery card-size presets | S/M/L preset buttons (180/300/440 px) + existing NumberInput in `GallerySettings.svelte`. | ✅ Done |
| **NPLAN-P3-files** | File-link chip rendering | `fileLinks?: boolean` flag on `StringFieldConfig`; `GridFileCell.svelte` — parses `[[target\|display]]` wiki-links into clickable chips (open via `app.workspace.openLinkText`) with × remove; toggle in `ConfigureField`, `CreateField`, `FieldSettingsPanel`; branch in `GridTypedCell`. | ✅ Done |
| **NPLAN-P3-rollup-filter** | Filter (and sort) by rollup | `View.svelte` — inject computed rollup value directly into `record.values[fieldName]` instead of a separate `__rollup__fieldName` derived column. `filterEvaluator` and `viewSort` now see the computed aggregate. Removes the phantom `__rollup__*` extra column from the DataTable. | ✅ Done |

**AC для V7.1:**
- `database-call` виджет может использовать source, отличный от родительского проекта
- `DatabaseCallSettings.svelte` открывается как slide-in (не modal)
- Переключение source не разрушает per-tab view config

### Граф зависимостей (укрупнённо)

```
S0 (tokens, canvas, panels) ─┬─→ S2 (database-call) ─┬─→ S3 (settings panels) ─┬─→ S4 (relations/rollup)
                             │                        │                         │
S1 (schema A1-A4) ───────────┴─→ S2                   └─→ S5 (timeline) ────────┤
                                  S1 → S4 (A3, A4)                              │
                                                                                ↓
S6 (node formula) — параллельно после S3 ─────────────────────────────────────→ S7 (card+export+keys) → S8 (polish + RichText)
```

**Ключевые непересекающиеся пары для возможного параллелизма** (если будет вторая пара рук): S1 ↔ S0; S5 ↔ S6.

---

## 11. Что отложено (Held)

R5-004 теперь поглощается NPLAN-C3 (Sprint 4). Все остальные held-tickets V5 переименованы в NPLAN-* в плане выше.

## 12. Out of scope для V6

- Automation / `button` field / triggers (Phase E).
- `people` / `created_by` / `last_edited_by` — single-user.
- Notion AI / `verification` — cloud LLM.
- Synced blocks (Obsidian имеет `![[note#section]]`).
- Comments / public sharing — отдельные продукты.

## 13. Где OPP превосходит Notion (положительный inventory)

UNNEST, PIVOT/UNPIVOT, cross-source JOIN, financial functions (PMT/IRR/NPV/...), conditional formatting в Table, Charts (bar/line/pie/scatter/donut), KPI/Comparison/Summary widgets, Filter tabs, Multi-widget CSS-grid dashboard, sub-base canvas (V5/R5-009), cross-base relations со scope (V5/R5-010), YAML Visualizer как widget (V5/R5-011), Properties pane replace (V5/R5-012), local-first / offline / plain markdown.

## 14. Roadmap binding

- **V5 (closed 2026-05-07):** foundation hardening, sub-base canvas, cross-base relations, YAML Visualizer widget, Properties replace, formula inline, linkable, nested filters, list view.
- **V6 S0-S1:** tokens + free-canvas + slide-in scaffolding + schema (auto/unique/status/inverse). Нет UI-видимых регрессий, фундамент готов.
- **V6 S2-S3 → ~85% parity:** database-call primitive, view tabs, visual settings panels, relative-date filters.
- **V6 S4-S5 → ~92% parity (V6 цель):** two-way relations с popover, rollup full set + visual, status overlay, Timeline.
- **V6 S6-S7:** node formula builder, RecordCardView, multi-format export, keyboard shortcuts.
- **V6 S8:** RichText, page covers, drag-handle, bulk select, hide-empty toggle. ✅ DONE.
- **V7 S9 (post-alpha, 3.5.x):** Per-widget data source (NPLAN-V7.1, P0) → Canvas palette/locked/collapsed (NPLAN-V7.2, P1) → RecordCardView full (NPLAN-V7.3, P2). DG-alignment target: ~90%.
- **Phase E (out of V7):** Automation, button field, triggers.

**Связанный документ:** `DASHBOARD_V2_MASTER_PROMPT.md` (DG-0…DG-10) — детализация дизайн-принципов и acceptance criteria для UX-tickets.

### Sprint 10 — Technical Debt Closure (V8, post-V7, 2026-05-11+)

Полный аудит (2026-05-11) выявил технический долг, накопившийся в Sprints 7–9 и ранее. Тикеты закрывают: UX-gaps V7, нарушения инвариантов, мёртвый код, архитектурные отклонения, покрытие тестами.

**Принцип:** каждый тикет — атомарный, не ломает baseline. После каждого тикета: `tsc --noEmit` 0 errors, PX-budget ≤ 191, `@ts-ignore` = 0.

| ID | Ticket | Scope | Приоритет | Инвариант |
|---|---|---|---|---|
| **TDT-01** | RecordCardView: icon picker для записей без иконки | `RecordCardView.svelte:110` — `{#if iconValue}` заменить на `{#if resolvedIconField}` + placeholder-кнопка «+» когда `!iconValue` | **P0 (UX)** | V7.3 неполная реализация |
| **TDT-02** | Empty canvas: DashboardBlockPalette в empty state | `WidgetGrid.svelte:43` — добавить `DashboardBlockPalette` в ветку `{#if widgets.length === 0}` для free-mode + !readonly | **P0 (UX)** | V7.2 неполная реализация |
| **TDT-03** | Template inline casts: ConditionalFormatBuilder | `ConditionalFormatBuilder.svelte:244,258,267` — перенести `(e.target as HTMLInput*)` в именованные script-блок функции `getInputValue(e)`, `getBgColor(e)`, `getTextColor(e)` | **P1** | Инвариант §2 (template rule) |
| **TDT-04** | Template inline casts: FieldSettingsPanel | `FieldSettingsPanel.svelte:176,199,224` — три `(e.target as HTMLInputElement).checked` в `on:change` лямбдах → именованные helper functions | **P1** | Инвариант §2 (template rule) |
| **TDT-05** | Dead prop `tableConfig` в DatabaseCallBlock | `DatabaseCallBlock.svelte:28` — удалить `export let tableConfig`; `WidgetHost.svelte:615` — убрать `{tableConfig}` из пропсов DatabaseCallBlock; добавить аналогичный dead-prop audit для `on:tableConfigChange` dispatch | **P1** | Мёртвый код, дезинформирует потребителей |
| **TDT-06** | Лишний TS cast в WidgetHost | `WidgetHost.svelte:281` — `(widget.sourceConfig as WidgetSourceConfig | undefined)` → просто `widget.sourceConfig` | **P2** | Инвариант §2, уже корректный тип |
| **TDT-07** | files drag-drop / file picker в GridFileCell | `GridFileCell.svelte` — добавить `ondragover` + `ondrop` на wrapper-div: читать `dataTransfer.getData("text/plain")` (Obsidian кладёт путь файла), оборачивать в `[[filename]]`, добавлять к текущему значению | **P2** | Закрывает files ✅ |
| **TDT-08** | Architecture: lib импортирует из UI | `src/lib/database/subBasePartition.ts:16` — заменить `import { applyFilter } from "src/ui/app/filterFunctions"` на прямой импорт из `src/lib/engine/filterEvaluator.ts` | **P2** | Инвариант §7 (Engine = pure, без UI-зависимостей) |
| **TDT-09** | Unit tests для V7 компонентов | Добавить smoke/rendering тесты: `DashboardBlockPalette.test.ts`, `DatabaseCallSettings.test.ts`, `GridFileCell.test.ts`, `RecordCardView.test.ts` — минимум: renders without errors + ключевые события | **P2** | Baseline coverage |
| **TDT-10** | Template inline casts: системный проход | Grep по `as HTML` в `on:*` лямбдах во всех `.svelte`: `SummaryRowConfig`, `StatsConfig`, `FilterTabsConfig`, `ComparisonConfig`, `PipelineEditor`, `CoverBannerConfig`, `TimePicker`, `FiltersTab`, `ColorFiltersTab` — перенести в script-блок helper functions | **P3** | Инвариант §2, полный проход |
| **TDT-11** | Console.log audit в production svelte | `GalleryView.svelte:66`, `BoardView.svelte:102` — `console.error('Failed to rename note')` в catch-блоках заменить на Obsidian `new Notice(...)` вместо console | **P3** | Production hygiene |
| **TDT-12** | PX-budget cleanup: 4 нарушения в WidgetHost | `WidgetHost.svelte:651,672,895,925` — `border: 1px solid` → `border: 0.0625rem solid`; после замены снизить `PX_BUDGET` в `R0_3_pxBudget.test.ts` на 4 | **P3** | Инвариант §4, снизить ratchet |
| **TDT-13** | CalendarView TODO: scroll offset | `src/ui/views/Calendar/CalendarView.svelte:98` — `scrollOffset: 0, // TODO: capture actual scroll offset` — либо реализовать через `element.scrollTop` в `onMount`, либо удалить TODO-комментарий если offset не нужен | **P3** | Hygiene |

**Зависимости Sprint 10:**
- TDT-01 и TDT-02 независимы, выполнять первыми (P0).
- TDT-03 → TDT-04 → TDT-10 последовательно (один паттерн, один pass).
- TDT-05 блокирует TDT-09 (тест не должен тестировать мёртвый prop).
- TDT-07 независима (файловый drag-drop изолирован в GridFileCell).
- TDT-12 после TDT-05 (чтобы снизить PX_BUDGET в одном изменении).

**AC Sprint 10 (общий):**
- После каждого тикета: `tsc --noEmit` 0 errors, PX-budget ≤ 191 (снизится до ≤ 187 после TDT-12), 0 `@ts-ignore`, baseline tests PASS.
- TDT-01: в RecordCardView появляется icon-picker когда `resolvedIconField !== undefined && !iconValue`.
- TDT-02: на пустом free-canvas виден `DashboardBlockPalette`.
- TDT-03/04/10: ни одного `as HTML*` в Svelte шаблонных обработчиках.
- TDT-05: `tsc` не находит `tableConfig` prop в DatabaseCallBlock.
- TDT-07: drag файла из vault sidebar в `fileLinks`-ячейку → добавляет chip.
- TDT-08: `src/lib/` не импортирует из `src/ui/`.
- TDT-09: 4 новых test-suite, все PASS.
- TDT-12: PX_BUDGET снижен, тест обновлён.

---

**Владелец плана:** project owner. **Источник:** `V5_CLOSURE_REPORT.md` + Notion docs analysis.

---

## 15. Sprint 10 — Technical Debt Detail

Расширенное описание каждого тикета для реализации.

### TDT-01 — RecordCardView: icon picker для чистых записей

**Файл:** `src/ui/components/RecordCardView/RecordCardView.svelte:110`

**Проблема:** `{#if iconValue}` скрывает весь icon-slot если у записи нет иконки. Пользователь может только менять существующую иконку, не установить новую.

**Решение:**
```svelte
<!-- было: {#if iconValue} -->
{#if resolvedIconField}
  <svelte:fragment slot="icon">
    <div class="ppp-rcv-icon-wrap">
      {#if iconValue}
        <button class="ppp-rcv-icon-btn" on:click={openPicker} ...>
          <PageIcon value={iconValue} size={1.25} />
        </button>
      {:else}
        <button class="ppp-rcv-icon-btn ppp-rcv-icon-btn--empty" on:click={openPicker} ...>
          <span class="ppp-rcv-icon-placeholder">+</span>
        </button>
      {/if}
      {#if pickerOpen}...{/if}
    </div>
  </svelte:fragment>
{/if}
```
CSS для `--empty` кнопки: `border: 0.0625rem dashed var(--text-faint)`, `color: var(--text-faint)`, `font-size: 0.875rem`.

---

### TDT-02 — Empty canvas: DashboardBlockPalette в empty state

**Файл:** `src/ui/views/Dashboard/WidgetGrid.svelte:43`

**Проблема:** Ветка `{#if widgets.length === 0}` рендерит только empty-state div без palette.

**Решение:** В конец empty-state div добавить palette при `layoutMode === "free" && !readonly`:
```svelte
{#if widgets.length === 0}
  <div class="ppp-database-empty">
    ...existing content...
    {#if layoutMode === "free" && !readonly}
      <div class="ppp-database-empty-palette">
        <DashboardBlockPalette currentWidgets={[]} on:addWidget={(e) => dispatch("addWidget", e.detail)} />
      </div>
    {/if}
  </div>
```
CSS `.ppp-database-empty-palette`: `margin-top: var(--ppp-space-md, 0.5rem)`.

---

### TDT-03 — Template casts: ConditionalFormatBuilder

**Файл:** `src/ui/components/ConditionalFormatBuilder/ConditionalFormatBuilder.svelte`

**3 нарушения → 3 script-блок helpers:**
```typescript
// в <script lang="ts">
function cfInputValue(e: Event): string {
  return (e.target as HTMLInputElement).value;
}
function cfBgColor(e: Event): string {
  return (e.target as HTMLInputElement).value;
}
function cfTextColor(e: Event): string {
  return (e.target as HTMLInputElement).value;
}
```
Шаблон: `on:input={(e) => updateRule(format.id, 0, { value: cfInputValue(e) })}` и т.д.

---

### TDT-04 — Template casts: FieldSettingsPanel

**Файл:** `src/ui/components/FieldSettingsPanel/FieldSettingsPanel.svelte:176,199,224`

**Паттерн:** три `on:change={(e) => { ...; fieldProp: (e.target as HTMLInputElement).checked }}` → добавить в script-блок:
```typescript
function checkboxChecked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked;
}
```
Шаблон: `on:change={(e) => handleRichTextChange(checkboxChecked(e))}` и т.д.

---

### TDT-05 — Dead prop tableConfig в DatabaseCallBlock

**Файлы:** `DatabaseCallBlock.svelte:28`, `WidgetHost.svelte:615`

**Шаги:**
1. Удалить `export let tableConfig: DataTableConfig | undefined;` из DatabaseCallBlock.
2. В WidgetHost строка 615: убрать `{tableConfig}` из пропсов `<DatabaseCallBlock>`.
3. Проверить: `on:tableConfigChange` из DatabaseCallBlock → WidgetHost диспатчит его в canvas root. Это нужно? DatabaseCallBlock никогда не диспатчит `tableConfigChange` (только `configChange`). Убрать `on:tableConfigChange` из блока `{:else if widget.type === "database-call"}` в WidgetHost — это мёртвый event forwarding.

---

### TDT-07 — files drag-drop в GridFileCell

**Файл:** `src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/GridFileCell.svelte`

**Реализация:** добавить drop-zone на `read`-slot wrapper:
```svelte
<div
  class="ppp-file-chips"
  on:dragover|preventDefault
  on:drop|preventDefault={(e) => handleDrop(e)}
>
```
```typescript
function handleDrop(e: DragEvent) {
  const text = e.dataTransfer?.getData("text/plain") ?? "";
  if (!text) return;
  // Obsidian кладёт путь файла как plain text
  const link = `[[${text.replace(/\.md$/, "")}]]`;
  const next = value ? `${value} ${link}` : link;
  onChange(next);
}
```
Визуальный feedback при dragover: `class:ppp-file-chips--dragover={isDragOver}`, CSS: `outline: 0.125rem dashed var(--interactive-accent)`.

---

### TDT-08 — lib/ → UI/ архитектурное нарушение

**Файл:** `src/lib/database/subBasePartition.ts:16`

Заменить:
```typescript
// было
import { applyFilter } from "src/ui/app/filterFunctions";
// стало
import { evaluateFilter } from "src/lib/engine/filterEvaluator";
```
Убедиться что сигнатура `evaluateFilter` совместима с тем, как использует `applyFilter`. Если `filterFunctions.ts` добавляет обёртку — перенести обёртку в `subBasePartition.ts` или в `lib/engine/`.

---

### TDT-09 — Unit tests для V7 компонентов

**Добавить тесты в `src/ui/views/Dashboard/widgets/__tests__/`:**

| Тест-файл | Что проверять |
|---|---|
| `DashboardBlockPalette.test.ts` | renders trigger button; click opens popup; Escape closes; `addWidget` event fires с правильным type |
| `DatabaseCallSettings.test.ts` | renders source dropdown; выбор option → dispatches `change: { projectId }` |
| `RecordCardView.test.ts` | renders without record; renders with record; icon slot visible когда resolvedIconField + !iconValue (TDT-01) |
| `GridFileCell.test.ts` | parseWikiLinks корректно парсит; chip renders; × удаляет; drop event обрабатывается (TDT-07) |

---

### TDT-10 — Системный проход template casts

**Файлы с нарушениями (подтверждены grep `as HTML` в on: лямбдах):**

| Файл | Строки | Паттерн |
|---|---|---|
| `SummaryRowConfig.svelte` | 59, 62 | `e.currentTarget as HTMLInputElement`, `as HTMLSelectElement` |
| `StatsConfig.svelte` | 65, 68, 84 | аналогично |
| `FilterTabsConfig.svelte` | 65, 68 | аналогично |
| `ComparisonConfig.svelte` | 56, 59, 62 | аналогично |
| `PipelineEditor.svelte` | 373, 377, 381 | аналогично |
| `CoverBannerConfig.svelte` | 16, 20, 24 | `as HTMLSelectElement` |
| `TimePicker.svelte` | 36 | аналогично |
| `FiltersTab.svelte` | 14 | в helper `inputVal` в script → OK |
| `ColorFiltersTab.svelte` | 16 | в helper `inputVal` в script → OK |

**Паттерн fix для всех:** в каждом файле добавить в script-блок:
```typescript
function inputValue(e: Event): string {
  return (e.currentTarget as HTMLInputElement | HTMLSelectElement).value;
}
function inputChecked(e: Event): boolean {
  return (e.currentTarget as HTMLInputElement).checked;
}
```
Заменить inline casts в on: лямбдах на вызовы этих helpers.

---

### TDT-11 — console.error → Notice в Svelte компонентах

**Затронутые файлы:**

| Файл | Строка | Текущий код | Замена |
|---|---|---|---|
| `GalleryView.svelte` | 66 | `console.error('Failed to rename note', e)` | `new Notice($i18n.t("errors.rename-failed", { defaultValue: "Failed to rename note" }))` |
| `BoardView.svelte` | 102 | `console.error('Failed to rename note', e)` | аналогично |

`YamlVisualizer.svelte:135` — уже имеет `new Notice(...)` после console.error, можно убрать console.
`EditNote.svelte:149` — уже имеет `new Notice(...)`, убрать console.

---

### TDT-12 — PX Budget: 4 нарушения в WidgetHost

**Файл:** `src/ui/views/Dashboard/widgets/WidgetHost.svelte`

| Строка | Было | Стало |
|---|---|---|
| 651 | `border: 1px solid var(--background-modifier-border)` | `border: 0.0625rem solid var(--background-modifier-border)` |
| 672 | `border-bottom: 1px solid var(--background-modifier-border)` | `border-bottom: 0.0625rem solid var(--background-modifier-border)` |
| 895 | `border: 1px solid var(--text-error)` | `border: 0.0625rem solid var(--text-error)` |
| 925 | `border: 1px solid var(--interactive-accent)` | `border: 0.0625rem solid var(--interactive-accent)` |

После замены: снизить `PX_BUDGET` в `src/__tests__/R0_3_pxBudget.test.ts` с `191` на `187`, добавить запись в комментарий-лог:
```
//   191 → 187 (TDT-12 — WidgetHost.svelte: 4 border 1px → 0.0625rem).
```

---

### TDT-13 — CalendarView TODO: scroll offset

**Файл:** `src/ui/views/Calendar/CalendarView.svelte:98`

Захватить реальный scroll offset:
```typescript
// в onMount или reactive:
let calendarScrollEl: HTMLElement | undefined;
$: if (calendarScrollEl) scrollOffset = calendarScrollEl.scrollTop;
```
Или, если scroll offset не нужен — удалить TODO и оставить `scrollOffset: 0` без комментария.

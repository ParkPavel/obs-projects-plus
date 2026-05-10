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
| 9 | `files` | 🟡 | wiki-links в string | (P3) drop/preview UI |
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
| 4 | Gallery | ✅ | `ui/views/Gallery` | (P3) card-size variants |
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
| Filter by rollup | 🟡 | работает на raw value | NPLAN-C3 (после full rollup set) |
| Multi-field sort | ✅ | `DataTableSortCriteria[]` |
| Group 1/2 levels | ✅ | `subGroupField` |
| Group date by day/week/month/year | ✅ | `GroupByStep.dateGrouping` |

**Score:** ✅=9, 🟡=1 → **95%**.

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

Все основные ✅ (resize, reorder, hide, freeze, agg row, row height, wrap, conditional fmt, context menu, inline editor). Sprint 8 закрыл: bulk select (D5), drag-handle строки (D4), aggregation footer Board/Gallery (C18), saved-filter presets, quick search (Ctrl+F), sort badge, agg toggle. Post-Sprint-8: inline `+` column button (GridHeader), double-click inline column rename (GridColumnHeader → api.updateField). Remaining P3: inline row insert by Tab at end of last row only.

**Score:** **98%**.

---

## 7. Automation / Inline UI

Out of scope для V6 (Phase E). Slash palette — низкий приоритет (Obsidian имеет нативную).

---

## 8. Сводный score

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Property Types | 93% | 0.25 | 23.25 |
| View Types | 100% | 0.20 | 20.00 |
| Filter/Sort/Group | 95% | 0.15 | 14.25 |
| Formula | 99% | 0.15 | 14.85 |
| Table UI | 98% | 0.15 | 14.70 |
| Automation | 0% | 0.05 | 0 |
| Inline UI | 75% | 0.05 | 3.75 |
| **TOTAL** | | | **~91%** |

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
- **V6 S8:** RichText, page covers, drag-handle, bulk select, hide-empty toggle.
- **Phase E (out of V6):** Automation, button field, triggers.

**Связанный документ:** `DASHBOARD_V2_MASTER_PROMPT.md` (DG-0…DG-10) — детализация дизайн-принципов и acceptance criteria для UX-tickets.

---

**Владелец плана:** project owner. **Источник:** `V5_CLOSURE_REPORT.md` + Notion docs analysis.

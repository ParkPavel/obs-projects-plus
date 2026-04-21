# Context State — obs-projects-plus

## Текущее состояние
- **Версия**: 3.4.0 (uncommitted)
- **Дата обновления**: 2026-04-21
- **Тесты**: 42 suites, 839 tests, ALL PASS
- **Компиляция**: tsc 0 errors
- **Сборка**: main.js ~2.1MB, main.css 4.3KB, styles.css merged
- **Git**: все изменения v3.3.0–v3.3.2 uncommitted
- **v3.4.0 Spec**: `docs/database-view-v3.4.0-spec.md` (полная спецификация модернизации)
- **Refactoring Spec**: `docs/refactoring-spec-v1.md` — 10 волн UX-рефакторинга

### UPDATE 2026-04-21 — Crash Recovery / Wave R2 Saved
- **Wave R2 Pipeline Editor**: завершён в `src/ui/views/Database/widgets/PipelineEditor.svelte`
  - inline FILTER builder: field/operator/value + AND/OR + add/remove conditions
  - AGGREGATE: multi-column editor + aggregation picker
  - PIVOT: aggregation function dropdown
  - UNPIVOT: keepFields chips + fieldGroups pattern/outputName
  - UNNEST: добавлен в меню шагов + field/prefix/keepOriginal UI
  - COMPUTE: multi-column editor
  - dirty-state + discard confirm сохранены
- **Верификация**: `npx tsc --noEmit --skipLibCheck` clean, `npx jest --no-coverage` → 42 suites / 839 tests PASS
- **Git recovery status**:
  - local branch: `main`
  - remote `origin` всё ещё указывает на `https://github.com/ParkPavel/obs-projects-plus.git`
  - `git ls-remote origin` => repository not found (GitHub repo удалён)
  - `gh` CLI отсутствует, автоматическое пересоздание remote из workspace недоступно
- **Смысл для следующей сессии**: не начинать R2 заново; следующий функциональный шаг после recovery — `R2.6 Pipeline Preview per step`, затем R3 widget config UI

### КРИТИЧЕСКАЯ ПРОБЛЕМА (2026-04-20)
Пользовательское тестирование выявило: backend мощный (115 формул, 6 pipeline шагов, 8 виджетов), но UI не позволяет использовать большинство функций. Pipeline FILTER/UNPIVOT/UNNEST не имеют UI. 5 из 8 виджетов без настроек. Формулы не материализуются в колонки. Таблица — legacy дизайн. Шаблоны ломаются на не-демо проектах. Демо-проект не показывает настроенную базу.

### Следующий шаг: Wave R2 (Pipeline Editor Complete Rewrite)

### Wave 8 — Tech Debt Cleanup (ЗАВЕРШЕНО)
- **Phase 8.1**: DRY ISO_WEEK — `d.isoWeek()` вместо 6 строк ручного кода, убрано дублирование dayjs.extend (filterFunctions.ts), расширен Jest setup.ts
- **Phase 8.2**: DRY aggregation — `computeAggregateValue()` в aggregation.ts, удалены локальные дубли в StatsCard.svelte и SummaryRowWidget.svelte (~80 LOC удалено)
- **Phase 8.3**: DRY PMT helper — `pmtCore()`, `fvBeforePeriod()`, `ipmtForPeriod()` в formulaEngine.ts, рефакторены PMT/IPMT/PPMT/CUMPRINC/CUMIPMT (~50 LOC дублирования удалено)
- **Phase 8.4**: handleRowEdit type safety — `Record<string, any>` → `Record<string, Optional<DataValue>>` в DataTableWidget.svelte
- **Phase 8.5**: migration idCounter → `crypto.randomUUID()` — migration.ts + DatabaseViewCanvas.svelte (stateless UUID, no counter leaks)
- **Phase 8.6**: U13 XSS in onboarding — `sanitizeHtml()` whitelist sanitizer (lib/helpers/sanitizeHtml.ts), Onboarding.svelte `{@html ts(...)}` вместо `{@html t(...)}`

### Wave 7 — Security + Notion Parity (ЗАВЕРШЕНО)
- **Phase 7.0**: P1/P2 security fixes
  - ReDoS protection: `regexSafety.ts` shared util (isUnsafePattern + MAX_REGEX_INPUT_LENGTH=10K)
  - Stack overflow: MAX_EVAL_DEPTH=64 в formulaEngine evaluateNode
  - DoS iteration: MAX_LIST_ITEMS=10K для MAP/FILTER/REDUCE
- **Phase 7.1**: Bi-directional relations
  - `computeBacklinks()` + `enrichWithBacklinks()` в relationResolver.ts
  - WidgetHost.svelte: auto-enrichment (reactive $: enrichedFrame)
  - Derived `X_backlinks` fields with DataFieldType.Relation
- **Phase 7.2**: Multi-key sort per widget
  - `DataTableSortCriteria` interface в types.ts
  - `onDataSort` prop в DataGrid → context menu "Sort A→Z / Z→A"
  - sortRecords applied to records before rendering
  - Sort indicator in column headers via `column.sort`
- **Phase 7.3**: Sub-groups (2-level)
  - `subGroupField` + `subGroupSortOrder` в GroupConfig
  - `buildSubGroups()` в groupRows.ts
  - Nested GroupHeader rendering с level-based indentation
- **Phase 7.4**: Record templates + auto-fill
  - `defaultValues?: Record<string, string>` в DataTableConfig
  - `handleAddRow(groupKey?)` — auto-fill group field value
  - All DataGrid onRowAdd callbacks updated

### Фаза v3.4.0 — Database View Modernization
- **Статус**: Wave 1–5 ЗАВЕРШЕНЫ (все 5 волн)
- **Wave 1 результаты**:
  - **U1**: ViewConfigTab i18n — 30+ hardcoded строк → `$i18n.t()`, 4 локали обновлены
  - **U6**: PopoverDropdown shared — `src/ui/components/popoverDropdown.ts` (~190 LOC), FiltersTab/SortTab/ColorFiltersTab рефакторены (удалено ~400 LOC дублирования)
  - **U4**: Project Quick-Switcher — кнопка с именем проекта в CompactNavBar, searchable popover через shared module, i18n ключи в 4 локалях
- **Wave 2 результаты**:
  - **A2**: COMPUTE→FormulaEngine unification — `evaluateFormulaValue()` заменил `evaluateExpression()`, поддержка скобок, вложенных функций, оператор приоритет (* before +)
  - **A9**: Relative date filters — 8 новых операторов (`is-today`, `is-this-week`, `is-this-month`, `is-this-quarter`, `is-last-n-days`, `is-next-n-days`, `is-overdue`, `is-upcoming`), dayjs isoWeek+quarterOfYear
  - **Financial (11)**: PMT, FV, PV, NPV, IRR, RATE, IPMT, PPMT, NPER, CUMPRINC, CUMIPMT
  - **Statistical (8)**: VARIANCE, VARIANCE_S, PERCENTILE, QUARTILE, CORREL, MODE, RANK, STD_DEV_S
  - **Conditional (3)**: SUMIF, COUNTIF, AVERAGEIF
  - **Duration (6)**: DAYS, HOURS, MINUTES, TO_DAYS, TO_HOURS, WORKDAYS
  - **Enhanced Math (7)**: MEDIAN, PRODUCT, MOD, EVEN, ODD, PI, RANDOM_INT
  - **Enhanced String (8)**: LEFT, RIGHT, MID, REGEX_MATCH, REGEX_REPLACE, JOIN, REPEAT, ENCODE_URL
  - **Conversion/Logic (4)**: TO_CURRENCY, TO_PERCENT, LET (stub), IFBLANK
  - **Date (3)**: END_OF_MONTH, WEEKDAY_NAME, ISO_WEEK
  - **Aggregate-aware (6)**: SUM, AVG, COUNT, MIN, MAX, STD_DEV — work with @column refs
  - **Cross-record @reference**: `@fieldName` syntax → column_ref AST node → resolves all column values from DataFrame
  - **Parser upgrade**: 50+ new functions registered, operator precedence fix (additive/multiplicative layers)
  - **Total formulas**: 42 → 98 functions
- **Wave 3 результаты**:
  - **A7**: ScatterChart — SVG scatter plot (trend line, R², color grouping, point sizing), `computeScatterData()` pipeline
  - **Stats sparkline**: optional inline sparkline in StatsCard (`buildSparkline()` polyline)
  - **Comparison N-metrics**: refactored to support N metrics array (backward compat for old metricA/metricB), mode: absolute/percentage/normalized
  - **FilterTabs widget**: new widget — unique field values as clickable tabs, "All" tab, ARIA tablist, dispatches filter event
  - **SummaryRow widget**: new widget — compact aggregation bar (count, sum, avg, median, min, max, range, etc.)
  - **ChartConfig progressive disclosure**: `<details>` sections for display/scatter options, scatter-specific config panel
  - **Chart type**: 9 → 10 (added scatter)
  - **Widget types**: 6 → 8 (added filter-tabs, summary-row)
  - **i18n**: 15+ keys added to all 4 locales (scatter, filter-tabs, summary-row)
  - **TS fixes**: filterOperatorTypes now includes all 8 relative date operators, formulaEngine.test uses DataFieldType enum, chartDataPipeline proper spread construction
- **Тесты**: 42 suites, 800 tests (+8 merge tests, +13 Wave 3), ALL PASS
- **Следующая**: ✅ Все волны завершены. Готов к релизу v3.4.0.
- **Wave 4 результаты**:
  - **A4**: DateTime precision — non-midnight Dataview dates now preserve time (HH:mm)
  - **A5**: Dataview query validation UI — debounced preview in CreateProject, shows row/task count or error
  - **A3**: Dataview LIST/TASK support — `parseListResult()`, `parseTaskResult()` with recursive flattening
  - **A1**: Multi-source merge — `additionalSources?: DataSource[]` in ProjectDefinition, `mergeDataFrames()` engine (union fields, dedup records), DataFrameProvider multi-source resolution, CreateProject UI for managing additional sources, i18n in 4 locales
  - **Tests**: mergeFrames.test.ts (8 tests: empty, single, union fields, concat records, dedup, 3-frame merge)
- **Wave 5 результаты (Polish)**:
  - **U11**: Recursive FormulaNode — `<svelte:self>` для неограниченной вложенности AST, CSS → `:global()` pattern
  - **U9**: Formula autocomplete kbd nav — ArrowUp/Down/Enter/Tab, wrap-around, ARIA listbox
  - **U5**: ARIA tab roving — SettingsMenuTabs, ViewSwitcher, FilterTabsWidget (Home/End/Space/Enter)
  - **U7**: DataGrid ARIA grid — `aria-label`, `aria-rowindex` on cells
  - **U14**: Touch visibility — `@media (pointer: coarse)` for hover-only buttons
  - **U10**: Pipeline dirty state — JSON.stringify diff, confirm-on-discard dialog
  - **U8**: Widget resize handles — `use:resizable` Svelte action, pointer drag, grid-snap, callback pattern 42→100 формул, 11 финансовых, 8 статистических, scatter chart, multi-source merge, inline add row, ARIA accessibility
- **Estimated new code**: ~4,300 LOC + ~1,330 LOC tests
- **5 волн**: Infrastructure → Computation → Visualization → Data Integration → Polish
- **Конкурентный анализ**: Notion (formulas, views), Airtable (Interface Designer), Coda (200+ formulas)
- **Персоны**: PM (Elena), Financial (Mikhail), Academic (Anna), Creator (Dima), Lead (Sara)
- **6 сценариев**: Financial Dashboard, Academic Analysis, Sprint Planning, Content Calendar, Quick Switching, Formula Power User

---

## Архитектура (текущая)

### Стек
TypeScript strict + Svelte 3.59.2 + esbuild CJS + Jest 29 + i18next (en/ru/uk/zh-CN)

### Конвейер данных
```
DataSource[] (folder|tag|dataview) → queryAll() → DataFrame[] → mergeDataFrames() → DataFrame {fields[], records[]}
  → RelationResolver (wiki-links → target records)
  → FormulaEngine (115 fn, per-record, cross-record @reference)
  → RollupEngine (12 fn, cross-record)
  → FilterEngine (31 operators incl. 8 relative date, AND/OR groups, depth ≤ 20)
  → SortEngine (multi-key, type-aware, natural sort)
  → TransformPipeline per-widget (UNPIVOT→COMPUTE→FILTER→GROUP-BY→AGGREGATE→PIVOT)
  → Widget render (8 types: DataTable, Chart, Stats, Comparison, Checklist, ViewPort, FilterTabs, SummaryRow)
```

### Ограничения архитектуры
- ~~1 проект = 1 DataSource (нет cross-project JOIN/merge)~~ → ✅ SOLVED (A1: multi-source merge)
- ~~Dataview: только TABLE-запросы, read-only, DateTime обрезается до YYYY-MM-DD~~ → ✅ SOLVED (A3: LIST/TASK, A4: DateTime precision)
- ~~COMPUTE step: только +−×÷, без скобок, без вызовов функций~~ → ✅ SOLVED (A2: FormulaEngine unified)
- ~~Финансовые функции: 0 из 11~~ → ✅ SOLVED (A6: 11 financial functions)
- ~~Статистические: только STD_DEV~~ → ✅ SOLVED (8 statistical + 6 aggregate-aware)

### Views (5 зарегистрированных)
| View | Статус | Ключевые возможности |
|------|--------|---------------------|
| Database | ✅ Основной | 8 виджетов, pipeline, 115 формул, условное форматирование, resize, multi-source |
| Board | ✅ Стабильный | Kanban DnD, grouping, pin, zoom 0.25–2× |
| Calendar | ✅ Стабильный | Agenda, timeline, DnD reschedule/resize, heatmap |
| Gallery | ✅ Стабильный | Cover images, fit modes, responsive |
| Table | ⚠️ Deprecated | Баннер миграции → Database, auto-migration в settings |

---

## История релизов (сводка)

### v3.3.2 — Runtime + Performance (текущий, uncommitted)
- svelte-dnd-action multiScroller?.destroy() patch
- Rollup O(n²)→O(n), UNPIVOT O(n·k·m)→O(n·k)
- Safety caps: 100K records, depth 20, 500 wikilinks
- Legacy Table→Database auto-migration + TableView removed
- ViewConfigTab reactive binding fix (let→$:, 25+ vars)
- DnD performance (5 fixes), CSS perf (blur removed, shadow→outline)

### v3.3.1 — Modernization
- i18n corruption fix (ru/uk 16 keys)
- Table column alignment (scroll container)
- Adaptive column widths, aggregation picker (Obsidian Menu API)
- Error boundary, Chart/Stats wizard fallback
- Formula visual operators (+10)
- Deprecation banner, demo vault, user guide

### v3.3.0 — Database View (6 phases)
- Phase 1: Foundation (types, transforms, aggregation, migration, canvas, DataTable)
- Phase 2: Formulas (42 fn), conditional format, grouping, pipeline editor, Select/Status cells
- Phase 3: Charts (9 types SVG), Stats, transform cache, PIVOT
- Phase 4: Relations, Rollups, Comparison, Checklist widgets
- Phase 5: ViewPort, virtual scroll, accessibility, design tokens, templates
- Phase 6: Deep integration (all engines wired to UI), DnD reorder, mobile

### v3.3.0 Hotfixes
- HF1: PieChart restore, DataTable row open/edit, column operations
- HF2: ChecklistWidget wiki-links, StatsWidget defaults, chart labels

### Closing Audit
- Security: CSS injection (StatsCard, GroupHeader), ReDoS order fix
- Quality: WidgetToolbar dismiss, WidgetHost safe cast
- Bot compliance: activeDocument, clipboard wrapper, ReDoS filterEngine

### Pre-v3.3.0
- v3.2.1: JSON.parse safety, filterFunctions case-insensitive, formulaParser tests
- v3.2.0: Drag & Drop 2.0
- Bot review fixes: async callback, CSS classes, assertions, eslint reasons

---

## Известные проблемы (открытые)

### UI/UX (из аудита 2026-04-16)
| # | Sev | Проблема |
|---|-----|----------|
| U1 | P1 | ViewConfigTab: ~40 hardcoded Russian strings (не через $i18n.t) |
| U2 | P1 | SettingsMenuPopover: DOM querying для sidebar detection |
| U3 | P1 | Calendar field mapping: text input без валидации |
| U4 | P2 | Project switching = 3 клика (нет quick-switcher) |
| U5 | P2 | SettingsMenuTabs: нет ARIA tab roving (ArrowLeft/Right) |
| U6 | P2 | FiltersTab/SortTab/ColorFiltersTab: 3× дублированный imperative popover |
| U7 | P2 | DataGrid: нет aria-label, columnheader roles, activedescendant |
| U8 | P2 | ConfigureField: тип поля disabled без объяснения |
| U9 | P2 | FormulaBar: autocomplete без keyboard nav (ArrowUp/Down) |
| U10 | P2 | PipelineEditor: нет dirty-state/confirm при закрытии |
| U11 | P2 | FormulaVisualEditor: max 2 уровня вложенности (не рекурсивный) |
| U12 | ~~P2~~ | ~~ChartConfig: все опции плоским списком (нет progressive disclosure)~~ ✅ Wave 3 |
| U13 | P2 | Onboarding: {@html} с i18n = potential XSS |
| U14 | P3 | ProjectTab: hover-only actions невидимы на touch |
| U15 | P3 | DatabaseViewCanvas: символьные иконки (−, +, ƒx, ⊞) |

### Архитектурные
| # | Проблема | Статус |
|---|----------|--------|
| A1 | Нет cross-project queries / multi-source merge | Open |
| A2 | ~~COMPUTE step не использует FormulaEngine~~ | ✅ Wave 2 |
| A3 | Dataview: LIST/TASK не поддержаны | Open |
| A4 | Dataview: DateTime precision loss | Open |
| A5 | Dataview: нет validation UI / graceful error handling | Open |
| A6 | ~~Нет финансовых функций~~ | ✅ Wave 2 (11 fn) |
| A7 | ~~Нет correlation/scatter chart~~ | ✅ Wave 3 (ScatterChart + R²) |
| A8 | Нет inline add row в таблице | Open → Wave 4 |
| A9 | ~~Нет relative date filters~~ | ✅ Wave 2 (8 ops) |

### Deferred (tech debt)
- migration.ts: idCounter → crypto.randomUUID()
- DRY aggregation logic (4× duplication)
- transformExecutor regex cache
- WEEK computation duplication

---

## Каскадный план модернизации v3.4.0

> Принцип: каждый решённый блок создаёт инфраструктуру для следующего.

### Волна 1: ViewConfigTab i18n → Shared Popover → Project Switcher
**Цепочка**: U1 → U6 → U4

1. **U1: ViewConfigTab i18n** (~40 hardcoded Russian → $i18n.t)
   - **Выход**: все строки ViewConfigTab локализованы
   - **Разблокирует**: consistent i18n pattern для U4 (project switcher)
   
2. **U6: Shared Popover component** (extract 3× duplicated popover)
   - **Выход**: `PopoverDropdown.svelte` — reusable, Escape/click-outside
   - **Разблокирует**: U4 (project switcher dropdown), U9 (formula autocomplete), A5 (Dataview validation)

3. **U4: Project Quick-Switcher** (dropdown в navbar)
   - **Выход**: 1 клик вместо 3 для смены проекта
   - **Разблокирует**: UX-базу для multi-source (A1) — пользователь видит проекты как first-class

### Волна 2: COMPUTE upgrade → Financial functions → Relative dates
**Цепочка**: A2 → A6 → A9

4. **A2: COMPUTE step → FormulaEngine** (унификация)
   - **Выход**: COMPUTE поддерживает скобки, IF, ROUND, все 42 функции
   - **Разблокирует**: A6 (финансовые функции получат полный доступ через COMPUTE)

5. **A6: Financial functions** (PMT, FV, PV, NPV, IRR, RATE + IPMT, PPMT, NPER)
   - **Выход**: 11 новых функций в FormulaEngine
   - **Разблокирует**: кредитные калькуляторы, бюджетное планирование

6. **A9: Relative date filters** (this-week, last-month, next-N-days)
   - **Выход**: ~8 новых операторов в FilterEngine
   - **Разблокирует**: динамические дашборды (задачи на этой неделе, просроченные)

### Волна 3: Статистика → Scatter chart → Cross-project
**Цепочка**: stats → A7 → A1

7. **Statistical functions** (VARIANCE, PERCENTILE, QUARTILE, CORREL)
   - **Выход**: 6 новых функций в FormulaEngine + aggregation
   - **Разблокирует**: A7 (scatter chart с корреляцией)

8. **A7: Scatter/Correlation chart**
   - **Выход**: новый тип chart (X vs Y, R², trend line)
   - **Разблокирует**: visual analytics для cross-project данных

9. **A1: Multi-source merge** (composite datasource)
   - **Выход**: UNION ALL / LEFT JOIN по ключу
   - **Разблокирует**: cross-project корреляции, сводные дашборды

### Волна 4: Dataview deep + Table UX
**Цепочка**: A5 → A3 → A4 → A8

10. **A5: Dataview query validation UI** (live preview, error display)
    - **Выход**: безопасная работа с Dataview
    - **Разблокирует**: A3 (LIST/TASK — пользователь видит результат)

11. **A3: Dataview LIST/TASK support**
    - **Выход**: task checkboxes, completion tracking через Dataview
    - **Разблокирует**: task management workflows

12. **A4: DateTime precision** (сохранять HH:mm)
    - **Выход**: timeline события с временем из Dataview
    
13. **A8: Inline add row** (+ New в таблице)
    - **Выход**: Notion-like UX добавления записей

### Волна 5: Accessibility + Polish
14. **U5/U7: ARIA tab roving + grid accessibility**
15. **U9: Formula autocomplete keyboard nav** (использует PopoverDropdown из Волны 1)
16. **U12: ChartConfig progressive disclosure**
17. **U14: Touch visibility** (@media pointer: coarse)
18. **U11: FormulaVisualEditor рекурсивный рендер**

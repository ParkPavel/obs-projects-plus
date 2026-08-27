# Architecture Debt Audit — 2026-08-22

> **Тип:** read-only semantic audit (карта связей + инвентарь долга).
> **Автор:** semantic-analyzer.
> **Метод:** Grep/Read по `src/**`, сверка с PRODUCT_RESET_2026-07-18.md и BACKLOG.md.
> **Инвариант анти-галлюцинации:** каждое утверждение о связи/неиспользуемости несёт `file:line`.
> **Memory MCP:** сервер `memory` НЕ был доступен в этой сессии (в списке инструментов присутствовали только browser/worktree/web). Аудит выполнен прямым read/search; результаты стоит перенести в `codebase`-граф при следующем доступном сеансе.

---

## 0. Правка карты «ключевых файлов»

Брифинг ссылается на `src/ui/views/Dashboard/engine/` — **этой директории не существует** (`ls src/ui/views/Dashboard/engine/` → пусто). Реальные модули движка живут в `src/lib/dashboard-engine/` (`formulaMetadata.ts`, `transformExecutor.ts`, `transformTypes.ts`, `transformCache.ts` — все там). Формулировку в брифе/AGENTS стоит поправить: это первый симптом «карта в голове разошлась с деревом».

---

## A. КАРТА СИСТЕМЫ ФИЛЬТРОВ

### A.1 Порядок применения к DataFrame (текстовая диаграмма)

Полный путь одной записи от источника до отрисовки в Dashboard → database-call → Table:

```
[SOURCE FRAME]  (DataFrameProvider)
      │
      ▼  src/ui/app/View.svelte
  applyFormulaFields / enrichFrameWithRelations / cross-project rollup   (enrichedFrame)
      │
      ▼  View.svelte:179   applyFilter(enrichedFrame, viewFilter)        ← СЛОЙ 1: VIEW-FILTER
      │       (canonical filterEvaluator; конфиг = view.filter)           «Это представление»
      ▼  View.svelte:188   applySort(filteredFrame, viewSort)
      │
      ▼  sortedFrame  →  DashboardCanvas.svelte (prop `frame`)
      │
      ▼  DashboardCanvas.svelte:93   applyFilterTab(frame, activeFilterTab) ← СЛОЙ 2: FILTER-TABS
      │       (dashboardFilters.ts — НЕ canonical, см. P1-2)               (filter-tabs widget)
      ▼  DashboardCanvas.svelte:98   buildDisplayFrame(...)  → displayFrame
      │
      ▼  displayFrame → WidgetHost.svelte (prop `frame`)  [per widget]
      │
      ▼  WidgetHost.svelte:65   enrichWithBacklinks(frame, relationFields)  (enrichedFrame)
      │
      ▼  WidgetHost.svelte:66   executeTransform(enrichedFrame, pipeline)   ← СЛОЙ 3: PIPELINE FILTER STEP
      │       (transformExecutor → executeFilter; конфиг = widget.transform) (Конвейер §«Фильтр (2)»)
      ▼  transformedFrame  →  DatabaseCallBlock.svelte (prop `frame`)
      │
      ▼  DatabaseCallBlock.svelte:113   applyFilter(frame, subFilter)       ← СЛОЙ 4: BLOCK subFilter
      │       (canonical filterEvaluator; конфиг = widget.config.subFilter)  (BlockFilterBar pill)
      ▼  subFiltered
      │
      ▼  DatabaseCallBlock.svelte:92-116  composeEffectiveFilter(...)        ← СЛОЙ 5: SELECTION BUS
      │       → filterByLinkedSelection(subFiltered.records, autoFilter)      (linkedSelection / canvas)
      ▼  effectiveFrame
      │
      ▼  ViewTab.config (Table V2 может нести собственный filter/group)      ← СЛОЙ 6: PER-TAB (потенциальный)
      │       (types.ts:84-85 «per-tab config sort/filter/group»)
      ▼  [RENDER: DataTableContent / BoardView / CalendarView / GalleryView]
```

**Итого до 6 слоёв фильтрации** могут одновременно сузить один и тот же frame. Пользователь видит четыре из них как отдельные UI-поверхности (view-pill, filter-tabs, pill конвейера, block-pill) + невидимый selection-bus + потенциальный per-tab.

### A.2 Таблица поверхностей фильтрации

| # | Поверхность | Где хранится конфиг | Движок | `file:line` (точка применения) | UI-вход |
|---|---|---|---|---|---|
| 1 | **View-filter** «Это представление» | `view.filter` (ProjectDefinition/view) | canonical `applyFilter` | `src/ui/app/View.svelte:179` | `ViewFilterBar.svelte` (App.svelte:300), пилюли `FilterPills.svelte` |
| 2 | **Filter-tabs** (виджет) | локальный `activeFilterTab` (transient) + виджет `filter-tabs` config | **параллельный** `applyFilterTab` (raw `String(raw)===value`) | `src/ui/views/Dashboard/dashboardFilters.ts:14-26`; применяется `DashboardCanvas.svelte:93` | клик по табу filter-tabs |
| 3 | **Transform pipeline «Фильтр»** | `widget.transform.steps[].type==="filter"` | canonical `matchesFilterConditions` | `src/lib/dashboard-engine/transformExecutor.ts:601-613` | `PipelineEditor.svelte` (WidgetHost:199) |
| 4 | **Block subFilter** | `widget.config.subFilter` (`WidgetDataContext.subFilter`, types.ts:108) | canonical `applyFilter` | `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:113` | `BlockFilterBar.svelte` pill/popover |
| 5 | **Selection Bus / linkedSelection / canvas** | `widget.config.linkedSelection` (types.ts:91-99) + transient canvas store | `composeEffectiveFilter` (pure) → **адаптер** `filterByLinkedSelection` (не сам evaluator, но делегирует в `matchesCondition`) | compose: `canvasSelectionStore.ts:237`; apply: `DatabaseCallBlock.svelte:116` | клик по строке/бару (driver), context-menu «Filter canvas by this row» |
| 6 | **Per-tab / Table V2 filter** | `ViewTab.config` (types.ts:84-85, 118-120) | canonical (внутри Table/Board/Calendar) | внутри `DataTableContent` и др. | ControlBar внутри таба |
| 7 | **Calendar agenda filter** | `AgendaCustomList` (`filterMode: visual/advanced`) | тонкий делегатор + **отдельный advanced-путь** через `parseFormula`/`evaluateFormula` | `src/ui/views/Calendar/agenda/filterEngine.ts:89-117` | `AdvancedFilterEditor.svelte` |

### A.3 Инвариант «единый filterEvaluator» — статус

- **Соблюдён** для слоёв 1, 3, 4, 6, 7 (все делегируют в `filterEvaluator.ts` / `matchesCondition` / `matchesFilterConditions`).
- **Нарушение семантики (не отдельный движок, но обход):**
  - **Слой 2 (`applyFilterTab`)** — `src/ui/views/Dashboard/dashboardFilters.ts:21-24` сравнивает `String(raw) === active.value` напрямую, минуя `matchesCondition`. Это значит: НЕТ нормализации wikilink/Relation, НЕТ case-семантики Select/Status, НЕТ операторов кроме `is`. Для Relation-поля filter-tabs даст расхождение с view-filter по тем же данным. Это скрытый параллельный мини-движок (P1).
  - **Слой 5 (`filterByLinkedSelection`)** — `relationFilterAdapter.ts:68-91` — легитимный адаптер (нормализует Relation-ключи и делегирует в `matchesCondition`), НЕ параллельный движок. Задокументирован как исключение в BACKLOG #044 (invariant note). Оставить.
- **Формульный advanced-путь в Calendar** (`filterEngine.ts:95-106`) — второй способ фильтровать (формула вместо условий). Легитимен как advanced, но это ещё один вход в фильтрацию с иной моделью (formula AST, не FilterDefinition).

### A.4 Дубли / перекрытия семантики (где пользователь не понимает «что на что влияет»)

1. **View-filter (слой 1) ↔ Block subFilter (слой 4)** — оба «глобальный фильтр над всеми представлениями», оба через `applyFilter`, оба показывают пилюли, но живут на разных уровнях (view vs widget) и в разных конфигах. Пользователь на скриншотах видит «Это представление» И «Этот блок — все его представления» как почти одинаковые формулировки для разных слоёв.
2. **Block subFilter (слой 4) ↔ Pipeline Filter step (слой 3)** — оба сужают frame блока по условиям, оба через canonical engine, но слой 3 живёт в «Конвейере» а слой 4 в pill. Порядок: pipeline (3) применяется РАНЬШЕ subFilter (4) (см. A.1), что неочевидно из UI.
3. **Filter-tabs (слой 2) ↔ View-filter (слой 1)** — `promoteFilterTabToGlobal` (`dashboardFilters.ts:33-48`) существует именно потому, что это два разных слоя, которые пользователь хочет объединить; сам факт наличия «promote» — признак того, что два слоя семантически дублируются.
4. **linkedSelection (слой 5) ↔ Relation-поле** — ядро диагноза PRODUCT_RESET §3: `linkedSelection` — это реактивный фильтр блоков, маскирующийся под «связь». Уже покрыто #114 (label «Filtered by relation/canvas/broken», DatabaseCallBlock:102-107), но семантическое перекрытие с настоящим Relation остаётся.

---

## B. КАРТА TRANSFORM PIPELINE

### B.1 Структура

- **Типы:** `src/lib/dashboard-engine/transformTypes.ts:11-19` — 8 типов шагов: `unnest | unpivot | compute | filter | group-by | aggregate | pivot | join`.
- **Исполнитель:** `src/lib/dashboard-engine/transformExecutor.ts` — диспетчеризация `executeFilter:601`, `executeGroupBy:682`, `executePivot:944` и т.д.
- **Хранение:** `WidgetDefinition.transform` (`types.ts:72`, `readonly transform?: TransformPipeline`).
- **Вызов:** `WidgetHost.svelte:66` `executeTransform(enrichedFrame, currentPipeline, { rightFrames })` — только если `steps.length > 0`.
- **UI:** `PipelineEditor.svelte` (открывается из `WidgetHost.svelte:198-207`, кнопка `hasPipelineButton(widget.type)`), плюс дублирующий вход в `DatabaseCallSettings.svelte` (`transform` prop, WidgetHost:183, `on:transformChange`).

### B.2 Дублирование с другими механизмами

| Pipeline step | Дублирует | Вердикт |
|---|---|---|
| `filter` | Слой 1/2/4 фильтрации (A.2) — **четвёртая** точка ввода фильтра | Оставить как advanced; НЕ первый путь (PRODUCT_RESET §R2 прямо это декларирует) |
| `group-by` | Group-by колонки в Table V2 / Board columns (per-view группировка) | **Перекрытие**: обычная группировка должна жить во view-level (R2), pipeline group-by — только для aggregate/pivot сценариев |
| `aggregate` | `stats`/`summary-row` виджеты, `SummaryRow` footer | Перекрытие частичное; pipeline aggregate нужен для многоступенчатых transform → оставить advanced |
| `pivot` | — (уникально) | Оставить — реальная advanced-нужда (R2 явно «pivot/join/advanced») |
| `join` | cross-source correlation (chart correlation, `chartRightFrame` WidgetHost:76-80), `crossProjectRollup` | Перекрытие с correlation-путём chart; но join как pipeline-примитив уникален → оставить advanced |
| `unnest`/`unpivot`/`compute` | `compute` дублирует formula-fields (`applyFormulaFields`) и FormulaBar | `compute` частично дублирует именованные formula-поля; unnest/unpivot уникальны |

### B.3 Оценка legacy vs нужное (после #099 / relation-first)

- **Реально нужное (advanced):** `pivot`, `join`, `unpivot`, `unnest` — нет других путей их выполнить.
- **Спорное/перекрывающееся:** `filter` (4-й вход фильтра), `group-by` (дублирует view-группировку), `aggregate` (частично дублирует stats), `compute` (дублирует formula-поля).
- **Соответствие декларации #099/R2:** PRODUCT_RESET §R2 обещал «расщепление конвейера» и «advanced mode» — но по коду конвейер **не расщеплён**: все 8 шагов в одном `PipelineEditor`, filter/group/aggregate не вынесены во view-level. Декларация НЕ реализована (см. раздел F).

---

## C. КАРТА КОНФИГ-ПОВЕРХНОСТЕЙ

| Уровень | Где | Что настраивает | `file:line` |
|---|---|---|---|
| **Global (plugin)** | `src/ui/settings/settings.ts`, `SettingsMenu/tabs/*` | Проекты, дефолты, команды | `src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers.ts` |
| **Per-view** | `view.filter` / `view.sort` / `view.colors` / `view.config` | Фильтр, сортировка, цвета, layout вью | `src/ui/app/View.svelte:179,188,209` |
| **Per-widget** | `widget.config`, `widget.transform`, `widget.sourceConfig` | Тип-специфичный конфиг + pipeline + источник | `types.ts:65-75` |
| **Per-block (database-call)** | `widget.config.subFilter`, `.linkedSelection`, `.viewTabs` | Блок-фильтр, связь, табы | `types.ts:101-113` |
| **Per-tab** | `ViewTab.config` | Колонки/сорт/фильтр отдельного таба | `types.ts:84-85,118-120` |
| **Per-field** | `view.config.fieldConfig[].relation/.rollup` | Relation/Rollup конфиг поля | `View.svelte:150-159` |

**Осиротевшее / дублирующееся:**
- **Config-панели для retired-типов** (см. D.2) — `configPanelRegistry.ts:70-186` содержит рабочие `initDefaults`/`isConfigured` для `comparison, view-port, summary-row, data-list, sub-base-canvas, yaml-visualizer, timeline`, но у этих типов НЕТ `WIDGET_CONTENT`-записи → cog-панель не открывается (WidgetHost:162 `panelEntry !== undefined`). Мёртвый конфиг-код.
- **Два входа в transform** — `PipelineEditor` (WidgetHost:199) И `DatabaseCallSettings` (WidgetHost:183 `transform` prop). Один шаг конфигурируется из двух мест.

---

## D. ИНВЕНТАРЬ КОДОВОГО МУСОРА

| ID | Что | `file:line` / путь | Доказательство неиспользуемости | Вердикт |
|---|---|---|---|---|
| CD-1 | **`src/archive/dashboard-v1/`** — весь дерево | 25 файлов, **5401 LOC** (non-test) | Prod-импортов нет: `grep archive/dashboard-v1 src` даёт только JSDoc-комментарий `DataTableContent.svelte:6` + `jest.mock` в тестах. Не в бандле (guard `R0_4_archiveContainment.test.ts`) | **Убрать** (>200 LOC → решение пользователя, см. §выводы) |
| CD-2 | **`src/ui/app/filterFunctions.ts`** — re-export шим | `filterFunctions.ts:11-24` | Чистый re-export из `filterEvaluator`; коммент сам просит «New code should import directly» | Оставить-до-миграции импортов / затем убрать (низкий риск) |
| CD-3 | **Config-панели retired-типов** | `configPanelRegistry.ts:70-186` (7 типов) | Нет `WIDGET_CONTENT` записи → `panelEntry===undefined` → cog не рендерит (WidgetHost:162,190) | **Убрать** записи для 7 retired-типов |
| CD-4 | **`applyFilterTab` параллельный компаратор** | `dashboardFilters.ts:21-24` | Обходит `matchesCondition` (см. A.3) | **Объединить** в canonical engine |
| CD-5 | **`filterRecordsForListLegacy` + legacy `list.filters` ветка** | `filterEngine.ts:111-121` | Помечена `calendarLogger.warn('legacy list.filters format')` — обслуживает только старые сохранённые настройки | Оставить-как-migration-shim (проверить, есть ли миграция; если да — убрать) |
| CD-6 | **`LEGACY_OPS` карта операторов v3.0.4** | `filterEngine.ts:23-28` | Обслуживает legacy saved settings | Оставить пока жив v3 config; кандидат на миграцию |

**Примечание по CD-1:** архив guarded-тестом (`R0_4_archiveContainment.test.ts`) — удаление потребует снять guard и test-mocks. 5401 LOC мёртвого кода — крупнейший источник «веса» и путаницы при grep (например `applyFilter`/`linkedSelection` матчатся в архиве, засоряя поиск).

---

## E. ИНВЕНТАРЬ МУСОРА ФИЧ

| ID | Фича / поверхность | `file:line` | Проблема | Вердикт |
|---|---|---|---|---|
| FT-1 | **6 слоёв фильтрации** (A.1) | см. A.2 | Пользователь не может предсказать порядок и суммирование; 4 видимых UI-входа фильтра | **Объединить**: view-level filter как единственный «обычный» путь; pipeline-filter + selection-bus = явные advanced/reactive слои |
| FT-2 | **Filter-tabs как отдельный слой** | `dashboardFilters.ts`, filter-tabs widget | Дублирует view-filter, имеет свой обходной компаратор, требует «promote» чтобы стать настоящим фильтром | **Объединить** с view-filter ИЛИ оставить как чисто UI-shortcut, но применять через canonical engine |
| FT-3 | **7 retired widget types в union** | `types.ts:7-32` (16 типов, live ~8) | `comparison, view-port, summary-row, data-list, sub-base-canvas, yaml-visualizer, timeline` — рендерят placeholder (isRetiredLegacyType, legacyMigration.ts:120-130), но остаются в union, configPanelRegistry, initDefaults | **Убрать** из union после гарантии миграции всех сохранённых конфигов (schema-evolution rule) |
| FT-4 | **Два входа в Pipeline config** | WidgetHost:183 (DatabaseCallSettings) + WidgetHost:199 (PipelineEditor) | Один и тот же `widget.transform` конфигурируется из двух панелей | **Объединить** в один вход |
| FT-5 | **Pipeline filter/group/aggregate** дублируют view-level | transformExecutor `executeFilter/GroupBy` | R2 обещал вынести обычные filter/group/sort во view-level, оставив в pipeline только pivot/join | **Расщепить** конвейёр (декларация #099 не выполнена) |
| FT-6 | **Calendar advanced formula filter** | `filterEngine.ts:95-106` | Второй способ фильтровать (formula AST vs FilterDefinition) | Оставить-как-advanced (легитимно), но задокументировать как отдельную модель |
| FT-7 | **linkedSelection vs Relation** семантика | types.ts:91-99, DatabaseCallBlock:102-107 | Реактивный фильтр блоков маскируется под связь (PRODUCT_RESET §3 диагноз) | Частично покрыто #114 (label); полное разведение — R1 |

---

## F. СВЯЗЬ С ДЕЙСТВУЮЩИМИ ПЛАНАМИ

### Покрыто планом (PRODUCT_RESET / M-RELATION-FIRST)

- **linkedSelection ≠ Relation** (FT-7, A.4.4): диагноз PRODUCT_RESET §3, решение §R1; частично реализовано #114 (label three-state, DatabaseCallBlock:102-107). ✅ покрыто.
- **View-level filter/sort/group вместо параметров движка** (FT-1, FT-5): PRODUCT_RESET §R2 прямо декларирует. ⚠️ покрыто **декларативно, но НЕ реализовано** — конвейер не расщеплён, 6 слоёв живы.
- **Transform pipeline → advanced mode** (B.3): §R2 «Transform pipeline остаётся для pivot/join/advanced и явно маркируется как advanced». ⚠️ маркировки advanced в коде нет; все 8 шагов равноправны в PipelineEditor.

### НОВЫЙ долг, НЕ отражённый в roadmap

1. **`applyFilterTab` — параллельный компаратор** (CD-4/FT-2). Нарушает инвариант «единый filterEvaluator» по семантике. Ни один тикет не покрывает. **Требует нового тикета.**
2. **Config-панели retired-типов — мёртвый конфиг** (CD-3). Не покрыто. **Новый тикет (cleanup).**
3. **5401 LOC архива `dashboard-v1`** (CD-1). BACKLOG упоминает #022.2 «archive dead code» как follow-up, но это про Calendar, не про удаление dashboard-v1. **Требует решения об удалении.**
4. **Два входа в Pipeline config** (FT-4). Не покрыто. **Новый тикет.**
5. **Директория `Dashboard/engine/` в документации не существует** (§0). Документационный долг. **Правка AGENTS/CLAUDE.**
6. **Порядок 6 слоёв фильтрации нигде не задокументирован** и не покрыт тестом-инвариантом. Пользовательская «критическая запутанность» №1. **Требует ADR + возможно order-invariant тест.**

---

## Приложение: severity-таблица (P0–P3)

| Sev | ID | Находка | `file:line` | Вердикт |
|---|---|---|---|---|
| **P1** | FT-1 | 6 слоёв фильтрации без явного порядка/документации | A.1 | Объединить/расщепить |
| **P1** | CD-4/FT-2 | `applyFilterTab` обходит canonical engine | `dashboardFilters.ts:21-24` | Объединить в filterEvaluator |
| **P1** | FT-5 | Pipeline filter/group дублирует view-level (R2 не выполнен) | `transformExecutor.ts:601,682` | Расщепить конвейёр |
| **P2** | CD-1 | 5401 LOC мёртвого архива dashboard-v1 | `src/archive/dashboard-v1/**` | Убрать (решение пользователя) |
| **P2** | FT-3 | 7 retired типов в union + registry | `types.ts:7-32`, `configPanelRegistry.ts:70-186` | Убрать после миграции |
| **P2** | CD-3 | Config-панели retired-типов (мёртвый конфиг) | `configPanelRegistry.ts:70-186` | Убрать записи |
| **P2** | FT-4 | Два входа в Pipeline config | `WidgetHost.svelte:183,199` | Объединить |
| **P3** | CD-2 | `filterFunctions.ts` re-export шим | `filterFunctions.ts:11-24` | Убрать после миграции импортов |
| **P3** | §0 | `Dashboard/engine/` в доках не существует | AGENTS/бриф | Поправить доки |
| **P3** | CD-5/CD-6 | Calendar legacy filter shims | `filterEngine.ts:23-28,111-121` | Оставить до миграции v3 |
| — | FT-7 | linkedSelection vs Relation | `types.ts:91-99` | Покрыто #114/R1 |

*Нет находок P0: ни одна не роняет данные и не нарушает 4 gate; все — про запутанность/вес.*

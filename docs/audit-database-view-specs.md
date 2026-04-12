# Аудит согласованности спецификаций Database View v3.3.0

> **Дата аудита**: 2026-04-12
> **Документы**: `architecture-database-view.md` (v1.1), `database-view-ui-ux.md` (v1.0), `database-view-pivot.md` (v1.0)
> **Статус**: 21 проблема — 7 критических, 10 средних, 4 минорных

---

## Критические проблемы (блокируют реализацию)

### C1. TransformPipeline не интегрирован в Data Pipeline

**Где**: `architecture` §2.2 vs §2.4 vs `pivot` §2.1

Диаграмма §2.2 описывает линейный конвейер:
```
DataSource → Raw DataFrame → RelationResolver → FormulaEngine → RollupEngine
→ Enriched DataFrame → FilterEngine → SortEngine → AggregationEngine → Widgets
```

TransformPipeline (§2.4) вводится как "per-widget transform между DataFrame и виджетом", но **нигде не размещён** в диаграмме §2.2. Открытые вопросы:

1. TransformPipeline работает на Raw или Enriched DataFrame?
   - Если на Raw — COMPUTE step не имеет доступа к Formula/Relation/Rollup fields
   - Если на Enriched — противоречит `pivot` §2.1 (`Raw DataFrame → TransformPipeline`)
2. Как соотносятся FilterEngine (§2.2, project-level) и FILTER step (TransformPipeline, per-widget)?
3. Как соотносятся AggregationEngine (§2.2) и AGGREGATE step (TransformPipeline)?

**Рекомендация**: обновить диаграмму §2.2 — явно показать точку ветвления, где Enriched DataFrame подаётся в per-widget TransformPipeline. Уточнить, что project-level Filter/Sort применяются ДО Transform, а AggregationEngine — ПОСЛЕ (для AggregationRow).

---

### C2. AggregationFunction — коллизия имён и набора

**Где**: `architecture` §4.2.1 vs §2.4 / `pivot` §5.1

Определены ДВА разных типа с одинаковым именем `AggregationFunction`:

| Признак | DataTable (§4.2.1) | TransformPipeline (§2.4 / pivot §5.1) |
|---------|---------------------|----------------------------------------|
| Регистр | `lowercase`: `sum`, `avg` | `UPPERCASE`: `SUM`, `AVG` |
| Путь | `engine/aggregation.ts` | `engine/transformTypes.ts` |
| Уникальные | `count_values`, `count_checked`, `count_unchecked`, `percent_checked`, `percent_unchecked`, `earliest`, `latest`, `date_range`, `none` | `COUNT_DISTINCT`, `FIRST`, `LAST`, `STD_DEV` |

Два разных типа с одним именем в одном `engine/` каталоге — compiletime collision.

**Рекомендация**: 
- Один тип `AggregationFunction` с объединённым набором функций, единый регистр
- Либо раздельные типы с явными именами: `ColumnAggregation` и `PipelineAggregation`

---

### C3. Фазы реализации рассинхронизированы

**Где**: `architecture` §15 vs `pivot` §10

Основная спецификация определяет 5 фаз (Phase 1–5, все v3.3.0). TransformPipeline **не упоминается ни в одной из фаз**.

`pivot` документ определяет собственные 4 фазы (v3.3.0-alpha → v3.4.0+), частично перекрывающие основные:

| Основная фаза | Pivot фаза | Конфликт |
|----------------|------------|----------|
| Phase 1: Foundation — DataTable, AggregationEngine | — | Transform не включён в Foundation |
| Phase 3: Charts + Stats | Pivot Phase 2: Chart/Stats integration | Кто первый? |
| Phase 4: Relations + ComparisonWidget | Pivot Phase 3: ComparisonWidget | Дублирование |
| — | Pivot Phase 1: TransformPipeline core | Не привязан к основной Phase |

**Рекомендация**: объединить в единый план фаз. TransformPipeline types + executor → Phase 1 (Foundation). UNPIVOT/COMPUTE → Phase 2. GROUP BY/AGGREGATE/PIVOT → Phase 3.

---

### C4. Файловая структура не включает Transform-файлы

**Где**: `architecture` §16 vs §2.4 / `pivot` §5.1–5.4

Section 16 (target file structure) перечисляет `engine/`:
```
engine/
├── aggregation.ts
├── relationResolver.ts
├── rollup.ts
├── chartPipeline.ts
├── conditionalFormat.ts
```

Отсутствуют: `transformTypes.ts`, `transformExecutor.ts`, `aggregationFunctions.ts` — все три определены в `pivot` §5.

**Рекомендация**: добавить Transform-файлы в §16:
```
engine/
├── transformTypes.ts
├── transformExecutor.ts
├── transformExecutor.test.ts
├── aggregationFunctions.ts
├── aggregationFunctions.test.ts
```

---

### C5. Три независимых системы агрегации/группировки

**Где**: `architecture` §2.2, §2.4, §6.4

В спецификации описаны три отдельных конвейера с GROUP BY + AGGREGATE логикой:

1. **AggregationEngine** (§2.2) — global pipeline, column summaries для AggregationRow
2. **TransformPipeline** (§2.4, `pivot`) — per-widget GROUP BY + AGGREGATE steps
3. **Chart Data Pipeline** (§6.4) — `DataFrame → GroupBy(xAxis) → Aggregate(yAxis) → ...`

Каждый реализует группировку и агрегацию заново. Это дублирование кода и расхождение поведения.

**Рекомендация**: Chart Data Pipeline (§6.4) должен явно использовать TransformPipeline внутри (FILTER → GROUP BY → AGGREGATE). Описать это в §6.4. AggregationEngine для AggregationRow — отдельный, т.к. работает post-transform.

---

### C6. Grid layout в §3.2 нарушает No-Pixel rule §1.5

**Где**: `architecture` §3.2 vs §1.5

Section 3.2 определяет:
```
Desktop (≥768px):  12-column grid, gap: 8px
Tablet (480-767px): 6-column grid, gap: 6px
Mobile (<480px):    1-column stack, full width
```

Section 1.5 явно запрещает:
- `px` для gap → должно быть `var(--ppp-space-md)` / `var(--ppp-space-sm)`
- `768px` media-query breakpoints → должны быть `@container canvas` в rem
- Section 1.4 запрещает `@media` для layout, требует `@container`

Section 1.5 уже содержит правильный CSS для canvas с container queries. Section 3.2 противоречит ему.

**Рекомендация**: переписать §3.2 с использованием container queries и rem breakpoints из §1.5. Удалить px-значения и media queries.

---

### C7. GROUP BY dateGrouping не определяет имя поля на выходе

**Где**: `pivot` §3.4 vs §4.3

GROUP BY с `dateGrouping: { field: "date", granularity: "week" }` трансформирует значение поля: `"2026-04-15"` → `"2026-W16"`.

В §4.3 (Widget 4 — Weekly Pivot) PIVOT step ссылается на `"categoryField": "date_week"`. Но нигде не определено:
- Выходное поле остаётся `"date"` (с перезаписанными значениями)?
- Или создаётся новое поле `"date_week"`?
- Откуда появляется суффикс `_week`? Это `{field}_{granularity}`?

**Рекомендация**: определить naming convention: `GROUP BY(date, week)` → output field `date_week` = `${field}_${granularity}`. Зафиксировать в §3.4 и в TypeScript interface.

---

## Средние проблемы (расхождения / неоднозначности)

### M1. `WidgetDefinition` в §3.1 не включает `transform`

Section 2.4 добавляет `transform?: TransformPipeline` к WidgetDefinition, а §3.1 определяет полный interface без него. В §12.1 `DatabaseViewConfig.widgets: WidgetDefinition[]` — тоже без transform.

**Рекомендация**: добавить `transform` в определение §3.1.

### M2. `readonly` массивы — несогласованность между документами

`architecture` §2.4: `readonly steps: TransformStep[]`
`pivot` §5.1: `readonly steps: readonly TransformStep[]`

Аналогично для `fieldGroups`, `keepFields`, `columns`, `fields`. Pivot-документ последовательно использует `readonly` на массивах, main spec — нет.

**Рекомендация**: привести к единому стилю (`readonly T[]` в обоих документах — корректнее для immutable pipeline).

### M3. Файловый путь типов: `transform.ts` vs `transformTypes.ts`

`architecture` §2.4 размещает в `engine/transform.ts`. `pivot` §5.1 — в `engine/transformTypes.ts` + `engine/transformExecutor.ts`.

**Рекомендация**: принять split из pivot (types + executor), обновить §2.4.

### M4. `WidgetContext.isMobile` противоречит Матрёшке

§3.1 определяет `WidgetContext.isMobile: boolean`. §1.4 явно запрещает `if (Platform.isMobile)` для layout.

Наличие `isMobile` в контексте виджета провоцирует его использование для layout решений.

**Рекомендация**: переименовать в `isTouch: boolean` или удалить, оставив только CSS `@media (pointer: coarse)` для interaction mode.

### M5. `vh` exception в UI/UX doc не зафиксирован в main spec

`ui-ux` §3.2: `max-height: 60vh` для mobile sheet popover с комментарием "Единственное исключение".
`architecture` §1.5: `vh` → "привязка к viewport ломает Матрёшку" (без исключений).

**Рекомендация**: добавить в §1.5 явное исключение для modal/popover overlay (position: fixed элементы НЕ часть Матрёшки).

### M6. `cqi` единицы не в списке разрешённых

`ui-ux` §3.2: `max-width: min(90cqi, 30rem)` — используется `cqi` (container query inline size).
`architecture` §1.5 — таблица разрешённых единиц не содержит `cqi`.

**Рекомендация**: добавить `cqi` / `cqb` в таблицу §1.5 для container-query-relative sizing.

### M7. FormulaBar и AggregationRow — виджет или подкомпонент?

§2.1 (Component hierarchy) перечисляет `FormulaBar.svelte` и `AggregationRow.svelte` как виджеты наравне с `DataTable.svelte`. §3.1 определяет `'formula-bar' | 'aggregation'` как `WidgetType`.

Но:
- AggregationRow описан в §4.2.1 как **footer DataTable** (подкомпонент)
- FormulaBar описан в §5 и `ui-ux` §8 как **editor** (modal/popover), не как dashboard widget

Если FormulaBar — виджет, что он показывает на canvas в свёрнутом виде? Как пользователь взаимодействует с ним как с "виджетом"?

**Рекомендация**: 
- `AggregationRow` → подкомпонент DataTable (убрать из WidgetType)
- `FormulaBar` → popover/panel (убрать из WidgetType) или переименовать в `FormulaColumn` (widget показывающий derived column)

### M8. Валидация порядка шагов TransformPipeline

`pivot` §2.2 определяет строгий порядок: UNPIVOT → COMPUTE → FILTER → GROUP BY → AGGREGATE → PIVOT.
Executor (§5.2) итерирует `pipeline.steps` без валидации порядка.

Некорректная конфигурация (AGGREGATE перед GROUP BY) даст бессмысленный результат.

**Рекомендация**: добавить `validatePipelineOrder()` в executor — warn/error если steps не в каноническом порядке.

### M9. Performance budget несогласован

`architecture` §1.2: `<100ms render at 1000 records`
`pivot` §8: `2000ms timeout for transform`

Transform на 1000 records × 3 groups (UNPIVOT) = 3000 records → COMPUTE + GROUP BY + AGGREGATE. 2000ms timeout в 20× превышает render budget.

**Рекомендация**: уточнить, что 100ms — это render ПОСЛЕ transform. Transform budget отдельный (e.g. <500ms для 1000 input records). 2000ms — absolute failsafe.

### M10. Widget Header — дублирование collapse controls

`ui-ux` §6.2: Header содержит и ▶/▼ (первый элемент слева — collapse toggle) и [▲]/[▼] (кнопка справа — Resize/Collapse). Оба делают "toggle collapse".

**Рекомендация**: оставить один: ▶/▼ слева для collapse, правую кнопку переназначить или убрать.

---

## Минорные проблемы (редакторские)

### L1. Section 14 Mobile использует px для row heights

§14.3: `Row height: fixed 36px (compact), 48px (default), 72px (expanded)` — нарушает no-pixel rule.

**Fix**: выразить в rem (`2.25rem`, `3rem`, `4.5rem`).

### L2. TransformPipeline Config UI отсутствует в UI/UX документе

`ui-ux` §3.6 ссылается на `[Configure...]` для Transform Pipeline, но детальный UX описан только в `pivot` §6.1–6.2, а не в UI/UX документе.

**Fix**: перенести Pipeline Editor UX в `ui-ux` или добавить явную ссылку.

### L3. Partial group completeness в UNPIVOT не специфицирована

`pivot` §5.3: если `exercise2` существует, но `weight2` — нет, создаётся запись с `weight=undefined`. Документ не описывает это поведение явно.

**Fix**: добавить в §3.1 (UNPIVOT) примечание о partial matches.

### L4. CTA placement — правый край vs Obsidian convention

`ui-ux` §4.3: Primary CTA = rightmost. Obsidian `ModalButtonGroup` размещает CTA слева. Потенциально непривычно для пользователей.

**Fix**: проверить текущее размещение в Obsidian 1.5.7+ и привести к единому стилю.

---

## Комплиментарность документов — оценка

| Аспект | Покрытие | Примечание |
|--------|----------|------------|
| Widget lifecycle (create → configure → use → delete) | ✅ Полный | architecture §3 + ui-ux §6 |
| Data pipeline (source → transform → render) | ⚠️ Gap | TransformPipeline не встроен в main pipeline diagram |
| Mobile adaptation | ⚠️ Частичный | architecture §14 использует px/media вместо Матрёшки §1.4 |
| TypeScript API | ⚠️ Split | Типы дублируются между architecture §2.4 и pivot §5.1 с расхождениями |
| UI/UX patterns | ✅ Хороший | Последовательная система (context menu → popover → modal) |
| Phase planning | ❌ Разрыв | Два несвязанных плана фаз |
| File structure | ⚠️ Неполный | Transform файлы не включены |
| Testing strategy | ✅ Адекватный | Тесты определены для каждой фазы |

## Итог

**Блокирующие действия перед началом кода:**
1. Решить C1 — где TransformPipeline в data pipeline
2. Решить C2 — единый тип AggregationFunction
3. Объединить C3 — единый план фаз
4. Исправить C4 — файловая структура
5. Решить C5 — Chart использует TransformPipeline или свой pipeline?
6. Переписать C6 — grid в rem + container queries
7. Определить C7 — naming convention для GROUP BY dateGrouping output

# Filter Consolidation Design — M-FILTER-CONSOLIDATION

> **Тип:** design brief (read-only architecture). НЕ содержит кода.
> **Автор:** backend-architect.
> **Основа:** `ARCHITECTURE_DEBT_AUDIT_2026-08-22.md` + `PRODUCT_RESET_2026-07-18.md` §R2.
> **Milestone:** M-FILTER-CONSOLIDATION (выше R3/R4).
> **Инварианты:** единый `filterEvaluator` (устранить обход, не плодить движки), dispatch by `DataFieldType`, no new Menu, PX-budget ≤ 177, storage-совместимость (миграции, не потеря данных).
> **Верификация якорей:** каждый `file:line` ниже открыт и подтверждён в источнике (не из аудита).

---

## 0. TL;DR — единая ментальная модель

Шесть слоёв фильтрации сводятся к **трём осям**, у каждой из которых своя роль, своё хранилище и один общий движок (`filterEvaluator.ts`):

| Ось | Роль | Слои-источники (было) | Хранилище (стало) | Видимость |
|---|---|---|---|---|
| **A. Scope (обычный фильтр)** | «что показываем» — человекочитаемый named фильтр view-уровня | 1 (view-filter), 2 (filter-tabs), 3-filter (pipeline filter), 4 (block subFilter) | `view.filter` (canonical) + `widget.config.subFilter` (block-локальный) | видимая, pill+preview |
| **B. Reactive (связь/выбор)** | «сузить по выбранной записи» — реактивно, driven by canvas/relation | 5 (linkedSelection / selection bus) | `widget.config.linkedSelection` + transient canvas store | видимая как label (relation/canvas/broken) |
| **C. Advanced transform** | pivot/join/unnest/unpivot — переформовка frame, НЕ обычный фильтр | 3-остальное (pipeline) | `widget.transform` | скрытая за «Advanced», не первый путь |

Слой 6 (per-tab Table V2) остаётся, но это **та же ось A**, применённая внутри конкретного таба (уже через canonical) — не отдельная семантика.

**Канонический порядок применения (единственный, документируемый в ADR #116):**

```
SOURCE → enrich(formula+relations+rollup) → [A: view.filter] → [A: block.subFilter]
       → [C: advanced transform pivot/join/…] → [B: reactive selection] → sort → render
```

Ключевое отличие от текущего кода: **advanced transform (C) применяется ПОСЛЕ scope-фильтров (A), а reactive selection (B) — последним** перед сортировкой. Сейчас порядок частично инвертирован (pipeline filter применяется раньше subFilter — audit A.1), что и создаёт непредсказуемость.

---

## 1. Единая модель фильтра (#122 umbrella)

### 1.1 Диаграмма «ДО»

```
[SOURCE FRAME]
  │ enrich (formula/relation/rollup)              View.svelte:141-177
  ▼
[1] view.filter        applyFilter                View.svelte:179          canonical
  ▼ applySort                                     View.svelte:188
  ▼
[2] filter-tabs        applyFilterTab             DashboardCanvas:93       ⚠ ОБХОД (dashboardFilters.ts:21-24)
  ▼ buildDisplayFrame                             DashboardCanvas:98
  ▼
[3] pipeline (8 шагов, filter+pivot+join+…)       WidgetHost → transformExecutor.ts:601  canonical (filter), но ПОРЯДОК: раньше [4]
  ▼
[4] block.subFilter    applyFilter                DatabaseCallBlock:113    canonical
  ▼
[5] linkedSelection    filterByLinkedSelection    DatabaseCallBlock:116    адаптер→canonical
  ▼
[6] per-tab filter     (внутри Table/Board)       types.ts:84-85           canonical
  ▼ RENDER
```

Проблемы: (a) [2] обходит движок → Relation/Select расходятся; (b) [3] filter и [4] subFilter — два входа одного и того же «сузить по условиям», применяются в неочевидном порядке; (c) [3] несёт и обычный filter/group (дубль view-level), и настоящий advanced (pivot/join) в одном UI без маркировки; (d) порядок нигде не зафиксирован тестом.

### 1.2 Диаграмма «ПОСЛЕ»

```
[SOURCE FRAME]
  │ enrich (formula/relation/rollup)              View.svelte:141-177   (без изменений)
  ▼
[A1] view.filter       applyFilter                canonical             ── ОСЬ A: Scope
  ▼
[A2] filter-tabs → normalised condition, applied via matchesCondition   ── ОСЬ A (fix #117)
  │    (filter-tab = transient «is»-условие поверх того же движка)
  ▼
[A3] block.subFilter   applyFilter                canonical
  ▼
[C]  advanced transform (pivot/join/unnest/unpivot ONLY)  transformExecutor  ── ОСЬ C: Advanced
  │    filter/group-by → депрекейтятся из pipeline, мигрируют в A/view-group
  ▼
[B]  reactive selection filterByLinkedSelection   адаптер→canonical     ── ОСЬ B: Reactive
  ▼ sort
  ▼ RENDER (per-tab filter = ещё один A-слой внутри таба)
```

**Правило порядка (инвариант):** Scope (A) → Advanced reshape (C) → Reactive (B) → sort. Обоснование: (A) определяет «какие записи вообще в игре» на человеческом языке; (C) переформовывает уже отфильтрованный набор (pivot по отфильтрованным строкам — предсказуемо); (B) — эфемерное сужение по клику, всегда поверх стабильного набора, чтобы снятие выделения возвращало ровно A∩C.

### 1.3 Storage-контракт каждого оставшегося слоя

| Слой | Ось | Хранилище | Тип | Персистентность |
|---|---|---|---|---|
| view.filter | A | `view.filter` (`ProjectDefinition.views[].filter`) | `FilterDefinition` | persisted |
| filter-tabs выбор | A | transient `activeFilterTab` (runtime) + widget `filter-tabs` config (варианты табов) | `ActiveFilterTab` → нормализуется в `FilterCondition` | выбор transient; определения табов persisted |
| block.subFilter | A | `widget.config.subFilter` | `FilterDefinition` | persisted |
| advanced transform | C | `widget.transform` | `TransformPipeline` (после split — только pivot/join/unnest/unpivot) | persisted |
| linkedSelection | B | `widget.config.linkedSelection` (config) + transient canvas store (выбор) | `LinkedSelectionConfig` + runtime | config persisted; выбор transient |
| per-tab | A | `ViewTab.config` | `FilterDefinition` в config таба | persisted |

**Как ось B (relation/linkedSelection, #114) вписывается, а не живёт отдельной семантикой:** `linkedSelection` уже проходит через `composeEffectiveFilter` → `filterByLinkedSelection` → `matchesCondition` (audit A.3, легитимный адаптер `relationFilterAdapter.ts`). В единой модели он остаётся отдельной **осью B** (реактивной), но семантически объявляется как «эфемерный scope-фильтр, порождённый выбором»: его условие — обычный `FilterCondition`, тот же движок, просто источник значения = canvas selection, а не пользовательский ввод. Label three-state (relation/canvas/broken, DatabaseCallBlock:102-107) уже это коммуницирует. **Ничего нового по #114 не требуется** — только зафиксировать в ADR, что B — не параллельная семантика связи, а reactive-проекция оси A.

---

## 2. Фикс обхода canonical (#117)

### 2.1 Проблема (подтверждено)

`dashboardFilters.ts:21-24`:
```
records: frame.records.filter((r) => {
  const raw = r.values[active.field];
  return raw != null && String(raw) === active.value;
}),
```
Прямой `String(raw) === value` минует `matchesCondition`: нет нормализации wikilink/Relation, нет case-семантики Select/Status, только оператор `is`. Для Relation/Select filter-tab расходится с view-filter по тем же данным.

### 2.2 Контракт после фикса

`applyFilterTab` должен построить `FilterCondition` и делегировать в canonical `matchesCondition`:

```ts
// Контракт (интерфейс сохраняется, меняется только реализация тела):
export function applyFilterTab(
  frame: DataFrame,
  active: ActiveFilterTab | null
): DataFrame
// Реализация: active → { field, operator: "is", value, enabled: true }
//             → frame.records.filter(r => matchesCondition(cond, r))
```

`matchesCondition(cond, record)` (filterEvaluator.ts:58) принимает ровно `FilterCondition` и читает `record.values[cond.field]` — сигнатура совпадает 1:1. Импорт: `matchesCondition` из `src/lib/engine/filterEvaluator.ts`. `dashboardFilters.ts` теряет статус «параллельного мини-движка» (CD-4).

### 2.3 Миграция и риск

- **Config-миграция:** НЕ требуется. `ActiveFilterTab {field,value}` — transient runtime-состояние (DashboardCanvas:85), не в data.json. Определения filter-tabs в widget config хранят `{field,value}` строками — совместимы, т.к. `promoteFilterTabToGlobal` (dashboardFilters.ts:33-48) уже строит идентичное `is`-условие.
- **Риск регрессии (P1):** для String/Select-полей, где значение таба уже совпадает с сырым `String(raw)`, поведение неизменно. Для **Relation/Select/Status** поведение **изменится** (в правильную сторону): таб начнёт матчить нормализованные wikilink и case-insensitive Select. Это исправление, но может визуально изменить состав у пользователей, у которых таб «случайно» работал на raw-строке. **Митигирующий тест:** golden-набор {String, Select, Status, Relation} × {совпадает raw / нужна нормализация} — до/после (см. #116 order-invariant + condition-parity тест).
- **Второй риск:** `active.value` — `string`; для number/boolean-полей `matchesCondition` с `operator:"is"` сравнивает через свою типизированную ветку. Нужно проверить, что filter-tab value для Number-поля коэрсится корректно (тестом), иначе тонкая регрессия.

---

## 3. Расщепление конвейера (#118)

### 3.1 Классификация 8 шагов (transformTypes.ts:11-19)

| Step | Класс | Действие |
|---|---|---|
| `pivot` | **Advanced (C)** | оставить в pipeline |
| `join` | **Advanced (C)** | оставить в pipeline |
| `unnest` | **Advanced (C)** | оставить в pipeline |
| `unpivot` | **Advanced (C)** | оставить в pipeline |
| `aggregate` | **Advanced (C)** | оставить (нужен для многоступенчатых transform после pivot/group) |
| `group-by` | **Depreciate из «обычного» пути** | обычная группировка → view-level (Board columns / Table group); в pipeline group-by остаётся ТОЛЬКО как вход для aggregate/pivot, помечается advanced |
| `filter` | **Depreciate** | мигрирует в ось A (view.filter или block.subFilter) |
| `compute` | **Оставить advanced** | частично дублирует formula-поля, но unique для inline вычислений в цепочке; маркируется advanced |

### 3.2 Что переносится / депрекейтится / путь миграции

**Принцип (schema-evolution rule, CLAUDE.md):** ничего не удаляем из `TransformStepType` union немедленно — это ломает сохранённые `widget.transform`. Депрекейтим в UI + добавляем миграцию, исполнитель продолжает понимать legacy-шаги.

- **`filter` step → ось A.** Миграция при загрузке widget: если `widget.transform.steps` содержит одиночный `filter` без предшествующего reshape-шага (pivot/join/unnest/unpivot) → перенести его `conditions` в `widget.config.subFilter` (слить, если subFilter уже есть, через `conjunction:"and"`); удалить filter-step из pipeline. Если filter стоит ПОСЛЕ reshape (фильтр по результату pivot) — оставить в pipeline как advanced (это легитимный post-transform filter).
- **`group-by` step → view-level, если «терминальный».** Если pipeline = один `group-by` без aggregate/pivot после него → это обычная группировка → мигрировать в `view.config` group (или Board column field). Если за group-by идёт aggregate/pivot → оставить (это часть advanced-цепочки).
- **UI split:** `PipelineEditor.svelte` разделяется на два входа НЕ по числу панелей, а по маркировке: обычные операции (уже мигрированы в view pills) исчезают из первичного UI; PipelineEditor становится **«Advanced transforms»**, доступным за explicit disclosure (кнопка/секция «Advanced»), не первым способом. Это закрывает R2 «pipeline явно маркируется как advanced».
- **#121 (два входа Pipeline config):** объединить `DatabaseCallSettings` transform-вход (WidgetHost:183) и `PipelineEditor` (WidgetHost:199) в единый advanced-вход. Один `widget.transform` — одна панель.

### 3.3 Контракт миграции

```ts
// Чистая функция, вызывается в legacyMigration при загрузке widget.
// НЕ теряет данные: любой шаг, который нельзя безопасно перенести, остаётся в pipeline.
function migrateTransformToViewLevel(widget: WidgetDefinition): {
  transform?: TransformPipeline;        // pipeline с оставшимися advanced-шагами
  config: WidgetConfig;                 // subFilter / group дополнены
  migrated: boolean;                    // для configProvenance.test (no-op на уже-мигрированных)
}
// Инвариант: migrate(migrate(w)) === migrate(w)  (идемпотентность)
```

**Риск (P2):** порядок шагов в pipeline семантически значим (filter-до-pivot ≠ filter-после-pivot). Правило «терминальный/после reshape» должно быть строгим, иначе миграция изменит результат. Требует order-aware unit-теста на каждый паттерн (filter-only, filter-before-pivot, filter-after-pivot, group-then-aggregate).

---

## 4. ADR порядка (#116)

### 4.1 Структура `docs/internal/FILTER_ORDER_ADR.md`

```
# ADR: Canonical Filter Application Order

## Status: Accepted (M-FILTER-CONSOLIDATION)
## Context
  - 6 слоёв, нет документированного порядка (audit A.1).
## Decision
  Три оси: A (Scope) → C (Advanced reshape) → B (Reactive), затем sort.
  Полный порядок с file:line точками применения.
## Consequences
  - filter-tabs и subFilter — одна ось A, один движок.
  - pipeline filter/group депрекейтятся из обычного пути.
## Invariant enforcement
  - Ссылка на order-invariant тест (см. 4.2).
## Non-goals
  - Calendar advanced formula filter (filterEngine.ts) — отдельная модель, вне ADR.
```

### 4.2 Идея order-invariant теста

`src/__tests__/R_filterOrder.invariant.test.ts` — фиксирует канонический порядок как исполняемый контракт:

1. **Order-invariant:** построить frame + все три оси (A: subFilter, C: pivot, B: selection). Прогнать полный конвейер. Ассертить, что результат = композиция в порядке A→C→B (сравнить с эталонным ручным применением). Регресс порядка (например, если кто-то снова применит pipeline до subFilter) — красный тест.
2. **Condition-parity (для #117):** один и тот же {field,value} через `view.filter` и через `applyFilterTab` даёт идентичный набор записей для String/Select/Status/Relation. Ловит повторное появление обхода.
3. **Selection-idempotence (ось B):** снятие canvas-выделения возвращает ровно A∩C (B не «прилипает»).

---

## 5. Декомпозиция milestone

Уже заведённые номера: #116 ADR, #117 applyFilterTab, #118 pipeline split, #119 удаление архива (одобрено, вне скоупа), #120 retired-типы, #121 два входа Pipeline config, #122 umbrella.

| # | Тикет | Компл. | Affected files (ключевые) | Контракт | Зависит от | Риск |
|---|---|---|---|---|---|---|
| **#116** | ADR порядка + order-invariant тест | **S** | `docs/internal/FILTER_ORDER_ADR.md` (new), `src/__tests__/R_filterOrder.invariant.test.ts` (new) | документ + 3 теста (4.2) | — (первым: фиксирует целевой инвариант ДО рефактора) | низкий; тест сначала red, зеленеет по мере #117/#118 |
| **#117** | applyFilterTab → canonical | **XS** | `src/ui/views/Dashboard/dashboardFilters.ts` (тело `applyFilterTab`) | §2.2 контракт; импорт `matchesCondition` | #116 (parity-тест) | **P1** Relation/Select регрессия — покрыт parity-тестом |
| **#121** | Один вход Pipeline config | **S** | `WidgetHost.svelte:183,199`, `DatabaseCallSettings.svelte`, `PipelineEditor.svelte` (props) | один `widget.transform`, одна панель | — (можно параллельно #117) | средний UI; storage не меняется |
| **#118** | Расщепление конвейера + advanced-маркировка + миграция | **L** | `transformTypes.ts`, `legacyMigration.ts` (миграция §3.3), `PipelineEditor.svelte`, `WidgetHost.svelte`, `types.ts` (WidgetConfig subFilter merge), `View.svelte`/view-group UI | §3.3 `migrateTransformToViewLevel`, идемпотентность | #121 (единый вход), #116 (order-инвариант), #122 (модель) | **P2** порядок шагов; потеря данных если миграция неверна |
| **#120** | Убрать config-панели retired-типов | **S** | `configPanelRegistry.ts:70-186`, `configPanelRegistry.test.ts`, `types.ts:7-32` (после гарантии миграции) | удалить 7 записей; миграция сохранённых конфигов retired→placeholder | независим; но координировать с #118 (общий types.ts) | **P2** сохранённые конфиги — нужна миграция перед удалением из union |
| **#122** | Umbrella: единая модель (эта декомпозиция) | **M** (координация) | — (мета); влияет на все выше | ADR + модель §1; закрывается когда #116–#121 done | обёртка над всеми | — |

**#119** (удаление `src/archive/dashboard-v1/`, 5401 LOC) — одобрено, вне моего скоупа; отмечаю зависимость: снять guard `R0_4_archiveContainment.test.ts` + test-mocks. Не блокирует #116–#122, но чистит grep-шум для их реализации → **желательно сделать первым** (инфраструктурно).

### 5.1 Порядок реализации (граф зависимостей)

```
#119 (архив, вне скоупа)  ──► чистит grep-шум для всех
      │
#116 (ADR + red-тесты)  ──► задаёт целевой инвариант
      │
      ├──► #117 (applyFilterTab)  ── parity-тест зеленеет
      ├──► #121 (единый pipeline-вход)
      │        │
      │        ▼
      └──► #118 (split + миграция) ── order-тест зеленеет
                 │
                 ▼
           #120 (retired cleanup, координация types.ts)
                 │
                 ▼
           #122 (umbrella close)
```

**Рекомендуемая линейная последовательность:** #119 → #116 → #117 → #121 → #118 → #120 → #122.

---

## 6. Топ-риски

1. **[P1] #117 Relation/Select регрессия видимого состава.** Переход с raw-сравнения на canonical изменит поведение filter-tabs для Relation/Select/Status. Правильное, но заметное изменение. Митигация: condition-parity golden-тест (#116) ДО мержа.
2. **[P2] #118 потеря/искажение данных при миграции pipeline.** Неверная классификация «терминальный vs post-reshape» filter/group-by изменит результат. Митигация: идемпотентность + order-aware тесты на каждый паттерн; правило «не уверен → оставить в pipeline».
3. **[P2] #120 удаление retired-типов из union без полной миграции сохранённых конфигов** — schema-evolution rule нарушится, старые data.json сломаются. Митигация: миграция retired→placeholder в том же коммите, `configProvenance.test` no-op.
4. **[Средний] Порядок A→C→B меняет текущее фактическое поведение** (сейчас pipeline-filter раньше subFilter — audit A.1). Пользователи с обоими слоями могут увидеть иной результат. Митигация: order-invariant тест фиксирует НОВЫЙ порядок как контракт; задокументировать в ADR как осознанное breaking-изменение поведения (не данных).
5. **[Низкий] Calendar advanced formula filter** (`filterEngine.ts:95-106`) — вторая модель фильтрации (formula AST). Вне консолидации; риск — если кто-то посчитает её частью M-FILTER. Явно объявить non-goal в ADR (#116).

---

## Handoff

Design complete. Требуется **пользовательское решение** перед стартом #118: подтвердить, что смена фактического порядка (pipeline-filter теперь ПОСЛЕ subFilter, риск 4) — приемлемое изменение поведения. Остальное — в senior-developer по порядку §5.1, каждый тикет с pre-approved контрактом выше.

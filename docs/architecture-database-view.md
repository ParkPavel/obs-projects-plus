# Database View v3.3.0 — Полная спецификация

> **Статус**: DRAFT v1.2 | **Дата**: 2026-04-12
> **Заменяет**: Table View (`views["table"]`)
> **Совместимость**: Obsidian 1.5.7+ | Desktop + Mobile
> **Предыдущий черновик**: `architecture-database-view.OLD.md`
> **Связанные документы**:
> - `database-view-ui-ux.md` — Детальная спецификация UI/UX (контекстные меню, поповеры, кнопки, анимации)
> - `database-view-pivot.md` — Сводные таблицы и трансформация данных (Pivot/Unpivot Pipeline)

---

## Содержание

- [1. Vision & Принципы](#1-vision--принципы)
  - [1.4 Матрёшка — контейнерная архитектура](#14-матрёшка--контейнерная-архитектура)
  - [1.5 Универсальная адаптивность](#15-универсальная-адаптивность-ноль-пикселей)
- [2. Архитектура — Высокоуровневая](#2-архитектура--высокоуровневая)
  - [2.4 Data Transform Pipeline (Pivot)](#24-data-transform-pipeline-pivot--unpivot)
- [3. Модульная система виджетов](#3-модульная-система-виджетов)
- [4. Модуль: DataTable](#4-модуль-datatable-расширенная-таблица)
- [5. Модуль: FormulaBar](#5-модуль-formulabar-визуальный-конструктор-формул)
- [6. Модуль: ChartWidget](#6-модуль-chartwidget-визуализации)
- [7. Модуль: StatsWidget](#7-модуль-statswidget-kpi--статистика)
- [8. Модуль: ComparisonWidget](#8-модуль-comparisonwidget-модели-сравнений)
- [9. Модуль: ChecklistWidget](#9-модуль-checklistwidget-todo-листы)
- [10. Модуль: ViewPortWidget](#10-модуль-viewportwidget-мини-окна)
- [11. Типы данных — Расширения](#11-типы-данных--расширения-v330)
- [12. Configuration](#12-configuration--databaseviewconfig)
- [13. UX-сценарии](#13-ux-сценарии-использования)
- [14. Mobile-специфика](#14-mobile-специфика)
- [15. Фазы реализации](#15-фазы-реализации)
- [16. Файловая структура](#16-файловая-структура-target)
- [17. Риски и mitigation](#17-риски-и-mitigation)
- [18. Метрики успеха](#18-метрики-успеха)
- [19. Зависимости](#19-зависимости)
- [20. Глоссарий](#20-глоссарий)

---

## 1. Vision & Принципы

### 1.1 Главная идея

Database View — модульный визуально-аналитический интерфейс, объединяющий возможности табличного представления с вычислительным движком, визуализациями и конструктором виджетов. Заменяет текущий Table View, сохраняя полную обратную совместимость.

**Ключевое отличие от Notion**: Notion — облачный SaaS с серверной обработкой. Obsidian — локальное приложение с frontmatter-хранилищем. Все вычисления происходят на клиенте, данные хранятся в YAML frontmatter markdown-файлов. Это определяет архитектурные ограничения и преимущества:

| Аспект | Notion | Database View (OBS) |
|--------|--------|---------------------|
| Хранение | Облачная БД | YAML frontmatter |
| Relations | UUID-ссылки на pages | Wiki-links `[[note]]` |
| Rollups | Серверная агрегация | Локальная агрегация по wiki-links |
| Formula | Серверный eval | Локальный AST-evaluator (уже есть) |
| Real-time | Collaborative | Single-user, file watcher |
| Типы полей | 20+ специализированных | 6 базовых + derived → расширяем до 11 |

### 1.2 Принципы проектирования

1. **Бесследность (Non-invasive)** — данные = frontmatter, никаких скрытых БД
2. **Модульность**: каждый инструмент — независимый виджет со своим lifecycle
3. **Backward Compatibility**: TableConfig v3.2.x автоматически мигрирует в DatabaseViewConfig
4. **Progressive Disclosure**: простой табличный вид по умолчанию, расширенные модули — по запросу
5. **Offline-first**: никаких сетевых зависимостей, всё вычисляется локально
6. **Performance Budget**: <100ms рендер при 1000 записей, <16ms на ввод в ячейку
7. **Mobile-first Layout**: адаптивная grid-система, touch-friendly контролы
8. **Zero new dependencies**: SVG charts, grid layout, formulas — всё внутреннее

### 1.3 Сравнительный анализ: что берём из Notion, что адаптируем

| Notion Feature | Наш аналог | Адаптация под Obsidian |
|----------------|------------|------------------------|
| Database properties (20+ types) | DataFieldType (6 → 11 types) | Select/Status хранятся как String + options в fieldConfig |
| Formula property | Formula field (derived) | Расширяем существующий formulaParser.ts |
| Relation property | Relation field | Wiki-links `[[note]]` → resolve по file path |
| Rollup property | Rollup field (derived) | Агрегация по resolved wiki-links |
| Chart view (bar, line, donut, number) | ChartWidget | Pure SVG, no d3/chart.js, theme-aware |
| Dashboard view (multi-widget) | DatabaseViewCanvas + widgets | CSS Grid + WidgetHost с resize/drag |
| Aggregations (SUM, COUNT...) | AggregationRow в DataTable | Футер-строка с selectable function per column |
| Groups & Sub-groups | Row Grouping | GroupBy в DataTable, collapsible |
| Conditional formatting | ConditionalFormat | Color rules per cell based on FilterCondition |
| Freeze columns | FreezeUpTo | Extend existing pinned logic |

**Что НЕ берём из Notion** (неприменимо к Obsidian):
- People property (нет пользователей)
- Created by / Last edited by (нет multi-user)
- Verification (no wiki databases)
- Files & media property (отдельная Obsidian механика)
- Real-time collaboration features
- AI formula generation (out of scope v3.3.0)

### 1.4 Матрёшка — контейнерная архитектура

Каждый компонент Database View — это самодостаточный контейнер, который адаптируется к **своему** родителю, а не к viewport устройства. Вложенность произвольная:

```
ProjectsView (Obsidian leaf)
  └── DatabaseViewCanvas (контейнер виджетов)
        ├── WidgetHost (контейнер одного виджета)
        │     └── DataTable (адаптируется к WidgetHost)
        │           ├── GridHeader (адаптируется к DataTable)
        │           ├── GridRow (адаптируется к DataTable)
        │           └── AggregationRow (адаптируется к DataTable)
        └── WidgetHost
              └── ChartWidget (адаптируется к WidgetHost)
                    └── BarChart SVG (адаптируется к ChartWidget)
```

**Правила Матрёшки:**

1. **Каждый компонент определяет `container-type: inline-size`** — это делает его "контейнером" для детей
2. **Дети используют `@container` queries** для адаптации — НЕ `@media`
3. **Ни один компонент не знает, на каком устройстве он отображается** — только размер своего контейнера
4. **Resize виджета = те же breakpoints** что и смена устройства — один код для обоих случаев
5. **Вложенная матрёшка работает рекурсивно** — ViewPort внутри Widget внутри Canvas → каждый уровень адаптируется к своему parent

```css
/* Каждый уровень — контейнер */
.ppp-db-canvas    { container-type: inline-size; container-name: canvas; }
.ppp-widget-host  { container-type: inline-size; container-name: widget; }
.ppp-data-table   { container-type: inline-size; container-name: table; }
.ppp-chart        { container-type: inline-size; container-name: chart; }

/* Виджет адаптируется к своему контейнеру, а не к viewport */
@container widget (max-width: 20rem) {
  .ppp-data-table { /* compact mode */ }
}
@container widget (min-width: 20rem) and (max-width: 40rem) {
  .ppp-data-table { /* standard mode */ }
}
@container widget (min-width: 40rem) {
  .ppp-data-table { /* expanded mode */ }
}
```

**Следствия:**
- Пользователь уменьшает виджет → виджет сам переключается в compact → тот же эффект, что и на мобильном
- На split-screen Obsidian → leaf уже, Canvas получает меньше места → виджеты адаптируются автоматически
- Нет условий `if (Platform.isMobile)` для layout — только CSS container queries
- JavaScript device detection (`@media (pointer: coarse)`) используется **только** для interaction mode (touch targets, haptics), не для layout

### 1.5 Универсальная адаптивность (ноль пикселей)

**Единицы измерения — строгие правила:**

| Что | Единица | Почему |
|-----|---------|--------|
| Spacing, padding, gap | `rem` | Масштабируется с font-size пользователя |
| Font sizes | `rem` | Accessibility: пользователь контролирует размер |
| Component sizes | `rem` | Согласованность с spacing |
| Borders | `1px` | Единственное исключение — субпиксельные линии нечитаемы |
| Widths контейнеров | `%`, `fr`, `auto` | Заполнение доступного пространства |
| Max/min constraints | `rem` | Относительные пределы |
| Container-relative sizing | `cqi`, `cqb` | Для popover/tooltip внутри контейнера |
| SVG Charts | `viewBox` + `100%` width | Масштабируются в любой контейнер |
| Breakpoints в @container | `rem` | Не привязаны к конкретному устройству |

**Исключения (position: fixed элементы НЕ часть Матрёшки):**
- `vh` допускается для `position: fixed` overlays (modal, bottom-sheet) — они привязаны к viewport, не к контейнеру
- `env(safe-area-inset-*)` для notch-safe padding в overlays

**Запрещено:**
- `px` для spacing, padding, margins, font-size, heights, widths (кроме border)
- `vw` / `vh` — привязка к viewport ломает Матрёшку (кроме position: fixed overlays, см. выше)
- Hardcoded media-query breakpoints вроде `768px`
- `transform: scale()` для responsive — деформирует touch targets

**Шкала размеров (Design Tokens):**

```css
/* Наследуем существующую систему tokens.css */
--ppp-space-xxs: 0.125rem;  /* 2px  */
--ppp-space-xs:  0.25rem;   /* 4px  */
--ppp-space-sm:  0.375rem;  /* 6px  */
--ppp-space-md:  0.5rem;    /* 8px  */
--ppp-space-lg:  0.75rem;   /* 12px */
--ppp-space-xl:  1rem;      /* 16px */
--ppp-space-2xl: 1.5rem;    /* 24px */
--ppp-space-3xl: 2rem;      /* 32px */

/* Контейнерные breakpoints — все в rem */
--ppp-bp-compact:  20rem;   /* ~320px — min useful width */
--ppp-bp-narrow:   30rem;   /* ~480px */
--ppp-bp-standard: 40rem;   /* ~640px */
--ppp-bp-wide:     55rem;   /* ~880px */
--ppp-bp-full:     70rem;   /* ~1120px */
```

**Адаптивная сетка виджетов:**

```css
.ppp-db-canvas {
  display: grid;
  gap: var(--ppp-space-md);
  /* Автоматические столбцы: от 1 до 12, зависят от ширины контейнера */
  grid-template-columns: repeat(auto-fill, minmax(var(--ppp-widget-min-w, 15rem), 1fr));
}

/* Canvas адаптируется к своему контейнеру */
@container canvas (max-width: 30rem) {
  .ppp-db-canvas {
    grid-template-columns: 1fr;  /* Stack mode */
    gap: var(--ppp-space-sm);
  }
}
```

**Принцип "Interaction ≠ Layout":**

Единственное место, где нужно знать тип ввода — это interaction mode. Это решается через CSS `@media (pointer)`, а не через JS-детекцию устройства:

```css
/* Touch device — увеличиваем touch targets, НЕ меняем layout */
@media (pointer: coarse) {
  :root {
    --ppp-touch-target-min: 2.75rem;    /* 44px — iOS/Android minimum */
    --ppp-button-height-md: var(--ppp-touch-target-min);
    --ppp-input-height: var(--ppp-touch-target-min);
  }
}

/* Fine pointer — стандартные размеры */
@media (pointer: fine) {
  :root {
    --ppp-touch-target-min: 2rem;
    --ppp-button-height-md: 2rem;
    --ppp-input-height: 2rem;
  }
}
```

> **Полная детализация UI/UX**: контекстные меню, поповеры, кнопки, settings-панели, анимации, gesture choreography — см. отдельный документ `database-view-ui-ux.md`

---

## 2. Архитектура — Высокоуровневая

### 2.1 Компонентная иерархия

```
DatabaseView (databaseView.ts → extends ProjectView<DatabaseViewConfig>)
│
├── DatabaseViewCanvas.svelte          ← Главный контейнер (CSS Grid / виджет-grid)
│   │
│   ├── WidgetHost.svelte              ← Контейнер виджета (resize, drag, collapse)
│   │   ├── header (title, menu, collapse toggle)
│   │   ├── <slot> ← конкретный виджет
│   │   └── resize handles (8 directions on desktop, bottom-right on mobile)
│   │
│   ├── [Модули-виджеты]:
│   │   ├── DataTable.svelte           ← Расширенная таблица (замена DataGrid)
│   │   ├── FormulaBar.svelte          ← Визуальный стек формул
│   │   ├── AggregationRow.svelte      ← Футер-агрегации (SUM, AVG, COUNT...)
│   │   ├── ChartWidget.svelte         ← Диаграммы (bar, line, pie, donut)
│   │   ├── StatsWidget.svelte         ← Статистика (KPI-карточки)
│   │   ├── ComparisonWidget.svelte    ← Модели сравнений
│   │   ├── ChecklistWidget.svelte     ← Todo-листы
│   │   └── ViewPortWidget.svelte      ← Мини-окна в другие views
│   │
│   └── WidgetToolbar.svelte           ← Панель добавления виджетов
│
├── DataPipeline (TypeScript, не UI)
│   ├── DataSource → DataFrame          (уже есть)
│   ├── FormulaEngine                   (расширение formulaParser.ts)
│   ├── AggregationEngine               (новый)
│   ├── RelationResolver                (новый — wiki-link resolution)
│   └── RollupEngine                    (новый — агрегация по relations)
│
└── ConfigManager
    ├── DatabaseViewConfig               (JSON-сериализуемый)
    ├── WidgetLayout[]                   (позиции и размеры)
    └── Migration from TableConfig       (автоматическая)
```

### 2.2 Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA PIPELINE                                │
│                                                                     │
│  DataSource (folder/tag/dataview)                                   │
│       ↓                                                             │
│  Raw DataFrame { fields[], records[] }                              │
│       ↓                                                             │
│  RelationResolver ← resolves [[wiki-links]] to DataRecord refs      │
│       ↓                                                             │
│  FormulaEngine ← evaluates formula fields (derived: true)           │
│       ↓                                                             │
│  RollupEngine ← aggregates across relation targets                  │
│       ↓                                                             │
│  Enriched DataFrame { fields[], records[], relations{}, rollups{} } │
│       ↓                                                             │
│  FilterEngine (existing) → project-level filtered records           │
│       ↓                                                             │
│  SortEngine (existing) → sorted records                             │
│       ↓                                                             │
│  Sorted DataFrame  ──────────────┬──────────────────────────────┐   │
│       │                          │                              │   │
│       ↓ (AggregationRow)         ↓ (per-widget, optional)       │   │
│  ColumnAggregationEngine     TransformPipeline                  │   │
│  → footer summaries          → UNPIVOT → COMPUTE → FILTER      │   │
│    (SUM, AVG, COUNT...)        → GROUP BY → AGGREGATE → PIVOT   │   │
│       │                          │                              │   │
│       ↓                          ↓                              │   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐       │   │
│  │DataTable │ Chart    │ Stats    │ Checklist│ ViewPort │       │   │
│  │Widget    │ Widget   │ Widget   │ Widget   │ Widget   │       │   │
│  │+AggRow   │(transform│(transform│          │          │       │   │
│  │          │ or direct)│ or direct)│         │          │       │   │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘       │   │
└─────────────────────────────────────────────────────────────────────┘

**Важно**: TransformPipeline работает на **Enriched DataFrame** (после Relation/Formula/Rollup),
а не на Raw DataFrame. COMPUTE step имеет доступ к formula и rollup значениям.
Project-level Filter/Sort применяются ДО TransformPipeline.
ColumnAggregationEngine (для AggregationRow в DataTable footer) работает параллельно — это
отдельный engine для per-column summaries, не конфликтует с pipeline AGGREGATE.
```

### 2.3 Связь с существующей архитектурой

```typescript
// Регистрация — view.ts
views["database"] = new DatabaseViewType();  // НОВЫЙ
views["table"]    = views["database"];        // ALIAS для backward compat

// Migration — settings
if (view.type === "table") {
  view.type = "database";
  view.config = migrateTableConfig(view.config as TableConfig);
}
```

**Что переиспользуем без изменений:**
- `ProjectView<T>` abstract class и lifecycle (`onOpen`, `onData`, `onClose`)
- `ViewApi` / `DataApi` — all CRUD operations
- `DataFrame` / `DataRecord` / `DataField` — core data types
- `filterFunctions.ts` — filter engine
- `formulaParser.ts` — formula evaluation (расширяем, не переписываем)
- GridCell/* components — cell renderers (text, number, date, bool, list)
- svelte-dnd-action — DnD for widgets
- CSS tokens — theme integration

### 2.4 Data Transform Pipeline (Pivot / Unpivot)

**Проблема**: YAML frontmatter хранит данные "плоско" — одна заметка = одна строка в DataFrame. Но аналитические задачи часто требуют трансформации: из "широкой" таблицы (много столбцов) в "длинную" (много строк с категориями), и обратно — для сводных расчётов.

**Пример — дневник тренировок:**

```yaml
# Заметка: 2026-04-01 Тренировка.md
---
date: 2026-04-01
exercise1: "Bench Press"
weight1: 80
sets1: 4
reps1: 10
exercise2: "Squat"
weight2: 120
sets2: 5
reps2: 8
exercise3: "Deadlift"
weight3: 140
sets3: 3
reps3: 5
---
```

**Без трансформации** → DataFrame: одна строка с 12+ столбцами. Невозможно:
- Отфильтровать "все записи с Bench Press"
- Построить график "вес по неделям для каждого упражнения"
- Вычислить "средний объём (sets × reps × weight) за месяц по упражнению"

**Решение — TransformPipeline** — вставляется в Data Pipeline между DataFrame и виджетами:

```
Raw DataFrame
     ↓
┌─────────────────────────────────────────────────┐
│  TRANSFORM PIPELINE (opциональный, per-widget)   │
│                                                   │
│  1. UNPIVOT (Melt)                                │
│     Wide → Long: field groups → rows              │
│                                                   │
│  2. COMPUTE                                       │
│     Add derived columns (volume = w × s × r)      │
│                                                   │
│  3. FILTER                                        │
│     Select time range, exercise, etc.              │
│                                                   │
│  4. GROUP BY                                      │
│     By exercise + by week/month                    │
│                                                   │
│  5. AGGREGATE                                     │
│     SUM, AVG, MAX per group                        │
│                                                   │
│  6. PIVOT (опционально)                           │
│     Long → Wide: категории → столбцы               │
│                                                   │
│  Result: Transformed DataFrame                     │
└─────────────────────────────────────────────────┘
     ↓
Widget (Chart, Stats, DataTable)
```

**Пример трансформации — тренировки → месячная статистика:**

**Шаг 1: UNPIVOT** — паттерн полей `exercise{N}, weight{N}, sets{N}, reps{N}` → строки:

```
До (Wide):
| date       | exercise1     | weight1 | sets1 | exercise2 | weight2 | sets2 |
|------------|---------------|---------|-------|-----------|---------|-------|
| 2026-04-01 | Bench Press   | 80      | 4     | Squat     | 120     | 5     |
| 2026-04-03 | Bench Press   | 82.5    | 4     | Deadlift  | 145     | 3     |

После UNPIVOT:
| date       | exercise      | weight  | sets  | reps | _source_record     |
|------------|---------------|---------|-------|------|--------------------|
| 2026-04-01 | Bench Press   | 80      | 4     | 10   | 2026-04-01.md      |
| 2026-04-01 | Squat         | 120     | 5     | 8    | 2026-04-01.md      |
| 2026-04-03 | Bench Press   | 82.5    | 4     | 10   | 2026-04-03.md      |
| 2026-04-03 | Deadlift      | 145     | 3     | 5    | 2026-04-03.md      |
```

**Шаг 2: COMPUTE** — добавляем вычисляемый столбец:

```
| ... | volume (= weight × sets × reps) |
|-----|-----------------------------------|
| ... | 80 × 4 × 10 = 3200              |
| ... | 120 × 5 × 8 = 4800              |
```

**Шаг 3: GROUP BY** exercise + month(date) **→ AGGREGATE** (SUM, AVG, MAX):

```
| exercise    | month   | total_volume | avg_weight | max_weight | sessions |
|-------------|---------|-------------|------------|------------|----------|
| Bench Press | 2026-04 | 25,600      | 81.25      | 85         | 8        |
| Squat       | 2026-04 | 19,200      | 122.5      | 130        | 4        |
| Deadlift    | 2026-04 | 8,700       | 142.5      | 150        | 3        |
```

**TypeScript-интерфейс:**

```typescript
// src/ui/views/Database/engine/transformTypes.ts

export interface TransformPipeline {
  readonly steps: readonly TransformStep[];
}

export type TransformStep =
  | UnpivotStep
  | ComputeStep
  | FilterStep
  | GroupByStep
  | AggregateStep
  | PivotStep;

/** Melt: превращает группы одноимённых полей (field1, field2, ...) в строки */
export interface UnpivotStep {
  readonly type: 'unpivot';
  readonly fieldGroups: readonly FieldGroup[];
  readonly keepFields: readonly string[];       // Поля, не участвующие в unpivot (date, etc.)
}

export interface FieldGroup {
  readonly pattern: string;            // Regex: "exercise(\\d+)" или prefix: "exercise"
  readonly outputName: string;         // Имя результирующего столбца: "exercise"
}

/** Добавить вычисляемый столбец */
export interface ComputeStep {
  readonly type: 'compute';
  readonly columns: readonly ComputedColumn[];
}

export interface ComputedColumn {
  readonly name: string;
  readonly expression: string;         // Formula expression: "weight * sets * reps"
}

/** Фильтрация строк (использует существующий FilterEngine) */
export interface FilterStep {
  readonly type: 'filter';
  readonly conditions: FilterDefinition;
}

/** Группировка */
export interface GroupByStep {
  readonly type: 'group-by';
  readonly fields: readonly string[];
  readonly dateGrouping?: DateGrouping;
}

export interface DateGrouping {
  readonly field: string;
  readonly granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * Output field name: `${field}_${granularity}` by default.
   * E.g. dateGrouping { field: "date", granularity: "week" }
   *   → output field = "date_week" with values "2026-W16", "2026-W17", ...
   *   → original "date" field is preserved unchanged.
   */
  readonly outputField?: string;
}

/** Агрегация (после group-by) */
export interface AggregateStep {
  readonly type: 'aggregate';
  readonly columns: readonly AggregateColumn[];
}

export interface AggregateColumn {
  readonly sourceField: string;
  readonly outputName: string;
  readonly function: AggregationFunction;
}

/** Pivot: Long → Wide (обратная трансформация) */
export interface PivotStep {
  readonly type: 'pivot';
  readonly categoryField: string;      // Поле → столбцы
  readonly valueField: string;         // Значения в ячейках
  readonly aggregation: AggregationFunction;
}
```

**Конфигурация привязывается к виджету** (через `WidgetDefinition.transform` в §3.1), а не к DataFrame глобально — разные виджеты могут иметь разные трансформации одних данных.

> **Полная спецификация Pivot/Unpivot Pipeline** — см. `database-view-pivot.md`

---

## 3. Модульная система виджетов

### 3.1 Widget Interface

```typescript
// src/ui/views/Database/widgets/types.ts

export interface WidgetDefinition {
  readonly id: string;           // UUID
  readonly type: WidgetType;
  readonly title: string;
  readonly layout: WidgetLayout;
  readonly config: Record<string, unknown>;
  readonly collapsed?: boolean;
  readonly transform?: TransformPipeline;  // per-widget data transform (Pivot/Unpivot)
}

export type WidgetType =
  | 'data-table'
  | 'chart'
  | 'stats'
  | 'comparison'
  | 'checklist'
  | 'view-port';

export interface WidgetLayout {
  x: number;         // Grid column (0-based)
  y: number;         // Grid row (0-based)
  w: number;         // Width in grid units (1-12)
  h: number;         // Height in grid units (min 1)
  minW?: number;     // Minimum width
  minH?: number;     // Minimum height
}

export interface WidgetContext {
  readonly frame: DataFrame;
  readonly enrichedFrame: EnrichedDataFrame;
  readonly aggregations: AggregationResult;
  readonly viewApi: ViewApi;
  readonly readonly: boolean;
  readonly isTouch: boolean;        // CSS @media (pointer: coarse), NOT Platform.isMobile
}
```

### 3.2 Layout Grid System

Grid адаптируется через `@container` queries (Матрёшка §1.4), не `@media`:

```
@container canvas (min-width: 55rem):  12-column grid, gap: var(--ppp-space-md)
@container canvas (30rem – 55rem):      6-column grid, gap: var(--ppp-space-sm)
@container canvas (max-width: 30rem):   1-column stack, full width

┌────────────────────────────────────────────────────────────────┐
│ DatabaseViewCanvas                                              │
│ ┌──────────────────────────────────────────────────────────┐    │
│ │ DataTable Widget                          [w:12, h:8]   │    │
│ │ ┌──────┬──────┬──────┬──────┬──────┬──────┐             │    │
│ │ │ Name │Status│ Date │ Tags │Budget│Formula│             │    │
│ │ ├──────┼──────┼──────┼──────┼──────┼──────┤             │    │
│ │ │ ...  │ ...  │ ...  │ ...  │ ...  │ ...  │             │    │
│ │ ├──────┴──────┴──────┴──────┴──────┴──────┤             │    │
│ │ │ Σ 42 │      │      │      │ $12.5K│      │ ◄ Aggr Row │    │
│ │ └─────────────────────────────────────────┘             │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌───────────────────────┐ ┌──────────────────────────────────┐  │
│ │ Stats Widget [w:4,h:4]│ │ Chart Widget       [w:8, h:4]   │  │
│ │ ┌────────────────┐    │ │ ┌────────────────────────────┐   │  │
│ │ │ Total: 42      │    │ │ │  ▓▓▓                       │   │  │
│ │ │ Active: 28     │    │ │ │  ▓▓▓  ▓▓▓                 │   │  │
│ │ │ Overdue: 5     │    │ │ │  ▓▓▓  ▓▓▓  ▓▓▓            │   │  │
│ │ │ Done: 9        │    │ │ │  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓       │   │  │
│ │ └────────────────┘    │ │ └────────────────────────────┘   │  │
│ └───────────────────────┘ └──────────────────────────────────┘  │
│                                                                  │
│ ┌──────────────────────────────┐ ┌────────────────────────────┐ │
│ │ Checklist Widget   [w:6,h:3]│ │ ViewPort Widget  [w:6,h:3] │ │
│ │ ☑ Design spec done          │ │ ┌──────────────────────┐    │ │
│ │ ☑ Architecture review       │ │ │ Board: Sprint View   │    │ │
│ │ ☐ Implementation phase 1    │ │ │ ┌──┐ ┌──┐ ┌──┐      │    │ │
│ │ ☐ Testing                   │ │ │ │  │ │  │ │  │      │    │ │
│ └──────────────────────────────┘ │ └──────────────────────┘    │ │
│                                   └────────────────────────────┘ │
│                                                                  │
│ [+ Add Widget]  ← WidgetToolbar                                 │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Widget Toolbar — Добавление виджетов

```
┌────────────────────────────────────────────┐
│ [+ Add Widget]                              │
│                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │   Table  │ │  Chart  │ │  Stats  │        │
│ └─────────┘ └─────────┘ └─────────┘        │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │Compare  │ │ Checklist│ │ViewPort │        │
│ └─────────┘ └─────────┘ └─────────┘        │
│                                              │
│ Templates:                                   │
│  • Dashboard (table + chart + stats)         │
│  • Analytics (chart + comparison)            │
│  • Kanban+ (table + board port)              │
└────────────────────────────────────────────┘
```

### 3.4 Widget Resize & Drag

**Desktop**:
- Drag: хват за заголовок виджета → свободное перемещение по grid
- Resize: 8 ручек (углы + стороны), snap to grid
- Collision: push-модель — виджеты сдвигаются вниз при конфликте

**Mobile**:
- Drag: disabled, виджеты в stack-порядке
- Resize: только высота (swipe вниз на нижней границе)
- Reorder: long-press → drag в вертикальном списке

---

## 4. Модуль: DataTable (Расширенная таблица)

### 4.1 Что наследуется от Table View

Всё существующее ядро DataGrid — без потерь:
- Column drag-to-reorder (svelte-dnd-action)
- Column resize (Resizer.svelte)
- Cell editing (GridTypedCell — type dispatch)
- Column menus (configure, insert, pin, hide, delete)
- Row menus (edit, delete, open note)
- Keyboard navigation (arrow keys, activeCell)
- Field operations (add, rename, delete, reorder)

### 4.2 Новые возможности

#### 4.2.1 Aggregation Footer Row

Каждый столбец может показывать агрегацию в футере:

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Name     │ Status   │ Priority │ Budget   │ Due Date │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ Project A│ Active   │ High     │ 5000     │ 2026-05-01│
│ Project B│ Done     │ Medium   │ 3000     │ 2026-04-15│
│ Project C│ Active   │ Low      │ 8000     │ 2026-06-01│
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ Count: 3 │ 2 unique │          │ Σ 16,000 │ Range: 47d│  ← Aggregation Row
│  [▼]     │  [▼]     │  [▼]     │   [▼]    │   [▼]    │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Доступные функции агрегации по типу:**

| DataFieldType | Функции |
|---------------|---------|
| String        | `count`, `count_values`, `count_unique`, `percent_empty`, `percent_not_empty`, `none` |
| Number        | `sum`, `avg`, `median`, `min`, `max`, `range`, `count`, `percent_empty`, `percent_not_empty`, `none` |
| Boolean       | `count_checked`, `count_unchecked`, `percent_checked`, `percent_unchecked`, `count`, `none` |
| Date          | `earliest`, `latest`, `date_range`, `count`, `percent_empty`, `percent_not_empty`, `none` |
| List          | `count`, `count_values`, `count_unique_values`, `percent_empty`, `none` |

```typescript
// src/ui/views/Database/engine/aggregation.ts

/** Column-level aggregation for DataTable AggregationRow (footer). */
export type ColumnAggregation =
  | 'none'
  | 'count' | 'count_values' | 'count_unique'
  | 'sum' | 'avg' | 'median' | 'min' | 'max' | 'range'
  | 'count_checked' | 'count_unchecked'
  | 'percent_checked' | 'percent_unchecked'
  | 'percent_empty' | 'percent_not_empty'
  | 'earliest' | 'latest' | 'date_range';

export interface AggregationConfig {
  readonly [fieldName: string]: ColumnAggregation;
}

export interface AggregationResult {
  readonly [fieldName: string]: {
    readonly function: AggregationFunction;
    readonly value: string | number | null;
    readonly formattedValue: string;
  };
}

export function computeAggregations(
  frame: DataFrame,
  config: AggregationConfig
): AggregationResult;
```

#### 4.2.2 Inline Formula Columns (Derived Fields)

Пользователь создаёт "Formula" поле → вводит формулу → столбец вычисляется автоматически.

```
Add Field → Type: Formula → Expression: `prop("Budget") * 1.2`
                                         ↓
                              Колонка "Budget +20%" (derived: true, editable: false)
```

#### 4.2.3 Conditional Formatting

Ячейки могут менять цвет фона/текста на основе условий:

```typescript
export interface ConditionalFormat {
  readonly id: string;
  readonly field: string;
  readonly conditions: ConditionalFormatRule[];
}

export interface ConditionalFormatRule {
  readonly operator: FilterOperator;
  readonly value?: string;
  readonly style: CellStyle;
}

export interface CellStyle {
  readonly backgroundColor?: string;  // CSS color
  readonly textColor?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}
```

**Примеры:**
- `Budget > 10000` → зелёный фон
- `Status = "Overdue"` → красный текст, bold
- `Priority = "High"` → оранжевый фон

#### 4.2.4 Row Grouping

Группировка строк по значению поля:

```
┌──────────────────────────────────────────────────────────┐
│ ▼ Status: Active (28)                                     │
│ ┌──────────┬──────────┬──────────┐                        │
│ │ Project A│ High     │ 5000     │                        │
│ │ Project C│ Low      │ 8000     │                        │
│ └──────────┴──────────┴──────────┘                        │
│                                                           │
│ ▶ Status: Done (9)  ← collapsed                           │
│                                                           │
│ ▼ Status: Backlog (5)                                     │
│ ┌──────────┬──────────┬──────────┐                        │
│ │ ...      │ ...      │ ...      │                        │
│ └──────────┴──────────┴──────────┘                        │
└──────────────────────────────────────────────────────────┘
```

```typescript
export interface GroupConfig {
  readonly field: string;
  readonly sortOrder: 'asc' | 'desc' | 'manual';
  readonly hiddenGroups: string[];
  readonly collapsedGroups: string[];
  readonly showEmptyGroups: boolean;
}
```

#### 4.2.5 DataTable Full Config

```typescript
export interface DataTableConfig extends TableConfig {
  // Inherited from TableConfig
  fieldConfig?: FieldConfig;
  sortField?: string;
  sortAsc?: boolean;
  orderFields?: string[];
  // NEW v3.3.0
  aggregations?: AggregationConfig;
  groupBy?: GroupConfig;
  freezeUpTo?: string;            // Freeze all columns left of this
  conditionalFormats?: ConditionalFormat[];
  rowHeight?: 'compact' | 'default' | 'expanded';
  showAggregationRow?: boolean;
  wrapText?: boolean;
}
```

---

## 5. Модуль: FormulaBar (Визуальный конструктор формул)

### 5.1 Концепция: Visual Formula Stacking

Вместо текстового ввода формул — визуальный конструктор с drag-and-drop блоками:

```
┌────────────────────────────────────────────────────────────────┐
│ Formula Bar: "Budget Forecast"                                  │
│                                                                  │
│  ┌─────────────┐      ┌──────────┐      ┌──────────────────┐   │
│  │ prop("Budget")│ ──→ │    ×     │ ──→ │ IF               │   │
│  └─────────────┘      │          │      │ ┌──────────────┐ │   │
│                        │  1.2     │      │ │Status="Active"│ │   │
│                        └──────────┘      │ ├──────────────┤ │   │
│                                           │ │ THEN: result │ │   │
│                                           │ │ ELSE: 0      │ │   │
│                                           │ └──────────────┘ │   │
│                                           └──────────────────┘   │
│                                                                  │
│  Raw: IF(Status = "Active", Budget * 1.2, 0)                    │
│  Result preview: 6000                     [Apply] [Cancel]       │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Блоки формул

| Категория | Блоки |
|-----------|-------|
| **Properties** | Drag field name → creates `prop("fieldName")` |
| **Math** | `+`, `-`, `×`, `÷`, `^`, `%`, `()` |
| **Logic** | `IF`, `AND`, `OR`, `NOT`, `SWITCH`, `IFS` |
| **Compare** | `=`, `≠`, `>`, `<`, `≥`, `≤` |
| **Text** | `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `LOWER`, `UPPER`, `LENGTH`, `REPLACE`, `TRIM`, `FORMAT` |
| **Date** | `TODAY`, `NOW`, `DATE_ADD`, `DATE_SUB`, `DATE_BETWEEN`, `FORMAT_DATE`, `YEAR`, `MONTH`, `DAY` |
| **Aggregate** | `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`, `MEDIAN` (работают по relation/rollup) |
| **List** | `HAS_ANY_OF`, `HAS_ALL_OF`, `HAS_NONE_OF`, `LENGTH`, `JOIN`, `UNIQUE`, `INCLUDES` |
| **Constants** | Numbers, Strings, `TRUE`, `FALSE`, `PI`, `E` |

### 5.3 Dual Mode: Visual + Code

Переключатель между визуальным редактором и текстовым:

```
[Visual] [Code]              ← Toggle
─────────────────────────────
Visual: drag-and-drop blocks
Code:   IF(Status = "Active", Budget * 1.2, 0)
```

Оба режима синхронизированы — редактирование в одном обновляет другой.

### 5.4 Расширение Formula Engine

Новые функции (добавляются к существующим 27+ в formulaParser.ts):

```typescript
// Math
ROUND(value, decimals?) | CEIL(value) | FLOOR(value) | ABS(value)
SQRT(value) | POWER(base, exp) | LOG(value, base?) | SIGN(value)

// String
TRIM(text) | SPLIT(text, sep) | FORMAT(value) | SUBSTRING(text, start, end?)

// Date
YEAR(date) | MONTH(date) | DAY(date) | HOUR(date) | MINUTE(date) | WEEK(date)
DATE_BETWEEN(d1, d2, unit) | FORMAT_DATE(date, fmt) | PARSE_DATE(text)

// Type conversion
TO_NUMBER(value) | TO_TEXT(value) | TO_DATE(value)

// Relation/Rollup
RELATION_COUNT(field) | RELATION_LOOKUP(field, property)
ROLLUP_SUM(relField, prop) | ROLLUP_AVG(...) | ROLLUP_MIN(...) | ROLLUP_MAX(...)

// Conditional
IFS(cond1, val1, cond2, val2, ..., default) | EMPTY(value)
```

---

## 6. Модуль: ChartWidget (Визуализации)

### 6.1 Типы диаграмм

| Тип | Описание | Use Case |
|-----|----------|----------|
| Vertical Bar | Столбцы по X-axis группировке | Status distribution, count by category |
| Horizontal Bar | Горизонтальные столбцы | Ranking, comparison |
| Stacked Bar | Столбцы с sub-group стекированием | Status × Priority breakdown |
| Line | Линейная (multiple series) | Trend over time |
| Area | Линейная с заливкой | Cumulative progress |
| Pie / Donut | Круговая, с/без центрального значения | Proportions |
| Number (KPI) | Одно большое число с label | Key metric highlight |
| Progress | Горизонтальная шкала прогресса | Completion percentage |

### 6.2 Технология рендеринга: SVG-based

- **Почему SVG, не Canvas**: Accessibility (screen readers), CSS theme integration, print-friendly, zero deps
- **Размер**: ~50 строк SVG template на тип, 0 KB external libraries
- **Цвета**: CSS custom properties `--interactive-accent` + calculated stops
- **Тема**: автоматически из Obsidian dark/light mode

### 6.3 Chart Configuration

```typescript
export interface ChartConfig {
  readonly chartType: ChartType;
  readonly xAxis: {
    property: string;           // Field to group by
    sortBy: 'value' | 'label' | 'manual';
    sortOrder: 'asc' | 'desc';
    omitZero: boolean;
    visibleGroups?: string[];
    hiddenGroups?: string[];
  };
  readonly yAxis: {
    property: string | 'count'; // Field or 'count'
    aggregation: ColumnAggregation;
    groupBy?: string;           // Sub-grouping field
    cumulative?: boolean;
  };
  readonly style: {
    colorScheme: 'auto' | 'accent' | 'categorical' | 'sequential';
    height: 'small' | 'medium' | 'large';
    showGrid: boolean;
    showLabels: boolean;
    showLegend: boolean;
    showValues: boolean;
    smooth?: boolean;           // For line charts
    gradient?: boolean;         // For area charts
    showCenter?: boolean;       // For donut charts
  };
}
```

### 6.4 Chart Data Pipeline

Chart использует TransformPipeline (§2.4) внутри. Пользователь настраивает `ChartConfig` — плагин генерирует pipeline автоматически:

```
ChartConfig → buildChartPipeline(config) → TransformPipeline:
  [FILTER? → GROUP BY(xAxis) → AGGREGATE(yAxis)] → SubGroup? → Sort → Cumulative? → ChartData → SVG
```

`buildChartPipeline()` не дублирует логику — он конструирует объект `TransformPipeline`
и вызывает `executeTransform()` из `transformExecutor.ts`.

### 6.5 Drill-down

Клик по элементу диаграммы → показать таблицу записей этой группы (popover или inline expand).

---

## 7. Модуль: StatsWidget (KPI / Статистика)

### 7.1 Макет

```
┌────────────────────────────────────────┐
│ Stats Widget                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │    42     │ │    28    │ │   $16K   ││
│  │  Total    │ │  Active  │ │  Budget  ││
│  │  ▲ +3    │ │  ▼ -2   │ │  ▲ +12% ││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │    5     │ │   67%    │ │   14d    ││
│  │ Overdue  │ │ Complete │ │ Avg Time ││
│  │  ◆ same │ │  ▲ +5%  │ │  ▼ -2d  ││
│  └──────────┘ └──────────┘ └──────────┘│
└────────────────────────────────────────┘
```

### 7.2 Конфигурация

```typescript
export interface StatsConfig {
  readonly cards: StatsCard[];
  readonly columns: 2 | 3 | 4;
}

export interface StatsCard {
  readonly id: string;
  readonly label: string;
  readonly field: string;
  readonly aggregation: ColumnAggregation;
  readonly filter?: FilterCondition[];       // Optional subset filter
  readonly format?: 'number' | 'percent' | 'currency' | 'duration';
  readonly currencySymbol?: string;
  readonly showTrend?: boolean;
  readonly color?: string;
}
```

---

## 8. Модуль: ComparisonWidget (Модели сравнений)

### 8.1 Концепция

Визуальное сравнение подмножеств данных по выбранным метрикам.

```
┌─────────────────────────────────────────────────────────────┐
│ Comparison: Active vs Done                                    │
│           Active (28)          Done (9)                       │
│  Budget   ████████████ $12K    ████ $4K                      │
│  Priority  High: 15            High: 3                        │
│  Avg Days  ████████ 14d        ████████████ 21d              │
│  Tasks     ██████████ 45       ████████████████ 72           │
│  [Configure groups] [Add metric]                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Режимы сравнения

| Режим | Описание |
|-------|----------|
| **Side-by-Side** | Два фильтра → два столбца метрик |
| **Time-based** | Этот месяц vs предыдущий (по Date полю) |
| **Group-based** | По значению Select/Status поля |
| **Custom** | N произвольных фильтров |

```typescript
export interface ComparisonConfig {
  readonly mode: 'side-by-side' | 'time-based' | 'group-based' | 'custom';
  readonly groups: ComparisonGroup[];
  readonly metrics: ComparisonMetric[];
  readonly visualStyle: 'bars' | 'table' | 'radar';
}
```

---

## 9. Модуль: ChecklistWidget (Todo-листы)

### 9.1 Два режима работы

**Режим 1: Field-bound** — привязан к Boolean/checkbox полю записей
- Checkbox toggle → `api.updateRecord()` → frontmatter update
- Показывает label из title field + checkbox из target field

**Режим 2: Inline** — локальные todo-items (не в frontmatter)
- Хранятся в `DatabaseViewConfig.widgets[id].config.items[]`
- Не привязаны к записям проекта → чисто UI todo

```
┌─────────────────────────────────────────────┐
│ ☑️ Sprint Checklist                          │
│ Bound to: "Done" field (boolean)              │
│ ☑ Design spec — Project A                     │
│ ☑ Architecture review — Project A            │
│ ☐ Implementation phase 1 — Project B          │
│ ☐ Testing — Project C                         │
│ Progress: ████████░░░░ 40% (2/5)             │
└─────────────────────────────────────────────┘
```

```typescript
export interface ChecklistConfig {
  readonly mode: 'field-bound' | 'inline';
  readonly checkboxField?: string;      // Boolean field (field-bound)
  readonly labelField?: string;         // Title field for labels
  readonly filter?: FilterCondition[];
  readonly items?: ChecklistItem[];     // Inline mode
}
```

---

## 10. Модуль: ViewPortWidget (Мини-окна)

### 10.1 Концепция

Порт (мини-окно) в другой настроенный view пользователя — мост между Database View и Board/Calendar/Gallery.

```
┌─────────────────────────────────────────┐
│ Board: Sprint Kanban                 [↗]│
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │To Do │ │In Prg│ │Review│ │Done  │    │
│ ├──────┤ ├──────┤ ├──────┤ ├──────┤    │
│ │Card A│ │Card C│ │Card E│ │Card G│    │
│ │Card B│ │Card D│ │Card F│ │      │    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
│ [↗] — open in full view                 │
└─────────────────────────────────────────┘
```

### 10.2 Как работает

1. Пользователь выбирает project + view из существующих настроек
2. ViewPortWidget рендерит view read-only в уменьшенном масштабе
3. Кнопка [↗] переключает на полный view (навигация)
4. Использует тот же DataFrame если тот же проект

### 10.3 Ограничения

- ViewPort рендерит **только** существующие view types (board, calendar, gallery)
- Рекурсия запрещена: ViewPort не может содержать ViewPort
- На мобильных: ViewPort всегда read-only
- Максимум 4 ViewPort виджета на один DatabaseView

```typescript
export interface ViewPortConfig {
  readonly targetProjectId: string;
  readonly targetViewId: string;
  readonly interactionMode: 'read-only' | 'interactive';
  readonly scale: number;            // 0.5 - 1.0
  readonly showToolbar: boolean;
}
```

---

## 11. Типы данных — Расширения v3.3.0

### 11.1 Расширение DataFieldType

```typescript
export enum DataFieldType {
  // Existing
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Date = "date",
  List = "multitext",
  Unknown = "unknown",
  // NEW v3.3.0
  Formula = "formula",      // Computed from expression
  Relation = "relation",    // Wiki-link references
  Rollup = "rollup",        // Aggregation over relations
  Select = "select",        // Single-select with color options
  Status = "status",        // Status with groups (To-do, In Progress, Done)
}
```

### 11.2 Маппинг на frontmatter

| Новый тип | Frontmatter | Пример |
|-----------|-------------|--------|
| Formula | НЕ хранится (computed) | `derived: true` |
| Relation | `field: "[[Note A]]"` или `["[[A]]", "[[B]]"]` | YAML list of wiki-links |
| Rollup | НЕ хранится (computed) | `derived: true` |
| Select | `field: "Option A"` | String + options в fieldConfig |
| Status | `field: "In Progress"` | String + groups в fieldConfig |

### 11.3 Relation — Wiki-link Resolution

```typescript
export class RelationResolver {
  resolve(
    record: DataRecord,
    field: DataField,
    allRecords: Map<string, DataRecord>
  ): DataRecord[];
}
// Алгоритм:
// 1. Extract [[...]] patterns from field value
// 2. Normalize: [[path/note|display]] → path/note.md
// 3. Lookup in allRecords by file path
// 4. Return matched DataRecord[]
```

### 11.4 Rollup Config

```typescript
// в fieldConfig проекта
{
  "totalTaskBudget": {
    "type": "rollup",
    "relationField": "tasks",  // Relation field to iterate
    "targetField": "budget",   // Field on related records
    "function": "sum"          // Aggregation function
  }
}
```

### 11.5 Backward Compatibility

Существующие String/Number/Boolean/Date/List поля работают без изменений.
Новые типы — opt-in через `fieldConfig[field].type`.
Без `fieldConfig[field].type` → автоопределение из значения (существующая логика).

---

## 12. Configuration — DatabaseViewConfig

### 12.1 Полная структура

```typescript
export interface DatabaseViewConfig {
  readonly widgets: WidgetDefinition[];
  readonly layoutMode: 'free' | 'stack';    // free = grid, stack = 1-column
  readonly layoutVersion: number;

  readonly table: DataTableConfig;          // Primary table widget config

  readonly showWidgetToolbar: boolean;
  readonly compactMode: boolean;
}
```

### 12.2 Migration: TableConfig → DatabaseViewConfig

```typescript
export function migrateTableConfig(old: TableConfig): DatabaseViewConfig {
  return {
    widgets: [{
      id: generateId(),
      type: 'data-table',
      title: 'Table',
      layout: { x: 0, y: 0, w: 12, h: 8 },
      config: {},
      collapsed: false
    }],
    layoutMode: 'stack',
    layoutVersion: 1,
    table: {
      fieldConfig: old.fieldConfig,
      sortField: old.sortField,
      sortAsc: old.sortAsc,
      orderFields: old.orderFields,
      aggregations: {},
      showAggregationRow: false,
    },
    showWidgetToolbar: false,
    compactMode: false,
  };
}
```

---

## 13. UX-сценарии использования

### 13.1 Сценарий 1: PM — Sprint Dashboard

**Персона**: PM, 50 задач в спринте

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Открывает Database View | Таблица (мигрированный Table View) |
| 2 | [+ Widget] → Stats | 4 KPI-карточки: Total, Active, Done, Overdue |
| 3 | [+ Widget] → Chart → Donut | Status distribution |
| 4 | [+ Widget] → ViewPort → Board | Sprint Kanban в мини-окне |
| 5 | Resize виджетов | table 12/4h, stats 4/3h, chart 4/3h, board 4/3h |

### 13.2 Сценарий 2: Researcher — Data Analysis

**Персона**: Исследователь, 200 заметок с метаданными

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Таблица + aggregation row | Count записей, Avg Rating |
| 2 | Chart → Line | Publications per month |
| 3 | Formula column | `IF(rating >= 4, "High Quality", "Review")` |
| 4 | Conditional formatting | rating < 3 → красный фон |
| 5 | Group by "source" | Группировка по источникам |

### 13.3 Сценарий 3: Студент — Course Tracker

**Персона**: Студент, 30 курсов, оценки, прогресс

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Checklist Widget | field-bound → "completed" boolean |
| 2 | Stats | Avg grade, Completed %, Total credits |
| 3 | Chart → Progress | % completed по семестрам |
| 4 | Comparison | This semester vs Last semester |

### 13.4 Сценарий 4: Freelancer — Client & Finance

**Персона**: Фрилансер, клиенты, бюджеты

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Relation | Project → Client `[[ClientName]]` |
| 2 | Rollup | Client → Total Revenue (SUM of projects' Budget) |
| 3 | Formula | "Hourly Rate" = Budget / Hours |
| 4 | Aggregation row | SUM(Budget), AVG(Hourly Rate) |
| 5 | Chart | Revenue per client (bar), per month (line) |

### 13.5 Сценарий 5: Mobile User — Quick Review

| Шаг | Platform | Поведение |
|-----|----------|-----------|
| 1 | Mobile | Layout → stack mode |
| 2 | Table | Горизонтальный скролл, frozen Name column |
| 3 | Stats | 3 KPI в одну строку |
| 4 | Checklist | Swipe to complete → haptic feedback |
| 5 | ViewPort | Скрыт (слишком тяжёлый для mobile) |

### 13.6 Сценарий 6: Power User — RICE Score

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 1 | Formula field | `(Reach * Impact * Confidence) / Effort` |
| 2 | FormulaBar | Visual mode → drag blocks |
| 3 | Preview | Результат для каждой строки |
| 4 | Apply + Sort | Sort by RICE desc → top priorities |

---

## 14. Mobile-специфика

### 14.1 Layout Adaptation

```
Desktop (≥768px)         Mobile (<768px)
┌──────┬──────┐          ┌────────────────┐
│Table │Stats │          │ Table (scroll) │
│      │      │          ├────────────────┤
├──────┼──────┤    →     │ Stats          │
│Chart │Todo  │          ├────────────────┤
└──────┴──────┘          │ Chart          │
                          ├────────────────┤
                          │ Checklist      │
                          └────────────────┘
```

### 14.2 Touch Interactions

| Action | Gesture | Effect |
|--------|---------|--------|
| Collapse widget | Tap header | Toggle collapsed |
| Reorder widgets | Long-press → drag | Move in stack |
| Resize height | Swipe down on edge | Grow/shrink |
| Table scroll | Pan-x | Scroll columns (freeze first) |
| Chart drill-down | Tap bar/slice | Show filtered records |
| Checklist toggle | Tap checkbox | Toggle + haptic |
| ViewPort open | Tap [↗] | Navigate to full view |

### 14.3 Virtual Scrolling (>100 rows)

- Render only visible rows + buffer (10 above, 10 below)
- Row height: fixed 2.25rem (compact), 3rem (default), 4.5rem (expanded)
- Container: `overflow-y: auto` + intersection observer

---

## 15. Фазы реализации

> Все фазы укладываются в версию **v3.3.x**. Visual Formula Stacking отложен в v3.3.x-post (backlog), но не выходит за v3.3.

### Phase 1: Foundation (v3.3.0-alpha)

**Цель**: Widget infrastructure + DataTable + TransformPipeline types

1. `DatabaseViewType` (extends ProjectView) + регистрация
2. `DatabaseViewCanvas.svelte` — grid layout container (Матрёшка + container queries)
3. `WidgetHost.svelte` — resize, collapse, drag (desktop)
4. `DataTable.svelte` — refactored DataGrid с aggregation row
5. `ColumnAggregationEngine` — compute column summaries (footer)
6. `TransformPipeline` types + `executeTransform()` executor
7. `UNPIVOT` + `COMPUTE` steps реализация
8. Config migration: TableConfig → DatabaseViewConfig
9. Mobile: stack layout
10. Тесты: ColumnAggregationEngine, config migration, UNPIVOT, COMPUTE

### Phase 2: Formula & Types (v3.3.0-beta.1)

**Цель**: Extended field types + formula editor + full pipeline

1. Select / Status field types + cell renderers
2. FormulaField + inline computed columns
3. FormulaBar.svelte — code mode (text editor + autocomplete + preview)
4. Extended formulaParser.ts — new functions
5. Conditional formatting engine + CSS
6. Row grouping (GroupBy)
7. `GROUP BY` + `AGGREGATE` + `FILTER` pipeline steps
8. Transform Pipeline Editor UI (basic)
9. Тесты: formula extensions, Select/Status, GROUP BY, AGGREGATE

### Phase 3: Visualization (v3.3.0-beta.2)

**Цель**: Charts + Stats + PIVOT

1. SVG chart rendering (internal, no deps)
2. ChartWidget.svelte — bar, line, pie/donut, number
3. `buildChartPipeline()` — Chart использует TransformPipeline
4. StatsWidget.svelte — KPI cards
5. `PIVOT` step реализация
6. Full aggregation function set (MEDIAN, STD_DEV, etc.)
7. Transform caching + invalidation
8. Chart configuration UI
9. Тесты: chart data pipeline, SVG snapshots, PIVOT, caching

### Phase 4: Relations & Advanced (v3.3.0-beta.3)

**Цель**: Relations, Rollups, Comparison, Checklist

1. RelationResolver — wiki-link → DataRecord resolution
2. Relation field type + cell renderer (clickable chips)
3. RollupEngine — aggregation over relation targets
4. Rollup field type + cell renderer
5. ComparisonWidget.svelte
6. ChecklistWidget.svelte
7. Тесты: RelationResolver, RollupEngine

### Phase 5: ViewPort & Polish (v3.3.0-rc)

**Цель**: ViewPort, mobile, performance, Visual Formula Stacking (backlog)

1. ViewPortWidget.svelte — embedded view rendering
2. Virtual scrolling for >100 rows
3. Mobile layout polish
4. Widget templates (Dashboard, Analytics, Kanban+)
5. Accessibility: ARIA roles, keyboard nav
6. Performance profiling + optimization
7. Visual Formula Stacking mode for FormulaBar (toggle Code/Visual)
8. E2E: full workflow testing

---

## 16. Файловая структура (target)

```
src/ui/views/Database/
├── databaseView.ts                    ← ProjectView<DatabaseViewConfig>
├── DatabaseViewCanvas.svelte          ← Main container
├── types.ts                           ← All Database View types
├── migration.ts                       ← TableConfig → DatabaseViewConfig
│
├── widgets/
│   ├── types.ts                       ← WidgetDefinition, WidgetType, WidgetContext
│   ├── WidgetHost.svelte              ← Generic widget wrapper
│   ├── WidgetToolbar.svelte           ← Add widget panel
│   ├── widgetRegistry.ts              ← Widget type → component mapping
│   │
│   ├── DataTable/
│   │   ├── DataTable.svelte           ← Enhanced table
│   │   ├── AggregationRow.svelte      ← Footer aggregations
│   │   ├── GroupHeader.svelte         ← Row grouping header
│   │   ├── ConditionalFormat.ts       ← Cell formatting engine
│   │   └── components/               ← Reuse GridCell/* components
│   │
│   ├── FormulaBar/
│   │   ├── FormulaBar.svelte          ← Visual formula editor
│   │   ├── FormulaBlock.svelte        ← Draggable formula block
│   │   └── FormulaPreview.svelte      ← Live result preview
│   │
│   ├── Chart/
│   │   ├── ChartWidget.svelte         ← Chart container
│   │   ├── ChartConfig.svelte         ← Configuration panel
│   │   ├── BarChart.svelte            ← SVG bar chart
│   │   ├── LineChart.svelte           ← SVG line chart
│   │   ├── PieChart.svelte            ← SVG pie/donut
│   │   ├── NumberChart.svelte         ← KPI number display
│   │   └── chartDataPipeline.ts       ← Data → ChartData transform
│   │
│   ├── Stats/
│   │   ├── StatsWidget.svelte         ← KPI cards grid
│   │   └── StatsCard.svelte           ← Individual card
│   │
│   ├── Comparison/
│   │   ├── ComparisonWidget.svelte    ← Comparison container
│   │   └── ComparisonBar.svelte       ← Bar visualization
│   │
│   ├── Checklist/
│   │   ├── ChecklistWidget.svelte     ← Container
│   │   └── ChecklistItem.svelte       ← Individual item
│   │
│   └── ViewPort/
│       ├── ViewPortWidget.svelte      ← Embedded view
│       └── ViewPortSelector.svelte    ← Project/View picker
│
├── engine/
│   ├── aggregation.ts                 ← ColumnAggregationEngine (footer)
│   ├── aggregation.test.ts
│   ├── transformTypes.ts              ← TransformPipeline + step types
│   ├── transformExecutor.ts           ← executeTransform() pipeline runner
│   ├── transformExecutor.test.ts
│   ├── aggregationFunctions.ts        ← Pipeline AggregationFunction impl
│   ├── aggregationFunctions.test.ts
│   ├── relationResolver.ts            ← Wiki-link resolver
│   ├── relationResolver.test.ts
│   ├── rollup.ts                      ← RollupEngine
│   ├── rollup.test.ts
│   ├── chartPipeline.ts              ← buildChartPipeline() → TransformPipeline
│   ├── chartPipeline.test.ts
│   ├── conditionalFormat.ts          ← Cell formatting logic
│   └── conditionalFormat.test.ts
│
└── __tests__/
    ├── migration.test.ts
    └── integration.test.ts
```

---

## 17. Риски и mitigation

| Риск | Вероятность | Импакт | Mitigation |
|------|-------------|--------|------------|
| Bundle size blowup | Средняя | Высокий | Lazy import виджетов, tree-shaking |
| Performance: 1000+ records + formula | Высокая | Высокий | Memoization, Web Worker, debounce |
| Mobile widget drag complexity | Средняя | Средний | Stack-only на mobile |
| Wiki-link N+1 resolution | Высокая | Средний | Batch resolution, path index, cache |
| Config migration data loss | Низкая | Высокий | Unit tests, fallback to default |
| Svelte 3 reactivity in nested widgets | Средняя | Средний | Widget isolation через context API |
| ObsidianReviewBot rejection | Средняя | Высокий | Incremental PRs, lint/type gates |

---

## 18. Метрики успеха

| Метрика | Target | Измерение |
|---------|--------|-----------|
| Initial render (1000 records) | <100ms | Performance test |
| TransformPipeline (1000 input, 6 steps) | <500ms | Performance test |
| TransformPipeline absolute timeout | 2000ms | Failsafe (cancel + error) |
| Cell input latency | <16ms | rAF timing |
| Formula eval (1000 × 5 formulas) | <50ms | Performance test |
| Bundle size delta | <150KB gzipped | esbuild-bundle-analyzer |
| Test coverage new code | >80% | jest --coverage |
| Accessibility | WCAG 2.1 AA | axe-core |

---

## 19. Зависимости

### Без новых npm-пакетов

| Что нужно | Решение |
|-----------|---------|
| Charts | Pure SVG в Svelte templates |
| Grid layout | CSS Grid + custom resize |
| Formula | Расширение formulaParser.ts |
| DnD widgets | svelte-dnd-action (уже есть) |
| Dates | dayjs (уже есть) |

### Реиспользование из проекта

| Что | Откуда |
|-----|--------|
| GridCell/* cell renderers | Table/DataGrid |
| filterFunctions.ts | ui/app |
| formulaParser.ts | lib/helpers |
| ViewApi, DataApi | lib |
| svelte-dnd-action | ui/views/Board |
| CSS tokens | ui/tokens |

---

## 20. Obsidian Community Guidelines Compliance

Checklist верификации спецификации Database View v3.3.0 на соответствие [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines):

| Правило | Статус | Комментарий |
|---------|--------|-------------|
| `Vault.process()` для модификации файлов | ✅ | Уже используется в `filesystem.ts` |
| Нет `innerHTML`/`outerHTML` | ✅ | Svelte template rendering |
| Нет `window.app` / global `app` | ✅ | Только `this.app` через Plugin class |
| `registerEvent()` для подписок | ✅ | Все события через `plugin.registerEvent()` |
| `normalizePath()` для пользовательских путей | ✅ | Используется во всех файловых операциях |
| Нет regex lookbehind `(?<=` | ✅ | UNPIVOT patterns: только `(\d+)`, lookbehind запрещён в `safeRegexExec()` (pivot §9.3) |
| `const`/`let` вместо `var` | ✅ | Enforced by ESLint |
| `async`/`await` вместо `.then()` | ✅ | Стандарт кодовой базы |
| CSS variables, не hardcoded стили | ✅ | Матрёшка design system (§1.5) |
| Sentence case в UI тексте | ✅ | "Add widget", "Configure transform..." |
| CTA rightmost (Primary action) | ✅ | `[Cancel] [Save]` — Save справа |
| `minAppVersion: 1.5.7` | ⚠️ | Проверить, что все API Database View доступны на 1.5.7 |
| `getActiveViewOfType()` вместо `activeLeaf` | ✅ | `activeLeaf` не используется |
| Нет default hotkeys | ✅ | Database View не регистрирует hotkeys |

---

## 21. Глоссарий

| Термин | Определение |
|--------|-------------|
| **Widget** | Независимый модуль UI в Database View |
| **WidgetHost** | Обёртка виджета (resize, drag, collapse) |
| **DataTable** | Расширенная таблица (основной виджет) |
| **Aggregation** | Итоговое значение по столбцу (SUM, AVG...) |
| **ColumnAggregation** | Тип агрегации для footer row DataTable |
| **AggregationFunction** | Тип агрегации для TransformPipeline (UPPERCASE) |
| **TransformPipeline** | Per-widget конвейер трансформации данных (UNPIVOT/COMPUTE/FILTER/GROUP BY/AGGREGATE/PIVOT) |
| **Formula Field** | Вычисляемое поле, формула в fieldConfig |
| **Relation** | Поле с wiki-links, resolving в DataRecord |
| **Rollup** | Агрегация по значениям связанных записей |
| **ViewPort** | Мини-окно в другой view из проекта |
| **Enriched DataFrame** | DataFrame + relations + rollups |
| **Visual Stacking** | Drag-and-drop конструктор формул |
| **Conditional Format** | Цвет ячейки на основе значения |

---

## 22. v3.4.0 — Архитектурные решения (Wave 4–5)

### 22.1 Multi-Source Merge (A1)

Реализован механизм объединения данных из нескольких источников (folder, tag, Dataview).

**Архитектура:**
```
ProjectDefinition.additionalSources?: DataSource[]
    ↓
DataFrameProvider: Promise.all([primary, ...additional])
    ↓
mergeDataFrames(frames: DataFrame[]): DataFrame
    ↓
Union fields by name (first wins type), concat records, dedup by id
```

**Файлы:** `settings/v3/settings.ts`, `lib/datasources/mergeFrames.ts`, `ui/app/DataFrameProvider.svelte`

### 22.2 Recursive FormulaNode (U11)

Визуальный редактор формул переработан: рекурсивный компонент `FormulaNode.svelte` использует `<svelte:self>` для отображения AST неограниченной глубины вложенности.

**До:** Захардкоженный 2-уровневый шаблон в FormulaVisualEditor.svelte
**После:** FormulaVisualEditor → FormulaNode (рекурсия через `<svelte:self>`)

**CSS scoping:** Родительские стили переведены на `.ppp-vblock-tree :global(...)` для применения к дочерним компонентам (ограничение Svelte 3).

### 22.3 Formula Autocomplete Keyboard Navigation (U9)

FormulaBar.svelte — добавлена полноценная навигация клавиатурой:
- `ArrowUp/Down` — перемещение по подсказкам с wrap-around
- `Enter` — выбор выделенной подсказки
- `Tab` — выбор текущей/первой подсказки
- `role="listbox"`, `role="option"`, `aria-selected` — ARIA listbox pattern
- Scroll-into-view для выделенного элемента

### 22.4 ARIA Tab Roving (U5)

Все tab-like компоненты приведены к полному WAI-ARIA tabs pattern:
- **SettingsMenuTabs** — добавлены `tabindex`, `ArrowLeft/Right`, `Home/End`, `Space/Enter`
- **ViewSwitcher** — расширен `Home/End`, `Space/Enter`
- **FilterTabsWidget** — расширен `Home/End`, `Space/Enter`

### 22.5 DataGrid ARIA Grid Pattern (U7)

- `role="grid"` + `aria-label` на контейнере DataGrid
- `aria-rowindex` добавлен на GridCell (ранее отсутствовал)
- Роли `columnheader`, `rowheader`, `gridcell` уже присутствовали
- Keyboard navigation (Arrow keys, Tab wrap, Enter/Escape edit) уже была реализована ранее

### 22.6 Touch Visibility (U14)

`@media (pointer: coarse)` в WidgetHost.svelte — кнопки удаления, pipeline, type badge видны всегда на touch-устройствах (ранее требовали hover).

### 22.7 Pipeline Dirty State (U10)

PipelineEditor.svelte — отслеживание несохранённых изменений:
- `isDirty` — реактивное сравнение `JSON.stringify(steps)` vs original
- Баннер «⚠ Unsaved changes» при dirty state
- Confirmation dialog при отмене с несохранёнными изменениями: «Discard / Keep editing»

### 22.8 Widget Resize Handles (use:resizable)

Новый Svelte action `resizable.ts` — перетаскивание правого нижнего угла для изменения размера виджета в grid.

**Механика:**
- Pointer events на resize handle (div, injected action'ом)
- Измерение cellWidth/cellHeight из текущих размеров элемента
- Live preview через inline `grid-column`/`grid-row`
- При завершении — callback `onResize(w, h)` → `configChange` dispatch
- Min constraints из `widgetRegistry` meta
- Визуальный feedback: dashed outline during resize
- Touch: увеличенный handle (1.5rem), opacity 0.5 постоянно
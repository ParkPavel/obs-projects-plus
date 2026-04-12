# Database View v3.3.0 — Pivot / Unpivot Pipeline

> **Статус**: DRAFT v1.0 | **Дата**: 2026-04-12
> **Родительский документ**: `architecture-database-view.md` (раздел 2.4)
> **Область**: Трансформация данных между DataFrame и виджетами

---

## Содержание

- [1. Проблема](#1-проблема)
- [2. Концепция TransformPipeline](#2-концепция-transformpipeline)
- [3. Шаги трансформации](#3-шаги-трансформации)
- [4. Полный пример: дневник тренировок](#4-полный-пример-дневник-тренировок)
- [5. TypeScript API](#5-typescript-api)
- [6. Конфигурация UI](#6-конфигурация-ui)
- [7. Интеграция с виджетами](#7-интеграция-с-виджетами)
- [8. Performance и кэширование](#8-performance-и-кэширование)
- [9. Ограничения и edge cases](#9-ограничения-и-edge-cases)
- [10. Фазы реализации](#10-фазы-реализации)

---

## 1. Проблема

### 1.1 "Широкий" YAML — типичная проблема

Obsidian хранит данные в YAML frontmatter. Каждая заметка = одна строка в DataFrame. Пользователи часто структурируют повторяющиеся данные через нумерованные поля:

```yaml
# Тренировка 2026-04-01.md
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

```yaml
# Бюджет Апрель 2026.md
---
date: 2026-04-01
category1: "Rent"
amount1: 1500
category2: "Food"
amount2: 600
category3: "Transport"
amount3: 150
category4: "Entertainment"
amount4: 200
---
```

```yaml
# Прогресс учёбы.md
---
date: 2026-04-01
subject1: "Math"
score1: 85
hours1: 3
subject2: "Physics"
score2: 72
hours2: 2
subject3: "English"
score3: 91
hours3: 1.5
---
```

### 1.2 Почему это проблема

Без трансформации DataFrame выглядит так (одна строка = одна заметка):

| date | exercise1 | weight1 | sets1 | reps1 | exercise2 | weight2 | sets2 | reps2 | ... |
|------|-----------|---------|-------|-------|-----------|---------|-------|-------|-----|
| 2026-04-01 | Bench Press | 80 | 4 | 10 | Squat | 120 | 5 | 8 | ... |
| 2026-04-03 | Bench Press | 82.5 | 4 | 10 | Deadlift | 145 | 3 | 5 | ... |

**Невозможно:**
- Отфильтровать "все записи Bench Press"
- Отсортировать по весу (какому? weight1? weight2? weight3?)
- Построить график "прогресс веса по упражнению за месяц"
- Вычислить SUM(weight × sets × reps) per exercise
- Создать сводную таблицу exercise × month → average weight

### 1.3 Текущие ограничения кодовой базы

1. **parseRecords()** (`src/lib/datasources/helpers.ts:48-52`): вложенные YAML-объекты конвертируются в строки через `JSON.stringify()` — поля flat-only
2. **evaluateFormula()** (`src/lib/helpers/formulaParser.ts`): работает с ОДНОЙ записью — нет доступа к другим записям, нет агрегации
3. **DataValue** type: `string | number | boolean | Date | Array` — объекты не поддерживаются
4. **Нет GROUP BY / AGGREGATE** — в текущем коде отсутствуют любые функции агрегации

---

## 2. Концепция TransformPipeline

### 2.1 Место в архитектуре

```
┌──────────────────────────────────────────────────────────────┐
│                         DATA FLOW                            │
│                                                              │
│  YAML frontmatter                                            │
│       ↓                                                      │
│  decodeFrontMatter() → standardizeRecord()                   │
│       ↓                                                      │
│  detectFields() + detectCellType() + parseRecords()          │
│       ↓                                                      │
│  ┌──────────────────────────────────┐                        │
│  │          RAW DataFrame           │ ← Общий для всех       │
│  │  (одна строка = одна заметка)    │   виджетов             │
│  └──────────────┬───────────────────┘                        │
│                 │                                             │
│     ┌───────────┴────────────┐                               │
│     │                        │                               │
│     ▼                        ▼                               │
│  Widget A                 Widget B                           │
│  (no transform)           (has TransformPipeline)            │
│     │                        │                               │
│     │                  ┌─────┴───────────────────────┐       │
│     │                  │  1. UNPIVOT                  │       │
│     │                  │  2. COMPUTE                  │       │
│     │                  │  3. FILTER                   │       │
│     │                  │  4. GROUP BY                 │       │
│     │                  │  5. AGGREGATE                │       │
│     │                  │  6. PIVOT (optional)         │       │
│     │                  │          ↓                   │       │
│     │                  │  Transformed DataFrame       │       │
│     │                  └─────────────────────────────┘       │
│     │                        │                               │
│     ▼                        ▼                               │
│  Display raw data       Display transformed data             │
│  (DataTable)            (Chart / Stats / DataTable)          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Ключевые принципы:**

1. **Per-widget**: TransformPipeline привязан к виджету, не к DataFrame глобально. Разные виджеты одного проекта могут видеть одни данные по-разному.

2. **Immutable**: Pipeline НЕ модифицирует исходный DataFrame — создаёт новый.

3. **Lazy**: Pipeline вычисляется при рендере виджета, кэшируется до изменения source data или конфигурации.

4. **Composable**: Шаги — независимые функции `(DataFrame) → DataFrame`, соединяются pipe-style.

### 2.2 Поток данных через Pipeline

```
Input:  DataFrame (N records, M fields)
         │
         ├─ Step 1: UNPIVOT
         │    в: N records × M fields
         │    из: N×K records × P fields   (K = количество групп в каждой записи)
         │
         ├─ Step 2: COMPUTE
         │    добавляет вычисляемые столбцы
         │    в: N×K records × P fields
         │    из: N×K records × (P + computed) fields
         │
         ├─ Step 3: FILTER
         │    удаляет строки по условию
         │    в: N×K records
         │    из: ≤ N×K records
         │
         ├─ Step 4: GROUP BY
         │    группирует строки
         │    в: filtered records
         │    из: G groups (G ≤ records)
         │
         ├─ Step 5: AGGREGATE
         │    вычисляет агрегаты по группам
         │    в: G groups
         │    из: G records с агрегированными значениями
         │
         └─ Step 6: PIVOT (optional)
              разворачивает категории в столбцы
              в: G records
              из: R records × C+value columns

Output: Transformed DataFrame
```

---

## 3. Шаги трансформации

### 3.1 UNPIVOT (Melt)

**Цель**: Преобразовать "широкую" таблицу в "длинную" — повторяющиеся группы полей становятся отдельными записями.

**Вход**: DataFrame + FieldGroup[] + keepFields[]

**FieldGroup** определяет набор полей, которые формируют одну "строку":

```
Поля в YAML:     exercise1, weight1, sets1, reps1,
                  exercise2, weight2, sets2, reps2,
                  exercise3, weight3, sets3, reps3

FieldGroups:
  { pattern: "exercise(\\d+)", outputName: "exercise" }
  { pattern: "weight(\\d+)",   outputName: "weight" }
  { pattern: "sets(\\d+)",     outputName: "sets" }
  { pattern: "reps(\\d+)",     outputName: "reps" }

keepFields: ["date"]  ← Поля, которые копируются в каждую "развёрнутую" строку
```

**Алгоритм:**

```
Для каждой записи (record):
  1. Найти все совпадения каждого pattern → группы по index (1, 2, 3...)
  2. Для каждого index:
     - Создать новую запись
     - Скопировать keepFields из оригинала
     - Для каждого FieldGroup: взять значение field{index} → outputName
     - Добавить _source_record = record id (для traceability)
     - Добавить _group_index = index (для отладки)
  3. Пропустить index, если ВСЕ поля группы пустые (null/undefined/"")
```

**Результат:**

```
До (2 записи, 13 полей):
| date       | exercise1   | weight1 | sets1 | reps1 | exercise2 | weight2 | sets2 | reps2 | exercise3 | weight3 | sets3 | reps3 |
|------------|-------------|---------|-------|-------|-----------|---------|-------|-------|-----------|---------|-------|-------|
| 2026-04-01 | Bench Press | 80      | 4     | 10    | Squat     | 120     | 5     | 8     | Deadlift  | 140     | 3     | 5     |
| 2026-04-03 | Bench Press | 82.5    | 4     | 10    | Deadlift  | 145     | 3     | 5     | null      | null    | null  | null  |

После (5 записей, 7 полей):
| date       | exercise    | weight | sets | reps | _source_record | _group_index |
|------------|-------------|--------|------|------|----------------|-------------|
| 2026-04-01 | Bench Press | 80     | 4    | 10   | 2026-04-01.md  | 1           |
| 2026-04-01 | Squat       | 120    | 5    | 8    | 2026-04-01.md  | 2           |
| 2026-04-01 | Deadlift    | 140    | 3    | 5    | 2026-04-01.md  | 3           |
| 2026-04-03 | Bench Press | 82.5   | 4    | 10   | 2026-04-03.md  | 1           |
| 2026-04-03 | Deadlift    | 145    | 3    | 5    | 2026-04-03.md  | 2           |
```

Заметка 2026-04-03 имела exercise3=null → строка 3 пропущена.

### 3.2 COMPUTE

**Цель**: Добавить вычисляемые столбцы на основе существующих (в рамках одной строки).

**Вход**: DataFrame + ComputedColumn[]

```typescript
interface ComputedColumn {
  name: string;           // "volume"
  expression: string;     // "weight * sets * reps"
}
```

**Механизм**: Использует существующий `evaluateFormula()` (single-record scope) с адаптацией — expression парсится в AST, вычисляется для каждой строки.

**Результат** (добавляется столбец volume):

```
| date       | exercise    | weight | sets | reps | volume |
|------------|-------------|--------|------|------|--------|
| 2026-04-01 | Bench Press | 80     | 4    | 10   | 3200   |
| 2026-04-01 | Squat       | 120    | 5    | 8    | 4800   |
| 2026-04-01 | Deadlift    | 140    | 3    | 5    | 2100   |
| 2026-04-03 | Bench Press | 82.5   | 4    | 10   | 3300   |
| 2026-04-03 | Deadlift    | 145    | 3    | 5    | 2175   |
```

### 3.3 FILTER

**Цель**: Отобрать строки по условию.

**Вход**: DataFrame + FilterDefinition (переиспользует существующий `filterFunctions.ts`)

Пример: `exercise = "Bench Press"` или `date >= 2026-04-01 AND date <= 2026-04-30`

Интеграция:
- Для простых фильтров → используем текущий FilterEngine (isString, isNumber operators)
- Для Transform-специфичных → добавляем оператор "in group" (выбрать конкретные группы из unpivot)

### 3.4 GROUP BY

**Цель**: Сгруппировать строки по одному или нескольким полям для последующей агрегации.

**Вход**: DataFrame + groupFields[] + dateGrouping?

```typescript
interface GroupByConfig {
  fields: string[];                // ["exercise"]
  dateGrouping?: {
    field: string;                 // "date"
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
}
```

**Алгоритм:**

```
1. Для каждой записи вычислить group key:
   key = JSON.stringify({
     [field]: record[field],        // для каждого field в fields
     [dateField]: truncateDate(record[dateField], granularity)
   })

2. Собрать записи в Map<string, DataRecord[]>

3. Для dateGrouping:
   truncateDate("2026-04-15", "month") → "2026-04"
   truncateDate("2026-04-15", "week")  → "2026-W16"
   truncateDate("2026-04-15", "quarter") → "2026-Q2"
```

**Результат** (GROUP BY exercise + month):

```
Groups:
  { exercise: "Bench Press", month: "2026-04" } → [record1, record4, ...]  (8 записей)
  { exercise: "Squat",       month: "2026-04" } → [record2, ...]           (4 записи)
  { exercise: "Deadlift",    month: "2026-04" } → [record3, record5, ...]  (3 записи)
```

### 3.5 AGGREGATE

**Цель**: Свернуть группы в одну строку с агрегированными значениями.

**Вход**: Grouped DataFrame + AggregateColumn[]

```typescript
interface AggregateColumn {
  sourceField: string;            // "volume"
  outputName: string;             // "total_volume"
  function: AggregationFunction;  // "SUM"
}

type AggregationFunction =
  | 'SUM' | 'AVG' | 'MEDIAN'
  | 'MIN' | 'MAX' | 'RANGE'
  | 'COUNT' | 'COUNT_DISTINCT'
  | 'FIRST' | 'LAST'
  | 'STD_DEV'
  | 'PCT_EMPTY' | 'PCT_NOT_EMPTY';
```

**Реализация каждой функции:**

| Функция | Типы полей | Формула |
|---------|-----------|---------|
| SUM | number | Σ values |
| AVG | number | Σ / count |
| MEDIAN | number | sorted[mid] |
| MIN | number, date | Math.min(...values) |
| MAX | number, date | Math.max(...values) |
| RANGE | number, date | max - min |
| COUNT | any | values.length |
| COUNT_DISTINCT | any | new Set(values).size |
| FIRST | any | values[0] (by sort order) |
| LAST | any | values[length-1] |
| STD_DEV | number | √(Σ(x - avg)² / n) |
| PCT_EMPTY | any | empty.length / total × 100 |
| PCT_NOT_EMPTY | any | non-empty.length / total × 100 |

**Результат** (после GROUP BY exercise + month, AGGREGATE):

```
| exercise    | month   | total_volume | avg_weight | max_weight | sessions |
|-------------|---------|-------------|------------|------------|----------|
| Bench Press | 2026-04 | 25,600      | 81.25      | 85         | 8        |
| Squat       | 2026-04 | 19,200      | 122.5      | 130        | 4        |
| Deadlift    | 2026-04 | 8,700       | 142.5      | 150        | 3        |
```

### 3.6 PIVOT (Long → Wide)

**Цель**: Записи с categories → столбцы (обратная unpivot).

**Вход**: DataFrame + categoryField + valueField + aggregation

```
До (GROUP BY exercise + month, 3 months):
| exercise    | month   | total_volume |
|-------------|---------|-------------|
| Bench Press | 2026-02 | 20,000      |
| Bench Press | 2026-03 | 22,400      |
| Bench Press | 2026-04 | 25,600      |
| Squat       | 2026-02 | 15,000      |
| Squat       | 2026-03 | 17,600      |
| Squat       | 2026-04 | 19,200      |

PIVOT: categoryField="month", valueField="total_volume", aggregation=SUM

После:
| exercise    | 2026-02 | 2026-03 | 2026-04 |
|-------------|---------|---------|---------|
| Bench Press | 20,000  | 22,400  | 25,600  |
| Squat       | 15,000  | 17,600  | 19,200  |
```

Pivot создаёт идеальный вход для Chart (exercise = X axis, months = series) или DataTable (exercise слева, months как столбцы).

---

## 4. Полный пример: дневник тренировок

### 4.1 Исходные данные

30 заметок-тренировок за апрель 2026, каждая с 3-5 упражнениями:

```yaml
# 2026-04-01 Push Day.md
date: 2026-04-01
type: "Push"
exercise1: "Bench Press"
weight1: 80
sets1: 4
reps1: 10
exercise2: "Overhead Press"
weight2: 40
sets2: 3
reps2: 12
exercise3: "Tricep Dips"
weight3: 0
sets3: 3
reps3: 15
```

### 4.2 Цель пользователя

**Виджет 1 — DataTable**: Все упражнения "плоским" списком с фильтрами

**Виджет 2 — Chart (Line)**: Прогресс веса Bench Press по датам

**Виджет 3 — Stats**: Общий объём за месяц, среднее по упражнению

**Виджет 4 — DataTable (Pivot)**: Сводная: exercise × week → total volume

### 4.3 Настройка Transform Pipeline

**Виджет 1 — Flat Table** (TransformPipeline):

```json
{
  "steps": [
    {
      "type": "unpivot",
      "fieldGroups": [
        { "pattern": "exercise(\\d+)", "outputName": "exercise" },
        { "pattern": "weight(\\d+)",   "outputName": "weight" },
        { "pattern": "sets(\\d+)",     "outputName": "sets" },
        { "pattern": "reps(\\d+)",     "outputName": "reps" }
      ],
      "keepFields": ["date", "type"]
    }
  ]
}
```

Результат: 90+ строк, каждая = одно упражнение в одной тренировке

**Виджет 2 — Bench Press Weight Chart** (TransformPipeline):

```json
{
  "steps": [
    {
      "type": "unpivot",
      "fieldGroups": [
        { "pattern": "exercise(\\d+)", "outputName": "exercise" },
        { "pattern": "weight(\\d+)",   "outputName": "weight" }
      ],
      "keepFields": ["date"]
    },
    {
      "type": "filter",
      "conditions": {
        "conjunction": "and",
        "conditions": [
          { "field": "exercise", "operator": "is", "value": "Bench Press" }
        ]
      }
    }
  ]
}
```

Chart конфигурация: X = date, Y = weight, Type = Line

**Виджет 3 — Monthly Stats** (TransformPipeline):

```json
{
  "steps": [
    {
      "type": "unpivot",
      "fieldGroups": [
        { "pattern": "exercise(\\d+)", "outputName": "exercise" },
        { "pattern": "weight(\\d+)",   "outputName": "weight" },
        { "pattern": "sets(\\d+)",     "outputName": "sets" },
        { "pattern": "reps(\\d+)",     "outputName": "reps" }
      ],
      "keepFields": ["date"]
    },
    {
      "type": "compute",
      "columns": [
        { "name": "volume", "expression": "weight * sets * reps" }
      ]
    },
    {
      "type": "group-by",
      "fields": ["exercise"]
    },
    {
      "type": "aggregate",
      "columns": [
        { "sourceField": "volume", "outputName": "total_volume", "function": "SUM" },
        { "sourceField": "weight", "outputName": "avg_weight", "function": "AVG" },
        { "sourceField": "weight", "outputName": "max_weight", "function": "MAX" },
        { "sourceField": "exercise", "outputName": "sessions", "function": "COUNT" }
      ]
    }
  ]
}
```

**Виджет 4 — Weekly Pivot Table** (TransformPipeline):

```json
{
  "steps": [
    {
      "type": "unpivot",
      "fieldGroups": [
        { "pattern": "exercise(\\d+)", "outputName": "exercise" },
        { "pattern": "weight(\\d+)",   "outputName": "weight" },
        { "pattern": "sets(\\d+)",     "outputName": "sets" },
        { "pattern": "reps(\\d+)",     "outputName": "reps" }
      ],
      "keepFields": ["date"]
    },
    {
      "type": "compute",
      "columns": [
        { "name": "volume", "expression": "weight * sets * reps" }
      ]
    },
    {
      "type": "group-by",
      "fields": ["exercise"],
      "dateGrouping": { "field": "date", "granularity": "week" }
    },
    {
      "type": "aggregate",
      "columns": [
        { "sourceField": "volume", "outputName": "total_volume", "function": "SUM" }
      ]
    },
    {
      "type": "pivot",
      "categoryField": "date_week",
      "valueField": "total_volume",
      "aggregation": "SUM"
    }
  ]
}
```

Результат:

```
| exercise        | W14    | W15    | W16    | W17    | W18    |
|-----------------|--------|--------|--------|--------|--------|
| Bench Press     | 6,400  | 6,600  | 6,400  | 6,200  | ?      |
| Squat           | 4,800  | 4,800  | 5,040  | 4,800  | ?      |
| Overhead Press  | 1,440  | 1,440  | 1,584  | 1,440  | ?      |
| Deadlift        | 2,100  | 2,175  | 2,100  | 2,250  | ?      |
```

---

## 5. TypeScript API

### 5.1 Core Types

```typescript
// src/ui/views/Database/engine/transformTypes.ts

import type { DataRecord, DataField, DataFrame } from "src/lib/dataframe/dataframe";
import type { FilterDefinition } from "src/lib/dataframe/filter";

// ──── Pipeline ────────────────────────────────────────

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

// ──── Steps ───────────────────────────────────────────

export interface UnpivotStep {
  readonly type: 'unpivot';
  /** Field groups to melt into rows */
  readonly fieldGroups: readonly FieldGroup[];
  /** Fields preserved in every output row (e.g. date, type) */
  readonly keepFields: readonly string[];
}

export interface FieldGroup {
  /** Regex pattern with capture group for index: "exercise(\\d+)" */
  readonly pattern: string;
  /** Name of the output column: "exercise" */
  readonly outputName: string;
}

export interface ComputeStep {
  readonly type: 'compute';
  readonly columns: readonly ComputedColumn[];
}

export interface ComputedColumn {
  readonly name: string;
  /** Formula expression evaluated per-row: "weight * sets * reps" */
  readonly expression: string;
}

export interface FilterStep {
  readonly type: 'filter';
  readonly conditions: FilterDefinition;
}

export interface GroupByStep {
  readonly type: 'group-by';
  readonly fields: readonly string[];
  readonly dateGrouping?: DateGrouping;
}

export interface DateGrouping {
  readonly field: string;
  readonly granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  /**
   * Output field name convention: `${field}_${granularity}` by default.
   * E.g. { field: "date", granularity: "week" } → output field "date_week"
   * Original field is preserved unchanged in the output.
   */
  readonly outputField?: string;
}

export interface AggregateStep {
  readonly type: 'aggregate';
  readonly columns: readonly AggregateColumn[];
}

export interface AggregateColumn {
  readonly sourceField: string;
  readonly outputName: string;
  readonly function: AggregationFunction;
}

export type AggregationFunction =
  | 'SUM' | 'AVG' | 'MEDIAN'
  | 'MIN' | 'MAX' | 'RANGE'
  | 'COUNT' | 'COUNT_DISTINCT'
  | 'FIRST' | 'LAST'
  | 'STD_DEV'
  | 'PCT_EMPTY' | 'PCT_NOT_EMPTY';

export interface PivotStep {
  readonly type: 'pivot';
  readonly categoryField: string;
  readonly valueField: string;
  readonly aggregation: AggregationFunction;
}

// ──── Result ──────────────────────────────────────────

export interface TransformResult {
  readonly data: DataFrame;
  /** Transform-generated fields (не из оригинала) */
  readonly derivedFields: readonly DataField[];
  /** Metadata: какие шаги выполнены, время выполнения */
  readonly meta: TransformMeta;
}

export interface TransformMeta {
  readonly stepsExecuted: number;
  readonly executionTimeMs: number;
  readonly inputRowCount: number;
  readonly outputRowCount: number;
  /** Warnings (e.g. empty groups, missing fields) */
  readonly warnings: readonly string[];
}
```

### 5.2 Executor

```typescript
// src/ui/views/Database/engine/transformExecutor.ts

import type { DataFrame } from "src/lib/dataframe/dataframe";
import type { TransformPipeline, TransformResult, TransformStep } from "./transformTypes";

/** Canonical step order for validation */
const STEP_ORDER: Record<TransformStep['type'], number> = {
  'unpivot': 0, 'compute': 1, 'filter': 2,
  'group-by': 3, 'aggregate': 4, 'pivot': 5,
};

/**
 * Validate that pipeline steps follow canonical order.
 * Returns warnings for out-of-order steps.
 */
function validatePipelineOrder(steps: readonly TransformStep[]): string[] {
  const warnings: string[] = [];
  for (let i = 1; i < steps.length; i++) {
    if (STEP_ORDER[steps[i].type] < STEP_ORDER[steps[i - 1].type]) {
      warnings.push(`Step order warning: ${steps[i].type} after ${steps[i - 1].type}`);
    }
  }
  return warnings;
}

/**
 * Execute a transform pipeline on a DataFrame.
 * Input: Enriched DataFrame (after Relation/Formula/Rollup + project-level Filter/Sort).
 * Each step produces a new DataFrame (immutable).
 */
export function executeTransform(
  source: DataFrame,
  pipeline: TransformPipeline
): TransformResult {
  const startTime = performance.now();
  const warnings: string[] = [];
  let current = source;

  for (const step of pipeline.steps) {
    current = executeStep(current, step, warnings);
  }

  return {
    data: current,
    derivedFields: detectDerivedFields(source, current),
    meta: {
      stepsExecuted: pipeline.steps.length,
      executionTimeMs: performance.now() - startTime,
      inputRowCount: source.records.length,
      outputRowCount: current.records.length,
      warnings,
    },
  };
}

function executeStep(
  df: DataFrame,
  step: TransformStep,
  warnings: string[]
): DataFrame {
  switch (step.type) {
    case 'unpivot':   return executeUnpivot(df, step, warnings);
    case 'compute':   return executeCompute(df, step, warnings);
    case 'filter':    return executeFilter(df, step, warnings);
    case 'group-by':  return executeGroupBy(df, step, warnings);
    case 'aggregate': return executeAggregate(df, step, warnings);
    case 'pivot':     return executePivot(df, step, warnings);
  }
}
```

### 5.3 Unpivot Implementation Sketch

```typescript
function executeUnpivot(
  df: DataFrame,
  step: UnpivotStep,
  warnings: string[]
): DataFrame {
  const compiledPatterns = step.fieldGroups.map(fg => ({
    regex: new RegExp(`^${fg.pattern}$`),
    outputName: fg.outputName,
  }));

  // Discover all indices present in data
  const indicesSet = new Set<string>();
  for (const field of df.fields) {
    for (const cp of compiledPatterns) {
      const match = field.name.match(cp.regex);
      if (match?.[1]) {
        indicesSet.add(match[1]);
      }
    }
  }

  const indices = [...indicesSet].sort();
  if (indices.length === 0) {
    warnings.push(`Unpivot: no fields matched patterns ${step.fieldGroups.map(g => g.pattern).join(', ')}`);
    return df; // Return unchanged
  }

  const newRecords: DataRecord[] = [];

  for (const record of df.records) {
    for (const idx of indices) {
      // Check if ALL group fields for this index are empty
      const allEmpty = step.fieldGroups.every(fg => {
        const fieldName = findFieldByIndex(df.fields, fg.pattern, idx);
        return fieldName == null || record.values[fieldName] == null || record.values[fieldName] === '';
      });

      if (allEmpty) continue; // Skip empty groups

      const newValues: Record<string, DataValue> = {};

      // Copy keepFields
      for (const kf of step.keepFields) {
        newValues[kf] = record.values[kf];
      }

      // Map group fields
      for (const fg of step.fieldGroups) {
        const fieldName = findFieldByIndex(df.fields, fg.pattern, idx);
        newValues[fg.outputName] = fieldName ? record.values[fieldName] : undefined;
      }

      // Metadata
      newValues['_source_record'] = record.id;
      newValues['_group_index'] = Number(idx);

      newRecords.push({
        id: `${record.id}__${idx}`,
        values: newValues,
      });
    }
  }

  // Build new fields
  const newFields = buildUnpivotFields(df.fields, step);

  return { fields: newFields, records: newRecords };
}
```

### 5.4 Aggregation Functions Implementation

```typescript
// src/ui/views/Database/engine/aggregationFunctions.ts

export function aggregate(
  values: DataValue[],
  fn: AggregationFunction
): DataValue {
  const numbers = values.filter((v): v is number => typeof v === 'number');
  const nonEmpty = values.filter(v => v != null && v !== '');

  switch (fn) {
    case 'SUM':
      return numbers.reduce((a, b) => a + b, 0);

    case 'AVG':
      return numbers.length > 0
        ? numbers.reduce((a, b) => a + b, 0) / numbers.length
        : 0;

    case 'MEDIAN': {
      if (numbers.length === 0) return 0;
      const sorted = [...numbers].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    case 'MIN':
      return numbers.length > 0 ? Math.min(...numbers) : 0;

    case 'MAX':
      return numbers.length > 0 ? Math.max(...numbers) : 0;

    case 'RANGE':
      return numbers.length > 0
        ? Math.max(...numbers) - Math.min(...numbers)
        : 0;

    case 'COUNT':
      return values.length;

    case 'COUNT_DISTINCT':
      return new Set(values.map(String)).size;

    case 'FIRST':
      return values[0] ?? null;

    case 'LAST':
      return values[values.length - 1] ?? null;

    case 'STD_DEV': {
      if (numbers.length <= 1) return 0;
      const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
      const variance = numbers.reduce((sum, v) => sum + (v - avg) ** 2, 0) / numbers.length;
      return Math.sqrt(variance);
    }

    case 'PCT_EMPTY':
      return values.length > 0
        ? ((values.length - nonEmpty.length) / values.length) * 100
        : 0;

    case 'PCT_NOT_EMPTY':
      return values.length > 0
        ? (nonEmpty.length / values.length) * 100
        : 0;
  }
}
```

---

## 6. Конфигурация UI

### 6.1 Transform Pipeline Editor

Открывается через Widget Settings → "Configure Transform...":

```
┌──────────────────────────────────────────────────────────────────┐
│ Transform Pipeline                                          [×]  │
│ ──────────────────────────────────────────────────────────────── │
│                                                                  │
│  Pipeline Steps:                                                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ 1. UNPIVOT                                    [⚙] [🗑]│        │
│  │    Groups: exercise, weight, sets, reps              │        │
│  │    Keep: date, type                                  │        │
│  │    Preview: 2 records → 5 records                    │        │
│  └──────────────────────────────────────────────────────┘        │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ 2. COMPUTE                                    [⚙] [🗑]│        │
│  │    volume = weight × sets × reps                     │        │
│  │    Preview: +1 column                                │        │
│  └──────────────────────────────────────────────────────┘        │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ 3. GROUP BY                                   [⚙] [🗑]│        │
│  │    By: exercise, month(date)                         │        │
│  │    Preview: 5 records → 3 groups                     │        │
│  └──────────────────────────────────────────────────────┘        │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────┐        │
│  │ 4. AGGREGATE                                  [⚙] [🗑]│        │
│  │    total_volume = SUM(volume)                        │        │
│  │    avg_weight = AVG(weight)                          │        │
│  │    Preview: 3 records × 4 columns                    │        │
│  └──────────────────────────────────────────────────────┘        │
│                                                                  │
│  [+ Add Step]                                                    │
│                                                                  │
│ ──── Preview ────────────────────────────────────────────────── │
│ ┌──────────────────────────────────────────────────────┐        │
│ │ exercise    │ month   │ total_volume │ avg_weight    │        │
│ ├─────────────┼─────────┼─────────────┼───────────────┤        │
│ │ Bench Press │ 2026-04 │ 25,600      │ 81.25         │        │
│ │ Squat       │ 2026-04 │ 19,200      │ 122.5         │        │
│ │ Deadlift    │ 2026-04 │ 8,700       │ 142.5         │        │
│ └──────────────────────────────────────────────────────┘        │
│ 30 input records → 3 output records (4 steps, 12ms)             │
│                                                                  │
│                                    [Cancel]  [Apply]             │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Шаг Unpivot — детальная конфигурация

Click [⚙] на шаге Unpivot:

```
┌────────────────────────────────────────────────────────────┐
│ Configure Unpivot                                     [×]  │
│ ────────────────────────────────────────────────────────── │
│                                                            │
│ Detection mode:                                            │
│ ○ Auto-detect (find numbered field patterns)               │
│ ● Pattern-based (specify regex per group)                  │
│ ○ Manual (select fields explicitly)                        │
│                                                            │
│ ─── Field Groups ─────────────────────────────────────── │
│                                                            │
│ Group 1:                                                   │
│   Pattern:  [exercise(\d+)          ]                      │
│   Output:   [exercise               ]                      │
│   Matches:  exercise1, exercise2, exercise3  ✓             │
│                                                            │
│ Group 2:                                                   │
│   Pattern:  [weight(\d+)            ]                      │
│   Output:   [weight                 ]                      │
│   Matches:  weight1, weight2, weight3  ✓                   │
│                                                            │
│ [+ Add Group]                                              │
│                                                            │
│ ─── Keep Fields ──────────────────────────────────────── │
│ [date ×] [type ×]  [+ Add]                                 │
│                                                            │
│ ─── Options ──────────────────────────────────────────── │
│ Skip empty groups     [────────────●  ]                    │
│                                                            │
│                                      [Cancel]  [OK]        │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Auto-detect Mode

При выборе "Auto-detect" плагин сканирует поля DataFrame и предлагает паттерны:

```
Detected patterns:
  ┌─────────────────────────────────────────────────────────┐
  │ ☑ exercise{N}, weight{N}, sets{N}, reps{N}  (3 groups) │
  │ ☐ category{N}, amount{N}                     (4 groups) │
  └─────────────────────────────────────────────────────────┘
  User selects which pattern to use → auto-fills field groups
```

Алгоритм auto-detect:
1. Для каждого поля — попробовать извлечь `prefix` + `index` (regex: `^(.+?)(\d+)$`)
2. Сгруппировать по prefix → посчитать сколько индексов
3. Если ≥2 поля с одним prefix и разными indices → предложить как группу
4. Объединить prefix'ы с одинаковыми indices → предложить как field group set

---

## 7. Интеграция с виджетами

### 7.1 DataTable + Transform

DataTable с TransformPipeline показывает **трансформированные** данные, но с ограничениями:
- **Read-only**: ячейки НЕ редактируемые (данные производные)
- **No inline add**: нельзя добавить строку (нет соответствия с заметкой)
- **Source link**: столбец `_source_record` → клик открывает оригинальную заметку
- **Sort/Filter**: работают поверх трансформированных данных

Visual indicator: иконка "🔄 Transformed" в header DataTable + tooltip "Data transformed by pipeline (read-only)"

### 7.2 ChartWidget + Transform

Chart получает трансформированные данные как обычный DataFrame:
- X Axis / Y Axis → выбирают из полей **трансформированного** DataFrame
- Если pipeline содержит GROUP BY + AGGREGATE → chart видит агрегированные столбцы
- Если только UNPIVOT → chart видит "длинную" таблицу, может group by category field

### 7.3 StatsWidget + Transform

StatsWidget cards получают значения из трансформированного DataFrame:
- Card "Total Volume" → SUM(total_volume) из агрегированного результата
- Card "Best Exercise" → MAX(max_weight) → exercise
- Card "Sessions" → SUM(sessions)

Если pipeline включает агрегацию, StatsWidget может делать "агрегацию агрегатов" (SUM of SUMs) — корректно для SUM, COUNT. Для AVG, MEDIAN — нужен пересчёт из "длинных" данных (до GROUP BY).

### 7.4 ComparisonWidget + Transform

ComparisonWidget сравнивает группы → идеально работает с GROUP BY шагом:
- Группа A: "Bench Press" → total_volume, avg_weight, max_weight
- Группа B: "Squat" → total_volume, avg_weight, max_weight
- Visual: side-by-side bars, percentage difference

---

## 8. Performance и кэширование

### 8.1 Кэш стратегия

```typescript
interface TransformCache {
  /** Hash от source DataFrame + pipeline config */
  readonly cacheKey: string;
  /** Cached result */
  readonly result: TransformResult;
  /** Timestamp для TTL */
  readonly timestamp: number;
}
```

**Cache invalidation:**
1. Source DataFrame изменился (новая заметка, отредактированный frontmatter)
2. Pipeline config изменился (пользователь изменил шаги)
3. TTL expired (fallback: 5 минут)

**Cache key:**
```typescript
function computeCacheKey(df: DataFrame, pipeline: TransformPipeline): string {
  const sourceHash = hashDataFrame(df); // hash of field names + record count + sample values
  const configHash = JSON.stringify(pipeline.steps);
  return `${sourceHash}__${configHash}`;
}
```

### 8.2 Performance Limits

| Категория | Лимит | Действие при превышении |
|-----------|-------|------------------------|
| Input records | 10,000 | Warning: "Large dataset, transform may be slow" |
| Unpivot output | 50,000 rows | Error: "Too many rows after unpivot. Reduce field groups or add filter" |
| Group count | 1,000 groups | Warning: "Many groups, consider wider granularity" |
| Pipeline steps | 10 | Hard limit: UI не позволяет добавить больше |
| Execution time | 2000ms | Cancel + error: "Transform timed out" |

### 8.3 Incremental Execution

Для больших датасетов — инкрементальное обновление:

```
Если изменилась 1 заметка (1 record):
  1. Найти все cached output rows с _source_record = changed record
  2. Удалить их из кэша
  3. Re-run pipeline ТОЛЬКО для этого 1 record
  4. Merge результат в кэшированный output
  5. Re-run GROUP BY / AGGREGATE на уровне затронутых групп
```

Это оптимизация Phase 3+ (не для первой версии).

---

## 9. Ограничения и edge cases

### 9.1 Ограничения

| Ограничение | Причина | Workaround |
|-------------|---------|-----------|
| Только flat YAML | parseRecords() stringify объекты | Пользователь должен использовать нумерованные поля |
| Read-only output | Нет обратного маппинга transform → source | Клик на row → открыть source заметку |
| Нет cross-record формул в COMPUTE | evaluateFormula = single record | Используй GROUP BY + AGGREGATE |
| regex от пользователя | ReDoS risk | Timeout 100ms на regex exec + try-catch |
| Pivot может создать много столбцов | Уникальных категорий много | Лимит 50 pivot columns |

### 9.2 Edge Cases

| Кейс | Поведение |
|------|-----------|
| Field pattern matches 0 fields | Warning + skip step, return unchanged DataFrame |
| All groups empty for a record | Skip record (0 output rows for it) |
| Division by zero in COMPUTE | Cell value = NaN → displayed as "Error" |
| NULL values in AGGREGATE | Ignored (SUM of [1, null, 3] = 4, COUNT = 3) |
| Empty DataFrame after FILTER | Return empty DataFrame with correct fields |
| GROUP BY on field with all same values | 1 group containing all records |
| PIVOT with 1 unique category | 1 value column (valid but not useful) |
| Duplicate outputNames in FieldGroups | Error: "Duplicate output field name: {name}" |
| keepField name same as outputName | Error: "Field name conflict: {name}" |

### 9.3 Regex Safety

Пользователь вводит regex patterns для FieldGroup → ReDoS surface.

**Mitigation:**

```typescript
function safeRegexExec(pattern: string, input: string, timeoutMs = 100): RegExpExecArray | null {
  // 1. Validate regex syntax
  let regex: RegExp;
  try {
    regex = new RegExp(`^${pattern}$`);
  } catch {
    return null; // Invalid regex → skip
  }

  // 2. Reject lookbehind/lookahead — not supported on iOS <16.4
  if (/\(\?[<!=]/.test(pattern)) {
    throw new Error("Lookbehind/lookahead not supported (iOS compatibility)");
  }

  // 3. Complexity check: reject patterns with nested quantifiers
  if (/(\+|\*|\{)\s*(\+|\*|\{)/.test(pattern)) {
    throw new Error("Potentially unsafe regex pattern");
  }

  // 4. Execute with timeout via simple length check
  if (input.length > 256) return null; // Field names should be short

  return regex.exec(input);
}
```

---

## 10. Фазы реализации

### Phase 1 (v3.3.0-alpha)
- [ ] TransformPipeline types
- [ ] UNPIVOT step (pattern-based)
- [ ] COMPUTE step (single-record expressions)
- [ ] Basic UI: step list + Unpivot config
- [ ] Integration: DataTable (read-only mode)

### Phase 2 (v3.3.0-beta)
- [ ] GROUP BY step (simple + dateGrouping)
- [ ] AGGREGATE step (SUM, AVG, COUNT, MIN, MAX)
- [ ] FILTER step (reuse FilterEngine)
- [ ] Transform Preview panel
- [ ] Integration: ChartWidget, StatsWidget

### Phase 3 (v3.3.0)
- [ ] PIVOT step
- [ ] Auto-detect field patterns
- [ ] Full aggregation function set (MEDIAN, STD_DEV, etc.)
- [ ] Caching + cache invalidation
- [ ] Performance limits + timeout
- [ ] Integration: ComparisonWidget

### Phase 4 (v3.3.x-post)
- [ ] Incremental execution
- [ ] Visual pipeline builder (drag steps)
- [ ] Template pipelines (Workout, Budget, Study)
- [ ] Export transformed data (CSV)

# Architecture: Agenda Filter Engine (v3.1.0)

> DQL-совместимый движок фильтрации для Agenda Custom Mode

## Обзор

Фильтрация агенды работает **поверх** данных, полученных из любого источника (Folder, Tag, Dataview). Данные проходят единый pipeline:

```
DataSource (Folder/Tag/Dataview DQL)
  → DataFrame { fields, records }
  → filterRecordsForList(records, list, selectedDate, fields)
  → Filtered DataRecord[]
```

## Режимы фильтрации

| Режим | Описание | Input |
|-------|----------|-------|
| **Visual** | Визуальный конструктор (UI чипы) | `AgendaFilterGroup` |
| **Advanced** | Текстовая формула (AST) | `filterFormula: string` |

## Операторы (42 шт.)

### Базовые (все типы)
| Оператор | Описание | Значение |
|----------|----------|----------|
| `is-empty` | Пусто | — |
| `is-not-empty` | Не пусто | — |

### Строки (7)
| Оператор | Описание |
|----------|----------|
| `is` | Равно (дата-совместимо) |
| `is-not` | Не равно |
| `contains` | Содержит (case-insensitive) |
| `not-contains` | Не содержит |
| `starts-with` | Начинается с |
| `ends-with` | Заканчивается на |
| `regex` | Regex (case-insensitive) |

### Числа (6)
`eq`, `neq`, `lt`, `gt`, `lte`, `gte` — также работают для дат через `dayjs`.

### Булевые (2)
`is-checked`, `is-not-checked`

### Даты (11)
| Оператор | Описание | Значение |
|----------|----------|----------|
| `is-on` | В дату | ✓ (или формула) |
| `is-not-on` | Не в дату | ✓ |
| `is-before` | До | ✓ |
| `is-after` | После | ✓ |
| `is-on-and-before` | В дату или до | ✓ |
| `is-on-and-after` | В дату или после | ✓ |
| `is-today` | Сегодня | — |
| `is-this-week` | На этой неделе | — |
| `is-this-month` | В этом месяце | — |
| `is-overdue` | Просрочено | — |
| `is-upcoming` | Предстоящие | — |

### Списки/Теги (4)
`has-any-of`, `has-all-of`, `has-none-of`, `has-keyword`

## Формулы дат (DQL-совместимые)

Формулы дат используются как значения фильтров для динамических дат.

### Синтаксис

```
<keyword>[±<N><unit>]
```

### Ключевые слова

| DQL abbr | Полное имя | Описание |
|----------|-----------|----------|
| `today` / `now` | today | Текущий день |
| `tomorrow` | tomorrow | Завтра |
| `yesterday` | yesterday | Вчера |
| **`sow`** | week_start | Начало недели (Пн) |
| **`eow`** | week_end | Конец недели (Вс) |
| **`som`** | month_start | Начало месяца |
| **`eom`** | month_end | Конец месяца |
| **`soy`** | year_start | Начало года (1 Янв) |
| **`eoy`** | year_end | Конец года (31 Дек) |

### Единицы смещения

| Суффикс | Единица | Пример |
|---------|---------|--------|
| *(нет)* / `d` | Дни | `today+7` = `today+7d` |
| `w` | Недели | `today+1w` = +7 дней |
| `m` | Месяцы | `som+1m` = начало след. месяца |
| `y` | Годы | `today+1y` = через год |

### Примеры

```
today         → 2026-02-07
today+1       → 2026-02-08
today-1w      → 2026-01-31  (−1 неделя)
sow           → начало текущей недели
sow+1w        → начало следующей недели
eom           → конец текущего месяца
som+1m        → начало следующего месяца
som-2m        → 2 месяца назад (начало)
today+1y      → та же дата через год
```

### Обратная совместимость

Старые имена (`week_start`, `weekstart`, `month_end`, `monthend`, `year_start`, `yearstart`, `weekend`) поддерживаются как алиасы.

## Группы фильтров

```typescript
AgendaFilterGroup {
  id: string
  conjunction: 'AND' | 'OR'
  filters: AgendaFilter[]       // условия
  groups: AgendaFilterGroup[]   // вложенные группы (рекурсивно)
}
```

- `AND` → все условия должны быть истинны
- `OR` → хотя бы одно условие истинно
- Пустая группа → все записи проходят
- Отключённые фильтры (`enabled: false`) пропускаются

## Интеграция с Dataview

```
┌──────────────────────────────────────┐
│  Obsidian Vault                       │
│  ┌───────────┐   ┌──────────────┐    │
│  │ Folder DS │   │ Dataview DS  │    │
│  │ (YAML FM) │   │ (DQL query)  │    │
│  └─────┬─────┘   └──────┬───────┘    │
│        └────────┬────────┘            │
│            DataFrame                  │
│     { fields, records }               │
└──────────────┬───────────────────────┘
               ▼
       filterRecordsForList()
       ┌──────────────────────┐
       │  Visual mode         │
       │  evaluateFilterGroup │
       │  (42 operators)      │
       ├──────────────────────┤
       │  Advanced mode       │
       │  parseFormula → AST  │
       │  evaluateFormula     │
       └──────────┬───────────┘
                  ▼
          Filtered records[]
```

**Ключевой принцип**: Движок фильтрации **агностичен к источнику данных**. Он работает с `DataRecord[]` одинаково для Folder, Tag и Dataview источников.

## Файловая структура

| Файл | Назначение |
|------|-----------|
| `src/lib/helpers/dateFormulaParser.ts` | Парсер дат-формул (DQL-совместимый) |
| `src/lib/helpers/formulaParser.ts` | AST-парсер формул (Advanced mode) |
| `src/ui/views/Calendar/agenda/filterEngine.ts` | Движок фильтрации (42 оператора) |
| `src/ui/views/Calendar/agenda/operatorHelpers.ts` | Метаданные операторов |
| `src/ui/views/Calendar/agenda/suggestionCollector.ts` | Сбор подсказок из данных |
| `src/ui/views/Calendar/agenda/FilterRow.svelte` | UI строки фильтра (imperative DOM) |
| `src/ui/views/Calendar/agenda/DateFormulaInput.svelte` | Ввод дат-формул с подсказками |
| `src/ui/views/Calendar/agenda/FilterGroupEditor.svelte` | Редактор групп |
| `src/ui/views/Calendar/agenda/AgendaListEditor.svelte` | Редактор списка |

## Тесты

| Файл | Тестов | Покрытие |
|------|--------|----------|
| `dateFormulaParser.test.ts` | 85 | DQL keywords, aliases, offsets, units, edge cases |
| `filterEngine.test.ts` | 51 | All 42 operators, groups, nesting, DQL formulas |
| Итого | 136 | + 150 существующих = **286 тестов** |

## Обратная совместимость

### Старые операторы (v3.0.x → v3.1.0)

| Старый (snake_case) | Новый (kebab-case) |
|---------------------|-------------------|
| `equals` | `is` |
| `not_equals` | `is-not` |
| `is_empty` | `is-empty` |
| `is_not_empty` | `is-not-empty` |
| `greater_than` | `gt` |
| `less_than` | `lt` |
| `greater_or_equal` | `gte` |
| `less_or_equal` | `lte` |
| `is_today` | `is-today` |
| `is_this_week` | `is-this-week` |
| `is_overdue` | `is-overdue` |
| `is_upcoming` | `is-upcoming` |
| `not_contains` | `not-contains` |

### Старый формат списков

Списки с `filters: AgendaFilter[]` (v3.0.x) автоматически обрабатываются через legacy-путь `evaluateFilters()`.

## UI: Imperative DOM Pattern

Для обхода ограничений Obsidian (CSS `transform` на модалах ломает `position: fixed`, Svelte scoped CSS не применяется к порталованным элементам), все dropdown'ы рендерятся через imperative DOM API:

```typescript
const el = document.createElement('div');
el.setAttribute('style', 'position:fixed; z-index:10000; ...');
document.body.appendChild(el);
```

Этот паттерн используется в:
- `FilterRow.svelte` → `renderFieldPopover()`, `renderOperatorPopover()`
- `DateFormulaInput.svelte` → `createPopover()`

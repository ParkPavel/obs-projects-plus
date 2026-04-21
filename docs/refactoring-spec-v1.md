# REFACTORING SPEC v1.0 — obs-projects-plus UX Overhaul

> Дата: 2026-04-20
> Статус: APPROVED FOR EXECUTION
> Приоритет: Критический — текущий код не тестируем пользователем

---

## 0. ДИАГНОЗ

### Что было сделано (Waves 1–8)
Backend-функциональность: 115 формул, 13 агрегаций, 6 шагов pipeline, 10 типов графиков, backlinks, multi-source merge. Код написан, тесты проходят (42 suites, 839 tests).

### Что не так
**Весь backend не доступен пользователю.** UI — на уровне прототипа:

| Проблема | Влияние |
|----------|---------|
| Pipeline: FILTER/UNPIVOT/UNNEST шаги не имеют UI конфигурации | Ключевая фича недоступна |
| 5 из 8 виджетов не имеют UI настроек (Stats, Comparison, Checklist, FilterTabs, SummaryRow) | Виджеты бесполезны без ручного JSON |
| Formula Editor: нет подсказок параметров, нет документации функций | 115 функций без discoverability |
| Таблица: legacy дизайн из Table View, кнопки внутри ячеек, кривое выравнивание | Визуальный мусор |
| Шаблоны: hardcoded field names, нет маппинга полей | Ломаются на любом проекте кроме демо |
| Демо-проект: нет настроенной Database View с виджетами | Невозможно увидеть возможности |
| Виджеты: нет drag-and-drop между собой (только stack/grid) | Деревянная модульность |
| Checklist из шаблона "Kanban+": пустой pipeline, нет field picker | Фича не работает |

### Корневая причина
Разработка шла "от engine к UI" (bottom-up), а не "от пользователя к engine" (top-down). Результат: мощный backend, к которому нет интерфейса.

---

## 1. СРАВНИТЕЛЬНЫЙ АНАЛИЗ: Notion vs OBS Projects Plus

### 1.1 Table View

| Аспект | Notion | OBS Projects Plus | Gap |
|--------|--------|-------------------|-----|
| Column header | Чистый: icon + name + ▾ dropdown | Icon + name + кнопка ⋮ + resizer в одном flex | Кнопка ⋮ внутри ячейки, вторичный разделитель |
| Column menu | Click header → dropdown (rename, type, sort, filter, hide, duplicate, delete, insert left/right, freeze, wrap, color) | Click ⋮ → context menu (sort, hide, pin) | Нет: rename, type change, duplicate, insert, freeze, wrap, color |
| Column resize | Drag border, double-click = auto-fit | Drag handle 0.375rem (6px) — почти неуловим | Handle слишком мал, нет auto-fit |
| Column auto-width | Double-click border = fit content | Нет | Нет auto-fit |
| Freeze columns | Click header → "Freeze up to column" | Config only (`freezeUpTo`), нет UI | Есть engine, нет UI |
| Row height | Compact / Default / Expanded через меню | Config only (`rowHeight`), нет UI | Есть engine, нет UI |
| Text wrap | Per-column toggle | Config only (`wrapText`), нет UI | Есть engine, нет UI |
| Inline editing | Click cell → edit in place, type-aware | Click cell → edit, но limited type awareness | Partial |
| Add property | "+" справа от последней колонки | Нет inline add | Нет UI |
| Property types | 20+ (Text, Number, Select, Status, Multi-select, Date, Formula, Relation, Rollup, Person, File, Checkbox, URL, Email, Phone, Created time/by, Last edited time/by, Button, ID, Place) | ~10 (string, number, boolean, date, list, link, relation, unknown, formula) | Половина типов отсутствует |
| Conditional color | Per-row or per-property, rule-based (property + condition + color) | Config only (`conditionalFormats`), limited UI | Есть engine, слабый UI |
| Open page | Side peek / Center peek / Full page (настраивается) | Always new tab | Нет side peek / center peek |
| Search | 🔍 в toolbar | Нет | Нет search внутри view |
| Calculations | Footer: Count, Count unique, Count values, Percent empty/not empty, Sum, Average, Median, Min, Max, Range | Aggregation row (13 functions) | Паритет, но UI слабее |

### 1.2 Filter UX

| Аспект | Notion | OBS Projects Plus |
|--------|--------|-------------------|
| Simple filter | Click property → operator → value, inline | Sidebar panel с AND/OR groups |
| Advanced filter | Nested AND/OR groups (3 levels deep) | Pipeline FILTER step = hint only, не работает |
| Filter location | Inline toolbar, collapsible | Pipeline Editor modal (отдельное окно) |
| Save scope | "Save for everyone" toggle vs personal | Глобальное сохранение |
| Filter indicators | Count badge на кнопке Filter | Нет индикатора |

### 1.3 Formula Editor

| Аспект | Notion | OBS Projects Plus |
|--------|--------|-------------------|
| Layout | Full editor: formula input top, left panel (properties + functions), right panel (docs + examples) | FormulaBar: code input + visual palette, но palette = flat list |
| Parameter hints | При вводе функции — показывает сигнатуру и описание каждого параметра | Нет никаких подсказок |
| Function docs | Hover → описание + примеры + expected types | Нет описаний |
| Live preview | Per-row preview при открытии из строки | Preview одного sample record |
| Error guidance | "Expected argument of type Number" с указанием позиции | Generic error list |
| AI assist | Notion AI: natural language → formula (Business+) | Нет |
| Type display | "Show types" toggle | Нет |

### 1.4 Views & Layout

| Аспект | Notion | OBS Projects Plus |
|--------|--------|-------------------|
| View types | Table, Board, Timeline, Calendar, List, Gallery, Chart | Database (multi-widget), Board, Calendar, Gallery, Table (deprecated) |
| Timeline/Gantt | ✅ Полноценный timeline с зависимостями | ❌ Нет |
| List view | ✅ Минималистичный список | ❌ Нет |
| Chart view | ✅ Bar, Line, Donut (отдельный view type) | ✅ 10 типов (widget внутри Database) |
| View tabs | Tabs с иконками, drag to reorder | Tabs на верхнем уровне + вкладки внутри Database |
| Sub-groups | ✅ 2 уровня группировки | ✅ 2 уровня (Wave 7) |

### 1.5 Widget System (нет аналога в Notion)

OBS Projects Plus имеет уникальную widget-based dashboard систему, которой нет в Notion (Notion = 1 view = 1 тип). Это **конкурентное преимущество**, но оно не раскрыто:

- 5 из 8 виджетов без UI настроек
- Нет drag-and-drop виджетов (только array reorder в stack mode)
- Шаблоны не адаптируются к полям проекта
- Pipeline per-widget — мощная концепция, но UI не позволяет использовать

---

## 2. ПЛАН РЕФАКТОРИНГА — 10 ВОЛН

### Принцип: TOP-DOWN (от пользователя к коду)
Каждая волна = одна область UX, доводится до полностью рабочего состояния.

---

### Wave R1: DataGrid Redesign (Table)
**Цель**: Таблица визуально и функционально на уровне Notion

#### R1.1: Column Header Refactor
- **Сейчас**: `[icon | name | ⋮ button | resizer]` внутри flex
- **Надо**: `[icon | name ▾]` — весь header кликабелен → dropdown menu
- Убрать отдельную кнопку ⋮
- Resizer = border между колонками (не отдельный элемент внутри ячейки)
- Double-click на border = auto-fit width

#### R1.2: Column Context Menu (Notion-style)
Один dropdown при клике на header:
```
Sort ascending
Sort descending
───────────────
Insert left
Insert right
───────────────
Rename
Edit type
Duplicate
───────────────
Freeze up to column
Wrap column
───────────────
Hide
Delete
```

#### R1.3: Table Settings Bar
Toolbar под заголовком view:
```
[🔍 Search] [⊞ Filter (2)] [↕ Sort (1)] [≡ Group] [⊟ Properties] [⋯ More]
```
- Filter count badge
- Sort indicator
- Group indicator
- Properties: show/hide columns inline

#### R1.4: Row Height & Text Wrap UI
- Меню "More" → Row height: Compact | Default | Expanded
- Per-column: header menu → "Wrap column"

#### R1.5: Freeze Columns UI
- Header menu → "Freeze up to column"
- Visual indicator: thicker border + shadow на freeze line

#### R1.6: Inline Add Property
- "+" кнопка справа от последней колонки
- Click → field name input + type picker

**LOC estimate**: ~600 LOC changes, ~200 LOC new
**Files**: GridHeader.svelte, GridColumnHeader.svelte, DataGrid.svelte, DataTableWidget.svelte, styles.css

---

### Wave R2: Pipeline Editor Complete Rewrite
**Цель**: Каждый шаг pipeline полностью конфигурируем через UI

#### R2.1: Filter Step — Inline Filter Builder
- Встроить FilterConditionGroup (уже есть в FilterTab!) прямо в Pipeline step
- AND/OR groups, operator picker, value input — всё inline
- Preview: "Showing 12 of 42 records"

#### R2.2: Aggregate Step — Multi-column
- Добавить кнопку "+ Add aggregation"
- Каждая строка: [field picker] [function picker: SUM/AVG/MEDIAN/...] [output name]
- Показывать все 13 поддерживаемых функций

#### R2.3: Pivot Step — Aggregation Picker
- Добавить dropdown для выбора функции агрегации (не только SUM)
- Dropdown: SUM, AVG, COUNT, MIN, MAX, MEDIAN

#### R2.4: Unpivot Step — Full Config UI
- Field groups: multi-select checkbox list полей
- Keep fields: multi-select checkbox list
- Preview output columns

#### R2.5: Unnest Step — Add to Menu + Config
- Добавить кнопку "Раскрытие" в меню шагов
- Config: field picker (какое поле раскрывать)

#### R2.6: Pipeline Preview
- После каждого шага: live preview "→ 42 rows × 8 cols"
- Error display per-step: если шаг ломает данные — красная метка
- Выпадающая таблица-preview по клику (первые 5 строк)

**LOC estimate**: ~800 LOC rewrite PipelineEditor.svelte
**Files**: PipelineEditor.svelte (rewrite), new: FilterStepEditor.svelte, AggregateStepEditor.svelte, PivotStepEditor.svelte, UnpivotStepEditor.svelte, UnnestStepEditor.svelte

---

### Wave R3: Widget Configuration UI
**Цель**: Каждый виджет полностью настраиваем через inline UI

#### R3.1: Universal Widget Config Pattern
Каждый виджет получает кнопку ⚙ → inline config panel (не modal):
```
[Widget Title]  [⚙] [⛭ Pipeline] [✕]
┌─────────────────────────────────────┐
│  Config panel (inline, collapsible) │
└─────────────────────────────────────┘
[Widget content]
```

#### R3.2: Stats Widget Config
- "+ Add card" кнопка
- Каждая карточка: [field picker] [aggregation picker] [format: number/currency/percent] [sparkline toggle]
- Drag to reorder cards
- Remove card: ✕

#### R3.3: Comparison Widget Config
- "+ Add metric" кнопка
- Каждая метрика: [label input] [field picker] [aggregation] [color picker]
- Mode toggle: Absolute / Percentage / Normalized
- Show delta toggle

#### R3.4: Checklist Widget Config
- Field picker: "Отслеживать поле:" → dropdown всех boolean полей
- Display field: "Показывать:" → dropdown (name / title / custom)
- Sort: по имени / по статусу / manual
- Bulk actions: Select all / Deselect all

#### R3.5: FilterTabs Widget Config
- Field picker: "Группировать по:" → dropdown
- Custom tabs: "+ Add custom tab" (label + filter condition)
- Show "All" tab toggle
- Tab order: drag to reorder

#### R3.6: SummaryRow Widget Config
- "+ Add column" кнопка
- Каждая колонка: [field picker] [aggregation] [format] [currency]
- Drag to reorder

**LOC estimate**: ~1200 LOC new UI components
**Files**: New config components per widget in respective widget directories

---

### Wave R4: Formula Editor Redesign
**Цель**: Formula Editor как в Notion — с подсказками, документацией, preview

#### R4.1: Function Signature Hints
При вводе `IF(` показывать:
```
IF(condition, true_value, false_value)
   ↑ condition: boolean
Returns the first value if true, second if false.
Example: IF(budget > 1000, "Big", "Small")
```

#### R4.2: Function Documentation Panel
Правая панель formula editor:
- Hover/click на функцию → описание, параметры, return type, примеры
- Группировка: Logic, Math, String, Date, Financial, Statistical, Aggregate, Conversion

#### R4.3: Parameter Type Indicators
Каждый параметр подсвечен цветом по типу:
- 🟦 number, 🟩 string, 🟨 boolean, 🟪 date, ⬜ any

#### R4.4: Inline Error Messages
Вместо generic error list:
```
IF(budget > , "Big", "Small")
          ↑ Expected: number, string, or field reference
```

#### R4.5: Formula Materialization
**КРИТИЧНО**: Формулы должны создавать реальные вычисляемые колонки в DataFrame.
- FormulaBar → Apply → new computed field добавляется к fields
- Computed field доступен всем виджетам
- Computed field видим в DataGrid как обычная колонка

**LOC estimate**: ~700 LOC refactor + new
**Files**: FormulaBar.svelte (rewrite), FormulaVisualEditor.svelte, new: FunctionDocs.svelte, SignatureHint.svelte

---

### Wave R5: Widget Templates v2
**Цель**: Шаблоны адаптируются к полям проекта

#### R5.1: Field Mapping Wizard
При применении шаблона:
```
Шаблон "Дашборд" требует:
  Status field:  [ status     ▾ ]  ← auto-detected
  Date field:    [ startDate  ▾ ]  ← auto-detected
  Number field:  [ budget     ▾ ]  ← auto-detected
  Boolean field: [ completed  ▾ ]  ← auto-detected
  
  [Применить с маппингом] [Отмена]
```

#### R5.2: Template Preview
Показать мини-preview как будет выглядеть дашборд до применения.

#### R5.3: Template Field Validation
Если поля не найдены — показать warning + suggestions (ближайшее совпадение по имени/типу).

#### R5.4: Widget Pipeline Pre-configuration
Шаблоны должны создавать widgets с РАБОЧИМ pipeline:
- Kanban+ Checklist → pipeline с filter step (boolean field = true/false)
- Analytics Comparison → pipeline с group-by + aggregate

**LOC estimate**: ~400 LOC
**Files**: widgetTemplates.ts (rewrite), new: TemplateWizard.svelte

---

### Wave R6: Widget Drag & Drop + Layout
**Цель**: Свободное перетаскивание и масштабирование виджетов

#### R6.1: Free-form Grid Layout
- 12-column CSS grid (уже есть) + drag-to-reposition
- Widgets перетаскиваются за заголовок
- Drop zones подсвечиваются при drag
- Snap to grid

#### R6.2: Widget Resize Handles
- 4 угла + 4 стороны (уже есть `use:resizable`, но не на всех виджетах)
- Min/max constraints из widgetRegistry
- Resize preview (ghost border)

#### R6.3: Layout Presets
- "Stack" (текущий), "2 columns", "Dashboard (2+1)", "Full grid"
- One-click layout switch

#### R6.4: Widget Collapse/Expand
Уже есть, но доработать:
- Collapsed = single-line с summary (count, chart type, etc.)
- Animate transition

**LOC estimate**: ~500 LOC
**Files**: DatabaseViewCanvas.svelte (refactor), new: LayoutPresets.svelte

---

### Wave R7: Demo Project v2
**Цель**: Демо-проект показывает ВСЕ возможности из коробки

#### R7.1: Pre-configured Database View
Демо должен включать Database View с:
- DataTable (с сортировкой, группировкой, conditional formatting)
- Chart (bar по status + line по date)
- Stats (3 карточки: Total, In Progress count, Average budget)
- Comparison (2 метрики: Budget plan vs actual)
- Checklist (field: completed)
- FilterTabs (по status)
- SummaryRow (count + sum budget)

#### R7.2: Formula Examples
Добавить 3-5 computed formula fields:
- `Overdue?`: `IF(AND(dueDate < NOW(), status != "done"), "⚠️ Overdue", "")`
- `Days Left`: `DAYS(dueDate, NOW())`
- `Budget %`: `TO_PERCENT(budget / 100000)`

#### R7.3: i18n Demo Content
- EN + RU варианты demo project (по языку пользователя)

#### R7.4: Guided First Run
При первом открытии демо:
- Tooltip tour: "Это Stats виджет → Кликните ⚙ для настройки"
- 5-7 шагов, dismissible

**LOC estimate**: ~600 LOC
**Files**: demoProject.ts (rewrite), new: GuidedTour.svelte

> **NOTE**: Этот пункт — на будущее, после R1-R6. Записать в техзадание.

---

### Wave R8: Page Open Modes
**Цель**: Открытие записей как в Notion (side peek, center peek, full page)

#### R8.1: Side Peek
- Клик на строку → правая панель (40% ширины) с содержимым заметки
- Таблица остаётся интерактивной слева
- Закрытие: Esc или кнопка

#### R8.2: Center Peek
- Modal по центру с содержимым
- Быстрое редактирование properties

#### R8.3: Settings per View
- View settings → "Open pages in": Side peek / Center peek / Full page

**LOC estimate**: ~500 LOC
**Files**: new: SidePeek.svelte, CenterPeek.svelte, RecordPreview.svelte

---

### Wave R9: Missing Table Features
**Цель**: Паритет с Notion по работе с таблицей

#### R9.1: Search within View
- 🔍 кнопка в toolbar → inline search bar
- Fuzzy match по всем видимым полям
- Highlight matched cells

#### R9.2: Inline Add Property
- "+" кнопка справа → field name + type picker
- Создание нового свойства прямо из table view

#### R9.3: Conditional Color UI
- View settings → "Conditional color"
- Rule builder: [property] [condition] [color for row / cell]
- 10+ цветов (Notion palette)

#### R9.4: Column Duplicate / Insert Left / Insert Right
Расширить context menu колонки.

**LOC estimate**: ~600 LOC
**Files**: DataGrid.svelte, GridHeader.svelte, new: SearchBar.svelte, ConditionalColorEditor.svelte

---

### Wave R10: Polish & Integration Testing
**Цель**: Всё работает вместе, всё тестируемо

#### R10.1: Full Integration Tests
- E2E test: create widget → configure → verify output
- E2E test: pipeline filter → group → aggregate → verify
- E2E test: formula → computed column → visible in table

#### R10.2: Accessibility Audit
- Keyboard navigation через все новые UI
- Screen reader testing
- WCAG 2.1 AA compliance check

#### R10.3: Mobile/Touch Audit
- Все новые UI элементы: touch target ≥ 44px
- Responsive breakpoints verified

#### R10.4: Performance
- Virtual scroll с новым grid
- Pipeline execution ≤ 100ms для 1000 записей
- Lazy loading для widget configs

**LOC estimate**: ~400 LOC tests + fixes

---

## 3. ПРИОРИТИЗАЦИЯ

### КРИТИЧЕСКИЙ ПУТЬ (блокирует тестирование)
```
R2 (Pipeline) → R3 (Widget Config) → R1 (DataGrid) → R4 (Formula)
```

### ПОРЯДОК ВЫПОЛНЕНИЯ

| # | Волна | Зависимость | Обоснование |
|---|-------|-------------|-------------|
| 1 | **R2: Pipeline Editor** | — | Разблокирует ВСЮ функциональность pipeline |
| 2 | **R3: Widget Config** | R2 | Разблокирует 5 виджетов |
| 3 | **R4: Formula Materialization** | R3 | Формулы станут видимы |
| 4 | **R1: DataGrid Redesign** | — | Визуальное качество |
| 5 | **R5: Templates v2** | R2, R3 | Шаблоны используют pipeline + config |
| 6 | **R9: Missing Table Features** | R1 | Search, conditional color, add property |
| 7 | **R6: Widget DnD + Layout** | R3 | Модульность |
| 8 | **R8: Page Open Modes** | R1 | Side peek / center peek |
| 9 | **R7: Demo v2** | R1-R6 | Требует все предыдущие волны | 
| 10 | **R10: Polish** | R1-R9 | Финальная верификация |

---

## 4. ОЦЕНКА МАСШТАБА

| Метрика | Значение |
|---------|----------|
| Новый код | ~5,500 LOC |
| Refactored код | ~2,000 LOC |
| Новые компоненты | ~20 Svelte |
| Новые тесты | ~150 |
| Затрагиваемые файлы | ~35 |

---

## 5. FUTURE BACKLOG (после рефакторинга)

Задачи, отложенные до завершения R1-R10:

| ID | Задача | Приоритет |
|----|--------|-----------|
| F1 | Timeline/Gantt view | P1 — главный gap vs Notion |
| F2 | List view (минималистичный) | P2 |
| F3 | Form view (data input) | P2 |
| F4 | Database automations | P3 |
| F5 | AI-assisted formula builder | P3 |
| F6 | Comments in properties | P3 |
| F7 | RTL language support | P3 |
| F8 | Print/export view | P3 |
| **F9** | **Demo Project v2 — полная преднастроенная база** | **P1 — сразу после R1-R6** |

---

## 6. МЕТРИКИ УСПЕХА

Рефакторинг считается завершённым когда:

1. **Pipeline**: Все 6 шагов конфигурируемы через UI без JSON
2. **Виджеты**: Все 8 виджетов имеют inline config panel
3. **Формулы**: Computed columns видимы в таблице
4. **Таблица**: Column menu = 10+ действий, search в view
5. **Шаблоны**: Field mapping wizard при применении
6. **Демо**: Открывается с настроенной базой (задача F9, после основного рефакторинга)
7. **Тесты**: 50+ suites, 1000+ tests, 0 TS errors
8. **Сборка**: main.js ≤ 2.5MB

---

## APPENDIX A: Notion UX Patterns для справки

### A.1: Column Header Click → Dropdown
```
┌─────────────────────┐
│ Sort ascending       │
│ Sort descending      │
│─────────────────────│
│ Filter               │
│─────────────────────│
│ Insert left          │
│ Insert right         │
│─────────────────────│
│ Edit property        │
│ Type: Select ▸       │
│ Duplicate            │
│─────────────────────│
│ Freeze up to column  │
│ Wrap column          │
│─────────────────────│
│ Hide                 │
│ Delete               │
└─────────────────────┘
```

### A.2: Filter Toolbar Pattern
```
[🔍] [⊞ Filter ②] [↕ Sort ①] [≡ Group: Status] [⊟ Properties] [⋯]
                 ↓
┌─────────────────────────────────────┐
│ Where [Status ▾] [is ▾] [Done ▾]   │  [✕]
│ And   [Priority▾] [is ▾] [High ▾]  │  [✕]
│                                     │
│ [+ Add filter]  [+ Add filter group]│
│                 [Save for everyone] │
└─────────────────────────────────────┘
```

### A.3: Widget Config Inline Pattern (наш уникальный)
```
┌── Stats Widget ──────── [⚙] [⛭] [✕] ──┐
│ ┌─ Config ─────────────────────────────┐│
│ │ Cards:                               ││
│ │  [1] Total   | count | all    [✕]   ││
│ │  [2] Budget  | sum   | number [✕]   ││
│ │  [3] Average | avg   | number [✕]   ││
│ │  [+ Add card]                        ││
│ │  Columns: [2 ▾]  Sparkline: [☐]     ││
│ └──────────────────────────────────────┘│
│                                         │
│  42 Total    125,000 Budget    2,976 Avg│
└─────────────────────────────────────────┘
```

### A.4: Formula Editor Layout (target)
```
┌── Formula Editor ──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ IF(budget > 1000, "Big", "Small")                       │   │
│ └──────────────────────────────────────────────────────────┘   │
│ ┌─ Hint ─────────────────────────────────────────────────────┐ │
│ │ IF(condition, true_value, false_value)                      │ │
│ │    ↑ condition: boolean — currently: budget > 1000 ✓        │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ Functions ─────────┐ ┌─ Documentation ──────────────────┐  │
│ │ ▸ Logic             │ │ IF(condition, true_val, false_val)│  │
│ │   IF ← selected     │ │                                  │  │
│ │   AND               │ │ Returns true_val if condition     │  │
│ │   OR                │ │ is truthy, otherwise false_val.   │  │
│ │   NOT               │ │                                  │  │
│ │ ▸ Math              │ │ Examples:                        │  │
│ │ ▸ String            │ │ IF(status="done", "✅", "⏳")    │  │
│ │ ▸ Date              │ │ IF(budget>0, budget*1.1, 0)      │  │
│ │ ▸ Financial         │ │                                  │  │
│ │ ▸ Statistical       │ │ Return type: matches true_val    │  │
│ └─────────────────────┘ └──────────────────────────────────┘  │
│                                                                │
│ Preview: "Big"  (row: "Редизайн личного кабинета")             │
│                                     [Отмена] [Применить]       │
└────────────────────────────────────────────────────────────────┘
```

# NOTION DATABASE INTEGRATION — MASTER ARCHITECTURE GUIDE
## Глобальное руководство по адаптивному переносу баз данных Notion в Obsidian Projects Plus

> **Документ:** Независимая архитектурная документация  
> **Автор:** Chief Engineer / Reverse Engineering Analysis  
> **Дата создания:** 2026-04-28  
> **Целевой плагин:** obs-projects-plus (v3.4.1 WIP → v3.5.0+)  
> **Репозиторий:** https://github.com/ParkPavel/obs-projects-plus  
> **Статус:** LIVING DOCUMENT — обновляется по мере реализации фаз  

---

## НАВИГАЦИЯ

| Часть | Содержание |
|-------|-----------|
| [Часть I](#часть-i-notion-полный-обратный-инжиниринг) | Notion — полный обратный инжиниринг баз данных |
| [Часть II](#часть-ii-obsidian-программная-платформа) | Obsidian — программная платформа |
| [Часть III](#часть-iii-dataview-плагин---архитектура) | Dataview плагин — архитектура |
| [Часть IV](#часть-iv-obsidian-projects-plus---текущая-архитектура) | Obsidian Projects Plus — текущая архитектура |
| [Часть V](#часть-v-матрица-функций-notion--opp) | Матрица функций Notion → OPP |
| [Часть VI](#часть-vi-план-реализации---фазовый-blueprint) | Blueprint реализации |
| [Часть VII](#часть-vii-технические-ограничения-и-адаптации) | Ограничения и адаптации |
| [Часть VIII](#часть-viii-справочник-api-и-типов) | Справочник API и типов |

---

# ЧАСТЬ I: NOTION — ПОЛНЫЙ ОБРАТНЫЙ ИНЖИНИРИНГ

## 1.1 Концептуальная модель данных Notion

### 1.1.1 Архитектура хранения (Notion SaaS)

```
Notion Cloud Infrastructure
├── Workspace (рабочее пространство)
│   ├── Members + Permissions (OAuth + JWT)
│   ├── Pages (узлы дерева контента)
│   │   ├── Blocks (атомарные единицы контента)
│   │   │   ├── paragraph, heading_1..3
│   │   │   ├── bulleted_list_item, numbered_list_item
│   │   │   ├── to_do, toggle
│   │   │   ├── code, equation, divider
│   │   │   ├── image, video, file, pdf
│   │   │   ├── table_of_contents, breadcrumb
│   │   │   ├── column, column_list
│   │   │   ├── callout, quote
│   │   │   ├── synced_block, template
│   │   │   ├── child_page, child_database
│   │   │   └── embed, bookmark, link_preview
│   │   └── Properties (frontmatter только для Database-pages)
│   └── Databases (коллекции однотипных страниц)
│       ├── Schema (определение свойств)
│       ├── Items (страницы с заполненными свойствами)
│       ├── Views (представления той же коллекции)
│       └── Automation (триггеры + действия)
```

**Ключевое архитектурное отличие от Obsidian:**
- Notion хранит данные в облачной СУБД (PostgreSQL + Redis кэш)
- Каждый item имеет UUID, revision history, collaborative locks
- Property values — типизированные JSON-объекты в базе данных
- В Obsidian: данные = YAML frontmatter в markdown-файлах на диске

---

### 1.1.2 Типы баз данных Notion

```
Database Types
├── Inline Database   — встроена внутрь страницы-родителя
└── Full-Page Database — отдельная страница = база данных

View Types (6 типов представлений для одной базы)
├── Table View        — строки × столбцы (основной формат)
├── Board View        — Kanban-доски (группировка по свойству)
├── Timeline View     — временная шкала (Gantt-подобный)
├── Calendar View     — месячный календарь по дате
├── Gallery View      — карточки с превью (фото/обложка)
└── List View         — минималистичный список (заголовок + свойства)
```

---

## 1.2 Система свойств (Properties) — полный каталог

### 1.2.1 Базовые свойства (20+ типов)

```
PROPERTY TYPES — ПОЛНЫЙ КАТАЛОГ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ТЕКСТОВЫЕ
├── title       — основное имя записи (всегда 1 поле, не удаляемо)
│   └── Хранение: string  |  UI: inline text
├── rich_text   — форматированный текст (bold/italic/link)
│   └── Хранение: [{text, annotations}]  |  UI: textarea
└── url         — ссылка (автоматически кликабельная)
    └── Хранение: string  |  UI: input[type=url]

ЧИСЛОВЫЕ
├── number      — число с форматированием
│   ├── Форматы: number, number_with_commas, percent
│   │            dollar/euro/pound/yen/ruble... (25 валют)
│   │            barometer, w_rating (эмодзи-визуализации)
│   └── Хранение: float64 | NULL
└── formula     — вычисляемое выражение (см. §1.3)

СПИСКИ / ТЕГИ
├── select      — один вариант из списка + цвет
│   └── Options: [{id, name, color}] | value: id | NULL
├── multi_select — несколько вариантов
│   └── Options: [{id, name, color}] | value: id[] | NULL
└── status      — расширенный select (3 группы: Not started/In progress/Done)
    └── Groups: [{name, color, option_ids[]}]

ДАТА / ВРЕМЯ
├── date        — дата и/или datetime + временной диапазон
│   └── Хранение: {start: ISO8601, end: ISO8601|null, timezone: string|null, time_zone?: string}
├── created_time — автоматическая дата создания записи
│   └── Хранение: ISO8601 (readonly, системное)
└── last_edited_time — автоматическая дата последнего редактирования
    └── Хранение: ISO8601 (readonly, системное)

ПОЛЬЗОВАТЕЛИ
├── people      — выбор одного/нескольких членов workspace
│   └── Хранение: [{id, name, avatar_url, email}]
├── created_by  — автоматическое заполнение при создании
│   └── Readonly системное поле
└── last_edited_by — автоматическое заполнение при редактировании
    └── Readonly системное поле

ФАЙЛЫ / МЕДИА
├── files       — прикреплённые файлы/изображения
│   └── Хранение: [{name, type: "file"|"external", url}]
└── cover       — обложка записи (для Gallery view)
    └── Хранение: {type, external|file: {url}}

ОТНОШЕНИЯ / ПРОИЗВОДНЫЕ
├── relation    — ссылка на записи другой (или той же) БД
│   ├── Конфигурация: {database_id, synced_property_id, synced_property_name}
│   ├── Тип: single_property | dual_property (двусторонняя)
│   └── Хранение: [{id: page_uuid}]
├── rollup      — агрегация по полю связанной БД
│   ├── Конфигурация: {relation_property_id, rollup_property_id, function}
│   ├── Функции: count, count_values, empty, not_empty, unique,
│   │            show_original, show_unique, sum, average,
│   │            median, min, max, range, earliest_date, latest_date,
│   │            date_range, checked, unchecked, percent_checked,
│   │            percent_unchecked, count_per_group, percent_per_group, sum_per_group
│   └── Хранение: computed value (readonly)
└── lookup      — поиск по тексту (Enterprise)

СПЕЦИАЛЬНЫЕ
├── checkbox    — boolean true/false
│   └── Хранение: boolean  |  UI: checkbox
├── email       — адрес электронной почты
│   └── Хранение: string  |  UI: input[type=email]
├── phone_number — телефонный номер
│   └── Хранение: string  |  UI: input[type=tel]
├── unique_id   — автоинкрементный или uuid идентификатор
│   └── Хранение: {prefix?: string, number: int}  |  Readonly
└── verification — поле проверки (новый тип, Enterprise)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.2.2 Property Configuration Schema

```json
{
  "property_id": "abc123",
  "name": "Status",
  "type": "status",
  "status": {
    "options": [
      {"id": "opt1", "name": "Not started", "color": "default"},
      {"id": "opt2", "name": "In Progress", "color": "blue"},
      {"id": "opt3", "name": "Done", "color": "green"}
    ],
    "groups": [
      {"id": "g1", "name": "To-do", "color": "gray", "option_ids": ["opt1"]},
      {"id": "g2", "name": "In progress", "color": "blue", "option_ids": ["opt2"]},
      {"id": "g3", "name": "Complete", "color": "green", "option_ids": ["opt3"]}
    ]
  }
}
```

---

## 1.3 Формульная система Notion

### 1.3.1 Типы данных в формулах

```
Notion Formula Types
├── String   — "text" + concat operations
├── Number   — float64 + arithmetic
├── Boolean  — true/false + logical operators
└── Date     — ISO date + date arithmetic functions
```

### 1.3.2 Полный каталог формульных функций Notion

```
ФУНКЦИИ NOTION FORMULA 2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

СТРОКОВЫЕ
concat(str...) → string
join(sep, str...) → string
slice(str, start, end?) → string
length(str) → number
format(value) → string
toNumber(str) → number
contains(str, substr) → boolean
replace(str, pattern, replacement) → string
replaceAll(str, pattern, replacement) → string
test(str, pattern) → boolean
lower(str) → string
upper(str) → string
split(str, delimiter) → list
padStart(str, length, char?) → string
padEnd(str, length, char?) → string
trim(str) → string                     [Formula 2.0]
trimStart(str) → string                [Formula 2.0]
trimEnd(str) → string                  [Formula 2.0]
link(text, url) → string              [Formula 2.0]
style(text, ...modifiers) → string    [Formula 2.0]
unstyle(str) → string                 [Formula 2.0]
repeat(str, n) → string               [Formula 2.0]
encode(str) → string                  [Formula 2.0 — URL encode]
decode(str) → string                  [Formula 2.0 — URL decode]

ЧИСЛОВЫЕ
abs(n) → number
cbrt(n) → number
ceil(n) → number
exp(n) → number
floor(n) → number
ln(n) → number
log10(n) → number
log2(n) → number
max(n...) → number
min(n...) → number
mod(n, d) → number
pow(n, e) → number
round(n) → number
sign(n) → number
sqrt(n) → number
toNumber(v) → number
unaryMinus(n) → number
unaryPlus(n) → number
sum(list) → number                     [Formula 2.0 — list aggregation]
product(list) → number                 [Formula 2.0]
mean(list) → number                    [Formula 2.0]
median(list) → number                  [Formula 2.0]

ЛОГИЧЕСКИЕ
and(bool...) → boolean
or(bool...) → boolean
not(bool) → boolean
if(cond, then, else) → any
ifs(cond1, v1, cond2, v2...) → any   [Formula 2.0]
equal(a, b) → boolean
unequal(a, b) → boolean
larger(a, b) → boolean
largerEq(a, b) → boolean
smaller(a, b) → boolean
smallerEq(a, b) → boolean
empty(value) → boolean
toBoolean(v) → boolean
switch(key, c1,v1,..., default) → any [Formula 2.0]

ДАТА / ВРЕМЯ
now() → date
today() → date                         [Formula 2.0]
timestamp(date) → number
fromTimestamp(ms) → date
dateAdd(date, n, unit) → date
dateSubtract(date, n, unit) → date
dateBetween(d1, d2, unit) → number
dateRange(d1, d2) → list              [Formula 2.0 — диапазон дат]
formatDate(date, format) → string
date(date) → number  (day of month 1–31)
day(date) → number   (day of week 0–6)
month(date) → number (0–11)
year(date) → number
hour(date) → number
minute(date) → number
second(date) → number
start(date_range) → date
end(date_range) → date
dateRange(d1, d2) → date_range

СПИСКИ (Formula 2.0)
map(list, fn) → list
filter(list, fn) → list
find(list, fn) → any
findIndex(list, fn) → number
sort(list, key?) → list
reverse(list) → list
includes(list, v) → boolean
at(list, i) → any
first(list) → any
last(list) → any
slice(list, start, end?) → list
length(list) → number
unique(list) → list
flat(list) → list
zip(list...) → list
reduce(list, fn, init) → any
range(start, end, step?) → list
concat(list...) → list
join(sep, list) → string
extract(list, prop) → list           [извлечь поле из объектов в списке]

СПЕЦИАЛЬНЫЕ
id() → string                        [UUID текущей записи]
prop("Property Name") → any          [динамическое обращение к полю]
lets(x=v, ..., body) → any          [Formula 2.0 — локальные переменные]
limit(n) → (используется с sort в списках)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 1.4 Система фильтрации Notion

### 1.4.1 Структура фильтра

```typescript
// Notion Filter DSL (упрощённая модель)
type NotionFilter =
  | { and: NotionFilter[] }
  | { or: NotionFilter[] }
  | PropertyFilter;

interface PropertyFilter {
  property: string;
  [type: string]: ConditionFilter;
}

// Пример структуры для разных типов:
// text:      { equals, does_not_equal, contains, does_not_contain,
//              starts_with, ends_with, is_empty, is_not_empty }
// number:    { equals, does_not_equal, greater_than, less_than,
//              greater_than_or_equal_to, less_than_or_equal_to,
//              is_empty, is_not_empty }
// checkbox:  { equals, does_not_equal }
// select:    { equals, does_not_equal, is_empty, is_not_empty }
// multi_select: { contains, does_not_contain, is_empty, is_not_empty }
// date:      { equals, before, after, on_or_before, on_or_after,
//              is_empty, is_not_empty, past_week, past_month, past_year,
//              next_week, next_month, next_year, this_week }
// relation:  { contains, does_not_contain, is_empty, is_not_empty }
// formula:   по типу результата (string/number/boolean/date)
// rollup:    { any, every, none } + вложенный фильтр по типу поля
// files:     { is_empty, is_not_empty }
// status:    { equals, does_not_equal, is_empty, is_not_empty }
```

### 1.4.2 Динамические фильтры ("Relative Date" filters)

Notion поддерживает временные фильтры относительно текущей даты:
- `past_week`, `past_month`, `past_year`
- `this_week`
- `next_week`, `next_month`, `next_year`

Это server-side вычисляемые предикаты — в OPP их нужно реализовать client-side.

---

## 1.5 Система сортировки Notion

```typescript
interface NotionSort {
  property: string;
  direction: "ascending" | "descending";
  timestamp?: "created_time" | "last_edited_time"; // альтернатива property
}

// API поддерживает массив: сортировка по нескольким полям последовательно
type SortsArray = NotionSort[];
```

---

## 1.6 Система группировки

### 1.6.1 Группировка в Table View / Gallery / List

```typescript
interface NotionGroupBy {
  property: string;
  direction?: "ascending" | "descending";
  // Для date-полей:
  group_by?: "day" | "week" | "month" | "year"; 
  // Для select/status:
  // группы = уникальные значения автоматически
}
```

### 1.6.2 Sub-grouping (вложенная группировка)

Notion Table View поддерживает до 2-х уровней группировки:
- Primary group: по любому свойству
- Sub-group: по второму свойству (только для некоторых типов)

---

## 1.7 Notion Views — детальная спецификация

### 1.7.1 Table View

```
TABLE VIEW COMPONENTS
├── Column Headers
│   ├── Property name (с иконкой типа)
│   ├── Sort indicator (↑↓)
│   ├── Context menu (Hide, Filter by, Sort ascending/descending,
│   │                 Wrap column, Freeze up to column, Insert left/right,
│   │                 Duplicate, Rename, Delete, Change type)
│   └── Resize handle (drag)
│
├── Row Actions
│   ├── Checkbox (bulk select)
│   ├── Open in full page (→ icon)
│   ├── Context menu (Open, Open in new tab, Copy link, Rename,
│   │                 Delete, Duplicate, Move to, Add to Favorites)
│   └── Drag handle (row reorder)
│
├── Toolbar (top)
│   ├── Filter (active filters displayed as chips)
│   ├── Sort (active sorts displayed)
│   ├── Group by
│   ├── Sub-group by
│   ├── Properties (show/hide columns)
│   └── ... (Automations, Templates, Export, Import)
│
├── Footer Row (aggregation)
│   ├── Count, Count all, Count values, Count unique, Empty, Not empty
│   ├── Sum, Average, Median, Min, Max, Range (для числовых)
│   └── Earliest date, Latest date, Date range (для date)
│
└── New Record Row
    └── "New" button или пустая строка для inline-создания
```

### 1.7.2 Board View (Kanban)

```
BOARD VIEW COMPONENTS
├── Columns (группы по select/status свойству)
│   ├── Column Header: название группы + счётчик + кнопки
│   ├── Cards (записи в виде карточек)
│   │   ├── Обложка (если задано)
│   │   ├── Заголовок (title property)
│   │   ├── Visible properties (настраиваемые)
│   │   └── Context menu карточки
│   └── "New" button внизу каждой колонки
│
├── Toolbar
│   ├── Group by (обязательно выбрать поле)
│   ├── Sub-group (второй уровень)
│   ├── Properties (видимые поля на карточке)
│   ├── Filter, Sort
│   └── Board layout: No grouping / Vertical columns / Horizontal rows
│
└── Column Management
    ├── Add group (создать новое значение select)
    ├── Hide group
    ├── Delete group (с переносом карточек)
    └── Drag columns to reorder
```

### 1.7.3 Timeline View (Gantt)

```
TIMELINE VIEW COMPONENTS
├── Row panel (слева — список записей)
│   └── Title + configurable properties
├── Timeline grid (справа — временная шкала)
│   ├── Time header: day/week/biweekly/month/quarter/year
│   ├── Bars (отрезки с start date → end date)
│   │   ├── Color по свойству
│   │   ├── Label (title или configurable field)
│   │   └── Drag to move / resize to change dates
│   └── Today indicator (вертикальная линия)
├── Grouping (горизонтальные группы строк)
└── Dependencies (стрелки: requires Timeline Pro)
```

### 1.7.4 Calendar View

```
CALENDAR VIEW COMPONENTS
├── Month grid / Week grid (переключение)
├── Date cells
│   ├── Records positioned по date property
│   ├── Drag to reassign date
│   ├── "+ N more" overflow handling
│   └── Quick create on click
├── Toolbar
│   ├── Navigate (← Месяц →)
│   ├── Show by (date field selector)
│   └── Filter, Sort, Properties
└── Day detail panel (click on "+N more" → список записей дня)
```

### 1.7.5 Gallery View

```
GALLERY VIEW COMPONENTS
├── Card grid (auto-responsive columns)
├── Cards
│   ├── Обложка (cover property или preview of page content)
│   ├── Title
│   ├── Visible properties (до 12 свойств под обложкой)
│   └── Context menu
├── Card Size: Small / Medium / Large
├── Fit image: Cover / Contain
├── Show: Cover / Files property / Page cover / Page content
└── Toolbar: Filter, Sort, Group by, Properties
```

### 1.7.6 List View

```
LIST VIEW COMPONENTS
├── Minimal rows (title + visible properties в строку)
├── Compact, без iframe/embed
├── Properties toggle (inline или hidden)
└── Toolbar: same as Table
```

---

## 1.8 Relation & Rollup — детальный дизайн

### 1.8.1 Relation (Связи)

```
RELATION TYPES
├── One-way relation
│   ├── Database A → Database B
│   ├── На странице A появляется поле со ссылками на записи B
│   └── На страницах B НЕ появляется обратная ссылка
└── Two-way (dual property) relation
    ├── Database A ↔ Database B
    ├── На A — поле "Related B" [{id}...]
    └── На B — автоматически поле "Related A" [{id}...]

RELATION DATA FLOW
Source Record (A)
    └── relation_field = [{id: "page_uuid_1"}, {id: "page_uuid_2"}]
                          ↓
              Resolve via Notion API / cache
                          ↓
              Target Records (B):
                  page_uuid_1 → {title: "Task 1", status: "Done", estimate: 3}
                  page_uuid_2 → {title: "Task 2", status: "In Progress", estimate: 5}
```

### 1.8.2 Rollup (Свёртка)

```
ROLLUP CONFIGURATION
├── relation_property: "Tasks" (какое relation-поле использовать)
├── rollup_property:   "Estimate" (какое поле в целевой БД читать)
└── function:         "sum" → 8

ROLLUP FUNCTIONS (полный список)
Общие:
  count              — количество связанных записей
  count_values       — количество непустых значений поля
  empty              — количество пустых значений
  not_empty          — количество непустых значений
  unique             — количество уникальных значений
  show_original      — показывает все значения (array)
  show_unique        — показывает уникальные (array)
Числовые:
  sum, average, median, min, max, range
Дата:
  earliest_date, latest_date, date_range
Boolean:
  checked, unchecked, percent_checked, percent_unchecked
Grouped:
  count_per_group, percent_per_group, sum_per_group
```

---

## 1.9 Automation (Автоматизация)

### 1.9.1 Triggers

```
TRIGGERS
├── Property changed     — при изменении значения свойства
│   └── {property: string, value_type?: "any"|"empty"|"not_empty"|"equals"}
├── Record added         — при создании новой записи
├── Record deleted       — при удалении записи
└── Schedule             — по расписанию (hourly/daily/weekly/monthly)
```

### 1.9.2 Actions

```
ACTIONS
├── Edit property        — установить/изменить значение свойства
├── Add page             — создать новую запись
├── Send notification    — уведомить члена workspace
├── Send email           — email через интеграцию
├── Post to Slack        — webhook в Slack
└── Grant access         — изменить права доступа
```

> **OPP Note:** Automation — cloud-only функциональность. Частичный аналог: Obsidian Templater / Dataview inline queries для вычислений. Полная реализация через hooks в `dataApi.ts` при изменении frontmatter.

---

## 1.10 Linked Databases и Views

### 1.10.1 Linked Database

```
Оригинальная База → Linked View (alias)
├── Разные фильтры на каждой странице
├── Разные sorts на каждой странице
├── Одна и та же коллекция данных
└── Независимые настройки видимых свойств
```

Аналог в OPP: несколько `views` в рамках одного `ProjectDefinition`, каждый с `view.filter` и `view.sort`.

### 1.10.2 Sub-Items (иерархия)

```
Notion Sub-Items
├── Любая запись может содержать вложенные дочерние записи
├── Хранятся как Relations в той же БД
└── Tree-view режим в Table View
```

> **OPP Path:** Wiki-links + parent/child relations через frontmatter `parent:` поле.

---

## 1.11 Notion API — Public HTTP API v1

### 1.11.1 Endpoints

```
BASE URL: https://api.notion.com/v1

DATABASES
GET    /databases/{database_id}
POST   /databases             (create)
PATCH  /databases/{database_id} (update schema)
POST   /databases/{database_id}/query (retrieve records)

PAGES (records)
GET    /pages/{page_id}
POST   /pages                 (create record)
PATCH  /pages/{page_id}       (update properties)
DELETE /blocks/{block_id}     (archive = soft delete)

BLOCKS (page content)
GET    /blocks/{block_id}/children
PATCH  /blocks/{block_id}
DELETE /blocks/{block_id}

SEARCH
POST   /search                (поиск по workspace)

USERS
GET    /users
GET    /users/me
```

### 1.11.2 Pagination

```json
{
  "results": [...],
  "next_cursor": "cursor_token",
  "has_more": true,
  "type": "page_or_database",
  "page_or_database": {}
}
```

---

# ЧАСТЬ II: OBSIDIAN — ПРОГРАММНАЯ ПЛАТФОРМА

## 2.1 Архитектура Obsidian

```
Obsidian Application Stack
├── Electron Shell (Chromium + Node.js)
│   ├── Main Process (Node.js)
│   │   ├── File I/O (native fs, chokidar watcher)
│   │   ├── Window management
│   │   └── Auto-update
│   └── Renderer Process (Chromium)
│       ├── Obsidian Core (TypeScript + CSS)
│       │   ├── Vault (файловая система абстракция)
│       │   ├── MetadataCache (индекс frontmatter + links)
│       │   ├── Workspace (UI layout: leaves, splits, tabs)
│       │   ├── Editor (CodeMirror 6)
│       │   └── Plugin API
│       └── Plugins (WebWorker + main thread)
│
├── Vault Storage
│   └── Markdown files (.md) + assets + config (.obsidian/)
│
└── Mobile (iOS/Android) — Capacitor + native WebView
    └── Same Plugin API, ограниченный Node.js доступ
```

## 2.2 Obsidian Plugin API — Ключевые интерфейсы

### 2.2.1 Plugin Lifecycle

```typescript
abstract class Plugin {
  app: App;
  manifest: PluginManifest;

  // Lifecycle hooks
  abstract onload(): Promise<void>;
  onunload(): void;

  // Settings persistence
  loadData(): Promise<any>;
  saveData(data: any): Promise<void>;

  // UI registration
  addRibbonIcon(icon, title, callback): HTMLElement;
  addStatusBarItem(): HTMLElement;
  addCommand(command: Command): Command;
  addSettingTab(tab: PluginSettingTab): void;

  // File utilities
  registerMarkdownPostProcessor(processor, priority?): void;
  registerMarkdownCodeBlockProcessor(language, handler): void;
  registerView(type, viewCreator): void;
  registerExtensions(extensions, viewType): void;

  // Event system
  registerEvent(event: EventRef): void;
  registerDomEvent(el, event, callback): void;
  registerInterval(id: number): number;
}
```

### 2.2.2 App Interface

```typescript
interface App {
  vault: Vault;
  workspace: Workspace;
  metadataCache: MetadataCache;
  fileManager: FileManager;
  keymap: Keymap;
  scope: Scope;
  lastEvent: UserEvent | null;
}
```

### 2.2.3 Vault API

```typescript
abstract class Vault extends Events {
  adapter: DataAdapter;
  configDir: string;
  getName(): string;

  // File CRUD
  create(path, data, options?): Promise<TFile>;
  createFolder(path): Promise<TFolder>;
  read(file: TFile): Promise<string>;
  cachedRead(file: TFile): Promise<string>;
  modify(file: TFile, data): Promise<void>;
  delete(file: AbstractFile, force?): Promise<void>;
  rename(file: AbstractFile, newPath): Promise<void>;
  copy(file: TFile, newPath): Promise<TFile>;

  // Navigation
  getAbstractFileByPath(path): AbstractFile | null;
  getFileByPath(path): TFile | null;
  getFolderByPath(path): TFolder | null;
  getRoot(): TFolder;
  getAllLoadedFiles(): AbstractFile[];
  getMarkdownFiles(): TFile[];
  getFiles(): TFile[];

  // Events
  on("create", callback: (file) => any): EventRef;
  on("modify", callback: (file) => any): EventRef;
  on("delete", callback: (file) => any): EventRef;
  on("rename", callback: (file, oldPath) => any): EventRef;
}
```

### 2.2.4 MetadataCache API

```typescript
abstract class MetadataCache extends Events {
  // Чтение кэша
  getCache(path: string): CachedMetadata | null;
  getFileCache(file: TFile): CachedMetadata | null;

  // Ссылки
  resolvedLinks: Record<string, Record<string, number>>;
  // resolvedLinks[sourcePath][targetPath] = count

  unresolvedLinks: Record<string, Record<string, number>>;

  getFirstLinkpathDest(linkpath, sourcePath): TFile | null;
  fileToLinktext(file, sourcePath, omitMdExtension?): string;

  // Events
  on("changed", callback: (file, data, cache) => any): EventRef;
  on("resolved", callback: () => any): EventRef; // когда все кэши готовы
}

interface CachedMetadata {
  links?: LinkCache[];
  embeds?: EmbedCache[];
  tags?: TagCache[];
  headings?: HeadingCache[];
  sections?: SectionCache[];
  listItems?: ListItemCache[];
  frontmatter?: Record<string, any>;
  frontmatterLinks?: FrontmatterLinkCache[];
  blocks?: Record<string, BlockCache>;
}
```

### 2.2.5 FileManager API

```typescript
abstract class FileManager {
  // Основное API для frontmatter
  processFrontMatter(
    file: TFile,
    fn: (frontmatter: Record<string, any>) => void,
    options?: DataWriteOptions
  ): Promise<void>;
  // ↑ Atomic read-modify-write frontmatter (безопасно, без конфликтов)

  // Создание файлов
  createNewMarkdownFile(folder, name): Promise<TFile>;
  generateMarkdownLink(file, sourcePath, subpath?, alias?): string;

  // Переименование / перемещение
  renameFile(file, newPath): Promise<void>;
  getNewFileParent(sourcePath): TFolder;
}
```

### 2.2.6 Workspace API

```typescript
abstract class Workspace extends Events {
  activeLeaf: WorkspaceLeaf | null;
  leftSplit: WorkspaceSidedock | WorkspaceMobileDrawer;
  rightSplit: WorkspaceSidedock | WorkspaceMobileDrawer;
  rootSplit: WorkspaceRoot;

  getLeaf(newLeaf?): WorkspaceLeaf;
  getLeafById(id): WorkspaceLeaf | null;
  getLeavesOfType(viewType): WorkspaceLeaf[];

  // Events
  on("active-leaf-change", cb: (leaf) => any): EventRef;
  on("file-open", cb: (file) => any): EventRef;
  on("layout-change", cb: () => any): EventRef;
  on("window-open", cb: (win, window) => any): EventRef;
}
```

### 2.2.7 Custom View API

```typescript
abstract class ItemView extends View {
  contentEl: HTMLElement;

  abstract getViewType(): string;
  abstract getDisplayText(): string;
  getIcon(): IconName;

  onOpen(): Promise<void>;
  onClose(): Promise<void>;
}
```

### 2.2.8 Важные вспомогательные классы

```typescript
// Modal диалог
abstract class Modal {
  app: App;
  contentEl: HTMLElement;
  titleEl: HTMLElement;

  open(): void;
  close(): void;
  abstract onOpen(): void;
  abstract onClose(): void;
}

// Notice уведомление
class Notice {
  constructor(message: string | DocumentFragment, timeout?: number);
  setMessage(message): Notice;
  hide(): void;
}

// Suggest (autocomplete dropdown)
abstract class AbstractInputSuggest<T> {
  protected inputEl: HTMLInputElement | HTMLTextAreaElement;
  abstract getSuggestions(query: string): T[] | Promise<T[]>;
  abstract renderSuggestion(item: T, el: HTMLElement): void;
  abstract selectSuggestion(item: T, evt: KeyboardEvent | MouseEvent): void;
}
```

---

## 2.3 Obsidian Frontmatter — Правила и ограничения

### 2.3.1 YAML структура

```yaml
---
# Основные поля
title: "Название заметки"
date: 2024-01-15
tags: [project, finance]
status: "In Progress"

# Вложенные объекты
assignee:
  name: "Иван"
  email: "ivan@example.com"

# Массивы объектов (поддержка UNNEST в OPP)
sets:
  - reps: 8
    weight: 100
    rest: 90

# Ссылки на другие файлы (Obsidian wiki-link format)
parent: "[[Project A]]"
related:
  - "[[Task 1]]"
  - "[[Task 2]]"
---
```

### 2.3.2 Типы значений в frontmatter

| YAML тип | Obsidian тип | OPP DataFieldType |
|---------|-------------|-------------------|
| string | string | String |
| integer / float | number | Number |
| true / false | boolean | Boolean |
| YYYY-MM-DD | date | Date |
| [val1, val2] | list | List |
| `[[file]]` (string) | link | String (resolved via MetadataCache) |
| `{key: val}` | object | Unknown (требует UNNEST) |
| `[{key: val}]` | list of objects | Unknown → UNNEST → rows |

### 2.3.3 Ограничения frontmatter

1. **Нет UUID** — идентификатор = file path (изменяется при rename)
2. **Нет schema enforcement** — каждый файл может иметь разные поля
3. **Нет транзакционности** — `processFrontMatter` атомарен для одного файла, но не для нескольких
4. **Нет истории** — только текущее состояние (Git для versioning)
5. **Нет server-side** — всё вычисляется на клиенте
6. **Кодировка** — только UTF-8

---

## 2.4 Obsidian Links System

```
ТИПЫ ССЫЛОК
├── Wiki-links:     [[Target Note]]
│                   [[Target Note|Alias]]
│                   [[Target Note#Heading]]
├── Markdown links: [Alias](path/to/note.md)
│                   [Alias](https://external.url)
└── Embedded:       ![[Image.png]]
                    ![[Note#Section]]

RESOLVING PROCESS
"[[Tasks#My Task]]"
  → MetadataCache.getFirstLinkpathDest("Tasks", sourcePath)
  → TFile: projects/Tasks.md
  → CachedMetadata.headings → find "My Task"
  → Path: "projects/Tasks.md#My Task"

BACKLINKS
resolvedLinks["A.md"]["B.md"] = 2
→ B.md упоминается 2 раза в A.md
```

---

# ЧАСТЬ III: DATAVIEW ПЛАГИН — АРХИТЕКТУРА

## 3.1 Dataview Overview

Dataview — мощный плагин запросов для Obsidian, который предоставляет:
- SQL-подобный язык запросов для frontmatter
- JavaScript API для программного доступа
- Виртуальные поля (implicit fields)

**Репозиторий:** https://github.com/blacksmithgu/obsidian-dataview  
**API поверхность:** `app.plugins.getPlugin("dataview")?.api`

## 3.2 Dataview Query Language (DQL)

### 3.2.1 Типы запросов

```sql
-- LIST: список страниц
LIST
FROM #tag OR "folder/path"
WHERE status = "active"
SORT date DESC

-- TABLE: табличное представление
TABLE
  file.name AS "Title",
  date AS "Due",
  status
FROM #project
WHERE date >= date(today)
SORT date ASC

-- TASK: задачи (- [ ] и - [x])
TASK
FROM "Projects"
WHERE !completed

-- CALENDAR: отображение по дате
CALENDAR date
FROM #meeting
```

### 3.2.2 DQL Functions

```
STRING: lower, upper, replace, contains, startswith, endswith,
        regextest, regexmatch, regexreplace, split, join, strip,
        lpad, rpad, length, string, link, embed

NUMBER: number, min, max, sum, product, average, minby, maxby,
        reduce, floor, ceil, round, trunc, abs, log, exp, pow,
        sqrt, sign

DATE: date, dur, time, dateformat, durationformat, localtime,
      striptime, date(today), date(now), date(sow), date(som),
      date(soy), date(eow), date(eom), date(eoy)

OBJECT: object, extract, nonnull, default, choice, typeof

ARRAY: array, list, filter, map, flat, slice, join, sort, reverse,
       contains, econtains, containsword, any, all, none, unique,
       rows (свертка FLATTEN результата)

UTILITY: typeof, default, choice, hash, meta(link), icontains
```

### 3.2.3 Implicit Fields (автоматические поля)

```typescript
// Доступны для каждого файла без явного frontmatter
interface DataviewImplicitFields {
  "file.path": string;       // полный путь
  "file.folder": string;     // папка
  "file.name": string;       // имя без расширения
  "file.link": Link;         // wiki-link ссылка на файл
  "file.size": number;       // размер в байтах
  "file.ctime": DateTime;    // дата создания
  "file.mtime": DateTime;    // дата изменения
  "file.cday": DateTime;     // день создания (без времени)
  "file.mday": DateTime;     // день изменения
  "file.tags": string[];     // все теги включая вложенные
  "file.etags": string[];    // explicit tags (только #tag)
  "file.inlinks": Link[];    // входящие ссылки
  "file.outlinks": Link[];   // исходящие ссылки
  "file.aliases": string[];  // из frontmatter aliases
  "file.tasks": STask[];     // задачи в файле
  "file.lists": ListItem[];  // пункты списков
  "file.frontmatter": Record<string, any>; // raw frontmatter
  "file.starred": boolean;   // в избранном
  "file.day": DateTime | null; // дата из имени файла (если Daily Notes формат)
}
```

## 3.3 Dataview JavaScript API

### 3.3.1 API Interface

```typescript
interface DataviewApi {
  // Основные запросы
  query(source: string, originFile?: string, settings?: QueryApiSettings):
    Promise<{ successful: true; value: QueryResult } | { successful: false; error: string }>;

  queryMarkdown(source, originFile?, settings?): Promise<{...}>;
  queryCSV(source, originFile?, settings?): Promise<{...}>;

  // Быстрый доступ к данным
  pages(source?: string): DataArray<SFile>;
  // source: "" (весь vault), "#tag", '"folder"', kombinации

  page(path: string | Link, originFile?: string): Record<string, any> | undefined;

  pagePaths(source?: string): DataArray<string>;
  current(): Record<string, any> | null; // текущий открытый файл

  // Утилиты
  array(arr: any[]): DataArray<any>;
  isLink(value: any): boolean;
  date(value): DateTime | null;
  duration(value): Duration | null;
  fileLink(path, embed?, displayAs?): Link;
  markdownList(values): string;
  markdownTable(headers, values): string;
  markdownTaskList(tasks): string;

  // Версия / состояние
  version: { major, minor, patch };
  index: FullIndex; // внутренний индекс
}
```

### 3.3.2 SFile и STask типы

```typescript
interface SFile {
  path: string;
  folder: string;
  name: string;
  link: Link;
  size: number;
  ctime: DateTime;
  mtime: DateTime;
  // + все поля frontmatter как прямые свойства
  [frontmatterKey: string]: any;
}

interface STask {
  text: string;
  completed: boolean;
  status: string;  // ' '|'x'|'-'|'/'|... (custom statuses)
  checked: boolean;
  fullyCompleted: boolean;
  tags: string[];
  link: Link;
  section: Link;
  subtasks: STask[];
  real: boolean;
  children: ListItem[];
  outlinks: Link[];
  path: string;
  line: number;
  lineCount: number;
  position: { start, end };
  // аннотации из inline fields: [date::2024-01-01]
  [inlineField: string]: any;
}
```

### 3.3.3 Использование в OPP

```typescript
// Паттерн получения данных из Dataview
class DataviewDataSource extends DataSource {
  private api: DataviewApi;

  async queryAll(): Promise<DataFrame> {
    const result = await this.api.query(
      `TABLE ${fields.join(", ")} FROM ${source}`,
      undefined,
      { forceId: true }
    );
    if (!result.successful) throw new Error(result.error);
    return convertQueryResult(result.value);
  }
}
```

---

## 3.4 Dataview + OPP Integration Points

```
INTEGRATION MATRIX
┌─────────────────────────────────────────────────────────────┐
│ Dataview Feature       │ OPP Usage                         │
├────────────────────────┼───────────────────────────────────┤
│ TABLE query            │ DataviewDataSource.queryAll()     │
│ LIST query             │ Частичная (поля не возвращаются)  │
│ TASK query             │ Не реализовано → todo             │
│ Implicit fields        │ Через convertQueryResult()        │
│ Date functions         │ Частично через formulaEngine      │
│ DataArray.where/filter │ НЕ используется (OPP own filter)  │
│ pages() function       │ НЕ используется напрямую          │
│ inlinks/outlinks       │ Relation resolver (частично)      │
└─────────────────────────────────────────────────────────────┘
```

---

# ЧАСТЬ IV: OBSIDIAN PROJECTS PLUS — ТЕКУЩАЯ АРХИТЕКТУРА

## 4.1 Высокоуровневая архитектура

```
OPP Plugin Stack (v3.4.1 WIP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

src/main.ts               — Plugin entry point
├── ProjectsPlugin extends Plugin
├── Registers views (table/board/calendar/gallery/database)
└── CommandManager, EventManager, ModalManager

src/settings/
├── settings.ts           — migrateSettings (v1→v2→v3)
├── base/settings.ts      — ProjectDefinition, ViewDefinition, FilterDefinition
└── v1/v2/v3/settings.ts  — version-specific schemas

src/lib/
├── dataframe/
│   └── dataframe.ts      — DataFrame, DataRecord, DataField, DataFieldType
├── datasources/
│   ├── index.ts          — abstract DataSource (queryAll, queryOne, includes)
│   ├── folder/           — FolderDataSource (recursive folder scan)
│   ├── tag/              — TagDataSource (#tag filtering)
│   ├── dataview/         — DataviewDataSource (DQL TABLE query)
│   └── frontmatter/      — YAML parsing, type inference
├── filesystem/
│   ├── filesystem.ts     — IFile interface
│   └── obsidian/
│       └── filesystem.ts — ObsidianFile (processFrontMatter wrapper)
├── stores/
│   ├── settings.ts       — Svelte writable store (SSOT для settings)
│   └── i18n.ts           — i18next store
├── helpers/
│   ├── formulaParser.ts  — AST parser для выражений формул
│   └── regexSafety.ts    — ReDoS protection
├── dataApi.ts            — DataApi (updateRecord, createRecord, deleteRecord)
├── viewApi.ts            — ViewApi (high-level operations + resolveExternalFrame)
└── externalFrameResolver.ts — Resolves external project DataFrames

src/ui/
├── app/
│   ├── App.svelte        — Root компонент, ViewApi factory
│   ├── useView.ts        — Svelte action: mount/destroy view
│   └── onboarding/       — Demo project creation
├── components/
│   └── Navigation/       — CompactNavBar, ViewSwitcher, SettingsMenu
└── views/
    ├── Board/            — Kanban view
    ├── Calendar/         — Calendar + Agenda
    ├── Gallery/          — Gallery view
    ├── Table/ (legacy)   — Deprecated table view
    └── Database/         ← ОСНОВНОЙ ФОКУС ДОКУМЕНТА
        ├── databaseView.ts     — Svelte mount point
        ├── DatabaseViewCanvas.svelte — Главный canvas
        ├── types.ts            — All Database-specific types
        ├── migration.ts        — Settings migration
        ├── engine/             — Вычислительный движок
        └── widgets/            — 8 типов виджетов
```

## 4.2 Database View — Детальная архитектура

### 4.2.1 Data Flow Pipeline

```
Vault Files (markdown + frontmatter YAML)
        │
        ▼ MetadataCache (Obsidian built-in index)
        │
        ▼ DataSource (queryAll)
          ├─ FolderDataSource → reads frontmatter from all files in folder
          ├─ TagDataSource → reads files with matching #tags
          └─ DataviewDataSource → runs DQL TABLE query
        │
        ▼ DataFrame {fields: DataField[], records: DataRecord[]}
          fields = [{name, type, repeated, identifier, derived}]
          records = [{id: filePath, values: {field: value}}]
        │
        ▼ view.filter (FilterDefinition — project-level)
          conditions: [{field, operator, value, enabled}]
          conjunction: "and" | "or"
        │
        ▼ enrichWithBacklinks (relationResolver.ts)
          Resolves [[wiki-link]] → DataRecord references
        │
        ▼ executeTransform(pipeline, context)
          TransformPipeline.steps: TransformStep[]
          steps: unnest | unpivot | compute | filter
               | group-by | aggregate | pivot | join
        │
        ▼ Widget Render
          8 widget types:
          data-table, chart, stats, comparison,
          checklist, view-port, filter-tabs, summary-row
```

### 4.2.2 Widget System

```
WIDGET REGISTRY (8 types)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DataTable (data-table)
├── StrictGrid CSS (column resizing + persist widthRem)
├── Multi-sort, freeze columns, group-by (2 levels)
├── Conditional formatting (per-field rules)
├── Aggregation footer row (11 functions)
├── Formula field inline editing
└── Field presets (layout snapshots)

ChartWidget (chart)
├── Types: bar, line, area, pie, donut, scatter
├── Pure SVG rendering (no external chart library)
├── Correlation flows (cross-source X/Y join)
├── Degenerate data detection + warnings
└── Correlation diagnostics (match stats)

StatsWidget (stats)
├── KPI cards (field + aggregation function)
├── Sparkline mini-charts
├── Grid layout 2/3/4 columns
└── Missing field indicators

ComparisonWidget (comparison)
├── metrics[] with field/label/color
├── Mode: absolute | percentage | normalized
├── Orientation: horizontal | vertical
└── showDelta toggle

ChecklistWidget (checklist)
├── Filter by check field
├── Modes: all | open | done
├── Sort + limit
└── Rules-bar transparency

ViewPortWidget (view-port)
├── Embeds another OPP view as mini-window
└── Label override, headerVisible toggle

FilterTabsWidget (filter-tabs)
├── Click-to-filter by field values
├── Auto-detect unique values from DataFrame
└── showAll toggle

SummaryRowWidget (summary-row)
└── Per-column aggregation + format
```

### 4.2.3 Transform Engine

```typescript
// src/ui/views/Database/engine/transformExecutor.ts
// Выполняет TransformPipeline над DataFrame

STEP_ORDER = {
  unnest: 0,    // FLATTEN nested arrays first
  unpivot: 0,   // reshape wide → long
  join: 0,      // merge external DataFrame
  compute: 1,   // add derived columns
  filter: 2,    // reduce rows
  "group-by": 3, // group (prepare for aggregate)
  aggregate: 4, // reduce groups → summary rows
  pivot: 5,     // reshape long → wide
}

// Steps выполняются в порядке STEP_ORDER (не в порядке массива)
// Это гарантирует correctness pipeline

KEY FILES:
- transformTypes.ts    → interfaces для всех step types
- transformExecutor.ts → executeTransform(df, pipeline, ctx?)
- transformCache.ts    → LRU кэш с hash-ключами
- joinKey.ts           → нормализация ключей для JOIN (date day-granularity)
- formulaEngine.ts     → 102 функции для COMPUTE steps
- aggregation.ts       → 11 функций агрегации
- transformPivot.ts    → PIVOT/UNPIVOT реализация
- rollup.ts            → Wiki-link relation resolution
- relationResolver.ts  → Backlinks enrichment
- chartDataPipeline.ts → Трансформация для Chart rendering
```

### 4.2.4 Formula Engine (102 функции)

```
КАТЕГОРИИ ФОРМУЛ (formulaMetadata.ts)
├── logical    (IF, AND, OR, NOT, SWITCH, IFS, ...)
├── math       (ABS, ROUND, FLOOR, CEIL, SQRT, POW, LOG, ...)
├── string     (CONCAT, LENGTH, UPPER, LOWER, TRIM, REPLACE, ...)
├── date       (DATEADD, DATEBETWEEN, DATEFORMAT, NOW, TODAY, ...)
├── financial  (PMT, IPMT, PPMT, PV, FV, RATE, NPER, ...)
├── statistical (AVERAGE, MEDIAN, STDEV, VAR, PERCENTILE, ...)
├── array      (MAP, FILTER, REDUCE, SORT, JOIN, ...)
├── conversion (TONUMBER, TOSTRING, TODATE, TOBOOLEAN, ...)
└── utility    (ID, PROP, STYLE, LET, ...)

INTELLISENSE (FormulaBar.svelte)
├── Autocomplete: function names + field names
├── Signature popover: function_name(args) → returnType
├── Category display + docstring
├── Runtime error panel (FormulaDebugPanel.svelte)
└── Cursor-position aware (findEnclosingCall)
```

### 4.2.5 Settings Schema (v3)

```typescript
// Полная структура хранения

interface ProjectsPluginSettings {
  version: 3;
  projects: ProjectDefinition[];
  preferences: ProjectsPluginPreferences;
  // Хранится в .obsidian/plugins/obs-projects-plus/data.json
}

interface ProjectDefinition {
  id: string;
  name: string;
  dataSource: DataSourceConfig; // folder|tag|dataview
  views: ViewDefinition[];
  fieldConfig: Record<string, FieldConfig>; // type overrides
  templates: string[];
  defaultName: string;
  newNotesFolder: string;
  excludedNotes: string[];
  isDefault: boolean;
  dateFormat: DateFormatConfig;
}

interface ViewDefinition {
  id: string;
  name: string;
  type: "table"|"board"|"calendar"|"gallery"|"database";
  filter: FilterDefinition;
  sort: SortDefinition;
  config?: DatabaseViewConfig; // только для type="database"
}

interface DatabaseViewConfig {
  widgets: WidgetDefinition[];
  showFormulaBar: boolean;
  formulaBarField?: string;
  fieldPresets?: FieldPreset[];
  activeFieldPresetId?: string;
}
```

---

## 4.3 Технологический стек

```
TECH STACK
├── TypeScript (strict mode, exactOptionalPropertyTypes: true)
├── Svelte 3.59.2 (компоненты + реактивность)
├── esbuild (сборка, production bundle)
├── i18next + svelte-i18next (en/ru/uk/zh-CN)
├── fp-ts (Either monad для settings migration)
├── dayjs (date operations)
├── svelte-dnd-action (drag & drop для Board, Calendar Agenda)
│
TESTING
├── Jest 29 (unit tests)
├── ts-jest + esbuild-jest (TypeScript в тестах)
└── Размер: 54 suites / 923 tests (PASS @ v3.4.1 WIP)

BUILD OUTPUT
├── main.js        (2.4 MB — весь плагин в одном файле)
├── manifest.json  (метаданные плагина)
└── styles.css     (27+ KB — все стили)
```

---

# ЧАСТЬ V: МАТРИЦА ФУНКЦИЙ NOTION → OPP

## 5.1 Полная матрица соответствия

```
NOTION FEATURE                  │ OPP STATUS    │ IMPLEMENTATION PATH
════════════════════════════════╪═══════════════╪═══════════════════════════

━━ ТИПЫ ПРЕДСТАВЛЕНИЙ ━━━━━━━━━━╪═══════════════╪═══════════════════════════
Table View                      │ ✅ IMPL (data-table widget)│ DataTableWidget
Board View                      │ ✅ IMPL        │ Board view (existing)
Calendar View                   │ ✅ IMPL        │ Calendar view (existing)
Gallery View                    │ ✅ IMPL        │ Gallery view (existing)
Timeline View                   │ ⬜ NOT IMPL    │ Requires new view type
List View                       │ ⬜ NOT IMPL    │ Minimal variant of Table

━━ ТИПЫ СВОЙСТВ ━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
title                           │ ✅ identifier field │ DataFieldType.String
rich_text                       │ ✅ String      │ DataFieldType.String
url                             │ 🟡 String (no clickable preview) │ styling needed
number                          │ ✅ Number      │ DataFieldType.Number
formula                         │ ✅ IMPL        │ DataFieldType.Formula + formulaEngine
select                          │ ✅ IMPL        │ DataFieldType.Select
multi_select                    │ ✅ IMPL        │ DataFieldType.List
status                          │ ✅ IMPL        │ DataFieldType.Status
date                            │ ✅ IMPL        │ DataFieldType.Date
created_time                    │ 🟡 PARTIAL     │ file.ctime via Dataview
last_edited_time                │ 🟡 PARTIAL     │ file.mtime via Dataview
people                          │ ⬜ N/A         │ Нет пользователей в Obsidian
created_by                      │ ⬜ N/A         │ Single-user system
last_edited_by                  │ ⬜ N/A         │ Single-user system
files                           │ 🟡 PARTIAL     │ String (wiki-links to files)
checkbox                        │ ✅ IMPL        │ DataFieldType.Boolean
email                           │ 🟡 String      │ No email validation UI
phone_number                    │ 🟡 String      │ No phone UI
relation                        │ 🟡 PARTIAL     │ DataFieldType.Relation (wiki-links)
rollup                          │ 🟡 PARTIAL     │ DataFieldType.Rollup (basic)
unique_id                       │ 🟡 PARTIAL     │ file path as ID
cover                           │ ⬜ Gallery only│ Gallery view cover field

━━ ФИЛЬТРАЦИЯ ━━━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Property filters (basic)        │ ✅ IMPL        │ FilterDefinition
Filter groups (AND/OR)          │ ✅ IMPL        │ conjunction field
Nested filter groups            │ ⬜ NOT IMPL    │ Требует рекурсивный DSL
Relative date filters           │ 🟡 PARTIAL     │ past_week/month не impl
Formula filter                  │ ⬜ NOT IMPL    │ Filter by computed value
Rollup filter                   │ ⬜ NOT IMPL    │ Требует rollup resolution
Saved filter views              │ ✅ IMPL        │ view.filter per view

━━ СОРТИРОВКА ━━━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Single field sort               │ ✅ IMPL        │ SortDefinition
Multi-field sort                │ ✅ IMPL        │ DataTableSortCriteria[]
Sort by formula result          │ 🟡 PARTIAL     │ Formula field → sort

━━ ГРУППИРОВКА ━━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Group by (1 level)              │ ✅ IMPL        │ GroupConfig
Group by (2 levels)             │ ✅ IMPL        │ subGroupField
Group date by day/week/month    │ ✅ IMPL        │ GroupByStep.dateGrouping
Sort within groups              │ ✅ IMPL        │ GroupConfig.sortOrder

━━ TABLE VIEW CONTROLS ━━━━━━━━━╪═══════════════╪═══════════════════════════
Column resize                   │ ✅ IMPL (rem)  │ DataTableWidget + widthRem
Column reorder                  │ ✅ IMPL        │ orderFields
Column hide/show                │ ✅ IMPL        │ DataTableFieldConfig.hide
Column pin/freeze               │ ✅ IMPL        │ freezeUpTo
Aggregation row                 │ ✅ IMPL        │ showAggregationRow + AggregationConfig
Row height (compact/default/expanded)│ ✅ IMPL   │ rowHeight
Text wrap                       │ ✅ IMPL        │ wrapText
Conditional formatting          │ ✅ IMPL        │ ConditionalFormat[]
Right-click column menu         │ ✅ IMPL        │ DataTable context menu

━━ RELATION / ROLLUP ━━━━━━━━━━━╪═══════════════╪═══════════════════════════
One-way relation                │ 🟡 PARTIAL     │ wiki-links as strings
Two-way relation (dual)         │ ⬜ NOT IMPL    │ Требует bidirectional write
Rollup: count                   │ ✅ IMPL        │ rollup.ts
Rollup: sum/avg/min/max         │ ✅ IMPL        │ rollup.ts
Rollup: earliest/latest date    │ ✅ IMPL        │ rollup.ts
Rollup: percent_checked         │ ⬜ NOT IMPL    │ TODO
Cross-source JOIN (correlation) │ ✅ IMPL        │ JoinStep + externalFrameResolver

━━ FORMULA ━━━━━━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Basic arithmetic                │ ✅ IMPL        │ formulaEngine
String functions                │ ✅ IMPL        │ 20+ functions
Date functions                  │ ✅ IMPL        │ dayjs-based
Logical functions               │ ✅ IMPL        │ IF/AND/OR/SWITCH...
List/array functions            │ ✅ IMPL        │ MAP/FILTER/REDUCE...
prop() function                 │ 🟡 PARTIAL     │ via field reference
id() function                   │ 🟡 PARTIAL     │ record.id
style() / visual formatting     │ ✅ IMPL        │ StyledValue system
Financial functions             │ ✅ IMPL (+OPP) │ PMT/IRR/NPV (Notion не имеет)
IntelliSense                    │ ✅ IMPL        │ FormulaBar + FormulaMetadata

━━ VIEWS CONTROL ━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Multiple views per DB           │ ✅ IMPL        │ ViewDefinition[]
View-level filters              │ ✅ IMPL        │ view.filter
View-level sort                 │ ✅ IMPL        │ view.sort
Linked databases                │ ✅ IMPL        │ multiple views per project
Properties visibility per view  │ ✅ IMPL        │ DataTableFieldConfig.hide

━━ AUTOMATION ━━━━━━━━━━━━━━━━━━╪═══════════════╪═══════════════════════════
Property change trigger         │ ⬜ NOT IMPL    │ Requires file watcher hooks
Record added trigger            │ ⬜ NOT IMPL    │ vault.on("create") → TODO
Scheduled trigger               │ ⬜ N/A         │ Obsidian не имеет scheduler
Edit property action            │ ⬜ NOT IMPL    │ dataApi.updateRecord wrapper
Send notification               │ ⬜ N/A         │ External service required
Templates action                │ 🟡 PARTIAL     │ Template creation (manual)

━━ DASHBOARD / ANALYTICS ━━━━━━━╪═══════════════╪═══════════════════════════
Charts (bar/line/pie/donut)     │ ✅ IMPL        │ ChartWidget (pure SVG)
Area charts                     │ ✅ IMPL        │ ChartWidget
Scatter plots + correlation     │ ✅ IMPL        │ ChartWidget + JoinStep
KPI cards                       │ ✅ IMPL        │ StatsWidget
Comparison metrics              │ ✅ IMPL        │ ComparisonWidget
Summary row aggregations        │ ✅ IMPL        │ SummaryRowWidget
Checklist / todo view           │ ✅ IMPL        │ ChecklistWidget
Filter tabs (quick filter)      │ ✅ IMPL        │ FilterTabsWidget
Multi-widget dashboard          │ ✅ IMPL        │ DatabaseViewCanvas (CSS Grid)
Widget resize/drag              │ ✅ IMPL        │ resizable.ts

━━ DATA TRANSFORMS (OPP-only) ━━╪═══════════════╪═══════════════════════════
UNNEST (array → rows)           │ ✅ IMPL        │ UnnestStep (Notion не имеет)
PIVOT                           │ ✅ IMPL        │ PivotStep (Notion не имеет)
UNPIVOT                         │ ✅ IMPL        │ UnpivotStep (Notion не имеет)
GROUP-BY + AGGREGATE            │ ✅ IMPL        │ GroupByStep + AggregateStep
COMPUTE (formula columns)       │ ✅ IMPL        │ ComputeStep
JOIN (cross-source)             │ ✅ IMPL        │ JoinStep (Notion: cross-DB relations)
FILTER step (pipeline)          │ ✅ IMPL        │ FilterStep

LEGEND: ✅ Implemented  🟡 Partial  ⬜ Not implemented / N/A
```

---

## 5.2 Gap Analysis — Приоритизированные пробелы

### P0 — Критические (блокируют основной workflow)

| Gap | Notion Feature | OPP Path | Effort |
|-----|---------------|----------|--------|
| G1 | Timeline/Gantt view | Новый тип представления с date-range rendering | HIGH |
| G2 | Two-way relation (dual property) | Bidirectional wiki-link write via `processFrontMatter` | HIGH |
| G3 | Nested filter groups (AND within OR) | Рекурсивный FilterDefinition DSL | MEDIUM |

### P1 — Важные (снижают UX)

| Gap | Notion Feature | OPP Path | Effort |
|-----|---------------|----------|--------|
| G4 | Relative date filters (past_week etc) | Client-side computed predicates | LOW |
| G5 | URL field (clickable) | UI rendering for String fields typed as URL | LOW |
| G6 | List View | Minimal variant of data-table | LOW |
| G7 | Column insert left/right | DataTable context menu + orderFields | LOW |
| G8 | Full property schema editor | field type + options in one place | MEDIUM |

### P2 — Желательные

| Gap | Notion Feature | OPP Path | Effort |
|-----|---------------|----------|--------|
| G9 | Record automation (on change) | Vault watcher hooks → dataApi actions | MEDIUM |
| G10 | Sub-items (hierarchical records) | parent: field + tree rendering in DataTable | HIGH |
| G11 | Rollup: percent_checked | rollup.ts extension | LOW |
| G12 | Inline page creation from relation | New file creation from relation field cell | MEDIUM |

---

# ЧАСТЬ VI: ПЛАН РЕАЛИЗАЦИИ — ФАЗОВЫЙ BLUEPRINT

## 6.1 Roadmap Overview

```
ФАЗЫ РЕАЛИЗАЦИИ (post-v3.4.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase A: Foundation Hardening         [v3.5.0 — current WIP]
  A1. Zero Pixels Policy (DONE)
  A2. Container queries (DONE)
  A3. processFrontMatter integration (DONE)
  A4. Formula IntelliSense (DONE)
  A5. Cross-source JOIN (DONE)
  A6. Field Presets (DONE)

Phase B: Property System Expansion    [v3.5.1]
  B1. URL field type (clickable rendering)
  B2. Email field type (mailto: links)
  B3. Relative date filters (past_week, this_month, ...)
  B4. Enhanced select options (color badges in cells)
  B5. Status groups (3-tier: todo/in-progress/done)

Phase C: Relation & Rollup System     [v3.5.2]
  C1. Two-way relation (bidirectional wiki-link write)
  C2. Inline relation picker (file search modal)
  C3. Rollup: full function set (24 functions)
  C4. Rollup: show_original / show_unique (render as chips)
  C5. Relation column rendering (chips with links)

Phase D: View System Expansion        [v3.5.3]
  D1. Timeline View (Gantt) — new view type
  D2. List View — minimal variant
  D3. Nested filter groups (recursive AND/OR)
  D4. Filter by formula result
  D5. Sort by formula result

Phase E: Database Automation          [v3.5.4]
  E1. Vault event hooks (create/modify/delete triggers)
  E2. Property-change automations (YAML watcher)
  E3. Template automations (auto-fill on create)
  E4. Batch operations (bulk update, bulk move)

Phase F: Advanced Data Modeling       [v3.5.5]
  F1. Sub-items (hierarchical records, tree DataTable)
  F2. Linked database views (cross-project view aliases)
  F3. Database templates (pre-populated create forms)
  F4. Inline page preview on hover
```

## 6.2 Phase B Detail — Property System Expansion

### B1: URL Field Type

```typescript
// src/lib/dataframe/dataframe.ts — добавить
export enum DataFieldType {
  // ...existing...
  Url = "url",    // NEW
  Email = "email", // NEW
  Phone = "phone", // NEW
}

// src/ui/views/Database/widgets/DataTable/
// CellRenderer.svelte — ветка для Url type:
// <a href={value} target="_blank" rel="noopener noreferrer">{value}</a>
```

### B2: Relative Date Filters

```typescript
// src/settings/base/settings.ts — добавить операторы
export type FilterOperator =
  | "is" | "is-not" | "contains" | "not-contains"
  | "starts-with" | "ends-with"
  | "greater-than" | "less-than" | "greater-than-or-equal" | "less-than-or-equal"
  | "is-empty" | "is-not-empty"
  | "is-before" | "is-after" | "is-on-or-before" | "is-on-or-after"
  // NEW relative:
  | "past-week" | "past-month" | "past-year"
  | "next-week" | "next-month" | "next-year"
  | "this-week" | "this-month" | "this-year";

// src/lib/datasources/frontmatter/filter.ts — реализация
function evaluateRelativeDateFilter(
  value: Date | null,
  operator: RelativeDateOperator
): boolean {
  const now = new Date();
  const ranges: Record<RelativeDateOperator, [Date, Date]> = {
    "past-week": [subDays(now, 7), now],
    "past-month": [subMonths(now, 1), now],
    // ...
  };
  const [start, end] = ranges[operator];
  return value !== null && value >= start && value <= end;
}
```

### B3: Status Groups

```typescript
// src/settings/base/settings.ts
interface FieldConfig {
  type?: DataFieldType;
  options?: FieldOption[];
  // NEW:
  statusGroups?: StatusGroup[];  // для type="status"
}

interface StatusGroup {
  id: string;
  name: "todo" | "in-progress" | "complete" | string; // кастомные группы
  color: string;
  optionIds: string[];
}
```

## 6.3 Phase C Detail — Relation & Rollup System

### C1: Two-Way Relation Implementation

```
BIDIRECTIONAL RELATION WRITE ALGORITHM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

При изменении Relation поля в записи A (добавление ссылки на B):

1. READ current A.relation = ["[[B1]]", "[[B2]]"]
2. NEW value = ["[[B1]]", "[[B2]]", "[[B3]]"]
3. DIFF = added: ["[[B3]]"], removed: []

4. FOR each added item ("[[B3]]"):
   a. Resolve "B3" → TFile via MetadataCache
   b. app.fileManager.processFrontMatter(B3_file, (fm) => {
        const backField = fm[backRelationFieldName] ?? [];
        fm[backRelationFieldName] = [...backField, "[[A]]"];
      })

5. FOR each removed item:
   a. Resolve → TFile
   b. processFrontMatter → remove "[[A]]" from back-field

CONFIGURATION (в FieldConfig):
{
  type: "relation",
  relation: {
    targetProject: "project-id",  // куда ссылаемся
    targetField: "related-A",     // поле в target (для dual)
    dual: true                    // двусторонняя?
  }
}
```

### C2: Inline Relation Picker

```
UI FLOW: Relation Field Cell Click
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User clicks relation cell
    → RelationPicker.svelte (modal/popover)
        → SearchInput (fuzzy search по titles)
        → Results list (from target project DataFrame)
        → Click result → add to relation array
        → X on chip → remove from relation array
        → Save → dataApi.updateRecord({relation: [...]})
```

### C3: Rollup Full Function Set

```typescript
// src/ui/views/Database/engine/rollup.ts — расширить

export type RollupFunction =
  // Существующие:
  | "count" | "count_values" | "empty" | "not_empty" | "unique"
  | "sum" | "average" | "median" | "min" | "max" | "range"
  | "earliest_date" | "latest_date" | "date_range"
  // Новые:
  | "show_original"    // array всех значений
  | "show_unique"      // array уникальных значений
  | "checked"          // count true booleans
  | "unchecked"        // count false booleans
  | "percent_checked"  // % true из общего count
  | "percent_unchecked"
  | "count_per_group"  // Map<groupValue, count>
  | "percent_per_group"
  | "sum_per_group";   // Map<groupValue, sum>
```

## 6.4 Phase D Detail — View System Expansion

### D1: Timeline View (Gantt)

```
TIMELINE VIEW ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPONENTS
src/ui/views/Timeline/
├── TimelineView.ts        — ItemView entry point
├── TimelineCanvas.svelte  — главный компонент
├── TimelineHeader.svelte  — временная шкала (day/week/month/quarter/year)
├── TimelineRows.svelte    — список записей (левая панель)
├── TimelineBars.svelte    — отрезки (правая панель)
├── TimelineToday.svelte   — вертикальная линия "сегодня"
└── timelineTypes.ts       — конфигурация

CONFIGURATION (TimelineViewConfig)
{
  startField: string;       // YAML поле начала (date type)
  endField: string;         // YAML поле конца (date type)
  colorField?: string;      // поле для цвета отрезков
  groupBy?: string;         // группировка строк
  labelField?: string;      // подпись на отрезке
  granularity: "day"|"week"|"biweek"|"month"|"quarter"|"year";
  showWeekends: boolean;
  visibleFields: string[];  // видимые поля в левой панели
}

RENDERING APPROACH
- Pure CSS Grid для временной шкалы
- CSS position: absolute для баров (left: calc((startDay / totalDays) * 100%))
- Drag via pointer events → updateRecord({startField, endField})
- Virtual scroll для больших наборов данных (>100 строк)

OBSIDIAN ADAPTATION
- Нет dependency/arrows (Notion Pro feature)
- date range → два YAML date поля
- Drag to update → processFrontMatter для обоих полей

INTEGRATION
- src/main.ts: registerView("timeline", ...)
- src/settings: view.type = "timeline"
- src/ui/views/Timeline/index.ts: TimelineDataSource wrapper
```

### D2: Nested Filter Groups

```typescript
// ТЕКУЩИЙ FilterDefinition (плоский):
interface FilterDefinition {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
}

// НОВЫЙ (рекурсивный):
type FilterNode =
  | FilterCondition               // leaf
  | { and: FilterNode[] }         // AND группа
  | { or: FilterNode[] };         // OR группа

interface FilterDefinitionV2 {
  root: FilterNode;
}

// Backward compatible:
// старый {conjunction: "and", conditions: [...]}
// → {root: {and: [...conditions]}}

// MIGRATION в settings.ts:
function migrateFilterDefinition(old: FilterDefinition): FilterDefinitionV2 {
  return {
    root: {
      [old.conjunction]: old.conditions
    }
  };
}
```

## 6.5 Phase E Detail — Database Automation

### E1: Vault Event Hooks

```typescript
// src/lib/automation/automationEngine.ts — NEW
interface AutomationRule {
  id: string;
  trigger: AutomationTrigger;
  conditions?: FilterNode;
  actions: AutomationAction[];
  enabled: boolean;
}

type AutomationTrigger =
  | { type: "record-created" }
  | { type: "record-modified"; field?: string }
  | { type: "record-deleted" }
  | { type: "property-changed"; field: string; from?: string; to?: string };

type AutomationAction =
  | { type: "set-property"; field: string; value: string | Formula }
  | { type: "create-record"; template?: string; values?: Record<string, string> }
  | { type: "notice"; message: string };

// Hook в dataApi.ts:
class DataApi {
  async updateRecord(record: DataRecord, fields: DataField[]) {
    // ... existing update logic ...
    await this.automationEngine.runTriggeredActions("record-modified", record, fields);
  }
}
```

## 6.6 Phase F Detail — Advanced Data Modeling

### F1: Sub-Items (Hierarchical Records)

```
SUB-ITEMS IMPLEMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STORAGE MODEL (frontmatter-based)
Parent note (Project A.md):
  ---
  title: Project A
  status: In Progress
  ---

Child notes:
  ---
  title: Sub-task 1
  parent: "[[Project A]]"  ← relation field
  status: Done
  ---

TREE CONSTRUCTION ALGORITHM
1. DataFrame = all records from DataSource
2. Build parent map: Map<recordId, childRecord[]>
   - key = resolvedPath of parent field
   - value = records with that parent
3. Root records = records where parent == null or parent not in dataset
4. DataTableWidget receives treeData: TreeNode[]

TREE RENDERING (DataTableWidget enhancement)
- Add "expand/collapse" toggle cell (►/▼)
- Indent child rows by depth * 1.5rem
- Drag handles for reorder + reparent
- Aggregate row spans subtree

INDENTATION via CSS:
  .ppp-tree-row[data-depth="1"] { padding-left: 1.5rem; }
  .ppp-tree-row[data-depth="2"] { padding-left: 3rem; }
```

---

# ЧАСТЬ VII: ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ И АДАПТАЦИИ

## 7.1 Cloud vs Local — Фундаментальные различия

```
NOTION (Cloud)                    OPP (Local)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UUID стабильный для page           ID = file path (изменяется при rename!)
  → Решение: MetadataCache.resolvedLinks для backlinks

Server-side формулы               Client-side формулы (formulaEngine)
  → Решение: уже реализовано, 102 функции

Collaborative editing              Single-user (одна копия)
  → N/A для Obsidian

Realtime updates                   File watcher (MetadataCache events)
  → vault.on("modify") → MetadataCache.on("changed") → re-query

Server-side pagination             In-memory (все записи в RAM)
  → Решение: virtualScroll.ts для >1000 rows

Relation по UUID                   Relation по wiki-link
  → Решение: wiki-link resolved via MetadataCache.getFirstLinkpathDest()

Cross-workspace relations          Cross-vault: N/A
  → Ограничение: только в рамках одного vault

Type enforcement server-side       Type inference (parsing frontmatter)
  → Решение: FieldConfig в settings с явным type override

Automation server-side             Client hooks (dataApi callbacks)
  → Частичная реализация возможна

Files/media storage                Vault файлы (относительные пути)
  → Хранение как string (wiki-link или path)
```

## 7.2 Performance Considerations

```
PERFORMANCE MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dataset Size   │ Strategy                        │ Target
───────────────┼─────────────────────────────────┼──────────
< 100 records  │ Direct render                   │ < 16ms
100–500        │ Direct + transform cache        │ < 50ms
500–1000       │ Transform cache + virtual scroll│ < 100ms
1000–5000      │ Virtual scroll + pagination     │ < 200ms
> 5000         │ Dataview datasource (indexed)   │ async

TRANSFORM CACHE KEY
computeCacheKey(source, pipeline, context?) → string
- hash(records.map(r => r.id).join(","))   // data identity
- hash(JSON.stringify(pipeline.steps))     // pipeline identity
- "__R__" + hash(rightFrames)              // join context identity

VIRTUAL SCROLL (virtualScroll.ts)
- Window size: Math.ceil(containerHeight / rowHeight) + overscan
- Overscan: 5 rows top + 5 rows bottom
- Re-calculate on: containerHeight change, rowHeight change, data change

FORMULA EVALUATION
- Computed per-record on demand
- No batching (single-record scope)
- Memo: not cached (formulas may reference env-dependent functions)
```

## 7.3 Mobile Adaptation

```
MOBILE-SPECIFIC CONSIDERATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. TOUCH EVENTS
   - svelte-dnd-action: touch drag support
   - Pointer events (pointerdown/move/up) вместо mouse
   - 44px минимальный touch target (из WCAG)
   - isTouchDevice store → conditional controls visibility

2. CONTAINER QUERIES (не media queries)
   - @container widget (max-width: 20rem) → compact mode
   - @container widget (max-width: 35rem) → medium mode
   - Работает внутри любого layout без знания об окне

3. NO HOVER STATES (touch devices)
   - Cog кнопки всегда видимы (не только on hover) на mobile
   - ViewSwitcher chevrons скрыты на touch (native pan-x)

4. CAPACITOR LIMITATIONS
   - Нет native Node.js → файловый доступ через Capacitor FS
   - Нет chokidar → polling-based watcher
   - Меньше памяти → agressive cache eviction

5. FORMULA BAR
   - Скрыта по умолчанию на mobile (small screen)
   - Toggle кнопка в toolbar
```

## 7.4 Безопасность и надёжность

```
SECURITY SURFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. FORMULA INJECTION
   - formulaEngine НЕ использует eval()
   - Парсит AST → интерпретирует
   - STYLE_COLORS/STYLE_WEIGHTS — whitelist для style()
   - OWASP: Injection → MITIGATED

2. ReDoS (Regex DoS)
   - isUnsafePattern() в regexSafety.ts
   - MAX_REGEX_INPUT_LENGTH ограничение
   - OWASP: Injection → MITIGATED

3. JSON.parse (Settings)
   - fp-ts Either<Error, Settings> — всегда try-catch
   - migrateSettings возвращает Either
   - OWASP: Broken Access Control → N/A (single user)

4. File Path Traversal
   - Все пути через Vault API (нет raw fs.readFile)
   - vault.getAbstractFileByPath() нормализует
   - OWASP: Path Traversal → MITIGATED

5. XSS (SVG Charts)
   - Все chart values — числа (NaN → 0)
   - Labels escapeHTML перед innerHTML
   - OWASP: XSS → MITIGATED

6. processFrontMatter Atomicity
   - Один вызов = атомарная операция
   - Concurrent updates: последний wins (single-user OK)
```

---

# ЧАСТЬ VIII: СПРАВОЧНИК API И ТИПОВ

## 8.1 DataFrame API — Ключевые типы

```typescript
// ═══════════════════════════════════════════════════════
// src/lib/dataframe/dataframe.ts
// ═══════════════════════════════════════════════════════

// Основной тип данных
type DataFrame = {
  fields: DataField[];          // схема колонок
  records: DataRecord[];        // строки данных
  errors?: RecordError[];       // ошибки парсинга
};

type DataField = {
  name: string;                 // ключ frontmatter
  type: DataFieldType;          // тип данных
  typeConfig?: FieldConfig;     // опции (select values, relation target...)
  repeated: boolean;            // массив значений?
  identifier: boolean;          // это идентификатор записи?
  derived: boolean;             // вычисляемое (нельзя редактировать)?
};

enum DataFieldType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Date = "date",
  List = "multitext",    // массив строк
  Select = "select",     // один из вариантов
  Status = "status",     // статус с группами
  Formula = "formula",   // вычисляемое выражение
  Relation = "relation", // ссылка на другой файл
  Rollup = "rollup",     // агрегация по relation
  Unknown = "unknown",   // неизвестный / объект
}

type DataRecord = {
  id: string;                           // file path
  values: Record<string, Optional<DataValue>>;
};

type DataValue =
  | string
  | number
  | boolean
  | Date
  | Array<Optional<DataValue>>;

type Optional<T> = T | null | undefined;
```

## 8.2 Transform Pipeline API

```typescript
// ═══════════════════════════════════════════════════════
// src/ui/views/Database/engine/transformTypes.ts
// ═══════════════════════════════════════════════════════

interface TransformPipeline {
  steps: readonly TransformStep[];
}

// UNNEST: array-valued field → multiple rows
interface UnnestStep {
  type: "unnest";
  field: string;            // поле с массивом объектов
  fields?: readonly string[]; // только эти подполя
  prefix?: string;          // префикс для подполей
  keepOriginal?: boolean;   // сохранить исходный массив
}

// UNPIVOT: wide → long (несколько колонок → строки)
interface UnpivotStep {
  type: "unpivot";
  fieldGroups: readonly FieldGroup[]; // паттерны полей
  keepFields: readonly string[];      // сохраняемые поля
}

// COMPUTE: добавить вычисляемые колонки
interface ComputeStep {
  type: "compute";
  columns: readonly ComputedColumn[];
}
interface ComputedColumn { name: string; expression: string; }

// FILTER: отфильтровать строки
interface FilterStep {
  type: "filter";
  conditions: FilterDefinition;
}

// GROUP-BY: подготовить для агрегации
interface GroupByStep {
  type: "group-by";
  fields: readonly string[];
  dateGrouping?: DateGrouping;
}

// AGGREGATE: свернуть строки в группы
interface AggregateStep {
  type: "aggregate";
  columns: readonly AggregateColumn[];
}
interface AggregateColumn {
  sourceField: string;
  outputName: string;
  function: AggregationFunction;
}

// PIVOT: long → wide
interface PivotStep {
  type: "pivot";
  categoryField: string;
  valueField: string;
  aggregation: AggregationFunction;
}

// JOIN: merge внешнего DataFrame
interface JoinStep {
  type: "join";
  rightSourceId: string;   // id проекта (источник правого фрейма)
  on: {
    leftKey: string;       // поле в текущем DataFrame
    rightKey: string;      // поле в правом DataFrame
  };
  how: "inner" | "left";
  aggregation?: AggregationFunction; // агрегировать matching rows?
  suffix?: string;         // суффикс для коллидирующих имён
}

// Context для JOIN resolution
interface TransformContext {
  rightFrames?: ReadonlyMap<string, DataFrame>;
}
```

## 8.3 Widget Configuration Types

```typescript
// ═══════════════════════════════════════════════════════
// src/ui/views/Database/types.ts (выборка ключевых типов)
// ═══════════════════════════════════════════════════════

// ChartWidget
interface ChartWidgetConfig {
  type: "bar"|"line"|"area"|"pie"|"donut"|"scatter";
  xField?: string;
  yField?: string;
  groupField?: string;
  theme?: string;
  // Scatter correlation (Pillar 5)
  correlation?: {
    rightSourceId: string;
    on: { leftKey: string; rightKey: string };
  };
}

// StatsWidget (KPI cards)
interface StatsWidgetConfig {
  cards: StatsCard[];
  columns?: 2 | 3 | 4;
}
interface StatsCard {
  label: string;
  field: string;
  aggregation: ColumnAggregation;
  format?: "number"|"percent"|"currency";
  currency?: string;
  sparkline?: boolean;
}

// DataTableConfig (полная конфигурация таблицы)
interface DataTableConfig {
  fieldConfig?: DataTableFieldConfig;   // ширина/видимость/pin колонок
  sortField?: string;
  sortAsc?: boolean;
  sortCriteria?: DataTableSortCriteria[];
  orderFields?: string[];
  aggregations?: AggregationConfig;
  showAggregationRow?: boolean;
  groupBy?: GroupConfig;
  freezeUpTo?: string;
  conditionalFormats?: ConditionalFormat[];
  rowHeight?: "compact"|"default"|"expanded";
  wrapText?: boolean;
  defaultValues?: Record<string, string>;
  hintDismissed?: boolean;
}

// Aggregation functions
type AggregationFunction =
  | "count"|"count_values"|"count_unique"
  | "sum"|"avg"|"median"|"min"|"max"|"range"
  | "count_checked"|"count_unchecked"
  | "percent_checked"|"percent_unchecked"
  | "first"|"last";
```

## 8.4 Settings Architecture (v3)

```typescript
// ═══════════════════════════════════════════════════════
// src/settings/base/settings.ts
// ═══════════════════════════════════════════════════════

interface ProjectDefinition {
  id: string;
  name: string;
  dataSource: DataSourceConfig;
  views: ViewDefinition[];
  fieldConfig: Record<string, FieldConfig>;
  templates: string[];
  defaultName: string;
  newNotesFolder: string;
  excludedNotes: string[];
  isDefault: boolean;
  dateFormat: { writeFormat: string; preset: "iso"|"full"|"custom" };
}

type DataSourceConfig =
  | { kind: "folder"; config: { path: string; recursive: boolean } }
  | { kind: "tag"; config: { tag: string; hierarchy: boolean } }
  | { kind: "dataview"; config: { query: string } };

interface ViewDefinition {
  id: string;
  name: string;
  type: "table"|"board"|"calendar"|"gallery"|"database";
  filter: FilterDefinition;
  sort: SortDefinition;
  config?: unknown; // type-specific config
}

interface FilterDefinition {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
}

interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value?: string;
  enabled: boolean;
}

type FilterOperator =
  | "is" | "is-not"
  | "contains" | "not-contains"
  | "starts-with" | "ends-with"
  | "greater-than" | "less-than"
  | "greater-than-or-equal" | "less-than-or-equal"
  | "is-empty" | "is-not-empty"
  | "is-before" | "is-after" | "is-on-or-before" | "is-on-or-after";
```

## 8.5 OPP Public API (customViewApi.ts)

```typescript
// ═══════════════════════════════════════════════════════
// src/customViewApi.ts — API для кастомных view
// ═══════════════════════════════════════════════════════

interface ProjectViewProps {
  // Данные
  dataFrame: DataFrame;
  
  // Конфигурация
  viewId: string;
  viewName: string;
  project: ProjectDefinition;
  
  // Callbacks
  onRecordClick?: (record: DataRecord) => void;
  onRecordCreate?: (values?: Record<string, string>) => Promise<void>;
  onRecordUpdate?: (record: DataRecord, fields: DataField[]) => Promise<void>;
  onRecordDelete?: (record: DataRecord) => Promise<void>;
  
  // Filter integration
  saveViewFilter?: (filter: FilterDefinition) => void;
  
  // Readonly state
  readonly: boolean;
}
```

---

## 8.6 i18n Namespace Structure

```
TRANSLATION KEY NAMESPACES
src/lib/stores/i18n-keys/ (en/ru/uk/zh-CN)

views.database.
  canvas.*          — DatabaseViewCanvas UI
  widget.*          — общие для виджетов
  pipeline.*        — PipelineEditor шаги
  chart.*           — ChartWidget labels
  formula.*         — FormulaBar / IntelliSense
  field-presets.*   — FieldPreset menu
  data-table.*      — DataTable специфика
  stats.*           — StatsWidget
  checklist.*       — ChecklistWidget
  comparison.*      — ComparisonWidget
  filter-tabs.*     — FilterTabsWidget
  summary-row.*     — SummaryRowWidget
  view-port.*       — ViewPortWidget
  templates.*       — шаблоны виджетов

settings.
  project.*         — настройки проекта
  view.*            — настройки вида
  datasource.*      — источники данных

modals.
  confirm.*         — диалоги подтверждения
  add-view.*        — добавление вида
```

---

# APPENDIX A: Сравнительный файловый манифест

## A.1 Notion Feature → OPP File Mapping

```
NOTION FEATURE          → OPP FILE(S)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Property types          → src/lib/dataframe/dataframe.ts (DataFieldType)
                          src/settings/base/settings.ts (FieldConfig)
                          src/lib/datasources/frontmatter/typeResolver.ts

Formula system          → src/ui/views/Database/engine/formulaEngine.ts
                          src/ui/views/Database/engine/formulaMetadata.ts
                          src/lib/helpers/formulaParser.ts
                          src/ui/views/Database/widgets/FormulaBar.svelte
                          src/ui/views/Database/widgets/FormulaDebugPanel.svelte

Filter system           → src/settings/base/settings.ts (FilterDefinition)
                          src/lib/datasources/frontmatter/filter.ts

Sort system             → src/settings/base/settings.ts (SortDefinition)
                          src/lib/datasources/frontmatter/sort.ts

Group by                → src/ui/views/Database/types.ts (GroupConfig)
                          src/ui/views/Database/widgets/DataTable/groupRows.ts

Aggregation row         → src/ui/views/Database/engine/aggregation.ts
                          src/ui/views/Database/types.ts (AggregationConfig)

Relation property       → src/lib/dataframe/dataframe.ts (DataFieldType.Relation)
                          src/ui/views/Database/engine/relationResolver.ts

Rollup property         → src/lib/dataframe/dataframe.ts (DataFieldType.Rollup)
                          src/ui/views/Database/engine/rollup.ts

Cross-DB join           → src/ui/views/Database/engine/transformTypes.ts (JoinStep)
                          src/ui/views/Database/engine/transformExecutor.ts
                          src/ui/views/Database/engine/joinKey.ts
                          src/lib/externalFrameResolver.ts

Table view              → src/ui/views/Database/widgets/DataTable/DataTableWidget.svelte
                          src/ui/views/Database/widgets/DataTable/DataGrid.svelte

Board view              → src/ui/views/Board/BoardView.svelte

Calendar view           → src/ui/views/Calendar/CalendarView.svelte

Gallery view            → src/ui/views/Gallery/GalleryView.svelte

Timeline (TODO)         → src/ui/views/Timeline/ (NOT YET)

Charts                  → src/ui/views/Database/widgets/Chart/ChartWidget.svelte
                          src/ui/views/Database/engine/chartDataPipeline.ts

KPI/Stats               → src/ui/views/Database/widgets/Stats/StatsWidget.svelte

Automation (TODO)       → src/lib/automation/ (NOT YET)

Sub-items (TODO)        → DataTableWidget tree mode (NOT YET)

Multi-widget canvas     → src/ui/views/Database/DatabaseViewCanvas.svelte

Settings persistence    → src/settings/settings.ts + v1/v2/v3/

Data I/O                → src/lib/dataApi.ts
                          src/lib/filesystem/obsidian/filesystem.ts
```

---

# APPENDIX B: Глоссарий терминов

| Термин | Notion значение | OPP эквивалент |
|--------|----------------|----------------|
| Database | Коллекция однотипных страниц | ProjectDefinition |
| Page / Item / Record | Одна запись в базе | DataRecord (= один markdown файл) |
| Property | Поле базы данных | DataField |
| View | Представление базы | ViewDefinition (type="database") |
| Filter | Условие фильтрации | FilterDefinition |
| Sort | Сортировка | SortDefinition |
| Group by | Группировка | GroupConfig / GroupByStep |
| Relation | Связь с другой БД | DataFieldType.Relation (wiki-links) |
| Rollup | Агрегация по связям | DataFieldType.Rollup |
| Formula | Вычисляемое поле | DataFieldType.Formula |
| Dashboard | Многовиджетный экран | DatabaseViewCanvas |
| Chart | График | ChartWidget |
| Gallery | Карточки с обложками | Gallery view |
| Board | Kanban | Board view |
| Timeline | Временная шкала (Gantt) | Timeline view (TODO) |
| Automation | Триггер + действие | AutomationEngine (TODO) |
| Workspace | Рабочее пространство | Obsidian Vault |
| Block | Единица контента страницы | Markdown body |
| Cover | Обложка записи | Cover field (Gallery) |
| Sub-item | Дочерняя запись | parent: [[Note]] via relation |
| Linked database | Псевдоним базы | Multiple views per project |
| Template | Шаблон записи | Templater / OPP templates |
| FLATTEN | Развертывание массива | UNNEST step |
| Cross-DB query | Запрос между базами | JoinStep + externalFrameResolver |
| IntelliSense | Подсказки ввода | FormulaBar + FormulaMetadata |
| Schema | Определение полей | fields: DataField[] в DataFrame |

---

# APPENDIX C: Decision Log (архитектурные решения)

```
DECISION LOG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[DEC-001] Relation storage: UUID vs Wiki-Link
Problem:    Notion использует UUID для relations. Obsidian не имеет UUID.
Decision:   Wiki-links [[Note Name]] как primary relation storage.
Rationale:  Нативный для Obsidian формат. Human-readable. MetadataCache
            обеспечивает resolution. Rename через fileManager.renameFile
            автоматически обновляет wiki-links (Obsidian built-in).
Tradeoff:   Rename не транзакционен через несколько файлов.
            Cross-note consistency на best-effort основе.

[DEC-002] Formula eval: eval() vs AST interpreter
Problem:    Нужно безопасно выполнять пользовательские формулы.
Decision:   AST parser (formulaParser.ts) + custom interpreter.
Rationale:  eval() — критическая уязвимость (XSS, code injection).
            AST approach: безопасен, debuggable, extensible.
Tradeoff:   Не все JS выражения поддерживаются. Кастомные функции
            нужно явно добавлять в реестр.

[DEC-003] Chart library: external vs pure SVG
Problem:    Нужны графики. Chart.js/D3 = внешние зависимости.
Decision:   Pure SVG rendering без внешних библиотек.
Rationale:  Zero dependencies. Full theme control via CSS vars.
            Bundle size: ~0KB vs ~60KB (Chart.js minified).
Tradeoff:   Анимации, tooltips, accessibility — писать самостоятельно.
            Scatter correlation stats — писать вручную.

[DEC-004] Layout: media queries vs container queries
Problem:    Виджеты должны адаптироваться к размеру контейнера,
            а не к размеру окна.
Decision:   @container queries везде. Запрет @media для layout.
Rationale:  Widget в narrow sidebar vs fullscreen — разный контекст.
            Media query не знает о layout родителя.
Tradeoff:   @container не поддерживается в очень старых браузерах.
            Obsidian минимальная версия обеспечивает поддержку.

[DEC-005] Data flow: folder-based vs query-based
Problem:    Ранняя реализация создавала физические подпапки
            (CRM/, Finance/, Fitness/) для сегрегации данных.
Decision:   Flat storage + view.filter по frontmatter type поле.
Rationale:  "DATA FLOW OVER FOLDERS" — architectural directive.
            Физические папки ≠ логические группы данных.
            Фильтрация по типу гибче и обратимее.
Tradeoff:   Все файлы в одной папке → сложнее навигировать в explorer.

[DEC-006] Cross-source JOIN: live resolve vs pre-cache
Problem:    JoinStep нужен DataFrame из другого проекта.
Decision:   Pre-resolve + cache в DatabaseViewCanvas с generation token.
Rationale:  Нельзя resolvить синхронно (DataSource.queryAll — async).
            Generation token предотвращает race conditions.
Tradeoff:   Cache invalidation сложная (vault events + settings changes).
            Реализована через externalFrameInvalidation writable store.

[DEC-007] Width units: px vs rem
Problem:    Pixel widths не масштабируются с user font-size preference.
Decision:   Хранить widthRem в конфиге. Deprecated width (px).
Rationale:  "ZERO PIXELS POLICY" directive.
            rem = relative to root font size = доступно.
Tradeoff:   Legacy settings с px lazy-мигрируются через resolveColumnWidthPx.
            Граничный рендер (chart library) принимает numeric px — OK.

[DEC-008] Settings migration: breaking vs versioned
Problem:    Добавление новых полей в settings может сломать старые установки.
Decision:   Версионная миграция (v1→v2→v3) через fp-ts Either.
Rationale:  Безопасная миграция без потери данных.
            Either моnad: явная обработка ошибок без исключений.
Tradeoff:   Требует поддержки всех версий в коде навсегда.
            Решение: v1/v2 → v3 при загрузке, хранить всегда v3.
```

---

# APPENDIX D: Testing Strategy

```
TESTING PYRAMID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Unit Tests (Jest + ts-jest)
├── Engine tests (pure functions — fastest):
│   ├── formulaEngine.test.ts    — все 102 функции
│   ├── aggregation.test.ts      — 11 агрегаций
│   ├── transformExecutor.test.ts — все step types
│   ├── transformPivot.test.ts
│   ├── transformCache.test.ts
│   ├── rollup.test.ts
│   ├── chartDataPipeline.test.ts
│   ├── conditionalFormat.test.ts
│   ├── relationResolver.test.ts
│   ├── virtualScroll.test.ts
│   └── joinKey.ts (inline в joinStep.test.ts)
├── Helper tests:
│   ├── formulaMetadata.test.ts  — реестр 102 функций
│   ├── FormulaBar.kbd.test.ts   — findEnclosingCall
│   ├── fieldPreset.test.ts      — snapshot semantics
│   ├── widthUnits.test.ts       — rem conversion
│   └── removeDanglingSourceReferences.test.ts
├── Settings tests:
│   ├── settings.test.ts
│   └── migration.test.ts
└── DataApi tests:
    └── dataApi.processFrontMatter.test.ts

Integration / E2E Tests (Svelte component tests)
└── databaseView.e2e.test.ts     — canvas rendering

КАЧЕСТВО (по состоянию на v3.4.1 WIP)
- Suites: 54 | Tests: 923 | Pass rate: 100%
- svelte-check: 0 errors / 0 warnings
- tsc --noEmit: 0 errors

ЧТО НУЖНО ПОКРЫТЬ (TODO)
├── Timeline view (весь новый код)
├── Two-way relation write
├── Nested filter groups
├── Automation engine
└── Sub-items tree construction
```

---

*Конец документа. Версия 1.0.0 от 2026-04-28.*  
*Следующее обновление: после реализации Phase B (Property System Expansion).*

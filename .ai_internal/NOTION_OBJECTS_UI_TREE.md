# NOTION — ПОЛНОЕ ДЕРЕВО ОБЪЕКТОВ И UI/UX ЭЛЕМЕНТОВ
## Исчерпывающий каталог всех объектов, компонентов и интерактивных элементов

> **Документ:** Независимая архитектурная документация  
> **Тип:** Object & UI/UX Inventory  
> **Дата:** 2026-04-28  
> **Связанный документ:** `NOTION_DATABASE_INTEGRATION_MASTER.md`  
> **Метод:** Reverse engineering — публичный API + наблюдение UI

---

## НАВИГАЦИЯ

| Раздел | Содержание |
|--------|-----------|
| [§1](#1-глобальная-иерархия-объектов) | Глобальная иерархия объектов |
| [§2](#2-workspace-объект) | Workspace объект |
| [§3](#3-page-объект) | Page объект |
| [§4](#4-block-объекты---полный-каталог) | Block объекты — полный каталог |
| [§5](#5-database-объект) | Database объект |
| [§6](#6-database-property-типы---полный-каталог) | Database Property типы |
| [§7](#7-view-объекты---все-представления) | View объекты — все представления |
| [§8](#8-filter--sort--group-объекты) | Filter / Sort / Group объекты |
| [§9](#9-sidebar--navigation-ui) | Sidebar & Navigation UI |
| [§10](#10-toolbar--command-bar-ui) | Toolbar & Command Bar UI |
| [§11](#11-page-editor-ui) | Page Editor UI |
| [§12](#12-database-view-ui) | Database View UI |
| [§13](#13-property-editor-ui) | Property Editor UI |
| [§14](#14-context-menus) | Context Menus (все) |
| [§15](#15-modal-dialogs) | Modal Dialogs |
| [§16](#16-keyboard-shortcuts) | Keyboard Shortcuts |
| [§17](#17-drag--drop-interactions) | Drag & Drop Interactions |
| [§18](#18-inline-ui-elements) | Inline UI Elements |
| [§19](#19-notification--feedback-ui) | Notification & Feedback UI |
| [§20](#20-settings--configuration-ui) | Settings & Configuration UI |

---

# §1. ГЛОБАЛЬНАЯ ИЕРАРХИЯ ОБЪЕКТОВ

```
NOTION OBJECT TREE — TOP LEVEL
════════════════════════════════════════════════════════════════════

Notion Platform
└── Workspace (тенант / организация)
    ├── Members []                    ← пользователи
    │   ├── User
    │   │   ├── id: string (UUID)
    │   │   ├── name: string
    │   │   ├── email: string
    │   │   ├── avatar_url: string
    │   │   └── type: "person" | "bot"
    │   └── Guest (ограниченный доступ)
    │
    ├── Teams / Groups []             ← группы пользователей
    │   └── Team
    │       ├── id: string
    │       ├── name: string
    │       └── members: User[]
    │
    ├── Integrations / Bots []        ← API-интеграции
    │
    ├── Page Tree []                  ← иерархия страниц
    │   └── Page (рекурсивно)
    │       ├── id: string (UUID)
    │       ├── parent: Page | Workspace | Database
    │       ├── title: string (из title property)
    │       ├── icon: Emoji | ExternalFile | File | null
    │       ├── cover: ExternalFile | File | null
    │       ├── archived: boolean
    │       ├── in_trash: boolean
    │       ├── created_time: ISO8601
    │       ├── last_edited_time: ISO8601
    │       ├── created_by: User
    │       ├── last_edited_by: User
    │       ├── properties: Record<string, PropertyValue>  ← только если дочерняя БД
    │       ├── url: string
    │       └── Content: Block[]  ← тело страницы
    │
    ├── Database []                   ← базы данных (это тоже Page)
    │   └── Database
    │       ├── id: string (UUID)
    │       ├── title: RichText[]
    │       ├── description: RichText[]
    │       ├── icon / cover (как у Page)
    │       ├── is_inline: boolean   ← встроена в страницу или отдельная
    │       ├── properties: Record<name, PropertySchema>  ← СХЕМА БД
    │       ├── views: View[]        ← представления
    │       └── Items / Pages: Page[] ← записи
    │
    └── Settings
        ├── Workspace Settings
        ├── Member Settings
        ├── Billing
        ├── Identity & Provisioning (Enterprise)
        └── Integrations
```

---

# §2. WORKSPACE ОБЪЕКТ

```
Workspace
├── id: string
├── name: string
├── icon: Emoji | File
├── domain: string             ← notion.site domain
├── plan: "free" | "plus" | "business" | "enterprise"
│
├── Root Pages []              ← страницы верхнего уровня
├── Teamspaces []              ← разделы доступа (Business+)
│   └── Teamspace
│       ├── id, name, icon
│       ├── members: User[]
│       ├── permissions: Permission[]
│       └── pages: Page[]
│
├── Shared Pages []            ← общедоступные страницы (Published)
│
└── Trash                      ← корзина удалённых объектов
    └── TrashedItems: (Page | Database)[]
```

## 2.1 Permission Model

```
Permission Levels (на объект):
├── full_access    — чтение + запись + поделиться + удаление
├── can_edit       — чтение + запись
├── can_comment    — чтение + комментарии
└── can_view       — только чтение

Permission Inheritance:
Workspace → Teamspace → Page → Child Page → Database → Record
(каждый уровень может сужать, но не расширять права)
```

---

# §3. PAGE ОБЪЕКТ

```
Page
├── ── METADATA ─────────────────────────────────────────────────
├── id: string (UUID, неизменяем)
├── object: "page"
├── created_time: ISO8601
├── last_edited_time: ISO8601
├── created_by: { object: "user", id }
├── last_edited_by: { object: "user", id }
├── archived: boolean
├── in_trash: boolean
├── url: string (https://notion.so/page-id)
├── public_url: string | null (если опубликована)
│
├── ── IDENTITY ─────────────────────────────────────────────────
├── icon: Emoji | ExternalFile | File | null
│   ├── Emoji: { type: "emoji", emoji: "🚀" }
│   ├── ExternalFile: { type: "external", external: { url } }
│   └── File: { type: "file", file: { url, expiry_time } }
│
├── cover: ExternalFile | File | null
│   ├── ExternalFile: { type: "external", external: { url } }
│   └── File: { type: "file", file: { url, expiry_time } }
│
├── ── TITLE (встроено в properties) ────────────────────────────
├── properties.title: TitlePropertyValue
│   └── { id: "title", type: "title", title: RichText[] }
│
├── ── PARENT ───────────────────────────────────────────────────
├── parent:
│   ├── { type: "workspace", workspace: true }  ← корневая страница
│   ├── { type: "page_id", page_id: UUID }       ← дочерняя
│   ├── { type: "database_id", database_id: UUID } ← запись БД
│   └── { type: "block_id", block_id: UUID }    ← внутри блока
│
└── ── CONTENT ──────────────────────────────────────────────────
    └── children: Block[]   ← тело страницы (блоки)
```

## 3.1 RichText Object

```
RichText (базовый тип для форматированного текста)
├── type: "text" | "mention" | "equation"
├── plain_text: string          ← plain text версия
├── href: string | null         ← ссылка (если есть)
│
├── annotations:                ← форматирование
│   ├── bold: boolean
│   ├── italic: boolean
│   ├── strikethrough: boolean
│   ├── underline: boolean
│   ├── code: boolean           ← inline code
│   └── color: TextColor        ← цвет текста / фона
│       "default" | "gray" | "brown" | "orange" | "yellow" |
│       "green" | "blue" | "purple" | "pink" | "red" |
│       "gray_background" | "brown_background" | ...
│
├── text (если type="text"):
│   ├── content: string
│   └── link: { url: string } | null
│
├── mention (если type="mention"):
│   ├── type: "user"|"page"|"database"|"date"|"link_preview"|"template_mention"
│   ├── user: { object: "user", id }                (если type="user")
│   ├── page: { id: UUID }                          (если type="page")
│   ├── database: { id: UUID }                      (если type="database")
│   ├── date: { start, end, time_zone }             (если type="date")
│   ├── link_preview: { url }                       (если type="link_preview")
│   └── template_mention:                           (если type="template_mention")
│       ├── { type: "template_mention_date", template_mention_date: "today"|"now" }
│       └── { type: "template_mention_user", template_mention_user: "me" }
│
└── equation (если type="equation"):
    └── expression: string    ← LaTeX выражение
```

---

# §4. BLOCK ОБЪЕКТЫ — ПОЛНЫЙ КАТАЛОГ

```
Block (базовая структура)
├── id: string (UUID)
├── object: "block"
├── type: BlockType
├── created_time: ISO8601
├── last_edited_time: ISO8601
├── created_by: User
├── last_edited_by: User
├── archived: boolean
├── in_trash: boolean
├── has_children: boolean
├── parent: { type, [type]_id: UUID }
└── [type]: BlockData   ← данные специфичные для типа
```

## 4.1 Текстовые блоки

```
PARAGRAPH
├── type: "paragraph"
└── paragraph:
    ├── rich_text: RichText[]
    ├── color: TextColor
    └── children?: Block[]     ← вложенные блоки

HEADING_1 / HEADING_2 / HEADING_3
├── type: "heading_1" | "heading_2" | "heading_3"
└── heading_N:
    ├── rich_text: RichText[]
    ├── color: TextColor
    ├── is_toggleable: boolean  ← можно свернуть (heading с треугольником)
    └── children?: Block[]      ← только если is_toggleable

QUOTE
├── type: "quote"
└── quote:
    ├── rich_text: RichText[]
    ├── color: TextColor
    └── children?: Block[]

CALLOUT
├── type: "callout"
└── callout:
    ├── rich_text: RichText[]
    ├── icon: Emoji | ExternalFile | File
    ├── color: TextColor (фон + текст)
    └── children?: Block[]

CODE
├── type: "code"
└── code:
    ├── rich_text: RichText[]   ← код
    ├── caption: RichText[]     ← подпись
    └── language: "abap"|"arduino"|"bash"|"basic"|"c"|"clojure"|
                  "coffeescript"|"c++"|"c#"|"css"|"dart"|"diff"|
                  "docker"|"elixir"|"elm"|"erlang"|"flow"|"fortran"|
                  "f#"|"gherkin"|"glsl"|"go"|"graphql"|"groovy"|
                  "haskell"|"html"|"java"|"javascript"|"json"|
                  "julia"|"kotlin"|"latex"|"less"|"lisp"|"livescript"|
                  "lua"|"makefile"|"markdown"|"markup"|"matlab"|
                  "mermaid"|"nix"|"objective-c"|"ocaml"|
                  "pascal"|"perl"|"php"|"plain text"|"powershell"|
                  "prolog"|"protobuf"|"python"|"r"|"reason"|"ruby"|
                  "rust"|"sass"|"scala"|"scheme"|"scss"|"shell"|
                  "sql"|"swift"|"typescript"|"vb.net"|"verilog"|
                  "vhdl"|"visual basic"|"webassembly"|"xml"|"yaml"|
                  "java/c/c++/c#"

EQUATION (блок — не inline)
├── type: "equation"
└── equation:
    └── expression: string   ← LaTeX

DIVIDER
├── type: "divider"
└── divider: {}              ← горизонтальная линия — без параметров

TABLE_OF_CONTENTS
├── type: "table_of_contents"
└── table_of_contents:
    └── color: TextColor

BREADCRUMB
├── type: "breadcrumb"
└── breadcrumb: {}           ← показывает путь страницы
```

## 4.2 Список-блоки

```
BULLETED_LIST_ITEM
├── type: "bulleted_list_item"
└── bulleted_list_item:
    ├── rich_text: RichText[]
    ├── color: TextColor
    └── children?: Block[]   ← вложенные элементы

NUMBERED_LIST_ITEM
├── type: "numbered_list_item"
└── numbered_list_item:
    ├── rich_text: RichText[]
    ├── color: TextColor
    └── children?: Block[]

TO_DO
├── type: "to_do"
└── to_do:
    ├── rich_text: RichText[]
    ├── checked: boolean       ← выполнено?
    ├── color: TextColor
    └── children?: Block[]

TOGGLE
├── type: "toggle"
└── toggle:
    ├── rich_text: RichText[]
    ├── color: TextColor
    └── children?: Block[]   ← скрытое содержимое

COLUMN_LIST (контейнер для столбцов)
├── type: "column_list"
├── column_list: {}
└── children: Column[]

COLUMN
├── type: "column"
├── column: {}
└── children: Block[]
```

## 4.3 Медиа-блоки

```
IMAGE
├── type: "image"
└── image: File | ExternalFile
    ├── File: { type: "file", file: { url, expiry_time }, caption }
    └── External: { type: "external", external: { url }, caption }

VIDEO
├── type: "video"
└── video: File | ExternalFile  (те же поля + caption)

FILE (прикреплённый файл)
├── type: "file"
└── file: File | ExternalFile   + name: string

PDF
├── type: "pdf"
└── pdf: File | ExternalFile

AUDIO
├── type: "audio"
└── audio: File | ExternalFile
```

## 4.4 Embed-блоки

```
EMBED
├── type: "embed"
└── embed:
    ├── url: string
    └── caption: RichText[]

BOOKMARK
├── type: "bookmark"
└── bookmark:
    ├── url: string
    └── caption: RichText[]
    → UI: rich preview card с title + description + favicon

LINK_PREVIEW
├── type: "link_preview"
└── link_preview:
    └── url: string            ← автоматически генерируется из paste URL

LINK_TO_PAGE
├── type: "link_to_page"
└── link_to_page:
    ├── { type: "page_id", page_id: UUID }
    └── { type: "database_id", database_id: UUID }

CHILD_PAGE
├── type: "child_page"
└── child_page:
    └── title: string          ← заголовок вложенной страницы

CHILD_DATABASE
├── type: "child_database"
└── child_database:
    └── title: string          ← заголовок встроенной БД
```

## 4.5 Layout-блоки

```
TABLE
├── type: "table"
└── table:
    ├── table_width: number    ← количество столбцов
    ├── has_column_header: boolean
    ├── has_row_header: boolean
    └── children: TableRow[]

TABLE_ROW
├── type: "table_row"
└── table_row:
    └── cells: RichText[][]   ← каждая ячейка = RichText[]

SYNCED_BLOCK
├── type: "synced_block"
└── synced_block:
    ├── synced_from: { type: "block_id", block_id: UUID } | null
    └── children?: Block[]   ← null если это source, иначе ссылка

TEMPLATE
├── type: "template"
└── template:
    ├── rich_text: RichText[]  ← название шаблона
    └── children: Block[]     ← содержимое шаблона
```

## 4.6 Специальные блоки

```
UNSUPPORTED
└── type: "unsupported"       ← неизвестный тип (API placeholders)

AI_BLOCK (Notion AI)          ← доступен в платных планах
└── Генерирует контент по запросу (не в публичном API)
```

---

# §5. DATABASE ОБЪЕКТ

```
Database
├── ── METADATA ─────────────────────────────────────────────────
├── id: string (UUID)
├── object: "database"
├── created_time: ISO8601
├── last_edited_time: ISO8601
├── created_by: User
├── last_edited_by: User
├── archived: boolean
├── in_trash: boolean
├── url: string
├── public_url: string | null
├── is_inline: boolean          ← встроена в страницу-родитель?
│
├── ── IDENTITY ─────────────────────────────────────────────────
├── title: RichText[]
├── description: RichText[]
├── icon: Emoji | File | null
├── cover: File | null
│
├── ── PARENT ───────────────────────────────────────────────────
├── parent: { type: "page_id" | "workspace", ... }
│
├── ── SCHEMA ───────────────────────────────────────────────────
├── properties: Record<string, PropertySchema>
│   └── (см. §6 — полный каталог типов свойств)
│
└── ── VIEWS ────────────────────────────────────────────────────
    └── views: View[]  ← (не в публичном API v1, только в web-app)
        (см. §7 — типы представлений)
```

## 5.1 Database Item (запись)

```
DatabaseItem (это Page с заполненными properties)
├── id: string (UUID)
├── object: "page"
├── parent: { type: "database_id", database_id: UUID }
│
├── properties: Record<string, PropertyValue>
│   └── Каждое поле = заполненное PropertyValue
│       (соответствует PropertySchema из §6)
│
└── children?: Block[]   ← тело записи (если открыта как страница)
```

---

# §6. DATABASE PROPERTY ТИПЫ — ПОЛНЫЙ КАТАЛОГ

## 6.1 Schema vs Value (два уровня описания)

Каждое свойство существует в двух формах:
- **PropertySchema** — определение в `database.properties` (что это такое)
- **PropertyValue** — значение в `item.properties` (конкретные данные)

```
PROPERTY SCHEMA STRUCTURE (в database.properties)
├── id: string               ← внутренний ID поля
├── name: string             ← имя поля (видимое пользователю)
├── description?: string     ← подсказка под именем
└── type: PropertyType
    └── [type]: TypeConfig   ← конфигурация специфичная для типа
```

## 6.2 Все типы свойств — полный инвентарь

### TITLE
```
Schema:  { type: "title", title: {} }
Value:   { type: "title", title: RichText[] }
UI:      inline text editor (первая колонка, нельзя удалить)
Ops:     rename, change position
Limits:  одно на базу, всегда существует
```

### RICH_TEXT
```
Schema:  { type: "rich_text", rich_text: {} }
Value:   { type: "rich_text", rich_text: RichText[] }
UI:      textarea с форматированием (bold/italic/links/mentions)
Ops:     equals, contains, starts_with, ends_with, is_empty
```

### NUMBER
```
Schema:
  { type: "number", number: { format: NumberFormat } }
  NumberFormat:
    "number"           — 1234.56
    "number_with_commas" — 1,234.56
    "percent"          — 12.34%
    "dollar"           — $1,234.56
    "canadian_dollar"  — CA$1,234.56
    "singapore_dollar" — S$1,234.56
    "euro"             — €1,234.56
    "pound"            — £1,234.56
    "yen"              — ¥1,234
    "ruble"            — ₽1,234.56
    "rupee"            — ₹1,234.56
    "won"              — ₩1,234
    "yuan"             — CN¥1,234.56
    "real"             — R$1,234.56
    "lira"             — ₺1,234.56
    "rupiah"           — Rp1,234.56
    "franc"            — CHF1,234.56
    "hong_kong_dollar" — HK$1,234.56
    "new_zealand_dollar" — NZ$1,234.56
    "krona"            — kr1,234.56
    "norwegian_krone"  — kr1,234.56
    "mexican_peso"     — MX$1,234.56
    "rand"             — R1,234.56
    "new_taiwan_dollar" — NT$1,234.56
    "danish_krone"     — kr1,234.56
    "zloty"            — zł1,234.56
    "baht"             — ฿1,234.56
    "forint"           — Ft1,234.56
    "koruna"           — Kč1,234.56
    "shekel"           — ₪1,234.56
    "chilean_peso"     — CLP$1,234
    "philippine_peso"  — ₱1,234.56
    "dirham"           — AED1,234.56
    "colombian_peso"   — COP$1,234.56
    "riyal"            — SAR1,234.56
    "ringgit"          — RM1,234.56
    "leu"              — lei1,234.56
    "argentine_peso"   — $1,234.56
    "uruguayan_peso"   — $U1,234.56
    "singapore_dollar" — S$1,234.56
    "barometer"        — 🌑🌒🌓🌔🌕 (emoji визуализация 0-1)
    "w_rating"         — ⭐⭐⭐⭐⭐ (0-5 звёзд)
    
Value:   { type: "number", number: float | null }
Ops:     equals, does_not_equal, greater_than, less_than,
         greater_than_or_equal_to, less_than_or_equal_to, is_empty, is_not_empty
Agg:     sum, average, median, min, max, range, count, empty, not_empty
```

### SELECT
```
Schema:
  { type: "select", select: { options: SelectOption[] } }
  SelectOption:
    { id: string, name: string, color: OptionColor, description?: string }
  OptionColor: "default"|"gray"|"brown"|"orange"|"yellow"|
               "green"|"blue"|"purple"|"pink"|"red"

Value:   { type: "select", select: SelectOption | null }
UI:      dropdown с цветными чипами, поиск + создание нового
Ops:     equals, does_not_equal, is_empty, is_not_empty
Agg:     count, count_values, unique, empty, not_empty, count_per_group, percent_per_group
```

### MULTI_SELECT
```
Schema:
  { type: "multi_select", multi_select: { options: SelectOption[] } }
  (те же SelectOption как у select)

Value:   { type: "multi_select", multi_select: SelectOption[] }
UI:      multi-chip input с dropdown
Ops:     contains, does_not_contain, is_empty, is_not_empty
```

### STATUS
```
Schema:
  { type: "status", status: {
      options: SelectOption[],
      groups: StatusGroup[]
    }
  }
  StatusGroup:
    { id, name, color, option_ids: string[] }
  Предустановленные группы:
    "To-do"       (gray)   ← начальное состояние
    "In progress" (blue)   ← активная работа
    "Complete"    (green)  ← завершено

Value:   { type: "status", status: SelectOption | null }
UI:      grouped dropdown (опции разделены по группам)
         Иконки: ○ (todo), ⟳ (in progress), ✓ (complete)
```

### DATE
```
Schema:  { type: "date", date: {} }
Value:
  { type: "date", date: {
      start: "YYYY-MM-DD" | "YYYY-MM-DDTHH:mm:ss.sssZ",
      end: string | null,        ← если диапазон
      time_zone: string | null   ← IANA timezone
    } | null
  }
UI:
  ├── Date picker (calendar popup)
  ├── Toggle "Include time" → показывает time picker
  ├── Toggle "End date" → второй date picker для диапазона
  └── Timezone selector
Ops:     equals, before, after, on_or_before, on_or_after,
         is_empty, is_not_empty,
         past_week, past_month, past_year, past_3_months,
         next_week, next_month, next_year,
         this_week, last_week
Agg:     earliest_date, latest_date, date_range, count, empty, not_empty
```

### PEOPLE
```
Schema:  { type: "people", people: {} }
Value:
  { type: "people", people: Array<User | Bot> }
  User: { object: "user", id, name, avatar_url, type: "person",
          person: { email } }
  Bot:  { object: "user", id, name, avatar_url, type: "bot",
          bot: { owner, workspace_name } }
UI:
  ├── Member picker (поиск по имени/email)
  ├── Avatars с именами
  └── + кнопка для добавления
Ops:     contains (user_id), does_not_contain, is_empty, is_not_empty
```

### RELATION
```
Schema:
  { type: "relation", relation: {
      database_id: UUID,           ← целевая БД
      type: "single_property" | "dual_property",
      single_property: {} | undefined,
      dual_property: {             ← только для dual
        synced_property_id: string,
        synced_property_name: string
      } | undefined
    }
  }

Value:
  { type: "relation", relation: Array<{ id: UUID }>,
    has_more: boolean }            ← pagination (>25 записей)
    
UI:
  ├── Search popup по записям целевой БД
  ├── Chips с названиями выбранных записей (кликабельные → открывают запись)
  ├── + Add relation кнопка
  └── Inline create нового связанного элемента
  
Ops:     contains (page_id), does_not_contain, is_empty, is_not_empty
```

### ROLLUP
```
Schema:
  { type: "rollup", rollup: {
      relation_property_id: string,   ← ID relation-поля
      relation_property_name: string,
      rollup_property_id: string,     ← поле в target DB
      rollup_property_name: string,
      function: RollupFunction
    }
  }
  RollupFunction:
    "count"              "count_values"      "empty"
    "not_empty"          "unique"            "show_original"
    "show_unique"        "sum"               "average"
    "median"             "min"               "max"
    "range"              "earliest_date"     "latest_date"
    "date_range"         "checked"           "unchecked"
    "percent_checked"    "percent_unchecked" "count_per_group"
    "percent_per_group"  "sum_per_group"

Value:
  { type: "rollup", rollup:
      { type: "number", number: float } |
      { type: "date", date: DateObject } |
      { type: "array", array: PropertyValue[], function: RollupFunction } |
      { type: "incomplete", incomplete: {} } |      ← не все данные загружены
      { type: "unsupported", unsupported: {} }
  }
  
UI:
  Readonly. Отображает вычисленное значение.
  При hover: показывает список связанных значений.
```

### FORMULA
```
Schema:
  { type: "formula", formula: { expression: string } }
  expression: строка с формулой Notion (см. §1.3 в MASTER документе)

Value:
  { type: "formula", formula:
      { type: "string", string: string } |
      { type: "number", number: float } |
      { type: "boolean", boolean: bool } |
      { type: "date", date: DateObject }
  }
  
UI:
  Readonly. Рендерится по типу результата.
  Formula Editor: отдельный popup с:
    ├── Textarea для выражения
    ├── Autocomplete (properties, functions)
    ├── Live preview результата для первой записи
    ├── Syntax highlighting
    └── Error display (красная подсветка + сообщение)
```

### CHECKBOX
```
Schema:  { type: "checkbox", checkbox: {} }
Value:   { type: "checkbox", checkbox: boolean }
UI:      чекбокс (click to toggle)
Ops:     equals (true/false)
Agg:     checked, unchecked, percent_checked, percent_unchecked, count
```

### EMAIL
```
Schema:  { type: "email", email: {} }
Value:   { type: "email", email: string | null }
UI:      text input + mailto: link при hover
Ops:     equals, does_not_equal, contains, does_not_contain,
         starts_with, ends_with, is_empty, is_not_empty
```

### URL
```
Schema:  { type: "url", url: {} }
Value:   { type: "url", url: string | null }
UI:      text input + открыть ссылку (кнопка при hover)
         Favicon preview в некоторых видах
Ops:     equals, does_not_equal, contains, does_not_contain,
         starts_with, ends_with, is_empty, is_not_empty
```

### PHONE_NUMBER
```
Schema:  { type: "phone_number", phone_number: {} }
Value:   { type: "phone_number", phone_number: string | null }
UI:      text input + tel: link при hover
Ops:     equals, does_not_equal, contains, does_not_contain,
         starts_with, ends_with, is_empty, is_not_empty
```

### FILES (File & Media)
```
Schema:  { type: "files", files: {} }
Value:
  { type: "files", files: Array<File | ExternalFile> }
  File:         { name, type: "file", file: { url, expiry_time } }
  ExternalFile: { name, type: "external", external: { url } }
  
UI:
  ├── Drag & drop upload area
  ├── Paste URL для external
  ├── Просмотр превью (изображения, PDF)
  └── Download кнопка
Ops:     is_empty, is_not_empty
```

### CREATED_TIME (автоматическое)
```
Schema:  { type: "created_time", created_time: {} }
Value:   { type: "created_time", created_time: ISO8601 }
UI:      Readonly datetime
Ops:     equals, before, after, on_or_before, on_or_after (+ relative)
```

### LAST_EDITED_TIME (автоматическое)
```
Schema:  { type: "last_edited_time", last_edited_time: {} }
Value:   { type: "last_edited_time", last_edited_time: ISO8601 }
UI:      Readonly datetime
```

### CREATED_BY (автоматическое)
```
Schema:  { type: "created_by", created_by: {} }
Value:   { type: "created_by", created_by: User }
UI:      Readonly avatar + name
Ops:     contains (user_id), does_not_contain, is_empty, is_not_empty
```

### LAST_EDITED_BY (автоматическое)
```
Schema:  { type: "last_edited_by", last_edited_by: {} }
Value:   { type: "last_edited_by", last_edited_by: User }
UI:      Readonly avatar + name
```

### UNIQUE_ID
```
Schema:
  { type: "unique_id", unique_id: { prefix: string | null } }
Value:
  { type: "unique_id", unique_id: { prefix: string | null, number: int } }
  → отображается как: "PROJ-42" или "42"
UI:      Readonly. Автоинкремент при создании.
Ops:     equals, does_not_equal, greater_than, less_than, ...
```

### BUTTON (действие)
```
Schema:
  { type: "button", button: { ... } }   ← только в новых API версиях
UI:
  ├── Кнопка с меткой в ячейке
  ├── Click → запускает automation action
  └── Конфигурируется через Automation Rules
```

### VERIFICATION (Enterprise)
```
Schema:  { type: "verification", verification: {} }
Value:
  { type: "verification", verification: {
      state: "verified" | "unverified",
      verified_by: User | null,
      date: DateObject | null
    }
  }
UI:
  ├── ✓ Verified / ○ Unverified badge
  ├── Click → mark as verified / unverified
  └── Shows verifier + date on hover
```

### AI_SUMMARY (Notion AI, платный)
```
Schema:  { type: "ai_summary", ai_summary: { ... } }
UI:      AI-генерируемый текст из тела записи
         Кнопка "Regenerate" для пересчёта
```

---

# §7. VIEW ОБЪЕКТЫ — ВСЕ ПРЕДСТАВЛЕНИЯ

## 7.1 View Base Structure

```
View (базовая структура)
├── id: string
├── type: ViewType
├── name: string
├── created_time, last_edited_time
│
├── filter: FilterObject           ← активные фильтры
├── sorts: SortObject[]           ← сортировка
├── group_by: GroupObject | null  ← группировка
├── sub_group_by: GroupObject | null  ← вторичная группировка
│
├── properties: ViewPropertyConfig[]   ← видимость и порядок полей
│   └── { key, id, type, visible, width?, wrap? }
│
└── [view_specific]: ViewConfig   ← конфигурация специфичная для типа
```

## 7.2 TABLE VIEW

```
TableView
├── type: "table"
├── layout:
│   ├── table_wrap: boolean         ← перенос строк в ячейках
│   └── properties: ColumnConfig[]
│       ├── { property_id, visible: true/false }
│       ├── width: number (px)
│       ├── pinned: boolean
│       └── wrap: boolean           ← перенос текста в колонке
│
├── aggregations: AggregationRow
│   └── { property_id → function: AggregationFunction }
│
├── group_by:
│   ├── property_id: string
│   ├── hidden_groups: string[]
│   └── sort: GroupSortConfig
│
└── sub_group_by: (те же поля)
```

## 7.3 BOARD VIEW

```
BoardView
├── type: "board"
├── group_by: { property_id }    ← ОБЯЗАТЕЛЬНО (по чему строить колонки)
├── sub_group_by: { property_id? }
│
├── layout:
│   ├── board_columns:
│   │   └── ColumnConfig[]
│   │       ├── { group_value, hidden: bool }
│   │       └── collapsed: bool
│   └── card_layout:
│       ├── cover: { type, value }  ← поле для обложки карточки
│       │   type: "none" | "page_cover" | "property"
│       │   value: property_id (если type="property")
│       ├── cover_size: "small" | "medium" | "large"
│       ├── cover_aspect: "center" | "full"
│       └── card_width: "narrow" | "medium" | "wide"
│
└── properties: VisibleProperty[]   ← поля на карточке
```

## 7.4 GALLERY VIEW

```
GalleryView
├── type: "gallery"
├── layout:
│   ├── gallery_cover:
│   │   ├── type: "none" | "page_cover" | "page_content" | "property" | "file"
│   │   └── value: property_id | null
│   ├── gallery_cover_size: "small" | "medium" | "large"
│   ├── gallery_cover_aspect: "center" | "full"
│   └── gallery_title_position: "below_cover" | "hidden"
│
└── properties: VisibleProperty[]
```

## 7.5 CALENDAR VIEW

```
CalendarView
├── type: "calendar"
├── layout:
│   ├── calendar_by: { property_id }   ← дата для позиционирования
│   └── calendar_cover:
│       ├── type: "none" | "page_cover" | "property"
│       └── value: property_id | null
│
└── show_properties: VisibleProperty[]
```

## 7.6 LIST VIEW

```
ListView
├── type: "list"
├── layout:
│   └── list_properties: VisibleProperty[]
│
└── (минимальная конфигурация — нет cover/group)
```

## 7.7 TIMELINE VIEW

```
TimelineView
├── type: "timeline"
├── layout:
│   ├── timeline_by: { property_id }          ← start date поле
│   ├── timeline_show_table: boolean           ← показывать левую панель
│   ├── timeline_table_properties: VisibleProperty[]
│   │
│   ├── timeline_date_start: ISO8601           ← видимый период
│   ├── timeline_date_end: ISO8601
│   ├── timeline_granularity:
│   │   "day" | "week" | "biweek" | "month" | "quarter" | "year"
│   │
│   └── timeline_end_by: { property_id? }     ← end date поле (опционально)
│
└── group_by, sub_group_by, properties (стандартные)
```

---

# §8. FILTER / SORT / GROUP ОБЪЕКТЫ

## 8.1 Filter Object (полное дерево)

```
FilterObject (рекурсивный)
├── Compound filters:
│   ├── { "and": FilterObject[] }   ← все условия должны выполняться
│   └── { "or": FilterObject[] }    ← хотя бы одно условие
│
└── Property filters (листовые узлы):

    TEXT FILTER (для title, rich_text, url, email, phone)
    { property: string, rich_text: {
        equals? | does_not_equal? | contains? | does_not_contain? |
        starts_with? | ends_with? | is_empty?: true | is_not_empty?: true
    }}

    NUMBER FILTER
    { property: string, number: {
        equals? | does_not_equal? |
        greater_than? | less_than? |
        greater_than_or_equal_to? | less_than_or_equal_to? |
        is_empty?: true | is_not_empty?: true
    }}

    CHECKBOX FILTER
    { property: string, checkbox: { equals: boolean | does_not_equal: boolean }}

    SELECT FILTER
    { property: string, select: {
        equals? | does_not_equal? | is_empty?: true | is_not_empty?: true
    }}

    MULTI-SELECT FILTER
    { property: string, multi_select: {
        contains? | does_not_contain? | is_empty?: true | is_not_empty?: true
    }}

    STATUS FILTER
    { property: string, status: {
        equals? | does_not_equal? | is_empty?: true | is_not_empty?: true
    }}

    DATE FILTER
    { property: string, date: {
        equals?: DateString |
        before?: DateString | after?: DateString |
        on_or_before?: DateString | on_or_after?: DateString |
        is_empty?: true | is_not_empty?: true |
        past_week?: {} | past_month?: {} | past_year?: {} | past_3_months?: {} |
        next_week?: {} | next_month?: {} | next_year?: {} |
        this_week?: {}
    }}

    PEOPLE FILTER
    { property: string, people: {
        contains?: UserID | does_not_contain?: UserID |
        is_empty?: true | is_not_empty?: true
    }}

    FILES FILTER
    { property: string, files: { is_empty?: true | is_not_empty?: true }}

    RELATION FILTER
    { property: string, relation: {
        contains?: PageID | does_not_contain?: PageID |
        is_empty?: true | is_not_empty?: true
    }}

    FORMULA FILTER
    { property: string, formula: {
        string?: TextFilter |
        number?: NumberFilter |
        checkbox?: CheckboxFilter |
        date?: DateFilter
    }}

    ROLLUP FILTER
    { property: string, rollup: {
        any?: PropertyFilter |    ← хотя бы один элемент
        every?: PropertyFilter |  ← все элементы
        none?: PropertyFilter |   ← ни один элемент
        date?: DateFilter |
        number?: NumberFilter |
        item_count?: NumberFilter
    }}

    UNIQUE_ID FILTER
    { property: string, unique_id: { equals? | does_not_equal? | ... NumberFilter }}

    TIMESTAMP FILTERS (не property, а системные)
    { timestamp: "created_time" | "last_edited_time", created_time: DateFilter }
    { timestamp: "created_time" | "last_edited_time", last_edited_time: DateFilter }
```

## 8.2 Sort Object

```
SortObject
├── { property: string, direction: "ascending" | "descending" }
└── { timestamp: "created_time" | "last_edited_time",
      direction: "ascending" | "descending" }

Массив sorts: применяются последовательно (первый = главный)
```

## 8.3 Group Object

```
GroupObject
├── property_id: string
├── direction: "ascending" | "descending"
│
└── (дополнительные параметры зависят от типа поля):
    ├── date fields: group_by: "day"|"week"|"month"|"year"
    └── boolean: без дополнительных параметров
```

---

# §9. SIDEBAR & NAVIGATION UI

```
SIDEBAR (левая панель)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP SECTION
├── Workspace Switcher
│   ├── Workspace avatar + name (кликабельно → popup)
│   └── Popup:
│       ├── Switch workspace
│       ├── Create workspace (кнопка)
│       └── Log out
│
├── Search (⌘K / Ctrl+K)
│   └── Quick Find popup (глобальный поиск)
│
├── Notion Home
│   └── Dashboard view (Recent, Pinned, Teamspaces)
│
├── Inbox (уведомления / mentions)
│   └── Badge с количеством непрочитанных
│
└── Settings & members

TEAMSPACES SECTION (Business+)
├── Teamspace header (иконка + название)
│   └── Context menu: Add members, Settings, Leave
└── Pages в teamspace

FAVORITES SECTION
└── Starred pages (drag to reorder)

PRIVATE SECTION
└── Страницы только текущего пользователя

SHARED SECTION
└── Общие страницы workspace

PAGE TREE (каждая страница)
├── Expand chevron ▶ (click → разворачивает дочерние страницы)
├── Page icon + название
├── Hover actions (справа):
│   ├── ⋯ (More options → context menu)
│   └── + (New subpage)
└── Context menu:
    ├── Add to Favorites
    ├── Duplicate
    ├── Copy link
    ├── Rename
    ├── Move to
    ├── Export
    ├── Delete
    └── Open in new tab

BOTTOM SECTION
├── Templates (галерея шаблонов Notion)
├── Import (CSV, Markdown, Evernote, etc.)
├── Trash
└── New page (кнопка)
```

---

# §10. TOOLBAR & COMMAND BAR UI

## 10.1 Page Header Toolbar

```
PAGE HEADER (сверху страницы)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEFT SIDE
├── ← Back (история навигации)
├── → Forward
├── Breadcrumb trail: Workspace / Parent / CurrentPage
└── Lock icon (если страница заблокирована)

RIGHT SIDE
├── Share button
│   └── Share popup:
│       ├── Share link toggle (copy link)
│       ├── Allow search engines
│       ├── Share to web toggle
│       ├── Invite people (email input)
│       └── Current members list с правами
│
├── Comments button (⌘⇧M)
│   └── Toggle comments panel
│
├── Updates / Activity button
│   └── История изменений
│
├── Favorite (★)
│
└── ⋯ More options
    ├── Style (Default / Sans / Mono / Default)
    ├── Small text (toggle)
    ├── Full width (toggle)
    ├── Page history (Pro+)
    ├── Page analytics (Enterprise)
    ├── Show deleted blocks
    ├── ---
    ├── Add connections (integrations)
    ├── ---
    ├── Word count
    ├── Print (⌘P)
    ├── Import
    ├── Export
    │   ├── Export as: Markdown & CSV | PDF | HTML
    │   └── Include subpages toggle
    ├── Move to
    ├── Delete page (в Trash)
    └── Templates (использовать как шаблон)
```

## 10.2 Slash Commands ("/")

```
SLASH COMMAND MENU (вводится в редакторе через "/")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BASIC BLOCKS
/text         → Paragraph
/page         → New Page (inline или ссылка)
/todo         → To-do checkbox
/h1           → Heading 1
/h2           → Heading 2
/h3           → Heading 3
/bullet       → Bulleted list
/numbered     → Numbered list
/toggle       → Toggle list
/code         → Code block
/quote        → Quote
/divider      → Horizontal divider
/callout      → Callout (с иконкой)
/equation     → Math equation (LaTeX)

DATABASE BLOCKS
/table        → Table database (new)
/board        → Board database (new)
/timeline     → Timeline database (new)
/calendar     → Calendar database (new)
/gallery      → Gallery database (new)
/list         → List database (new)
/linked-view  → Link to existing database

MEDIA
/image        → Insert image (upload/URL)
/video        → Insert video (upload/URL/embed)
/file         → Insert file
/audio        → Insert audio
/web-bookmark → Bookmark card
/embed        → Embed (URL → rich preview)

LAYOUT
/columns      → 2 columns
/3-columns    → 3 columns
/table-simple → Simple table (не database)
/toc          → Table of contents
/breadcrumb   → Breadcrumb

ADVANCED
/synced-block → Synced block
/template     → Template button
/link-to-page → Link to existing page
/mention-page → @mention a page
/date         → Date/reminder
/remind       → Reminder

NOTION AI
/summarize    → AI summary of current page
/improve      → AI improve writing
/fix-spelling → Fix spelling & grammar
/translate    → Translate to...
/explain      → AI explain
/action-items → Extract action items
/custom       → Custom AI prompt
```

## 10.3 Inline Slash Triggers

```
@ (AT mention) MENU
├── People (workspace members)
├── Pages (быстрый поиск)
├── Dates (быстрый ввод даты + напоминание)
└── Bots/Integrations

/ (SLASH) → см. выше

+ (PLUS на hover margin) → добавить блок
⋮⋮ (DRAG HANDLE hover) → опции блока

[[ (double bracket) → Link to page (как @ для страниц)
```

---

# §11. PAGE EDITOR UI

## 11.1 Block Toolbar (появляется при hover)

```
BLOCK HOVER TOOLBAR (появляется слева от блока при наведении)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

+ (Add block below)
⋮⋮ (Drag handle)
   └── Click → Block Options menu:
       ├── Delete
       ├── Duplicate
       ├── Copy link to block
       ├── Move to (другую страницу)
       ├── ---
       ├── Turn into:
       │   ├── Text / Heading 1,2,3
       │   ├── Quote / Callout / Code
       │   ├── Bulleted / Numbered / Toggle
       │   ├── To-do / Equation
       │   └── Page (convert block to page)
       ├── Color:
       │   ├── Text: Default/Gray/Brown/Orange/Yellow/Green/Blue/Purple/Pink/Red
       │   └── Background: same + _background suffix
       ├── Comment (⌘⇧M)
       └── Last edited: [date] (информация)
```

## 11.2 Text Selection Toolbar (Inline Formatting)

```
SELECTION TOOLBAR (появляется при выделении текста)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Ask AI] [Bold B] [Italic I] [Underline U] [Strikethrough S]
[Code `] [Link 🔗] [Aa Color ▼] [Comment 💬] [⋯ More ▼]

More ▼ popup:
├── Equation (wrap in LaTeX)
├── Mention a page
├── Mention a person
├── Mention a date
└── Turn into (block type change)

Color ▼ popup:
├── Text colors: Default, Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red
└── Background: Gray, Brown, Orange, Yellow, Green, Blue, Purple, Pink, Red

Link input (при нажатии Link):
├── Text input для URL
├── Search pages по названию
└── Apply / Remove
```

## 11.3 Page Cover UI

```
PAGE COVER (полоса сверху страницы)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

При hover на cover:
├── "Change cover" button
│   └── Cover picker popup:
│       ├── Tab "Gallery" — встроенные (Notion градиенты + photos)
│       │   └── Unsplash integration (поиск фото)
│       ├── Tab "Upload" — загрузить файл
│       ├── Tab "Link" — URL изображения
│       └── "Remove" — убрать обложку
│
└── "Reposition" button
    └── Drag вверх/вниз для изменения позиции
    └── "Save position" кнопка

Добавление обложки (если нет):
└── Hover над заголовком → "Add cover" текстовая кнопка
```

## 11.4 Page Icon UI

```
PAGE ICON (слева от заголовка)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click на icon → Icon picker popup:
├── Tab "Emoji" — emoji picker (по категориям + поиск)
├── Tab "Icons" — встроенные иконки Notion (SVG)
│   └── Поиск по имени + категории
├── Tab "Custom" — загрузить изображение
├── Tab "Upload" — загрузить файл
└── "Remove" — убрать иконку

Добавление иконки (если нет):
└── Hover над заголовком → "Add icon" текстовая кнопка
```

## 11.5 Comments System

```
COMMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Page-level comments:
└── Comments panel (правая панель) — хронологический список

Inline comments (на блоках):
├── Выделить текст → "Comment" → редактор
├── Highlighted text становится жёлтым
└── Thread:
    ├── Comment: { author, text: RichText[], created_at }
    ├── Reactions: emoji реакции
    ├── Reply (вложенные ответы)
    └── Resolve (пометить как решённое)

Comment Editor:
├── Textarea с @mentions
├── Submit: Enter (или кнопка)
└── Cancel: Escape
```

---

# §12. DATABASE VIEW UI

## 12.1 Database Toolbar (над таблицей)

```
DATABASE TOOLBAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEFT SIDE
├── Database title (кликабельно → inline rename)
├── View tabs (+ Add a view кнопка)
│   └── Каждый tab: click → переключиться | ⋯ → context menu
│       Context menu:
│       ├── Rename
│       ├── Edit view (открывает настройки)
│       ├── Duplicate view
│       ├── Copy link to view
│       ├── Lock database (запрещает редактирование структуры)
│       └── Delete

RIGHT SIDE (контролы фильтрации/отображения)
├── Filter button
│   └── Dropdown:
│       ├── + Add filter
│       │   └── Property picker → operator picker → value input
│       ├── Active filters (chips с возможностью удаления)
│       └── Filter by formula (Pro+)
│
├── Sort button
│   └── Dropdown:
│       ├── + Add sort
│       │   └── Property picker → direction toggle
│       └── Active sorts (drag to reorder)
│
├── Group by button
│   └── Dropdown:
│       ├── Group by: property picker
│       ├── Sub-group by: property picker
│       └── Group settings:
│           ├── Sort groups (ascending/descending/manual)
│           ├── Show empty groups (toggle)
│           └── Hide groups: список значений с toggle
│
├── Properties button (что показывать)
│   └── Dropdown:
│       ├── Search input
│       ├── Toggle all
│       └── Property list с переключателями (drag to reorder)
│           + wrap toggle (для текстовых колонок)
│
├── ⋯ More
│   ├── Lock database / Unlock database
│   ├── Load limit (сколько записей грузить)
│   ├── Wrap all columns toggle
│   ├── No groups / Group settings
│   └── Automations
│
└── Search (🔍)
    └── Inline search по данным в текущем view
```

## 12.2 Table View Interactions

```
COLUMN HEADER
├── Click → сортировка (первый: ascending, второй: descending, третий: none)
├── Drag (left edge) → resize column
├── Drag (header area) → reorder columns
└── Context menu (правый click или ▼ hover):
    ├── Filter by [column]
    ├── Sort ascending / Sort descending
    ├── ---
    ├── Wrap column (toggle)
    ├── Freeze up to this column / Unfreeze
    ├── Insert left / Insert right
    ├── Duplicate property
    ├── Rename
    ├── Edit property (тип + настройки)
    └── Delete property
        └── Confirm dialog (если есть данные)

CELL INTERACTIONS
├── Click → edit mode
├── Double-click → full property editor
├── Tab → следующая ячейка
├── Enter → создать новую строку (в конце)
│
├── Checkbox cell: Click = toggle
├── Date cell: Click = date picker popup
├── Select cell: Click = dropdown options
├── Relation cell: Click = relation picker
└── Formula cell: Click = открыть формулу

ROW INTERACTIONS
├── Hover → показывает:
│   ├── Checkbox (bulk select)
│   ├── Open ↗ (открыть запись в полном окне)
│   └── Row drag handle ⋮⋮
├── Click на checkbox → выбрать (bulk actions toolbar появляется сверху)
├── Click на Open ↗ → открыть как страницу
├── Right-click → row context menu
│   ├── Open
│   ├── Open in new tab
│   ├── Open in side peek
│   ├── Open in full page
│   ├── ---
│   ├── Edit property (если cursor на ячейке)
│   ├── Insert above
│   ├── Insert below
│   ├── Delete
│   ├── Duplicate
│   ├── Copy link
│   └── Move to

BULK ACTIONS TOOLBAR (при выделении нескольких строк)
├── [N selected] label
├── Delete
├── Duplicate
├── Move to (другой проект/папку)
├── Add/Remove property values
└── Deselect all ✕

FOOTER ROW (агрегации)
├── Click на ячейку → выбрать функцию:
│   Count all, Count values, Count unique values,
│   Empty, Not empty,
│   Sum, Average, Median, Min, Max, Range (для number)
│   Earliest date, Latest date, Date range (для date)
│   Checked, Unchecked, Percent checked (для checkbox)
└── "Calculate" hover text

NEW ROW
├── "+ New" кнопка внизу таблицы
│   └── Создаёт пустую запись + открывает inline editor
├── Кнопки "+ New [template name]" для быстрого создания по шаблону
└── Drag на область ниже → создаёт запись из drop
```

## 12.3 Board View Interactions

```
BOARD COLUMN
├── Header:
│   ├── Group name + count
│   ├── Toggle collapse ▼
│   ├── + Add card (top)
│   └── ⋯ context menu:
│       ├── Hide (скрыть колонку)
│       ├── Add above / Add below (для select — создаёт новое значение)
│       └── Delete (только если пустая, или переносит карточки)
│
├── Cards:
│   ├── Drag → move to another column (изменяет значение property)
│   ├── Drag up/down → manual sort
│   └── Click → открывает quick peek или full page
│
└── "+ New" внизу колонки

CARD
├── Обложка (image property / page cover)
├── Title
├── Visible properties (до N полей)
└── Hover:
    ├── ⋯ More → context menu
    └── Click открывает → record detail

COLUMN DRAG
└── Перетаскивание заголовка колонки → reorder групп
```

## 12.4 Record Detail (Full View)

```
RECORD DETAIL (открывается при click на запись)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Режимы отображения:
├── Peek (side panel — 50% ширины)
│   └── Кнопка Open as Page → полная страница
├── Full page (вся ширина вкладки)
└── Modal (centered popup) — для некоторых действий

HEADER
├── Icon + Cover (те же контролы что у обычной страницы)
├── Title field (редактируется inline)
└── Close (×) или ← Back

PROPERTIES PANEL (левая или верхняя секция)
├── Каждое поле:
│   ├── Property name (кликабельно → rename)
│   ├── Property value (кликабельно → editor)
│   └── + Add a property (в конце списка)
│
└── Property editor popup (при click на value):
    (см. §13 — Property Editor UI)

BODY (правая или нижняя секция)
└── Block editor (те же блоки что на обычной странице)

BOTTOM ACTIONS
├── Add comment
└── + Add a property (быстрое добавление нового поля в схему)
```

---

# §13. PROPERTY EDITOR UI

## 13.1 Universal Property Edit Popup

```
PROPERTY EDIT POPUP (открывается при click на значение в записи)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEADER
├── Property name (с иконкой типа)
├── Type indicator
└── Edit property (переходит к схеме поля)

CONTENT (зависит от типа):

title / rich_text:
  └── Multiline text editor с форматированием

number:
  ├── Number input
  └── Format display (текущий формат)

select:
  ├── Search input
  ├── Option chips (кликабельны)
  ├── Selected chip с X (очистить)
  └── + Create [input text] option (если не найдено)

multi_select:
  ├── Search input
  ├── Multi-chip area (выбранные)
  ├── Option list с checkboxes
  └── + Create option

status:
  └── Grouped option list:
      ├── [Group name] header
      └── Options (кликабельны, меняют статус)

date:
  ├── Calendar grid (месячный вид)
  ├── Month/Year навигация ← →
  ├── "Clear" кнопка
  ├── "Include time" toggle → time picker появляется
  ├── "End date" toggle → второй calendar для range
  └── "Time zone" selector (dropdown с IANA zones)

people:
  ├── Search input (по имени / email)
  ├── Selected people chips (с X)
  └── Suggested people список

checkbox:
  └── Просто toggle (click = toggle без popup)

relation:
  ├── Search input (по title целевой БД)
  ├── Selected items chips
  ├── Results list
  ├── + Create and add [input text] (создать новую запись)
  └── Filter results by... (additional filter on target)

files:
  ├── Upload area (drag & drop или click)
  ├── Paste URL button
  ├── Existing files list:
  │   ├── Preview thumbnail
  │   ├── File name (кликабельно → download)
  │   ├── File size
  │   └── × Remove
  └── + Add file кнопка

url:
  └── Text input с иконкой "открыть ссылку"

email / phone:
  └── Text input с иконкой действия

formula:
  └── Formula editor (см. §13.2)
```

## 13.2 Formula Editor

```
FORMULA EDITOR (popup при редактировании formula property)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEADER
├── "Formula" label
└── Current return type indicator (String/Number/Boolean/Date)

EDITOR AREA
├── Multiline code textarea
│   ├── Syntax highlighting
│   ├── Autocomplete dropdown при вводе:
│   │   ├── Properties (prefix: "prop(" → выбор property)
│   │   ├── Functions (первые буквы → список функций)
│   │   └── Constants (true, false, pi, e)
│   └── Error underline для невалидных выражений
│
├── RESULT PREVIEW (под textarea)
│   └── Результат для первой записи БД (или placeholder)
│
├── ERROR MESSAGE (если есть)
│   └── Красный текст с описанием ошибки

REFERENCE PANEL (правая секция)
├── Tab "Properties" — все поля БД с примерами значений
├── Tab "Functions" — список функций по категориям
│   └── Click на функцию → вставить + показать signature
└── Tab "Constants" — специальные значения

FOOTER
├── Done / Cancel кнопки
└── "Learn more" (ссылка на документацию)
```

## 13.3 Property Schema Editor

```
PROPERTY SCHEMA EDITOR (Edit property → появляется при click на имя поля)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEADER
├── Property icon (кликабельно → сменить иконку)
├── Property name input
└── ← Back / × Close

TYPE SELECTOR
└── Dropdown/list всех типов (22 типа)
    ├── Basic: Text, Number, Select, Multi-select, Status,
    │         Date, Person, Files, Checkbox, URL, Email, Phone
    ├── Advanced: Formula, Relation, Rollup
    ├── Auto: Created time, Last edited time,
    │         Created by, Last edited by, ID
    └── Changing type → подтверждение (данные могут быть потеряны)

TYPE-SPECIFIC CONFIG

Number:
  └── Format selector (35+ форматов — см. §6.2)

Select / Multi-select:
  ├── Option list:
  │   ├── Color badge + name (drag to reorder)
  │   ├── Click color → color picker (10 цветов)
  │   ├── Click name → inline rename
  │   └── × Delete option
  └── + Add an option

Status:
  ├── Groups (3 фиксированных: To-do / In progress / Complete)
  └── Options в каждой группе (drag между группами)

Relation:
  ├── "Connect to" — выбрать целевую БД (поиск)
  ├── Show on [target DB] (toggle для dual property)
  └── Property name in target DB (если dual)

Rollup:
  ├── Relation: выбрать relation-поле (dropdown)
  ├── Property: выбрать поле в target DB
  └── Calculate: выбрать функцию (24 функции — см. §6.2)

Formula:
  └── → открывает Formula Editor (см. §13.2)

ADVANCED OPTIONS (внизу для некоторых типов)
├── Description (подсказка под именем поля)
└── Hide when empty (toggle)
```

---

# §14. CONTEXT MENUS

## 14.1 Page Tree Context Menu

```
Sidebar страница → ⋯ или right-click:
├── Open
├── Open in new tab
├── Open in new window
├── Open in side peek
├── ---
├── Add to Favorites / Remove from Favorites
├── Add to Teamspace
├── Duplicate
├── Copy link
├── Rename (F2)
├── Move to...
│   └── Search/tree для выбора нового родителя
├── ---
├── Turn into wiki
├── Export
├── Import into
├── ---
├── Add to Automations
├── Customize page
└── Delete
    └── Moves to Trash (не сразу удаляет)
```

## 14.2 Database Record Context Menu

```
Record row → right-click:
├── Open
├── Open in new tab
├── Open in side peek
├── Open in full page
├── ---
├── Copy link to record
├── Add comment
├── ---
├── Rename (переименовать title)
├── Insert above / Insert below
├── Duplicate
├── Move to...
├── ---
├── Export as (Markdown, PDF, HTML)
├── Add to...
│   └── другой database
├── ---
└── Delete (в Trash)
```

## 14.3 Block Context Menu

```
Block → ⋮⋮ (drag handle):
├── Delete
├── Duplicate
├── Copy link to block
├── Move to
├── ---
├── Turn into: [все типы блоков]
├── Color: [10 текст + 10 фон]
└── Comment
```

## 14.4 View Tab Context Menu

```
View tab → ⋯ или right-click:
├── Edit view
│   └── Открывает View Settings panel:
│       ├── View name (rename)
│       ├── Layout section (view-specific settings)
│       ├── Group by section
│       ├── Filter section
│       └── Sort section
├── Rename view
├── Duplicate view
├── Copy link to view
├── ---
├── Lock / Unlock
└── Delete view
```

## 14.5 Database Property Header Context Menu

```
Column header → right-click:
├── Filter by [property name]
├── Sort ascending / Sort descending
├── ---
├── Wrap column / Unwrap column
├── Freeze up to this column / Unfreeze
├── Insert left / Insert right (добавить новое поле рядом)
├── Duplicate property
├── Rename
├── Edit property → Property Schema Editor
├── Hide in view
└── Delete property
    └── "Are you sure?" confirm (если есть значения)
```

---

# §15. MODAL DIALOGS

## 15.1 Quick Find / Search

```
QUICK FIND (⌘K / Ctrl+K)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Search input (autofocus)
├── Recent pages (без ввода)
├── Result types: Pages | Databases | Teams | Members
└── Results:
    ├── Page icon + Title + Parent path
    ├── Keyboard arrows для навигации
    └── Enter → открыть | ⌘Enter → новая вкладка

ACTIONS (вводить команды):
/command syntax:
├── /new page
├── /import
├── /settings
└── /template
```

## 15.2 Share & Publish Dialog

```
SHARE POPUP
├── Invite section:
│   ├── Email/Name input
│   ├── Permission level selector
│   └── Invite button
│
├── Current access list:
│   ├── Member avatar + name + email
│   ├── Permission level dropdown (per-member)
│   └── × Remove
│
├── Publish to web section:
│   ├── Publish toggle
│   ├── URL display (notion.site/...)
│   ├── Copy link button
│   ├── Allow duplicate (copy by viewers) toggle
│   ├── Allow comments toggle
│   └── SEO settings (title, description)
│
└── Copy internal link button
```

## 15.3 Template Gallery

```
TEMPLATE GALLERY (Sidebar Templates / /template command)
├── Search input
├── Category tabs (By Notion, By Community, By Team)
├── Template cards:
│   ├── Preview image
│   ├── Title + Description
│   ├── Author (Notion / community member)
│   └── Use template / Preview кнопки
└── Preview mode:
    ├── Full page preview
    ├── "Use template" → дублирует в workspace
    └── "Duplicate to teamspace"
```

## 15.4 Move To Dialog

```
MOVE TO
├── Search input (по всем страницам)
├── Recent locations
├── Tree navigator:
│   ├── Workspace root
│   └── Page tree с expand/collapse
└── Move here кнопка
```

## 15.5 Import Dialog

```
IMPORT
├── Upload file:
│   ├── Drag & drop area
│   └── Browse files
├── Import from:
│   ├── Markdown (.md) + media (.zip)
│   ├── CSV
│   ├── HTML
│   ├── Evernote (.enex)
│   ├── Trello (.json)
│   ├── Asana (через OAuth)
│   ├── Confluence (через OAuth)
│   ├── Jira (через OAuth)
│   └── Monday (через OAuth)
└── Import options (зависят от типа)
```

## 15.6 Export Dialog

```
EXPORT
├── Format:
│   ├── Markdown & CSV
│   │   └── Include subpages toggle
│   ├── PDF
│   │   ├── Include subpages toggle
│   │   └── Scale (%): 75 / 100 / 125 / 150
│   └── HTML
│       └── Include subpages toggle
├── "Create pages for subpages" toggle (Markdown)
└── Export button
```

---

# §16. KEYBOARD SHORTCUTS

## 16.1 Editor Shortcuts

```
TEXT FORMATTING
Ctrl/⌘ + B        → Bold
Ctrl/⌘ + I        → Italic
Ctrl/⌘ + U        → Underline
Ctrl/⌘ + ⇧ + S    → Strikethrough
Ctrl/⌘ + E        → Inline code
Ctrl/⌘ + K        → Add/edit link

BLOCK CREATION (в начале строки)
##[space]          → Heading 1
###[space]         → Heading 2
####[space]        → Heading 3
-[space]           → Bullet list
1.[space]          → Numbered list
>[space]           → Quote
"[space]           → Quote (alt)
---                → Divider
[space]            → Checkbox (to-do)
>[space]           → Toggle
```[space]          → Code block

NAVIGATION
⌘K / Ctrl+K       → Quick Find
⌘\               → Toggle sidebar
⌘⇧L              → Toggle Dark Mode
⌘⇧F              → Find in page
⌘[               → Go back
⌘]               → Go forward
⌘⇧\             → Focus sidebar
Esc              → Деселект / закрыть popup

BLOCKS
⌘+Enter          → Open record (в database)
⌘D               → Duplicate block
⌘⇧M             → Comment
⌘/               → Slash command (альтернативный trigger)
Tab              → Indent (вложить в предыдущий блок)
⇧Tab             → Unindent
Alt+Drag         → Duplicate block при перетаскивании
⌘Drag            → Move block cross-page

DATABASE SPECIFIC
⌘⇧F              → Search в database
Esc              → Закрыть peek/popup
Enter            → Open selected record
F2               → Rename focused item

EDITING
⌘Z               → Undo
⌘⇧Z             → Redo
⌘A               → Select all (в поле редактирования)
⌘C / X / V       → Copy / Cut / Paste
⌘⇧V             → Paste and match style
⌘Enter           → Toggle checkbox / Confirm action

WINDOWS / TABS
⌘T               → New tab
⌘W               → Close tab
⌘⇧T             → Reopen closed tab
⌘Click           → Open in new tab
⌘⇧Click         → Open in side peek
```

---

# §17. DRAG & DROP INTERACTIONS

## 17.1 Block DnD

```
BLOCK DRAG & DROP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trigger: ⋮⋮ drag handle (hover margin)

Drop targets:
├── Between blocks (horizontal blue line indicator)
├── Inside toggle block (indent indicator)
├── Column blocks (vertical blue line)
├── New column (drag to edge → creates 2-column layout)
└── Cross-page (drag to sidebar → move to another page)

Indicators:
├── Blue horizontal line = insert between blocks
├── Blue vertical line = new column
├── Blue rect inside toggle = nest inside
└── Opacity 50% = block being dragged

COLUMN CREATION via DnD:
1. Drag block
2. Move toward left/right edge of another block
3. Blue vertical line appears → release → creates column_list
```

## 17.2 Database DnD

```
DATABASE DRAG & DROP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE VIEW
├── Column header drag → reorder columns
│   └── Blue vertical line indicator
├── Row drag → reorder records (только при отсутствии сортировки)
│   └── ⋮⋮ handle в начале строки

BOARD VIEW
├── Card drag → перемещение между колонками (меняет property value)
│   └── Ghost card при drag
├── Card drag up/down → manual sort внутри колонки
└── Column drag → reorder columns (меняет options order)

GALLERY VIEW
└── Card drag → reorder (только при no sort)

TIMELINE VIEW
├── Bar drag left/right → изменение start date
├── Bar right-edge drag → изменение end date
└── Bar middle drag → move (изменение обоих дат сохраняя длину)

SIDEBAR DRAG
├── Page drag → reorder в дереве
├── Page drag to another page → move as subpage
└── Page drag to top level → move to workspace root
```

---

# §18. INLINE UI ELEMENTS

## 18.1 Mention Elements (@)

```
MENTION RENDERING (внутри RichText)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@Person mention:
├── Avatar + Name (подсвечен)
└── Hover: mini profile card
    ├── Full name + email
    ├── "View profile" кнопка
    └── Direct message (если интеграция есть)

@Page mention:
├── Page icon + Title (link style)
└── Hover: page preview card
    ├── First 100 chars контента
    └── "Open" кнопка

@Date mention:
├── 📅 Formatted date (кликабельно → edit)
├── Относительный label: "Today", "Yesterday", "In 3 days"
└── Reminder: 🔔 если установлен

@Database mention:
└── Database icon + name (как page mention)
```

## 18.2 Inline Equation

```
INLINE EQUATION
├── Rendering: LaTeX → MathJax/KaTeX рендеринг
├── Монофонный стиль при hover
└── Click → edit LaTeX inline
```

## 18.3 Page Preview

```
PAGE PREVIEW (hover link или ⌘+hover для Peek)
├── Mini popup:
│   ├── Icon + Title
│   ├── First N lines контента
│   └── Open / Open in side peek buttons
└── Side Peek (⌘+click по ссылке):
    └── Правая панель 50% ширины с полным контентом
```

## 18.4 Progress Bar (в number форматах)

```
BAROMETER / PROGRESS визуализация
├── barometer format: 5 сегментов ●●●○○ (0-1 scale)
├── w_rating format: ⭐⭐⭐☆☆ (0-5 stars)
└── Custom ranges: при клике показывает числовой редактор
```

---

# §19. NOTIFICATION & FEEDBACK UI

## 19.1 Inbox / Notifications

```
INBOX (левая панель → Inbox)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notification types:
├── @mention в комментарии
├── @mention в блоке
├── Новый комментарий на странице где вы участвовали
├── Ответ на ваш комментарий
├── Assigned to you (relation или people property)
├── Reminder (от @date mention с reminder)
└── Automation actions (если настроены)

Notification item:
├── Source page icon + title
├── Author avatar + name
├── Notification text (preview)
├── Time (relative: "2h ago")
├── Mark as read/unread (hover)
├── Archive
└── Click → открывает страницу/комментарий

FILTERS
├── All
├── Unread only
├── Assigned to me
└── By workspace
```

## 19.2 Toast Notifications

```
TOAST MESSAGES (временные, снизу экрана)
├── Success: зелёный ✓ (Page deleted, Copied to clipboard, ...)
├── Error: красный ✗ (Failed to save, No permission, ...)
├── Info: синий ℹ
├── Undo action: "Undo" кнопка (появляется после delete/move)
│   └── Click → откатывает действие
└── Duration: ~3-5 секунд → автоисчезновение
```

## 19.3 Loading States

```
LOADING INDICATORS
├── Page skeleton (серые прямоугольники при загрузке)
├── Database spinner (круговой в центре)
├── Image placeholder
├── Infinite scroll indicator (снизу таблицы при подгрузке)
└── Button spinner (при async actions)
```

---

# §20. SETTINGS & CONFIGURATION UI

## 20.1 Workspace Settings (⌘+,)

```
SETTINGS PANEL (модальный или full-page)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEFT NAV (категории)
├── My Account
│   ├── Profile photo
│   ├── Preferred name
│   ├── Email address
│   ├── Password
│   ├── 2FA
│   └── Active sessions
│
├── My Notifications
│   ├── Email digest settings
│   └── Push notification settings
│
├── My Connections
│   └── Connected apps (Slack, GitHub, ...)
│
├── Language & Region
│   ├── Interface language (20+ языков)
│   └── Start of week (Sunday / Monday)
│
├── Workspace Settings (admin only)
│   ├── Name & icon
│   ├── Domain
│   ├── Export workspace
│   └── Delete workspace
│
├── Members
│   ├── Member list (avatar, name, email, role, joined date)
│   ├── Invite button
│   ├── Roles: Owner / Member / Guest
│   └── Pending invites tab
│
├── Groups / Teams (Business+)
│   ├── Create group
│   └── Group list с members
│
├── Billing
│   ├── Current plan
│   ├── Usage (members, guests, storage)
│   ├── Upgrade/Downgrade
│   └── Billing history
│
├── Security (Business+)
│   ├── SSO (SAML)
│   ├── SCIM provisioning
│   ├── Allowed email domains
│   └── Guest restrictions
│
├── Identity & Provisioning (Enterprise)
│
├── Connections (Integrations)
│   └── OAuth apps list + API keys
│
└── Automations (Pro+)
    └── List всех automation rules в workspace
```

## 20.2 View Settings Panel

```
VIEW SETTINGS PANEL (Edit view)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAYOUT SECTION
├── View name input
├── View icon (emoji picker)
├── Description (optional)
└── Layout-specific options:
    (Table)
    ├── Row height: Short / Medium / Tall / Extra tall
    ├── Wrap all cells toggle
    └── Column options per field
    
    (Board)
    ├── Card size: Small / Medium
    ├── Card preview: None / Cover / First image / Files
    └── Show empty groups toggle
    
    (Gallery)
    ├── Card size: Small / Medium / Large
    └── Fit image: Cover / Contain
    
    (Timeline)
    ├── Date field picker (start)
    ├── End date field picker
    ├── Show table toggle
    └── Granularity selector

GROUP SECTION
├── Group by: [property dropdown]
├── Sub-group by: [property dropdown]
├── Sort groups by: Manual / Value asc/desc
├── Show empty groups toggle
└── Hide/Show specific groups (list)

FILTER SECTION
└── (те же что в Toolbar Filter dropdown)

SORT SECTION
└── (те же что в Toolbar Sort dropdown)

PROPERTIES SECTION (Table/List/Gallery)
└── List всех полей с toggle видимости + drag order
```

## 20.3 Automation Rules UI

```
AUTOMATIONS (Pro+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTOMATION RULE EDITOR
├── Trigger selector:
│   ├── When a page is added to [database]
│   ├── When a page is updated (any property)
│   ├── When [property] is edited
│   ├── When [property] equals [value]
│   └── At [time] every [day/week/month]
│
├── Conditions (optional, AND-logic):
│   └── Property filter conditions (те же что Filter)
│
├── Actions (один или несколько):
│   ├── Edit a property → { property, value/formula }
│   ├── Add a page to [database] → { template? }
│   ├── Send notification → { message, to: user/page }
│   ├── Send Slack message (через интеграцию)
│   ├── Send email (через интеграцию)
│   └── Grant page access → { user, permission_level }
│
├── Test automation (кнопка — запускает вручную)
└── Enable / Disable toggle

AUTOMATION LIST
├── Name + status (On/Off)
├── Trigger summary
├── Last run time
├── ⋯ Edit / Duplicate / Delete
└── Activity log (история запусков)
```

---

# APPENDIX: Быстрый справочник по интерактивным элементам

## A.1 Карта всех точек взаимодействия

```
ВЗАИМОДЕЙСТВИЕ → РЕЗУЛЬТАТ (полная карта)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Click on...                     → What happens
────────────────────────────────────────────────────────────
Sidebar page                    → Open page
Sidebar + icon                  → Open in new tab
Sidebar ⋯                      → Page context menu
Sidebar ▶                      → Expand children
Sidebar + button                → New subpage
Page cover                      → Cover picker popup
Page icon                       → Icon picker popup
Block ⋮⋮                       → Block options menu
Block text (select)             → Format toolbar
/ in empty block                → Slash command menu
@ in editor                     → Mention picker
[[ in editor                    → Page link picker
DB column header                → Sort toggle
DB column header right-click    → Column context menu
DB column edge drag             → Resize column
DB column header drag           → Reorder column
DB row                          → Select row
DB row open arrow               → Open record
DB row right-click              → Record context menu
DB row drag                     → Reorder (if no sort)
DB cell click                   → Edit cell value
DB cell double-click            → Full property editor
DB footer cell                  → Aggregation picker
DB "+ New" button               → Create new record
DB view tab                     → Switch view
DB view tab ⋯                  → View context menu
DB "+ Add view"                 → Add view popup
DB Filter button                → Filter dropdown
DB Sort button                  → Sort dropdown
DB Group button                 → Group dropdown
DB Properties button            → Properties visibility
DB Search 🔍                    → Inline search
Property name in record         → Property rename
Property value in record        → Property editor popup
Relation chip in cell           → Open linked record
Formula field in cell           → (readonly) show formula
Board card                      → Open record
Board card drag                 → Move to column
Board column header drag        → Reorder columns
Board "+ New"                   → Create in that column
Timeline bar drag               → Move date
Timeline bar edge drag          → Resize date range
Gallery card                    → Open record
⌘K                             → Quick Find / Search
Share button                    → Share dialog
⋯ More (page toolbar)          → Page options menu
Settings (sidebar bottom)       → Settings panel
Trash (sidebar bottom)          → Trash view
```

## A.2 Popup / Dropdown иерархия

```
POPUP DEPTH MAP (что открывает что)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Level 0 (постоянный UI): Sidebar, Page editor, Database grid
Level 1 (primary popups):
  ├── Quick Find modal (⌘K)
  ├── Share dialog
  ├── Settings panel
  ├── Slash command menu
  ├── @ mention picker
  ├── Block options dropdown
  ├── View settings panel
  ├── Filter/Sort/Group dropdowns
  ├── Property editor popup
  └── Record detail (peek/modal)
Level 2 (secondary, внутри Level 1):
  ├── Color picker (внутри block options)
  ├── Type selector (внутри property editor)
  ├── Calendar (внутри date property editor)
  ├── User picker (внутри people/relation editor)
  ├── Formula editor (внутри formula property)
  ├── Select option creator (внутри select editor)
  └── Move to navigator (внутри context menus)
Level 3 (tertiary):
  ├── Icon picker (внутри page header)
  ├── Cover picker (внутри page header)
  └── Emoji search (внутри icon picker)
```

---

*Конец документа. Версия 1.0.0 от 2026-04-28.*  
*Охват: ~350 объектов, элементов и точек взаимодействия.*

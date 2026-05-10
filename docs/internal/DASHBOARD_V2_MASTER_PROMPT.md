# DASHBOARD V2 — MASTER PROMPT & DESIGN CONCEPT
**Дата:** 2026-05-07  
**Статус:** Research → Master Prompt (merged)  
**Источники:** Research session 2026-05-07 + Design Concept Notion Aesthetic (2026-05-05)  
**Контекст:** obs-projects-plus (OPP) — Obsidian plugin, local-first, Markdown-based

---

## NORTH STAR

> Плагин должен ощущаться как **живое продолжение Notion внутри Obsidian**:  
> спокойный, content-first, дизайн отступает перед данными.  
> Мы меняем визуальный шум на осознанный минимализм. Логика, одетая в сдержанность.

Dashboard V2 — это холст, где главным инструментом является **вызов базы данных**. Пользователь размещает блоки-запросы к данным, внутри которых живут виды, графики, формулы и связи. Всё управляется визуально, без кода, без YAML вручную.

---

## ЧАСТЬ 1: АНАЛИТИЧЕСКАЯ КАРТА NOTION UI/UX

### 1.1 Архитектурные принципы Notion

```
NOTION PIPELINE:
  Данные (Страницы + Свойства)
    → Обработка (фильтры, сортировки, группировки, вычисления)
      → Представление (Table/Board/Calendar/Gallery/Timeline/List)
        → Интерактивность (CRUD, drag, inline edit)
          → Синхронизация (все виды обновляются автоматически)
```

**Ключевой архитектурный принцип Notion:**
> ОДНА БАЗА ДАННЫХ → БЕСКОНЕЧНОЕ КОЛИЧЕСТВО ВИДОВ

Каждый вид = независимые настройки поверх одного источника данных:
- Собственные фильтры
- Собственная сортировка
- Собственная группировка
- Собственная конфигурация полей

### 1.2 Анатомия базы данных Notion

| Слой | Что это | В OPP аналог |
|------|---------|--------------|
| **Pages (Строки)** | Markdown-файлы с frontmatter | `DataRecord` → `.md` файлы |
| **Properties (Колонки)** | Типизированные поля frontmatter | `DataField` + `DataFieldType` |
| **Schema (Схема)** | Конфигурация всех полей базы | `ProjectDefinition.fieldConfig` |
| **Views (Виды)** | Проекции одного источника | `ViewDefinition[]` |
| **View Settings** | Фильтры/сортировки на вид | `ViewDefinition.filter/sort` |

### 1.3 Типы свойств Notion (полный перечень)

| Тип | Notion UI | OPP Coverage | Gap |
|-----|-----------|--------------|-----|
| Text | Rich, inline format | Partial (plain) | Rich annotations |
| Number | Format, precision | ✅ Full | — |
| Select | Colored chips | ✅ | — |
| Multi-select | Tags | ✅ | — |
| Status | 3 semantic groups | Partial | Semantic groups |
| Date | Range, time | ✅ 4 params | — |
| Relation | Link to DB | Partial (one-way) | Two-way write-back |
| Rollup | Aggregate linked | Partial | Full function set |
| Formula | Computed | ✅ **EXCEEDS Notion** | Visual node editor (NEW) |
| Checkbox | Boolean | ✅ | — |
| URL/Email/Phone | Linkable | ✅ | — |
| Files & Media | Attachments | Partial | Drop/preview UI |
| Created/Edited time | Auto | Missing | NPLAN-A1 |
| Unique ID | Auto-counter | Missing | NPLAN-A2 |

### 1.4 Анатомия нового Dashboard-интерфейса (из концептов)

**[1] TOOLBAR:**
```
[Workspace sidebar] | [Название базы] | [Фильтр▼] [Сортировка▼] [Группировка▼] [Скрыть▼] [Настроить поля▼] | [🔍] | [✚ Создать]
```

**[2] НАСТРОЙКА ПОЛЕЙ (Column Editor Panel):**
```
Левая панель: список всех доступных полей (drag-sortable)
Правая панель (при выборе поля):
  - Ширина [slider] Выравнивание [L|C|R buttons]
  - Агрегация [visual pill buttons: Avg / Sum / Count / ...]
  - Показать в базе [toggle]  Показать в карточке [toggle]
  - Условное форматирование [rule builder]
  - [Удалить поле 🗑]
```

**[3] ВИДЫ:** `[⊞ Таблица] [⬜ Канбан] [📅 Календарь] [📊 Диаграмма] [▦ Галерея] [☰ Список] [+]`

**[4] СВЯЗИ (Relation):**
```
Связь с базой: [Projects ▼]  Отображение: [Название ▼]
Показывать превью связанной страницы [toggle]
[Превью: Website Redesign — ACME Corp, 2024-06-30, $60 000]
```

**[5] СВЁРТКИ (Rollup):**
```
Связь: [Tasks ▼]  Поле: [Progress ▼]  Функция: [Average ▼]
Формат: [Percent ▼] [0.0]  Отображение: [Progress bar toggle]
Превью: Website Redesign: 53%
```

**[6] ФОРМУЛЫ:**
```
Формула: [текстовый ввод + autocomplete] ⇄ [Node mode 🔀]
Тип результата: [Number ▼]  Формат: [0.0]
[Превью результата — live, debounce 300ms]
```

**[7] ГЛОБАЛЬНЫЕ АГРЕГАЦИИ (Footer):** Count / Sum / Average / Min / Max / Median / Percent / Unique

**[8] ФИЛЬТРЫ:**
```
Where [Поле▼] [Оператор▼] [Значение]  ✕
  AND [Поле▼] [Оператор▼] [Значение]  ✕
  [+ Добавить условие]  [+ Добавить группу]
[Сохранить фильтр как...]
```

**[9] КАРТОЧКА ЗАПИСИ:**
```
[Emoji] Заголовок (inline edit)
Статус [chip]  Приоритет [chip]  Проект [relation link]
Исполнитель / Срок / Прогресс / Бюджет ...
[Markdown description block]
[Drag-drop file zone]
[Отмена]  [Создать / Сохранить]
```

**[10] НАСТРОЙКА ДАШБОРДА:**
```
Добавить блок:
  [Таблица данных]  [Канбан]      [Календарь]
  [Диаграмма]       [График]      [Связанные страницы]
  [Текст/Markdown]  [Разделитель]
```

**[11] ЭКСПОРТ:** Markdown(таблица) · CSV · Excel(.xlsx) · JSON · PDF

**[12] ГОРЯЧИЕ КЛАВИШИ:**
```
N → Новая запись     F → Поиск
Ctrl+Enter → Быстрые команды
Ctrl+S → Сохранить   Ctrl+Shift+K → Открыть в новой вкладке
```

---

## ЧАСТЬ 2: КАРТА АРХИТЕКТУРНЫХ ВЫЗОВОВ

### 2.1 Матрица вызовов (Challenge Map)

| # | Вызов | Категория | Сложность | OPP сейчас | Gap |
|---|-------|-----------|-----------|------------|-----|
| **C1** | Canvas с drag-resize (free placement) | UI/Layout | HIGH | 12-col grid в DashboardCanvas | Нет истинного free-canvas |
| **C2** | Visual Node Formula Builder | UX/Feature | CRITICAL | Text-only FormulaEditor | Граф нодов (AST визуализация) |
| **C3** | Per-widget database call (source switching) | Data | HIGH | Source tied to ProjectDefinition | View-level source override |
| **C4** | Inline settings panels (not modals) | UX | MEDIUM | Большинство настроек — modals | Slide-in panels |
| **C5** | Formula result live preview | UX | MEDIUM | Нет | Real-time eval (debounce 300ms) |
| **C6** | Relation popover (search + select) | UX | MEDIUM | Modal-based | Inline searchable popover |
| **C7** | Column settings as side panel | UX | LOW | Отсутствует | FieldSettingsPanel slide-in |
| **C8** | Dashboard block types expansion | Feature | MEDIUM | 8 типов | +Text/Markdown, +Divider, +RelationBlock |
| **C9** | Export (CSV/Excel/JSON/PDF) | Feature | MEDIUM | Только Markdown | Multi-format export pipeline |
| **C10** | Global keyboard shortcuts | UX | LOW | Частично | Полный shortcuts layer |
| **C11** | Status semantic groups overlay | Feature | LOW | NPLAN-C1 scheduled | Visual group editor в Board |
| **C12** | Timeline (Gantt) view | View | MEDIUM | NPLAN-B2 scheduled | Отсутствует |
| **C13** | Card/Page view (record detail) | UX | MEDIUM | Inspector modal | Full-page card view |
| **C14** | Two-way relations write-back | Data | HIGH | NPLAN-C2 scheduled | Только чтение обратного |
| **C15** | Auto-generated fields (created_time) | Data | LOW | NPLAN-A1 scheduled | Отсутствует |
| **C16** | Visual filter builder | UX | LOW | FiltersTab неплох | Незначительные улучшения |
| **C17** | Database Properties sidebar | UX | MEDIUM | Отсутствует | Notion-style properties pane |
| **C18** | Aggregation footer (all views) | Feature | LOW | DataTable only | Расширить на все виды |
| **C19** | Hide/show fields quick toggle | UX | LOW | Через настройки | Visual field toggle panel |
| **C20** | Node-based formula constructor | UX/Feature | CRITICAL | Отсутствует | Ключевое требование vision |

### 2.2 Приоритизация

**TIER 1 — Core Canvas Experience (MVP):**
C1 · C2/C20 · C3 · C4 · C13

**TIER 2 — Feature Completeness:**
C8 · C9 · C14 · C17 · C5

**TIER 3 — Polish:**
C10 · C11 · C16 · C18/C19

### 2.3 Архитектурные конфликты с текущим кодом

```
КОНФЛИКТ 1: Source tied to Project
  Текущее: DataSource определяется в ProjectDefinition
  Нужно:   Widget-блок имеет собственный DataSource/SubBase
  Решение: WidgetDataContext = per-widget DataSource + SubBaseDefinition

КОНФЛИКТ 2: Modal-first UX
  Текущее: Настройки в Obsidian Modal
  Нужно:   Slide-in panels, inline popovers, non-blocking editors
  Решение: Refactor settings UI → Svelte overlay components (no Modal)

КОНФЛИКТ 3: Formula as text only
  Текущее: FormulaEditor = textarea + autocomplete
  Нужно:   Node graph + text toggle (два режима)
  Решение: FormulaNodeBuilder.svelte поверх существующего AST

КОНФЛИКТ 4: Dashboard canvas = stack/grid
  Текущее: DashboardCanvas.svelte — vertical stack или 12-col grid
  Нужно:   Free-placement с snap-to-grid и resize handles
  Решение: Заменить layout engine, svelte-dnd-action + CSS grid snap

КОНФЛИКТ 5: Widget data = same project source
  Текущее: Все виджеты читают один DataFrame проекта
  Нужно:   Виджет = независимый запрос с собственным source + filters
  Решение: WidgetDataContext per-widget
```

---

## ЧАСТЬ 3: ФУНКЦИОНАЛЬНОЕ СРАВНЕНИЕ

### 3.1 OPP vs Notion vs Пользовательский Vision

| Функция | Notion | OPP Сейчас | User Vision (New) | Delta |
|---------|--------|-----------|-------------------|-------|
| Canvas (free placement) | ✅ | ✅ Grid/stack | **Canvas + snap-grid** | Upgrade layout engine |
| Database as primary widget | ✅ Embedded | ✅ Dashboard | **"Database call" per block** | Widget = DB query |
| Node formula editor | ❌ | ❌ | **✅ Node graph** | Build new |
| Charts inside DB block | 🟡 | ✅ Separate | **Charts as DB sub-view** | Reorganize UI hierarchy |
| Visual-friendly settings | ✅ Excellent | 🟡 | **All settings visual** | Refactor settings panels |
| Relation popover | ✅ Inline | 🟡 Modal | **Inline popover** | Redesign relation UI |
| Multi-view per database | ✅ Core | ✅ Per project | **Per canvas block** | Enhance SubBase |
| Rollup visualization | 🟡 Text | 🟡 Text | **Visual bars/mini-charts** | Rollup → mini-chart |
| Local-first | ❌ Cloud | **✅ Core value** | **✅ KEEP** | Preserve |
| Export multi-format | 🟡 CSV | ❌ MD only | **MD/CSV/Excel/JSON** | Build export |

### 3.2 Конкурентные преимущества OPP (сохранить обязательно)

1. Formula engine — 115+ функций, включая финансовые (PMT/IRR/NPV)
2. Cross-project relations со scope + cross-base joins
3. UNNEST/PIVOT/UNPIVOT в transform pipeline
4. Calendar — бесконечный скролл, Agenda 2.0 (42 операторa)
5. Conditional formatting в Table
6. Fully local-first — всё в `.md` файлах
7. Custom data sources — folder, tag, dataview query
8. Sub-base canvas — matryoshka tabs

---

## ЧАСТЬ 4: DESIGN GUIDELINES — АДАПТИРОВАННЫЙ ГАЙДЛАЙН

| # | Guideline | Ключевой принцип |
|---|-----------|-----------------|
| **DG-0** | Философия | Colour silence · Content first · Hidden interactivity |
| **DG-1** | Canvas First | Snap-to-8px grid · drag-handle `⠿` · `+` affordance · locked/collapsed |
| **DG-2** | Database Call as Primary Primitive | Каждый блок = независимый DB-запрос · Charts/Stats — sub-view, не отдельные блоки |
| **DG-3** | Visual-Friendly Settings (Zero-Code) | Slide-in panels · live preview · drag-to-reorder · inline edit везде |
| **DG-4** | Node Formula Builder | SVG граф · AST↔Graph serializer · текст/нод toggle · mini-map |
| **DG-5** | Multi-View Inside Database Block | View tabs per block · per-tab settings · общая schema |
| **DG-6** | Relation & Rollup Visual Blocks | Searchable popover · progress bar rollup · pastel chips · checkbox без bounce |
| **DG-7** | Design Tokens & Visual Language | CSS custom-properties · Lucide only · pastel palette · 4px base unit |
| **DG-8** | Interaction Patterns | Мягкий hover · fade-in 150ms · skeleton loader · error boundary |
| **DG-9** | Performance Constraints | Virtual scroll >200 rows · debounce 300/150ms · RAF edges · lazy canvas |
| **DG-10** | Invariants | 12 правил, которые нельзя нарушать |

---

### DG-0: ФИЛОСОФИЯ (из Design Concept)

**Три принципа, которые никогда не нарушаются:**

1. **Colour silence.** Нейтральный спектр. Фон: чистый белый или глубокий "ночной" серый. Никаких жёстких чёрных разделителей. Границы ячеек/блоков едва заметны (`#EDEDED` или `rgba` transparent).

2. **Content first.** Дизайн вторичен. Он почти невидим. Текст должен дышать. Щедрый внутренний отступ внутри ячеек. Контент не должен ощущаться сжатым границами базы данных.

3. **Hidden interactivity.** Управляющие элементы появляются только при взаимодействии. Drag-handle, кнопка `+`, resize handle — видны только при hover. Keyboard-reachable всегда.

---

### DG-1: CANVAS FIRST

Канвас — главная метафора. Не список, не грид — **канвас с привязкой к сетке**.

**Правила:**
- Блоки свободно перемещаются drag-and-drop
- Snap-to-grid: 8px базовая единица, 12-колонный мета-грид
- **Drag-handle.** Шесть точек (`⠿`) слева от каждого блока/строки — только при hover. Ощущение физического контроля.
- **Кнопка `+`.** Появляется только при наведении на пустое пространство канваса. Мягкий fade-in глифа. При hover над пустой зоной — добавить sub-database или text block.
- Каждый блок: resize handle (SE угол), header с title + controls
- Collapsed блок = только title bar (32px высота)
- `locked` режим — блок не перемещается случайно

```typescript
type WidgetLayout = {
  x: number; y: number;    // grid position (12-col)
  w: number; h: number;    // grid units
  minW?: number; minH?: number;
  locked?: boolean;
  zIndex?: number;
};
```

**Группировка.** Заголовки групп в Kanban/List — лаконичны. Toggle-стрелка слева сворачивает целый слой.

---

### DG-2: DATABASE CALL AS PRIMARY PRIMITIVE

Каждый блок на канвасе = **вызов базы данных** — настраиваемый запрос к данным.

**Правила:**
- Блок-тип `database-call` — базовый примитив
- Пользователь выбирает: источник данных, sub-filters, поля, вид отображения
- Charts, Stats, Rollups — **режимы отображения** внутри database-call (не отдельные блоки)
- Источник данных независим от родительского проекта (cross-project поддерживается)

```
CanvasBlock (database-call)
  ├── DataSource Config (source, path/query, filters)
  ├── View Mode (table | board | chart | list | gallery | stats)
  ├── View Settings (per-mode: columns, groupBy, chartType...)
  ├── Field Config (per-field: visible, width, aggregation, format)
  └── Formula Columns (computed fields — node or text mode)
```

**Не допускается:**
- Жёсткая привязка блока к единственному источнику данных
- Невозможность переключить вид без пересоздания блока

---

### DG-3: VISUAL-FRIENDLY SETTINGS (ZERO-CODE)

Все настройки — визуальные. Ни одна не требует кода или YAML вручную.

**Правила:**
- Каждый control: dropdown, toggle, slider, color picker, drag-sortable list
- Settings panel — **slide-in из правого края**, не modal overlay
- Live preview: формулы, условное форматирование, агрегации
- Inline edit: клик по заголовку колонки → editor появляется (как в Notion)
- Drag-to-reorder везде: поля, условия фильтра, колонки, правила
- Контекстное меню (правая кнопка / три точки) для быстрых действий

**Компоненты settings панели:**
```
FieldSettingsPanel.svelte
  ├── FieldNameInput (inline edit)
  ├── FieldTypeSelector (visual icon grid, не dropdown)
  ├── DisplayOptions (width slider, alignment pill buttons)
  ├── AggregationSelector (visual pill buttons)
  ├── ConditionalFormatBuilder (visual rule list, drag-sortable)
  └── FormulaEditor (text + node mode toggle)

FilterPanel.svelte
  ├── ConditionRow (field selector → operator → value)
  ├── ConjunctionToggle (AND/OR pill)
  ├── AddConditionButton / AddGroupButton
  └── SavedFiltersDropdown

SortPanel.svelte   (drag-sortable list of criteria)
GroupPanel.svelte  (field selector + dateGrouping options)
```

---

### DG-4: NODE FORMULA BUILDER

Конструктор формул в визуальном нодовом формате — **ключевое требование**.

**Два режима (toggle без потери данных):**
- **Node Mode** — граф: ноды = функции/значения, рёбра = поток данных
- **Text Mode** — textarea с autocomplete (существующий FormulaEditor)

**Типы нодов:**
```
INPUT NODES (левая колонка):
  [PropertyNode]   — prop("fieldName")
  [LiteralNode]    — "text", 42, true, 2024-01-01
  [DateNode]       — now(), today()

FUNCTION NODES (центр):
  [MathNode]       — SUM, AVG, ROUND, ABS, MOD...
  [TextNode]       — CONCAT, LEN, UPPER, TRIM, SPLIT...
  [LogicNode]      — IF, AND, OR, NOT, SWITCH...
  [DateFnNode]     — DATEADD, DATEDIFF, YEAR, MONTH...
  [ArrayNode]      — FILTER, MAP, ARRAYLEN, CONTAINS...

OUTPUT NODE (правая колонка):
  [ResultNode]     — тип результата + формат отображения
```

**Взаимодействие:**
- Drag from output port → input port = соединить
- Double-click node = параметры
- Right-click = удалить / добавить комментарий
- Wheel + drag = zoom/pan canvas
- "Auto-layout" кнопка для выравнивания

**Техническая реализация (поверх существующего AST):**
```typescript
// formulaParser.ts уже даёт AST — нужен bidirectional serializer

type FormulaNode = {
  id: string;
  type: 'property' | 'literal' | 'function' | 'output';
  functionName?: string;
  value?: DataValue;
  fieldName?: string;
  position: { x: number; y: number };
};

type FormulaEdge = {
  id: string;
  sourceNodeId: string; sourcePort: string;  // 'output' | 'arg0' | 'arg1'...
  targetNodeId: string; targetPort: string;
};

type FormulaGraph = {
  nodes: FormulaNode[];
  edges: FormulaEdge[];
  outputNodeId: string;
};

// formulaGraphToAST(graph): ASTNode
// astToFormulaGraph(ast): FormulaGraph
```

**Рендер:**
- SVG для рёбер (bezier curves)
- CSS transform для позиций нодов (GPU-accelerated)
- Drag через pointer events (не svelte-dnd-action)
- Mini-map в правом нижнем углу

---

### DG-5: MULTI-VIEW INSIDE DATABASE BLOCK

Внутри каждого database-call блока — переключатель видов.

**View tabs (под заголовком блока):**
```
[⊞ Таблица] [⬜ Канбан] [📅 Календарь] [📊 Диаграмма] [▦ Галерея] [☰ Список]  [+]
```

**Правила:**
- Каждый tab хранит собственные настройки (sort, group, visible fields)
- Общие для всех tabs: источник данных, schema полей
- Tab config сериализуется в `widget.config.viewTabs[]`
- Добавление tab = существующий addViewModal

**Table Settings Sidebar:**
```
ПОЛЯ:  [drag-sortable list]
  ☑ Название     [—]  [Ш 200px]  [⚙]
  ☑ Статус       [—]  [Ш 120px]  [⚙]
  ☑ Прогресс     [—]  [Ш 100px]  [⚙]  ← формула, имеет [⬡] icon
  ☐ Описание     [+]  [Ш 250px]  [⚙]
  [+ Создать поле]

ГРУППИРОВКА:  Поле: [Приоритет ▼]  Порядок: [A→Z ▼]
АГРЕГАЦИЯ:    [✅ Показывать итоги]
              Статус: [Count ▼]  Бюджет: [Sum ▼]  Прогресс: [Avg ▼]
```

---

### DG-6: RELATION & ROLLUP VISUAL BLOCKS

Поля-связи и свёртки — **интерактивные элементы, не сырые ссылки**.

**Relation field (из Design Concept §2):**
```
[🔗 Связанный проект]
┌─────────────────────────────┐
│ 📄 Website Redesign         │  ← кликабельная ссылка
│    Клиент: ACME Corp        │  ← preview поля
│    Дедлайн: 2024-06-30      │
│    Бюджет: $60 000          │
└─────────────────────────────┘
[+ Добавить связь]  →  inline popover с поиском
```

**Relation UX rules:**
- Клик на relation → **searchable popover**, не modal
- Pastel chips — только пастельная палитра, достаточный contrast text
- Связь — интерактивный элемент с hover state и кликабельным preview

**Rollup field display:**
```
Прогресс задач: [████░░░░] 53%   ← progress bar + число
Сумма расходов: $28 600           ← число с форматом
Статусы: В работе ×3 · Готово ×2  ← chips
```

**Rollup visual config:**
```
Связь:    [Tasks (через "задачи") ▼]
Поле:     [Progress ▼]
Функция:  [Average ▼]
Формат:   [Percent ▼] [0.0]
Отображение: [Progress bar toggle]
Превью:   Website Redesign: 53%
```

**Checkbox (из Design Concept §2):**
- Маленький, мягко скруглённый квадрат
- Спокойная заливка при активации, без bounce-анимации

---

### DG-7: DESIGN TOKENS & VISUAL LANGUAGE

**Colour palette (CSS custom properties, из Design Concept §1):**
```css
/* Canvas & blocks */
--db-canvas-bg:         var(--background-primary);
--db-block-bg:          var(--background-secondary);
--db-block-border:      rgba(0,0,0,0.07);   /* едва заметная граница */
--db-block-shadow:      0 2px 8px rgba(0,0,0,0.08);

/* Status (pastel only — Design Concept §2) */
--db-status-todo:       hsl(220, 15%, 65%);
--db-status-inprogress: hsl(210, 80%, 60%);
--db-status-done:       hsl(140, 60%, 50%);
--db-status-blocked:    hsl(0, 70%, 60%);

/* Priority (pastel) */
--db-priority-low:      hsl(200, 50%, 60%);
--db-priority-medium:   hsl(40,  80%, 55%);
--db-priority-high:     hsl(20,  85%, 60%);
--db-priority-critical: hsl(0,   80%, 60%);

/* Node editor */
--node-bg:              var(--background-secondary-alt);
--node-border:          rgba(0,0,0,0.10);
--node-port-color:      hsl(210, 80%, 60%);
--node-edge-color:      hsl(210, 60%, 50%);
--node-selected:        hsl(210, 80%, 60%);
```

**Typography (из Design Concept §1):**
- Заголовки блоков: `--font-ui-medium`, 13px, weight 600
- Property labels: чуть меньше body text, серые, с type-иконкой слева
- Данные ячеек: `--font-text`, 13px, weight 400
- Labels/hints: `--font-ui-smaller`, 11px, `--text-muted`
- Formulas/paths: `--font-monospace`, 12px

**Spacing (из Design Concept §1):**
- Base unit: 4px
- Component padding: 8px (inner), 12px (card), 16px (panel)
- Grid gap: 8px
- Section gap: 24px
- Generous internal padding in cells — контент не сжат границами

**Icons:** только Lucide (встроены в Obsidian). Никаких icon-libraries.

**Tags / chips (из Design Concept §2):**
- Только пастельная палитра
- Мягко скруглённые (`border-radius: 4px`)
- Достаточный text contrast на мягком фоне
- Никаких "кричащих" brand colors

---

### DG-8: INTERACTION PATTERNS (из Design Concept §5)

**Hover (из Design Concept §5 — "Bodily feedback"):**
- Row: `--background-modifier-hover` — максимально мягкий. "Я тебя вижу."
- Button: slight lighten + scale(1.02)
- Node (formula editor): border highlight + cursor: grab

**Transitions (из Design Concept §5):**
- Никаких резких появлений. Мягкий fade-in для controls при взаимодействии.
- Drag-handle, `+` button, resize handle — CSS opacity transition (150ms)
- Settings slide-in panel: `transform: translateX` transition (200ms ease-out)
- Никаких bounce/spring анимаций (особенно checkbox)

**Focus/Selection:**
- Selected cell: `--interactive-accent` border 2px
- Selected row: accent background 10% opacity
- Selected block (canvas): dashed border + resize handles visible
- Focus-visible ring — глобальный, никогда не подавляется (invariant из REFACTOR-303)

**Drag feedback:**
- Dragging block: opacity 0.85 + scale(1.01) + shadow increase
- Drop target: dashed outline + subtle background fill
- Invalid drop: red outline flash 200ms

**Loading states:**
- Skeleton loader (shimmer) пока данные загружаются
- Spinner только для async operations >500ms
- Никаких блокирующих loader overlays

**Error states:**
- Inline error (red border + icon) для field-level
- Toast notification (bottom-right, 4s) для view-level
- Error boundary (fallback UI) для widget-level

---

### DG-9: PERFORMANCE CONSTRAINTS

| Сценарий | Правило |
|----------|---------|
| Таблица с >200 строк | Virtual scrolling обязателен (уже есть в DataTable) |
| Canvas блоки вне viewport | Lazy render через Intersection Observer |
| Live preview формул | Debounce 300ms |
| Фильтры при вводе | Debounce 150ms |
| Node graph edges | requestAnimationFrame (не resize observer) |
| Block transitions | CSS only (не JS animations) |
| Формулы/rollups | Только через transform pipeline, не в render |
| Vault >5000 файлов | Cross-project query с lazy loading relations |

---

### DG-10: INVARIANTS (НЕЛЬЗЯ НАРУШАТЬ)

Из `NOTION_PARITY.md §9` + дополнения:

1. **Диспетчеризация по `DataFieldType`** — никогда по `field.name`
2. **Динамические колонки** — производные из уникальных значений, не хардкод
3. **Даты = 4 параметра** (`startDate`, `startTime`, `endDate`, `endTime`)
4. **Derived-поля через единый pipeline** (`applyFormulaFields` → `enrichFrameWithRelations`)
5. **Свободное именование полей** — тип в `fieldConfig`, имя — пользовательское
6. **Markdown first** — все изменения пишутся в `.md` frontmatter, ничего в отдельных БД
7. **Engine layer = pure functions** — без DOM, без Obsidian API, без side effects
8. **Один источник истины на операцию** — filter в `filterEvaluator.ts`, формула в `formulaEngine.ts`
9. **Visual node editor НЕ заменяет text mode** — оба режима обязательны
10. **Settings panels НЕ блокируют canvas** — slide-in, не modal overlay
11. **Focus-visible ring** — глобальный, никогда не подавляется
12. **Pastel chips only** — никаких насыщенных brand-цветов для tags/select/status

---

## ЧАСТЬ 5: КАРТА РЕАЛИЗАЦИИ (TICKET BINDING)

Из Design Concept + Research session:

| Принцип / Guideline | Ticket(s) реализующий |
|--------------------|-----------------------|
| DG-0 Foundation / colour silence | `tokens.css` sweep, NPLAN-D3 (pastel CSS custom-properties) |
| DG-0 Typography / spacing | REFACTOR-404 (px→rem), REFACTOR-302 (StrictGrid) |
| DG-1 Canvas + drag handle | NPLAN-D4 (six-dot row drag), новый `DashboardCanvas` free-placement |
| DG-1 `+` affordance | Новый `DashboardBlockPalette.svelte` |
| DG-2 Database call block | Новый `DatabaseCallBlock.svelte` + `WidgetDataContext` type |
| DG-3 Slide-in settings | Новый `FieldSettingsPanel.svelte` (заменяет modals) |
| DG-3 Relation popover | PARITY-006 (relation popover) |
| DG-4 Node formula builder | Новый `FormulaNodeBuilder.svelte` + `nodeSerializer.ts` |
| DG-5 View tabs per block | Новый `ViewTabBar.svelte` + per-tab settings |
| DG-6 Rollup visualization | Расширить `crossProjectRollup.ts` + mini-chart render |
| DG-6 Checkbox aesthetic | PARITY-001 → checkbox style |
| DG-7 Pastel palette | NPLAN-D3 — `tokens.css` |
| DG-7 Cover + icon | PARITY-011 (cover/icon), NPLAN-D2 — ✅ icon (per-record) + cover-banner widget закрыты |
| DG-8 Hover / transitions | REFACTOR-303 (done, keep invariant), CSS transitions sweep |
| DG-8 Hide empty fields | NPLAN-D6 (hide empty fields toggle) |
| DG-9 Virtual scroll | Уже есть (`virtualScroll.ts`), распространить |
| DG-10 Bulk select | NPLAN-D5 (bulk row select) |

---

## ЧАСТЬ 6: ACCEPTANCE CRITERIA

### Canvas (DG-1)
- [ ] Блоки drag-resizable на канвасе (snap-to-8px)
- [ ] Drag-handle (`⠿`) видим только при hover, keyboard-reachable
- [ ] `+` affordance — fade-in при hover на пустое пространство
- [ ] Collapsed block = только title bar (32px)
- [ ] Locked block — не перемещается при случайном drag

### Database Call Block (DG-2)
- [ ] Источник данных независим от родительского проекта
- [ ] Переключение вида (Table/Board/Chart) без потери настроек
- [ ] Slide-in settings panel открывается без modal overlay

### Visual Settings (DG-3)
- [ ] Условное форматирование задаётся через rule builder (без кода)
- [ ] Drag-to-reorder полей в table header и в field list
- [ ] Aggregation footer включается toggle, показывает корректные значения
- [ ] Все hardcoded `px` → `rem` (REFACTOR-404)

### Node Formula Builder (DG-4)
- [ ] Соединение двух нодов → формула вычисляется, показывает preview
- [ ] Toggle text↔node — данные не теряются при переключении
- [ ] Zoom/pan node canvas работает (wheel + drag)
- [ ] 115+ функций доступны через поиск в add-node palette
- [ ] Live preview с debounce 300ms

### Design / Interaction (DG-0, DG-7, DG-8)
- [ ] Pastel palette определена как CSS custom-properties
- [ ] Только мягкий hover (`--background-modifier-hover`) на строках
- [ ] Никаких bounce-анимаций на checkbox и chips
- [ ] Focus-visible ring глобальный, не подавляется
- [ ] Slide-in panel: `transform: translateX` transition 200ms ease-out

---

## ЧАСТЬ 7: ТЕХНИЧЕСКОЕ ЗАДАНИЕ ДЛЯ АГЕНТА

**ШАГ 1: АРХИТЕКТУРА**
1. Расширить `WidgetDefinition.type` в `Dashboard/types.ts` → добавить `'database-call'`
2. Создать `WidgetDataContext`: `{ sourceConfig, subFilter, viewTabs: ViewTabDefinition[] }`
3. Добавить `FormulaGraph` типы в `src/lib/formula/` (`nodeTypes.ts`, `nodeSerializer.ts`)
4. Обновить `DashboardCanvas.svelte` → free-placement layout engine

**ШАГ 2: DATABASE CALL BLOCK**
1. `DatabaseCallBlock.svelte` в `Dashboard/widgets/DatabaseCall/`
2. `DatabaseCallSettings.svelte` — slide-in panel (правый edge)
3. `ViewTabBar.svelte` — view tabs switcher внутри блока
4. Per-tab settings persistence в widget config

**ШАГ 3: NODE FORMULA BUILDER**
1. `FormulaNodeBuilder.svelte` в `ui/components/FormulaEditor/`
2. `NodeCanvas.svelte` — SVG-based edge renderer (bezier curves)
3. `FormulaNode.svelte` — individual node component
4. `nodeSerializer.ts` — AST↔Graph bidirectional converter
5. Toggle между node и text режимом в `FormulaEditor.svelte`

**ШАГ 4: VISUAL SETTINGS PANELS**
1. `FieldSettingsPanel.svelte` — slide-in, заменяет modal
2. `FilterPanelVisual.svelte` — Notion-style filter builder
3. `ColumnManagerPanel.svelte` — drag-sortable field list
4. `ConditionalFormatBuilder.svelte` — visual rule builder

**ШАГ 5: CARD VIEW & EXPORT**
1. `RecordCardView.svelte` — заменяет Inspector modal
2. `ExportService.ts` — CSV, JSON, Markdown table
3. Keyboard shortcuts layer (`CommandManager.ts`)

---

## ЧАСТЬ 8: ЦЕЛЕВАЯ ФАЙЛОВАЯ СТРУКТУРА

```
src/ui/views/Dashboard/
├── DashboardCanvas.svelte          (update: free-placement layout)
├── DashboardBlockPalette.svelte    (NEW: add-block popup)
├── widgets/
│   ├── DatabaseCall/               (NEW: primary widget type)
│   │   ├── DatabaseCallBlock.svelte
│   │   ├── DatabaseCallSettings.svelte
│   │   ├── ViewTabBar.svelte
│   │   └── types.ts
│   ├── DataTable/                  (existing, reused inside DatabaseCall)
│   ├── Chart/                      (existing, reused inside DatabaseCall)
│   └── ...
├── engine/                         (existing, no major changes)
└── types.ts                        (update: add database-call widget type)

src/ui/components/
├── FormulaEditor/
│   ├── FormulaNodeBuilder.svelte   (NEW: node graph editor)
│   ├── NodeCanvas.svelte           (NEW: svg canvas for nodes)
│   ├── FormulaNode.svelte          (NEW: individual node component)
│   ├── FormulaEdge.svelte          (NEW: svg bezier edge)
│   ├── NodePalette.svelte          (NEW: searchable add-node palette)
│   └── FormulaEditor.svelte        (update: add node mode toggle)
├── FieldSettingsPanel/
│   ├── FieldSettingsPanel.svelte   (NEW: slide-in panel)
│   ├── ConditionalFormatBuilder.svelte (NEW: visual rule builder)
│   └── AggregationSelector.svelte  (NEW: pill button selector)
└── RecordCard/
    └── RecordCardView.svelte       (NEW: full record view)

src/lib/formula/
├── nodeSerializer.ts               (NEW: AST ↔ FormulaGraph)
├── nodeTypes.ts                    (NEW: FormulaNode, FormulaEdge types)
└── ... (existing unchanged)
```

---

## OUT OF SCOPE

- Автоматизации (triggers, button field) — Phase E
- Cloud sync / collaboration
- AI/LLM features
- Comments system
- Public sharing
- Mobile-specific gestures (отдельный audit pass)
- Dark/light theme variants beyond Obsidian token mapping
- Animated/illustrated empty states

---

**Версия:** 2.0 (merged) | **Дата:** 2026-05-07  
**Источники:** Research session 2026-05-07 + `DESIGN_CONCEPT_NOTION_AESTHETIC.md` (2026-05-05)  
**Владелец:** project owner

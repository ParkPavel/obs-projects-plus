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
| Node formula editor | ❌ | ✅ Text-only (`FormulaConstructor.svelte`, autocomplete + signature) | ~~Node graph~~ ⛔ CANCELLED (R5-022) | — |
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
| **DG-4** | ~~Node Formula Builder~~ | ⛔ CANCELLED (R5-022) — только text mode (`FormulaConstructor.svelte`) |
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
  └── FormulaEditor (text mode, autocomplete, signature popover — `FormulaConstructor.svelte`)

FilterPanel.svelte
  ├── ConditionRow (field selector → operator → value)
  ├── ConjunctionToggle (AND/OR pill)
  ├── AddConditionButton / AddGroupButton
  └── SavedFiltersDropdown

SortPanel.svelte   (drag-sortable list of criteria)
GroupPanel.svelte  (field selector + dateGrouping options)
```

---

### DG-4: ~~NODE FORMULA BUILDER~~ — ⛔ CANCELLED (R5-022)

Визуальный нодовый редактор формул отменён решением владельца (R5-022, 2026-05-09).

**Причина отмены:** Сложность реализации AST↔Graph сериализатора несоразмерна UX-выигрышу; существующий text-mode с autocomplete и signature popover покрывает 95%+ реальных сценариев.

**Действующая реализация (text-only):**
- `FormulaConstructor.svelte` — textarea + autocomplete dropdown (до 12 подсказок) + signature popover для 115+ функций
- Валидация в реальном времени, Ctrl+Enter для commit
- Используется в `FormulaBar.svelte` и всех config-панелях

**Что НЕ будет реализовано:** SVG-граф нодов, `nodeSerializer.ts`, `nodeTypes.ts`, `FormulaNodeBuilder.svelte`, `NodeCanvas.svelte`, `NodePalette.svelte`. Не возобновлять без явного решения владельца.

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

/* Node editor tokens — зарезервированы, не используются (DG-4 CANCELLED) */
/* --node-bg, --node-border, --node-port-color, --node-edge-color: не добавлять в tokens.css */
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
9. **Formula = text mode only** — `FormulaConstructor.svelte` с autocomplete и signature popover; node editor отменён (R5-022); не добавлять визуальный граф без явного решения владельца
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
| DG-1 Canvas + drag handle | ✅ NPLAN-D4 ✅; `draggable.ts` + `resizable.ts` в WidgetHost; `layoutMode: "free"` в DashboardCanvas |
| DG-1 `+` affordance / collapsed / locked | ⬜ `DashboardBlockPalette.svelte` не создан; collapsed/locked не реализованы — **NPLAN-V7.2** |
| DG-2 Database call block — view tabs | ✅ `DatabaseCallBlock.svelte` + `ViewTabBar.svelte` — multi-view per block работает |
| DG-2 Per-widget data source | ⬜ `DatabaseCallBlock` читает frame от родителя; `DatabaseCallSettings.svelte` отсутствует — **NPLAN-V7.1** |
| DG-3 Slide-in settings | ✅ `FieldSettingsPanel.svelte`, `FilterPanelVisual.svelte`, `ConditionalFormatBuilder.svelte` |
| DG-3 Relation popover | ✅ `RelationPicker.svelte` (searchable, keyboard nav) |
| DG-4 Node formula builder | ⛔ CANCELLED (R5-022) — `FormulaConstructor.svelte` text-only |
| DG-5 View tabs per block | ✅ `ViewTabBar.svelte` (132 lines) + per-tab config в `DatabaseCallBlock` |
| DG-6 Rollup visualization | ✅ progress bars + chips в `GridRollupCell`; 18-функций в `aggregate.ts` (NPLAN-C3 ✅) |
| DG-6 RecordCardView (full card) | ⬜ `RecordCardView.svelte` — MVP wrapper (55 строк) — **NPLAN-V7.3** |
| DG-6 Checkbox aesthetic | ✅ мягкая заливка, без bounce (CSS) |
| DG-7 Pastel palette | ✅ `tokens.css` — полная `--ppp-db-*` палитра |
| DG-7 Cover + icon | ✅ NPLAN-D2 icon (per-record) + `CoverBannerWidget.svelte` |
| DG-8 Hover / transitions | ✅ REFACTOR-303 (keep invariant) |
| DG-8 Hide empty fields | ✅ NPLAN-D6 ✅ |
| DG-9 Virtual scroll | ✅ `virtualScroll.ts` в DataTableWidget |
| DG-10 Bulk select | ✅ NPLAN-D5 ✅ |

---

## ЧАСТЬ 6: ACCEPTANCE CRITERIA

### Canvas (DG-1)
- [x] Блоки drag-resizable на канвасе — `draggable.ts` + `resizable.ts` в WidgetHost ✅
- [x] Drag-handle (`⠿`) видим только при hover, keyboard-reachable ✅
- [ ] `+` affordance — `DashboardBlockPalette.svelte` ⬜ **NPLAN-V7.2**
- [ ] Collapsed block = только title bar (32px) ⬜ **NPLAN-V7.2**
- [ ] Locked block — не перемещается при случайном drag ⬜ **NPLAN-V7.2**

### Database Call Block (DG-2)
- [ ] Источник данных независим от родительского проекта ⬜ **NPLAN-V7.1** — критический архитектурный Gap A
- [x] Переключение вида (Table/Board/Chart) без потери настроек — `ViewTabBar` + per-tab config ✅
- [ ] `DatabaseCallSettings.svelte` slide-in panel для выбора source ⬜ **NPLAN-V7.1**

### Visual Settings (DG-3)
- [x] Условное форматирование задаётся через rule builder — `ConditionalFormatBuilder.svelte` ✅
- [x] Drag-to-reorder полей в table header и в field list ✅
- [x] Aggregation footer включается toggle, показывает корректные значения ✅
- [x] Все hardcoded `px` → `rem` — PX-budget ratchet ≤191, зелёный ✅

### ~~Node Formula Builder (DG-4)~~ — ⛔ CANCELLED (R5-022)

`FormulaConstructor.svelte` — text mode с autocomplete, signature popover, Ctrl+Enter commit.
Node editor не будет реализован. Все чекбоксы удалены.

### Design / Interaction (DG-0, DG-7, DG-8)
- [x] Pastel palette определена как CSS custom-properties — `tokens.css` `--ppp-db-*` ✅
- [x] Только мягкий hover (`--background-modifier-hover`) на строках ✅
- [x] Никаких bounce-анимаций на checkbox и chips ✅
- [x] Focus-visible ring глобальный, не подавляется ✅
- [x] Slide-in panel: `transform: translateX` transition 200ms ease-out — `SlideInPanel.svelte` ✅

---

## ЧАСТЬ 7: ТЕХНИЧЕСКОЕ ЗАДАНИЕ ДЛЯ АГЕНТА (актуально на 2026-05-10)

**Статус исходного плана (Sprints 0–8 закрыты):**

| Шаг исходного плана | Статус |
|---|---|
| ШАГ 1: Архитектура (types, canvas, layout) | ✅ Выполнен — `'database-call'` в WidgetType, `draggable.ts`, `layoutMode: "free"` |
| ШАГ 2: DatabaseCallBlock + ViewTabBar | ✅ Частично — block и tabs работают; per-widget source ⬜ |
| ШАГ 3: Node Formula Builder | ⛔ CANCELLED (R5-022) |
| ШАГ 4: Visual Settings Panels | ✅ Выполнен — FieldSettingsPanel, FilterPanelVisual, ConditionalFormatBuilder |
| ШАГ 5: Card View & Export | ✅ Частично — ExportService ✅, viewShortcuts ✅, RecordCardView MVP (55 строк) |

**Оставшиеся задачи (V7 Sprint):**

**NPLAN-V7.1 — Per-widget Data Source (DG-2, Gap A)** ← приоритет P0
1. Расширить `WidgetDefinition` → добавить `sourceConfig?: WidgetSourceConfig` (source type + path/query + sub-filter)
2. Создать `WidgetSourceConfig` type в `Dashboard/types.ts`
3. `DatabaseCallSettings.svelte` — slide-in panel: source picker (folder/tag/dataview), sub-filter, title
4. `WidgetHost.svelte` — если виджет `database-call` и имеет `sourceConfig`, загружать frame независимо через `DataApi`
5. `DatabaseCallBlock.svelte` — принимать `frame` из WidgetHost (без изменений внутри блока)

**NPLAN-V7.2 — Canvas UX completeness (DG-1, Gap D/E)** ← приоритет P1
1. `DashboardBlockPalette.svelte` — hover-triggered popup над пустыми ячейками канваса; fade-in 150ms; список типов блоков
2. Добавить `locked?: boolean` и `collapsed?: boolean` в `WidgetLayout` type
3. `WidgetHost.svelte` — обработка `locked` (disable drag) и `collapsed` (render только title bar 32px)
4. UI-триггер для toggle locked/collapsed в header виджета (три точки → меню)

**NPLAN-V7.3 — RecordCardView full implementation (DG-6, Gap C)** ← приоритет P2
1. Расширить `RecordCardView.svelte` — emoji/icon picker в заголовке, markdown description block, file attachment zone, relation chips с preview
2. Интеграция со всеми видами (Table, Board, Gallery, Calendar) через единый event

---

## ЧАСТЬ 8: ФАКТИЧЕСКАЯ И ЦЕЛЕВАЯ ФАЙЛОВАЯ СТРУКТУРА (на 2026-05-10)

```
src/ui/views/Dashboard/
├── DashboardCanvas.svelte          ✅ 457 lines — layoutMode free/stack, WidgetGrid, SchemaController
├── DashboardBlockPalette.svelte    ⬜ NPLAN-V7.2 — hover add-block popup
├── WidgetGrid.svelte               ✅ exists — grid layout
├── widgets/
│   ├── DatabaseCall/
│   │   ├── DatabaseCallBlock.svelte  ✅ 176 lines — ViewTabBar + multi-tab DataTable
│   │   └── DatabaseCallSettings.svelte  ⬜ NPLAN-V7.1 — per-widget source slide-in
│   ├── ViewTabBar.svelte             ✅ 132 lines — tab switcher, icons, + button
│   ├── WidgetHost.svelte             ✅ 1039 lines — все 16 типов виджетов, drag/resize
│   ├── DataTable/DataTableWidget.svelte  ✅ 1526 lines
│   ├── Timeline/TimelineWidget.svelte    ✅ 302 lines
│   ├── CoverBanner/                     ✅ CoverBannerWidget + Config
│   ├── SubBaseCanvas/                   ✅ Widget + Config + deriveSubBasePartition
│   ├── Chart, Stats, Comparison,
│   │   Checklist, FilterTabs, SummaryRow,
│   │   DataList, ViewPort, YamlVisualizer,
│   │   TextWidget, DividerWidget         ✅ all exist
│   └── ...
├── engine/                              ✅ no major changes needed
└── types.ts                             ✅ database-call в WidgetType union

src/ui/components/
├── FormulaConstructor/
│   └── FormulaConstructor.svelte        ✅ 329 lines — text mode, autocomplete, signature
├── FormulaEditor/
│   └── FormulaEditor.svelte             ✅ 61 lines — wrapper
│   — FormulaNodeBuilder.svelte          ⛔ CANCELLED (R5-022)
│   — NodeCanvas, FormulaNode, etc.      ⛔ CANCELLED
├── FieldSettingsPanel/
│   └── FieldSettingsPanel.svelte        ✅ 302 lines
├── FilterPanelVisual/
│   └── FilterPanelVisual.svelte         ✅ 299 lines
├── ConditionalFormatBuilder/
│   └── ConditionalFormatBuilder.svelte  ✅ 534 lines
├── SlideInPanel/                        ✅ exists
└── RecordCardView/
    └── RecordCardView.svelte            ⚠️ MVP 55 lines — ⬜ расширить (NPLAN-V7.3)

src/lib/formula/
├── extendedEvaluator.ts                 ✅ 115+ functions
├── formulaParser.ts                     ✅
├── nodeSerializer.ts                    ⛔ CANCELLED (R5-022)
└── nodeTypes.ts                         ⛔ CANCELLED (R5-022)
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

**Версия:** 3.0 (audit + plan correction, 2026-05-10) | **Дата исходника:** 2026-05-07  
**Источники:** Research session 2026-05-07 + `DESIGN_CONCEPT_NOTION_AESTHETIC.md` (2026-05-05) + Audit 2026-05-10  
**Владелец:** project owner

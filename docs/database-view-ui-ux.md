# Database View v3.3.0 — Спецификация UI/UX

> **Статус**: DRAFT v1.0 | **Дата**: 2026-04-12
> **Родительский документ**: `architecture-database-view.md`
> **Область**: Все визуальные элементы, паттерны взаимодействия, gesture choreography

---

## Содержание

- [1. Принципы UI/UX](#1-принципы-uiux)
- [2. Контекстные меню](#2-контекстные-меню)
- [3. Поповеры и настройки](#3-поповеры-и-панели-настроек)
- [4. Кнопки взаимодействия](#4-кнопки-взаимодействия)
- [5. Модальные окна](#5-модальные-окна)
- [6. Виджет — жизненный цикл UI](#6-виджет--жизненный-цикл-ui)
- [7. DataTable — детали интерфейса](#7-datatable--детали-интерфейса)
- [8. FormulaBar — визуальный редактор](#8-formulabar--визуальный-редактор)
- [9. ChartWidget — взаимодействие](#9-chartwidget--взаимодействие)
- [10. Toolbar и навигация](#10-toolbar-и-навигация)
- [11. Feedback и состояния](#11-feedback-и-состояния)
- [12. Gesture Choreography (Touch)](#12-gesture-choreography-touch)
- [13. Keyboard Navigation](#13-keyboard-navigation)
- [14. Accessibility (a11y)](#14-accessibility-a11y)
- [15. Анимации и переходы](#15-анимации-и-переходы)
- [16. Цветовая система](#16-цветовая-система)

---

## 1. Принципы UI/UX

### 1.1 Иерархия внимания

```
Уровень 1 (Главный фокус) — Содержимое виджета (данные таблицы, график)
Уровень 2 (Вторичный)     — Заголовок виджета, aggregation row
Уровень 3 (Третичный)     — Widget toolbar, action buttons
Уровень 4 (На требование) — Context menu, popover, modal
```

Правило: элементы уровня N не должны визуально конкурировать с уровнем N-1. Достигается через:
- Прозрачность фона (widget header: `var(--background-secondary)` vs content: `var(--background-primary)`)
- Размер шрифта (widget title: `--ppp-font-size-sm`, данные: `--ppp-font-size-base`)
- Насыщенность цвета (action buttons: `--text-muted` до hover)

### 1.2 Принцип минимального действия

| Частота действия | Доступ | Пример |
|------------------|--------|--------|
| Постоянное (>10/мин) | Прямой клик, inline | Ввод в ячейку, checkbox toggle |
| Частое (2-10/мин) | Один клик на видимый элемент | Sort, collapse group, resize |
| Периодическое (1-5/час) | Меню или toolbar | Add widget, configure chart |
| Редкое (<1/день) | Modal или settings | Migration, conditional format rules |

### 1.3 Согласованность с Obsidian

Database View наследует стиль Obsidian, не создаёт "инородный" интерфейс:

- **Меню**: нативный `Menu` class Obsidian (не кастомные dropdown)
- **Кнопки**: `obsidian-svelte` компоненты (`Button`, `IconButton`)
- **Модалы**: `ModalLayout` + `ModalContent` + `ModalButtonGroup`
- **Иконки**: Lucide icon set (stacked with Obsidian)
- **Цвета**: CSS custom properties от Obsidian theme (`--interactive-accent`, `--text-normal`, etc.)
- **Шрифты**: `--font-interface` (Obsidian body font)

---

## 2. Контекстные меню

### 2.1 Типология контекстных меню

| Контекст | Триггер (Desktop) | Триггер (Touch) | Элементы |
|----------|-------------------|------------------|----------|
| **Widget Header** | Right-click на заголовок | Long-press (500ms) | Rename, Duplicate, Collapse, Settings, Delete |
| **Table Cell** | Right-click на ячейку | Long-press | Copy value, Edit, Clear, Insert row above/below |
| **Table Column Header** | Right-click на header | Long-press | Sort A-Z/Z-A, Filter, Hide, Pin, Configure, Insert left/right, Delete |
| **Table Row** | Right-click на строку | Long-press | Open note, Edit record, Duplicate, Delete |
| **Chart Element** | Right-click на bar/slice | Long-press | Drill-down (show records), Copy value, Highlight |
| **Aggregation Cell** | Click на [▼] | Tap | Function picker (SUM, AVG, COUNT...) |
| **Canvas (пустое место)** | Right-click | Long-press | Add widget, Paste widget, Reset layout |
| **Formula Block** | Right-click на блок | Long-press | Edit, Wrap in function, Remove, Copy |

### 2.2 Правила построения меню

**Структура:**
```
┌─────────────────────────────┐
│ Основные действия            │ ← Наиболее частые, сверху
│ ─────────────────────────── │ ← Separator
│ Настройка / Конфигурация     │ ← Менее частые
│ ─────────────────────────── │ ← Separator
│ Деструктивные действия       │ ← Красный текст, внизу
└─────────────────────────────┘
```

**Правила:**
1. **Максимум 10 пунктов** — больше → группировка в подменю
2. **Separator между группами** — визуальное разделение по категориям
3. **Деструктивные действия внизу** — Delete, Remove, Clear — с красным цветом
4. **Иконки слева** — каждый пункт имеет Lucide-иконку для быстрого сканирования
5. **Hotkey справа** — если действие имеет keyboard shortcut, показать (dimmed)
6. **Disabled state** — серый текст, не кликабельный (не скрытый), + tooltip с причиной
7. **Contextual title** — меню может иметь заголовок: "Column: Budget" (серый, вверху)

**Пример — Table Column Header Menu:**

```
┌──────────────────────────────────────┐
│ Column: Budget                 (dim) │
│ ──────────────────────────────────── │
│ ↑ Sort ascending             Ctrl+↑ │
│ ↓ Sort descending            Ctrl+↓ │
│ ≡ Group by this field                │
│ ──────────────────────────────────── │
│ ⊕ Insert column left                │
│ ⊕ Insert column right               │
│ ┃ Freeze up to here                 │
│ ◉ Pin column                        │
│ ⊘ Hide column                       │
│ ──────────────────────────────────── │
│ ⚙ Configure field...          →     │
│ 🎨 Conditional formatting...  →     │
│ ──────────────────────────────────── │
│ 🗑 Delete column              (red) │
└──────────────────────────────────────┘
```

### 2.3 Подменю (Submenu)

Submenu открывается при hover/tap на пункт со стрелкой `→`:

```
⚙ Configure field...  →  ┌──────────────────────────┐
                           │ Rename                    │
                           │ Change type  →            │
                           │ Default value              │
                           │ Options (Select/Status)    │
                           └──────────────────────────┘
```

**Правила подменю:**
- Максимум 1 уровень вложенности (нет подменю в подменю)
- Hover delay: 200ms до открытия, 300ms до закрытия
- На touch: tap открывает, назад через ← кнопку в заголовке подменю

### 2.4 Реализация

```typescript
// Все контекстные меню через Obsidian Menu API
function showColumnMenu(event: MouseEvent, field: DataField) {
  const menu = new Menu();

  // Group 1: Sort/Group
  menu.addItem((item) => item
    .setTitle("Sort ascending")
    .setIcon("arrow-up")
    .onClick(() => sortColumn(field, 'asc'))
  );
  // ...

  menu.addSeparator();

  // Group 2: Column operations
  menu.addItem((item) => item
    .setTitle("Insert column left")
    .setIcon("plus-circle")
    .onClick(() => insertField(field, 'before'))
  );
  // ...

  menu.addSeparator();

  // Group 3: Destructive
  menu.addItem((item) => item
    .setTitle("Delete column")
    .setIcon("trash-2")
    .onClick(() => confirmDeleteField(field))
  );

  menu.showAtMouseEvent(event);
}
```

---

## 3. Поповеры и панели настроек

### 3.1 Типология поповеров

| Поповер | Триггер | Положение | Размер | Закрытие |
|---------|---------|-----------|--------|----------|
| **Aggregation Picker** | Click на [▼] в aggregation row | Под ячейкой | Compact (15rem × auto) | Click outside, Esc |
| **Column Config** | "Configure field" из меню | Рядом с колонкой | Medium (20rem × auto) | Click outside, Esc, Save/Cancel |
| **Conditional Format** | "Conditional formatting" из меню | Центр виджета | Large (30rem × auto) | Save/Cancel buttons |
| **Chart Config** | ⚙ кнопка на ChartWidget | Рядом с chart | Large (25rem × auto) | Save/Cancel |
| **Field Type Picker** | "Change type" из submenu | Рядом с menu | Compact (12rem × auto) | Click on option |
| **Color Picker** | Click на цвет option | Рядом с trigger | Compact (15rem × 10rem) | Click outside |
| **Formula Autocomplete** | Ввод в formula bar | Под курсором | Compact (20rem × max 12rem) | Esc, select option |
| **Widget Settings** | ⚙ в header виджета | Рядом с кнопкой | Medium-Large | Save/Cancel |

### 3.2 Расположение и позиционирование

```
Правило "Магнит":
  Поповер привязывается к элементу-триггеру,
  но если он выходит за границы контейнера →
  flip (отразить) или shift (сдвинуть)

                    ┌─────────┐
                    │ Trigger │
                    └────┬────┘
         ┌───────────────▼───────────────┐
         │        Popover Content        │
         │                               │
         │   (arrow указывает на trigger)│
         └───────────────────────────────┘

Если не влезает снизу →
         ┌───────────────────────────────┐
         │        Popover Content        │
         └───────────────▲───────────────┘
                    ┌────┴────┐
                    │ Trigger │
                    └─────────┘
```

**CSS-позиционирование:**

```css
.ppp-popover {
  position: fixed;                               /* Выход за scroll-контейнер */
  z-index: var(--ppp-z-popover);                 /* 50 — выше всех виджетов */
  max-width: min(90cqi, 30rem);                  /* Container-relative ширина */
  max-height: min(80cqi, 25rem);                 /* Не больше 80% контейнера */
  overflow-y: auto;
  border-radius: var(--ppp-radius-md);
  background: var(--background-primary);
  box-shadow: var(--ppp-shadow-lg);
  border: 1px solid var(--background-modifier-border);
}

/* Mobile: full-width sheet снизу */
@media (pointer: coarse) {
  .ppp-popover--sheet {
    position: fixed;
    inset: auto 0 0 0;                           /* Bottom sheet */
    max-width: 100%;
    max-height: 60vh;                             /* Единственное исключение: vh для sheet */
    border-radius: var(--ppp-radius-lg) var(--ppp-radius-lg) 0 0;
    padding-bottom: env(safe-area-inset-bottom);  /* Notch safe */
  }
}
```

### 3.3 Anatomy поповера настроек

```
┌───────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐   │
│ │ Popover Title            (optional) [×] │   │ ← Header (если есть)
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │ Setting Item 1                          │   │
│ │ Label                        [Control]  │   │ ← SettingItem pattern
│ │ Description (dimmed, small)             │   │
│ ├─────────────────────────────────────────┤   │
│ │ Setting Item 2                          │   │
│ │ Label                        [Control]  │   │
│ ├─────────────────────────────────────────┤   │
│ │ ...                                     │   │
│ └─────────────────────────────────────────┘   │
│                                               │
│ ┌─────────────────────────────────────────┐   │
│ │               [Cancel]  [Save]          │   │ ← Footer (если stateful)
│ └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

**Типы контролов внутри SettingItem:**

| Контрол | Использование | Компонент |
|---------|---------------|-----------|
| Toggle | Boolean settings (show grid, show labels) | `<Toggle>` obsidian-svelte |
| Dropdown | enum settings (chart type, aggregation) | `<Select>` obsidian-svelte |
| Text input | String settings (title, expression) | `<TextInput>` |
| Number input | Number settings (columns, scale) | `<NumberInput>` |
| Color picker | Custom colors | `<ColorPicker>` custom |
| Multi-select | Tag-like (visible groups) | `<TagInput>` custom |
| Field picker | Choose from DataFrame fields | `<FieldPicker>` custom |

### 3.4 Aggregation Picker — специальный поповер

```
Click [▼] в aggregation row:

┌──────────────────────┐
│ Column: Budget       │ (dim title)
│ ──────────────────── │
│ ○ None               │
│ ──────────────────── │
│ ● Sum          16000 │ ← Текущий выбор + preview
│ ○ Average       5333 │ ← Preview для каждой функции
│ ○ Median        5000 │
│ ○ Min           3000 │
│ ○ Max           8000 │
│ ○ Range         5000 │
│ ──────────────────── │
│ ○ Count            3 │
│ ○ % Empty         0% │
│ ○ % Not empty   100% │
└──────────────────────┘
```

**Особенности:**
- **Preview** для каждой функции — пользователь видит результат ДО выбора
- Выбор = мгновенное применение (нет Save/Cancel)
- Радио-кнопки — одна функция на столбец
- Список функций фильтруется по типу поля (Number видит sum/avg/median, String — нет)

### 3.5 Chart Configuration Panel

```
┌─────────────────────────────────────────────────┐
│ Chart Settings                              [×] │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Type                                            │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             │
│ │ ▓▓ │ │ ▓▓ │ │ /\ │ │ ◕  │ │ 42 │             │
│ │ Bar│ │HBar│ │Line│ │Pie │ │Num │             │
│ └────┘ └────┘ └────┘ └────┘ └────┘             │
│                                                 │
│ X Axis                                          │
│ Property          [Status        ▼]             │
│ Sort by           [Value         ▼]             │
│ Omit zero values  [────────────●  ]             │
│                                                 │
│ Y Axis                                          │
│ Show              [Count         ▼]             │
│ Group by          [Priority      ▼]             │
│ Cumulative        [●────────────  ]             │
│                                                 │
│ Style                                           │
│ Color scheme      [Auto          ▼]             │
│ Height            [Medium        ▼]             │
│ Show grid         [────────────●  ]             │
│ Show labels       [────────────●  ]             │
│ Show legend       [────────────●  ]             │
│                                                 │
│ ─────────────────────────────────────────────── │
│                    [Reset]  [Cancel]  [Apply]    │
└─────────────────────────────────────────────────┘
```

### 3.6 Widget Settings Panel (общий для всех виджетов)

Открывается через ⚙ кнопку в header виджета:

```
┌─────────────────────────────────────────────┐
│ Widget Settings                         [×] │
│ ─────────────────────────────────────────── │
│                                             │
│ Title           [Monthly Stats    ]         │
│ Widget type     (DataTable) (read-only)     │
│                                             │
│ ─── Data Source ──────────────────────────── │
│ Transform       [Configure...      ]  →     │ ← Открывает Transform Pipeline editor
│ Filter          [Configure...      ]  →     │
│                                             │

> **See also:** Transform Pipeline Editor UX — `database-view-pivot.md` §6.1–6.2
│ ─── Display ─────────────────────────────── │
│ (Вставка: type-specific settings)            │
│                                             │
│ ─────────────────────────────────────────── │
│                         [Cancel]  [Save]     │
└─────────────────────────────────────────────┘
```

---

## 4. Кнопки взаимодействия

### 4.1 Классификация кнопок

| Тип | Стиль | Размер | Пример |
|-----|-------|--------|--------|
| **Primary CTA** | Заливка accent color, белый текст | `--ppp-button-height-md` | [Save], [Apply], [Add Widget] |
| **Secondary** | Без заливки, border, text-normal | `--ppp-button-height-md` | [Cancel], [Reset] |
| **Destructive** | Заливка red, белый текст | `--ppp-button-height-md` | [Delete], [Remove] |
| **Ghost** | Прозрачный, текст muted | `--ppp-button-height-md` | [Reset to default] |
| **Icon Button** | Круглая/квадратная, иконка | `--ppp-button-height-sm` | [⚙], [×], [+], [↗] |
| **Toggle** | Slider on/off | `--ppp-button-height-sm` | Show grid, Show labels |
| **Segmented Control** | Группа toggle buttons | `--ppp-button-height-sm` | [Visual] [Code], [Bar] [Line] [Pie] |

### 4.2 Размеры кнопок (Адаптивные)

```css
/* Все размеры — через CSS custom properties */
--ppp-button-height-sm: 1.75rem;
--ppp-button-height-md: 2rem;
--ppp-button-height-lg: 2.5rem;
--ppp-button-padding-x: var(--ppp-space-lg);  /* 0.75rem horizontal */
--ppp-button-padding-y: var(--ppp-space-xs);   /* 0.25rem vertical */

/* Touch devices — увеличенная зона касания */
@media (pointer: coarse) {
  --ppp-button-height-sm: 2.5rem;
  --ppp-button-height-md: var(--ppp-touch-target-min); /* 2.75rem */
  --ppp-button-height-lg: 3rem;
  --ppp-button-padding-x: var(--ppp-space-xl);
}
```

### 4.3 Расположение кнопок — Паттерны

**Паттерн 1: Footer Actions (Modal / Popover)**

```
┌──────────────────────────────────────────────┐
│                                              │
│         [Destructive?]  [Cancel]  [Primary]  │ ← Правый край
│                                              │
└──────────────────────────────────────────────┘

Правила:
- Primary (CTA) — всегда самый правый
- Cancel — слева от Primary
- Destructive — если есть, крайний левый с gap
- gap: var(--ppp-space-md)
```

```css
.ppp-button-group {
  display: flex;
  justify-content: flex-end;
  gap: var(--ppp-space-md);
  padding: var(--ppp-space-md) var(--ppp-space-lg);
  border-top: 1px solid var(--background-modifier-border);
}
.ppp-button-group--with-destructive {
  justify-content: space-between;  /* Destructive слева, остальные справа */
}
```

**Паттерн 2: Widget Header Buttons**

```
┌──────────────────────────────────────────────────────┐
│ Widget Title              [Collapse ▾] [⚙] [⋮] [×]  │
└──────────────────────────────────────────────────────┘

Правила:
- Title слева, кнопки справа
- Кнопки: icon-only, ghost style
- hover: background-modifier-hover
- [⋮] = overflow menu (если больше 3 кнопок)
- [×] = только при hover на widget (или всегда на touch)
```

**Паттерн 3: Inline Action (в строке таблицы)**

```
│ Project Name              │ ... │  [📝] [🗑]  │
                                     ↑
                         Видимы только при hover строки
                         На touch: видимы через context menu
```

**Паттерн 4: Floating Action Button (Canvas)**

```
┌──────────────────────────────────────┐
│ ...canvas content...                 │
│                                      │
│                          [+ Widget]  │ ← Fixed в нижнем правом углу
└──────────────────────────────────────┘

CSS:
.ppp-fab {
  position: sticky;
  bottom: var(--ppp-space-lg);
  align-self: flex-end;
  z-index: var(--ppp-z-sticky);
}
```

### 4.4 Состояния кнопок

| Состояние | Визуал | Поведение |
|-----------|--------|-----------|
| **Default** | Обычный | Кликабельна |
| **Hover** | Lighter bg, cursor: pointer | Preview эффекта (если есть) |
| **Active/Pressed** | Darker bg, scale(0.98) | Начинает действие |
| **Focus-visible** | Outline ring (`2px solid var(--interactive-accent)`) | Keyboard navigation |
| **Disabled** | Opacity 0.4, cursor: not-allowed | Tooltip с причиной |
| **Loading** | Spinner внутри, width фиксирована | Блокирует повторный клик |

```css
.ppp-button {
  height: var(--ppp-button-height-md);
  padding: var(--ppp-button-padding-y) var(--ppp-button-padding-x);
  border-radius: var(--ppp-radius-sm);
  font-size: var(--ppp-font-size-sm);
  transition: background-color 100ms ease, transform 100ms ease;
  cursor: pointer;
  /* Никаких px в размерах */
}
.ppp-button:hover { background: var(--background-modifier-hover); }
.ppp-button:active { transform: scale(0.98); }
.ppp-button:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}
.ppp-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}
```

---

## 5. Модальные окна

### 5.1 Когда модал, когда поповер

| Критерий | Поповер | Модал |
|----------|---------|-------|
| Количество настроек | 1-5 | >5 |
| Вложенность | Нет подформ | Может содержать вложенные секции |
| Контекстность | Привязан к элементу | Общий для view |
| Деструктивность | Нет | Confirmation нужен |
| Пример | Aggregation picker, Color picker | Create project, Conditional format rules, Transform pipeline editor |

### 5.2 Структура модала

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Modal Title                                          [×] │ │ ← Header
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │  Section 1: Basic Settings                                │ │
│ │  ┌────────────────────────────────────────────────────┐  │ │
│ │  │ Setting                                  [Control] │  │ │
│ │  │ Description                                        │  │ │
│ │  └────────────────────────────────────────────────────┘  │ │
│ │                                                          │ │ ← Scrollable content
│ │  Section 2: Advanced                       [▼ Expand]   │ │    (max-height контейнер-зависим)
│ │  ┌────────────────────────────────────────────────────┐  │ │
│ │  │ (collapsed by default)                             │  │ │
│ │  └────────────────────────────────────────────────────┘  │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                          [Cancel]  [Create / Save]       │ │ ← Footer
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Правила модальных окон

1. **Один модал одновременно** — никаких стеков модалов
2. **Если нужно выбрать из другого списка** → popover поверх модала (z-index: popover > modal)
3. **Esc = Cancel** — всегда (если нет unsaved changes → confirm)
4. **Click на overlay = Cancel** — серый фон за модалом
5. **Unsaved changes guard**: если пользователь изменил настройки и нажал Cancel/Esc → подтверждение "Discard changes?"
6. **Submit на Enter** — если единственный input в modal, Enter = Submit (не в textarea)
7. **Sticky footer** — кнопки всегда видны даже при длинном контенте (sticky bottom)

### 5.4 Confirmation Dialog

Для деструктивных операций (Delete widget, Delete column, Clear data):

```
┌─────────────────────────────────────────────┐
│ Delete widget "Monthly Stats"?               │
│                                              │
│ This will remove the widget and its          │
│ configuration. This cannot be undone.        │
│                                              │
│                    [Cancel]  [Delete] (red)   │
└─────────────────────────────────────────────┘
```

**Правила:**
- Заголовок = действие + объект ("Delete widget X?")
- Body = последствия ("cannot be undone")
- Primary button = название действия (не "OK", а "Delete")
- Primary button = destructive style (red)
- Cancel = default focus (защита от случайного Enter)

---

## 6. Виджет — жизненный цикл UI

### 6.1 Появление виджета

```
1. [+ Add Widget] → Widget Toolbar opens
2. User selects widget type
3. New widget fades-in (opacity 0→1, 200ms) in default position
4. Widget в состоянии "setup" (если нужна конфигурация, settings открыты сразу)
5. User configures → [Apply]
6. Widget отображает данные
```

### 6.2 Widget Chrome (Header)

```
Свёрнутый:
┌──────────────────────────────────────────────────────┐
│ ▶ Monthly Stats (Chart)                     [⚙] [⋯] │
└──────────────────────────────────────────────────────┘

Развёрнутый:
┌──────────────────────────────────────────────────────┐
│ ▼ Monthly Stats (Chart)                     [⚙] [⋯] │
├──────────────────────────────────────────────────────┤
│                                                      │
│              (Chart Content)                          │
│                                                      │
└──────────────────────────────────────────────────────┘

Drag Mode (desktop):
┌──────────────────────────────────────────────────────┐
│ ≡ Monthly Stats (Chart)         ← cursor: grab       │
├──────────────────────────────────────────────────────┤
│ ... (ghost opacity: 0.6 при drag)                    │
└──────────────────────────────────────────────────────┘
```

**Header Elements:**
- **Collapse toggle** (▶/▼): первый элемент слева (toggle expand/collapse)
- **Title**: редактируемый (double-click → inline edit)
- **Type badge**: "(Chart)" — dimmed, non-editable
- **Settings** (⚙): открывает Widget Settings panel
- **Overflow** (⋯): меню (Duplicate, Delete, Move to top/bottom)

### 6.3 Resize Handles

```
Desktop: 8 точек
  ┌──●──────────●──────────●──┐
  │                            │
  ●        Widget Content      ●
  │                            │
  └──●──────────●──────────●──┘

Resize cursor:
  NW: nw-resize   N: n-resize   NE: ne-resize
  W: w-resize                    E: e-resize
  SW: sw-resize   S: s-resize   SE: se-resize

Mobile (stack mode): только нижний край
  └──────────────●──────────────┘
                 ↕ (вертикальный resize)
```

**Css:**

```css
.ppp-widget-resize-handle {
  position: absolute;
  z-index: var(--ppp-z-sticky);
  /* Размер handle — touch-friendly */
  --handle-size: 0.5rem;
}
@media (pointer: coarse) {
  .ppp-widget-resize-handle {
    --handle-size: 1rem;  /* Больше для пальца */
  }
}
```

### 6.4 Удаление виджета

```
1. User: menu → Delete (или [×])
2. Confirmation dialog (см. §5.4)
3. Widget fade-out (opacity 1→0, 150ms)
4. Grid recalculates layout (animation: 250ms ease-out)
5. Widget removed from config
```

---

## 7. DataTable — детали интерфейса

### 7.1 Ячейка — состояния

| Состояние | Визуал | Переход |
|-----------|--------|---------|
| **Default** | Обычный текст | — |
| **Hover** | `background: var(--background-modifier-hover)` | mouse enter |
| **Selected** | `outline: 2px solid var(--interactive-accent)` | click |
| **Editing** | inline input, blue outline | double-click / Enter |
| **Formula (derived)** | Italic текст, lock icon | Read-only |
| **Error** | Red border, tooltip с ошибкой | Formula eval error |
| **Conditional** | Background/text color overrides | ConditionalFormat rule |
| **Empty** | Placeholder текст (dimmed) | field value = null |

### 7.2 Column Header — интерактивность

```
┌────────────────────────────────┐
│ Budget ↑  [≡]                  │
│         sort    resize handle  │
└────────────────────────────────┘

Interactions:
- Click header → cycle sort (none → asc → desc → none)
- Double-click → rename field (inline edit)
- Right-click → Column context menu
- Drag header → reorder columns
- Drag right edge → resize column
- Sort indicator: ↑ (asc), ↓ (desc), none (unsorted)
- [≡] icon visible on hover: drag handle for reorder on touch
```

### 7.3 Row Grouping UI

```
┌──────────────────────────────────────────────────────────┐
│ ▼ Status: Active                              (28 items) │ ← Group header
│ ─────────────────────────────────────────────────────────│
│ │ Project A │ High     │ 5000     │ 2026-05-01 │        │
│ │ Project C │ Low      │ 8000     │ 2026-06-01 │        │
│ │ ...       │ ...      │ ...      │ ...        │        │
│ ├───────────┼──────────┼──────────┼────────────┤        │
│ │ Σ 2       │          │ Σ 13000  │            │ ← Sub-aggregation │
│ ─────────────────────────────────────────────────────────│
│                                                          │
│ ▶ Status: Done (9 items)  ← collapsed                    │
│ ─────────────────────────────────────────────────────────│
│                                                          │
│ ▼ Status: Backlog                              (5 items) │
│ ...                                                      │
│ ─────────────────────────────────────────────────────────│
│                                                          │
│ │ Σ 42      │ 3 unique │ Σ 68,000 │ Range: 90d │        │ ← Total aggregation
└──────────────────────────────────────────────────────────┘

Group header:
- ▼/▶ toggle collapse
- Click header → menu: Sort group, Hide group, Collapse all
- Count badge: "(28 items)" — dimmed
- Sub-aggregation: per-group aggregation row (стиль lighter чем total)
```

### 7.4 Freeze Columns

```
                 Freeze boundary
                       │
│ Name (frozen)  │  │  │ Status │ Priority │ Budget │ Date    │
├────────────────┤  │  ├────────┼──────────┼────────┼─────────┤  ← Scroll →
│ Project Alpha  │  │  │ Active │ High     │ 5000   │ 2026-05 │
│ Project Beta   │  │  │ Done   │ Medium   │ 3000   │ 2026-04 │
                 │  │
         Left sticky   Shadow divider (1px gradient)
         position      visual separator frozen / scrollable

CSS:
.ppp-table-cell--frozen {
  position: sticky;
  left: 0;
  z-index: calc(var(--ppp-z-sticky) + 1);
  background: var(--background-primary);  /* Скрывает контент под ним */
}
.ppp-table-cell--frozen::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: var(--ppp-space-xxs);
  background: linear-gradient(to right, var(--background-modifier-border), transparent);
}
```

### 7.5 Conditional Formatting — визуал

```
| Name      | Budget  | Status   |
|-----------|---------|----------|
| Project A | ████ 5K | ● Active | ← Green dot before "Active"
| Project B | ████ 3K | ● Done   | ← Blue dot
| Project C | ████ 8K | ● Active |

Budget > 7000 → green background:
| Project C | ░░░░ 8K | ● Active | ← Cell bg: light green
|           |  ↑ green |          |

Full conditional cell:
┌──────────────┐
│ ░░░░░░░░░░░░ │  background-color: var(--conditional-bg)
│ ██ 8,000 ██  │  color: var(--conditional-text)
│ bold         │  font-weight: 600 (if rule says bold)
└──────────────┘
```

---

## 8. FormulaBar — визуальный редактор

### 8.1 Две фазы

**Фаза 1 (v3.3.0 launch)**: Code-only mode

```
┌──────────────────────────────────────────────────┐
│ Formula: Budget Forecast                    [×]   │
│ ┌──────────────────────────────────────────────┐ │
│ │ IF(Status = "Active", Budget * 1.2, 0)      │ │ ← Code editor (monospace)
│ └──────────────────────────────────────────────┘ │
│ Autocomplete:  Budget, Status, Date, ...          │ ← Field suggestions
│ Error:         (none)                     ✓ Valid  │ ← Real-time validation
│ Preview: Record 1 → 6000 | Record 2 → 0          │ ← Live preview
│                                                    │
│                           [Cancel]  [Apply]        │
└──────────────────────────────────────────────────┘
```

**Фаза 2 (v3.3.x-post)**: Visual stacking mode (toggle)

```
┌──────────────────────────────────────────────────┐
│ Formula: Budget Forecast         [Visual] [Code]  │
│ ┌──────────────────────────────────────────────┐ │
│ │                                              │ │
│ │  ┌─────────┐  ┌───┐  ┌─────────┐            │ │
│ │  │ Budget  │─→│ × │─→│ 1.2     │            │ │ ← Drag blocks
│ │  └─────────┘  └───┘  └─────────┘            │ │
│ │       ↓                                      │ │
│ │  ┌─────────────────────────────────────┐     │ │
│ │  │ IF  condition: Status = "Active"    │     │ │
│ │  │     then: (result above)            │     │ │
│ │  │     else: 0                         │     │ │
│ │  └─────────────────────────────────────┘     │ │
│ │                                              │ │
│ └──────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────│
│ Available blocks:                                 │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │ + -  │ │ IF   │ │ AND  │ │ SUM  │ │TODAY │    │
│ │ × ÷  │ │ SWITCH│ │ OR  │ │ AVG  │ │ DATE │    │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                                    │
│ Fields: [Budget] [Status] [Date] [Priority]       │ ← Drag to canvas
│                                                    │
│                           [Cancel]  [Apply]        │
└──────────────────────────────────────────────────┘
```

### 8.2 Autocomplete

Появляется при вводе:
- Начало слова → предложить поля: `B` → `Budget, Boolean1, ...`
- `(` после слова → предложить функции: `IF(`, `SUM(`, ...
- `"` → предложить string values из текущего DataFrame

```
┌──────────────────────────────────────────────┐
│ IF(Status = "Act|")                          │
│              ┌───────────────────┐           │
│              │ "Active"     (12) │ ← count   │
│              │ "Archived"    (3) │           │
│              └───────────────────┘           │
└──────────────────────────────────────────────┘

Navigation: ↑↓ select, Enter apply, Esc dismiss
```

### 8.3 Real-time Validation

```
Valid:    ✓ checkmark (green) — формула компилируется
Warning:  ⚠ triangle (yellow) — компилируется, но может быть ошибка (division by zero possible)
Error:    ✗ cross (red) — синтаксическая ошибка, + message: "Unexpected token at position 15"

Preview row:
  Record "Project A" → 6000
  Record "Project B" → 0
  Record "Project C" → Error: division by zero
                       ↑ individual record errors shown
```

---

## 9. ChartWidget — взаимодействие

### 9.1 Hover на элементе

```
                    ┌──────────────┐
                    │ Active: 28   │ ← Tooltip
                    │ 66.7%        │
                    └──────┬───────┘
                           │
  ▓▓▓▓▓▓▓▓▓               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ▓▓▓▓▓▓▓▓▓    highlight → ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ← hovered bar brighter
  ▓▓▓▓▓▓▓▓▓               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ▓▓▓▓▓▓▓▓▓               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ─────────                ──────────────
  Done (9)                 Active (28)
```

**Tooltip содержит:**
- Label (group name)
- Value (absolute number)
- Percentage (of total)
- Sub-group breakdown (если stacked)

### 9.2 Click — Drill-down

Click на bar/slice → показывает записи этой группы:

```
Click "Active" bar → popover:

┌────────────────────────────────────────────────┐
│ Active (28 records)                        [×] │
│ ──────────────────────────────────────────────│
│ Project A    │ High   │ $5,000  │ 2026-05-01  │
│ Project C    │ Low    │ $8,000  │ 2026-06-01  │
│ Project D    │ Medium │ $2,500  │ 2026-05-15  │
│ ... (25 more)                    [Show all →]  │
└────────────────────────────────────────────────┘
```

### 9.3 Empty State

Если нет данных для графика:

```
┌──────────────────────────────────────────────┐
│ Chart Widget                           [⚙]   │
│ ──────────────────────────────────────────── │
│                                              │
│         ┌─────────────────────────┐          │
│         │     (chart icon dim)    │          │
│         │                         │          │
│         │  No data to display     │          │
│         │  Configure X/Y axes     │          │
│         │  in chart settings      │          │
│         │                         │          │
│         │     [Open Settings]     │          │
│         └─────────────────────────┘          │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 10. Toolbar и навигация

### 10.1 Database View Toolbar

```
┌────────────────────────────────────────────────────────────────────┐
│ [≡ Layout]  [🔍 Search]  [⊕ Filter]  [↕ Sort]  │  [+ Widget]  [⚙]│
│   mode       inline       popover     popover       panel      global│
└────────────────────────────────────────────────────────────────────┘

          compact mode (container < 30rem):
┌──────────────────────────────────────┐
│ [🔍]  [⊕]  [↕]        [+]  [⚙]  [⋮] │ ← Icon-only + overflow
└──────────────────────────────────────┘
```

### 10.2 Layout Toggle

Переключатель режима сетки:

```
Click [≡ Layout]:
┌───────────────────┐
│ ○ Free grid       │ ← Desktop default
│ ● Stacked         │ ← Mobile default / narrow
│ ○ Compact         │ ← Minimum spacing
└───────────────────┘
```

---

## 11. Feedback и состояния

### 11.1 Loading States

```
Initial load:
┌──────────────────────────────────────┐
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│ │░░░░│ │░░░░│ │░░░░│ │░░░░│ │░░░░│  │ ← Skeleton rows (pulse animation)
│ │░░░░│ │░░░░│ │░░░░│ │░░░░│ │░░░░│  │
│ │░░░░│ │░░░░│ │░░░░│ │░░░░│ │░░░░│  │
│ └────┘ └────┘ └────┘ └────┘ └────┘  │
└──────────────────────────────────────┘

Widget loading (after config change):
┌──────────────────────────────────────┐
│ Chart Widget                   [⚙]   │
│ ──────────────────────────────────── │
│           ◷ Processing...            │ ← Spinner + text
└──────────────────────────────────────┘
```

### 11.2 Error States

```
Formula error:
┌──────────────────────────────────────────┐
│ ⚠ Formula error in "Budget Forecast"     │
│ Division by zero at Record "Project C"   │
│ [Dismiss]  [Edit Formula]                │
└──────────────────────────────────────────┘

Transform pipeline error:
┌──────────────────────────────────────────┐
│ ✗ Transform failed                       │
│ Unpivot: field pattern "exercise(\d+)"   │
│ matched 0 fields                         │
│ [Dismiss]  [Edit Transform]              │
└──────────────────────────────────────────┘
```

### 11.3 Empty States

| Widget | Empty State | CTA |
|--------|-------------|-----|
| DataTable | "No records match filters" | [Clear filters] |
| Chart | "No data to display" | [Open Settings] |
| Stats | "Configure at least one card" | [Add Card] |
| Checklist | "No items yet" | [Add item] (inline) / [Configure field] (field-bound) |
| ViewPort | "Select a view to embed" | [Choose View] |
| Comparison | "Add at least 2 groups" | [Configure] |

### 11.4 Success Feedback

- **Save**: brief flash (green outline, 200ms) на saved element
- **Delete**: element fades out, surroundings animated to fill gap
- **Widget add**: new widget fades in with gentle scale(0.95→1) animation
- **Sort applied**: column header shows sort icon, brief highlight on header
- **Filter applied**: filter badge appears with count "(3)"

---

## 12. Gesture Choreography (Touch)

### 12.1 Gesture Map

| Gesture | Context | Effect |
|---------|---------|--------|
| **Tap** | Cell | Select cell |
| **Double-tap** | Cell | Edit cell |
| **Long-press (500ms)** | Cell | Context menu + vibration (10ms) |
| **Long-press** | Widget header | Start widget reorder (stack mode) |
| **Swipe left on row** | Table row | Reveal action buttons (Edit, Delete) |
| **Swipe down on widget edge** | Widget bottom border | Resize height |
| **Pan-x** | Table / Chart | Horizontal scroll |
| **Pinch** | Chart (future) | Zoom chart |
| **Tap** | Chart bar/slice | Drill-down popover |
| **Tap** | Checkbox (checklist) | Toggle + haptic |
| **Tap** | Collapse toggle | Toggle expand/collapse |
| **Tap** | [↗] ViewPort | Navigate to full view |

### 12.2 Swipe-to-Action (Table Row)

```
Swipe left →
┌───────────────────────────────────┬────────┬────────┐
│ Project Name (slides left)  →    │  Edit  │ Delete │
│                                   │  (blue)│ (red)  │
└───────────────────────────────────┴────────┴────────┘

Release on "Edit" → open EditNote modal
Release on "Delete" → confirm dialog
Swipe back (right) → cancel, row returns
```

### 12.3 Drag Reorder (Stack Mode)

```
Long-press widget header (500ms) → vibrate → ghost

┌─────────────────────┐
│ Stats Widget        │ ← Normal
├─────────────────────┤
│ ╔═════════════════╗ │
│ ║ Chart Widget    ║ │ ← Dragging (elevated shadow, opacity 0.8)
│ ╚═════════════════╝ │
├─────────────────────┤
│   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │ ← Drop zone indicator (dashed border)
├─────────────────────┤
│ Checklist Widget    │ ← Normal
└─────────────────────┘
```

---

## 13. Keyboard Navigation

### 13.1 Focus Order

```
Tab order:
1. Toolbar buttons (left → right)
2. Widget headers (top → bottom, left → right)
3. Widget content (internal tab order per widget type)
4. Footer actions (if any)
```

### 13.2 DataTable Keyboard

| Key | Action |
|-----|--------|
| `↑↓←→` | Navigate cells |
| `Enter` | Start editing selected cell |
| `Escape` | Cancel edit / deselect |
| `Tab` | Next cell (right, then next row) |
| `Shift+Tab` | Previous cell |
| `Ctrl+C` | Copy cell value |
| `Ctrl+V` | Paste into cell (if editable) |
| `Ctrl+Z` | Undo last edit |
| `Delete` | Clear cell value |
| `Space` | Toggle (Boolean cell) |
| `Ctrl+↑` | Sort ascending by current column |
| `Ctrl+↓` | Sort descending by current column |
| `F2` | Edit cell (alternative to Enter) |
| `Ctrl+Shift+F` | Open filter popover |

### 13.3 Widget-level Keyboard

| Key | Context | Action |
|-----|---------|--------|
| `Ctrl+Shift+N` | Canvas | Add new widget |
| `Ctrl+Shift+D` | Widget focused | Duplicate widget |
| `Ctrl+Shift+Backspace` | Widget focused | Delete widget (+ confirm) |
| `Ctrl+Shift+↑↓` | Widget focused (stack) | Move widget up/down |

---

## 14. Accessibility (a11y)

### 14.1 ARIA Roles

| Element | Role | Properties |
|---------|------|------------|
| DatabaseViewCanvas | `role="region"` | `aria-label="Database View"` |
| WidgetHost | `role="group"` | `aria-label="{widget title}"`, `aria-expanded` |
| DataTable | `role="grid"` | `aria-rowcount`, `aria-colcount` |
| Table Cell | `role="gridcell"` | `aria-colindex`, `aria-rowindex`, `aria-selected` |
| Column Header | `role="columnheader"` | `aria-sort="ascending\|descending\|none"` |
| ChartWidget | `role="img"` | `aria-label="Chart: {description}"` |
| AggregationRow | `role="row"` | `aria-label="Summary row"` |
| Button | `role="button"` | `aria-pressed` (toggles), `aria-disabled` |
| Popover | `role="dialog"` | `aria-modal="false"`, `aria-label` |
| Modal | `role="dialog"` | `aria-modal="true"`, `aria-labelledby` |
| Menu | `role="menu"` | Obsidian Menu handles this |

### 14.2 Screen Reader Announcements

| Event | Announcement |
|-------|-------------|
| Widget added | "Widget {type} added" |
| Widget deleted | "Widget {title} removed" |
| Sort applied | "Sorted by {field} {direction}" |
| Filter applied | "Filtered: {count} records shown" |
| Aggregation changed | "{field} aggregation: {function} = {value}" |
| Cell edited | "Cell {field} updated to {value}" |
| Formula error | "Formula error: {message}" |

### 14.3 High Contrast Mode

```css
@media (prefers-contrast: high) {
  .ppp-widget-host { border: 2px solid var(--text-normal); }
  .ppp-table-cell { border: 1px solid var(--text-normal); }
  .ppp-chart-bar { stroke: var(--text-normal); stroke-width: 2; }
  .ppp-conditional-bg { border: 2px solid currentColor; }
}
```

### 14.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .ppp-widget-host,
  .ppp-table-cell,
  .ppp-chart-bar,
  .ppp-button {
    transition: none !important;
    animation: none !important;
  }
}
```

---

## 15. Анимации и переходы

### 15.1 Timing

| Действие | Duration | Easing | Свойства |
|----------|----------|--------|----------|
| Button hover | 100ms | ease | background-color |
| Button press | 100ms | ease | transform (scale) |
| Widget appear | 200ms | ease-out | opacity, transform |
| Widget collapse | 200ms | ease-in-out | max-height |
| Widget delete | 150ms | ease-in | opacity |
| Grid reflow | 250ms | ease-out | grid positions |
| Popover open | 150ms | ease-out | opacity, transform |
| Popover close | 100ms | ease-in | opacity |
| Sort indicator | 200ms | ease | opacity |
| Conditional color | 150ms | ease | background-color |
| Chart bar growth | 400ms | ease-out | height (initial render only) |
| Chart hover | 100ms | ease | opacity, scale |

### 15.2 Правила

1. **Никаких анимаций >400ms** — всё мгновенно ощущается
2. **Анимации отключаются** при `prefers-reduced-motion: reduce`
3. **Функциональные переходы** (collapse, reflow) = ease-in-out
4. **Декоративные** (appear, fade) = ease-out
5. **Выход** (delete, close) = ease-in, короче чем вход

---

## 16. Цветовая система

### 16.1 Семантические цвета (CSS custom properties)

| Token | Использование | Source |
|-------|---------------|--------|
| `--interactive-accent` | Primary buttons, selection, links | Obsidian theme |
| `--text-normal` | Body text | Obsidian theme |
| `--text-muted` | Secondary text, descriptions | Obsidian theme |
| `--text-faint` | Tertiary text, placeholders | Obsidian theme |
| `--background-primary` | Main content background | Obsidian theme |
| `--background-secondary` | Widget headers, sidebar | Obsidian theme |
| `--background-modifier-hover` | Hover state | Obsidian theme |
| `--background-modifier-border` | Borders, separators | Obsidian theme |

### 16.2 Status Colors (Select/Status badges)

```css
--ppp-color-status-gray:    var(--text-faint);        /* Not started */
--ppp-color-status-blue:    var(--interactive-accent); /* In Progress */
--ppp-color-status-green:   #4caf50;                  /* Done */
--ppp-color-status-yellow:  #ff9800;                  /* Warning */
--ppp-color-status-red:     #f44336;                  /* Overdue/Error */
--ppp-color-status-purple:  #9c27b0;                  /* Review */
```

### 16.3 Chart Color Palette

```css
/* Auto scheme: derived from --interactive-accent */
--ppp-chart-1: var(--interactive-accent);
--ppp-chart-2: /* accent +60° hue */
--ppp-chart-3: /* accent +120° hue */
--ppp-chart-4: /* accent +180° hue */
--ppp-chart-5: /* accent +240° hue */
--ppp-chart-6: /* accent +300° hue */

/* Computed via HSL rotation in JS → injected as CSS variables */
```

### 16.4 Conditional Format Palette

Пользователь выбирает из предустановленных пар (bg + text):

| Preset | Background | Text |
|--------|-----------|------|
| Red | `rgba(244, 67, 54, 0.15)` | `#c62828` |
| Orange | `rgba(255, 152, 0, 0.15)` | `#e65100` |
| Yellow | `rgba(255, 235, 59, 0.15)` | `#f57f17` |
| Green | `rgba(76, 175, 80, 0.15)` | `#2e7d32` |
| Blue | `rgba(33, 150, 243, 0.15)` | `#1565c0` |
| Purple | `rgba(156, 39, 176, 0.15)` | `#6a1b9a` |
| Gray | `rgba(158, 158, 158, 0.15)` | `#616161` |

Background достаточно прозрачен чтобы не конфликтовать с dark/light theme.

# Dashboard UI Modernization Plan — M-UI-MODERNIZATION

> **Status**: PLANNING  
> **Created**: 2026-06-10  
> **Milestone**: M-UI-MODERNIZATION  
> **Triggered by**: Real Obsidian API testing + Phase 4/4.5 pipeline revealing legacy UI debt  

---

## Почему сейчас

Реальное тестирование через Obsidian API (2026-06-10) выявило, что текущий Dashboard UI наследует несколько слоёв технического долга:

1. **DataTable** унаследовал кривые столбцы и сломанные выравнивания из M-TABLE-REWRITE (2025), которые никогда не были переработаны визуально.
2. **Позиционирование** — 6 виджетов используют `position: absolute` + ручные z-index вместо CSS Grid.
3. **Старые типы** — ряд TypeScript-интерфейсов виджетов не был обновлён после перехода на Dashboard V3 (Phase 3).
4. **Токены** — 40+ захардкоженных px-значений, hex-цветов, hsл-fallback'ов вместо `--ppp-*` токенов.
5. **WidgetHost** — монолит 947 LOC со смешанными обязанностями (layout, toolbar, drag, resize, config).

**Принцип**: старые интерфейсные решения несут с собой множественные структурные проблемы. Точечные патчи не решат проблему — нужен полный снос и пересборка с чистого листа.

---

## Архитектура новой системы

### Принципы новой UI

| Принцип | Было | Станет |
|---|---|---|
| Layout | position:absolute + manual top/left | CSS Grid / Flexbox, 0 position:absolute в widget-content |
| Токены | Hardcoded px, hex, hsl | Строгая иерархия `--ppp-*` → `--ppp-db-*` → component |
| Inline styles | `style="width: {w}px"` | CSS custom properties через `--widget-col-width` |
| Z-index | Magic numbers (10, 100, 200) | Token-scale `--ppp-z-*` (10/20/30/40/50/60) |
| Typography | Mixed font-size | `--ppp-font-size-xs/sm/base/md/lg` scale |
| Component anatomy | Ad-hoc per widget | Surface → Header → Content → Footer (shared shell) |
| Types | Mixed legacy + new | Строгий WidgetConfig union, нет OrphanTypes |

### Иерархия токенов (новая)

```
Obsidian system vars (--background-*, --text-*, --interactive-*)
    └── Global ppp tokens (--ppp-space-*, --ppp-font-*, --ppp-z-*, --ppp-radius-*)
            └── Dashboard semantic tokens (--ppp-db-surface, --ppp-db-border, --ppp-db-row-height)
                    └── Widget component tokens (--ppp-dt-col-width, --ppp-chart-legend-height)
```

### Компонентная анатомия (унифицированная)

```
WidgetShell.svelte  ← НОВЫЙ единый контейнер вместо WidgetHost
├── .ppp-widget-surface          (CSS Grid: header + content)
│   ├── .ppp-widget-header       (flex: icon + title + badges + toolbar)
│   │   ├── SelectionBadge slot
│   │   └── WidgetToolbar slot
│   └── .ppp-widget-content      (overflow:auto, flex:1 1 auto)
│       └── <slot />             (widget renders here)
└── .ppp-widget-resize-handle    (4 edges via CSS Grid areas)
```

---

## Фазы реализации

### Фаза UI-0: Фундамент токенов (#050) — ОБЯЗАТЕЛЬНА ПЕРВОЙ

**Что делаем:**
- Создаём `src/ui/views/Dashboard/tokens/dashboardTokens.css` — исчерпывающий набор `--ppp-db-*` токенов
- Удаляем все hardcoded px/hex из 18 widget-файлов (40+ мест, см. аудит)
- Унифицируем z-index под token-scale (убиваем `z-index: 100`, `z-index: 200`)
- Объявляем `--ppp-border-thin` (0.0625rem), `--ppp-shadow-sm/md/lg` токены
- Создаём `--ppp-db-row-compact/default/expanded` (заменяет hardcoded row heights)

**Файлы:** `designTokens.ts`, `tokens/dashboardTokens.css`, `styles.css`  
**Сложность:** L | **Приоритет:** P0 | **Блокирует:** все остальные фазы

---

### Фаза UI-1: DataTable полный rebuild (#051) — P0

**Проблемы к решению:**
- Кривые столбцы: header и cells не шарят CSS Grid context → разъезжаются
- Сломанные выравнивания при изменении размера окна
- `position:sticky` aggregation row конфликтует с virtual scroll
- `z-index: 100` на agg-picker — вне token-scale
- 1843 LOC — монолит, нужна декомпозиция

**Новая архитектура DataTable:**

```
DataTableWidget.svelte (~400 LOC)       ← оркестратор
├── DataGrid.svelte (~300 LOC)          ← CSS Grid таблица
│   ├── DataGridHeader.svelte           ← НОВЫЙ: отдельный header
│   │   └── DataGridHeaderCell.svelte   ← НОВЫЙ: ячейка заголовка
│   ├── DataGridBody.svelte             ← virtual scroll container
│   │   └── DataGridRow.svelte          ← строка (highlight/dim aware)
│   │       └── DataGridCell.svelte     ← НОВЫЙ: унифицированная ячейка
│   └── DataGridAggRow.svelte           ← НОВЫЙ: aggregation строка
└── DataTableToolbar.svelte             ← поиск, фильтр, сортировка
```

**CSS Grid layout решение:**

```css
.ppp-data-grid {
  display: grid;
  /* Колонки задаются через CSS custom property — единый контекст для header и body */
  grid-template-columns: var(--ppp-dt-columns);
  grid-template-rows: auto 1fr auto;
  /* header / body / agg-row в одном grid */
}
```

**Ключевой fix:** Header и body cells — в одном `display:grid` контексте. Не два отдельных flex-контейнера.

**Сложность:** XL | **Зависит от:** #050

---

### Фаза UI-2: WidgetShell (#052) — P1

**Заменяем WidgetHost.svelte (947 LOC) на WidgetShell.svelte:**
- Чистый CSS Grid: `grid-template-areas: "header" "content" "footer"`
- Resize через ResizeObserver + CSS variables, не Svelte stores
- Toolbar — отдельный `WidgetToolbar.svelte` с token-based hover states
- SelectionBadge переносится в header slot
- DnD handles остаются но через dedicated `.ppp-widget-drag-handle`

**Сложность:** L | **Зависит от:** #050

---

### Фаза UI-3: Chart Widget (#053) — P1

**Что меняем:**
- Container: убираем hardcoded heights → `aspect-ratio: var(--ppp-chart-aspect, 16/9)` 
- Legend: новый token-based дизайн вместо внешней SVG-библиотеки overlay
- Empty state: унифицированный `EmptyState.svelte` (шарится со Stats, DataList)
- Scatter: переходим на строгий CSS Grid для axis labels

**Сложность:** M | **Зависит от:** #050

---

### Фаза UI-4: Stats, Comparison, SummaryRow (#054) — P1

**Stats Widget:**
- Карточки на CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr))`
- Новая типографика: value = `--ppp-font-size-2xl bold`, label = `--ppp-font-size-xs muted`
- "Filtered" dot — через CSS `::before` с `--ppp-color-accent`, не JS-вставка

**Comparison Widget:**
- Удаляем `color ?? "#6a6a8f"` (hardcoded hex) → `var(--ppp-db-text-secondary)`
- Delta arrows через CSS transforms, не emoji

**SummaryRow:**
- Sticky bottom через CSS Grid row, не position:absolute

**Сложность:** M | **Зависит от:** #050

---

### Фаза UI-5: FilterTabs, Checklist, DatabaseCallBlock (#055) — P1

**FilterTabs:**
- Новый tab strip через CSS `overflow-x: auto; scroll-snap-type: x`
- Active tab: `border-bottom: 2px solid var(--interactive-accent)` (Obsidian token)
- Overflow → hidden tabs с "..." dropdown

**Checklist:**
- Checkbox через CSS `appearance: none` + `:checked` + `var(--ppp-color-success)`
- Progress bar токенизирована: `--ppp-db-progress-height: 0.25rem`

**DatabaseCallBlock:**
- Status indicator: `var(--ppp-color-success/warning/error)` dot
- Query display: `font-family: var(--font-monospace)` + token padding

**Сложность:** M | **Зависит от:** #050

---

### Фаза UI-6: Timeline, ViewPort, DataList (#056) — P2

**Timeline Widget — самый сложный рефакторинг:**
- Убираем все 6× `position:absolute` → CSS Grid для row bars
- Today marker: `::after` pseudoelement через CSS Grid column placement
- Bar heights: `--ppp-timeline-bar-height` токен (1.25rem → token)
- Box-shadow → `var(--ppp-shadow-sm)` токен

**ViewPort:**
- Убираем `position:absolute` dropdown → CSS Popover API или портал

**DataList:**
- Card stack на CSS Grid: `gap: var(--ppp-space-sm)`

**Сложность:** L | **Зависит от:** #050

---

### Фаза UI-7: Удаление легаси-типов (#057) — P0

**Что сносим:**
- `WidgetConfigV1` / `WidgetConfigV2` — старые версии конфигов виджетов
- `FreeCanvasLayout` orphan types (после Phase 3 deletion ряд типов осиротел)
- `GridColumnDef` старый формат (конфликтует с новым CSS Grid подходом)
- Дублирующие union types в `types.ts` / `settings.ts`
- Устаревшие `FilterConditionV1` / `SortConditionV1` (replaced by v2)

**Цель:** 0 TypeScript `@deprecated` комментариев в src/, 0 неиспользуемых exports

**Сложность:** L | **Зависит от:** ничего (можно параллельно с UI-0)

---

### Фаза UI-8: Финальная интеграция и тестирование (#058) — P1

- PX-budget ratchet пересчёт (цель: ≤ 50 вместо текущих 186)
- Full Obsidian API тест всех 5 views демо-проекта
- svelte-check 0 warnings (сейчас 4)
- Визуальный аудит в OBStests vault: все 18 типов виджетов

---

## Порядок реализации

```
UI-7 (типы) ─────────────────────────────────────────────┐
                                                          │
UI-0 (токены) → UI-1 (DataTable) → UI-2 (WidgetShell) → UI-8 (интеграция)
             └─ UI-3 (Chart)     ─┘
             └─ UI-4 (Stats)     ─┘
             └─ UI-5 (FilterTabs)─┘
             └─ UI-6 (Timeline)  ─┘
```

UI-7 и UI-0 запускаются параллельно. UI-1 через UI-6 — параллельно после UI-0.

---

## KPI успеха

| Метрика | Сейчас | Цель |
|---|---|---|
| Hardcoded px в widget files | 40+ | 0 |
| Hardcoded hex/hsl colors | 8+ | 0 |
| `position:absolute` в widget content | 6 виджетов | 0 (только overlay/dropdowns) |
| z-index вне token-scale | 3 места | 0 |
| WidgetHost LOC | 947 | ≤ 350 (WidgetShell) |
| DataTableWidget LOC | 1843 | ≤ 600 (декомпозиция) |
| PX-budget ratchet | 186 | ≤ 60 |
| svelte-check warnings | 4 | 0 |
| Legacy orphan types | TBD | 0 |

---

## Инварианты (нельзя нарушать)

1. **Ни одна Jest-проверка не должна упасть** — все 134+ суитов зелёные после каждой фазы.
2. **4-gate CI** после каждого PR.
3. **DashboardCanvas ≤ 200 LOC** — неизменно.
4. **Нет `@ts-ignore`** в src/.
5. **Нет `new Menu(`** вне contextMenu.ts.
6. **Selection Bus API не меняется** — `SelectionState`, `setSelection()`, `composeEffectiveFilter()` остаются как есть (фаза 4.5 завершена).
7. **DataProvider Registry** (#044.1 contract) сохраняется полностью.

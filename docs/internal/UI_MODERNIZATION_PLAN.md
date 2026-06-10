# Dashboard UI Modernization Plan — M-UI-MODERNIZATION

> **Status**: PLANNING (адаптирован 2026-06-10 — выровнен с DASHBOARD_V2_SPEC.md)  
> **Created**: 2026-06-10  
> **Milestone**: M-UI-MODERNIZATION  
> **Spec cross-ref**: `docs/internal/DASHBOARD_V2_SPEC.md` (источник правды по судьбе виджетов)

---

## Зачем

Реальное тестирование через Obsidian API (2026-06-10) + code audit выявили:

1. **DataTable** — кривые столбцы, сломанные выравнивания (header и cells в разных flex-контекстах).
2. **Позиционирование** — 6 виджетов с `position:absolute` + ручными z-index.
3. **40+ hardcoded** px/hex/hsl значений вместо `--ppp-*` токенов.
4. **WidgetHost 947 LOC** — монолит.
5. **Устаревшие TypeScript-типы** — orphan-типы после Phase 3 (FreeCanvas deletion) и V2 архивирования.

---

## КРИТИЧЕСКИ ВАЖНО: Выравнивание с DASHBOARD_V2_SPEC

**DASHBOARD_V2_SPEC.md §4 определяет окончательную судьбу каждого виджета V1.**  
M-UI-MODERNIZATION НЕ ДОЛЖЕН заниматься rebuild виджетов, которые V2 удаляет.

### Виджеты по категориям (V2 решение)

| Виджет | V2 судьба | Действие в M-UI-MODERNIZATION |
|---|---|---|
| `database-call` | ✅ ОСТАЁТСЯ — центральный атом V2 | Modernize: Table/Board/Calendar/Gallery вкладки |
| `chart` | ✅ ОСТАЁТСЯ | Modernize (#053) |
| `stats` | ✅ ОСТАЁТСЯ | Modernize (#054) |
| `checklist` | ✅ ОСТАЁТСЯ | Modernize (#055) |
| `filter-tabs` | ✅ ОСТАЁТСЯ | Modernize (#055) |
| `text` | ✅ ОСТАЁТСЯ | Modernize (входит в #055) |
| `divider` | ✅ ОСТАЁТСЯ | Modernize (входит в #055) |
| `cover-banner` | ✅ ОСТАЁТСЯ (P3) | Modernize (входит в #055 или standalone) |
| `data-table` | → ПОГЛОЩЁН database-call (Table вкладка) | Функционал переходит в database-call; standalone widget → archive (#056) |
| `view-port` | → ПОГЛОЩЁН database-call | Standalone widget → archive (#056) |
| `data-list` | → ПОГЛОЩЁН database-call (List вкладка) | Standalone widget → archive (#056) |
| `sub-base-canvas` | → Заменён SubBasePanel в database-call | Standalone widget → archive (#056) |
| `comparison` | ❌ УДАЛИТЬ | Archive в `archive/dashboard-v1` (#056) |
| `summary-row` | ❌ УДАЛИТЬ (заменяет stats) | Archive (#056) |
| `yaml-visualizer` | ❌ УДАЛИТЬ из Dashboard → отдельный View | Archive (#056) |
| `timeline` | ❌ УДАЛИТЬ (P3, зависит от calendar engine) | Archive (#056) |
| `FreeCanvas` | ❌ Уже удалён (Phase 3) | Orphan types cleanup (#057) |

> **Правило**: Не вкладывать работу в UI виджета, который идёт в archive. Исключение: если виджет нужен для совместимости до завершения миграции в database-call.

---

## Архитектура новой UI системы

### Иерархия токенов

```
Obsidian system vars (--background-*, --text-*, --interactive-*)
    └── Global ppp tokens (--ppp-space-*, --ppp-font-*, --ppp-z-*, --ppp-radius-*)
            └── Dashboard semantic tokens (--ppp-db-surface, --ppp-db-border, --ppp-db-row-height)
                    └── Widget component tokens (--ppp-chart-aspect, --ppp-dt-columns)
```

### Компонентная анатомия (унифицированная)

```
WidgetShell.svelte  ← НОВЫЙ единый контейнер (замена WidgetHost)
├── .ppp-widget-surface          (CSS Grid: header + content)
│   ├── .ppp-widget-header       (flex: icon + title + badges + toolbar)
│   │   ├── SelectionBadge slot
│   │   └── WidgetToolbar slot
│   └── .ppp-widget-content      (overflow:auto, flex:1 1 auto)
│       └── <slot />
└── .ppp-widget-resize-handle    (4 edges via CSS Grid areas)
```

### Ключевой fix DataTable (внутри database-call)

Проблема: header и body — два отдельных flex-контейнера, не разделяющих CSS Grid контекст → колонки разъезжаются.

```css
/* Решение: единый grid context */
.ppp-db-table {
  display: grid;
  grid-template-columns: var(--ppp-dt-columns);  /* одна переменная для header + rows */
  grid-template-rows: auto 1fr auto;
}
```

---

## Фазы реализации

### Фаза UI-0: Фундамент токенов (#050) — БЛОКИРУЕТ ВСЁ

**Что делаем:**
- `src/ui/views/Dashboard/tokens/dashboardTokens.css` — `--ppp-db-*` токены
- Удалить 40+ hardcoded px/hex из **выживающих** виджетов (database-call, chart, stats, checklist, filter-tabs, text, divider, cover-banner, WidgetHost/Shell)
- Унифицировать z-index под token-scale
- `--ppp-border-thin`, `--ppp-shadow-sm/md/lg`, `--ppp-db-row-*` токены

**Файлы:** `designTokens.ts`, `tokens/dashboardTokens.css`, `styles.css`  
**Сложность:** L | **Приоритет:** P0

---

### Фаза UI-7: Удаление легаси-типов (#057) — ПАРАЛЛЕЛЬНО с UI-0

**Что сносим (TypeScript):**
- `WidgetConfigV1/V2` orphans (post-Phase 3)
- `FreeCanvasLayout` + связанные типы (Phase 3 deletion осиротила их)
- Standalone типы виджетов, уходящих в archive: `TimelineWidgetConfig`, `ComparisonWidgetConfig`, `SummaryRowWidgetConfig`, `ViewPortWidgetConfig`, `DataListWidgetConfig`, `YamlVisualizerWidgetConfig`
- Дублирующие union types в `types.ts`
- `GridColumnDef` старый формат

**Цель:** 0 TypeScript `@deprecated` в src/, 0 orphan exports  
**Сложность:** L | **Приоритет:** P0 | **analysis_required: true**

---

### Фаза UI-1: DatabaseCall Table View (#051) — после UI-0

**ПЕРЕФОРМУЛИРОВАНО**: не standalone DataTable rebuild, а модернизация Table-вкладки внутри `database-call` + финальная миграция standalone `data-table` → archive.

**Что делаем:**
- Внутри `DatabaseCallBlock.svelte`: Table view через CSS Grid с `--ppp-dt-columns`
- Декомпозиция: DataTableContent (внутри database-call) ≤ 400 LOC
- Sticky header + aggregation row без z-index конфликтов
- Виртуальный скролл без глобального overflow
- Standalone `DataTableWidget.svelte` → move to `archive/dashboard-v1` + alias для совместимости

**Сложность:** XL | **Зависит от:** #050

---

### Фаза UI-2: WidgetShell (#052) — после UI-0

**Заменяем WidgetHost.svelte (947 LOC) на WidgetShell.svelte:**
- CSS Grid: `grid-template-areas: "header" "content"`
- Resize через ResizeObserver + CSS variables
- Toolbar — отдельный `WidgetToolbar.svelte`
- SelectionBadge в header slot
- DnD через `.ppp-widget-drag-handle`
- Цель: ≤ 350 LOC

**Сложность:** L | **Зависит от:** #050

---

### Фаза UI-3: Chart Widget (#053) — после UI-0

- Container: `aspect-ratio: var(--ppp-chart-aspect, 16/9)`
- Legend: token-based дизайн
- Empty state: shared `EmptyState.svelte`
- Убрать hardcoded heights и inline shadow

**Сложность:** M | **Зависит от:** #050

---

### Фаза UI-4: Stats (#054) — после UI-0

**SCOPE СУЖЕН**: только Stats. Comparison и SummaryRow → archive (#056), не rebuild.

- Stats: CSS Grid `repeat(auto-fill, minmax(10rem, 1fr))`
- Value = `--ppp-font-size-2xl bold`, label = `--ppp-font-size-xs muted`
- "Filtered" dot через CSS `::before` с `var(--ppp-color-accent)`
- Убрать `color ?? "#6a6a8f"` hardcode

**Сложность:** S | **Зависит от:** #050

---

### Фаза UI-5: FilterTabs, Checklist, DatabaseCallBlock UI, Text, Divider, CoverBanner (#055) — после UI-0

**FilterTabs:** `overflow-x: auto; scroll-snap-type: x`. Overflow → "..." dropdown.  
**Checklist:** CSS `appearance:none` checkbox + `var(--ppp-color-success)`.  
**DatabaseCallBlock** (query config panel): status dot `var(--ppp-color-success/warning/error)`, query font `var(--font-monospace)`.  
**TextWidget / DividerWidget / CoverBanner:** токенизация remaining hardcoded values.

**Сложность:** M | **Зависит от:** #050

---

### Фаза UI-6: Archive V1 widgets (#056) — ПЕРЕФОРМУЛИРОВАНО

**НЕ МОДЕРНИЗАЦИЯ — АРХИВАЦИЯ.** Цель: удалить V1-виджеты из активного кода согласно DASHBOARD_V2_SPEC.md §4.

**Что переносим в `archive/dashboard-v1`:**
- `TimelineWidget.svelte` + `TimelineWidgetConfig.svelte` + `TimelineWidgetConfig` type
- `ComparisonWidget.svelte` + config
- `SummaryRowWidget.svelte` + config
- `YamlVisualizerWidget.svelte` + config (→ станет отдельным View позже)
- `ViewPortWidget.svelte` + config (функционал → database-call general wrapper)
- `DataListWidget.svelte` + config (функционал → database-call List tab)
- `SubBaseCanvasWidget.svelte` (функционал → SubBasePanel в database-call)
- Standalone `DataTableWidget.svelte` (функционал уже в #051)

**Порядок:** сначала убедиться, что database-call покрывает функциональность (Table, List, SubBase) — тогда archive безопасен.  
**Сложность:** L | **Зависит от:** #051 (DataTable migration done)

---

### Фаза UI-8: Интеграция и финальный тест (#058) — ПОСЛЕДНИЙ

- PX-budget ratchet пересчёт (цель: ≤ 60 из текущих 186)
- `svelte-check` 0 warnings
- Full Obsidian API тест всех 5 views демо-проекта
- WidgetType union обновлён до V2 состава (8 типов)
- Визуальный аудит в OBStests vault

**Сложность:** M | **Зависит от:** все предыдущие фазы

---

## Правильный порядок

```
#057 (Type cleanup, P0) ──────────────────────────────────────────────┐
                                                                       │
#050 (Tokens, P0) → #051 (DB Table) → #052 (WidgetShell) → #058 (integration)
                  → #053 (Chart)    ─┘
                  → #054 (Stats)
                  → #055 (FilterTabs/Checklist/Text/Divider)
                  → #056 (Archive V1 widgets) — зависит от #051
```

---

## KPI успеха

| Метрика | Сейчас | Цель |
|---|---|---|
| Hardcoded px в **выживающих** виджетах | 40+ | 0 |
| `position:absolute` в widget content | 6 виджетов | 0 |
| WidgetHost LOC | 947 | ≤ 350 (WidgetShell) |
| DatabaseCall Table view column alignment | ❌ broken | ✅ единый CSS Grid context |
| PX-budget ratchet | 186 | ≤ 60 |
| V1 виджеты в активном коде | 8 standalone | 0 (все в archive) |
| svelte-check warnings | 4 | 0 |
| Orphan TypeScript types | TBD | 0 |

---

## Инварианты (нельзя нарушать)

1. **4-gate CI** после каждой фазы — 134+ суитов зелёные.
2. **DashboardCanvas ≤ 200 LOC**.
3. **Нет `@ts-ignore`** в src/.
4. **Selection Bus API не меняется** (#044.x contracts frozen).
5. **filterEvaluator.ts** — единственный filter engine, не дублировать.
6. **Архивируемые виджеты идут в `archive/dashboard-v1`**, не удаляются из git-истории.
7. **database-call покрывает функционал** архивируемого виджета ДО его архивации.

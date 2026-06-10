# UI Design Architecture — Notion-Parity System
### obs-projects-plus v3.5.1-alpha → V2

> **Статус**: DESIGN SPEC — источник правды для M-UI-MODERNIZATION  
> **Создан**: 2026-06-10  
> **Cross-refs**: `DASHBOARD_V2_SPEC.md`, `UI_MODERNIZATION_PLAN.md`, `DASHBOARD_V2_VISION.md`  
> **Принцип**: Notion как минимальная планка качества. Там, где можно — превосходить.

---

## 0. Философия дизайна

> "Дашборд, который думает вместе со мной" — DASHBOARD_V2_VISION.md

**Три закона интерфейса V2:**

1. **Данные первичны, интерфейс — прозрачен.** UI не должен требовать внимания сам по себе. Он исчезает, когда работает правильно.

2. **Действие = один жест.** Добавить запись, связать блоки, настроить фильтр — одно движение, не серия модалов. Notion доказал этот паттерн. Мы используем его как минимальную планку.

3. **Прогрессивное раскрытие.** Три кнопки на старте. Сложность появляется, когда пользователь в неё упирается — не раньше.

---

## 1. Notion Parity Mapping

Полный маппинг каждой концепции Notion → наш эквивалент → текущий статус → action.

### 1.1 Structural Mapping (концепты)

| Notion | Наш концепт | Статус V1 | Action V2 |
|---|---|---|---|
| Workspace | Obsidian Vault | ✅ native | — |
| Page | Markdown file (`.md`) | ✅ native | — |
| Database (inline) | `database-call` widget | ⚠ partial | Укрепить как первичный атом |
| Database (full-page) | Dashboard view | ✅ exists | — |
| Linked database | `database-call` linked mode | 🔴 missing | V2 core: `linkedSelection` |
| Synced block | `native-query` datasource | ✅ #045.2 | UI entry point (#048) |
| Sub-item / nested | `SubBasePanel` (Матрёшка) | 🔴 missing | V2 core principle |
| Saved filter → database | `native-query` + Dashboard | ⚠ no UI | #048 |
| Property / Field | `DataField` + `DataFieldType` | ✅ exists | Tokens + icons (#047 done) |
| Relation field | `DataFieldType.Relation` | ✅ exists | wikilink = foreign key |
| Rollup | `DataFieldType.Rollup` | ✅ exists | — |
| Formula | `DataFieldType.Formula` | ✅ exists | FormulaConstructor (#022) |
| Template | Demo project + onboarding | ⚠ partial | #046 done, more templates needed |
| Cover image | `cover-banner` widget | ✅ exists | Tokenize (#055) |
| Page icon | Lucide icon per widget | ✅ #047 | — |

### 1.2 View Mapping (представления)

| Notion View | Наш компонент | Статус V1 | Action V2 |
|---|---|---|---|
| Table | `data-table` → `database-call` Table tab | ⚠ standalone → absorbed | #051 |
| Board (Kanban) | `database-call` Board tab | ✅ done Phase 4 | — |
| Calendar | `database-call` Calendar tab | ✅ done Phase 4 | — |
| Gallery | `database-call` Gallery tab | ✅ done Phase 4 | — |
| List | `database-call` List tab (TBD) | 🔴 missing | Part of #051 |
| Timeline | ~~`timeline` widget~~ → Phase 3 deferred | 🔴 archive | #056 |
| Chart | `chart` widget | ✅ exists | Modernize #053 |
| Formula Constructor | `FormulaConstructor.svelte` | ✅ #022 | — |

### 1.3 Interaction Mapping (паттерны взаимодействий)

| Notion Interaction | Наш паттерн | Статус V1 | Target V2 |
|---|---|---|---|
| Click cell → inline edit | Click → SlideInPanel | 🔴 requires modal | Inline edit in cell |
| Row hover → action buttons (⊕, ↗, …) | Nothing visible | 🔴 absent | `RowActionBar.svelte` on hover |
| Column header click → property menu | No unified menu | ⚠ partial | Header context menu |
| ⊕ New row (bottom of table) | `+` button in toolbar | ⚠ buried | Inline + row at bottom |
| Drag row to reorder | Not supported | 🔴 absent | `svelte-dnd-action` on rows |
| Drag column to reorder | Not supported | 🔴 absent | Column drag handles |
| Record expand → slide-in | `SlideInPanel.svelte` | ✅ exists | Notion-parity anatomy |
| Filter pill in toolbar | `FilterBridge` (old) | ⚠ old design | `FilterPanel.svelte` unified |
| Sort pill in toolbar | Separate sort UI | ⚠ inconsistent | Unified toolbar pills |
| Group by pill | Separate | ⚠ inconsistent | Unified toolbar pills |
| Properties toggle | Settings panel | ⚠ heavy | Lightweight toggle panel |
| / (slash) command | FormulaConstructor Ctrl+Space | ⚠ partial | Extend to block creation |
| Drag widget to reorder | `svelte-dnd-action` | ✅ grid mode | — |
| Canvas filter (affects all blocks) | `filter-tabs` widget | ✅ exists | Token modernize #055 |
| Cross-block reactive selection | Canvas Selection Bus | ✅ Phase 4+4.5 | Extend: linked blocks config UI |
| Empty state prompts | Blank / minimal | 🔴 no states | `EmptyState.svelte` component |
| Keyboard navigation | Basic | ⚠ partial | Arrow keys in table cells |
| ⌘K / global search | Obsidian native | ✅ native | — |
| @mention in formula | FormulaConstructor | ⚠ partial | — |

### 1.4 Property Type Mapping

| Notion Property Type | Our `DataFieldType` | Icon (Lucide) | Status |
|---|---|---|---|
| Text | `String` | `type` | ✅ |
| Number | `Number` | `hash` | ✅ |
| Select (single) | `Select` | `list` | ✅ |
| Multi-select | `List` | `layers` | ✅ |
| Status | `Status` | `circle-dot` | ✅ |
| Date | `Date` | `calendar` | ✅ |
| Checkbox | `Boolean` | `check-square` | ✅ |
| URL | `String` + format | ⚠ no URL type | TBD |
| Email | `String` + format | ⚠ no Email type | TBD |
| Relation | `Relation` | `link` | ✅ |
| Rollup | `Rollup` | `sigma` | ✅ |
| Formula | `Formula` | `function-square` | ✅ |
| Created time | `AutoTime` | `clock` | ✅ |
| Unique ID | `UniqueId` | `fingerprint` | ✅ |
| Files & media | — | — | Not planned V2 |

---

## 2. Design Language Architecture

### 2.1 Token Cascade (полная иерархия)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 0: Obsidian System Variables (не трогаем, читаем только)         │
│                                                                          │
│  --background-primary       --background-secondary                       │
│  --background-modifier-hover  --background-modifier-border               │
│  --text-normal               --text-muted    --text-faint                │
│  --text-on-accent            --interactive-accent                        │
│  --font-text-size             --font-monospace                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ mapped into →
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 1: Global PPP Tokens  (styles.css / designTokens.ts)             │
│                                                                          │
│  Space:       --ppp-space-1 (0.25rem)  --ppp-space-2 (0.5rem)           │
│               --ppp-space-3 (0.75rem)  --ppp-space-4 (1rem)             │
│               --ppp-space-6 (1.5rem)   --ppp-space-8 (2rem)             │
│                                                                          │
│  Typography:  --ppp-font-xs (0.7rem)   --ppp-font-sm (0.8rem)           │
│               --ppp-font-md (0.9rem)   --ppp-font-lg (1rem)             │
│               --ppp-font-xl (1.25rem)  --ppp-font-2xl (1.5rem)          │
│               --ppp-font-weight-normal (400)                             │
│               --ppp-font-weight-medium (500)                             │
│               --ppp-font-weight-bold   (600)                             │
│                                                                          │
│  Z-Index:     --ppp-z-base (0)  --ppp-z-float (10)  --ppp-z-overlay (20)│
│               --ppp-z-modal (30) --ppp-z-tooltip (40)                   │
│                                                                          │
│  Radius:      --ppp-radius-sm (4px)  --ppp-radius-md (6px)              │
│               --ppp-radius-lg (8px)  --ppp-radius-xl (12px)             │
│                                                                          │
│  Borders:     --ppp-border-thin (1px solid var(--background-modifier-border)) │
│               --ppp-border-medium (2px solid ...)                        │
│                                                                          │
│  Shadows:     --ppp-shadow-sm (0 1px 3px rgba(0,0,0,.08))               │
│               --ppp-shadow-md (0 4px 12px rgba(0,0,0,.12))              │
│               --ppp-shadow-lg (0 8px 24px rgba(0,0,0,.16))              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ specialised into →
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 2: Dashboard Semantic Tokens  (tokens/dashboardTokens.css)        │
│                                                                          │
│  Surface:                                                                │
│    --ppp-db-surface          var(--background-primary)                  │
│    --ppp-db-surface-raised   var(--background-secondary)                │
│    --ppp-db-surface-hover    var(--background-modifier-hover)            │
│    --ppp-db-surface-selected rgba(var(--interactive-accent-rgb),.10)    │
│                                                                          │
│  Text:                                                                   │
│    --ppp-db-text-primary     var(--text-normal)                         │
│    --ppp-db-text-secondary   var(--text-muted)                          │
│    --ppp-db-text-placeholder var(--text-faint)                          │
│                                                                          │
│  Border:                                                                 │
│    --ppp-db-border           var(--background-modifier-border)           │
│    --ppp-db-border-focus     var(--interactive-accent)                  │
│                                                                          │
│  Row:                                                                    │
│    --ppp-db-row-height-compact   2rem    (32px)                         │
│    --ppp-db-row-height-default   2.25rem (36px)                         │
│    --ppp-db-row-height-expanded  3rem    (48px)                         │
│                                                                          │
│  Accent colors:                                                          │
│    --ppp-color-accent        var(--interactive-accent)                  │
│    --ppp-color-success       #4caf50  (TODO: map to Obsidian var)       │
│    --ppp-color-warning       #ff9800                                    │
│    --ppp-color-error         var(--text-error)                          │
│    --ppp-color-muted         var(--text-faint)                          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ consumed by →
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 3: Widget Component Tokens  (per-widget scoped vars)              │
│                                                                          │
│  DataTable:   --ppp-dt-columns          (computed via JS → CSS var)     │
│               --ppp-dt-col-min-width    8rem                            │
│               --ppp-dt-col-max-width    24rem                           │
│               --ppp-dt-header-height    2rem                            │
│                                                                          │
│  Chart:       --ppp-chart-aspect        16/9                            │
│               --ppp-chart-legend-size   var(--ppp-font-xs)             │
│                                                                          │
│  Stats:       --ppp-stats-min-card-w    10rem                           │
│               --ppp-stats-value-size    var(--ppp-font-2xl)            │
│               --ppp-stats-label-size    var(--ppp-font-xs)             │
│                                                                          │
│  Board:       --ppp-board-col-width     17.5rem                         │
│               --ppp-board-card-radius   var(--ppp-radius-md)            │
│                                                                          │
│  Widget:      --ppp-widget-header-h     2.25rem                         │
│               --ppp-widget-padding      var(--ppp-space-3)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Typography Scale (Notion-пarity)

```
SCALE           SIZE      WEIGHT    USE CASE
─────────────────────────────────────────────────────────────────────────
2xl  display    1.5rem    600       Stats card value, large number
xl   title      1.25rem   600       Widget header title, section heading
lg   body-lg    1rem      400       Regular body text, cell text (default)
md   body       0.9rem    400       Property labels, tag text
sm   caption    0.8rem    400       Secondary info, timestamps, hints
xs   micro      0.7rem    400       Metadata, row action buttons, badges

Monospace: var(--font-monospace) — query text, formula, ID fields
```

### 2.3 Spacing Rhythm (8px base grid)

```
TOKEN              VALUE     USAGE
─────────────────────────────────────────────────────────────────────
--ppp-space-1      0.25rem   Icon-text gap, badge padding-x
--ppp-space-2      0.5rem    Cell padding, small gaps
--ppp-space-3      0.75rem   Widget internal padding
--ppp-space-4      1rem      Section gaps, card padding
--ppp-space-6      1.5rem    Between widgets, major sections
--ppp-space-8      2rem      Canvas edge padding, modal gutters
```

### 2.4 Color Semantic Palette

```
PURPOSE                   LIGHT MODE                    DARK MODE (inherits)
────────────────────────────────────────────────────────────────────────────
surface.base              --background-primary          auto
surface.raised            --background-secondary        auto
surface.hover             --background-modifier-hover   auto
surface.selected          accent @ 10% opacity          auto
border.default            --background-modifier-border  auto
border.focus              --interactive-accent          auto
text.primary              --text-normal                 auto
text.secondary            --text-muted                  auto
text.placeholder          --text-faint                  auto
accent.primary            --interactive-accent          auto
state.success             var(--color-green) [Obsidian native]   auto (dark: Obsidian handles)
state.warning             var(--color-orange) [Obsidian native]  auto
state.error               --text-error                  auto
state.filtered-dot        accent.primary @ 85%          auto

Select/Status tag colors — from existing --ppp-select-color-N variables
```

---

## 3. Component Architecture — Full ASCII Map

### 3.1 Dashboard View — Top Level

```
╔══════════════════════════════════════════════════════════════════════════╗
║  ViewLayout (src/ui/app/AppLayout.svelte)                                ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │  ViewHeader                                                        │  ║
║  │  ┌─────────────────────────────────────────────────────────────┐  │  ║
║  │  │ [◉ ProjectIcon] [ProjectName]             [Settings] [···]  │  │  ║
║  │  └─────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                    │  ║
║  │  ViewTabBar  (Calendar / Board / Gallery / Dashboard / ···  [+])  │  ║
║  │  ┌─────────────────────────────────────────────────────────────┐  │  ║
║  │  │  ○ Calendar  ○ Board  ○ Gallery  ● Dashboard  ○ Table  [+]  │  │  ║
║  │  └─────────────────────────────────────────────────────────────┘  │  ║
║  └────────────────────────────────────────────────────────────────────┘  ║
║                                                                          ║
║  DashboardCanvas.svelte  (≤ 200 LOC — layout + routing only)            ║
║  ┌────────────────────────────────────────────────────────────────────┐  ║
║  │  DashboardToolbar                                                  │  ║
║  │  ┌─────────────────────────────────────────────────────────────┐  │  ║
║  │  │  [+ Add Block ▾]   [Filter ▾] [Sort ▾] [Group ▾]  [⋮ More]  │  │  ║
║  │  └─────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                    │  ║
║  │  WidgetGrid.svelte (12-col grid, 4rem row unit, svelte-dnd-action)│  ║
║  │  ┌──────────────────────────────────────────────────────────────┐ │  ║
║  │  │                                                              │ │  ║
║  │  │  [WidgetShell]  [WidgetShell]  [WidgetShell]                 │ │  ║
║  │  │                                                              │ │  ║
║  │  │  [WidgetShell ───────────────────]  [WidgetShell]            │ │  ║
║  │  │                                                              │ │  ║
║  │  └──────────────────────────────────────────────────────────────┘ │  ║
║  └────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 3.2 WidgetShell — Universal Container (замена WidgetHost)

```
┌─ WidgetShell.svelte ─────────────────────────────────────────────────────┐
│  CSS Grid:                                                               │
│    grid-template-rows: var(--ppp-widget-header-h) 1fr                   │
│    grid-template-areas: "header" "content"                               │
│                                                                          │
│  ┌─ .ppp-widget-header ─────────────────────────────────────────────┐   │
│  │  display: flex; align-items: center; gap: --ppp-space-2           │   │
│  │  height: var(--ppp-widget-header-h)  [2.25rem]                   │   │
│  │                                                                   │   │
│  │  ┌──────┐  ┌─────────────────────────┐  ┌──────────────────────┐ │   │
│  │  │ Icon │  │ Widget Title            │  │ [Badges] [Toolbar ▾] │ │   │
│  │  │ 16px │  │ var(--ppp-font-md) 500  │  │                      │ │   │
│  │  └──────┘  └─────────────────────────┘  └──────────────────────┘ │   │
│  │            flex: 1 1 auto                  SelectionBadge slot    │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ .ppp-widget-content ────────────────────────────────────────────┐   │
│  │  overflow: auto; flex: 1 1 auto                                  │   │
│  │  padding: var(--ppp-widget-padding)                               │   │
│  │                                                                   │   │
│  │  <slot />   ← DatabaseCallWidget / ChartWidget / etc             │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  .ppp-widget-resize-handle  (4 edges via CSS Grid areas, 4px grab zone) │
│  .ppp-widget-drag-handle    (header area, cursor: grab)                  │
│                                                                          │
│  HOVER STATE: opacity: 1 for toolbar and drag handle                     │
│  DEFAULT:     toolbar opacity: 0, drag-handle opacity: 0.3               │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 DatabaseCallWidget — Main Data Atom

```
┌─ DatabaseCallWidget.svelte (≤ 400 LOC) ─────────────────────────────────┐
│                                                                          │
│  ┌─ ViewTabBar.svelte ──────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  [Table] [Board] [Calendar] [Gallery] [List]  [+ Add view]       │   │
│  │    ●                                                             │   │
│  │  active tab: border-bottom 2px var(--ppp-color-accent)           │   │
│  │  tabs: overflow-x: auto; scroll-snap-type: x mandatory           │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ ViewToolbar (contextual per view) ─────────────────────────────┐   │
│  │  [Filter ○] [Sort ○] [Group ○] [Properties]  ─────  [Search ○] │   │
│  │   ↑ pill style: rounded, dismissable, count badge               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ View Content ──────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  {#if activeView === 'table'}                                    │   │
│  │    <DataTableView source={source} frame={effectiveFrame} />      │   │
│  │  {/if}                                                           │   │
│  │                                                                  │   │
│  │  {#if activeView === 'board'}                                    │   │
│  │    <BoardView ... />                                             │   │
│  │  {/if}                                                           │   │
│  │                                                                  │   │
│  │  ...etc                                                          │   │
│  │                                                                  │   │
│  │  {#if subBaseMode}                                               │   │
│  │    <SubBasePanel record={selectedRecord} />  ← Матрёшка         │   │
│  │  {/if}                                                           │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.4 DataTable View — Notion-parity Layout

```
┌─ DataTableView.svelte ──────────────────────────────────────────────────┐
│  display: grid                                                           │
│  grid-template-rows: auto  1fr  auto                                     │
│  (header)  (scrollable body)  (aggregation footer)                       │
│                                                                          │
│  ┌─ .ppp-dt-header ─────────────────────────────────────────────────┐   │
│  │  display: grid                                                   │   │
│  │  grid-template-columns: var(--ppp-dt-columns)   ← SHARED VAR    │   │
│  │  position: sticky; top: 0; z-index: var(--ppp-z-float)          │   │
│  │                                                                  │   │
│  │  ┌────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │   │
│  │  │ ☐ sel  │ │ 📝 Name   ↕ │ │ ○ Status  ↕ │ │ # Number ↕ │  │   │
│  │  │ 2rem   │ │              │ │              │ │             │  │   │
│  │  └────────┘ └──────────────┘ └──────────────┘ └─────────────┘  │   │
│  │                                                                  │   │
│  │  Header cell hover: background var(--ppp-db-surface-hover)      │   │
│  │  Click: ContextMenu(sort ASC/DESC, filter, hide, wrap, delete)  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ .ppp-dt-body ───────────────────────────────────────────────────┐   │
│  │  overflow-y: auto                                                │   │
│  │                                                                  │   │
│  │  ┌─ .ppp-dt-row (hover state) ───────────────────────────────┐  │   │
│  │  │  display: grid                                             │  │   │
│  │  │  grid-template-columns: var(--ppp-dt-columns)  ← SAME VAR │  │   │
│  │  │  height: var(--ppp-db-row-height-default)                  │  │   │
│  │  │                                                             │  │   │
│  │  │  ┌────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────┐   │  │   │
│  │  │  │ ☐      │ │ Иван Петров  │ │ ● Active  │ │ 42       │   │  │   │
│  │  │  └────────┘ └──────────────┘ └───────────┘ └──────────┘   │  │   │
│  │  │                                                             │  │   │
│  │  │  HOVER: .ppp-dt-row-actions appears (opacity transition)   │  │   │
│  │  │  ┌────────────────────────────────────────────────────┐    │  │   │
│  │  │  │ [↗ Open] [⊕ Add below] [⋯ More]  (right-aligned) │    │  │   │
│  │  │  └────────────────────────────────────────────────────┘    │  │   │
│  │  │                                                             │  │   │
│  │  │  SELECTED: background var(--ppp-db-surface-selected)       │  │   │
│  │  │  DIMMED (selection bus): opacity: 0.4                       │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ─ virtual scroll: only visible rows in DOM ─────────────────   │   │
│  │                                                                  │   │
│  │  ┌─ .ppp-dt-new-row ─────────────────────────────────────────┐  │   │
│  │  │  [+ New]                  ← always visible at bottom      │  │   │
│  │  │  click → create record inline, focus first cell           │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ .ppp-dt-footer (aggregation row) ──────────────────────────────┐   │
│  │  grid-template-columns: var(--ppp-dt-columns)  ← SAME VAR      │   │
│  │  position: sticky; bottom: 0                                    │   │
│  │  color: var(--ppp-db-text-secondary)                            │   │
│  │                                                                  │   │
│  │  ┌────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │   │
│  │  │ 12 ↺   │ │ Count: 12    │ │              │ │ Sum: 504    │  │   │
│  │  └────────┘ └──────────────┘ └──────────────┘ └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Board View — Notion-style Kanban

```
┌─ BoardView.svelte ──────────────────────────────────────────────────────┐
│  display: flex; gap: var(--ppp-space-4)                                 │
│  overflow-x: auto; padding: var(--ppp-space-3)                          │
│                                                                          │
│  ┌─ .ppp-board-col ──┐  ┌─ .ppp-board-col ──┐  ┌─ .ppp-board-col ──┐  │
│  │  width: --ppp-     │  │  width: --ppp-     │  │  width: --ppp-     │  │
│  │  board-col-width   │  │  board-col-width   │  │  board-col-width   │  │
│  │  [17.5rem]         │  │                    │  │                    │  │
│  │                    │  │                    │  │                    │  │
│  │  ● Active    [2]   │  │  ○ In Review  [1]  │  │  ✓ Done      [5]  │  │
│  │  ─────────────     │  │  ─────────────     │  │  ─────────────     │  │
│  │                    │  │                    │  │                    │  │
│  │  ┌──────────────┐  │  │  ┌──────────────┐  │  │  ┌──────────────┐  │  │
│  │  │ Card title   │  │  │  │ Card title   │  │  │  │ Card title   │  │  │
│  │  │ property val │  │  │  │              │  │  │  │              │  │  │
│  │  │ ○ status     │  │  │  └──────────────┘  │  │  └──────────────┘  │  │
│  │  │ 📅 date      │  │  │                    │  │                    │  │
│  │  └──────────────┘  │  │  [+ New]           │  │  [+ New]          │  │
│  │                    │  └────────────────────┘  └────────────────────┘  │
│  │  [+ New]           │                                                  │
│  └────────────────────┘                                                  │
│                                                                          │
│  Board card hover: --ppp-shadow-sm + border var(--ppp-db-border-focus)  │
│  Drag in column: --ppp-shadow-md, 4° rotation                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.6 Record Expand Panel — Notion slide-in

```
┌─ Slide-In Panel (SlideInPanel.svelte) ──────────────────────────────────┐
│  position: fixed; right: 0; top: 0; height: 100vh                      │
│  width: min(480px, 100vw)                                               │
│  background: var(--ppp-db-surface-raised)                               │
│  box-shadow: var(--ppp-shadow-lg)                                       │
│  z-index: var(--ppp-z-overlay)                                          │
│                                                                          │
│  ┌─ Panel Header ───────────────────────────────────────────────────┐   │
│  │  [← Back]   Record Title (editable, var(--ppp-font-xl) 600)      │   │
│  │  ─────────────────────────────────────────────────────── [✕ Close]   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Properties section ─────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  📝 Name                      Иван Петров                        │   │
│  │  ─────────────────────────────────────────────────────           │   │
│  │  ○ Status                     ● Active                           │   │
│  │  ─────────────────────────────────────────────────────           │   │
│  │  📅 Created                   2026-06-01                         │   │
│  │  ─────────────────────────────────────────────────────           │   │
│  │  🔗 Project                   [[CRM Redesign]]                   │   │
│  │  ─────────────────────────────────────────────────────           │   │
│  │  # Sessions count     ∑ rollup: 15                               │   │
│  │                                                                  │   │
│  │  Property click → inline edit (input or select dropdown)         │   │
│  │                                                                  │   │
│  │  [+ Add property]   ← Notion-style discovery                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Sub-base section (Матрёшка) ────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  [Sessions →] [Tasks →]    ← linked relation tabs               │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────────────────────────────────┐ │   │
│  │  │  Table  Board  Calendar                                    │ │   │
│  │  │  ─────────────────────────────────────                     │ │   │
│  │  │  Session 2026-06-01   Pain: 7   Duration: 45min            │ │   │
│  │  │  Session 2026-05-14   Pain: 5   Duration: 50min            │ │   │
│  │  │                                                            │ │   │
│  │  │  [+ New session]                                           │ │   │
│  │  └────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Body section ───────────────────────────────────────────────────┐   │
│  │  Markdown content from the note body (read-only preview)         │   │
│  │  [Open in editor ↗]                                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.7 Stats Widget — Notion aggregation parity

```
┌─ StatsWidget.svelte ────────────────────────────────────────────────────┐
│  display: grid                                                           │
│  grid-template-columns: repeat(auto-fill, minmax(var(--ppp-stats-min-card-w), 1fr)) │
│  gap: var(--ppp-space-3)                                                │
│                                                                          │
│  ┌─ .ppp-stats-card ──────────┐  ┌─ .ppp-stats-card ──────────┐        │
│  │  background: --ppp-db-     │  │                             │        │
│  │  surface-raised             │  │                             │        │
│  │  border-radius: --ppp-     │  │                             │        │
│  │  radius-md                  │  │                             │        │
│  │  padding: --ppp-space-4    │  │                             │        │
│  │                             │  │                             │        │
│  │  .ppp-stats-label           │  │  .ppp-stats-label           │        │
│  │  Total Clients              │  │  Avg Session Duration       │        │
│  │  var(--ppp-font-xs) muted   │  │                             │        │
│  │                             │  │                             │        │
│  │  .ppp-stats-value           │  │  .ppp-stats-value           │        │
│  │  42                         │  │  47 min                     │        │
│  │  var(--ppp-font-2xl) bold   │  │                             │        │
│  │                             │  │                             │        │
│  │  .ppp-stats-filtered-dot    │  │  (no filter active)         │        │
│  │  ::before content:""        │  │                             │        │
│  │  8px dot color: accent      │  │                             │        │
│  │  ← appears when filtered    │  │                             │        │
│  └─────────────────────────────┘  └─────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.8 FilterPanel — Unified filter UI (все уровни)

```
┌─ FilterPanel.svelte ────────────────────────────────────────────────────┐
│  Used at: project level / view level / widget level / agenda level      │
│  Entry point determines scope — not the component                       │
│                                                                          │
│  ┌─ Active filters (pills) ─────────────────────────────────────────┐   │
│  │                                                                  │   │
│  │  [Status = Active ✕]  [Date > 2026-01-01 ✕]  [+ Add filter]     │   │
│  │                                                                  │   │
│  │  Pill: background --ppp-db-surface-raised                        │   │
│  │        border: --ppp-border-thin                                 │   │
│  │        font: --ppp-font-sm                                       │   │
│  │        hover: --ppp-db-surface-hover                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─ Expanded filter editor (FloatingPopup) ─────────────────────────┐   │
│  │                                                                  │   │
│  │  FilterRow:                                                      │   │
│  │  [field ▾]  [operator ▾]  [value input]  [✕]                    │   │
│  │  Status      is             ● Active                             │   │
│  │                                                                  │   │
│  │  FilterRow:                                                      │   │
│  │  [Date]    [is after]    [2026-01-01]  [✕]                      │   │
│  │                                                                  │   │
│  │  [AND ▾]  [+ Add condition]                                      │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.9 Canvas Selection Bus — Reactive Link Flow

```
┌─ DashboardCanvas.svelte ────────────────────────────────────────────────┐
│                                                                          │
│  setContext(CANVAS_SELECTION_BUS, createCanvasSelectionBus())           │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                           CanvasGrid                              │  │
│  │                                                                   │  │
│  │  ┌────────────────────┐            ┌────────────────────────┐    │  │
│  │  │  Block A           │            │  Block B               │    │  │
│  │  │  (master)          │            │  (linked → A)          │    │  │
│  │  │                    │  select    │                        │    │  │
│  │  │  [Clients]         │ ─────────► │  [Sessions]            │    │  │
│  │  │  ● Иван Петров     │ 'ivan-id'  │  auto-filter:          │    │  │
│  │  │    Мария Иванова   │            │  client='ivan-id'      │    │  │
│  │  └────────────────────┘            └────────────────────────┘    │  │
│  │         │                                                         │  │
│  │         │ select 'ivan-id'                                        │  │
│  │         ▼                                                         │  │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────┐  │  │
│  │  │  Block C     │  │  Block D                                 │  │  │
│  │  │  (linked→A)  │  │  (linked→A)                             │  │  │
│  │  │              │  │                                          │  │  │
│  │  │  [Stats]     │  │  [Chart: pain dynamics]                  │  │  │
│  │  │  15 sessions │  │  ▁▃▅▇▅▃▁  Иван's sessions               │  │  │
│  │  └──────────────┘  └──────────────────────────────────────────┘  │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  SelectionBus interface:                                                 │
│    select(widgetId, recordId)   deselect(widgetId)                      │
│    getSelection(widgetId) → ReadonlySet<string>                         │
│    subscribe(widgetId, cb) → Unsubscriber                               │
│                                                                          │
│  Escape → deselect all  │  Click outside → deselect                     │
│  Multi-select: is-any-of filter (Phase 4.5 done ✅)                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.10 Empty States Library

```
EMPTY STATE: New database block (no records)
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                  📂                                      │
│         No records yet                                   │
│         var(--ppp-db-text-secondary) center              │
│                                                          │
│  [ + Add first record ]   [ Configure source ▸ ]        │
│                                                          │
└──────────────────────────────────────────────────────────┘

EMPTY STATE: Filter returns no results
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                  🔍                                      │
│         No records match the current filter              │
│                                                          │
│  [ Clear filters ]                                       │
│                                                          │
└──────────────────────────────────────────────────────────┘

EMPTY STATE: Chart, no data
┌──────────────────────────────────────────────────────────┐
│                      ▁▁                                  │
│                 ▁▁  ▁██▁                                 │
│            ▁▁  ▁██▁ ████ ▁▁                             │
│            (preview illustration in muted tones)         │
│         No chart data available                          │
│  [ Select a numeric field → ]                            │
└──────────────────────────────────────────────────────────┘

Component: EmptyState.svelte
  props: icon, title, description?, actions?: EmptyStateAction[]
  EmptyStateAction: { label, onClick, variant: 'primary'|'secondary' }
```

---

## 4. Interaction Pattern Library

### 4.1 State Machine — Table Cell Interactions

```
                    ┌─────────────────────────────────────────┐
                    │              CELL STATES                 │
                    └─────────────────────────────────────────┘

  [DEFAULT]
     │ hover on row
     ▼
  [ROW HOVER]  ← row background: --ppp-db-surface-hover
     │             row-actions: opacity 1 (transition 150ms)
     │ click on cell
     ▼
  [CELL FOCUSED]  ← cell border: --ppp-db-border-focus 2px
     │               input appears inline
     │               content editable
     │ Enter / Tab
     ▼
  [NEXT CELL FOCUSED]

  [CELL FOCUSED] ─ Escape ─► [ROW HOVER] (cancel edit)
  [ROW HOVER] ─ click ↗ ─► SlideInPanel opens (record expand)
  [ROW HOVER] ─ click ⊕ ─► new row inserted below
  [ROW HOVER] ─ right-click ─► context menu
  [DEFAULT] ─ keyboard: ArrowDown/Up ─► [ROW SELECTED]
```

### 4.2 Hover Reveal Pattern (Notion-style)

```
CSS pattern for all hover-reveal elements:

.ppp-hover-reveal {
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
}

.ppp-hover-trigger:hover .ppp-hover-reveal,
.ppp-hover-trigger:focus-within .ppp-hover-reveal {
  opacity: 1;
  pointer-events: auto;
}

Applied to:
  - .ppp-dt-row  → .ppp-dt-row-actions    (row action bar)
  - .ppp-widget  → .ppp-widget-toolbar    (widget toolbar)
  - .ppp-widget  → .ppp-widget-drag-handle (drag cursor)
  - .ppp-board-card → .ppp-card-actions   (card action buttons)
  - .ppp-dt-header-cell → .ppp-col-menu-btn (column menu trigger)
```

### 4.3 Toolbar Pill Pattern

```
Filter pill anatomy:
  ┌──────────────────────────────┐
  │  [icon] field  op  value [×] │
  │  Status  =  ● Active     ×   │
  └──────────────────────────────┘

  background: var(--ppp-db-surface-raised)
  border: var(--ppp-border-thin)
  border-radius: var(--ppp-radius-xl)  [full-pill]
  padding: var(--ppp-space-1) var(--ppp-space-3)
  font: var(--ppp-font-sm)
  gap: var(--ppp-space-1)

  hover state: background var(--ppp-db-surface-hover)
  active filter: border-color var(--ppp-color-accent)
  count badge: accent background, white text, border-radius: 999px
```

### 4.4 View Tab Pattern

```
Tab strip anatomy:
  ┌──────┐ ┌───────┐ ┌──────────┐ ┌─────────┐ ┌─────┐
  │Table │ │ Board │ │ Calendar │ │ Gallery │ │  +  │
  └──────┘ └───────┘ └──────────┘ └─────────┘ └─────┘
     ●                                              ← active: border-bottom 2px accent

  overflow-x: auto
  scroll-snap-type: x mandatory
  scroll-snap-align: start (each tab)
  -webkit-overflow-scrolling: touch

  Tab: no background; padding var(--ppp-space-2) var(--ppp-space-3)
  Active: border-bottom 2px solid var(--ppp-color-accent); color text-primary
  Hover: background var(--ppp-db-surface-hover); border-radius var(--ppp-radius-sm) var(--ppp-radius-sm) 0 0
  + button: icon-only, dotted border, opens view type picker
```

### 4.5 Select/Status Tag Pattern

```
Select tag anatomy (inline in cells):
  ┌─────────────┐
  │ ● Active    │  background: var(--ppp-select-color-N) @ 15% opacity
  └─────────────┘  color: var(--ppp-select-color-N)
                   border-radius: var(--ppp-radius-sm)
                   padding: 1px var(--ppp-space-2)
                   font: var(--ppp-font-sm) 500

Status dot: ::before { content: "●"; font-size: 8px; margin-right: 4px }

Status semantic mapping:
  "active" / "in progress" / "open"  → --ppp-color-success (green dot)
  "review" / "pending"               → --ppp-color-warning (amber dot)
  "done" / "closed" / "complete"     → text-muted (grey dot)
  "blocked" / "error"                → --ppp-color-error (red dot)
  other                              → accent color
```

---

## 5. UI Layer Architecture — Full Stack View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: USER INTERACTION SURFACE                                       │
│                                                                          │
│  Mouse events → PointerEvents API                                        │
│  Keyboard → keydown handlers in DataTableView, BoardView                 │
│  Drag → svelte-dnd-action (widgets) + native HTML5 DnD (rows, columns)  │
│  Touch → pointer events (coarse device detection via $isCoarsePointer)  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 4: COMPONENT LAYER (Svelte 3.59.2)                               │
│                                                                          │
│  WidgetShell                → layout shell, unified for all widgets      │
│  DatabaseCallWidget         → primary data atom (#database-call)         │
│    ├── ViewTabBar           → tab strip (Table/Board/Calendar/Gallery)   │
│    ├── DataTableView        → CSS Grid table, virtual scroll             │
│    ├── BoardView            → horizontal Kanban scroll                   │
│    ├── CalendarView         → calendar engine adapter                    │
│    ├── GalleryView          → card grid                                  │
│    └── SubBasePanel         → Матрёшка: nested record context            │
│  ChartWidget                → bar/line/pie/donut                         │
│  StatsWidget                → auto-fill card grid                        │
│  FilterTabsWidget           → canvas-level scope filter                  │
│  ChecklistWidget            → progress bar list                          │
│  TextWidget / DividerWidget / CoverBannerWidget                          │
│                                                                          │
│  SlideInPanel               → record expand panel                        │
│  FilterPanel                → unified filter at all levels               │
│  EmptyState                 → shared empty state component               │
│  SelectionBadge             → shows active canvas selection              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ reads/writes
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 3: STATE LAYER (Svelte stores + context)                          │
│                                                                          │
│  canvasSelectionStore       → per-canvas Selection Bus (setContext)      │
│  dataProviderRegistry       → per-canvas widget data registration        │
│  transformCache             → memoised transform results                 │
│  filterStore                → active filter state per widget             │
│                                                                          │
│  Reactive chain:                                                         │
│  selectionBus.select(A, id)                                              │
│    → $: linkedFilter derived in Block B                                  │
│    → filterEvaluator(frame, [userFilter, linkedFilter])                  │
│    → Block B re-renders with filtered data                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ calls
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 2: DASHBOARD ENGINE  (src/lib/dashboard-engine/)                  │
│                                                                          │
│  transformExecutor          → applies sort/group/filter pipeline         │
│  aggregation                → sum/avg/count/min/max per group            │
│  chartDataPipeline          → frame → chart series data                  │
│  conditionalFormat          → per-row/cell format rules                  │
│  formulaEngine              → evaluates Formula fields                   │
│  relationResolver           → resolves Relation + Rollup fields          │
│  virtualScroll              → visible row window calculation             │
│                                                                          │
│  filterEvaluator (lib/engine/) ← CANONICAL filter engine (never duplicate) │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ reads
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 1: DATA LAYER  (src/lib/)                                         │
│                                                                          │
│  DataSource                 → folder | tag | dataview | native-query     │
│  DataFrame / DataRecord     → in-memory table representation             │
│  DataFieldType              → String|Number|Boolean|Date|List|Select|    │
│                               Status|Formula|Relation|Rollup|            │
│                               AutoTime|UniqueId|Unknown                  │
│  frontmatterParser          → markdown frontmatter ↔ DataRecord          │
│  relations/crossSubBase     → bidirectional relation resolution          │
│                                                                          │
│  Vault events → Obsidian metadata cache → externalFrameInvalidation     │
│                                       → all DataSource subscribers       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ lives on
┌──────────────────────────────▼──────────────────────────────────────────┐
│  LAYER 0: OBSIDIAN PLATFORM                                              │
│                                                                          │
│  Vault (filesystem)         Plugin API    Metadata cache    Workspace    │
│  Markdown files (frontmatter + body)      TFile / TFolder                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Design Gaps — Priority Matrix

Gap analysis: что осталось до полного Notion-parity.

| Gap | Notion Has | We Have | Priority | Ticket |
|---|---|---|---|---|
| **Inline cell editing** | Click cell → edit in place | Click → SlideIn modal | P0 | **#051 scope** (включён в DataTable rebuild) |
| **Row action bar on hover** | ⊕ ↗ ⋯ on row hover | Nothing | P0 | #051 scope |
| **+ New row (inline at bottom)** | Always visible at table bottom | Only in toolbar | P1 | #051 scope |
| **Column header context menu** | Full property edit/sort/filter menu | Partial | P1 | #051 scope |
| **Column drag reorder** | Drag column headers | Not supported | P2 | Post-#051 |
| **Row drag reorder** | Drag rows (in non-sorted view) | Not supported | P3 | TBD |
| **Board: collapse column** | Click to collapse | Not supported | P3 | TBD |
| **Board: column limit** | WIP limit on board column | Not supported | P3 | TBD |
| **Empty states** | Friendly prompts everywhere | Blank or minimal | P1 | EmptyState.svelte component |
| **Select option editor** | Click tag → color picker inline | Modal | P1 | TBD |
| **Relation picker popup** | Type to search linked records | Partial | P1 | TBD |
| **View filter pills in toolbar** | Clean dismissable pills | Old FilterBridge | P0 | #050+#055 scope |
| **Properties toggle panel** | Lightweight sidebar toggle | Heavy settings | P2 | #052 scope |
| **Gallery: configurable cover** | Click to change cover field | Fixed | P2 | TBD |
| **Search in view** | ⌘F within the view | Only Obsidian global | P2 | TBD |
| **URL / Email property types** | Distinct types with validation | No type, String only | P3 | TBD |
| **Slash-create block** | /database /table /divider | Toolbar only | P2 | TBD |

---

## 7. Component Sizing Constraints

```
COMPONENT              LOC BUDGET    CURRENT     STATUS
─────────────────────────────────────────────────────────
DashboardCanvas.svelte   ≤ 200       ✅ 200      INVARIANT
WidgetHost.svelte        → archive   947         #052 replaces with WidgetShell
WidgetShell.svelte       ≤ 350       (new)       #052
DatabaseCallWidget       ≤ 400       ~380        ✅
DataTableView            ≤ 400       ~1843 LOC   #051 critical
DataTableContent         ≤ 200       —           part of #051 decomposition
BoardView                ≤ 300       ✅          —
CalendarView             ≤ 250       ✅          —
GalleryView              ≤ 200       ✅          —
ChartWidget              ≤ 300       ~220        ✅ moderate refactor in #053
StatsWidget              ≤ 200       ~160        ✅ minor refactor in #054
FilterPanel.svelte       ≤ 250       ~130        ✅
SlideInPanel.svelte      ≤ 400       ~280        ✅
FilterRow.svelte         ≤ 80        ~60         ✅
ViewTabBar.svelte        ≤ 100       ~90         ✅
EmptyState.svelte        ≤ 60        (new)       create in #051
RowActionBar.svelte      ≤ 80        (new)       create in #051
```

---

## 8. Design Principles Checklist (before shipping any UI work)

```
[ ] Token usage: zero hardcoded px/hex in new code — all via --ppp-* vars
[ ] Hover states: all interactive elements have hover/focus state defined
[ ] Empty state: all views have EmptyState component wired
[ ] Loading state: data blocks show skeleton or spinner while fetching
[ ] Accessibility: focus-visible ring on all interactive elements
[ ] Keyboard nav: Tab order logical, Escape cancels/closes, Enter confirms
[ ] Mobile/coarse pointer: min hit area 44px (var(--ppp-touch-target))
[ ] No position:absolute in widget content (use CSS Grid/Flexbox)
[ ] No z-index magic numbers (use --ppp-z-* scale)
[ ] svelte-check 0 warnings on component
[ ] PX-budget ratchet check if CSS touched
```

---

## 9. Reference: Notion Visual DNA (что копируем)

```
ELEMENT              NOTION SPEC                 OUR TOKEN
──────────────────────────────────────────────────────────────────
Page background      #ffffff / #191919 dark      --background-primary
Database header      slightly off-page bg        --background-secondary
Row height           36px default                --ppp-db-row-height-default
Row hover bg         rgba(55,53,47,.06) light     --ppp-db-surface-hover
Row selected bg      rgb(35,131,226,.14) blue     --ppp-db-surface-selected
Border color         rgba(55,53,47,.16)           --background-modifier-border
Text primary         rgb(55,53,47)               --text-normal
Text secondary       rgba(55,53,47,.65)          --text-muted
Text placeholder     rgba(55,53,47,.40)          --text-faint
Font family          -apple-system, Segoe UI     --font-text (Obsidian native)
Font size base       14px (0.875rem)             --font-text-size (Obsidian)
Property icon size   16px                        1rem (Lucide default)
Tab strip height     40px                        2.5rem
Toolbar height       36px                        2.25rem
Board card radius    3px                         --ppp-radius-sm (4px)
Panel shadow         0 4px 12px rgba(15,15,15,.1) --ppp-shadow-md
Filter pill height   28px                        1.75rem
```

---

*Документ является живым — обновляется по мере реализации M-UI-MODERNIZATION тикетов #050–#058.*

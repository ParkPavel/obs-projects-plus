# Database View v3.4.0 — Comprehensive Specification

> **Status**: Draft  
> **Created**: 2026-04-16  
> **Scope**: Full modernization of Database View to become the primary visual-mathematical interface  
> **Replaces**: Table View (deprecated in v3.3.2, auto-migration active)

---

## Table of Contents

1. [Vision & Design Philosophy](#1-vision--design-philosophy)
2. [Competitive Analysis](#2-competitive-analysis)
3. [Gap Analysis: Current State vs Vision](#3-gap-analysis)
4. [User Personas & Scenarios](#4-user-personas--scenarios)
5. [Widget Architecture & Specifications](#5-widget-architecture--specifications)
6. [Formula Engine Modernization](#6-formula-engine-modernization)
7. [Canvas Layout System](#7-canvas-layout-system)
8. [Data Pipeline Enhancements](#8-data-pipeline-enhancements)
9. [UI/UX Specifications & Wireframes](#9-uiux-specifications--wireframes)
10. [Accessibility & Mobile](#10-accessibility--mobile)
11. [Performance Budgets](#11-performance-budgets)
12. [Migration & Backward Compatibility](#12-migration--backward-compatibility)
13. [Implementation Waves](#13-implementation-waves)

---

## 1. Vision & Design Philosophy

### Core Principle
Database View is a **visual mathematical constructor** — a canvas where users compose analytical dashboards from modular widgets, each powered by a unified data pipeline. It replaces the Table View entirely and becomes the primary way to visualize, compute, and interact with project data.

### Design Tenets

| # | Tenet | Meaning |
|---|-------|---------|
| T1 | **Modular Canvas** | Every tool (table, chart, stats, checklist) is an independent widget that can be added, removed, resized, and rearranged. The canvas is a grid-based layout with adaptive widget sizing. |
| T2 | **Visual Formula Stacking** | Formulas are not hidden in cell editors — they are visible, composable, and editable through a visual pipeline. Users build data transformations by stacking steps, not writing code. |
| T3 | **Notion-like Power, Obsidian Philosophy** | We match Notion's formula depth and Airtable's interface flexibility, but adapt everything to Obsidian's local-first, markdown-based, vault-centric model. No cloud API calls, no user accounts. |
| T4 | **Progressive Disclosure** | Simple use cases (table + sort + filter) require zero configuration. Advanced features (pivot tables, financial functions, cross-project merge) are discoverable but never in the way. |
| T5 | **One Source of Truth** | All widgets on a canvas share the same DataFrame. Pipeline transforms can diverge per-widget, but the source data is always the project's DataSource. |

### Obsidian-Specific Adaptations

Unlike Notion/Airtable/Coda, our context is:

| Aspect | Cloud tools (Notion/Airtable) | Our adaptation |
|--------|-------------------------------|----------------|
| Data model | Proprietary database | Markdown files with YAML frontmatter |
| Record = | Row in DB | .md file in folder / tag group / Dataview query result |
| Properties = | Typed columns | YAML frontmatter keys (string, number, date, boolean, list) |
| Relations | Built-in link-to-record | `[[wikilinks]]` resolved by RelationResolver |
| Rollups | Built-in aggregation | RollupEngine over resolved relations |
| Formula store | Per-cell in DB | Per-field in DatabaseViewConfig (stored in project settings JSON) |
| Collaboration | Real-time multi-user | Single-user, local vault |
| API calls | Cloud endpoints | None. Pure in-memory computation |
| File system | Abstracted | Direct access via Obsidian Vault API |

---

## 2. Competitive Analysis

### 2.1 Notion Databases

**Strengths adopted:**
- Every item is a page → every record is a .md file (native to us)
- Formula property with rich editor showing live preview
- Relations & rollups between databases
- style() function for colored/bold formula output  
- `.every()`, `.first()`, `.filter()` list methods
- Ternary operator support in formulas
- Views: Table, Board, Calendar, Gallery, List, Timeline, Chart

**Not adopted (incompatible):**
- AI formula generation (requires cloud)
- Real-time collaboration conflicts
- Database automations (triggers/actions)

### 2.2 Airtable Interface Designer

**Strengths adopted:**
- Interface = visual dashboard of widgets on a canvas ← **our DatabaseViewCanvas**
- 6 visualization types (List, Gallery, Kanban, Calendar, Timeline, Grid)
- Record coloring by conditions ← **our conditional formatting**
- Row height options (short/medium/tall/extra tall) ← **our compact/default/expanded**
- Inline editing with add/delete records
- Progressive disclosure in configuration
- Filter tabs/dropdowns for end-user filtering
- CSV export from interfaces

**Key insight:** Airtable separates "base" (data layer) from "interface" (presentation layer). We do the same: DataSource = base, DatabaseView = interface.

**Not adopted:**
- Roadmap visualization (enterprise feature, niche)
- Collaborator field type (single-user)
- Button field type (no backend actions)

### 2.3 Coda

**Strengths adopted:**
- 200+ formula library organized by category (Collections, Dates, Duration, Filters, Formats, Info, Lists, Logical, Math, Misc, People, Relational, RichText, Shape, Spatial, String, Actions)
- Conditional aggregation: `AverageIf`, `CountIf`, `SumIf`
- Local variables in formulas: `Let(value, name, expression)` / `WithName`
- Duration type: `Days()`, `Hours()`, `Minutes()`, `Seconds()`, `ToDays()`, etc.
- Business day calculations: `NetWorkingDays`, `Workday`
- Currency formatting: `FormatCurrency(code, value, format, precision)`
- Statistical depth: `Mode`, `Percentile`, `PercentileRank`, `Rank`, `StandardDeviation` (sample), `StandardDeviationPopulation`
- List iteration: `ForEach(list, formula)`, `All()`, `Any()`
- Rich content formulas: `Image()`, `Hyperlink()`, `Embed()`

**Key insight:** Coda treats formulas as a full programming language with Actions (side effects). We adopt computation depth but NOT side effects — our formulas are pure functions.

**Not adopted:**
- Action formulas (AddRow, ModifyRows, DeleteRows) — violates local-first principle
- Packs (third-party integrations)
- Cross-document references
- User/collaborator functions

### 2.4 Competitive Feature Matrix

| Feature | Notion | Airtable | Coda | Ours (v3.3.2) | Target (v3.4.0) |
|---------|--------|----------|------|---------------|-----------------|
| Formula functions | ~40 | ~100 | 200+ | 42 | 80+ |
| Financial functions | 0 | 0 | 0 | 0 | 11 (PMT,FV,PV,NPV,IRR,RATE,IPMT,PPMT,NPER,CUMPRINC,CUMIPMT) |
| Statistical functions | 4 | ~10 | 12 | 1 (STD_DEV) | 8 (VARIANCE,PERCENTILE,QUARTILE,CORREL,MODE,RANK,STD_DEV_S,STD_DEV_P) |
| Conditional aggregation | via filter | limited | ✅ | ✗ | ✅ (SumIf,CountIf,AverageIf) |
| Duration type | ✗ | ✅ | ✅ | ✗ | ✅ |
| Local variables in formulas | ✗ | ✗ | ✅ | ✗ | ✅ (LET) |
| List iteration | `.filter()` | ✗ | `ForEach` | ✗ | ✅ (MAP,FILTER,REDUCE) |
| Relative date filters | limited | ✅ | ✅ | ✗ | ✅ (8 operators) |
| Widget canvas | ✗ | ✅ | partial | ✅ (6 widgets) | ✅ (8 widgets) |
| Widget resize | ✗ | fixed layouts | ✗ | grid-based | free-resize within grid |
| Cross-source merge | linked DB | ✅ | cross-doc | ✗ | ✅ (UNION, LEFT JOIN) |
| Scatter/correlation chart | ✗ | extension | ✗ | ✗ | ✅ |
| Inline add row | ✅ | ✅ | ✅ | ✗ | ✅ |
| Dataview integration | N/A | N/A | N/A | TABLE only | TABLE+LIST+TASK |
| Formula visual editor | ✗ | ✗ | ✗ | ✅ (2 levels) | ✅ (recursive, unlimited) |
| Pipeline visual editor | ✗ | ✗ | ✗ | ✅ | ✅ (enhanced) |

---

## 3. Gap Analysis

### 3.1 Original Vision vs Current State

| Vision Element | Status | Gap |
|---------------|--------|-----|
| "Полностью заменить табличный вид" | ✅ Done | Table deprecated, auto-migration works |
| "Визуальный математический интерфейс" | ⚠️ Partial | 42 formulas exist but COMPUTE step limited to ±×÷, no financial/statistical depth |
| "Конструктор с вызываемыми модулями" | ⚠️ Partial | 6 widget types exist but DataTable limited to 1, resizing is grid snap only |
| "Рамку каждого элемента можно адаптивно изменять" | ⚠️ Partial | Grid-based sizing (minW/minH), not freeform drag-resize |
| "Таблицы с регулируемыми потоками" | ⚠️ Partial | PipelineEditor exists but COMPUTE→FormulaEngine not unified |
| "Математические методы и формулы через визуальный стекинг" | ⚠️ Partial | FormulaVisualEditor exists but max 2 nesting levels |
| "Диаграммы" | ✅ Done | 9 chart types (bar, line, area, pie, donut, number, progress, stacked, horizontal bar) |
| "Статистика" | ⚠️ Partial | StatsWidget exists but only STD_DEV, no VARIANCE/PERCENTILE/CORREL |
| "Универсальные модели сравнений" | ⚠️ Partial | ComparisonWidget exists but only 2 metrics, static layout |
| "Чеклисты, тудулисты" | ✅ Done | ChecklistWidget with wiki-link support |
| "Вывод (ViewPort) в мини окнах других видов" | ✅ Done | ViewPortWidget (max 4), links to Board/Calendar/Gallery |

### 3.2 Critical Gaps (Must Fix for v3.4.0)

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| P0 | COMPUTE→FormulaEngine unification (A2) | Blocks all formula-based transforms | M |
| P0 | ViewConfigTab i18n (U1, ~40 hardcoded strings) | Blocks non-Russian users | S |
| P1 | Financial functions (A6, 11 functions) | Blocks finance/budget use cases | M |
| P1 | Statistical functions (7 new) | Blocks analytics use cases | M |
| P1 | Relative date filters (A9, 8 operators) | Blocks dynamic dashboards | S |
| P1 | Shared PopoverDropdown (U6) | 3× code duplication, blocks U4/U9/A5 | S |
| P2 | Recursive FormulaVisualEditor (U11) | Complex formulas uneditable visually | M |
| P2 | Project Quick-Switcher (U4) | 3 clicks → 1 click | S |
| P2 | Scatter/Correlation chart (A7) | No X-vs-Y analytics | M |
| P2 | Cross-project merge (A1) | No multi-source dashboards | L |
| P2 | Dataview LIST/TASK (A3) | Incomplete Dataview integration | M |
| P3 | Inline add row (A8) | Missing Notion-like UX | S |
| P3 | ARIA accessibility (U5, U7) | Keyboard-only users blocked | M |
| P3 | Dataview DateTime precision (A4) | Time data truncated | S |

Size: S = <200 LOC, M = 200-800 LOC, L = 800+ LOC

---

## 4. User Personas & Scenarios

### 4.1 Personas

#### P1: Project Manager (Elena)
- **Context**: Manages 3-5 Obsidian projects (software features, bug tracking, releases)
- **Needs**: Quick overview of all projects, status distribution, overdue items, burndown metrics
- **Technical level**: Moderate — uses filters/sorts but avoids raw formulas
- **Key frustration**: Switching between projects takes 3 clicks; no way to see cross-project metrics

#### P2: Financial Analyst (Mikhail)
- **Context**: Personal investment tracking, loan amortization, budget allocation
- **Needs**: PMT/FV/NPV calculations, currency formatting, percentage columns, pivot tables
- **Technical level**: High — thinks in spreadsheet formulas, wants Excel-like power
- **Key frustration**: No financial functions; COMPUTE limited to ±×÷; no conditional aggregation

#### P3: Academic Researcher (Anna)
- **Context**: Literature review database, experiment tracking, data analysis
- **Needs**: Statistical functions (correlation, percentile, standard deviation), scatter plots, Dataview queries
- **Technical level**: Moderate-High — uses Dataview, needs LIST/TASK support
- **Key frustration**: Only STD_DEV available; Dataview queries limited to TABLE; no scatter chart

#### P4: Content Creator (Dima)
- **Context**: Content calendar, editorial pipeline, checklist tracking
- **Needs**: Visual board, quick-add, status checklists, timeline, relative dates ("this week")
- **Technical level**: Low — expects Notion-like simplicity
- **Key frustration**: No relative date filters; inline add row missing; 40 hardcoded Russian strings

#### P5: Team Lead (Sara)
- **Context**: Sprint planning, resource allocation, multi-project tracking
- **Needs**: Cross-project dashboards, comparison widgets, working day calculations
- **Technical level**: High — configures complex pipelines and views
- **Key frustration**: No cross-project merge; ComparisonWidget only handles 2 metrics; no working day functions

### 4.2 User Scenarios (Detailed)

#### Scenario 1: Financial Dashboard (Mikhail)
```
GIVEN Mikhail has a project "Investment Portfolio" with notes containing:
  - ticker (text), purchase_price (number), current_price (number), 
    shares (number), purchase_date (date), category (select)
    
WHEN he opens Database View and creates a dashboard:
  1. Adds DataTable widget showing all holdings
  2. Adds a COMPUTE step with formula:
     gain = (current_price - purchase_price) * shares
     gain_pct = (current_price - purchase_price) / purchase_price * 100
     annual_return = IRR(purchase_date, current_price * shares, purchase_price * shares)
  3. Adds PieChart grouped by category, showing SUM(gain)
  4. Adds StatsWidget with:
     - Total portfolio value: SUM(current_price * shares)
     - Best performer: MAX(gain_pct)
     - Average annual return: AVG(annual_return)
  5. Adds ComparisonWidget: Category A vs Category B total gain

THEN the dashboard updates live as he edits note frontmatter
AND all formulas resolve in <100ms for 500 records
AND currency values display with proper formatting ($1,234.56)
```

**Requirements surfaced:**
- [R1] COMPUTE step must support FormulaEngine functions (IRR, SUM, AVG)
- [R2] FormatCurrency/FormatNumber functions needed
- [R3] StatsWidget must support computed fields, not just raw fields
- [R4] ComparisonWidget should support N metrics, not just 2

#### Scenario 2: Academic Analysis (Anna)
```
GIVEN Anna has a Dataview query pulling experiment results:
  TABLE trial, measurement, group, date FROM "experiments"
  WHERE group = "control" OR group = "treatment"

WHEN she opens Database View:
  1. DataTable shows query results with all fields
  2. She adds a COMPUTE step:
     z_score = (measurement - AVG(measurement)) / STD_DEV(measurement)
  3. She adds a scatter chart: X = trial, Y = measurement, color = group
     with trend line and R² displayed
  4. She adds StatsWidget:
     - CORREL(control.measurement, treatment.measurement)
     - PERCENTILE(measurement, 0.95)
     - T-statistic (computed formula)

THEN she can visually identify outliers on the scatter plot
AND the correlation value updates when new experiment notes are added
AND Dataview DateTime preserves HH:mm (not truncated to YYYY-MM-DD)
```

**Requirements surfaced:**
- [R5] Scatter chart with X vs Y, color dimension, trend line, R²
- [R6] CORREL, PERCENTILE, STD_DEV (sample + population) functions
- [R7] Dataview DateTime precision (A4)
- [R8] Cross-record reference in COMPUTE (AVG over entire column)

#### Scenario 3: Sprint Planning (Sara)
```
GIVEN Sara has 3 projects: "Backend", "Frontend", "Infra"
  Each has notes with: task (text), status (select), assignee (text),
  estimate_hours (number), deadline (date), priority (select)

WHEN she creates a cross-project dashboard:
  1. DataSource = multi-source merge of all 3 projects (UNION ALL)
  2. DataTable with GROUP BY project + status
  3. Chart: stacked bar, X = project, Y = count, stack = status
  4. StatsWidget: 
     - Overdue tasks: CountIf(deadline < TODAY() AND status != "Done")
     - Remaining hours: SumIf(estimate_hours, status != "Done")
     - Completion rate: CountIf(status == "Done") / Count(*)
  5. Filter tab: "This sprint" = deadline is-within-this-week
  6. ViewPort: mini Board view of "Backend" project

THEN she sees all projects in one dashboard
AND switching filter tab shows only current sprint tasks
AND clicking a record opens the .md note
```

**Requirements surfaced:**
- [R9] Multi-source merge (A1) with UNION ALL
- [R10] Conditional aggregation: CountIf, SumIf, AverageIf
- [R11] Relative date filters: this-week, this-month, last-N-days, next-N-days
- [R12] Filter tabs (user-facing quick filters)
- [R13] Cross-record formulas in COMPUTE (reference to full column)

#### Scenario 4: Content Calendar (Dima)
```
GIVEN Dima has a project "Blog Posts" with notes containing:
  title, status (draft/review/published), publish_date, word_count, category

WHEN he uses Database View:
  1. DataTable with all posts, sorted by publish_date DESC
  2. He clicks "+ New" at bottom of table → creates new .md note inline
  3. He types title, sets status = "draft", publish_date = next Monday
  4. He filters: "This month" → sees only current month's posts
  5. StatsWidget: Total word count, Posts per week, Average word count
  6. ViewPort: Calendar view showing publish_date timeline

THEN adding a new post is 1-click (not navigating away)
AND "This month" filter auto-updates as time passes
AND all strings are in his language (ru/en/uk/zh-CN)
```

**Requirements surfaced:**
- [R14] Inline add row (A8) — creates .md file + opens edit
- [R15] All UI strings localized (U1 fix)
- [R16] Relative date filters in UI

#### Scenario 5: Quick Project Switching (Elena)
```
GIVEN Elena has 5 configured projects and is viewing "Q2 Features"

WHEN she wants to check "Bug Tracker":
  Current: Click view config → scroll → select project → apply (3+ clicks)
  Target: Click project name in navbar → dropdown shows all projects → click (1 click)

THEN project switches instantly with no page reload
AND the view configuration is preserved per-project
AND dropdown shows project icon + record count
```

**Requirements surfaced:**
- [R17] Project Quick-Switcher (U4)
- [R18] Shared PopoverDropdown component (U6)

#### Scenario 6: Formula Power User (Mikhail)
```
GIVEN Mikhail wants to create a loan amortization schedule

WHEN he adds COMPUTE columns:
  monthly_payment = PMT(annual_rate/12, term_months, -principal)
  interest_part = IPMT(annual_rate/12, period, term_months, -principal)
  principal_part = PPMT(annual_rate/12, period, term_months, -principal)
  remaining = principal - CUMPRINC(annual_rate/12, term_months, principal, 1, period)

AND he creates a formula using the visual editor:
  1. Clicks "Add formula" → function picker opens
  2. Types "PMT" → autocomplete shows PMT(rate, nper, pv, [fv], [type])
  3. Uses keyboard (Arrow Down → Enter) to select
  4. Nested IF: IF(remaining > 0, monthly_payment, remaining + interest_part)
  5. Visual editor shows full tree with infinite nesting

THEN the visual editor renders all nesting levels (not capped at 2)
AND autocomplete navigates with keyboard (ArrowUp/Down/Enter/Escape)
AND PMT/IPMT/PPMT/CUMPRINC all compute correctly
```

**Requirements surfaced:**
- [R19] 11 financial functions
- [R20] Recursive FormulaVisualEditor (U11)
- [R21] Formula autocomplete with keyboard nav (U9)

### 4.3 Requirements Traceability

| Req | Description | Source Scenario | Maps to Issue |
|-----|-------------|-----------------|---------------|
| R1 | COMPUTE → FormulaEngine unification | S1, S2 | A2 |
| R2 | FormatCurrency, FormatNumber | S1 | New |
| R3 | StatsWidget computed fields | S1 | Enhancement |
| R4 | ComparisonWidget N metrics | S1 | Enhancement |
| R5 | Scatter chart with trend line | S2 | A7 |
| R6 | CORREL, PERCENTILE, STD_DEV_S/P | S2 | New |
| R7 | Dataview DateTime precision | S2 | A4 |
| R8 | Cross-record formulas in COMPUTE | S2, S3 | Enhancement |
| R9 | Multi-source merge | S3 | A1 |
| R10 | CountIf, SumIf, AverageIf | S3 | New |
| R11 | Relative date filters (8 operators) | S3, S4 | A9 |
| R12 | Filter tabs (user quick-filters) | S3 | New |
| R13 | Cross-record reference in COMPUTE | S3 | Enhancement |
| R14 | Inline add row | S4 | A8 |
| R15 | ViewConfigTab i18n | S4 | U1 |
| R16 | Relative date filters in UI | S4 | A9 |
| R17 | Project Quick-Switcher | S5 | U4 |
| R18 | Shared PopoverDropdown | S5 | U6 |
| R19 | 11 financial functions | S6 | A6 |
| R20 | Recursive FormulaVisualEditor | S6 | U11 |
| R21 | Formula autocomplete keyboard nav | S6 | U9 |

---

## 5. Widget Architecture & Specifications

### 5.1 Widget System Overview

```
┌─────────────────────────────────────────────────────┐
│                DatabaseViewCanvas                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ WidgetHost│ │ WidgetHost│ │ WidgetHost│            │
│  │ ┌────────┐│ │ ┌────────┐│ │ ┌────────┐│           │
│  │ │DataTable││ │ │Chart   ││ │ │Stats   ││           │
│  │ │Widget  ││ │ │Widget  ││ │ │Widget  ││           │
│  │ └────────┘│ │ └────────┘│ │ └────────┘│           │
│  └──────────┘ └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ WidgetHost│ │ WidgetHost│ │ WidgetHost│            │
│  │ ┌────────┐│ │ ┌────────┐│ │ ┌────────┐│           │
│  │ │Compare ││ │ │Checklist││ │ │ViewPort││           │
│  │ │Widget  ││ │ │Widget  ││ │ │Widget  ││           │
│  │ └────────┘│ │ └────────┘│ │ └────────┘│           │
│  └──────────┘ └──────────┘ └──────────┘             │
└─────────────────────────────────────────────────────┘
```

### 5.2 Widget Registry (Current + New)

| Widget | Type ID | Min Grid | Max Count | v3.3.2 | v3.4.0 Changes |
|--------|---------|----------|-----------|--------|----------------|
| DataTable | `data-table` | 4×3 | 1 | ✅ | + inline add row, + frozen columns UX |
| Chart | `chart` | 3×3 | ∞ | ✅ | + scatter type, + trend line, + R² label |
| Stats | `stats` | 3×2 | ∞ | ✅ | + computed field support, + sparkline option |
| Comparison | `comparison` | 3×2 | ∞ | ✅ | + N metrics (was 2), + percentage mode |
| Checklist | `checklist` | 3×2 | ∞ | ✅ | + progress bar, + drag reorder |
| ViewPort | `viewport` | 3×3 | 4 | ✅ | + sync scroll position, + filter bridge |
| **FilterTabs** | `filter-tabs` | 6×1 | 1 | **NEW** | User-facing quick filter tabs |
| **SummaryRow** | `summary-row` | 4×1 | 1 | **NEW** | Compact aggregation bar (like Airtable footer) |

### 5.3 DataTable Widget Enhancement

#### Current Capabilities
- Sort, group, pin/hide columns, aggregate footer, virtual scroll, conditional formatting
- Edit inline (opens EditNoteModal), create field
- Row height: compact (28px), default (32px), expanded (48px)

#### v3.4.0 Additions

**Inline Add Row (R14)**
```
┌────────────────────────────────────────────────┐
│ Name          │ Status  │ Due Date   │ Priority│
├────────────────────────────────────────────────┤
│ Task Alpha    │ ✅ Done │ 2026-04-10 │ High    │
│ Task Beta     │ 🔄 WIP │ 2026-04-15 │ Medium  │
├────────────────────────────────────────────────┤
│ + New record  │         │            │         │  ← click to add
└────────────────────────────────────────────────┘
```

Behavior:
1. Click "+ New record" row → creates new .md file in project folder
2. File name = auto-generated from template or user input
3. Default frontmatter populated from project field definitions
4. Focus moves to first editable cell in new row
5. Pressing Escape before typing discards the new file

Implementation:
- New component: `InlineAddRow.svelte` (~60 LOC)
- Uses existing `api.createRecord()` from RecordAPI
- Template selection from project settings

**Frozen Columns Enhancement**
- Current: `freezeUpTo` config exists but UX is settings-only
- v3.4.0: Drag column border to freeze/unfreeze visually
- Visual indicator: double vertical line separator between frozen and scrollable

### 5.4 Chart Widget Enhancement

#### New Chart Type: Scatter/Correlation (R5)

```
    ▲ Y-axis (measurement)
    │        ●  ●
    │     ●    ╱   ● 
    │   ●   ╱  ●     ●
    │  ● ╱    ●
    │ ╱●  ●        Trend line: y = 0.85x + 12.3
    │╱   ●          R² = 0.73
    └──────────────────► X-axis (trial)
    
    Legend: ● Control  ● Treatment
```

Config interface:
```typescript
interface ScatterChartConfig {
  xAxis: { field: string };
  yAxis: { field: string };
  colorBy?: string;           // field for point coloring
  sizeBy?: string;            // field for point sizing
  showTrendLine: boolean;
  showR2: boolean;
  pointRadius: number;        // 3-8px
  opacity: number;            // 0.3-1.0
}
```

#### Chart Type Summary (v3.4.0)

| Type | X | Y | Color | Trend | R² |
|------|---|---|-------|-------|-----|
| bar | categorical | numeric | optional | ✗ | ✗ |
| horizontal-bar | numeric | categorical | optional | ✗ | ✗ |
| stacked-bar | categorical | numeric | stack field | ✗ | ✗ |
| line | categorical/date | numeric | optional series | ✗ | ✗ |
| area | categorical/date | numeric | optional series | ✗ | ✗ |
| pie/donut | categorical | numeric (size) | auto | ✗ | ✗ |
| number | N/A | N/A | N/A | ✗ | ✗ |
| progress | N/A | numeric (0-1) | N/A | ✗ | ✗ |
| **scatter** | numeric | numeric | optional | ✅ | ✅ |

### 5.5 Stats Widget Enhancement

#### Computed Field Support (R3)

Current: StatsWidget only references raw DataFrame fields.
v3.4.0: StatsWidget cards can reference computed expressions.

```typescript
interface StatsCard {
  label: string;
  field: string;              // raw field name
  expression?: string;        // formula expression (new)
  aggregation: AggregationType;
  format: 'number' | 'percent' | 'currency';
  currencyCode?: string;      // new: 'USD', 'EUR', 'RUB'
  trend?: 'up-good' | 'down-good' | 'neutral';
  sparkline?: boolean;        // new: mini inline chart
}
```

#### Sparkline Option

```
┌─────────────────┐ ┌─────────────────┐
│ Total Revenue   │ │ Task Completion  │
│ $42,350         │ │ 73%             │
│ ▁▂▃▅▆▇█▇▆▅     │ │ ▂▃▄▅▆▇████      │
│ ↑ 12% vs prev  │ │ ↑ 8% vs prev    │
└─────────────────┘ └─────────────────┘
```

Implementation: Inline SVG polyline, ~40 LOC, no external library.

### 5.6 Comparison Widget Enhancement

#### N-Metric Support (R4)

Current: 2 metrics (metricA, metricB), static layout.
v3.4.0: N metrics with configurable comparison mode.

```typescript
interface ComparisonConfig {
  metrics: Array<{
    field: string;
    label?: string;
    color?: string;
  }>;
  mode: 'absolute' | 'percentage' | 'normalized';  // new
  orientation: 'horizontal' | 'vertical';            // new
  showDelta: boolean;                                 // new
  baselineIndex?: number;                             // new: which metric is baseline
}
```

Wireframe (4 metrics, percentage mode):
```
Revenue      ████████████████████  $50K (100%)
Expenses     ████████████         $30K (60%)
Net Income   ████████             $20K (40%)
Target       ██████████████████   $45K (90%)
                                         ▲ baseline
```

### 5.7 FilterTabs Widget (NEW — R12)

User-facing quick filter tabs at the top of canvas.

```
┌──────────────────────────────────────────────────────┐
│ [All] [This Week] [Overdue] [My Tasks] [+ Add Tab]  │
└──────────────────────────────────────────────────────┘
```

Each tab is a named FilterDefinition. Clicking a tab applies it to ALL widgets on the canvas.

```typescript
interface FilterTabsConfig {
  tabs: Array<{
    id: string;
    label: string;
    icon?: string;
    filter: FilterDefinition;
  }>;
  activeTabId: string;
  position: 'top' | 'bottom';
}
```

### 5.8 SummaryRow Widget (NEW)

Compact, always-visible aggregation bar. Alternative to Stats for simple totals.

```
┌──────────────────────────────────────────────────────┐
│ Records: 142 │ Total Hours: 1,280 │ Avg Priority: 2.3│
└──────────────────────────────────────────────────────┘
```

Config: Array of `{ field, aggregation, label, format }`.

---

## 6. Formula Engine Modernization

### 6.1 Current State: 42 Functions

| Category | Functions | Count |
|----------|-----------|-------|
| Logic | IF, IFS, SWITCH, AND, OR, NOT, EMPTY | 7 |
| Math | ROUND, CEIL, FLOOR, ABS, SQRT, POWER, LOG, SIGN, MIN, MAX | 10 |
| String | TRIM, LOWER, UPPER, LENGTH, SUBSTRING, REPLACE, CONTAINS, STARTS_WITH, ENDS_WITH, SPLIT, FORMAT | 11 |
| Date | TODAY, NOW, DATE_ADD, DATE_SUB, DATE_BETWEEN, FORMAT_DATE, PARSE_DATE, YEAR, MONTH, DAY, HOUR, MINUTE, WEEK | 13 |
| Conversion | TO_NUMBER, TO_TEXT, TO_DATE | 3 |

### 6.2 Target State: 80+ Functions

#### New Category: Financial (11 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| PMT | `PMT(rate, nper, pv, [fv], [type])` | Payment for a loan |
| FV | `FV(rate, nper, pmt, [pv], [type])` | Future value |
| PV | `PV(rate, nper, pmt, [fv], [type])` | Present value |
| NPV | `NPV(rate, values...)` | Net present value |
| IRR | `IRR(values..., [guess])` | Internal rate of return |
| RATE | `RATE(nper, pmt, pv, [fv], [type], [guess])` | Interest rate per period |
| IPMT | `IPMT(rate, per, nper, pv, [fv], [type])` | Interest portion of payment |
| PPMT | `PPMT(rate, per, nper, pv, [fv], [type])` | Principal portion of payment |
| NPER | `NPER(rate, pmt, pv, [fv], [type])` | Number of periods |
| CUMPRINC | `CUMPRINC(rate, nper, pv, start, end, type)` | Cumulative principal paid |
| CUMIPMT | `CUMIPMT(rate, nper, pv, start, end, type)` | Cumulative interest paid |

**Implementation note**: IRR uses Newton-Raphson iteration (max 100 iterations, tolerance 1e-7). All financial functions follow Excel/Google Sheets sign conventions.

#### New Category: Statistical (8 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| VARIANCE | `VARIANCE(values...)` | Population variance |
| VARIANCE_S | `VARIANCE_S(values...)` | Sample variance |
| PERCENTILE | `PERCENTILE(array, k)` | k-th percentile (0-1) |
| QUARTILE | `QUARTILE(array, quart)` | Quartile (0-4) |
| CORREL | `CORREL(array_x, array_y)` | Pearson correlation |
| MODE | `MODE(values...)` | Most frequent value |
| RANK | `RANK(value, array, [order])` | Rank of value in array |
| STD_DEV_S | `STD_DEV_S(values...)` | Sample standard deviation |

**Note**: Existing `STD_DEV` becomes alias for population std dev. New `STD_DEV_S` for sample.

#### New Category: Conditional Aggregation (3 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| SUMIF | `SUMIF(range, criteria, [sum_range])` | Sum values matching criteria |
| COUNTIF | `COUNTIF(range, criteria)` | Count values matching criteria |
| AVERAGEIF | `AVERAGEIF(range, criteria, [avg_range])` | Average values matching criteria |

**Implementation**: These operate on the full DataFrame column, not per-record. They are "aggregate formulas" — a new concept where the formula engine receives the full dataset context.

#### New Category: List/Iteration (6 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| MAP | `MAP(list, expression)` | Transform each element |
| FILTER_LIST | `FILTER_LIST(list, condition)` | Keep matching elements |
| REDUCE | `REDUCE(list, initial, accumulator)` | Fold list to single value |
| FIRST | `FIRST(list)` | First element |
| LAST | `LAST(list)` | Last element |
| NTH | `NTH(list, index)` | Element at position |

#### New Category: Duration (6 functions)

| Function | Signature | Description |
|----------|-----------|-------------|
| DAYS | `DAYS(n)` | Create duration of n days |
| HOURS | `HOURS(n)` | Create duration of n hours |
| MINUTES | `MINUTES(n)` | Create duration of n minutes |
| TO_DAYS | `TO_DAYS(duration)` | Convert duration to day count |
| TO_HOURS | `TO_HOURS(duration)` | Convert duration to hour count |
| WORKDAYS | `WORKDAYS(start, end, [holidays])` | Business days between dates |

#### Enhanced Existing Categories

| Category | New Functions |
|----------|--------------|
| Math | `MEDIAN`, `PRODUCT`, `MOD`, `EVEN`, `ODD`, `PI`, `RANDOM_INT` |
| String | `LEFT`, `RIGHT`, `MID`, `REGEX_MATCH`, `REGEX_REPLACE`, `JOIN`, `REPEAT`, `ENCODE_URL` |
| Conversion | `TO_CURRENCY(value, code)`, `TO_PERCENT(value)` |
| Logic | `LET(name, value, expression)`, `IFBLANK(value, fallback)` |
| Date | `END_OF_MONTH`, `WEEKDAY_NAME`, `ISO_WEEK` |

#### Total Function Count

| Category | v3.3.2 | v3.4.0 |
|----------|--------|--------|
| Logic | 7 | 9 |
| Math | 10 | 17 |
| String | 11 | 19 |
| Date | 13 | 16 |
| Conversion | 3 | 5 |
| Financial | 0 | 11 |
| Statistical | 0 | 8 |
| Conditional Agg. | 0 | 3 |
| List/Iteration | 0 | 6 |
| Duration | 0 | 6 |
| **Total** | **42** | **100** |

### 6.3 COMPUTE → FormulaEngine Unification (R1)

**Current problem**: The COMPUTE pipeline step (`transformExecutor.ts`) implements its own simple expression parser supporting only `+`, `-`, `*`, `/` on field references. It does NOT use FormulaEngine.

**Fix**: Replace COMPUTE step expression evaluator with FormulaEngine.

```
BEFORE:
  COMPUTE column "total" = field1 + field2 * 0.1
  → parsed by transformExecutor's mini-parser (only ±×÷)

AFTER:
  COMPUTE column "total" = IF(field1 > 100, field1 * 0.9, field1) + PMT(0.05/12, 360, -field2)
  → parsed by FormulaEngine (all 100 functions)
```

**Architecture change**:
```typescript
// transformExecutor.ts — COMPUTE step
function executeComputeStep(data: DataFrame, step: ComputeStep): DataFrame {
  for (const col of step.columns) {
    const values = data.records.map(record => 
      // BEFORE: evaluateSimpleExpression(col.expression, record)
      // AFTER:
      evaluateFormulaValue(col.expression, record, data) // pass full DataFrame for aggregate formulas
    );
    data = addComputedColumn(data, col.name, values);
  }
  return data;
}
```

**Breaking change**: None. Old `+field1 - field2` expressions are valid FormulaEngine expressions too.

### 6.4 Cross-Record Reference in COMPUTE (R8, R13)

New concept: **Aggregate context** — COMPUTE formulas can reference the full column for aggregation.

Syntax: `@column_name` refers to the full column array, not the current record's value.

```
COMPUTE "z_score" = (score - AVG(@score)) / STD_DEV(@score)
COMPUTE "percentile_rank" = RANK(score, @score) / COUNT(@score)
```

Implementation:
- FormulaEngine receives `(expression, currentRecord, dataFrame)` instead of just `(expression, currentRecord)`
- `@` prefix triggers column-level reference resolution before per-record evaluation
- Column references are evaluated ONCE and cached for the step

### 6.5 LET Function (Local Variables)

Adapted from Coda's `WithName` / `Let`:

```
LET(x, field1 * field2,
  LET(y, x + 100,
    IF(y > 500, "high", "low")
  )
)
```

This eliminates duplicate sub-expressions and makes complex formulas readable.

---

## 7. Canvas Layout System

### 7.1 Current Grid System

- Grid-based layout using `svelte-dnd-action`
- Responsive: stack mode on mobile, free grid on desktop
- Widget CRUD: add/remove/reorder via DnD

### 7.2 v3.4.0 Enhancements

#### Free-Resize Within Grid

Current: Widgets snap to grid cells with minW/minH constraints.
Enhancement: Add drag handles on widget edges for continuous resize within grid.

```
┌──────────────────────────────┐
│ DataTable          [⋮][✕]   │ ← title bar with menu & close
│                              │
│ ┌──┬──────┬──────┬──────┐   │
│ │  │Name  │Status│Due   │   │
│ ├──┼──────┼──────┼──────┤   │
│ │1 │Alpha │Done  │04-10 │   │
│ │2 │Beta  │WIP   │04-15 │   │
│ └──┴──────┴──────┴──────┘   │
│                           ◢  │ ← resize handle (bottom-right)
└──────────────────────────────┘
```

Implementation:
- Resize handles on right edge, bottom edge, and bottom-right corner
- Resize snaps to 0.5 grid units (finer than current 1-unit snap)
- Min size constraints remain enforced
- CSS: `resize: both; overflow: auto;` (native browser resize as fallback)
- Svelte: Custom `use:resizable` action with pointer events

#### Widget Header Standardization

All widgets get consistent header:
```
┌──────────────────────────────────────────┐
│ 📊 Chart: Revenue by Category  [⚙][⋮][✕]│
│──────────────────────────────────────────│
│ (widget content)                          │
└──────────────────────────────────────────┘
```

- Icon: widget type icon (semantic, not symbolic characters)
- Title: user-editable widget name
- [⚙] settings: opens widget config panel
- [⋮] menu: duplicate, export, move, etc.
- [✕] close: remove widget (with undo toast)

### 7.3 Canvas Layout Presets (Enhanced)

Current: `widgetTemplates.ts` has pre-configured layouts.
v3.4.0: More templates + user can save custom layouts.

| Preset | Widgets | Use Case |
|--------|---------|----------|
| Simple Table | DataTable | Data browsing |
| Dashboard | DataTable + 2×Stats + Chart | Project overview |
| Analytics | DataTable + Scatter + Stats + Comparison | Data analysis |
| Financial | DataTable + Stats (currency) + Chart + Comparison | Budget tracking |
| Sprint Board | FilterTabs + DataTable + Stats + ViewPort (Board) | Agile planning |
| Content Calendar | FilterTabs + DataTable + ViewPort (Calendar) + Checklist | Editorial workflow |
| **Custom** | User-saved layout | "Save current layout as template" |

---

## 8. Data Pipeline Enhancements

### 8.1 Current Pipeline (6 steps)

```
UNPIVOT → COMPUTE → FILTER → GROUP-BY → AGGREGATE → PIVOT
```

### 8.2 v3.4.0 Pipeline (7 steps)

```
UNPIVOT → COMPUTE → FILTER → GROUP-BY → AGGREGATE → PIVOT → SORT
```

**Change**: SORT becomes an explicit pipeline step (currently handled outside pipeline in DataTable).

### 8.3 Multi-Source Merge (R9, A1)

New pre-pipeline step: `MERGE`

```
MERGE(
  source1: "Projects/Backend" (folder),
  source2: "Projects/Frontend" (folder),
  mode: "UNION_ALL",  // or "LEFT_JOIN"
  joinKey: "task_id"   // only for LEFT_JOIN
)
→ merged DataFrame
→ UNPIVOT → COMPUTE → FILTER → GROUP-BY → AGGREGATE → PIVOT → SORT
```

**UNION ALL**: Concatenate records, union field sets (missing fields = null).
**LEFT JOIN**: Match records by key field, combine field sets.

```typescript
interface MergeStep {
  type: 'merge';
  sources: Array<{
    projectId: string;
    label: string;
  }>;
  mode: 'union_all' | 'left_join';
  joinKey?: string;  // for left_join
  addSourceField: boolean;  // adds "__source" field with project label
}
```

**Safety**: Max 3 sources, max 100K total records, 5-second timeout.

### 8.4 Relative Date Filter Operators (R11, R16, A9)

New filter operators added to FilterEngine:

| Operator | Description | Example |
|----------|-------------|---------|
| `is-today` | Date equals today | Due Date is-today |
| `is-this-week` | Date within current ISO week | Due Date is-this-week |
| `is-this-month` | Date within current month | Due Date is-this-month |
| `is-this-quarter` | Date within current quarter | Due Date is-this-quarter |
| `is-last-n-days` | Date within last N days | Due Date is-last-n-days 7 |
| `is-next-n-days` | Date within next N days | Due Date is-next-n-days 14 |
| `is-overdue` | Date < today | Due Date is-overdue |
| `is-upcoming` | Date >= today | Due Date is-upcoming |

Implementation: 8 new operator functions in `filterFunctions.ts`, each ~5-10 LOC.
Uses `dayjs` for timezone-safe day-level comparison.

### 8.5 Dataview Enhancements

#### LIST/TASK Query Support (A3)

Current: Only `TABLE` queries parsed.
v3.4.0: Add `LIST` and `TASK` query types.

```
// LIST query → records with single "value" field
LIST WHERE file.tags CONTAINS "#project"
→ DataFrame { fields: ["file", "value"], records: [...] }

// TASK query → records with "text", "completed", "due" fields
TASK WHERE !completed AND file.folder = "Projects"
→ DataFrame { fields: ["file", "text", "completed", "due", "tags"], records: [...] }
```

**TASK special behavior**:
- `completed` is boolean field (checkbox)
- Editing completion → updates the markdown checkbox `- [x]` / `- [ ]`
- Due dates extracted from `📅 YYYY-MM-DD` or `due::YYYY-MM-DD` annotations

#### DateTime Precision Fix (A4, R7)

Current: Dataview DateTime truncated to `YYYY-MM-DD`.
Fix: Preserve full ISO 8601 `YYYY-MM-DDTHH:mm:ss`.

Change in `dataviewSource.ts`:
```typescript
// BEFORE:
if (value instanceof DateTime) {
  return value.toFormat('yyyy-MM-dd');
}
// AFTER:
if (value instanceof DateTime) {
  return value.toISO(); // "2026-04-16T14:30:00"
}
```

#### Query Validation UI (A5)

New component: `DataviewQueryValidator.svelte`

```
┌─────────────────────────────────────────────┐
│ Dataview Query                               │
│ ┌───────────────────────────────────────────┐│
│ │ TABLE ticker, price, date                 ││
│ │ FROM "investments"                         ││
│ │ WHERE price > 100                          ││
│ └───────────────────────────────────────────┘│
│ ✅ Valid · 42 records matched · 3 fields     │
│ Preview:                                     │
│ ┌──────┬───────┬────────────┐               │
│ │ticker│price  │date        │               │
│ │AAPL  │187.50 │2026-04-15  │               │
│ │MSFT  │432.10 │2026-04-15  │               │
│ └──────┴───────┴────────────┘               │
└─────────────────────────────────────────────┘
```

Uses existing Dataview API to validate before saving. Shows first 5 records as preview.

---

## 9. UI/UX Specifications & Wireframes

### 9.1 Full Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│ 📊 Project: Backend Features ▾  │ [+ Widget] [📐 Layout] [⚙]  │
├──────────────────────────────────────────────────────────────────┤
│ [All (142)] [This Week (28)] [Overdue (5)] [My Tasks (37)]      │ ← FilterTabs
├────────────────────────────────────┬─────────────────────────────┤
│                                    │ ┌─ Stats ─────────────────┐ │
│  ┌─ DataTable ──────────────────┐  │ │ Total: 142  Done: 87   │ │
│  │ Name    │Status │Due   │Hours│  │ │ ████████▒▒ 61%         │ │
│  ├─────────┼───────┼──────┼─────┤  │ │                         │ │
│  │ Alpha   │✅Done │04-10│ 8.0 │  │ │ Avg Hours: 12.3        │ │
│  │ Beta    │🔄WIP  │04-15│ 5.5 │  │ │ Overdue: 5 ⚠️          │ │
│  │ Gamma   │📋Todo │04-20│ 12.0│  │ └─────────────────────────┘ │
│  │ ...     │       │      │     │  │                             │
│  │ + New record               │  │ ┌─ Chart ──────────────────┐ │
│  └──────────────────────────────┘  │ │  ▓▓▓▓                   │ │
│                                    │ │  ▓▓▓▓ ░░                │ │
│                                    │ │  ▓▓▓▓ ░░░░ ████         │ │
│                                    │ │  Done  WIP  Todo         │ │
│                                    │ └─────────────────────────┘ │
├────────────────────┬───────────────┴─────────────────────────────┤
│ ┌─ Comparison ───┐ │ ┌─ ViewPort: Board ──────────────────────┐ │
│ │ This Sprint     │ │ │ ┌──────┐┌──────┐┌──────┐             │ │
│ │ Hours ██████ 80 │ │ │ │ Todo ││ WIP  ││ Done │             │ │
│ │ Done  ████   45 │ │ │ │      ││      ││      │             │ │
│ │ Target████████100│ │ │ │ ...  ││ ...  ││ ...  │             │ │
│ └─────────────────┘ │ └───────────────────────────────────────┘ │
└──────────────────────┴──────────────────────────────────────────┘
```

### 9.2 Project Quick-Switcher (R17)

```
┌─────────────────────────────────────┐
│ 📊 Backend Features ▾              │  ← click project name
├─────────────────────────────────────┤
│ 🔍 Search projects...              │
├─────────────────────────────────────┤
│ 📊 Backend Features    (142 items) │ ← current, highlighted
│ 📊 Frontend Tasks      (87 items)  │
│ 📊 Infra Backlog       (23 items)  │
│ 📊 Bug Tracker         (356 items) │
│ 📊 Content Calendar    (45 items)  │
├─────────────────────────────────────┤
│ ⚙ Manage projects                  │
└─────────────────────────────────────┘
```

Uses `PopoverDropdown.svelte` (shared component from U6).
Keyboard: Type to filter, ArrowUp/Down to navigate, Enter to select, Escape to close.

### 9.3 Formula Editor Enhancement

#### Visual Formula Editor (Recursive, R20)

Current: Max 2 nesting levels.
v3.4.0: Recursive rendering, unlimited nesting.

```
┌─ FormulaVisualEditor ──────────────────────────────────┐
│                                                         │
│  IF ─┬─ condition: ─── AND ─┬─ deadline < TODAY()      │
│      │                       └─ status != "Done"        │
│      ├─ then: ─── style("Overdue", "red", "b")         │
│      └─ else: ─── LET ─┬─ x = DATE_BETWEEN(...)       │
│                          └─ IF ─┬─ x < 7: "Soon"       │
│                                 └─ else: "OK"           │
│                                                         │
│  [Insert Function] [Validate] [Switch to Text]          │
└─────────────────────────────────────────────────────────┘
```

Implementation: `FormulaVisualEditor.svelte` becomes recursive:
- Each AST node renders itself + its children
- `FormulaNode.svelte` component used recursively
- Max render depth: 10 levels (performance guard)
- Collapse/expand for deep trees

#### Formula Autocomplete (R21, U9)

```
┌──────────────────────────────────┐
│ = PMT(annual_rate/12, │          │
│   ┌─────────────────────────┐    │
│   │ PMT(rate, nper, pv,     │ ← selected (highlight)
│   │   [fv], [type])         │    │
│   │ Payment for a loan      │    │
│   ├─────────────────────────┤    │
│   │ PPMT(rate, per, nper,   │    │
│   │   pv, [fv], [type])    │    │
│   │ Principal portion       │    │
│   ├─────────────────────────┤    │
│   │ POWER(number, exponent) │    │
│   └─────────────────────────┘    │
└──────────────────────────────────┘
```

Keyboard navigation:
- ArrowDown/Up: move selection
- Enter/Tab: insert selected function
- Escape: close dropdown
- Typing filters suggestions in real-time

Uses `PopoverDropdown.svelte` for consistent UX.

### 9.4 Pipeline Editor Enhancement

#### Dirty State & Confirmation (U10)

```
┌─ Pipeline Editor ──────────────────────────────────────┐
│ ⚠ Unsaved changes                    [Cancel] [Apply]  │
│                                                         │
│ 1. [COMPUTE] ─ gain = current_price - purchase_price   │
│ 2. [FILTER]  ─ gain > 0                                │
│ 3. [GROUP BY]─ category (monthly)                *new  │
│ 4. [AGGREGATE]─ SUM(gain), AVG(gain_pct)         *new  │
│                                                         │
│ [+ Add Step]                                            │
└─────────────────────────────────────────────────────────┘
```

On Escape/click-outside with unsaved changes:
- Modal: "You have unsaved pipeline changes. Discard?" [Discard] [Keep Editing]

### 9.5 ChartConfig Progressive Disclosure (U12)

Current: All options flat list.
v3.4.0: Grouped into collapsible sections.

```
┌─ Chart Configuration ──────────────────┐
│                                         │
│ ▼ Data                                  │
│   Type:    [Scatter ▾]                  │
│   X axis:  [trial ▾]                   │
│   Y axis:  [measurement ▾]            │
│   Color:   [group ▾]                   │
│                                         │
│ ► Style                    (collapsed)  │
│                                         │
│ ► Labels                   (collapsed)  │
│                                         │
│ ► Advanced                 (collapsed)  │
│   Trend line: [✓]                       │
│   Show R²:    [✓]                       │
│   Point size:  [5px ▾]                 │
│   Opacity:     [0.7]                   │
│                                         │
│                              [Apply]    │
└─────────────────────────────────────────┘
```

---

## 10. Accessibility & Mobile

### 10.1 ARIA Grid Navigation (U7)

DataTable will implement WAI-ARIA grid pattern:
- `role="grid"` on table
- `role="columnheader"` on headers
- `role="gridcell"` on cells
- `aria-activedescendant` for focus tracking
- Arrow keys navigate cells
- Enter to edit, Escape to cancel
- Tab to move between widgets (not cells)

### 10.2 Tab Roving (U5)

SettingsMenuTabs:
- `role="tablist"`, `role="tab"`, `role="tabpanel"`
- ArrowLeft/Right: move between tabs
- Home/End: first/last tab
- Space/Enter: activate tab

### 10.3 Touch Visibility (U14)

Problem: Hover-only actions invisible on touch.
Fix: `@media (pointer: coarse)` shows action buttons permanently.

```css
@media (pointer: coarse) {
  .row-actions {
    opacity: 1; /* always visible on touch */
  }
  .widget-toolbar {
    position: sticky;
    bottom: 0;
  }
}
```

### 10.4 Mobile Canvas

- Widgets stack vertically on `width < 768px`
- DataTable horizontal scroll with frozen first column
- Chart touch gestures: pinch-to-zoom, swipe for pagination
- Minimum touch target: 44×44px (WCAG 2.5.8)

---

## 11. Performance Budgets

| Metric | Budget | Current | Note |
|--------|--------|---------|------|
| Initial render (100 records) | <200ms | ~150ms | OK |
| Initial render (10K records) | <500ms | ~400ms | OK |
| Initial render (100K records) | <2000ms | ~1800ms | Near limit |
| Formula evaluation (100 records) | <50ms | ~30ms | OK |
| Formula evaluation (10K records) | <200ms | ~180ms | Near limit |
| Pipeline execution (6 steps) | <500ms | ~300ms | OK |
| Widget resize response | <16ms (60fps) | N/A | New requirement |
| Memory per 10K records | <50MB | ~35MB | OK |
| Bundle size (main.js) | <2.5MB | ~2.0MB | 500KB budget for new code |
| Scatter chart (1K points) | <100ms render | N/A | New requirement |

### Safety caps (existing, maintained)

- Max records: 100,000
- Max filter depth: 20
- Max wikilinks per field: 500
- Max pipeline timeout: 2,000ms
- Transform cache: 20 entries, 5-min TTL

### New safety caps

- Max formula nesting: 20 levels
- Max IRR iterations: 100
- Max MERGE sources: 3
- Max scatter chart points: 5,000
- Max ForEach/MAP list size: 10,000

---

## 12. Migration & Backward Compatibility

### 12.1 Config Migration

DatabaseViewConfig v1 (current) → v2 (v3.4.0):

```typescript
interface DatabaseViewConfig_v2 {
  layoutVersion: 2;                    // bumped from 1
  widgets: WidgetConfig[];             // same structure, new widget types possible
  mergeStep?: MergeStep;               // new: multi-source config
  filterTabs?: FilterTabsConfig;       // new: user quick-filters
  savedLayouts?: SavedLayout[];        // new: user-saved layout templates
}
```

Migration: Automatic on view open. v1 configs gain `layoutVersion: 2` with no other changes.

### 12.2 Formula Backward Compatibility

All existing 42 functions maintain identical behavior. New functions are additive only.

**One rename**: `STD_DEV` continues to work (alias for population std dev). New `STD_DEV_S` for sample.

### 12.3 COMPUTE Expression Compatibility

Old `+field1 - field2` expressions are valid FormulaEngine input. No migration needed.

---

## 13. Implementation Waves

### Wave 1: Infrastructure & i18n (Weeks 1-2)
**Unlocks everything else.**

| Task | LOC | Depends On | Delivers |
|------|-----|------------|----------|
| U1: ViewConfigTab i18n (40 strings) | 80 | — | All UI strings localized |
| U6: PopoverDropdown.svelte | 150 | — | Reusable popover for U4, U9, A5 |
| U4: Project Quick-Switcher | 120 | U6 | 1-click project switching |

### Wave 2: Computation Engine (Weeks 3-5)
**FormulaEngine becomes the single calculation engine.**

| Task | LOC | Depends On | Delivers |
|------|-----|------------|----------|
| A2: COMPUTE → FormulaEngine unification | 200 | — | Full formula power in pipeline |
| Cross-record @reference support | 150 | A2 | AVG(@col), RANK in COMPUTE |
| LET function | 50 | A2 | Local variables in formulas |
| A6: Financial functions (11) | 400 | A2 | PMT, FV, PV, NPV, IRR, etc. |
| Statistical functions (8) | 250 | A2 | VARIANCE, PERCENTILE, CORREL, etc. |
| Conditional aggregation (3) | 100 | A2 | SUMIF, COUNTIF, AVERAGEIF |
| Duration functions (6) | 120 | A2 | DAYS, HOURS, WORKDAYS, etc. |
| Enhanced Math/String/Date functions | 300 | A2 | +20 utility functions |
| A9: Relative date filters (8 operators) | 80 | — | Dynamic date filtering |

### Wave 3: Visualization & Analytics (Weeks 6-8)
**New chart types and enhanced widgets.**

| Task | LOC | Depends On | Delivers |
|------|-----|------------|----------|
| A7: Scatter/Correlation chart | 250 | Wave 2 (CORREL) | X vs Y plot, trend line, R² |
| Stats sparkline option | 80 | — | Mini inline charts |
| Comparison N-metrics | 100 | — | Multi-metric comparison |
| FilterTabs widget | 150 | U6 | User-facing quick filters |
| SummaryRow widget | 80 | — | Compact aggregation bar |
| ChartConfig progressive disclosure | 60 | — | Grouped, collapsible config |

### Wave 4: Data Integration (Weeks 9-11)
**Dataview deep integration + multi-source.**

| Task | LOC | Depends On | Delivers |
|------|-----|------------|----------|
| A5: Dataview query validation UI | 120 | U6 | Live preview, error display |
| A3: Dataview LIST/TASK support | 300 | A5 | Task management via Dataview |
| A4: DateTime precision fix | 20 | — | Time preserved from Dataview |
| A1: Multi-source merge | 400 | Wave 2 | Cross-project dashboards |
| A8: Inline add row | 100 | — | Notion-like record creation |

### Wave 5: Polish & Accessibility (Weeks 12-13)
**Quality, accessibility, formula editor UX.**

| Task | LOC | Depends On | Delivers |
|------|-----|------------|----------|
| U11: Recursive FormulaVisualEditor | 200 | — | Unlimited formula nesting |
| U9: Formula autocomplete keyboard nav | 80 | U6 | ArrowUp/Down/Enter/Escape |
| U5: ARIA tab roving | 60 | — | Keyboard tab navigation |
| U7: DataGrid ARIA grid pattern | 120 | — | Screen reader + keyboard nav |
| U14: Touch visibility | 30 | — | Actions visible on touch |
| U10: Pipeline dirty state | 40 | — | Unsaved changes confirmation |
| Widget resize handles | 100 | — | Free-resize within grid |

### Total Estimated New Code

| Wave | LOC | Tests (est.) |
|------|-----|-------------|
| Wave 1 | 350 | 80 |
| Wave 2 | 1,650 | 600 |
| Wave 3 | 720 | 200 |
| Wave 4 | 940 | 300 |
| Wave 5 | 630 | 150 |
| **Total** | **4,290** | **1,330** |

Combined with existing ~7,000 LOC → Database View reaches ~11,300 LOC + ~1,930 LOC tests.

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **DataFrame** | `{ fields: DataField[], records: DataRecord[] }` — the universal data container |
| **DataSource** | Provider of records: folder, tag, or Dataview query |
| **Pipeline** | Sequence of transform steps applied to a DataFrame |
| **Widget** | Self-contained UI component on the canvas (DataTable, Chart, etc.) |
| **Canvas** | The DatabaseView layout area containing widgets |
| **FormulaEngine** | Expression evaluator: 42→100 functions, per-record or cross-record |
| **COMPUTE step** | Pipeline step that adds calculated columns to DataFrame |
| **Rollup** | Aggregation across related records (via wiki-links) |
| **Conditional Formatting** | Per-cell style rules based on value conditions |
| **Virtual Scroll** | Windowed rendering of large datasets (threshold: 100 records) |

## Appendix B: File Map (New/Modified)

```
src/ui/views/Database/
  engine/
    formulaEngine.ts          ← MODIFIED: +58 functions, cross-record context
    transformExecutor.ts       ← MODIFIED: COMPUTE uses FormulaEngine, SORT step
    mergeEngine.ts            ← NEW: multi-source merge
    filterFunctions.ts        ← MODIFIED (from src/lib/): +8 relative date operators
  widgets/
    DataTable/
      InlineAddRow.svelte     ← NEW
    Chart/
      ScatterChart.svelte     ← NEW
    Stats/
      Sparkline.svelte        ← NEW
    Comparison/
      ComparisonWidget.svelte ← MODIFIED: N metrics
    FilterTabs/
      FilterTabsWidget.svelte ← NEW
    SummaryRow/
      SummaryRowWidget.svelte ← NEW
    FormulaBar.svelte         ← MODIFIED: keyboard autocomplete
    FormulaVisualEditor.svelte ← MODIFIED: recursive rendering
    FormulaNode.svelte        ← NEW: recursive AST node
    PipelineEditor.svelte     ← MODIFIED: dirty state
  DatabaseViewCanvas.svelte   ← MODIFIED: resize handles, FilterTabs slot
  types.ts                    ← MODIFIED: new config types
  widgetRegistry.ts           ← MODIFIED: +2 widget types

src/ui/components/
  PopoverDropdown.svelte      ← NEW: shared popover
  ProjectSwitcher.svelte      ← NEW: quick-switcher

src/ui/views/Database/engine/
  dataviewSource.ts           ← MODIFIED: LIST/TASK support, DateTime precision
  DataviewQueryValidator.svelte ← NEW

src/settings/
  ViewConfigTab.svelte        ← MODIFIED: i18n (40 strings)

i18n/
  en.json                     ← MODIFIED: new keys
  ru.json                     ← MODIFIED: new keys
  uk.json                     ← MODIFIED: new keys
  zh-CN.json                  ← MODIFIED: new keys
```

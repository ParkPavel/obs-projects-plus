# Image Generation Prompts — Schema Visuals for OBS Projects Plus

> **Версия**: V1.0 | **Дата**: 2026-05-08
> **Назначение**: Детальные промпты для генерации схем/диаграмм каждого нового элемента плагина.
> **Стиль**: Flat technical diagram. White/near-white background. Notion-aesthetic palette.
> **Цветовая палитра для всей серии**:
> - Primary accent: `#6B63E8` (violet-purple)
> - Secondary: `#E8A063` (amber)
> - Surface: `#F7F7F5` (near-white)
> - Border: `#E3E2E0` (light grey)
> - Text primary: `#1A1A1A`
> - Text secondary: `#787774`
> - Green: `#4A9B6F` | Red: `#D44C47` | Blue: `#477DA8`

---

## IMAGE 01 — Plugin Architecture: 4-Layer Matryoshka

**Название**: *"Архитектура плагина: 4 слоя Матрёшки"*

```
PROMPT:

Technical architecture diagram for a software plugin, flat design, white background #F7F7F5,
clean sans-serif typography (Inter or similar), no gradients except very subtle fill tints.

Composition: Four nested rounded rectangles arranged concentrically like Russian Matryoshka dolls,
slightly offset to the right and downward so each layer is visible behind the inner one.
Each layer is a different tint of the same violet-grey palette, outermost darkest.

Layer 1 — outermost, label "SHELL / ENTRY", color tint #EAE8F5:
  Contains icon row: [main.ts] [view.ts] [customViewApi.ts] [managers/]
  Each item is a small pill with monospace filename text.
  Small caption below: "Plugin lifecycle, commands, view registration"

Layer 2 — "UI SURFACES", color tint #DDE8F2:
  Contains two rows of icon-pills arranged in a 2×3 grid:
  Row 1: [App.svelte] [View.svelte] [Dashboard] [Board]
  Row 2: [Calendar] [Gallery] [Table widget] [Modals]
  Small caption: "Svelte 3 components, user-facing views"

Layer 3 — "ENGINE", color tint #D8EDE3:
  Contains a horizontal flow of connected boxes with arrows between them:
  [filterEvaluator] → [formulaEngine] → [transformExecutor] → [aggregation]
  Below that row: [crossProjectResolver] [rollupMode] [colorPalette]
  Small caption: "Pure logic, zero I/O, fully tested"

Layer 4 — innermost, "DATA", color tint #F5EDE0:
  Contains: [DataFrame] [DataRecord] [DataField] in a row
  Below: [folder datasource] [tag datasource] [dataview datasource]
  Small caption: "Markdown files, frontmatter, vault API"

On the right side of the diagram, outside the nested layers:
A vertical legend column with four colored squares matching each layer tint,
labeled: Shell → UI → Engine → Data with arrows pointing left into each layer.

At the bottom, a small footer strip with monospace text:
"TypeScript strict · Svelte 3 · Jest 106 suites / 1679 tests · zero @ts-ignore"

Overall aspect ratio: 16:9 landscape. Professional, clean, publishable.
No drop shadows except 1px #E3E2E0 border on each layer rectangle.
```

---

## IMAGE 02 — Dashboard as Free Canvas

**Название**: *"Дашборд как свободный канвас"*

```
PROMPT:

UI architecture schematic diagram, flat design, white background, Notion-aesthetic.
Aspect ratio 16:9.

The image shows a Dashboard canvas editor with a grid overlay (very faint, dot-grid pattern, dots #E3E2E0).
The canvas is the central 80% of the image.

On the canvas, place 6 widget placeholders arranged freely (not in strict columns):
- Top-left large rectangle (40% width, 30% height): labeled "DataTable Widget"
  inside: faint horizontal lines suggesting rows, header row with 5 column label pills
- Top-right medium rectangle: labeled "KPI Stats Widget"
  inside: 3 large numbers stacked vertically (67, 35, 33.6%) each with a small label below
- Middle-left square: labeled "Chart Widget — Bar"
  inside: simplified bar chart silhouette (5 bars, varying heights, violet fill)
- Middle-right small rectangle: labeled "Checklist Widget"
  inside: 4 checkbox rows, 2 checked (violet), 2 empty
- Bottom spanning rectangle: labeled "SubBase Canvas Widget (Matryoshka)"
  inside: nested mini-canvas with a smaller table inside, dashed border to show it's nested
- Small floating pill top-center: labeled "FilterTabs Widget"
  3 tab pills: All / Active / Done

Each widget has:
- White fill with 1px #E3E2E0 border, 8px border-radius
- Six-dot drag handle visible on hover (show as faint dots ·∶· on top-left of each widget)
- Small resize handle triangle bottom-right corner

Left sidebar (narrow, 15% width): Project navigation list
  Vertical list of 4 project names with small colored dots, one highlighted with violet background.

Top toolbar (full width, 48px height, #F7F7F5 background):
  Left: "База: Обзор" breadcrumb with home icon
  Center: Tab row — "Widgets | Grid | Schema | fx | + Add widget"
  Right: Lock icon, Share icon, Settings icon

Color accents: widget headers violet (#6B63E8 tint), chart bars violet, checkmarks violet.
Typography: all text in Inter or similar, no more than 3 font sizes.
Style: clean, publishable, resembles Notion/Coda product marketing diagram.
```

---

## IMAGE 03 — Widget Taxonomy: All 11 Types

**Название**: *"Таксономия виджетов: все 11 типов"*

```
PROMPT:

Technical reference card diagram, white background, flat design.
Aspect ratio: 4:3 portrait or A4 vertical.

Title at top in bold: "Dashboard Widget Types" with subtitle "obs-projects-plus v3.5"

The diagram is a 3-column × 4-row grid of widget preview cards.
(11 cards + 1 "Add widget" placeholder card)

Each card is a white rounded rectangle (border-radius 12px, 1px #E3E2E0 border, 16px padding):
- Top: small colored category dot + widget type label in semibold
- Middle: simplified visual preview (icon-based, no real data)
- Bottom: 2-line description in small grey text

Card 1 — DataTable: icon=table grid, violet. Preview: mini 3-column table with header.
  Description: "Таблица с виртуальным скроллом, group headers, sub-base tabs"

Card 2 — Chart: icon=bar chart, violet. Preview: 3 bar heights.
  Description: "10 типов графиков: Bar, Line, Area, Pie, Scatter с R², Progress"

Card 3 — Stats/KPI: icon=lightning bolt, amber. Preview: "67" large number + small label.
  Description: "KPI карточки с агрегацией, иконкой и цветовым статусом"

Card 4 — Comparison: icon=split arrows, blue. Preview: two columns side by side with values.
  Description: "Сравнение двух метрик или источников данных"

Card 5 — Checklist: icon=checkbox, green. Preview: 3 checkbox rows.
  Description: "Интерактивный список задач из frontmatter"

Card 6 — ViewPort: icon=window layers, grey. Preview: tiny board/calendar inside a frame.
  Description: "Встраивает Board/Calendar/Gallery внутри дашборда (max 4)"

Card 7 — FilterTabs: icon=funnel + tabs, violet. Preview: 3 tab pills.
  Description: "Локальный переключатель фильтров для всего канваса (max 1)"

Card 8 — SummaryRow: icon=sigma, amber. Preview: 4 cells with totals.
  Description: "Строка агрегации: sum, avg, count, min, max (max 1)"

Card 9 — SubBase Canvas: icon=Russian doll, violet-gradient border (dashed).
  Preview: mini canvas nested inside outer canvas.
  Description: "Вложенная суббаза (Матрёшка): database inside database"

Card 10 — YAML Visualizer: icon=document with typed fields, teal.
  Preview: property rows (name: text, date: pill, status: badge).
  Description: "Карточка заметки: frontmatter как типизированные свойства"

Card 11 — Formula Node: icon=fx, purple-dark.
  Preview: code-like expression "=sum(@budget) * progress".
  Description: "Визуальный редактор формул с 115+ функциями"

Card 12 — "+ Add Widget" placeholder: dashed border, centered "+" icon, grey text.

Below the grid: a thin category legend bar:
[violet dot] Data views · [amber dot] Aggregation · [green dot] Tasks · [teal dot] Notes · [dashed] Structure

Style: clean product marketing reference card. All icons are 24px line-style, stroke only.
```

---

## IMAGE 04 — Transform Pipeline: 8 SQL-like Steps

**Название**: *"Transform Pipeline: 8 шагов обработки данных"*

```
PROMPT:

Horizontal data flow pipeline diagram, dark background #1A1A1A (dark mode),
white and light-grey text, accent color violet #6B63E8. Aspect ratio 21:9 (ultra-wide) or 16:9.

At the very left: a cylinder icon labeled "DataFrame IN" with "67 records · 12 fields" below it.
An arrow pointing right leads to the first pipeline step.

The pipeline consists of 8 connected rectangular "step cards" in a horizontal chain,
each connected to the next by a bold arrow →. Each step card is:
- Dark grey fill #2A2A2A, violet left border (4px), 12px border-radius
- Step number in top-left (small, grey)
- Step name in bold white
- Input/Output type labels in small monospace below name
- A tiny icon representing the operation

Step 1 — UNNEST (#1): icon=expand-arrows.
  "Splits list fields into rows. Array → multiple records"

Step 2 — UNPIVOT (#2): icon=rotate.
  "Columns → rows. Wide table → tall table"

Step 3 — COMPUTE (#3): icon=fx, violet glow.
  "Applies formula fields. @revenue, @margin, custom expressions"

Step 4 — FILTER (#4): icon=funnel.
  "WHERE clause. Uses filterEvaluator kernel"

Step 5 — GROUP-BY (#5): icon=layers.
  "Groups records. Creates GroupedDataFrame"

Step 6 — AGGREGATE (#6): icon=sigma.
  "sum/avg/count/min/max per group. 15+ functions"

Step 7 — PIVOT (#7): icon=grid-rotate.
  "Rows → columns. Cross-tabulation"

Step 8 — JOIN (#8): icon=merge arrows, amber.
  "Cross-database merge. Key-based equality normalizer"

At the far right: cylinder icon labeled "DataFrame OUT" with amber color, "Widget-ready data" below.

Below the entire pipeline chain, a thin horizontal bar labeled:
"transformCache.ts — TTL 5min — max 20 entries" with a clock icon.
This bar spans the width of the pipeline with dashed border (showing caching layer).

Above the pipeline, a breadcrumb: "DashboardCanvas → transformExecutor.ts → transformCache.ts"

At the very bottom, a small legend:
[violet] formula operations · [white] structural transforms · [amber] cross-source operations

Style: technical, dark mode, developer-focused. Similar to Stripe or Linear technical docs aesthetic.
No photographs. Clean geometric icons only.
```

---

## IMAGE 05 — Reactive Loop (R5-016): Before and After

**Название**: *"Реактивный контур: текущее состояние vs цель"*

```
PROMPT:

Split-screen comparison diagram, white background, flat design. Aspect ratio 16:9.
Left half labeled "СЕЙЧАС (BROKEN)" with red accent #D44C47.
Right half labeled "ЦЕЛЬ (R5-016)" with green accent #4A9B6F.
A vertical dashed divider separates the halves.

LEFT HALF — "Broken Reactive Loop":
A circular flow diagram arranged clockwise with 5 nodes:
Node 1 (top): "Markdown Files" — document icon, grey
Node 2 (right): "DataSource" — database cylinder, grey
Node 3 (bottom-right): "DataFrame" — grid icon, grey
Node 4 (bottom-left): "transformCache" — cache icon, grey with red warning badge "TTL 5min, STALE"
Node 5 (top-left): "Dashboard UI" — monitor icon, grey

Arrows connecting the nodes clockwise (grey arrows):
Files → DataSource → DataFrame → transformCache → Dashboard UI

Between Dashboard UI and Files: a BROKEN arrow (dashed red, ✗ symbol in the middle).
Label on broken arrow: "NO EVENT LISTENER"

Below node 4 (transformCache): a red callout box saying
"vault.on('modify') fires BUT cache is never invalidated"

The whole left diagram has a light red tint overlay #FFF0EF.

RIGHT HALF — "Target Reactive Loop":
Same circular arrangement but NOW with ALL arrows solid and green:
Files → DataSource → DataFrame → transformCache → Dashboard UI

The crucial NEW arrow (bright green, bold, animated-looking with motion lines):
Going FROM "Markdown Files" with label "vault.on('modify')" 
THROUGH a new green hexagon node labeled "invalidate(projectId)"
INTO "transformCache" with a "FRESH" green badge replacing red badge.

Below the loop, a green timing badge:
"≤ 500ms from file save to dashboard update"

A green callout box:
"DataFrameProvider.refresh() → invalidate() → pipeline reruns → UI updates"

The whole right diagram has a light green tint overlay #F0FFF5.

At the very top center spanning both halves:
Title "REACTIVE LOOP — R5-016 (P0)"
Subtitle "S complexity · ≤200 LOC · Wiring only — logic already exists"

Style: clear, high-contrast, explanatory. Like a GitHub issue diagram.
```

---

## IMAGE 06 — Matryoshka: Sub-Base Architecture

**Название**: *"Матрёшка: вложенная архитектура баз"*

```
PROMPT:

Architectural concept illustration combined with UI wireframe, white background, flat design.
Aspect ratio 4:3.

Left third of image: Abstract Matryoshka metaphor.
Draw 3 concentric simplified Russian doll silhouettes (just clean geometric outlines, no decorative patterns):
- Outer doll: labeled "PROJECT / Vault folder" — largest, color #EAE8F5
- Middle doll: labeled "DATABASE / Sub-base" — medium, color #D8EDE3  
- Inner doll: labeled "RECORD / Markdown file" — small, color #F5EDE0
Each doll silhouette is just a smooth egg-shape outline, filled with the tinted color, no decorative details.

Right two-thirds: Dashboard UI wireframe showing the nesting:

Outer container (white, 2px #6B63E8 border, label "Dashboard — Projects"):
  Contains a DataTable widget showing 3 project rows.
  Row 2 ("Project Alpha") is highlighted/expanded.
  
  Inside the expanded row, a nested container (dashed #6B63E8 border, label "SubBase: Tasks"):
    Contains a smaller Board-style view with 3 columns (Todo / Doing / Done)
    Each column has 2-3 mini card rectangles.
    
    One card is expanded showing a mini YAML Visualizer:
      (title: "Fix API endpoint", status: doing, priority: high)

Between the doll illustration and the UI wireframe:
3 horizontal arrows pointing right, one for each nesting level:
→ "Vault folder = Project"
→ "Markdown subfolder = Database"  
→ "Single .md file = Record"

Below the entire image:
A formula-style line: "Dashboard ⊃ SubBaseCanvas ⊃ DataTable ⊃ YAML Visualizer"

Color rules: violet (#6B63E8) for project level, green (#4A9B6F) for sub-base level, amber (#E8A063) for record level.
Use these colors consistently across both the doll illustration and the UI wireframe.

Style: clear product explanation diagram, resembling Notion's own marketing material.
```

---

## IMAGE 07 — Relation System: One-Way vs Bidirectional

**Название**: *"Система связей: текущее vs цель (R5-010)"*

```
PROMPT:

Technical comparison diagram showing database relation types, white background, flat design. Aspect ratio 16:9.

The diagram shows two "databases" as simplified table wireframes.

LEFT DATABASE (titled "Projects"):
A mini table with 3 columns: name | status | tasks
Row data examples: "Alpha | doing | [[Task1]][[Task2]]"
The "tasks" column cells show pill-chips: [Task 1] [Task 2] [+3 more]

RIGHT DATABASE (titled "Tasks"):
A mini table with 3 columns: name | project | assignee
Row data: "Fix API | · | Alice"
The "project" column cell shows a question mark ? in grey (currently empty, not linked back)

Between the two tables, draw THREE different connection diagrams stacked vertically:

TOP section label "CURRENT STATE":
A single arrow from Projects.tasks → Tasks (one direction only, grey arrow)
Label on arrow: "wikilink [[Task1]] in frontmatter"
Below Tasks table: a red callout "Tasks cannot see their parent Project"

MIDDLE section label "TARGET (R5-010)":
TWO arrows: Projects.tasks ←→ Tasks.project (bidirectional, violet arrows)
Label on right arrow: "inverseIndex.ts resolves backlink"
Tasks.project cell now shows [Alpha] pill-chip instead of ?

BOTTOM section — "ROLLUP":
A new column added to Projects table: "budget_total"
An arrow from Tasks table floats data into this column.
The cell shows: "sum(tasks.budget) = $4,200" with amber background.
Label: "crossEntityRollup.ts — auto-computed from linked records"

Right side of image: UI component "Relation Picker Popover" wireframe:
A small floating popover with:
- Search input "Search tasks..."
- List of 4 results with checkboxes
- 2 results checked with violet checkmarks
- Footer: "3 selected · Done"
Label: "R5-019 — RelationPickerPopover.svelte (planned)"

Style: clear, developer-readable diagram. Violet for current, green for target, amber for computed values.
```

---

## IMAGE 08 — YAML Visualizer: Note as Typed Card

**Название**: *"YAML Visualizer: заметка как типизированная карточка"*

```
PROMPT:

Transformation flow diagram showing Markdown file → YAML Visualizer card, white background, flat design.
Aspect ratio 3:2.

THREE panels arranged left-to-right with transformation arrows between them:

PANEL 1 — "Raw Markdown" (left, monospace font, code-style dark background #1E1E1E, white text):
A simplified markdown file with frontmatter:
---
title: Архитектура системы
status: doing
priority: high
estimate: 4500
tags: [архитектура, система]
cover: cover.jpg
---
# Body content...

The YAML block is highlighted with a faint violet border.
Label above: "project/architecture.md"

Arrow → labeled "YamlVisualizerWidget.svelte"

PANEL 2 — "Typed Properties" (center, white card with 1px #E3E2E0 border, 8px border-radius):
Shows each frontmatter field rendered as a typed UI row:
- Cover image area at top (light grey rectangle with mountain/image icon placeholder)
- 📄 "Архитектура системы" — large title, violet underline
- Then a two-column property list (label | value):
  Status [label icon: circle] | [badge: "doing" in amber]
  Priority [label icon: flag] | [badge: "high" in red]
  Estimate [label icon: number] | 4,500
  Tags [label icon: tag] | [chip: архитектура] [chip: система]
  Created [label icon: clock] | 2026-05-05
  Modified [label icon: pencil] | 2026-05-08

Below property list: a faint "Show all fields" link in grey
(implying empty fields are hidden)

Label above: "YAML Visualizer Widget"

Arrow → labeled "R5-012 planned"

PANEL 3 — "As Properties Pane" (right, shows Obsidian-like interface):
A narrow panel replacing the stock Obsidian Properties pane.
The same card from Panel 2 but integrated into an editor sidebar.
Left shows document text editor, right shows the YAML Visualizer panel.
A toggle switch at top labeled "Use Visualizer as Properties Pane".

Color system for property types:
- Status badges: colored (doing=amber, done=green, blocked=red)
- Tags: pastel chips (different colors per tag)
- Numbers: clean monospace, no badge
- Dates: subtle grey pill

Label above: "R5-012 target state"

Below all three panels:
"YamlVisualizerWidget.svelte ✅ DONE (R5-011) → Properties pane replace 📋 BACKLOG (R5-012)"

Style: clean product flow diagram. Left panel is dark/code-like, middle and right are Notion-like clean white.
```

---

## IMAGE 09 — DataTable Widget: Anatomy

**Название**: *"DataTable Widget: анатомия компонента"*

```
PROMPT:

Annotated UI component diagram showing DataTable Widget internals, white background, flat design.
Aspect ratio 16:9.

Center: A realistic DataTable wireframe occupying 70% of the image.

TABLE STRUCTURE:
Header row (light grey #F7F7F5 background):
Columns from left to right with type icons before each label:
[☰] [Aa name] [● status] [# estimate] [∞ relation: tasks] [fx formula] [📅 date] [🏷 tags]

5 data rows visible:
Row 1: [checked box] [Alpha Project] [doing•amber] [$4,500] [[Task1][Task2][+3]] [=$4.5K] [2026-05-15] [[arch][sys]]
Row 2: [unchecked] [Beta Review] [done•green] [$2,200] [[Task5]] [=$2.2K] [2026-05-08] [[ux]]
Row 3 (highlighted, light violet tint): [unchecked] [Gamma Init] [todo•grey] [-] [] [-] [-] []
Row 4: [unchecked] [Delta Report] [doing•amber] [$8,100] [[Task8][Task9]] [=$8.1K] [2026-06-01] [[report]]
Footer row (SummaryRow): [—] [4 items] [2 doing] [sum: $14,800] [avg: 3.7 tasks] [total: $14.8K] [—] [12 tags]

ANNOTATIONS (callout lines pointing to specific elements):
→ Column header "∞ relation: tasks" → callout "Relation field: pill-chips + overflow count"
→ Row 3 empty cells → callout "Empty cells: no placeholder (gap R5-020)"
→ [checked box] → callout "Bulk select (R5-020 planned)"
→ Footer SummaryRow → callout "SummaryRow widget (max 1 per canvas)"
→ Left of Row 1 (faint dots) → callout "Drag handle ·∶· on hover (R5-020 planned)"

Below the table:
Sub-base tabs bar: [📁 Tasks] [📁 Notes] [+ Add sub-base]
Label: "SubBaseTabs.svelte — integrated in DataTableWidget (R5-009 ✅ DONE)"

Top-right of image: column type icon legend:
[Aa] Text · [#] Number · [●] Status · [∞] Relation · [fx] Formula · [📅 Date · [🏷] Tags

State indicators (bottom-left corner):
Three small badge pills: "column virtualization: ON" | "group headers: ON" | "sorting: multi-column"

Style: annotated component diagram similar to web component documentation.
Use thin annotation lines (1px dashed) with small labels at line ends.
Violet for implemented features, grey for planned gaps.
```

---

## IMAGE 10 — Formula Engine: Architecture and Function Taxonomy

**Название**: *"Formula Engine: 115+ функций"*

```
PROMPT:

Radial taxonomy diagram combined with architecture flowchart, white background, flat design.
Aspect ratio 4:3.

LEFT THIRD — Architecture flow (top to bottom):

Box 1: "formulaParser.ts" with "@deprecated" red badge
  Arrow down → "delegates to"

Box 2: "lib/formula/index.ts" with green "canonical" badge
  (This is the central hub — larger box, violet border)
  Arrow down →

Box 3: "extendedEvaluator.ts (1156 LOC)" 
  Shows: "115+ functions → returns DataValue"
  Arrow left → "filterEvaluator.ts (boolean context)"
  Arrow right → "formulaEngine.ts (thin wrapper)"
  Arrow down →

Box 4: "DataValue output"
  Type options shown as mini-pills:
  [string] [number] [boolean] [Date] [string[]] [null]

RIGHT TWO-THIRDS — Radial function taxonomy:

Center circle: "115+ Functions" in bold

6 category sectors radiating outward (each sector is a different pastel color):

Sector 1 — MATH (violet): count, sum, avg, min, max, round, abs, mod, pow
Sector 2 — TEXT (blue): concat, left, right, mid, trim, upper, lower, replace, split
Sector 3 — DATE (teal): today, now, dateDiff, dateAdd, year, month, day, weekday
Sector 4 — FINANCIAL (amber): PMT, IRR, NPV, FV, PV, RATE — with small $ icon
Sector 5 — STATISTICAL (green): variance, stdev, correl, percentile, median, mode
Sector 6 — ADVANCED (purple-dark): IF, IFS, SWITCH, MAP, FILTER, REDUCE, LET, lets()
               + STYLE() with a paint-bucket icon (conditional formatting)

Each sector has 4–8 function names listed as small text pills.
Most important functions in each sector shown in slightly larger text.

Below the radial diagram, a horizontal comparison bar:
"Notion: ~80 functions" (short bar, grey)
"OBS: 115+ functions" (longer bar, violet) with "includes: Finance + Stats + Cross-record"

Bottom note: "extendedEvaluator.ts → lib/formula/index.ts (canonical entry)"

Style: clear taxonomy diagram. Each sector uses a different pastel fill.
The radial chart is NOT a pie chart — it's a sunburst/mindmap style with the center circle and sectors branching outward with text labels on each function.
```

---

---

# DASHBOARD PRESETS

---

## PRESET A — Finance / KPI Dashboard

**Название**: *"Пресет: Финансовый дашборд"*

```
PROMPT:

Dashboard layout wireframe mockup showing a Finance/KPI preset configuration,
white background, Notion-aesthetic, flat design. Aspect ratio 16:10.

Top bar: "База: Финансы" | Tabs: [Widgets★] [Grid] [+ Add widget] | Right: Lock icon

Canvas with 5 widgets arranged in a specific layout:

ROW 1 — Full-width KPI strip (3 Stats widgets side by side, each 1/3 width):
Widget A: "$298,250" in large bold, label below "Total Revenue", small green ↑ trend arrow
Widget B: "67" in large bold, label "Active Projects", violet accent dot
Widget C: "33.6%" in large bold, label "Avg Progress", small orange ← trend (below target)

ROW 2 — Split (60% / 40%):
Widget D (left, 60%): Bar Chart "Revenue by Category"
  X-axis: 8 categories (развработка, маркетинг, бухгалтерия, etc.) 
  Bars in violet, rotated 45° X-labels (not overflowing like current bug)
  Y-axis: $0 to $80K
  Two bars highlighted amber (highest values)

Widget E (right, 40%): Comparison Widget
  Two columns: "Q1 2026" vs "Q2 2026"
  Row metrics: Revenue / Expenses / Profit margin / Projects completed
  Values in each column with ↑ or ↓ trend arrows

ROW 3 — Full-width:
Widget F: DataTable "Journal"
  Columns: name | status | estimate | progress | category | date
  5 rows visible, SummaryRow at bottom: "sum: $14,800 | avg: 33%"
  Sub-base tabs below: [📁 Invoices] [📁 Expenses]

Right edge of image: narrow "PRESET INFO" sidebar:
  Label: "Finance KPI Preset"
  Description: "3 KPI stats + revenue chart + comparison + data table"
  Widgets: 6 | Source: folder/finance/

Bottom strip label: "Suggested for: financial reporting, budget tracking, project economics"

Color emphasis: amber (#E8A063) for financial metrics, violet for structural elements.
Professional, publishable, resembles Notion/Linear marketing screenshots.
```

---

## PRESET B — Project Tracker (Matryoshka View)

**Название**: *"Пресет: Трекер проектов с вложенными базами"*

```
PROMPT:

Dashboard layout wireframe mockup showing a Project Tracker preset with nested sub-bases,
white background, flat design. Aspect ratio 16:10.

Top bar: "База: Проекты" | Tabs: [Widgets★] [Grid] [Schema] | Preset: "Project Tracker"

Canvas layout:

ROW 1 — Three KPI Stats (1/3 each):
"35 Open" (amber) | "32 Done ✓" (green) | "8 weeks avg" (grey, clock icon)

ROW 2 — Left 40% / Right 60%:
LEFT: ViewPort widget embedding "Board View"
  Shows Kanban with 3 columns: Todo (4 cards) / Doing (3 cards) / Done (∞)
  Each card: small white rectangle with colored left border, title text, small tags

RIGHT: ViewPort widget embedding "Calendar View"
  Shows 2-week timeline grid
  Colored bars across date cells representing project timelines
  Today column highlighted with violet border

ROW 3 — Full-width: SubBase Canvas Widget (dashed violet border = matryoshka level)
  Label: "Sub-base: Tasks for selected project"
  Inside shows a smaller DataTable:
    Columns: task name | assignee | status | due date | priority
    5 rows: various statuses shown as colored badges
  Above the sub-base table: FilterTabs widget showing [All Tasks] [My Tasks] [Overdue]
  Label on dashed border: "SubBaseCanvasWidget — R5-009 ✅"

At bottom of canvas: "+" button (faint, visible on hover) → "Add sub-base or text block"
Tooltip shown: "Добавить суббазу или текстовый блок"

Right sidebar overlay (partially visible): "PRESET CONFIG"
  Source: Projects/
  Sub-base source: Tasks/
  KPI fields: status.count, estimate.avg
  Board groupBy: status

Bottom label: "Suggested for: project management, team coordination, sprint planning"
```

---

## PRESET C — Content Library

**Название**: *"Пресет: Библиотека контента"*

```
PROMPT:

Dashboard layout wireframe for a Content Library preset, white background, flat design.
Aspect ratio 16:10.

Top bar: "База: Контент" | Preset: "Content Library"

Canvas:

ROW 1 — FilterTabs spanning full width:
7 filter tabs: [All★] [архитектура] [ux] [техническое] [система] [идея] [тема]
Styled as pill tabs, active one (All) has violet background.
Label: "FilterTabs widget — local filter for entire canvas"

ROW 2 — 70% left / 30% right:
LEFT: ViewPort embedding Gallery View
  4-column gallery grid of cards, each card showing:
  - Cover image (grey placeholder with category icon)
  - Title (violet underline)
  - Status badge (color-coded)
  - Tag chips (pastel, multi-color)
  - Category label

RIGHT: Stats column (3 stacked Stats widgets):
  "67 Articles" (teal)
  "8 Tags" (violet)  
  "doing: 35 / done: 32" (split pill, amber/green)

ROW 3 — Full-width DataTable:
  Columns: title | category | status | tags | type | modified
  Columns optimized for content: title wide, others narrow
  Tags column: multiple chips visible [архитектура] [система] [техническое]
  Horizontal scroll indicator visible (right edge fades out)
  SummaryRow: "67 total | 5 categories | 12 unique tags"

Color note: in this preset, show tags with MULTI-COLOR chips (not all violet):
  [архитектура] — teal chip
  [ux] — pink chip  
  [система] — blue chip
  [техническое] — amber chip
Caption near tags: "Tag color consistency — gap identified (R5-005 palette fix)"

Bottom label: "Suggested for: knowledge base, article library, research notes"
```

---

## PRESET D — Analytics Lab (Transform Pipeline UI)

**Название**: *"Пресет: Аналитическая лаборатория"*

```
PROMPT:

Dashboard layout wireframe for an Analytics/Data Lab preset with visible pipeline configuration,
dark background #1A1A1A (dark mode), Notion dark-aesthetic. Aspect ratio 16:10.

Top bar: "База: Аналитика" | Tabs: [Widgets★] [Grid] [Schema] [**fx Pipeline**★]
The "fx Pipeline" tab is actively selected, showing orange highlight.

Left panel (25% width) — Pipeline Configurator sidebar:
Dark grey #2A2A2A background, titled "Transform Steps"
A vertical list of 8 step rows:
  [✓] COMPUTE — formula fields (3 active)
  [✓] FILTER — status = doing (1 condition)
  [✓] GROUP-BY — category
  [✓] AGGREGATE — sum(estimate), avg(progress)
  [⊘] PIVOT — disabled
  [⊘] JOIN — disabled
  [⊘] UNNEST — disabled
  [⊘] UNPIVOT — disabled
Each row has: step name + status toggle switch + small config icon ⚙

Right main area (75% width) — Results Canvas:
Three widgets showing the pipeline output:

TOP-LEFT: Scatter Chart widget (40% width)
  X-axis: estimate ($0-$10K)
  Y-axis: progress (0-100%)
  ~15 data points (circles), colored by category
  A violet trend line with "R² = 0.73" label at top
  Widget header: "estimate vs progress (by category)"

TOP-RIGHT: Pie/Donut Chart (30% width)
  5 segments, violet/teal/amber/grey/green
  Center label: "67 records"
  Legend: category labels with percentages

BOTTOM: DataTable showing post-pipeline data (full width)
  Columns: category | count | sum_estimate | avg_progress | max_priority
  6 rows (aggregated by category)
  These are computed rows, not raw data — shown with subtle amber tint on cells
  Footer: "6 groups · Pipeline: 4 active steps · Cache: LIVE"

Bottom strip:
"Source: folder/projects/ → 4 pipeline steps active → 6 aggregated groups"
Green "LIVE" dot blinking indicator (showing reactive loop working)

Label: "Suggested for: data analysis, KPI correlation, custom reports"
```

---

## Formula Builder - Anatomy

Flat design, white background #F7F7F5, Notion-aesthetic, aspect ratio 16:10.
Название вверху: "Formula Constructor — Anatomy"
Subtitle: "Единый компонент для всех точек ввода формул в плагине"
━━━ ГЛАВНЫЙ БЛОК: АНАТОМИЯ КОМПОНЕНТА (центр, 65% ширины) ━━━
Изобрази компонент FormulaEditor как вертикальный "разобранный" вид,
каждый слой обозначен выносной аннотацией. Общий вид — белая карточка,
1px #E3E2E0 border, border-radius 10px, лёгкая тень.
СЛОЙ 1 — TOOLBAR (верхняя полоса, 40px высота, фон #F7F7F5):
Левая часть: две кнопки-пилюли [✦ Авто] [? Справка]
Правая часть: статус-хинт — три состояния показаны последовательно:
  [ℹ Ctrl+Space — подсказки] (серый, пустое поле)
  [✓ Формула валидна] (зелёный)
  [⚠ 1 ошибка] (красный)
Аннотация вправо: "Реалтайм валидация · 3 состояния"
СЛОЙ 2 — FORMULA TEXTAREA (главное поле, 120px высота, monospace):
Показан активный пример ввода:
  AND(IS_OVERDUE(dueDate), CONTAINS(|tags, "urgent"))
  курсор (|) стоит внутри CONTAINS — подсвечен аргумент в котором находится курсор.
  Левая кайма: 2px зелёная (состояние has-valid)
Под кареткой: ghost-текст серым "поле, "текст")" — подсказка аргумента
Аннотация влево: "Ghost arg hint — подсказка аргумента у курсора"
Аннотация влево: "Зелёная/красная левая кайма = статус валидации"
СЛОЙ 3 — AUTOCOMPLETE POPOVER (всплывает НАД textarea, 220px высота):
Translucent фон (88% opacity + backdrop-blur), border-radius 8px, тень мягкая.
Структура попover'а детально:
  ┌──────────────────────────────────────────┐
  │ ⚡ Шаблоны                              │  ← группа-сепаратор (6px bold uppercase)
  │ ⚡ 📌 Активные задачи  AND(status=...)  │  ← строка сниппета
  │ ⚡ 🔥 Срочные просроченные  AND(IS...  │
  │──────────────────────────────────────────│
  │ 📅 Даты                                 │  ← группа-сепаратор
  │ ƒ CONTAINS  (поле, "текст")  ← активный  │  ← выделен violet tint background
  │   [справа: "Содержит текст (регистр игн.)]│  ← desc появляется только для active
  │ ƒ NOT_CONTAINS  (поле, "текст")          │
  │ ƒ STARTS_WITH  (поле, "префикс")         │
  │──────────────────────────────────────────│
  │ ◆ Поля БД                               │  ← группа полей
  │ ◆ dueDate  (Дата)                        │
  │ ◆ tags  (Список)                         │
  │──────────────────────────────────────────│
  │ ↑↓ · Tab/Enter · Esc                    │  ← footer
  └──────────────────────────────────────────┘
Аннотации к попover'у:
  → Верх: "Группировка: Шаблоны → Функции → Поля БД → Ключевые слова"
  → Строка: "ƒ = функция  ◆ = поле записи  ⚡ = шаблон-сниппет  K = keyword"
  → Активная строка: "Desc видна ТОЛЬКО у активного элемента (компактность)"
  → Footer: "↑↓ / Tab / Enter / Esc — клавиатурная навигация"
СЛОЙ 4 — LIVE PREVIEW BAR (под textarea, 28px высота, фон #F0FFF5):
Однострочный вывод: "→  true  (вычислено на записи #1)"
Иконка глаза слева. Если ошибка — фон #FFF0EF, текст "✗ поле 'tags' не найдено"
Аннотация: "Превью на первой записи текущей базы"
СЛОЙ 5 — HELP PANEL (раскрывается ниже toolbar, max-h 224px, scroll):
Двухколоночный справочник, каждый блок:
  Заголовок категории (bold small)
  Строки code-блоков с сигнатурами
Примеры быстрых вставок внизу.
Аннотация: "Toggle-панель: не перекрывает редактор, сохраняет фокус"
━━━ ПРАВЫЙ БЛОК: INTEGRATION MAP (25% ширины, вертикальная колонка) ━━━
Заголовок: "Точки интеграции в плагине"
5 блоков со стрелками → к главному компоненту:
[📅 DateFormulaInput]
  "Инпут дат в фильтрах агенды"
  Тег: "уже реализован, частичный"
[🔬 AdvancedFilterEditor]
  "Фильтр агенды — кастомные списки"
  Тег: "✅ основа компонента"
[fx FormulaBar]
  "Формульные колонки в DataTable"
  Тег: "🔄 требует реинтеграции"
[⚙ ConfigureField → Rollup]
  "Настройка rollup-поля"
  Тег: "📋 планируется"
[🔧 FilterEditor → Dashboard]
  "Фильтры виджетов дашборда"
  Тег: "📋 планируется"
━━━ НИЖНИЙ БЛОК: СРАВНЕНИЕ С NOTION (полная ширина, 90px высота) ━━━
Двухсторонняя таблица 5 строк:
Функция                     | OBS сейчас           | Notion
Autocomplete попover        | ✅ Google Sheets style | ✅ аналогично
Ghost arg hint у курсора    | 🔄 не реализован      | ✅ серый текст аргумента
Функция-документация panel  | ❌ нет                | ✅ expandable правая панель  
Sidebar полей БД            | ❌ нет                | ✅ кликабельный список полей
Превью результата на записи | ✅ частично (дата)    | ✅ любое выражение
Аннотация снизу: "Ключевое отличие: Notion разделяет ввод формулы и
документацию функций в пространстве — не попover поверх, а панель рядом"
━━━ СТИЛЬ ━━━
- Все аннотации: тонкая линия #BDBDBD → pill с текстом 11px
- Слои компонента разделены видимым отступом 8px (показывает "разобранный" вид)
- Каждый слой имеет тонкий violet left-border (3px) с подписью слоя вверху
- Autocomplete popover нарисован с реальным смещением +8px вверх от textarea
- Цвет состояний: зелёный #4A9B6F, красный #D44C47, violet #6B63E8, серый #787774
- Типографика: Inter, 3 размера (13px body / 11px аннотации / 10px meta)
- Никаких нод, никаких соединительных линий между функциями
- Стиль: техническая документация уровня Stripe Docs или Linear roadmap
---

## ПРИМЕЧАНИЯ ДЛЯ ГЕНЕРАЦИИ

> Все промпты написаны для использования с:
> **Midjourney v6**, **DALL-E 3**, **Adobe Firefly**, **Stable Diffusion XL + ControlNet** (для диаграмм)
>
> Для наилучших результатов с техническими диаграммами рекомендуется:
> - **Claude / GPT-4o + code-to-image**: создать как SVG/HTML, затем скриншот
> - **Mermaid.js** для IMAGE 04 (Pipeline), IMAGE 05 (Reactive Loop)
> - **Figma AI / v0.dev** для PRESET wireframes
> - **Whimsical / Miro AI** для IMAGE 06 (Matryoshka), IMAGE 03 (Taxonomy)
>
> **Единый стиль-гид для всей серии:**
> - Шрифт: Inter или SF Pro Display
> - Радиус углов: 8px (компоненты), 12px (карточки), 4px (пилюли)
> - Тень: только 0 1px 3px rgba(0,0,0,0.08) или border 1px
> - Иконки: Lucide Icons (stroke-only, 24px)
> - Без: реальных фото, декоративных паттернов, 3D-эффектов, сложных градиентов

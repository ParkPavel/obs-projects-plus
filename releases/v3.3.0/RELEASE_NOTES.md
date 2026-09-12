# v3.3.0 — Database View

**Release Date**: April 22, 2026  
**Compatibility**: Obsidian 1.5.7+

## What's New

### Database View
A new **widget-based dashboard** view for your projects. Build custom dashboards with 6 widget types arranged on a responsive grid.

### Widgets
- **Data Table** — grouped data, virtual scroll (>100 rows), conditional formatting, relation/rollup cells
- **Chart** — 9 types: Bar, Horizontal Bar, Stacked Bar, Line, Area, Pie, Donut, Number/KPI, Progress
- **Stats** — KPI card grid with 19 aggregation functions
- **Comparison** — side-by-side metric bars
- **Checklist** — boolean-field-bound todo list with completion counter
- **View Port** — embed another view type (Table, Board, Calendar, Gallery)

### Data Engine
- **Transform Pipeline** — Filter, Group By, Aggregate, Compute, Unpivot, Pivot (with caching and safety limits)
- **Formula Engine** — 50+ built-in functions (Math, String, Date, Logic)
- **Relation Resolver** — cross-note wiki-link relationships
- **Rollup Engine** — 12 rollup functions for computed columns

### Templates
3 one-click presets: Dashboard, Analytics, Kanban+

### i18n
All Database View strings localized: English, Russian, Ukrainian, Simplified Chinese

## Stats
- **40 test suites, 714 tests** (was 23/457)
- **0 TypeScript errors**
- Production build: 1837 KB (main.js) + 28 KB (styles.css)

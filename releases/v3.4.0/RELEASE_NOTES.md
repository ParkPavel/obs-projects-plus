# v3.4.0 — Database View Modernization

**Release Date**: April 18, 2026  
**Compatibility**: Obsidian 1.5.7+

## What's New

### Computation Engine
- **115 built-in formulas** across financial, statistical, conditional, duration, conversion, logic, and aggregate-aware categories
- **Cross-record @reference** support for reading full column values in formulas
- **Relative date operators** for today, week, month, quarter, overdue, upcoming, and rolling day windows

### Visualization
- **8 widgets** including Filter Tabs and Summary Row
- **10 chart types** including Scatter Chart with trend line and R²
- **Stats sparkline** and **Comparison N-metrics** improvements

### Data Integration
- **Multi-source merge** across folders, tags, and Dataview queries
- **Dataview LIST/TASK** parsing with recursive flattening
- **DateTime precision** preserved for Dataview dates
- **Inline add row** support in Database View

### Polish & Accessibility
- **Recursive FormulaNode** editor for deeply nested formulas
- **ARIA tab roving** and improved DataGrid accessibility
- **Pipeline dirty state** warning for unsaved changes
- **Widget resize** handles for dashboard layout refinement

## Stats
- **42 test suites, 839 tests passed**
- **0 TypeScript errors**
- Production build artifacts included in this folder

# Demo Vault — Projects Plus v5.0

This demo vault showcases **all major features** of Projects Plus. Open it as a vault in Obsidian to explore every view, widget, formula, and data source capability.

## Setup

1. Copy `main.js`, `main.css`, `styles.css`, `manifest.json` from the project root into `demo-vault/.obsidian/plugins/obs-projects-plus/`
2. Open `demo-vault` as an Obsidian vault
3. Enable "OBS Projects Plus" in Settings → Community Plugins
4. `Ctrl/Cmd+P` → "Projects Plus: Create Project" → select `Projects/` folder

## Structure

| Folder | Purpose | Notes |
|--------|---------|-------|
| `Projects/` | Primary data source (folder) | 22 task/project notes |
| `Team/` | Relation targets (v5.0 cross-source) | 4 team member notes — declared as `relation` field in fieldConfig |
| `Clients/` | Multi-source merge demo | 4 client notes — add as additional data source |

## What's Pre-Configured (v5.0)

The `data.json` ships with:

- **Two projects**: "Demo Project" (Projects/) and "Team Members" (Team/)
- **Cross-source relations**: `assignee` and `reviewer` fields declared as `relation` pointing to Team Members
- **Field types**: `status` with color groups, `priority` as select with colors
- **Database view**: pre-wired with Filter-Tabs (by status), Stats overview (4 KPI cards), and Data Table
- **Formula fields**: `Budget Utilization` (`ROUND(spent / budget * 100, 1)`) and `Days Remaining` (`DATE_BETWEEN(TODAY(), due, "day")`)
- **Aggregation row**: budget SUM, spent SUM, progress AVG, hours SUM

## Feature Coverage

### Frontmatter Fields Demonstrated

| Field | Type | Where Used | Plugin Feature |
|-------|------|------------|----------------|
| `status` | text (todo/in-progress/done/blocked) | All notes | Board grouping, filters |
| `priority` | text (critical/high/medium/low) | All notes | Conditional formatting, sorting |
| `startDate` / `endDate` | date | Multi-day tasks | Calendar multi-day bars |
| `startTime` / `endTime` | time | Meetings | Calendar timeline slots |
| `date` | date | All notes | Calendar fallback, creation date |
| `due` | date | Deadlines | Filter: is-overdue, is-upcoming |
| `color` | hex color | Selected notes | Calendar color coding |
| `assignee` | `[[wiki-link]]` | All notes | **Relation field** → Team/ notes |
| `reviewer` | `[[wiki-link]]` | Some notes | Second relation field |
| `tags` | list | All notes | Tag grouping, filter-tabs |
| `category` | text | All notes | Filter tabs, board grouping |
| `type` | text | All notes | Chart grouping |
| `progress` | number (0–100) | Tracked tasks | Progress chart, conditional format |
| `budget` | number | Financial tasks | SUM, AVG, financial formulas |
| `spent` | number | Financial tasks | Comparison widget, formulas |
| `hours` | number | Time-tracked tasks | Duration formulas, stats |
| `completed` | boolean | Checklist tasks | Checklist widget |
| `sprint` | text | Sprint tasks | Stacked bar grouping |
| `risk` | text (low/medium/high) | Some tasks | Scatter chart dimension |
| `score` | number | Rated items | Statistical formulas |

### Views to Configure

| View | Configuration | What It Shows |
|------|---------------|---------------|
| **Table** | Sort by priority, filter status≠done | Sorting, filtering, cell navigation |
| **Board** | Group by `status` | Kanban, column persist, drag cards |
| **Calendar** | Date=`startDate`, End=`endDate`, Time=`startTime`/`endTime`, Color=`color` | Timeline, multi-day bars, time slots, color coding |
| **Gallery** | Title + priority + assignee | Card browsing |
| **Database View** | See widget setup below | Full widget dashboard |

### Database View Widgets to Add

| Widget | Configuration | Demonstrates |
|--------|---------------|--------------|
| **Data Table** | All fields, group by category | Conditional formatting, relations, sorting |
| **Chart (Bar)** | X=assignee, Y=count | Bar chart |
| **Chart (Pie)** | X=status | Pie/donut distribution |
| **Chart (Scatter)** | X=budget, Y=progress, Color=priority | Scatter plot with trend line |
| **Chart (Stacked Bar)** | X=sprint, Stack=status | Stacked bar |
| **Chart (Line)** | X=date, Y=progress | Timeline trend |
| **Stats** | budget: SUM, AVG, MAX; progress: AVG, MEDIAN | KPI cards |
| **Comparison** | budget vs spent | Side-by-side metric bars |
| **Checklist** | Field=completed | Boolean toggle list |
| **Filter Tabs** | Field=category | Quick category filter |
| **Summary Row** | count, sum(budget), avg(progress) | Aggregation bar |

### Formula Examples to Try

```
# Financial
PMT(0.05/12, 360, -budget)         → monthly payment
NPV(0.1, budget, spent)            → net present value
IRR([-budget, spent, spent])        → internal rate of return

# Statistical
VARIANCE(@score)                    → variance across all scores
PERCENTILE(@progress, 0.75)         → 75th percentile of progress
CORREL(@budget, @progress)          → budget-progress correlation

# Date
DATE_BETWEEN(endDate, startDate)    → duration in days
FORMAT_DATE(due, "MMM DD")          → formatted date
WORKDAYS(startDate, endDate)        → business days only

# Conditional
IF(progress > 80, "✅", IF(progress > 50, "🔶", "🔴"))
SWITCH(priority, "critical", 4, "high", 3, "medium", 2, 1)

# Aggregation
SUM(@budget)                        → total budget
COUNTIF(@status, "done")            → completed count
AVERAGEIF(@progress, ">50")         → avg progress of advanced tasks

# String
REGEX_MATCH(tags, "bug|fix")        → find bug-related
JOIN(@assignee, ", ")               → all assignees as string
```

### Multi-Source Merge Demo

1. Create a project with `Projects/` as primary source
2. Add `Clients/` as additional source (Settings → Additional Sources)
3. See merged data from both folders in a single view

### Filter Operators to Test

- `is-today` — notes with today's date
- `is-overdue` — notes with `due` before today
- `is-upcoming` — notes with `due` in the future
- `is-this-week` / `is-this-month` / `is-this-quarter`
- `contains` / `not-contains` — text search
- `has-any-of` / `has-all-of` — tag/list matching

---

## Attribution

Projects Plus is a fork of [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) by Marcus Olsson.  
Current maintainer: **Park Pavel** • [Telegram](https://t.me/parkpavel_chigon) • [GitHub](https://github.com/ParkPavel/obs-projects-plus)  
License: [Apache 2.0](../LICENSE)

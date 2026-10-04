# Projects Plus user guide

[Русский](user-guide.md) · [Documentation](README.md) · [Installation and first project](../README.md)

This guide describes the current source code. Some labels may differ in older builds; check the installed plugin version in its settings.

## Understanding your data

A **note** is a Markdown file in your vault. A **field** is a note property, such as `status` or `startDate`. A **project** selects a set of notes through a data source. A **view** determines how that set is displayed. One project can have several views, and one note can belong to several projects.

Editing a writable field updates the original file. Filters, block layout, and view settings are stored separately in `.obsidian/plugins/obs-projects-plus/data.json`. Include this file alongside your notes when backing up or moving a vault.

Calculated fields and query results are not always writable. If you cannot edit a field, check its type and source; a displayed calculation is not necessarily a separate property in the Markdown file.

## Quick start: the demo

When your vault has no project yet, the welcome dialog offers two ways in: the "Demo: three linked projects" card and a "Create new project" button. If you close the dialog, the same two actions stay on the empty projects screen. Later you can create the demo from the project menu (view settings → "Projects" → "Create demo project") or with the **Create demo project** command.

The demo is three projects of one story in the `Projects Plus - Демо 2` folder:

| Project | What it holds | Views |
| --- | --- | --- |
| "Демо: Массажный кабинет" | a private massage practice: 5 services, 10 clients, half a year of visits and expenses | "Обзор кабинета" (stats, profit by month, clients with their visits and wellbeing), "Расписание", "Визиты по статусам", "Клиенты" (a gallery with covers), "Услуги и расходы" |
| "Демо: Трекер" | a daily log kept by three of the practice's clients: weight, sleep, mood, energy, pain, training | "Динамика" (the selected client's measures beside their wellbeing after visits), "Календарь тренировок", "Виды тренировок", "Недели", "Журнал" |
| "Демо: Личный бюджет" | a personal budget: categories with limits and half a year of transactions | "Бюджет" (the practice's income as its own series), "Статьи", "Операции по статьям", "Календарь операций", "Журнал" |

A client card in the practice stores nothing itself: visits, payments, debt, latest and average wellbeing and the last visit are reverse rollups over the visits, while current weight, training minutes and sleep come from the tracker, another project. The folder, field and view names are the actual Russian names the demo writes to your vault — the interface language does not translate them. Running it again restores missing notes and projects and duplicates nothing. Remove the demo like any other projects: delete the three projects in the menu and, if you like, the `Projects Plus - Демо 2` folder.

## Creating and configuring a project

Open the Obsidian command palette and choose **Create new project plus**. Enter a name and select a source. Folder paths are relative to the vault root, for example `Projects/Work`.

| Source | When to use it | What to configure |
| --- | --- | --- |
| Folder | Records are stored together | Path and whether to include subfolders |
| Tag | Records are in different folders | Tag and whether to include its hierarchy |
| Query (filter) | You need filtering without another plugin | Source folder or tag, then filter conditions |
| Dataview | You need a Dataview query | The enabled Dataview plugin and query text |

Build a native query using the dialog fields: for example, source `Projects`, field `status`, equality operator, and value `todo`. With multiple conditions, choose whether all conditions or any condition must match.

For Dataview, enter a complete query, including its type. For example:

```dataview
TABLE status, startDate
FROM "Projects"
WHERE status != "done"
SORT startDate ASC
```

Project settings also let you add sources: folders, tags, or Dataview queries. This combines several note collections in one overview. A native query is available as the primary source; nested queries are not offered as additional sources.

Also check the new-note folder, templates, default name, and excluded files. These matter especially for tag and query projects: selecting existing records and deciding where new notes are created are separate settings.

## Creating and editing records

Use the project's create-note action or **Create new note plus**. Check the selected project in the dialog, enter a name, and choose a template if needed. In the calendar, double-clicking an empty cell can create a note.

These properties are enough to begin:

```yaml
---
title: Prepare meeting
status: todo
priority: high
startDate: 2026-09-15
endDate: 2026-09-15
startTime: "09:00"
endTime: "10:00"
completed: false
color: "#2196F3"
tags:
  - work
---
```

Write dates as `YYYY-MM-DD` and times as `HH:mm`. Quoting times and colors helps preserve them as YAML strings. You choose the field names; map them in view settings afterward.

Open a record through its name or card. In the Dashboard table, a normal click opens the note; Alt opens a record preview instead, and the same action is available from a row-menu entry. After editing, you can open the source file to inspect the stored value. If the plugin reports a write error, do not assume the change was saved.

## Views

### Dashboard and tables

A Dashboard is a workspace made of blocks. Start with one data block: select its source and display mode, such as a table. Add charts, metrics, and other blocks as you need them.

In a table you can edit writable cells, choose columns, sort, and filter records. The schema configures field types, including text, number, checkbox, status, list, formula, and relation. Older saved Table and Database views are converted to Dashboard on load; they are not separate new installation modes.

Each block can have its own source and filters. If two blocks show different records, compare those settings first. To link blocks, configure a dependency on a selected record: selecting a client in one block can then limit another block's data. Placing blocks next to each other does not create a link.

### Board

Choose a grouping field such as `status`. Its values become columns. Dragging a card into another column changes the grouping field in the note, provided the record is writable.

Use the grip to move cards and columns: a card's grip is the strip along its left edge, a column's grip leads its header. A pinned or read-only column cannot be dragged. Persistent columns keep workflow stages visible even when empty.

In the view settings (gear → View) a board can show a cover from an image field on each card: on top, as a small square at the left, or none. A card without an image shows no thumbnail. Use consistent values for a shared process: `todo`, `doing`, and `done` are easier to maintain than several spellings of the same status.

### Calendar and Agenda

Explicitly select event start and end fields in calendar settings. For the example above, use `startDate` and `endDate`; map the time fields to `startTime` and `endTime`, and color to `color`.

When a start field is not configured or is absent, the calendar tries common fields, including `startDate` and `date`, then a date in the filename. Therefore, `date` **can affect event placement**. For predictable results, configure the start field explicitly and fill it in every relevant note.

Switch between year-to-day scales. In week and day modes, timed events appear on a timeline; dragging changes their date or time, and resizing a bar changes its duration. In month and 2-weeks modes, drag a record onto another day to change its date. Use **Today** to return to the current date.

Agenda is a sidebar with event lists. You can select a day and configure filters for individual lists. If an event appears in the calendar but not in Agenda, check the selected date and the list's filter.

### Gallery

Gallery displays records as cards. In the view settings (gear → View) choose the cover field, the layout (grid, masonry or list), the card size (S, M, L or a width), the cover proportions and whether the image fills or fits its frame. The "Fields on the card" section lists the fields a card shows, in their order: move a field up or down, hide it, or show another one; computed fields (formulas and rollups) are marked ƒ, and field names can be shown or hidden.

Cards can be resized: drag the handle at a card's lower right corner (or focus it and use the arrow keys). The size is saved in the view settings, for one card or, through "Card height" in the settings, for all cards of the view; "Reset all card frames" clears them. In a board the frame sets a card's height. If an image is missing, check the field value and whether the image file is available. A card's title opens the record's edit dialog, from which the note itself can be opened; in a read-only gallery the title opens the note directly. The card's menu opens the note in a new tab or window.

## Filters, formulas, and relations

A filter limits displayed records; it does not delete notes. A view's filter lives in its settings (gear → Filters): the tab shows how many conditions are active, clears them all, and saves the filtered selection as a separate source ("Save as source") for other views and blocks. Conditions can be combined using “all” or “any.” Project, view, and block filters act at different levels: clearing one filter does not necessarily clear the others.

Formulas calculate values from fields. Begin with a small expression over numeric fields, such as `budget - spent`. Check the result against a known record before using it in summary statistics. The built-in editor helps you choose fields and functions; valid operations depend on data types.

A relation points to notes in another project. For example, a YAML link can look like this:

```yaml
client: "[[Clients/Maria Ivanova]]"
```

The links in your frontmatter are the relation's data. Configuring a relation leaves them alone: it only tells the plugin where to resolve them. The plugin rewrites a link only when you change the value yourself — in a table cell or in the record editor — and then it writes the new one back to the frontmatter.

**From links to a relation.** Open “Schema,” find the row of the field you want, and choose “Configure.” Set “Type” to “Relation,” then pick the “Target project” — the base its links resolve in. The “Link database…” button opens the wizard, which previews the outcome before anything is saved — “Matched: 3; Not found: 0; Ambiguous: 0” — so a mismatch is visible in advance. A property that already exists as text becomes a relation; your notes are not rewritten.

A formula, a rollup, the record's identifier and a derived property cannot become a relation: their values are computed or belong elsewhere, and a relation would overwrite what produces them. The wizard refuses with one wording for all four — computed, or identifying the record — without naming which case applied.

If several notes share a filename, include the folder in the link. A missing or ambiguous link needs its address corrected; it does not mean a target record was created automatically.

**A summary over related records.** With the relation configured, add a field of type “Rollup”: pick the relation column under “Through relation” and a function such as “Count all.” The card then shows how many records are related — `2` for a client with two sessions, `0` for a client with none. No data pipeline is needed for this.

**A chart over related data.** The “+” in the block palette adds a “Chart”; its settings choose the type and the X and Y axes. Dates on the X axis group by day, week, month, quarter or year, and the Y axis can take a sum, an average, a min, a max, a median, a count or a unique count.

## Computation across tables and projects

**A reverse rollup — a total over the records that link here.** A client needs no field listing its visits: the visits link to the client. In the rollup field's settings, pick under “Through relation” a source marked “(links here)” — the project and the field through which its records point at this one. “Count all” gives the number of visits, “Sum” over the price field the amount paid, “Last value” over the wellbeing field the latest score. The client's note does not change: a rollup is computed, never written to the note, and cannot be edited.

**First and last value** are picked by an ordering field — usually a date. Choose it from the list; if the property you need is not there (the list knows only the fields configured in the source project), choose “Another field…” and type the property name.

**Another project's data in charts and stats.** In a chart's or stats block's settings, “Data from” switches the source to another project; the block's filter and pipeline then run over its records. While that project loads, the block says so instead of showing the current project's numbers. If the project was deleted, the list keeps an “Unavailable project” entry — choose “This project” to clear it.

**Several series on one chart.** Add series in the chart's settings: each has its own field and aggregation, and optionally another project, its own X field and the right-hand axis (for values of different scale, such as weight and training minutes). Series line up on the shared axis labels; a day without a value is a gap in the line, not a zero. Bars can go below zero: a month with a loss shows under the axis.

**Follow the selection in another block.** “Follow selection in” ties a chart or stats block to a table on the same Dashboard: pick a table row (row menu → “Filter linked blocks by this row”) and the chart shows only the records linked to it. In the demo, picking a client leaves that client's visits and tracker on the chart.

**A block from another project is read-only.** A data block whose source is another project is read-only as a whole: table cells cannot be edited, the row menu has no duplicate or delete, the board does not drag cards, and the calendar and gallery open no editor — a card opens the note. The record panel (“Show fields”) says which project the record belongs to. Edit such records in their own project.

**The linked-block suggestion.** When a project has a relation field, a suggestion “Add data block” appears above the blocks. It adds a block that shows the records related to the selected row: another project's records that link here, or — when the relation only points outward — the record the selected row links to. On a filtered view (for example, clients only) the block reads the project whole, so it can see the records the view's filter hides.

**The three-project demo.** The practice, the tracker and the budget (see "Quick start: the demo") show computation at work. In the practice, clients and services count visits, revenue and wellbeing through reverse rollups, and weight, training and sleep through rollups over the tracker. On "Обзор кабинета" pick a client row (row menu → "Filter linked blocks by this row"): their visits and the wellbeing chart, with a mood series from the tracker, narrow to that client. The tracker's "Динамика" follows the client picked in its block of the practice's clients the same way. The budget shows the practice's income as a separate series beside its own income and expenses.

## Note templates

### Built-in templates

Create a normal Markdown template file and add it to the project's template list. Select it when creating a note. Template content supports `{{title}}`, `{{date}}`, and `{{time}}`; dates and times accept a format, such as `{{date:YYYY-MM-DD}}`.

```markdown
---
status: todo
startDate: {{date:YYYY-MM-DD}}
---

# {{title}}

## Work to do

## Result
```

The default note-name setting supports date and time, for example `{{date:YYYY-MM-DD}} Task`. Variables such as `{{project}}` and `{{author}}`, and conditional blocks such as `{{#if ...}}`, are not features of the built-in processor.

### Templater

Files in the [templates folder](../templates/README.md) use Templater syntax (`<% ... %>`) and require the separately enabled Templater plugin. Create the note using its command and place the result in the project's folder. Projects Plus's built-in substitution does not execute Templater code.

## Keyboard and touch

Assign global command shortcuts in Obsidian's Hotkeys settings. The plugin does not assign them by default. Command names follow the interface language.

| Calendar action | Keys while the calendar has focus |
| --- | --- |
| Previous / next period | `←` / `→` |
| Return to today | `T` |
| Zoom in / out | `+` / `-` |
| Change zoom | `Ctrl` or `Cmd` + `←` / `→` |
| Return to the previous position | `Backspace` |
| Close the day overview | `Escape` |

These shortcuts are not intercepted while typing into a field. On touch screens, the calendar supports swiping between periods and a two-finger zoom gesture. To drag on the board, start from a grip; use ordinary scrolling to browse. A swipe that starts inside the plugin scrolls the plugin; only a swipe from the screen edge opens Obsidian's side panels. Individual gestures depend on the platform and view mode.

## Settings and troubleshooting

Plugin settings include the project size limit, first day of the week, and property-writing preferences. Configure individual sources and views inside their project.

| Symptom | What to check |
| --- | --- |
| A note is missing | Source path, subfolders, tag, exclusions, and every filter level |
| Only some records are loaded | Project size limit |
| An event appears on the wrong date | Start field, stored date, and calendar timezone |
| Dataview is unavailable | Whether it is installed and enabled in this vault |
| A field cannot be edited | Field type, calculated value, and source write capability |
| `<% ... %>` remains in a note | Whether the template was processed by Templater |
| An edit did not persist | Error message and actual Markdown file contents |
| Settings cannot be saved after a conflict | Plugin message; keep a copy of `data.json` before restoring |

When reporting an issue, include the Obsidian and plugin versions, device, source type, reproduction steps, and expected and actual behavior. Attach a small anonymized note example. Do not submit your entire personal vault or settings containing private paths.

[Report an issue](https://github.com/ParkPavel/obs-projects-plus/issues) · [Custom view API](api.md)

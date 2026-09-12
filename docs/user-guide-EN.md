# Projects Plus user guide

[Русский](user-guide.md) · [Documentation](README.md) · [Installation and first project](../README-EN.md)

This guide describes the current source code. Some labels may differ in older builds; check the installed plugin version in its settings.

## Understanding your data

A **note** is a Markdown file in your vault. A **field** is a note property, such as `status` or `startDate`. A **project** selects a set of notes through a data source. A **view** determines how that set is displayed. One project can have several views, and one note can belong to several projects.

Editing a writable field updates the original file. Filters, block layout, and view settings are stored separately in `.obsidian/plugins/obs-projects-plus/data.json`. Include this file alongside your notes when backing up or moving a vault.

Calculated fields and query results are not always writable. If you cannot edit a field, check its type and source; a displayed calculation is not necessarily a separate property in the Markdown file.

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

Open a record through its name or card. The **Link behavior** setting determines whether a normal click opens the property editor or the note. After editing, you can open the source file to inspect the stored value. If the plugin reports a write error, do not assume the change was saved.

## Views

### Dashboard and tables

A Dashboard is a workspace made of blocks. Start with one data block: select its source and display mode, such as a table. Add charts, metrics, and other blocks as you need them.

In a table you can edit writable cells, choose columns, sort, and filter records. The schema configures field types, including text, number, checkbox, status, list, formula, and relation. Older saved Table and Database views are converted to Dashboard on load; they are not separate new installation modes.

Each block can have its own source and filters. If two blocks show different records, compare those settings first. To link blocks, configure a dependency on a selected record: selecting a client in one block can then limit another block's data. Placing blocks next to each other does not create a link.

### Board

Choose a grouping field such as `status`. Its values become columns. Dragging a card into another column changes the grouping field in the note, provided the record is writable.

Use the grip icon to move cards and columns. Persistent columns keep workflow stages visible even when empty. Use consistent values for a shared process: `todo`, `doing`, and `done` are easier to maintain than several spellings of the same status.

### Calendar and Agenda

Explicitly select event start and end fields in calendar settings. For the example above, use `startDate` and `endDate`; map the time fields to `startTime` and `endTime`, and color to `color`.

When a start field is not configured or is absent, the calendar tries common fields, including `startDate` and `date`, then a date in the filename. Therefore, `date` **can affect event placement**. For predictable results, configure the start field explicitly and fill it in every relevant note.

Switch between year-to-day scales. In week and day modes, timed events appear on a timeline; dragging changes their date or time, and resizing a bar changes its duration. In other modes, edit dates through record properties. Use **Today** to return to the current date.

Agenda is a sidebar with event lists. You can select a day and configure filters for individual lists. If an event appears in the calendar but not in Agenda, check the selected date and the list's filter.

### Gallery

Gallery displays records as cards. Choose a cover field and the properties to show on each card. If an image is missing, check the field value and whether the image file is available. A card's title opens its record according to the link behavior setting.

## Filters, formulas, and relations

A filter limits displayed records; it does not delete notes. Conditions can be combined using “all” or “any.” Project, view, and block filters act at different levels: clearing one filter does not necessarily clear the others.

Formulas calculate values from fields. Begin with a small expression over numeric fields, such as `budget - spent`. Check the result against a known record before using it in summary statistics. The built-in editor helps you choose fields and functions; valid operations depend on data types.

A relation points to notes in another project. For example, a YAML link can look like this:

```yaml
assignee: "[[Team/Alice Chen]]"
```

Configure the target project for the relation field. If several notes share a filename, include the folder in the link. A missing or ambiguous link needs its address corrected; it does not mean a target record was created automatically. After configuring the relation, a rollup can calculate a summary over related records.

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

These shortcuts are not intercepted while typing into a field. On touch screens, the calendar supports swiping between periods and a two-finger zoom gesture. To drag on the board, long-press the grip icon; use ordinary scrolling to browse. Individual gestures depend on the platform and view mode.

## Settings and troubleshooting

Plugin settings include the project size limit, link behavior, first day of the week, and property-writing preferences. Configure individual sources and views inside their project.

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

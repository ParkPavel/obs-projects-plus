# Changelog

> [Русский](CHANGELOG-RU.md) · English

This file describes the current development line and changes to consider when updating.
Downloadable versions and their publication dates are listed in
[GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).
The version in [manifest.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/manifest.json) identifies this source tree; it does not
mean that a new release has been published.

## 3.7.2 — unreleased

### Safety and stability

- Dragging board columns can no longer hang Obsidian: a handler leak is closed, a column dropped where it
  was writes nothing, and a drag that never ends is released on its own.
- The calendar no longer freezes on the month view: day cells create no hidden frames and at most 24 months
  stay in memory.

### Calendar

- Month and two weeks: event bars are proportional to time and no longer overlap (on phones too); labels
  are gone — an event is found by its colour and place in the day, its title is the tooltip and in the day
  window. Extra columns go behind "+N". Multi-day strips are thin colour bands, packed per week.
- Week and day: an event shorter than an hour (from 15 minutes) is drawn at its length; an overnight event is
  drawn in parts per day; an event of 24 hours or more lives in the all-day row.
- Week and day: a drag over the time grid creates the event over exactly that range (it was always one hour);
  on a phone a tap on empty time opens the creation preview, and the day opens from its header. The length
  a tap or click creates is a view setting: 15, 30, 60 (default), 90 or 120 minutes.
- Stretching a multi-day event over more days is saved; without an end field `endDate` is created.
- A record's "Settings" in the day window open the note's properties block. The duplicate window follows
  Obsidian's modals: a time field and an action footer.

### Note properties

- The Projects Plus properties block is shown at the top of every Markdown note in place of Obsidian's
  built-in Properties. Turn it off in the plugin settings: "Properties in the note header".
- Rename and delete a property; lists and tags as separate items (a comma inside an item is kept); status
  picked from the values the project uses; a colour palette with shared favourites; arrow keys move between
  rows. Nested values are read-only. Only the note's own frontmatter is written.
- Properties reorder by drag (or Alt+Up/Down) and the order is written to the note's YAML; Tab moves to the
  next value. The board pencil and gallery editing open the same block.

### Board

- Columns drag by their grip again; the column menu has Move left / Move right.
- Pinning a column is a view setting and no longer follows the status options.

### Dashboard and data

- A wide dashboard is a tile grid: resize a block by its corner, snapping to the grid. On a phone it is a
  stack with a jump bar of block titles.
- A source's "Properties" moved from the toolbar into the block menu.
- Tables: the first column is pinned only from its header menu; a scroll that reaches the table's edge
  carries on into the page; option pills read on any background; lists and dates in formulas show by type.
- A filtered dashboard block can be the source of another block, a chart or a relation; loops are refused.
  Rollups read rollups (up to three levels); formulas run in dependency order. A rollup can total a
  formula of its own project (a client sums its visits' `IF(paid, price)`), and a formula can read a rollup.
- Values read from Dataview keep 0, false and empty text; a date and time read as text keeps its time.
- The demo projects compute a visit's payment, debt and session and an operation's income, expense and
  balance with project formulas, so a change to a note moves the totals.
- A board, calendar or gallery tab in a block can be linked to a project view: it takes that view's
  settings, sort and filter; "Unlink" keeps them in the tab.
- "Properties" in view settings: search, show and hide by the eye icon, order by drag; the list applies to
  the dashboard's tables unless a table set a column itself.
- Spreadsheet formulas: SUMIF, COUNTIF, AVERAGEIF, SUMIFS, COUNTIFS, AVERAGEIFS, MINIFS, MAXIFS; a
  column aggregate is computed once; fields named in Cyrillic or any other script work in formulas; the
  formula editor's highlight sits on the caret.

### Gallery

- Cover from a list value or the note's first image, a text preview, grouping by a field, a width slider, a
  title-only mode and lazy images. Two cards a row on a phone.

### Phone and fields

- The view tabs sit in the header in place of "Projects".
- The suggestion list opens above its field, follows it and keeps typed text. Search no longer overwrites
  what is being typed. The field list in view settings is one line per field.

## 3.7.0 — 2026-10-05

### Cards and gallery

- Gallery view options: layout (grid, masonry, list), card size (S, M, L or a width), cover proportions
  (16:10, 4:3, 1:1, 3:4, 2:3 or no cover) and fill or fit. Old galleries look as before.
- "Fields on the card" in the gallery settings lists the fields a card shows, in order: move, hide or add a
  field; formulas and rollups are marked ƒ; field names can be hidden. Cards follow that order. The
  project's declared rollups now appear in the settings (card fields, filters, sort, colors).
- Resizable card frames: drag a card's lower right corner (or use the arrow keys on it). A size can be set
  for one card or for the whole view ("Card height"), and "Reset all card frames" clears them. Saved in
  the view settings, never in notes.
- Board card thumbnails: a cover on top, a small square at the left (it grows with the card frame, up to
  40% of the card) or none. A card without an image, or whose image fails to load, shows none.
- Gallery and board cards share one card component.

### Board

- Drag grips have their own place: a strip along the card's left edge and the first cell of a column
  header. They no longer cover field labels or titles, are visible without hovering and get a finger-sized
  target on touch screens.
- A pinned or read-only column can no longer be dragged by its grip. A pinned column's header keeps its
  title on touch screens.
- Fixed: a board whose columns were frozen by an older version (saved as `freezeColumns`) shows them
  pinned again; the settings already showed it as frozen.

### Filters and settings

- The filter row under the navigation bar is gone, which gives the views that height back. A view's filter
  lives in its settings (gear → Filters), which show the number of active conditions, clear them all and
  save the selection as a source ("Save as source").
- Picking a field from a field list in the settings is accepted at once, and typed names and numbers are
  no longer reset while typing.
- Filter conditions wrap inside a narrow settings panel.

### Touch and small screens

- A finger scrolls the dashboard instead of dragging widgets; widgets move by their grip. A swipe inside
  the plugin no longer opens Obsidian's side panels; a swipe from the screen edge still does.
- Landscape phones get a slim header and a filter button; view tabs scroll when they do not fit; the
  settings panel opens below the navigation bar; the last items of every view scroll above Obsidian's
  floating bar.
- Touch targets of at least 44 points; text fields at 16 so iOS does not zoom; essential labels on
  phones (calendar days and events, the year overview, view tabs, chart axes) no smaller than 11 points;
  reduced motion is honoured everywhere.
- Board cards and calendar events can be moved by touch; calendar strips open their record on tap and
  on click; a swipe right after a drag still pages the calendar.
- The whole plugin is sized in relative units.

### Themes

- The plugin's styles no longer reach Obsidian's own interface: the navigation bar's icon rule used to
  change every icon in Obsidian once a Projects view had opened.
- Hairlines follow Obsidian's border width, so themes that change it apply to the plugin. Shadows, dims
  and colours come from the theme; quiet labels (counts, empty states, weekend names) reach WCAG AA
  contrast in the default light and dark themes.

### Upgrading

- Filters are edited in the view settings (gear → Filters); nothing about existing filters changes.
- Gallery cards show fields in the order saved in the view settings, which may reorder fields in views
  whose saved order differed from the notes' order.
- Plugin icon buttons outside the navigation bar look like Obsidian's own icons.
- After updating, restart Obsidian (or reload the window) so styles of the previous version are dropped.

## 3.6.3 — 2026-09-28

- The plugin is named **Projects Plus** (was «OBS Projects Plus»): the community directory does not accept
  part of the Obsidian name in a plugin name. The plugin id `obs-projects-plus` is unchanged, so installed
  copies, their settings and data stay as they are.
- `README.md` is now the English overview, with Installation, Usage and Privacy sections; the Russian
  one is `README-RU.md`.
- Release assets carry GitHub build provenance attestations.

## 3.6.2 — 2026-09-28

### Ready for the community directory

- The code passes the Obsidian community directory's automated review set
  (`eslint-plugin-obsidianmd` recommended: type-checked TypeScript and the
  Obsidian plugin rules) with no errors or warnings, and CI enforces it.
- The interface language comes from Obsidian's own setting (`getLanguage()`)
  rather than from `moment` or local storage.
- Fixed: a template whose `tags` is a single string, not a list, no longer
  merges into a new note's tags letter by letter.
- Fixed: a plain object value (in a join key, an exported cell, or front
  matter of an unexpected shape) is written as its content rather than
  `[object Object]`; as join keys, such values no longer all match each other.

## 3.6.1 — 2026-09-28

### Demo rebuilt

- **The demo is three new projects**, each larger than the single demo it replaces:
  «Демо: Массажный кабинет» (a massage practice), «Демо: Трекер» (three clients' daily wellbeing log)
  and «Демо: Личный бюджет» (a personal budget). The studio project is gone.
- The new demo is created in the `Projects Plus - Демо 2` folder. A 3.6.0 demo (folder
  `Projects Plus - Демо`) is left as it is: the new one neither changes nor mixes with it, and
  the old one can be deleted by hand.
- Client cards compute visits, payments, debt, wellbeing, weight, training and sleep from the
  practice's visits and from the tracker; services count their sessions and revenue. The
  tracker and the budget chart series read from the practice, and the gallery shows offline
  covers.
- **The starter profiles are removed.** The welcome dialog offers the demo and «Create new
  project»; closing it leaves an **empty projects screen** with the same two actions, and the
  project menu gains «Create demo project», so the demo stays reachable after the first run.

## 3.6.0 — 2026-09-27

The first version published in the format of the Obsidian community catalogue. It brings
computation across tables and projects, charts over the computed values, three linked demo
projects, a clear read-only boundary for data that belongs to another project, and a pass
over everything a catalogue reviewer checks.

### Computation across tables and projects

- **Reverse rollups.** A record can aggregate the records that link *to* it: a client counts
  its visits, sums what they paid, or takes the latest wellbeing score, while its own note
  stays unchanged. In the field dialog pick a source marked «(links here)».
- **First and last value** rollups pick a value by an ordering field, usually a date. Pick it
  from the list, or type any property of the source with «Another field…».
- A declared rollup is a column even when no note carries its key. A view filter on a rollup
  column is kept.
- Rollups are read-only, shown by their mode (percent bar, chips, count), and a percent shows
  the engine's 0–100 value.
- Blocks that read another project see that project's rollup columns too. Changing a rollup
  (for example sum → average) refreshes every block that reads it.
- The calculation engine is checked against a real spreadsheet: an aggregate without a
  group-by is one total, and every path agrees on what "checked" means.

### Charts and statistics

- A chart or stats block can read **another project** («Data from»). While that project
  loads, the block shows a state and never this project's numbers. A deleted source stays
  selectable so it can be cleared.
- A chart can hold **several series**, each with its own field, aggregation, project, x field
  and axis. A right-hand axis is available; bars can go below zero, and a missing value is
  a gap, not a zero.
- Charts and stats **follow the record picked in another block** through a relation («Follow
  selection in»). This also works for scatter charts.
- Readability: the value axis of bar charts is labelled, legends show colour marks, isolated
  points stay visible, smooth areas follow their line, and a chart's settings offer the
  columns its pipeline made.

### Demo

- «Create demo project» creates **three linked projects**: the studio, a massage room and
  personal finances. The finances read the room's income and the studio's payments, and the
  room's clients count their visits and payments through reverse rollups.
- Running the command again restores what is missing and never duplicates notes, on any day.

### Relations and the read-only boundary

- A block that reads another project is **read-only as a whole**. Its board, calendar and
  gallery open no editor, and its row menu offers no duplicate or delete. The record panel
  says which project the record belongs to.
- Frames read from another project carry that project's declared relation types.
- **Linked-block suggestion:**
  - it reads the right project through the right relation;
  - it can also follow the master's side of a relation («Show the linked record of the row you
    pick»);
  - on a filtered view it reads the project whole;
  - accepting it dismisses it only once the block really works.
- Closing the record panel keeps an edit made within the autosave delay.

### Platform and catalogue readiness

- `manifest.json` meets the catalogue rules; the minimum Obsidian version is **1.8.7**.
- Note writes use the platform APIs:
  - bulk field changes go through `processFrontMatter`;
  - read-modify-write goes through `Vault.process` on the current contents;
  - the settings recovery note goes through `Vault.create`;
  - template paths are normalised.
- The plugin releases everything it registered when it unloads.
- Static styles moved from scripts to CSS classes.
- The settings tab reads like Obsidian's own, and the inert «Link behavior» control is gone.
- The schema commands appear only where a dashboard handles them. The «Open formula editor»
  command, which did nothing, is gone.
- Onboarding text is parsed into nodes and never rendered as HTML.
- No false ENOENT warning on the first settings write in a fresh vault.

### Languages and accessibility

- Ukrainian and Simplified Chinese are complete against Russian. The aggregation vocabulary,
  stats wording, the record panel's field groups and every word in the markup come from the
  locale layer.
- Icon buttons work from the keyboard.

### Updating from an earlier version

- Replace all three files (`main.js`, `manifest.json`, `styles.css`) from the same release,
  and keep `data.json`.
- **Saved configurations stay valid.** New keys are optional and only written when you use the
  feature:
  - `config.dataProjectId`, `config.series` and `config.linkedSelection` on charts and stats;
  - `relationSide` on a linked selection;
  - `backlink` and `orderBy` on a rollup.
- **The demo notes changed their names** from dates to series numbers. A demo created by a
  3.6.0 pre-release keeps its old notes; delete the demo folder and run the command again for
  a clean copy.

### Build and release

- **Versions:**
  - a release is `x.y.z` in `package.json`, `manifest.json` and `versions.json`, and its tag
    is the same string without a `v`;
  - the release workflow refuses a tag that does not match the manifest;
  - pre-releases for [BRAT](https://github.com/TfTHacker/obsidian42-brat) use tags
    `x.y.z-beta.N` and are marked as pre-release on GitHub.
- **Release assets:** `main.js`, `manifest.json` and `styles.css`. `styles.css` merges the
  design tokens and the handwritten styles; the build checks both are present.
- `main.js` is still tracked in Git and is rebuilt from the release commit.
- **Requirements:** Obsidian 1.8.7 or newer, desktop and mobile. Dataview is optional; the
  Dataview source reports when it is missing.

### Documentation

- The documentation a user reads was rewritten short. The README is 62 lines instead of 305
  and the user guide 196 instead of 688: each page answers a question a reader has, rather
  than listing everything the plugin contains.
- The documentation a contributor reads was rewritten too. One architecture map links each
  responsibility to the file that implements it; one contribution guide carries the coding
  rules, so the two `CODE_STANDARDS` pages are gone without a rule going with them. The API
  references and the library notes under `src/lib` were rewritten against the current source.
- Corrected what no longer matched the plugin: a project has four views — Dashboard, Board,
  Calendar and Gallery — a table is a block inside a Dashboard rather than a view of its own,
  and the only public extension point is `onRegisterProjectView`. The `getProjects` /
  `createProject` / `registerView` API the guides described does not exist.
- Every document exists in Russian and English: as a pair of files, or bilingual in one file
  for the index, the error codes and the two pages a reader meets inside a vault. A test keeps
  that in place.
- Internal plans, agent reports, session instructions and duplicate release documents are no
  longer part of the tree. Development is managed with
  [Claudex](https://github.com/ParkPavel/claudex); earlier versions remain in Git history.

### Fixes

- A console line no longer quotes the message template. Codes whose text carries a placeholder
  such as `{{path}}` printed it verbatim, so a user quoting their console reported the template
  while the notice beside it named the real file. A placeholder with nothing to fill it now reads
  `<path>`, which tells the reader the value is unknown rather than that the code is unfinished.

### Development

- Retired tests of the old project-local agent hooks and configuration. Plugin behaviour tests
  remain here; Claudex checks its own harness and publication guards.
- The filter-order test no longer asserts sentences in a design document; it pins the wiring,
  which is the part that can silently regress.
- CI checks pull requests without writing beta metadata or pushing changes to `main`. Tagged
  releases still use the release workflow.

## 3.6.0-alpha

This is a development version. The following summary focuses on changes that affect
notes, saved views or the way users work with the plugin.

### Relations and dashboard data

- Relation fields identify linked notes and report unresolved or ambiguous matches.
  The setup dialog supports choosing a target project and display field.
- Related records and rollups can use data from another project. Dashboard interactions
  can narrow a block's records through an existing relation.
- External-source blocks use their own source for data and field configuration.
  Gallery blocks with an external source are read-only.

### Updating saved dashboards

- A block filter narrows the records **before** advanced transformations run. A saved
  dashboard that combines both may display different results after updating.
- During migration, a leading pipeline filter moves to the block filter only when that
  move is safe. Conditions that depend on a column created by the pipeline remain there.
  This changes view configuration, not the source notes.
- The old sub-base widget is no longer available. Legacy configuration fields remain
  readable for compatibility, but they do not restore the removed widget.

### Fixes

- Rollup configuration made through the interface is passed to the calculation engine.
- Relation setup waits for the write result and preserves the selected display field.
- Record updates report failed writes instead of treating them as completed changes.
- Generated demo dashboards use the current block-filter representation.
- The stylesheet build checks that the handwritten styles are present before producing
  the installation bundle.

## Earlier versions

Older release notes and internal records remain in Git history. They describe the version
in which they were written and are not instructions for the current tree.

- [Published releases](https://github.com/ParkPavel/obs-projects-plus/releases)
- [Full changelog before the documentation cleanup](https://github.com/ParkPavel/obs-projects-plus/blob/0e4b69f43de57477b0172575c098776899b10dfd/CHANGELOG.md)

For current behaviour, use the [documentation index](docs/README.md).

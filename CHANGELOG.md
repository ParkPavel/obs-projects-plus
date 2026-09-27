# Changelog

> [Русский](CHANGELOG-RU.md) · English

This file describes the current development line and changes to consider when updating.
Downloadable versions and their publication dates are listed in
[GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).
The version in [manifest.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/manifest.json) identifies this source tree; it does not
mean that a new release has been published.

## Unreleased

### Demo rebuilt

- **The demo is three new projects**, each larger than the single demo it replaces:
  «Демо: Кабинет» (a massage practice), «Демо: Трекер» (three clients' daily wellbeing log)
  and «Демо: Финансы» (a personal budget). The studio project is gone.
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

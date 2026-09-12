# Changelog

> [Русский](CHANGELOG-RU.md) · English

This file describes the current development line and changes to consider when updating.
Downloadable versions and their publication dates are listed in
[GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).
The version in [manifest.json](manifest.json) identifies this source tree; it does not
mean that a new release has been published.

## Unreleased

### Documentation

- The documentation a user reads was rewritten short. The README is 62 lines instead of 305
  and the user guide 168 instead of 688: each page answers a question a reader has, rather
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

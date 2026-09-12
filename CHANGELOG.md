# Changelog

This file describes the current development line and changes to consider when updating.
Downloadable versions and their publication dates are listed in
[GitHub Releases](https://github.com/ParkPavel/obs-projects-plus/releases).
The version in [manifest.json](manifest.json) identifies this source tree; it does not
mean that a new release has been published.

## Unreleased

### Documentation and development

- Reorganised the documentation around installation, daily use and contribution.
  Russian and English guides now distinguish supported behaviour from limitations.
- Removed internal plans, agent reports, session instructions and duplicate release
  documents from the current tree. Development is managed with
  [Claudex](https://github.com/ParkPavel/claudex); its configuration lives separately.
- Retired tests of the old project-local agent hooks and configuration. Plugin behaviour
  tests remain in this repository; Claudex checks its own harness and publication guards.
- CI checks pull requests without writing beta metadata or pushing changes to `main`.
  Tagged releases still use the release workflow.

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

# Projects Plus 3.7.2

[Русский](release-3.7.2-RU.md) · [Download](https://github.com/ParkPavel/obs-projects-plus/releases/tag/3.7.2) · [Changelog](../CHANGELOG.md)

Released November 14, 2026. Requires Obsidian **1.8.7 or newer**. This release combines the stabilization work on editing, mobile forms, calendars, boards and calculated data. Notes remain Markdown files in your vault.

## What changes in daily use

- Toggle writable Boolean properties directly on board cards without opening the note inspector. Computed and read-only values remain protected.
- Use the palette and its favorite colors within the form's main scroll area. New event forms start with the palette expanded.
- Edit an Agenda list on iPhone with the keyboard open: the fields remain visible, suggestions stay within their available area, and Save/Cancel remain reachable. Repeated keyboard opening no longer collapses the form.
- Reach computed properties in the note inspector after collapsing ordinary properties, using the same scroll area.
- Edit text, numbers, dates and lists through shared draft controls, with explicit confirmation/cancellation and IME handling. A failed write retains the draft for retry.
- Use Agenda lists as the selected date intersected with the list's conditions. On mobile, hold empty calendar time, stretch the range and release to open event creation. Board columns temporarily fold during a drag and restore their previous state afterwards.
- Configure embedded views locally and use linked projects, relations, rollups, charts and computed columns on a Dashboard. See the [user guide](user-guide-EN.md) for the supported controls and limits.

## Formula migration needs attention

Formulas, calculated transform columns and Agenda filters now use one strict **`unified-v1`** evaluator. Expressions remain unchanged, but results can change because the old rules are removed. For example, the previous numeric interpretation of `"2" < "10"` becomes strict string comparison and returns `false`.

The plugin verifies a settings backup before publishing migrated settings. Backup files named `formula-unified-*.data.json` and migration reports named `formula-unified-*.report.json` are kept in its plugin folder. A failed backup blocks migration. The report identifies migrated definitions and syntax errors; it is not a comparison of every record's old and new result.

Update all devices together, retain these files, and check known examples in your own data. Formula results are computed values and do not overwrite the source notes. Unknown future formula versions fail closed. Regular expressions with excessive or unconfirmed complexity are rejected before execution.

## Install or update

1. Back up your vault, including its configuration folder, the previous plugin assets and `data.json`.
2. From the same release, download `main.js`, `manifest.json` and `styles.css`. Replace those three files in `.obsidian/plugins/obs-projects-plus/`, or your custom configuration folder. Keep `data.json`.
3. Restart Obsidian, confirm version **3.7.2**, then check editing, saved settings and formula examples. If you synchronize plugin files, run synchronization on the sending and receiving devices and restart the receiving app; a copied archive alone does not install the plugin.

For rollback, restore the previous matching plugin assets **and** the original settings while Obsidian is closed. Preserve any newer settings separately first. Restoring only old settings under the new engine cannot restore the removed formula rules. See [Updating and rolling back](upgrade.md) for the full procedure.

## Validation and support

The release's editing and layout scenarios passed automated checks and maintainer testing on desktop and a physical iPhone. This describes that tested scope, not every possible device, theme or vault configuration.

Report a reproducible problem through [Issues](https://github.com/ParkPavel/obs-projects-plus/issues), with plugin/Obsidian versions, device, steps and expected/actual behavior. Remove personal note content from examples. Internal development contracts and old stabilization matrices are historical records; use this guide and the current user guide for release behavior.

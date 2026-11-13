# Updating and rolling back

[Русский](upgrade-RU.md) · [User guide](user-guide-EN.md)

Use the three assets from **one published release**: `main.js`, `manifest.json` and `styles.css`. A development build or a successful automated test run does not establish that a version has passed testing on your device. Read that release's notes before installing it.

## Before updating

1. Back up the vault, including its hidden configuration folder. Keep the previous plugin assets and `.obsidian/plugins/obs-projects-plus/data.json` together; `data.json` holds your projects and view settings. Replace `.obsidian` with your custom configuration folder if applicable.
2. Complete any pending edits. For a candidate build, start with a copy of the vault and check the workflows you use before updating your main vault.
3. Record the plugin version, Obsidian version and device. Keep the build manifest or checksum if the candidate supplies one: two development builds can have the same displayed version.

## Install the update

1. Disable Projects Plus in Obsidian's community plugin settings.
2. Replace the three plugin assets in `.obsidian/plugins/obs-projects-plus/` with the matching release files. Keep your `data.json`.
3. Enable the plugin again, or restart Obsidian. Reopen the project and confirm the installed version.

## Synchronize devices

Plugin files live in a hidden configuration folder, which your sync tool may exclude. Check that folder synchronization is enabled and that the receiving device downloads changes. Manual-only synchronization needs an explicit run on both devices. Restart Obsidian after receiving the three matching assets; synchronizing a ZIP does not install it. Keep `data.json` unless you intentionally want to reset the configuration.

## Synchronize devices

Plugin files live in a hidden configuration folder, which your sync tool may exclude. Check that folder synchronization is enabled and that the receiving device downloads changes. Manual-only synchronization needs an explicit run on both devices. Restart Obsidian after receiving the three matching assets; synchronizing a ZIP does not install it. Keep `data.json` unless you intentionally want to reset the configuration.

## Check your workflows

| Workflow | What to check |
| --- | --- |
| Notes and typed values | Edit text, a number, a date and a list. Confirm the edit, open the Markdown note, then reload the view. Check values and types, including an empty value. |
| Input and suggestions | Type in the original field, select a suggestion and confirm. With an IME, finish composition before confirming. Cancel another edit and check that it did not save. |
| Calendar and Agenda | Select a day and check that each list shows records for that day which also satisfy its conditions. Create an event and check the configured date, status and colour properties in the note. |
| Embedded views | Open two blocks with different local settings. Changing a block's view or filter should preserve the other block and its source configuration. |
| Charts and linked blocks | Select a chart bucket, check the records in its receiving blocks, then clear the selection. Include a grouped date bucket if your chart uses one. |
| Board | Move a card and a column; cancel another drag. Check the saved order and that each column returns to its previous collapsed or expanded state. |
| Phone and tablet | Repeat relevant checks with the keyboard open and closed, portrait and landscape, and your usual zoom. Check that the original field, confirmation action and suggestions stay reachable. |

Version 3.7.2 replaces the previous formula rules with one `unified-v1` engine. Existing definitions migrate automatically; expressions remain unchanged but results can change. Before publishing migrated settings, the plugin writes and verifies `formula-unified-*.data.json` and `.report.json` in its plugin folder. The report lists affected definitions and syntax errors; it does not claim to compare every record result. A failed backup blocks migration. Update every device together and check known examples after updating. Excessive computations may return an error or a pipeline warning; a stopped pipeline retains its last fully completed step.

Regular expression checks apply to existing formulas and filters as well as new ones. A pattern with excessive or unconfirmed complexity is rejected before execution. If an existing expression reports this error, simplify its pattern; changing the formula compatibility profile does not disable the check. Admitted patterns keep native matching and replacement behaviour.

## Roll back

Disable the plugin and close Obsidian. Preserve any settings changed since updating separately. Restore the previous **matching set of three assets** and the original `data.json` from the verified migration or installation backup, then reopen Obsidian. Restoring only old settings under the new engine cannot restore the removed rules. The migration does not rewrite note files.

Replacing plugin files does not undo edits already written to notes. If you need to undo those changes, restore the affected notes from your vault backup after reviewing changes made since the backup. Test the restored copy before replacing working data.

## Report a problem

Include the plugin and Obsidian versions, device, steps, expected result and actual result. For a candidate, include its commit or build checksum. A minimal example with renamed or synthetic notes helps reproduce the issue without sharing private vault data. Report through the [issue tracker](https://github.com/ParkPavel/obs-projects-plus/issues).

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

Check formula results against a known example before changing evaluation rules. Existing formulas retain their compatibility profile unless you explicitly select the new rules. Excessive computations may return an error or a pipeline warning; check the warning before treating a transformed result as complete. A pipeline stopped by its work limit retains its last fully completed step.

## Roll back

Disable the plugin and restore the previous **matching set of three assets**, then enable it again. Keep the current `data.json` only if it is compatible with that version; otherwise restore the settings backup made with the previous assets.

Replacing plugin files does not undo edits already written to notes. If you need to undo those changes, restore the affected notes from your vault backup after reviewing changes made since the backup. Test the restored copy before replacing working data.

## Report a problem

Include the plugin and Obsidian versions, device, steps, expected result and actual result. For a candidate, include its commit or build checksum. A minimal example with renamed or synthetic notes helps reproduce the issue without sharing private vault data. Report through the [issue tracker](https://github.com/ParkPavel/obs-projects-plus/issues).

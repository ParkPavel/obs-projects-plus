# 3.7.3 development: first project-copy increment

[Русский](development-3.7.3-RU.md) · [Specification](plan-3.7.3.md)

Status: **development, not a published release**. This increment implements outbound configuration copies and versioned snapshots, not the complete 3.7.3 scope. The published plugin version remains 3.7.2.

## Development-build workflow

The Project copies and backups command and settings button open copy management. Choose a visible vault folder and update copies/snapshots manually. Automatic refresh is opt-in and disabled by default.

Export first flushes the primary settings queue and checks that memory matches confirmed data.json. It copies active and archived project definitions, including custom-view configuration and counters. Global preferences, actual records and attachments are outside this increment.

Each project has a readable Project.md and an immutable configuration snapshot in Backups. Internal folder names use a stable project-ID hash; the management window lists ordinary project names and links. sync-index.json records confirmed hashes and active/archived/removed state. Removing a project never deletes retained copies.

Repeating the same configuration does not duplicate snapshots. Externally edited, corrupted or unexpectedly missing copies block automatic overwrite and expose failure. A mirror failure never rolls back successfully saved settings. Read-back detects a host that falsely reports write success.

Preserve configuration key order: a change creates a separate conservative revision. Snapshot filenames hash exact document bytes. Previous copy roots stay in the exclusion history after changing destinations. Unconfirmed primary settings show a waiting state rather than a false backup-failure notification.

## Current boundaries

- ZIP transfer/import, note/attachment packaging, tag/folder mapping and restore UI are not yet implemented.
- External/AI edits are not yet applied to settings. They remain in the file and block overwrite; a copy is a proposed change, not another settings authority.
- Configuration snapshots cannot restore records, the entire vault or global preferences. Same-vault snapshots need an independent copy for protection against losing that vault.
- Reserved copy documents are excluded from ordinary Projects Plus source records. Dataview runs DQL before output filtering: vault-wide DQL aggregates must explicitly exclude the copy folder. Existing Dataview sources trigger a notice in the management window before the action.
- Vault.process checks and read-back do not form a distributed transaction. An interruption can leave partial files; repeating the same revision verifies/resumes it without overwriting external versions.
- The outbound queue coalesces save events separately from the primary writer. JavaScript execution after closing Obsidian is not promised. Enabled automatic mode checks again on next launch.
- Startup automatic refresh cannot recreate a missing binding/index. Manual creation or an explicit destination/enable action can initialize a new folder. Filesystem folder renames do not yet have an automatic relocation wizard: disable automatic mode and select the actual destination in management.
- The marked configuration block and index use experimental schema version1; this is not a published stable external API.

## Verification and next stages

Automated scenarios cover round-trip preservation, external/concurrent edits, failed read-back, archives/removal, interrupted index updates, source isolation, queue/lifecycle and the real shared TextField with IME. They do not establish acceptance on a physical iPhone.

Next: package/dependency contracts, bounded ZIP codec/manifest, selected records and attachments, staged import/remapping, validated inbound application and restore. Full checks, independent review and manual acceptance are required before installation into a working vault.

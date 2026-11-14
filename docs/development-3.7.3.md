# 3.7.3 development: copies and project packages

[Русский](development-3.7.3-RU.md) · [Specification](plan-3.7.3.md)

Status: **development, not a published release**. This increment implements outbound configuration copies and versioned snapshots, not the complete 3.7.3 scope. The published plugin version remains 3.7.2.

## Development-build workflow

The Project copies and backups command and settings button open copy management. Choose a visible vault folder and update copies/snapshots manually. Automatic refresh is opt-in and disabled by default.

Export first flushes the primary settings queue and checks that memory matches confirmed data.json. It copies active and archived project definitions, including custom-view configuration and counters. Global preferences, actual records and attachments are outside this increment.

Each project has a readable Project.md and an immutable configuration snapshot in Backups. Internal folder names use a stable project-ID hash; the management window lists ordinary project names and links. sync-index.json records confirmed hashes and active/archived/removed state. Removing a project never deletes retained copies.

Repeating the same configuration does not duplicate snapshots. Externally edited, corrupted or unexpectedly missing copies block automatic overwrite and expose failure. A mirror failure never rolls back successfully saved settings. Read-back detects a host that falsely reports write success.

Preserve configuration key order: a change creates a separate conservative revision. Snapshot filenames hash exact document bytes. Previous copy roots stay in the exclusion history after changing destinations. Unconfirmed primary settings show a waiting state rather than a false backup-failure notification.

## Current boundaries

- ZIP export with explicitly selected files is available in the second increment below. Import, tag/folder mapping and restore UI are not yet implemented.
- External/AI edits are not yet applied to settings. They remain in the file and block overwrite; a copy is a proposed change, not another settings authority.
- Configuration snapshots cannot restore records, the entire vault or global preferences. Same-vault snapshots need an independent copy for protection against losing that vault.
- Reserved copy documents are excluded from ordinary Projects Plus source records. Dataview runs DQL before output filtering: vault-wide DQL aggregates must explicitly exclude the copy folder. Existing Dataview sources trigger a notice in the management window before the action.
- Vault.process checks and read-back do not form a distributed transaction. An interruption can leave partial files; repeating the same revision verifies/resumes it without overwriting external versions.
- The outbound queue coalesces save events separately from the primary writer. JavaScript execution after closing Obsidian is not promised. Enabled automatic mode checks again on next launch.
- Startup automatic refresh cannot recreate a missing binding/index. Manual creation or an explicit destination/enable action can initialize a new folder. Filesystem folder renames do not yet have an automatic relocation wizard: disable automatic mode and select the actual destination in management.
- The marked configuration block and index use experimental schema version1; this is not a published stable external API.

## Verification and next stages

Automated scenarios cover round-trip preservation, external/concurrent edits, failed read-back, archives/removal, interrupted index updates, source isolation, queue/lifecycle and the real shared TextField with IME. They do not establish acceptance on a physical iPhone.

Next: complete dependency contracts, staged import/remapping, validated inbound application and restore. Full checks, independent review and manual acceptance are required before installation into a working vault.

## Second increment: explicit ZIP export

Open Package a project (ZIP) from copy management, or its command after configuring the visible destination. Select a project and add individual vault notes, template files or attachments. Nothing is selected automatically. Preview captures their bytes and shows included project names, file count, size and unresolved known references. Changing the project or selection invalidates the preview. Saving writes under Packages in the configured copies folder and verifies actual read-back bytes with SHA-256. Different existing contents are never overwritten.

The archive contains manifest.json, Projects/ID-hash/Project.md and explicitly selected files under Files/original-vault-path. Experimental package schema1 lists root/active/archived projects, revisions, known runtime dependencies, file roles, original paths, sizes and SHA-256. Global preferences and hidden settings are excluded. Note links and binary attachments are copied exactly; export does not remap paths or IDs.

Known references include relation/rollup/backlink targets and stored Dashboard widget sources, chart series/correlations and joins, including source/block-qualified references. Available dependent definitions are included transitively with cycle bounds. Arbitrary custom-view and nested extension dependencies require manual review. Missing references are labelled; this is a selected subset, not a complete vault backup. Templates, linked notes and attachments are not added automatically.

Bounds: 256 ZIP entries including manifest, 4MiB per file, 16MiB total data and 20MiB archive. Stored ZIP without compression uses pinned fflate0.8.3, yielding between files without background workers. Per-file metadata checks do not constitute an atomic vault snapshot. Later note edits do not mutate captured bytes; changed active settings require a new preview. Closing retires pending work; an already started host write can leave a retained file.

The self-check decodes only our just-generated ZIP before writing, not untrusted incoming archives. Bounded import/staging/journal, remapping, native Share and physical-iPhone acceptance are still open. The visible ZIP can be copied using the filesystem; no automatic transmission is claimed.

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

The export self-check decodes only our just-generated ZIP before writing. Received archives use the separate inspector below. Import/staging/journal, remapping, native Share and physical-iPhone acceptance are still open. The visible ZIP can be copied using the filesystem; no automatic transmission is claimed.

## Third increment: inspect a received package

Use Inspect a project ZIP, or the matching button in copy management. No local project or configured copy destination is required. Select a ZIP already present in the vault. The inspector reads a stable capture, shows project names, included file paths, unresolved known references and the archive SHA-256. Errors distinguish unsupported ZIP variants, unsafe paths, size limits, inconsistent metadata and checksum failures. Checking the archive does not flush or save active settings, create folders, extract files, evaluate formulas or install projects. Closing the window retires pending reads/checks.

The current input profile supports stored ZIP without compression, single disk, ASCII/UTF-8 names, regular file entries and signed data descriptors when present. Encrypted/compressed/ZIP64 archives, extra fields, directory/symlink entries, prepended stubs, overlaps, hidden local records and inconsistent local/central metadata are rejected. No general unzip or inflate routine receives incoming bytes. Other ZIP profiles require a later bounded decoder.

Limits apply to actual byte ranges: 20MiB input, 16MiB total stored data, 4MiB per entry, 256 entries, 512KiB manifest, 100 project definitions and 4096 known references. Export uses the same manifest policy. Names are checked for traversal, hidden/configuration paths, case/NFC duplicates and file/parent collisions. The inspector verifies CRC32, manifest SHA-256 and exact file coverage, project identity/path/revision, supported schema and recomputed known-reference status. Unknown manifest fields/versions block inspection; opaque project config is preserved and only envelope-checked. Integrity verification does not authenticate the sender or establish that imported formulas/configurations are safe to apply.

Inspection remains a read-only preview. Explicit staging is available below. Final destination selection, ID/link remapping, active import, interrupted-install recovery and applying external edits remain subsequent work.

## Fourth increment: prepare files and resume interruptions

After a successful preview, Prepare or resume rechecks the original ZIP and its displayed hash, then prepares a temporary copy in the displayed Incoming folder. It uses the existing copy root; first use without one explicitly binds Projects Plus with automatic copying off through the ordinary confirmed settings writer. It does not change an existing destination silently. A changed archive or destination requires a fresh preview.

The parent Incoming/archive-hash.json journal claims the immutable plan before the payload folder is created. Payloads live in Incoming/archive-hash/Files/path-hash.bin; the journal maps original entry names, sizes and SHA-256 to those files. Using opaque binary filenames keeps staged Markdown out of note rendering and active project queries until a future import. The whole reserved Incoming namespace is excluded by Projects Plus sources, including prior copy roots. The manifest and original configuration/note/attachment bytes are preserved exactly; paths and IDs are not remapped yet.

Each file is created exclusively, read back and hashed before its journal checkpoint. The journal records preparing/ready and a verified completion prefix. Repeating the explicit action checks actual contents and resumes missing files; it can recreate a missing temporary payload when filesystem synchronization delivered its journal first. Changed existing payloads, foreign/noncanonical journals and unclaimed existing staging folders are retained and block writes. An error or cancellation leaves the original ZIP and written temporary files in place. There is no automatic cleanup, archive deletion or background resume.

Ready means preparation was verified, not permission to register a project. All files and the final journal are rechecked before success; future installation must verify them again. The journal is bounded to1MiB and the existing ZIP/file limits still apply. Vault operations do not form a distributed transaction, and writes already begun may finish after cancellation. No active notes or project definitions are overwritten or installed at this stage. Final folder/tag choices, typed remapping, install/rollback and keep-or-trash choices remain open.

## Internal increment: new identity planning

A testable planner now prepares identities for a future clone. It allocates new project, named-source, view, widget and tab IDs within their respective scopes. The allocator excludes original IDs and occupied IDs in the supplied active and archived destination projects, with bounded collision retries. The plan resolves project, source and database-call block references, including view IDs containing colons. Missing targets fail rather than binding to unrelated destination projects. The derived-source literal project retains its special meaning.

This is an internal building block, not connected to installation or its UI yet. It changes no definitions, notes or settings and does not replace full project schema validation. Traversing all typed references (including linkedSelection and linkedViewId), handling unknown configs, remapping note paths/links and verified registration remain necessary. The complete 3.7.3 is still under development.

## Internal increment: identity-reference preview

The rewriter captures separate configuration copies and applies the identity plan to known references: relation/rollup/backlink, derived/named sources, block/chart/series sources, correlations, joins, linkedSelection, tabs and activeTabId. A linked view resolves within the block's source project, with view-type checking. Reused widget IDs in different views remain distinct; disabled joins and retained tab configs are included. Clones receive isDefault=false so the existing default project is not changed.

The result is labelled reference-preview. Unresolved references, malformed known reference shapes and unsupported view/widget/source/step types carry structured diagnostic locations. A qualified block source combined with another sourceId or linkedViewId needs a separate context decision and is diagnosed for now; inline block sources also require further handling. Unknown data is retained. Expressions are not executed and there is no global string replacement. Note paths/links, tags and query text remain unchanged.

This module is not connected to import UI yet. Even an empty diagnostic list is not installation approval: full schema validation, unknown-config handling, file/link relocation, folder/tag scope choices, installation journaling and verified registration remain open. This increment changes no active projects or notes.

Preview limits: up to100 projects, 2MiB per configuration and16MiB total both before and after ID replacement; up to4096 nonempty reference-mapping attempts and4096 diagnostics. Exceeding a limit refuses the preview. activeTabId is checked even when no tab list exists.

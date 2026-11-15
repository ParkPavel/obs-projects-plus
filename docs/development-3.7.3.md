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

The result is labelled reference-preview. Unresolved references, malformed known reference shapes and unsupported view/widget/source/step types carry structured diagnostic locations. A named sourceId belongs to the containing project even when a database-call reads an external project. A linkedViewId combined with a qualified external source still needs a separate context decision and is diagnosed. Historical widget.config.sourceConfig JSON is not acquired by the current runtime: it is preserved without rebinding IDs or treating it as an active source. Unknown data is retained. Expressions are not executed and there is no global string replacement. Note paths/links, tags and query text remain unchanged.

The import-folder preview now checks closed identity references after structural inspection: named sources, active tabs, linked views and known cross-project references. Cyclic or overly deep block reads use the runtime's existing chain rule; mutual ordinary project relations remain valid. Malformed or unknown envelopes stop reference traversal and retain their structural diagnostics. This is still a read-only preview, not permission to install a project or evaluate expressions.

This module is not connected to import UI yet. Even an empty diagnostic list is not installation approval: full schema validation, unknown-config handling, file/link relocation, folder/tag scope choices, installation journaling and verified registration remain open. This increment changes no active projects or notes.

Preview limits: up to100 projects, 2MiB per configuration and16MiB total both before and after ID replacement; up to4096 nonempty reference-mapping attempts and4096 diagnostics. Exceeding a limit refuses the preview. activeTabId is checked even when no tab list exists.

## File destination preview

The ZIP inspector now accepts a future import folder and a Check folder action. It rereads and verifies the archive against the displayed SHA-256. Preview shows chosen-folder/original-path destinations, preserving the selected notes/attachments' subtrees; service project definitions are not extracted there. It checks current loaded vault paths, occupied files/folders, parent files, and case/Unicode NFC aliases. An occupied file always conflicts; equal bytes never authorize overwriting.

Obsidian configuration and service namespaces in current/previous copy roots are protected. Required folders include ancestors; this does not establish ownership of existing folders. Preview is bounded to100000 indexed vault paths including inferred ancestors,16M path characters both on input and in the index,128 copy roots and4096 conflicts; ZIP schema and portable path limits still apply. Oversized plans are refused.

Preview does not save settings, create folders, move files or install projects. Changing the folder, checking a new ZIP or staging clears the previous path list. Note links are not inspected or rewritten yet. No conflicts does not mean ready to import: config/source-scope validation, link relocation and fresh destination checks during installation are still required.

Different spellings of inferred parent folders inside the package also conflict: Work/a.md and work/b.md are not silently merged into one folder. Correct the original names and recreate the package; changing the common destination alone does not resolve this conflict.

## Configuration path proposals

Checking a folder now proposes bindings for selected templates, excluded notes, primary/additional source folders, explicit new-note folders, local covers and inverse-selection record paths. Unused historical inline source JSON stays unchanged. Bindings use exact selected file paths or containing folders. Recipient files are never chosen by basename. Missing bindings and unsupported settings remain with diagnostics; the original project and manifest archive state are preserved.

An empty new-note folder retains inheritance from a primary folder/native-folder source. With a tag/query/derived source it requires an explicit choice, so creation does not silently fall back to the vault root. Tags, query text, filters, expressions and external HTTP(S) cover URLs are not rewritten or executed. Unknown configurations are retained.

Each folder/tag/query scope still needs a decision before import. A successfully bound folder shows an upper bound of existing Markdown paths by folder and recursion, before filters, exclusions or content checks. This is not the project record count. Tags, queries, unbound folders and exhausted scan budgets show not calculated, never a partial or guessed count. Scans share a million-comparison budget and cache identical scope results.

Proposals use private JSON copies and are not applied. Input/output limits are2MiB per configuration/16MiB total,4096 combined change/issue/scope records and16384 structural visits. UI shows total counts and up to32 examples per category, shortening long values. Full schema validation, scope decisions, note-link relocation and installation remain open; no diagnostics is not application authority.

## Manual path bindings

After checking the import folder, open Configure path bindings to choose an existing vault file/folder or a planned package destination for a known configuration field. Future package files are labelled explicitly. Native settings rows, searchable file/folder selectors and pagination keep every field accessible within the existing plugin theme and one modal scrollbar. There is no separate palette, custom dropdown or nested scrolling panel. Long descriptions wrap and are shortened for display.

Edits remain local until Recheck choices. Rechecking captures the choices, rereads the original ZIP against its displayed hash and validates each target against the current vault inventory and protected paths. Choices identify their project, known field, original value, import folder and existing/planned origin; missing or changed targets are diagnosed rather than silently replaced. Reset restores the package proposal; Reset all also removes stale choices. Changing the import folder or checking another ZIP clears choices. Closing the editor discards unsubmitted edits.

Only typed path fields consume choices; arbitrary configuration locations cannot be edited this way. Choices are bounded to4096 and2MiB, and candidate targets share the100000-path/16M-character inventory limits. Binding an existing file never resolves a file-copy conflict or permits overwriting. Choices live only in memory, do not save settings or install files, and do not approve source scopes. Source-scope review is available below; full schema validation, note-link relocation, installation and physical mobile acceptance remain open.

## Review source scopes

After checking the import folder, Review source scopes lists active primary and additional folder/tag/query sources. Unused historical inline definitions add no scope questions. Each native toggle starts off. Enabling it proposes keeping the displayed rule, which may include existing and future matching vault notes beyond the package selection. Folder recursion and nested-tag matching are shown separately. This is not an option to isolate a tag/query source to packaged notes. Existing Markdown candidates remain an upper bound before filters; queries and tags are not evaluated to obtain a count.

Recheck choices rereads the ZIP, validates path choices and checks the source decisions again. A revision binds the archive, import folder, path choices, copy/configuration policy, proposed project and current loaded file/folder metadata. Changed rules, bindings, inventory or file size/mtime require a new confirmation; inventory ordering alone does not. Metadata is checked again after hashing. These checks are a preview of observed state, not an atomic vault snapshot or installation authority.

Only the matching scope-choice diagnostic is resolved by a valid confirmation. Source shape/path errors block confirmation; unrelated diagnostics and copy conflicts remain. Missing fields and stale revisions are diagnosed. Rules exceeding8192 UTF-16 code units or128 lines cannot be confirmed from a truncated display. All sources remain reachable through12-row pagination using the existing modal theme and one scrollbar. Reset removes all source choices; changing the folder/ZIP clears them, and closing the editor discards unsubmitted changes.

Decisions are memory-only, limited to4096 and2MiB. Review preserves configuration bytes, uses at most100 bounded project hashes and retains the existing configuration/inventory/diagnostic limits. It does not execute queries, validate the full project schema, install files or register projects. Link relocation, full validation, installation/rollback, external edits, native sharing and real-device acceptance are still required.

## Project core structure checks

Folder checking now includes a separate strict JSON preflight for required/optional project fields, source shapes, canonical filter operators and nested groups, source IDs/references and local derived-source cycles. It also checks view envelopes, filters, colors and sorting, date-format fields and palette entry shapes. Unknown fields/types are diagnosed; they are not dropped, coerced or migrated. Native-query limit remains a finite number, preserving the existing runtime's negative/zero/fractional semantics. Disabled filters are checked too; expressions, regex and queries are never executed.

The profile root-fields-agenda-sources-and-supported-view-configs keeps complete=false. It checks the known root/property/source/filter formats, root and local Agenda (including nested groups, legacy flat lists and operator aliases), Board/Gallery/Calendar, Dashboard/Database envelopes and widget/tab settings. Table maps, conditional formats, field presets, chart axes/series/scatter settings, statistics, checklists, filter tabs, banners, text and dividers have explicit shapes. The historical table view supports its original flat settings and the documented widgets+layoutVersion format; a widgets-looking extension alone does not acquire widget semantics. Retired widget contents are explicitly carried as opaque JSON while their common source/layout/transform envelope is still checked. Unknown keys, kinds and versions are retained with diagnostics, not silently rewritten.

Stored pipelines support all eight step formats: unnest, unpivot, compute, filter, group-by, aggregate, pivot and join. Pipeline uppercase functions, lowercase rollup kernels and table footer aggregations use distinct vocabularies. Optional absence, empty/unconfigured views and legacy values remain unchanged; sizes are not clamped to UI sliders. Expressions, queries and regex are never executed. This structural pass does not prove reference/field semantics, note-link meaning or installation readiness. Cross-project graph validation, final path/link planning and journaled installation/rollback still follow; an empty diagnostic list is not installation permission.

The read-only checker accepts up to2MiB of JSON per project and refuses non-finite parsed numbers, nesting beyond32 levels, more than16384 nodes or4096 diagnostics. Folder checking also caps total core diagnostics and combined configuration diagnostics at4096. It rejects unsupported resource sizes rather than returning a clipped success. The existing inspector shows totals and up to32 diagnostic examples as text, with an explicit incomplete-coverage notice. No project configuration, active settings or notes are installed or changed.

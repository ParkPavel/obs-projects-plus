# 3.7.3 development: copies, packages and transfer

[Русский](development-3.7.3-RU.md) · [Specification](plan-3.7.3.md)

Status: **in development on the 3.7.3 branch; not published and not accepted**. The published stable plugin remains 3.7.2, and `main` and the release tag are unchanged. This page describes behaviour implemented in the development branch; it is not a release announcement.

## What the increment adds

Visible configuration copies, versioned package archives, an inspector and explicit preparation of a received package, destination and binding checks, note-link relocation, verified installation with rollback, apply and restore of configuration edits, and sharing of a saved archive. Every step is explicit: nothing is selected, sent or installed automatically.

A typical path through the feature:

1. Keep readable copies of project settings in a visible folder.
2. Save a project as a ZIP package, with only the files you choose.
3. Inspect a received package and prepare its files.
4. Check the destination folder and confirm the bindings and source scopes.
5. Install with fresh identities; resume or roll back if installation is interrupted.

Steps 3 to 5 are optional: an archive can be inspected, copied through the file system or kept as a backup without installing anything.

## Safety rules that apply everywhere

- Nothing is selected, transmitted or installed without an explicit action.
- Existing unrelated files are never overwritten; equal bytes do not authorise replacement. Updates to owned configuration copies use checked hashes and compare-and-write.
- Installation has a durable plan and compiled payloads for restart and recovery. Interrupted note preparation can be cleaned up and repeated.
- Nothing is permanently deleted; removal goes through the system trash or a recovery folder.
- Query, formula and link text is never executed or blindly rewritten by these checks.
- Installation does not continue after quitting Obsidian; interrupted work remains available for recovery.

## Visible copies and mirrors

The Project copies and backups command and the settings button open copy management. Choose a visible vault folder; automatic refresh is opt-in and off by default. data.json stays the authoritative fast state, and copies are written only after the primary settings writer confirms it.

Each project keeps a readable Project.md, an immutable configuration snapshot in Backups and an entry in sync-index.json. Snapshots are content-addressed, so repeating the same configuration does not duplicate them.

Removing a project never deletes its copies. After the destination changes, previous roots stay reserved so their service documents never become project records. A folder renamed outside Obsidian is not relocated automatically: disable automatic mode and select the real destination.

## Packages

Package a project (ZIP) takes the active or archived project, adds the known transitive definitions, and includes only the individual notes, templates and attachments you select. The preview shows projects, file count, size and unresolved known references; saving writes the archive and verifies the bytes it read back. Different existing content is never overwritten.

Format schema1 is experimental: manifest.json, Projects/ID-hash/Project.md and the selected files under Files/original-vault-path, with sizes and SHA-256. The writer uses pinned fflate 0.8.3 and stored entries only, so no compression and no background worker are involved.

Bounds: 256 entries including the manifest, 4 MiB per file, 16 MiB total data, 20 MiB archive, 100 project definitions, 512 KiB manifest and 4096 known references. Encrypted, compressed and ZIP64 archives and unsafe paths are refused.

Verified hashes prove the bytes, not the author's identity or the safety of imported formulas. This is a selected subset, not a complete vault backup: global preferences, records, templates and attachments you did not select stay outside the archive.

## Inspecting and preparing a received package

Inspect a project ZIP reads an archive that is already in the vault and shows its projects, files, unresolved references and SHA-256 without saving settings, extracting files or evaluating anything.

Prepare or resume then rechecks the archive and stages its payload under Incoming as opaque .bin files next to a journal that pins the plan. Native Obsidian metadata is parsed from that isolated copy without rendering notes or evaluating queries.

Preparation can be interrupted, cleaned up and repeated. Changed payloads, foreign journals and unclaimed folders are kept and block writes. A durable quarantine is confirmed before creating temporary parsing notes; all parsing Markdown is renamed to opaque .bin and Dataview's public path index is checked before the quarantine is cleared. The native Obsidian parser is used without adding a parser dependency.

## Destination and bindings

Checking the import folder preserves the selected subtrees and lists the destination of every selected note and attachment. One visible JSON configuration per project is planned under Project settings/ID-hash.json, also for configuration-only packages.

Existing files, occupied folders, parent-file conflicts and case or NFC aliases block placement; equal bytes never authorise replacement.

Bindings are explicit for notes, templates, external sources, primary and additional source folders, and the folder used for new notes; a tag-based project must choose its creation folder. A source keep rule can cover existing and future recipient notes, and that scope is shown before you confirm. Query and formula strings are never rewritten or evaluated by these checks.

## Note links and references

Note links are moved at their real native positions: Markdown links, wiki links, embeds, reference definitions and YAML scalars. Alias, heading, block, title and code text are preserved.

Schema1 carries no sender resolution catalogue, so ambiguous wiki links and external links need explicit bindings; the plugin never guesses by basename.

Unsupported link styles and contexts are retained and block activation instead of being dropped. Board and Gallery cards remap their order only when the stored row IDs are native; persisted rows produced by transforms or other views block safe transfer. Deterministic canonicalisation of legacy tables preserves exactly the pages that are empty today.

## Installation and rollback

Installation runs only after every check and choice. It allocates fresh IDs, rewrites runtime references and known paths, writes notes and their owned JSON beside them, and publishes projects only after the written files are read back.

A durable pending descriptor isolates partial files and pauses Dataview acquisition for the affected projects. The journal and the compiled .bin payload pin the plan across restarts, so resuming an install does not need the original ZIP.

Rollback moves owned files that were not edited to Incoming/Recovery and leaves edited or unacknowledged files in place. Nothing is permanently deleted. The source ZIP is kept by default; an unchanged archive can be moved to the system trash only after confirmed success.

## Configuration edits

Apply configuration edits and Restore a configuration snapshot are available in copy management. Both show a read-only, paginated diff and apply only on explicit confirmation after owner, base, schema and graph checks; stale drafts are refused.

An immutable copy of the project before the change and the exact draft are saved before the primary commit. The default project choice and record files are not replaced wholesale, and the unique-ID counter never decreases.

Owned JSON is refreshed, and the mirror and index acknowledge the applied edit. External drafts block automatic overwrite. If the file refresh fails after the primary settings were confirmed, that failure is shown separately and can be retried; this is not a distributed transaction.

## Sharing a saved package

After saving, the verified archive is prepared as a private File. Share calls the public Web Share files API from the explicit button, and only when the host reports that it can share files.

On a PC or an unsupported host the plugin says so and points to the saved ZIP in Files or your file manager. There is no automatic transmission and no private OS or Obsidian API. Acceptance on a physical iPhone is still required; widgets and notifications belong to 3.7.4.

## Limits that remain

- The Markdown mirror and configuration backups are excluded from native sources and file-linked Dataview output, but vault-wide Dataview aggregates must exclude the copy folder themselves; queries are not rewritten.
- Temporary parsing and import isolation does not rewrite aggregate queries either.
- Integrity checks do not prove authorship, and unknown configuration is retained rather than migrated.
- Folder renames made outside Obsidian need a manual destination change.
- Same-vault copies do not protect against losing that vault; keep an independent backup.

## Verification and next steps

Before release: full checks on the exact candidate commit, an independent qualified review, published candidate hashes and a manual PC and iPhone protocol. No result of those gates is claimed here, and no historical test totals are reused. The published stable version, `main` and the release tag remain 3.7.2.

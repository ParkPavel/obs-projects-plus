# 3.7.3 plan: synchronization, backups and project packages

[Русский](plan-3.7.3-RU.md) · [Roadmap](../ROADMAP.md) · [Announcement](next-versions.md)

Status: **revised draft specification**, following the maintainer's decisions on 14 November 2026. Not shipped functionality. Baseline: 3.7.2 / main a2f322d7. Documentation only at this stage.

## Agreed direction

**data.json remains the authoritative persistent store for active configuration.** The in-memory model serves normal operations. A visible folder holds verified copies for backup, sharing and external tools. No mandatory migration of all live projects into separate authoritative notes is needed.

Use ZIP packages containing configuration and selected notes/attachments. Import produces an understandable folder with configuration and project materials. Configuration-only packages remain supported. AI tools edit visible copies; changes enter through validation and the existing settings writer, without directly editing hidden settings.

The inspected baseline remains src/settings/settings.ts and v4/settings.ts; lib/stores/settings.ts; lib/settings/settingsWriter.ts and settingsCheckedSave.ts; main.ts loadSettings; relations/baseRef.ts and blockRefs.ts; templates/interpolate.ts and export/exportService.ts. These reveal existing settings recovery, project/archive/preferences state, ID counters and references across projects/views/blocks. Note-text templates and row export are not project-package formats. Inventory of every writer/custom-view payload is still P0 work.

## Ownership and visible layout

| Layer | Role |
| --- | --- |
| In-memory model | Fast reads and edits through existing commands/store. |
| data.json | Authoritative persisted projects, archives and preferences, retaining current checked writes and recovery. |
| Visible mirror | Verified copy of a saved project revision, with timestamp/status; never a second independent authority. |
| Versioned backup | Immutable snapshot with scope, revision, checksums and restore rules. A mutable mirror alone has no history. |
| Transfer package | ZIP containing chosen configuration, notes, attachments and dependencies. |

Proposed configurable root: Projects Plus/, containing Projects/<project-id>/ with a readable Project.md, Backups/<snapshot-id>/, Packages/ and Incoming/. Imported materials can sit beside the configuration in Notes/ and Attachments/, with destination names chosen by the import wizard. The [Vault API](https://docs.obsidian.md/Plugins/Vault) accesses visible files, giving iPhone/iPad users readable copies outside hidden settings.

Markdown with one identified JSON block is the prototype configuration format; exact markers/schema remain open. The archive can carry a manifest.json. Do not introduce competing canonical encodings.

## Outbound synchronization

Default flow: **successfully persisted settings → verified visible copy**. Unsaved in-memory edits cannot become a claimed verified backup. Expose saved revision, timestamp and read-back status.

Offer manual mirror refresh, optional coalesced refresh after saves and explicit versioned backups. Do not ZIP/copy all records or rescan the vault on each keystroke/UI change. Use a separate bounded export queue; set debounce/resource budgets from measurements. Do not promise JS execution after Obsidian closes: pending work resumes or is offered on next launch.

Mirror failure does not undo a successful data.json save: display saved-settings/stale-copy status, retain the last good mirror and offer retry. Primary-save failure cannot report a backup of new settings as successful. Moving/deleting the destination requires explicit rebinding rather than silent recreation elsewhere.

## External edits and AI

External mirror changes are **proposed changes**, not unconditional permission to overwrite data.json. Validate schema/IDs/base revision, show differences/dependencies and apply through the shared commands and checked writer; read back and refresh the mirror.

If UI changed the project meanwhile, retain both versions and require reconciliation. Outbound refresh must also preserve externally edited copies, comparing against the last confirmed mirror. Suppress feedback loops with revision/hash identity, not only a timer. Default inbound application is explicit. A trusted automatic mode is a separate future decision; foreign archives are never installed merely on arrival.

Publish the schema, allowed fields and AI examples. Imported text cannot execute code, OS commands or network actions. Exclude control notes from normal plugin record queries. Preserve unknown fields/versions or refuse application; never silently substitute defaults. Mirror deletion cannot delete active projects or records.

## Packaging

Offer settings-only, settings with selected records and settings with the chosen project dataset. Show contents, size, attachments, dependencies and private details before confirmation. Never automatically export secrets, device/UI preferences or runtime caches.

Include format/compatibility metadata, root project, explicitly included dependent definitions, file/checksum manifest, configuration and selected notes/attachments/text templates. Do not download external links automatically or silently include the entire linked vault. Show missing dependencies and the chosen traversal boundary.

Tag-based projects export an explicit selected record list, separately retaining their tag/filter rules. A folder alone does not describe their membership. If files change while copying, retry/refuse or mark the operation incomplete; manifest hashes must match actual copied bytes. Do not claim a global filesystem transaction.

Verify actual public ways to share a ZIP on Obsidian/iOS/Android/desktop. [Mobile note Share](https://obsidian.md/help/more-options-menu) does not establish a plugin-callable ZIP-sharing API. Prototype direct sharing and a clear save/open-archive fallback. Never disguise ZIP as .md; PDFs/text-only note shares are not package transfer.

## Unpacking and registration

1. Validate format/compatibility, file count, sizes and expanded-data limits. Refuse absolute/traversal paths, outward links, duplicate destinations and hidden-configuration writes. Execute no content.
2. Show contents/dependencies and choose a destination. For tag-based projects, that folder places records while tag selection remains. Detect collisions with existing destination-vault tags and offer remapping/scope clarification with a membership preview.
3. Extract to staging and verify the manifest first. Resolve file-name collisions before final writes; never silently overwrite existing files or unrelated notes while fixing references.
4. Assign new project/view/block IDs for a new import. Remap typed references and note/attachment paths, preserving link kinds, aliases and anchors. Global JSON/Markdown string replacement is insufficient; report unresolved references.
5. Register through the authoritative writer. Multiple file writes plus data.json are not atomic: journal progress, defer success until verification and resume/roll back partial installation without losing pre-existing data.
6. After success, offer keeping the source archive or deleting it through available trash. Preserve it on failure and never destroy the only verified recovery copy.

New import and restore are distinct operations. Restore retains the necessary IDs/counters and checks conflicts; cloning assigns new IDs and reconciles counters with destination records. Repeated imports do not overwrite a project by name.

## Backup and restore

Configuration-only copies cannot restore record contents. Record the backup scope in its manifest. Versioned snapshots are not overwritten like mirrors; retention is explicit and cannot silently remove the last verified version.

Before restore, verify a backup of current state, compatibility, files and references, then read back the result. Handle moved/deleted records and archives explicitly. Same-vault backups do not protect against losing the entire vault/disk: users can copy/sync the folder externally through filesystem tools. The plugin cannot claim to have verified that external delivery.

## Stages and acceptance

| Stage | Completion evidence |
| --- | --- |
| P0: inventory | All fields/writers/references/custom views; prototype copy/package format and real ZIP-transfer channels. |
| P1: codec/graph | Versioned schema, lossless settings round-trip, file inventory and typed dependency remapping. |
| P2: mirror/backups | Confirmed-revision exports, queue/read-back, conflicts, retry, restore and no feedback loop. |
| P3: ZIP export | Explicit scope/privacy, consistent manifest and concurrent-file-change handling. |
| P4: import/AI | Staging, folder/tag wizard, IDs/links, checked registration, interruption journal and external-edit diff/application. |
| P5: devices/regressions | Desktop and physical iPhone transfer/restart, two-device conflicts, archive/trash choice and restore. |

Test preserved existing project behaviour, formulas/order/counters, unchanged notes without a user request, independent settings/mirror disk failures, concurrent UI/AI/sync edits, corrupt/oversized/newer archives, unknown fields, name/tag collisions, attachments/dependencies, interruption at every transition, repeated import and separate restore. Verify actual recovery, not only a copy-success message.

Compare startup/editing latency, memory, IO and background load to the same 3.7.2 dataset; establish numeric budgets from measured baseline. Keep full export off the UI critical path.

No new calculation engine, mandatory replacement of data.json, marketplace, executable archive instructions or OS widgets in this scope. Markers/manifest, extraction limits, dependency boundaries, retention and ZIP Share capability remain prototype decisions. This maintainer decision supersedes the earlier proposal for authoritative visible project notes.

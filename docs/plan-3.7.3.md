# 3.7.3 plan: vault-native projects and templates

[Русский](plan-3.7.3-RU.md) · [Roadmap](../ROADMAP.md) · [Next versions](next-versions.md)

Status: **draft implementation specification**, not an available feature. Research baseline: released 3.7.2 and main a2f322d7 on 14 November 2026. No delivery date or final file schema is committed. This stage changes documentation only.

## User outcome

Find and edit project definitions in a visible vault folder, save a reusable template and send it as an ordinary Markdown note. An AI tool with permitted vault access can use the same documented file interface without editing hidden data.json. A recipient reviews the package, maps local folders and installs it with working dependencies.

Visible documents address inconvenient access to hidden configuration on iPhone/iPad. The [Vault API](https://docs.obsidian.md/Plugins/Vault) handles visible vault files; hidden folders require the Adapter API. User records remain ordinary notes.

## Inspected baseline

| Source area | Architectural consequence |
| --- | --- |
| src/settings/settings.ts and src/settings/v4/settings.ts | Settings v4 include projects, archives, preferences, sources, fields, views, Agenda, template paths and ID counters. A portable document needs an independent schema version. |
| src/lib/stores/settings.ts | Project mutations currently update a shared store. Introduce one command boundary, not another independent writer. |
| src/lib/settings/settingsWriter.ts, settingsCheckedSave.ts and main.ts loadSettings | Keep queued writes, base comparisons, read-back, conflict refusal and verified recovery copies. |
| src/lib/relations/baseRef.ts and blockRefs.ts | Dependencies include projects, named sources and projectId::block:viewId:widgetId addresses; remapping must understand the graph. |
| src/lib/templates/interpolate.ts and src/lib/export/exportService.ts | Note-text interpolation and record export already exist; neither is a portable project-definition format. |

This is an inspection of these areas, not a completed audit of every writer or custom-view setting. Completing that inventory is the first implementation task.

## Proposed document interface

Default visible root: **Projects Plus/**, configurable to another vault-relative folder. Proposed subfolders: Projects for active .md definitions, Templates for portable .md packages, Recovery for verified snapshots/journals, and README.md for human/AI instructions. These paths are proposed, not implemented.

Prototype one Markdown document with descriptive text and one identified JSON configuration block. Small frontmatter holds document kind, stable ID and envelope version. Compare this against full YAML using real editor and iPhone Share trials before freezing field names, markers and JSON Schema. Do not introduce two competing canonical formats.

| Object | Authority after explicit file-mode activation |
| --- | --- |
| Active project | Its visible definition note; memory/index can be rebuilt. |
| Template | An inactive document, never automatically installed merely because it arrived. |
| Records and field values | Original user notes, untouched by configuration migration. |
| Device/UI preferences and sync state | Local settings, not automatically exported. |
| Recovery data | Separate private snapshots/journal, excluded from a shared template. |

Unmigrated projects retain their current settings authority. A migration state explicitly selects the active owner. No unconditional dual writing or two independent sources of truth. data.json may hold a rebuildable index, never the only copy of a file-backed project.

Documents are declarative data, not executable scripts or instructions granting permissions. Importing a file must not execute JavaScript, OS commands, downloads or network requests.

## Preservation and migration

1. Save and read back original settings bytes and required recovery data. Copy failure blocks migration.
2. Inventory and preserve projects/archives, ordering, fields, sources, formulas and semantics, relations/rollups, views/blocks, Agenda, palettes, exclusions, note-template paths and live ID counters. Include third-party view configurations in the inventory.
3. Write staged documents, read back, validate schema/references and compare semantic configuration equality. Do not silently replace unknown values with defaults.
4. Journal the transition and switch authority only after verification. Multiple synced files are not one transaction; interrupted migration must resume or recover an unambiguous consistent state.
5. Keep the old copy through a verified restart. Rollback requires matching previous plugin assets and settings; retain edits made after migration separately.

Unknown future versions or unsupported settings remain readable as original data and must not be overwritten. Preserve unknown fields losslessly or refuse the write; never silently discard them. Distinguish planned, written, verified, applied and restored states.

## UI, external edits and AI

UI and file edits use common validation and a single per-project write queue. Vault events trigger fresh reads with bounded/coalesced work rather than full-vault rescans on every edit. Compare revision/content hash inside the available read-modify-write operation, then read back. This is not a distributed lock across devices or unrelated processes.

Conflicts retain both versions and require explicit reconciliation instead of last-write-wins. Invalid JSON leaves the last accepted in-memory definition available and the invalid source untouched, with a visible unapplied state. Rename keeps identity; duplicate IDs are conflicts. File deletion neither deletes source records nor silently recreates the file. Exclude control documents from normal plugin data queries. Recovery notes can contain private settings and follow vault access/sync policies.

Publish a schema, field catalogue and minimal AI examples for creating a project, adding a field/view, connecting projects and changing templates. No specific model, built-in chat, API key or cloud service is required. Editing a definition does not authorize bulk changes to its records.

## Portable templates and sharing

Include field schema, views, filters, formulas, Agenda and required textual note templates. Exclude actual records, archives, tokens, UI history, runtime caches and live sequence counters. Even paths and expressions can reveal private context; provide a package/content review before sharing.

Support one root project plus explicitly included dependent project definitions in one .md package. Import assigns new project/view/block IDs and remaps typed references, not arbitrary string substrings in user text. Missing dependencies require a mapping or refusal. Repeated import cannot overwrite an existing working project. Reconcile counters with destination records when creating live projects; never reset existing live counters.

Recipients map folder/source bindings explicitly; an empty path must not silently select their whole vault. Binary attachments and actual records are outside the base single-note package and listed as dependencies. Embedded text templates use safe relative names. Refuse traversal, absolute destinations and writes into hidden configuration or outside the chosen folder.

Target action: **Share template**, preparing a portable note and invoking native Share where a supported integration exists. [Obsidian documents mobile note sharing](https://obsidian.md/help/more-options-menu), but that does not establish a public plugin invocation API or prove preservation of a configuration block. First test both. Until then, one-tap dispatch is a goal: opening the prepared note and using its native Share is the fallback; desktop can save/open the file. PDF, images and Obsidian URLs are not substitutes for the .md package.

## Implementation order and acceptance

| Stage | Completion evidence |
| --- | --- |
| P0: inventory/contracts | All fields/writers/references mapped; JSON/YAML and real-device Share trials recorded. |
| P1: pure model/codec | Independent schema, parse/validate/serialize, dependency graph and lossless supported round-trip. |
| P2: file repository | Reads, writes, revisions, rename/delete, events and conflicts preserve the last accepted state. |
| P3: migration/recovery | Verified backups, journal, interruption at every transition, restart and rollback without rewriting records. |
| P4: package/import | Content review, dependency remapping, path safety, repeated import and no implicit external actions. |
| P5: integration/devices | UI/AI share the contract; two-vault and actual desktop/iPhone exchange tests pass. |

Acceptance includes complex 3.7.2 projects with matching settings/results/counters after restart and byte-identical original notes; linked practice templates imported into a clean vault with different IDs/paths; simultaneous UI/AI/two-device edits; invalid/newer documents, duplicate IDs, rename/delete and denied writes; interruption/recovery; and real .md transfer on iPhone. Sharing with another user and syncing one's own devices are separate scenarios.

Measure startup/edit latency, memory, file IO and event counts against the same 3.7.2 dataset. Set numeric regression budgets from that measured baseline before refactoring; no performance pass is assumed in advance.

## Boundaries and decisions

No new formula engine, automatic record transfer, marketplace, executable AI instructions or OS widgets in this scope. Keep 3.7.2 calculation and editing behaviour. Before implementation, settle document markers/schema, supported custom-view payloads, dependency-package boundaries, native Share invocation and conflict-resolution UX using recorded reproducible examples.

# Project management 3.7.3: a simple primary workflow

[Русский](project-management-ux-3.7.3-RU.md) · [Implemented technical foundation](development-3.7.3.md)

Status: **next-iteration specification, 23 November 2026**. The owner found candidate 579c052d relatively successful functionally but rejected its usability. This is not release acceptance. The interface below is not implemented yet. Stable remains 3.7.2.

## 1. Goal and evidence

People must save, share and open projects without knowing command palettes, hashes, JSON, bindings or staging journals. Keep the plugin's Obsidian design language and existing settings. Simplicity reduces required decisions while preserving data protections.

Source-confirmed: `src/ui/settings/settings.ts` exposes a single copy-management button; `src/ui/settings/Projects.svelte` configures commands. Transfer is spread across the modals in `src/ui/projectFiles`. `packageService.save` builds ZIP names from two full hashes. `Onboarding.svelte` offers a demo and an empty project, without a ZIP-template entry.

Owner-reported defects: fields disappear below the mobile keyboard and text escapes its parents. These require reproduction and fixes. Current screenshots could not be captured: Computer Use reports `native pipe unavailable`. This is a specification grounded in the report and source, not a visual audit or iPhone verification.

## 2. Panel in general settings

Put a Projects section near the start of Projects Plus settings. Expose the same screen from plugin navigation. Commands remain optional shortcuts.

| Area | Primary controls |
| --- | --- |
| Start | Create project; Open template |
| Projects | Search and active projects; archived projects in a separate expandable section |
| Project card | Name, folder/tag, readable status; Open, Share and more actions |
| Project menu | Create copy; Save template; Restore; Configure; Archive |
| Copies | Destination, last successful copy, opt-in automatic refresh, Update now |
| Needs attention | Interrupted transfer, external draft conflict, outdated copy; an action per state |

Show names, counts and dates first. IDs, hashes, journals and schema versions belong in expandable details. Mobile controls stack vertically instead of requiring horizontal table scrolling. Move command configuration to additional settings without resetting saved shortcuts.

## 3. Bulk selection

The Share project wizard starts with a project and one material-selection mode:

| Choice | Selection |
| --- | --- |
| All project materials | Files belonging to the project; the open view's display filter does not reduce the copy |
| From folder | Selected folder, including subfolders by default |
| By tag | Matching notes, with an explicit subtag option |
| Linked notes and files | Project materials and local outgoing link targets, with cycle protection |
| Settings only | Configuration template without personal records |

Include attachments referenced by selected notes by default, with an option to disable this. Backlinks never expand the selection automatically. Linked-note traversal is bounded and its scope/count shown before approval. Never download remote URLs. Aggregated project rows cannot be guessed into source files: offer a folder/tag instead.

First collect paths and sizes, then show a readable summary and an optional expandable tree. Individual exclusions/additions remain available but are not the primary workflow. Switching modes replaces the previous scope; never silently union a folder and tag selection.

Do not copy payloads before Create archive. Deduplicate files; exclude excluded project notes, hidden settings, service copies and existing archives from automatic traversal. Explain size limits and offer a smaller scope, without silent truncation. Changes after review invalidate the affected selection and require fresh approval.

## 4. Readable files and folders

Examples: `Home renovation — 2026-11-23.zip`, `Home renovation — template.zip`, `Project.json`, `Home renovation — 2026-11-23 14-30.md`. Offer a numbered suffix on collision. Allow editing the proposed archive name. Shorten unsafe/long filenames without changing the displayed project name.

Hashes verify contents inside manifests/indexes; they are not the visible name. IDs and confirmed ownership indexes identify managed files. Check duplicate project names, case/NFC aliases, invalid characters and occupied ancestors before and adjacent to writes. Names alone never authorise replacement.

New visible documents have readable names; preparation belongs in a separately explained service area. Never automatically rename user notes or previously exported ZIPs. Continue reading old copies; moving to readable copy names is a checked, reversible action with a report. Renaming requires updating ownership and source isolation together.

## 5. Import and destination

Primary path: Open template → choose ZIP → choose folder → Add project. Three wizard screens: Template, Destination, Review and add. Preparation, validation and journaling happen behind these actions instead of separate technical buttons.

Suggest a new folder named after the project. Allow another vault folder, a project-name edit, and Materials included / Settings only. Notes and Project.json live together. Resolve collisions with a new folder or safely renamed copies and consistent link relocation, not default overwrites.

A tag project still needs a creation folder. Show whether existing notes with the tag will join. The desired default is Only added materials: this needs an explicitly persisted source-scope restriction that also handles future notes in the import folder. Filtering preview results once cannot implement it. Keeping the original broad rule is an explicit choice. Never rewrite DQL text automatically; explain unsupported isolation before installation.

Multiple projects receive readable subfolders and a shared dependency review. Keep the original ZIP by default; optional trash happens after confirmed success. Finish with Project added, Open project and its folder.

## 6. Link catalogue and compatibility

New packages need a versioned catalogue of exact sender-resolved link targets: source file, verified text revision, position/original text, resolved target and role. Build it from native metadata plus checked bytes, not basename matching. Preserve relative/wiki/YAML links, aliases, headings and blocks.

Together with the immutable placement plan this enables automatic bindings for included files. Present only missing targets, external files, collisions and unsupported syntax. Allow grouped folder decisions when the mapping is unambiguous and explicitly confirmed.

Schema1 rejects unknown fields: do not silently extend it. Design schema2 with its own validation while retaining schema1 readers. Ambiguous legacy wiki links still need explicit decisions; a unique selected basename is not proof of sender intent.

## 7. First launch

Offer Create project, Open template and Try example. ZIP selection opens the same wizard used by settings. Back/cancel returns without adding an empty project or losing choices. Template preview never executes received queries or formulas.

Selecting a ZIP already in the vault is required. Prototype public per-host support for the system file picker and external Open with. If unavailable, explain how to save the ZIP into the vault first. Do not use private filesystem interfaces.

## 8. Keyboard, text and accessibility

Use one shared transfer-form container: header, one scrolling body and accessible actions. Avoid a second full-screen modal behind a picker and duplicated keyboard offsets. Reuse visibleViewport/onKeyboardChange/fitVisibleViewport and tokens; validate their integration with native Modal rather than applying them blindly.

Use ownerDocument/defaultView, visualViewport, safe areas, Obsidian's toolbar, keyboard and rotation. Keep the focused control and confirmation actions reachable. List updates preserve caret, IME, focus and scroll. Suggestions stay in the correct layer. Large text and unbroken names must not expand parents: min-width:0, wrapping and stacked actions instead of clipping essential labels.

The project's touch-target criterion is at least 44 CSS px. Preserve theme support, visible labels/focus, announced status, reduced motion and keyboard navigation; do not encode status only by colour. These are acceptance requirements, not an accessibility certification claim.

## 9. Operations and external edits

Back preserves choices. Reopening a running transfer shows its state rather than starting another operation. Cancellation explains whether work stopped or only the window closed. After restart show Continue and Cancel transfer while preserving files.

Use readable phases and counts when known. Distinguish primary success from secondary-copy failure. Errors provide a next action with technical details behind disclosure. Closing/backgrounding cannot produce false success.

Project cards expose Apply changes from file and Restore copy with a readable diff. Ordinary management never requires JSON editing. Preserve external drafts during automatic copying and recover interrupted owned-write acknowledgments.

## 10. Implementation architecture

| Component | Responsibility |
| --- | --- |
| ProjectManagementPanel | Settings/list/status using the existing store and writer |
| TransferWizard | Shared step flow for settings, navigation and onboarding |
| SelectionPlanner | Native membership/metadata, scope, deduplication, bounds and inclusion reasons; no payload writes |
| TransferDraft | Immutable selection/revision/decision snapshot with invalidation |
| SenderLinkCatalogue | Exact sender targets and bounded traversal; schema2 |
| PackageNaming / Placement | Readable names, exclusive creation, internal IDs and ownership indexes |
| OperationCoordinator | One mutating transfer per vault, progress, late callbacks, recovery |
| Shared transfer form | Common viewport/scroll/focus contract |

Reuse package codecs, guards, typed remapping, checked settings writer, quarantine, installer/journal/recovery and configuration service. UI selection is not write authority. Incoming ZIPs remain untrusted. Naming changes require a versioned copy index and updated isProjectCopyPath/eligibility: service Markdown must stay out of folder/tag/native and file-linked DQL output. Arbitrary global DQL aggregates still need an explicit copy-area exclusion.

For tag-within-folder isolation, first prototype existing native-query: a tag source plus a canonical path condition through the shared filterEvaluator, preserving the source ID. Prove folder boundaries, recursion, new notes, exclusions and size-limit behaviour. Never add an unknown option to a plain tag source that older runtimes would ignore and silently broaden. If the existing contract cannot express the scope exactly, use a versioned model change rather than a second filtering engine.

## 11. Delivery order

1. Shared mobile container and keyboard/overflow reproductions across new windows.
2. Management panel and one wizard; commands call the same actions. No automatic old-file renames.
3. SelectionPlanner, four bulk modes, composition review and readable new ZIP names.
4. Link catalogue/schema2, readable configs/snapshots and checked index transition; legacy compatibility.
5. Destination/scope import, onboarding, panel recovery and end-to-end acceptance.

Each increment has focused verification and independent review; full C1 and a new candidate follow the connected workflow. Mobile defects block release.

## 12. Acceptance

- A new user creates, packages a folder/tag, opens a template and restores a copy without commands.
- A self-contained new package imports without per-file bindings; ambiguous legacy packages get understandable exceptions without guessing.
- Duplicate names, Unicode/NFC, subtags, cycles, duplicate files, limits, changing sources and destination conflicts never cause loss or silent omission.
- Cover 320/375/390 CSS px phones, large fonts, long labels, IME, keyboard, rotation and folder pickers. A physical iPhone is mandatory.
- Interruptions around file writes/primary publication, repeated clicks and restart recovery preserve old data and truthful outcomes.
- Retain schema1/copies/counters/formulas/project order; verify readable-name migration by readback and rollback.
- Keep automated evidence, manual results and host file-sharing limitations distinct in the final protocol.

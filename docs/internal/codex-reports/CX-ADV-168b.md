# CX-ADV-168b — adversarial-reviewer on #168 step (b) and #169 (vs main 4796ea6)

Run 2026-09-03 through `.codex/run-role.mjs --role adversarial-reviewer`, Codex session 01a065f2-770e-7890-bc69-2860d4a1a903. Verdict BLOCK, three P1 and one P2. All four were true; the three P1 are fixed and the P2 is recorded with its exact condition. Disposition in `BACKLOG.md` #168.

## Merge verdict: BLOCK

### P1 — External dashboard rows now do nothing

**Observed:** a dashboard table’s “Open note” invokes `PLAIN_MODE` ([tableRowOps.ts](src/ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts:110); the row button does too in [DataTableContent.svelte](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:136)). `PLAIN_MODE` is `"peek"` ([openRecord.ts](src/lib/record/openRecord.ts:44)); the shared store is rendered only by `View.svelte`, which searches that host view’s `sortedFrame` ([View.svelte](src/ui/app/View.svelte:239)).

The dashboard explicitly supports ready external frames, distinct from the parent frame. Therefore an external-row ID is absent from the host `sortedFrame`: `peeked` is `null` and the panel remains closed. The user clicks “Open note” and sees no result—worse than the former navigation.

**Confidence:** high.  
**Falsified by:** an external-source row resolving through its own peek renderer or the host frame demonstrably containing that external record.

### P1 — Closing the “peek” can discard edits

**Observed:** the peek embeds editable `EditNote` with the project autosave setting ([RecordCardView.svelte](src/ui/components/RecordCardView/RecordCardView.svelte:177)). Text edits are saved by a delayed timer ([EditNote.svelte](src/ui/modals/components/EditNote.svelte:185)); component destruction cancels that timer ([EditNote.svelte](src/ui/modals/components/EditNote.svelte:146)). Closing clears the selected record ([View.svelte](src/ui/app/View.svelte:292)), removing `EditNote`. With autosave disabled, closing never invokes manual save.

So a text edit followed by Escape/close before the debounce expires is lost; with autosave disabled, any unsaved edit is lost. This is especially misleading for a surface presented as a preview.

**Confidence:** high.  
**Falsified by:** a close path that flushes/awaits pending saves or a confirmation/discard flow.

### P1 — “Frontmatter keys” is false for derived fields

**Observed:** the panel lists every field as a key ([RecordCardView.svelte](src/ui/components/RecordCardView/RecordCardView.svelte:197)). The writer skips `derived` fields ([dataApi.ts](src/lib/dataApi.ts:273)). Relation enrichment adds `__resolved__…` fields marked derived ([crossProjectResolver.ts](src/lib/engine/crossProjectResolver.ts:80)); formula fields are likewise derived ([applyFormulaFields.ts](src/lib/dashboard-engine/applyFormulaFields.ts:70)).

Thus those displayed names are computed columns, not frontmatter keys, despite the panel claiming “the file, as it will be on disk.” `DataFieldType` alone does not decide this: a stored Relation field can be a real key; its derived resolved companion cannot. Rollup behavior likewise depends on `derived`, not merely its type.

**Confidence:** high.  
**Falsified by:** excluding or clearly labelling derived fields, or changing the write contract to persist them.

### P2 — A singleton peek is not per view

**Observed:** `recordPeek` is module-global ([recordPeek.ts](src/lib/stores/recordPeek.ts:32)). Each `ProjectsView` creates an independent `App` ([view.ts](src/view.ts:110)), hence an independent `View` renderer.

**Inference:** if more than one Projects leaf exists, one store update is observed by every leaf: it may render in another view that contains the same ID, or nowhere. The implementation has no ownership token or originating frame.

**Confidence:** medium.  
**Falsified by:** a lifecycle guarantee that only one ProjectsView can exist, or a live two-leaf test showing correct scoping.

### Focus, Inspector, and Calendar

- **Inspector is not affected by this flip:** its error action explicitly requests `"tab"` ([Inspector.svelte](src/ui/modals/components/Inspector.svelte:48)).
- **Calendar agenda:** I found no equivalent incompatible plain-open call. Its records originate from the Calendar frame; this is not evidence of a failure.
- **Escape in one panel:** observed safe in isolation. `focusTrap` handles only Tab ([focusTrap.ts](src/lib/a11y/focusTrap.ts:73)); `SlideInPanel` owns Escape ([SlideInPanel.svelte](src/ui/components/SlideInPanel/SlideInPanel.svelte:30)).
- **Nested Obsidian/modal behavior: UNKNOWN.** The trap has no stack/ownership model, while Settings has its own capture-phase Escape handler. I did not observe a live nested-panel path; code alone cannot establish actual Obsidian focus ordering.

The acceptance test proves the store changes and that `openLinkText` is not called; it does not mount `View`, test an external frame, edit/close a record, or verify frontmatter. I could not run the targeted Jest suites because the sandbox denied Node’s parent-directory `lstat`. `git diff --check` also reports trailing whitespace in generated `main.js`.


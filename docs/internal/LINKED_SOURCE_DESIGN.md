# Linked-source blocks — one decision for #132, #136, #137, #138, #139

> **Type:** design brief (read-only architecture). Contains no code.
> **Reference:** `specs/NOTION_DM_RESEARCH.md` — the project's grounded Notion model, authoritative
> on data management when documents conflict.
> **Status:** **Revision 2.** Gate 0 run 2026-08-27 rejected revision 1. The governing rule
> survived; three of five equivalence claims did not, the release order was wrong, and a P1 on the
> *write* path had been missed entirely. Corrections are marked so the way each was wrong stays
> visible — that is the part worth keeping.

## The defects are one defect

Filed separately because they surfaced separately, but the same failure in five places: **the
interface asserts something the runtime does not honour.**

| Ticket | What the user is shown | What is true |
|---|---|---|
| #132 | a pipeline editor that accepts steps | the steps' result is discarded |
| #136 | records, rendered normally | they belong to a different project |
| #137 | the source's fields, apparently | they are the parent project's fields |
| #138 | a relation view like any other | derived backlink fields are missing |
| #139 | "Add first record" on an external block | the record is created in the **parent** project |

## What the reference says

`NOTION_DM_RESEARCH.md` §1:

> «Операция живёт у объекта» — про колонку в колонке, про вид в «View options», про связь в
> свойстве. Никакого общего «процессора».

> «Каждое правило видно и снимается одним кликом» (pill с ×).

> «empty-state вида всегда показывает активные фильтры pill'ами — видно ЧТО скрыло» — 1 клик до
> снятия.

And §2, on the pipeline that survives the split:

> шаг, давший 0, подсвечен предупреждением с кнопкой «Отключить шаг» (замещает «Нет данных» без
> выхода — #092)

Notion never silently ignores a rule and never silently substitutes data.

## The rule

**The block never presents data whose origin it cannot state, never accepts configuration it will
not honour, and never writes somewhere other than where it reads.**

The third clause is new in revision 2. Revision 1 was written entirely about reading, which is how
#139 went unnoticed.

## Decisions

### #136 + #137 — one contract, shipped together

Revision 1 ordered these separately. That leaves an intermediate release where the source resolves
correctly but the editor still shows the parent's schema — the exact gap this brief exists to close.
They are one contract: **the source-state contract.**

**A fallback is not a loading state.** The parent frame stops being a substitute for linked-source
blocks. But `?? frame` cannot simply be deleted: the host reads `dbCallFrame.fields` unconditionally
(`WidgetHost.svelte:95`), so `undefined` breaks the render and an empty frame is the same silent lie
in a different costume.

What is needed is a state union — `loading | ready(frame) | unavailable | error` — which the
current plumbing cannot express. `resolveExternalFrame` returns `null` alike for a missing project,
an unreachable datasource and a thrown exception (`externalFrameResolver.ts:48`), and the preloader
simply omits those keys (`dashboardPreload.ts:94`). **The preloader must return per-source status,
not `Map<string, DataFrame>`.**

An honesty limit, stated rather than discovered later: the stored config keeps only `projectId`
(`types.ts:61`), so an unavailable source can be named by id but not by name unless a snapshot name
is added.

**The editor is configured against the block's own source** — «операция живёт у объекта» applied
literally. While the source is unresolved there is no schema to configure against, so the editor
shows the same state as the block rather than falling back to the parent's fields. Its live counters
run against that frame too, or the N→M numbers the reference requires would count the wrong records.

### #138 — enrichment belongs to the frame, not the path

External frames never get `enrichWithBacklinks`. Enrichment moves to `externalFrameResolver`, so
every frame arriving at a widget has the same shape regardless of origin.

`externalFrameResolver` is the right point: the canvas preloader keeps frames per canvas while App
already caches the promise per project id (`App.svelte:145`), and doing it in `WidgetHost` would
repeat the work per widget.

Two consequences that revision 1 hid, both now explicit:

- **Cost.** `enrichWithBacklinks` rebuilds an index and walks every record per relation field
  (`relationResolver.ts:157,197`), and a vault-wide invalidation clears the whole cache
  (`App.svelte:99`). On large external projects this is not free.
- **Blast radius beyond linked-source.** The same right-frames serve `join` and chart correlation
  (`dashboardPreload.ts:21`), and `join` copies right-frame fields into its output
  (`transformExecutor.ts:1119`). Resolver-level enrichment therefore **changes join's output
  schema**. Acceptable only as a deliberate additive change with a join regression test.

### #132 — steps that cannot run must not look like steps that do

Codex refuted running the pipeline unconditionally: stored steps that have never affected the
display would retroactively start doing so. Its counter-proposal — a versioned opt-in marker,
`transformExecution: "linked-source-v1"` — is adopted, **and made visible**, because an invisible
marker fixes the data-safety problem and leaves the interface problem untouched.

**The marker's UI must not contradict itself.** The header marks the pipeline active purely by
stored step count (`WidgetHost.svelte:163`, `WidgetHeaderActions.svelte:60`); placing "steps are
inert" beside an active-looking indicator makes the interface argue with itself. Two visible,
reversible branches:

- legacy → "stored steps do not run for an external source" + **Enable**;
- marked → "pipeline runs for this external source" + **Disable**, which removes the marker and
  keeps the steps.

The marker is written atomically with the first live `apply`: `PipelineEditor` saves on a debounce
(`PipelineEditor.svelte:42`) and the host persists `transform` on that event
(`WidgetHost.svelte:199`), so waiting for a "Done" that does not exist would lose it.

**Two scope branches, both required.** `applyWidgetScope` decides by field presence on the incoming
frame (`widgetScope.ts:47,71`) while linked-source is currently forced to `scopeApplied: false`
(`WidgetHost.svelte:96`). A **marked** widget computes scope on its own enriched frame and passes
the real `scope.applied` before axis C runs; a **legacy** one keeps `scopeApplied: false`.

### #139 — the write path breaks the rule outright

An external block receives the **parent** dashboard's `api` and `project`
(`widgetComponentRegistry.ts:145`). "Add first record" on an empty external source creates the note
in the parent project (`DatabaseCallBlock.svelte:196`), and row edits call the parent's api
(`DataTableContent.svelte:126`).

This is worse than the display defects because it writes. Until a source-specific write API exists,
**external blocks are read-only** for creation, editing and schema changes.

## Order

**`(#136 + #137)` → #138 → #132**, with **#139 independent and first if it ships alone**, since a
read-only guard does not depend on any of the others and stops data going to the wrong project now.

## Equivalence claims — revision 2

1. **Confirmed.** Removing the parent fallback changes no rendering for a block whose source
   resolves: `rightFrames.get(projectId)` already takes precedence (`WidgetHost.svelte:86`), and the
   preloader stores only successfully resolved frames (`dashboardPreload.ts:86`). Only the
   unresolved case changes — from wrong data to a state.

2. **Corrected.** Passing the resolved source to `PipelineEditor` does not change the *displayed*
   result before opt-in, because the editor's props do not feed the render branch.
   *Revision 1 said "no pipeline currently executes at all" — false.* `executeTransform` runs for
   any widget with steps (`WidgetHost.svelte:67`); its result is simply discarded for this path.
   Executing and being-displayed are different claims.

3. **Corrected.** Enrichment is additive **only absent name collisions**. `enrichWithBacklinks`
   adds `<relation>_backlinks` without checking and overwrites a same-named value through the
   `...extraValues` spread (`relationResolver.ts:209,223`). A vault with a real field of that name
   loses it. Requires a reserved namespace or a collision check with diagnostics.

4. **Corrected and narrowed.** After #136 and #138 land, absence of the marker selects the external
   branch *as it stands at that point* — enriched external frame, no `executeTransform` over it,
   `scopeApplied: false`. It is **not** identical to today's render. The guarantee is continuity
   across #132 alone, not across the whole sequence. (`transformExecution` does not yet exist in
   `WidgetDefinition` — `types.ts:65`.)

5. **Withdrawn as a claim; it is a required implementation branch.** See the two scope branches
   under #132. Flagged weak in revision 1 and correctly so.

## What this brief does not decide

- Retry policy for an unresolved source — belongs with the `externalFrameCache` invalidation
  contract.
- Whether `join`'s right-hand source becomes a block property, as `NOTION_DM_RESEARCH.md` §2
  proposes. That is #099 territory and would change what "linked source" means.
- The shape of a source-specific write API (#139 beyond the read-only guard).

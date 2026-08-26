# Linked-source blocks — one decision for #132, #136, #137, #138

> **Type:** design brief (read-only architecture). Contains no code.
> **Tickets:** #132 (axis C never runs), #136 (wrong project's records rendered),
> #137 (editor configured against the parent frame), #138 (no backlink enrichment).
> **Reference:** `specs/NOTION_DM_RESEARCH.md` — the project's grounded Notion model, which is the
> authority on data management when documents conflict.
> **Status:** awaiting Gate 0 (Codex design challenge) per `TWO_MODEL_PROTOCOL.md`.

## The four are one defect

They were filed separately because they surfaced separately, but they are the same failure in four
places: **the interface asserts something the runtime does not honour.**

| Ticket | What the user is shown | What is true |
|---|---|---|
| #132 | a pipeline editor that accepts steps | the steps never execute |
| #136 | records, rendered normally | they belong to a different project |
| #137 | the source's fields, apparently | they are the parent project's fields |
| #138 | a relation view like any other | derived backlink fields are missing |

Fixing them one at a time invites four different answers to the same question. Fixing them together
needs one rule, and the reference already states it.

## What the reference says

`NOTION_DM_RESEARCH.md` §1 lists the principles that make Notion's data management feel simple.
Three bear directly:

> **«Операция живёт у объекта»** — про колонку в колонке, про вид в «View options», про связь в
> свойстве. Никакого общего «процессора».

> **«Каждое правило видно и снимается одним кликом»** (pill с ×).

> **«empty-state вида всегда показывает активные фильтры pill'ами — видно ЧТО скрыло»** — 1 клик
> до снятия.

And §2, describing the pipeline that survives the split:

> шаг, давший 0, подсвечен предупреждением с кнопкой «Отключить шаг» (замещает «Нет данных» без
> выхода — #092)

Notion never silently ignores a rule and never silently substitutes data. When nothing is shown, it
shows *why*, attached to the thing that caused it, with one click to undo.

## The rule

**The block never renders data whose origin it cannot state, and never accepts configuration it
will not honour.**

Everything below follows from that sentence. Where a choice exists between guessing on the user's
behalf and showing them the situation, the reference says show them.

## Decisions

### #136 — a fallback is not a loading state

`rightFrames.get(projectId) ?? frame` silently substitutes the parent project's records when the
external source has not resolved. This is the most severe of the four: the user sees plausible data
and has no signal at all.

**Decision:** the block renders a *state*, never a substitute — resolving, or source-unavailable
naming the project it wanted. This is Notion's empty-state principle applied literally: the surface
says what happened and offers the one action that resolves it.

The parent frame stops being a fallback for linked-source blocks entirely.

### #137 — the operation lives with the object

`WidgetHost` passes `fields={frame.fields}` and `source={frame}` unconditionally, so a block reading
project X is configured against project Y's schema.

**Decision:** the editor receives the block's own resolved source. Directly «операция живёт у
объекта» — the pipeline belongs to this block, so it is configured against what this block reads.

Consequence worth stating: while the source is unresolved there is no schema to configure against,
so the editor shows the same state as the block rather than offering the parent's fields. That is
the rule applied consistently rather than an exception carved out for convenience.

The editor's live counters must run against the same frame too, or the N→M numbers the reference
requires would be counting the wrong records — today they execute without `rightFrames`, so a `join`
preview already disagrees with runtime.

### #138 — enrichment belongs to the frame, not to the path

External frames never get `enrichWithBacklinks`: the fallback path selects the raw frame, and the
normal path stores what `resolveExternalFrame` returns, which is a raw `queryAll()`.

**Decision:** enrichment happens where frames are resolved, so every frame arriving at a widget has
the same shape regardless of origin. A block should not be able to tell whether its records came
from the parent project by which derived fields exist.

This one is a prerequisite, not a preference: #137 shows the source's fields, and if enrichment is
path-dependent then the fields shown depend on how the frame arrived.

### #132 — steps that cannot run must not look like steps that do

Codex refuted the original plan (run the pipeline unconditionally): stored steps that have never
executed would retroactively activate for an unknown number of users. Its counter-proposal was a
versioned opt-in marker, `transformExecution: "linked-source-v1"`.

**Decision: adopt the marker, but make it visible.** An invisible marker resolves the data-safety
problem and leaves the interface problem — the user still cannot see why their steps do nothing.
The reference's own answer for an inert step already exists: highlight it, explain it, and offer one
click.

So: a legacy linked-source block with stored steps renders exactly as it does today, and shows the
steps as inactive, with the reason and a single action that enables them. Taking that action writes
the marker. Blocks that save a pipeline after this ships get the marker at save time, because for
them nothing is being retroactively changed.

The marker is schema evolution: it needs a migration that is a no-op on already-marked configs, and
`configProvenance` coverage proving the generators emit the current shape.

## Order

#138 → #136 → #137 → #132, and it is not arbitrary.

Enabling axis C (#132) on a path that may be showing another project's records (#136) and is
configured against the wrong schema (#137) would run transforms over the wrong data with the user's
apparent consent. Each ticket removes a way the next one could be wrong.

## Equivalence claims

Stated so they can be attacked; each names the mechanism and where to check it.

1. **Claim:** removing the parent-frame fallback (#136) changes no rendering for a block whose
   source resolves, because `rightFrames.get(projectId)` returning a frame already takes precedence
   over the `?? frame` branch — `WidgetHost.svelte:86`. Only the unresolved case changes, and it
   changes from wrong data to a state.

2. **Claim:** passing the resolved source to `PipelineEditor` (#137) cannot change any *existing*
   pipeline's behaviour, because on this path no pipeline currently executes at all (#132). The
   editor's inputs affect what a user can build next, not what runs today.

3. **Claim:** enriching external frames at resolution (#138) is additive to their shape:
   `enrichWithBacklinks` adds derived `*_backlinks` fields and values and removes nothing —
   `relationResolver.ts:191,227`. A filter or step naming an existing field keeps matching.

4. **Claim:** a legacy block without the marker renders identically before and after #132, because
   the marker's absence selects the current code path unchanged. Only an explicit user action moves
   a block onto the new path.

5. **Claim — the weak one, stated as such:** these four changes do not interact badly with the
   conditional scope from #118. `applyWidgetScope` decides by field presence on the incoming frame;
   changing which frame arrives changes that decision. This is exactly the reasoning that refuted
   the previous brief's claim that "the axes depend only on fields, not origin", and it deserves the
   same scrutiny here rather than a second pass.

## What this brief does not decide

- Whether an unresolved external source should retry, and how often. That is a reactivity question
  and belongs with the `externalFrameCache` invalidation contract, not here.
- Whether `join`'s right-hand source should become a block property, as `NOTION_DM_RESEARCH.md` §2
  proposes. That is #099 territory and would change what "linked source" means; this brief works
  within the current meaning.

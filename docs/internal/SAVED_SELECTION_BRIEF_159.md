# Design brief — a saved selection as an addressable source (#159)

> **Status:** DRAFT **revision 2** — revision 1 was rejected at Gate 0 on 2026-08-28.
> Verdict and mechanisms: `codex-reports/CX-GATE0-159.md`.
> **Decision it implements:** #147, taken by the user 2026-08-27 — a saved selection becomes a real
> entity, and the abandoned sub-base model was deleted (#160) rather than finished.
> **Vision scene:** 5 — "the filter itself becomes a base".
> **User outcome:** a person names a selection once and opens it as the source of another view.

## 0. What Gate 0 changed

Three claims went in; none survived intact. The corrections are not cosmetic — two of them change
the design, not the wording:

1. **A selection is not "a block with a subFilter".** `applyWidgetScope` defers a `subFilter` past
   the transform pipeline when it names a field the raw frame does not have
   (`widgetScope.ts:36`), so a filter over `_group_size` or a computed column works *after* C. A
   selection defined as `applyFilter(frame(B), F)` on the raw frame would return nothing for the
   same F. **Consequence: the brief must say which frame a selection is defined over, and it is not
   the raw one.**
2. **"Recomputed exactly when the frame changes" is false today, before any caching is added.**
   Membership moves with the clock (`is-today`, `is-overdue`, rolling ranges) and with the arrival
   of external frames for relation/rollup conditions — while the source frame is untouched. And
   external frames are already cached (`App.svelte` `externalFrameCache`, `dashboardPreload.ts`).
   **Consequence: this needs an invalidation contract, not a claim of purity.**
3. **"Nothing migrates" is false.** Turning `WidgetSourceConfig` from `{ projectId }` into a tagged
   union breaks every stored external `database-call`: readers ask for `sourceConfig.projectId`, and
   an old config in the new shape falls through to the parent-frame fallback — i.e. silently shows
   the wrong source. **Consequence: a read-time normalizer is part of v1, not a follow-up.**

## 1. What the promise actually is

From the essay: *"I configure a filter … this filter itself becomes a base."* Two properties follow.
The first already works — a named view with a filter recomputes as data changes. The second does
not exist: nothing can *point at* a selection, because `WidgetSourceConfig` carries only a
`projectId` (`types.ts:54-63`) and `view.filter` has no identity of its own.

## 2. Constraints this design does not get to break

- **Markdown-first.** A selection owns no records; deleting one never deletes a note.
- **One relation model** (D-6). Any relation-aware behaviour goes through `relationContract`.
- **The documented filter order.** If a selection cannot live where the ADR says scope lives, the
  ADR is amended in the same change — not afterwards.
- **Stored data stays modellable** (#120, #160). Old documents keep loading; no key is dropped from
  a type while a released version may have written it.
- **Green gates are not user-flow evidence.** This ships with a manual scenario.

## 3. The design questions, revised

### Q1 — Where does a selection live?

A selection belongs to the base it filters: stored on the project, with a uuid identity and a name
that is only a label. Rename must not break references; deletion of the base cascades.

### Q2 — One base or several?

**v1: one base.** A union across bases with different schemas has no defined record shape, and
"selection over a selection" multiplies the invalidation problem in Q3 before it is solved once.
Stated as deferred, not as impossible.

### Q3 — Which frame defines membership, and when is it recomputed?

**This replaces the old Claim 3, and it is now the centre of the design.**

Membership is evaluated over **the enriched frame** — after relation resolution and rollup folding,
before the widget transform pipeline (`View.svelte` does exactly this order today: enrich →
rollups → `applyFilter`). That makes a selection able to filter on a rollup or a relation-derived
column, which is what the essay's own example needs ("last session more than two weeks ago" is a
rollup over sessions).

The invalidation contract must therefore name every input, because a selection is stale the moment
one of them moves without recomputation:

| Input | Changes when | Currently signalled by |
|---|---|---|
| Source frame | notes added/edited/deleted | `dataFrame` store |
| External frames (relation/rollup) | target notes change, or the frame finishes loading | `externalFrameInvalidation`, `dashboardPreload` |
| Clock | `is-today`, `is-overdue`, rolling ranges cross midnight | **nothing today** |
| Schema/config | field deleted, relation retargeted | settings store |

The clock row is the one with no mechanism. v1 must either exclude relative-date operators from
selections or introduce a rollover tick — and say which, because "the list was right when you
opened the tab" is exactly the kind of quiet wrongness this product keeps finding.

### Q4 — Creating a record "in a selection"

The revision-1 rule ("allow it when every condition is value-expressible") does not survive: a
strict comparison writes a value that fails its own condition (`count > 3`, `date is-after X`),
negations and unary operators have no satisfying default (`is-empty`, `is-not`, `has-none-of`), an
`OR` needs only one branch and a contradictory `AND` has no solution at all, derived fields cannot
be written to frontmatter at all (`dataApi.ts:233` excludes them), and the base's own predicate
(folder / tag / native-query / Dataview) is a second gate the record must also pass.

**Revised rule — creation is offered only when the system can construct a candidate *and* verify it
after writing.** Concretely: build defaults from the satisfiable subset, write the note, re-evaluate
membership, and if the record is not in the selection, say so and offer to open it where it landed.
Anything less silently creates a record that vanishes.

Where verification is impossible or the source is external (external blocks are read-only until a
source-specific write API exists, D-3), the block offers **"Create in \<base\>"** and says why.

### Q5 — Broken, empty, and not-yet-known

Three states that must not look alike: **empty** (evaluated, matched nothing), **broken** (a field
or the base is gone, an operator no longer applies), **pending** (an external frame the conditions
depend on has not loaded). Revision 1 had two; the third is what the enriched-frame decision in Q3
introduces. Precedent: the linked-source states from #136.

### Q6 — Which axis?

A selection is scope (axis A) evaluated over the enriched frame — which is what the ADR's
`enrich → A → C` already says. **No ADR change is required**; what is required is that the resolver
consumes the enriched frame and waits for its dependencies, rather than filtering a raw one.

Note the known irregularity it must not inherit: the linked-source path hands the external frame
straight through, bypassing C (`FILTER_ORDER_ADR.md` §Implementation status). A selection over an
external base must define which of the two it follows.

### Q7 — May a relation point at a selection?

**v1: no**, and enforced in the picker rather than left undefined. The narrow case that already
exists — `targetSubBaseFilter`, a filter on a relation's target — stays the only way to narrow a
relation's scope. If v2 allows selections as relation targets, it reuses that mechanism.

### Q8 — Compatibility with what is already stored

`WidgetSourceConfig` becomes a tagged union, **plus a read-time normalizer** that maps a legacy
`{ projectId }` to `{ kind: "project", id }` at every read point. Without it a stored external
block falls back to the parent frame and shows another project's records — the #136 defect,
re-introduced by a type change.

Existing named views with filters are **not** migrated. "Promote this view's filter to a selection"
is an offered action, and it deep-copies the whole `FilterDefinition` — `groups`, `conjunction` and
disabled conditions included. A shallow copy of the flat condition list is how #125 destroyed user
filters.

## 4. Equivalence claims (revision 2)

> **Claim 1.** A selection over base B with filter F, and a view of B whose `view.filter` is F,
> contain the same records — because both evaluate F over the enriched frame of B through
> `filterEvaluator`, in the same position of the documented order.
> *(The revision-1 claim compared a selection to a widget `subFilter`; that one is false, because a
> `subFilter` may be deferred past the transform pipeline.)*
>
> **Claim 2.** Promoting a view's filter leaves that view rendering exactly what it rendered before,
> because the promotion deep-copies the definition and does not touch `view.filter`.
>
> **Claim 3.** A selection's rendered membership equals a fresh evaluation of F over the current
> enriched frame, for every input named in Q3 — including a pending external frame, which yields the
> `pending` state rather than a smaller set.

Claim 3 is the one to attack next: it is the honest form of what revision 1 got wrong, and the
`pending` state is the part most likely to be skipped in implementation.

## 5. Questions that must be answered before implementation tickets

Raised by Gate 0, ordered by cost of getting them wrong:

1. Persisted schema and compatibility contract: where selections live, how they version, how legacy
   `{ projectId }` reads, what happens to unknown keys.
2. Lifecycle and invalidation: the table in Q3, made executable — including whether stale output is
   ever acceptable.
3. Write path: which `ProjectDefinition` and `ViewApi` a selection block writes through, and how
   post-write verification reports failure.
4. Broken-state taxonomy: which conditions are error, which are pending, which are simply empty.
5. Interaction with source-level predicates: folder / tag / native-query / Dataview already restrict
   the base; a selection is not the only membership gate.
6. Reference integrity: deleting a selection or its base, duplicate names, orphaned widget sources.
7. Required invariant tests and the manual scenario: a filter over a rollup with a delayed external
   load, a relative-date rollover, a legacy external source config, a creation that fails
   verification, a deleted field.

## 6. Next step

Revision 2 goes back to Gate 0 — specifically Q3's invalidation table, Q4's verify-after-write rule
and Claim 3. Implementation tickets are written only after that pass, and each will carry a
`Vision scene` and a `User outcome` per the template (#154).

---

# Revision 3 — why this option (2026-09-03, closing #170)

## The finding that reframes the brief

Both #170 and `REFERENCE_NOTION_UI_2026.md` state that this product has no container level, and
that its absence is what forces a fourth entity. **That is false, and it was never checked against
the code.** Verified 2026-09-03:

- `ProjectDefinition.additionalSources?: DataSource[]` — `v3/settings.ts:239`, carried into
  `v4/settings.ts:51`.
- Resolved and merged at runtime — `DataFrameProvider.svelte:75-85`, via `mergeDataFrames`.
- Added, edited and removed in live UI — `CreateProject.svelte`.

A project is already a container of N sources. What its sources lack is not existence but
**identity**: every variant is `{ kind, config }` with no `id` and no `name`, and the merge
dissolves them into one frame. And `NativeQueryDataSource` (#048) — a filter-based database
persisted as a project datasource, narrowed through the canonical `filterEvaluator` — is a saved
selection stored as a source. It shipped. It is simply anonymous and unaddressable.

## The three options, on one table

| | **A — the reference's compromise** | **B — selection as its own entity** (chosen 2026-08-27) | **C — named sources in the container** |
|---|---|---|---|
| Stores | nothing new | `ProjectDefinition.selections?: SavedSelection[]`, and `WidgetSourceConfig` becomes a tagged union | `id?` / `name?` on `DataSource`; one new `DerivedDataSource`; `sourceId?` on `WidgetSourceConfig` |
| A shipped key changes meaning | no | **yes** — `WidgetSourceConfig.projectId` becomes legacy-only behind a normalizer, and can never be removed | **no** — every addition is optional, and absent means today's behaviour |
| Filter order / one engine | untouched | untouched by design: membership at axis A over the enriched frame | untouched **only if pinned**: a derived source resolved in the datasource layer would filter at ACQUISITION, and a `where` on a rollup would then match nothing — the Gate 0 refutation that killed revision 1 |
| What the user gains, in the vault | nothing over today | "I name the filter Overdue clients and pick it as a block's source" | the same sentence, **plus** "my two Sessions folders each have a name, and a block can point at one instead of the merge" |
| Migration | none | **not none** — the union breaks every stored external `database-call`; a reader asking for `projectId` falls through to the parent frame and silently shows another project, which is #136 re-created by a type change | **none, truthfully** — absent `sourceId` yields the merged frame, byte-identical; a new `data.json` still opens in the old build |
| Forecloses | scene 5, permanently; `additionalSources` stays anonymous forever | **the container level** — the project would hold two permanent lists of things that produce records, one addressable and one not, and the shipped one can never be deleted to unify them | only the v2 cases the brief already defers, which stay expressible later as `from: <sourceId>` |

## Does the user's 2026-08-27 decision survive?

**The outcome survives. The entity does not.**

The decision was that a selection must be *addressable* — nameable, and openable as the source of
another view. Option C delivers that sentence verbatim. What does not survive is the unstated
premise under "therefore it must be a fourth entity": that a project has one source, so a set of
named record-sets has nowhere to live. The code says it has N, and has since before the decision
was taken.

The reference was the trigger, not the evidence. Its own answer — "we have no container level" —
is marked as a conclusion rather than a code reading, and the code refutes it. That inverts the
price: B was weighed as "one new entity against no home for it", when the real weight is that **B
adds a second list beside a shipped one and forces a tagged union with a mandatory normalizer**,
while **C adds two optional fields and migrates nothing**. Same user sentence, strictly cheaper,
strictly less foreclosing.

**Nothing analytical is discarded.** B's answers about *when* membership is computed — the enriched
frame at axis A, verify-after-write, the three states empty/broken/pending, deep-copy on promotion
— are carried into C's step 2 in full. C wins on where the thing is stored and how it is addressed;
B already won the argument about when it is computed.

Two problems belong to derived membership whichever option ships, and the brief keeps saying so:
the clock row of the invalidation table (`is-today`, `is-overdue` move with no signal), and the
linked-source bypass of axis C (#132).

## Decision

**Option C, in two steps, the first introducing no new concept at all.**

**Step 1 (S).** Give the sources a project already has an identity, and let a block address one:
`id?` / `name?` on the `DataSource` variants; `sourceId?` on `WidgetSourceConfig`; the resolver
returns one named source's frame when `sourceId` is present and the merge when it is not; the
project editor shows a name per source. No new kind, no new semantics, nothing stored that changes
meaning.

**Step 2 (M).** Add `kind: "derived"` — the saved filter itself — resolved at **axis A over the
enriched frame**, with verify-after-write and the three states. This is where revision 2's work
lands.

**The one product judgement, decided 2026-09-03:** a saved filter appears as a **fourth kind beside
Folder / Tag / Query**, not in a separate "Saved filters" section. Its own section would rebuild
the fourth-entity mental model in the interface right after the storage had avoided it. The kinds
stay visible in one list — Folder, Tag, Query, Saved filter — because the `PRODUCT_RESET` §3 trap
is one word covering several mechanisms, and the cure is showing the mechanism, never hiding it.

**Observable acceptance result:** a project whose primary source is `Clients/` and whose
`additionalSources[0]` is `Archive/Clients/` named "Archive"; a dashboard with two `database-call`
blocks, one addressing the project and one addressing the archive source. The first renders both
folders, the second only the archived records, and the same `data.json` opened in the pre-change
build renders both blocks as the merge, with no error and no data loss.

## Rejected

- **A** — delivers no new capability over what ships today, and adopting it means conceding the
  readiness criterion of scene 5 and filing it in `VISION_DEVIATIONS.md`. It is the honest fallback
  if step 2 proves unaffordable, not the plan.
- **B** — rejected on foreclosure rather than effort. It permanently installs a second list of
  record-producers beside a shipped one that can never be removed, and forces a union whose
  migration risk Gate 0 already had to catch once. Do not re-propose it as "simpler because it is a
  fresh entity": the entity is the expensive part.

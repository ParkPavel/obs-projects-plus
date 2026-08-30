# The filter model — what affects what

> **Ticket:** #122 (closes M-FILTER-CONSOLIDATION).
> **Companion:** `FILTER_ORDER_ADR.md` states the engine invariant. This document states the
> model a person has to hold in their head to predict what they will see.
> **Engine:** `src/lib/engine/filterEvaluator.ts` — the single filter engine. Every surface below
> compiles to a `FilterCondition` and goes through it. There is no second comparator.

## The one sentence

Every filter in a dashboard answers exactly one of three questions, and they are answered in a
fixed order: **what data am I looking at (A) → how is it reshaped (C) → what did I just click (B)**.

Before #116–#121 there were six filtering layers with no documented order, two comparators, and a
transform pipeline that quietly ran before block-level scope. The layers were not the problem —
the absence of a single question each layer answers was.

## The three axes

### A — Scope: "what data am I looking at"

Stable constraints. A person sets them, walks away, and expects them to still be true tomorrow.

| Surface | Where it is configured | Applied at |
|---|---|---|
| View filter | `ViewFilterBar.svelte` (filter pills above the view) | `View.svelte:179` |
| Block filter (`subFilter`) | `BlockFilterBar.svelte` inside a database-call block | `widgetScope.ts` ← `WidgetHost.svelte` |
| Filter-tabs widget | the `filter-tabs` widget on the canvas | `dashboardFilters.ts` — `applyFilterTab` |
| Per-tab filter | a view tab's own settings inside a block | the tab's config |

The view filter is the outermost scope: it narrows the frame every widget receives. A block's
`subFilter` narrows only that block. They compose — a block can only ever narrow what the view
already handed it, never widen it back.

**Promoting a filter-tab to the view filter.** The FilterBridge chip lifts an active filter-tab
selection onto the view filter — moving a constraint from a widget up to the whole view, within
axis A. It composes: the promoted condition narrows the stored filter through the same
`andComposeFilters` the #118 migration uses, so an `or` filter is nested rather than appended to
(appending would widen it). `dashboardFilters.ts` — `promoteFilterTabToGlobal`.

### C — Advanced transform: "how is the data reshaped"

Structural or computational change: `pivot`, `join`, `unnest`, `unpivot`, `aggregate`, `compute`.
Configured in `PipelineEditor.svelte`, surfaced as **"Advanced transforms"**, applied by
`executeTransform` in `WidgetHost.svelte`.

This axis is deliberately not the first thing a person reaches for. Ordinary filtering and grouping
were lifted out of it by #118 — a leading `filter` step became `subFilter` (axis A) and a lone
terminal `group-by` became view-level grouping. What is left genuinely changes the *shape* of the
frame, not its extent.

### B — Reactive selection: "what did I just click"

Transient. It lives as long as a selection does, and releasing the selection must restore exactly
what A and C produced — nothing sticks.

| Surface | Where |
|---|---|
| Canvas selection bus | `canvasSelectionStore.ts` — `composeEffectiveFilter` |
| Linked selection (relation-driven) | `relationFilterAdapter.ts` — `filterByLinkedSelection` |

## The order, and why

```
data source → enrich (relations/formulas) → A scope → C transform → B selection → sort → render
```

**A before C** is the part that changed behavior (#118, user-confirmed 2026-08-24). It is not
arbitrary. A transform step can rename or drop the very fields a scope condition names: filter
after a `pivot` and the condition may refer to a column that no longer exists, silently matching
nothing. Scope first means the conditions always run against the fields the person actually chose
them from.

It also makes the pipeline cheaper — it reshapes a frame that is already narrowed.

**A before C, *where A can be evaluated there*.** The unconditional form of this rule was wrong for
dashboards saved before #118, and a cross-model review caught it after the code had shipped behind
four green gates. A block's `subFilter` used to be applied to the *transformed* frame, and the
filter UI offered that frame's fields — so a stored filter may legitimately name a column only the
pipeline creates (`_value` from `unnest`, `_group_size`, a computed column). Running it ahead of
the pipeline matches nothing and empties the block.

So `applyWidgetScope` checks first: if every field the conditions name already exists, axis A runs
early as designed. If not, the filter is left for the block to apply after the transform, exactly
as it did before, and `scopeApplied` is false so the block knows to do it. The invariant is the
order, not the position of the code that enforces it.

**B last** is what keeps selection reversible. If a selection were applied before the transform, its
effect would be baked into aggregates and could not be undone by deselecting.

**Sort after everything**, because sorting a frame that is about to be filtered is wasted work and
sorting a pivot's output is what the person actually sees.

## What affects what

| I changed… | …and this changes | …but not |
|---|---|---|
| View filter | every widget in the view | other views |
| Block `subFilter` | that block, and what its pipeline receives | sibling blocks |
| Filter-tabs widget | the widgets it drives | the view filter |
| Advanced transform | that widget's shape and its aggregates | which records are in scope |
| Canvas / linked selection | every block bound to that selection, until released | anything stored |

Reading the table upward answers the support question people actually ask — "why is this row
missing?" — by naming the outermost thing that could have removed it.

## Outside this model

- **Calendar's formula filter** (`filterEngine`, formula-based) is a separate model and is
  explicitly out of scope for the A→C→B order — see `FILTER_ORDER_ADR.md` § Non-goals.
- **Datasource-level filters** (`datasources/dataview`, `native-query`) run at acquisition, before
  a frame exists. They decide what is fetched, not what is displayed.
- **Cross-project relation and rollup filters** (`crossProjectResolver.ts`,
  `crossProjectRollup.ts`) filter a *foreign* frame to resolve a relation. They are part of data
  resolution, not of what the viewer is looking at. (`subBasePartition.ts` was here too; the
  abandoned sub-base model was deleted in #160.)
- **Analytical joins are not relations** (#148). `executeJoin` (`transformExecutor.ts`) and the
  scatter chart's `correlation` (`chartDataPipeline.ts`) pair records by *any two fields* the user
  picks. They do not read `RelationFieldConfig`, they do not use `relationContract`, and they do
  not distinguish `resolved` / `unmatched` / `ambiguous`: an inner join drops unmatched rows, a
  left join keeps them with `null`, and scatter silently takes the **first** of several matches.
  That is legitimate analysis, and it is deliberately not the relation model — a relation is a
  declared property of the data, a join is a question asked of it. Two consequences worth stating
  where a user can see them: a join can pair records the relation model would call ambiguous, and
  the numbers it produces are not comparable with a rollup over the same field.
- **The table's free-text search** (`tableCanon.ts` — `filterRecordsByQuery`) narrows by substring
  across `id` and every value, ignoring field types entirely. It is a view-local find, not a filter:
  it stores nothing, survives no reload, and composes with nothing. It sits outside the axes on
  purpose — but it *does* remove rows, so when someone asks why a row is missing, this is the one
  surface the "what affects what" table above will not account for. Check the search box first.

## Adding a new filter surface

Ask which of the three questions it answers. If the answer is "a bit of two", it is two surfaces.

1. **Compile to `FilterCondition`.** Dispatch by `DataFieldType`, never by `field.name`. Never
   write a comparator — `applyFilterTab` did (`String(raw) === value`) and it silently broke
   Relation matching until #117 removed it.
2. **Place it on an axis**, and let the existing order apply. Do not add an application point.
3. **Emptiness is not a detail.** A definition carrying only `groups` still filters; a guard that
   checks `conditions.length` alone reads it as "no filter" and passes everything through. This bit
   `DatabaseCallBlock` until #118.
4. **Never filter the same frame twice on the same axis.** After a reshape, re-applying a scope
   condition can drop every row. `WidgetHost` tells the block it already applied scope via
   `scopeApplied`.

## History

| Ticket | What it closed |
|---|---|
| #119 | Deleted the dead `dashboard-v1` archive (5401 LOC) |
| #116 | The order ADR + its invariant test |
| #117 | Routed filter-tabs through the canonical engine, killing the parallel comparator |
| #121 | Unified the two Pipeline config entry points |
| #118 | Split the pipeline into axes A and C; migrated stored pipelines; A now runs before C |
| #120 | Dropped the orphaned config panels of retired widget types |
| #122 | This document |
| #125 | Promotion preserves the stored filter: groups, `or`, and disabled conditions |

## Known gaps

- **The linked-source path skips axis C entirely.** When a `database-call` widget has its own
  `sourceConfig.projectId`, `WidgetHost` feeds the block the external frame directly, so the
  transform pipeline never runs — while the pipeline button stays available. This predates #118
  (`#092`) but now contradicts the ADR. Tracked as #132.
- **A pipeline `group-by` is an aggregation, not grouping.** `executeGroupBy` collapses the frame
  to one record per group with `_group_size`; the view-level `groupBy` only sections records. They
  are different operations with confusingly similar names, and #118 briefly migrated one into the
  other. Tracked as #133.

# ADR: Canonical dashboard filter order

- Status: Accepted — implemented (see Implementation status)
- Ticket: #116
- Decision date: 2026-08-24

## Decision

The target order for a dashboard data frame is:

```text
enrich → A (scope) → C (advanced transform) → B (reactive selection) → sort → render
```

This is an engine invariant, not a user-facing model. User-facing controls remain
with the object they configure; the axes define only the order in which their
effects are composed.

| Axis | Boundary | Current configuration surfaces |
| --- | --- | --- |
| A — scope | Stable constraints that define the data scope | `view.filter`, filter-tabs, `block.subFilter`, per-tab filter |
| C — advanced transform | Explicit structural or computational transformation | `executeTransform` / advanced transform |
| B — reactive selection | Transient, interaction-driven constraints | `composeEffectiveFilter` → `filterByLinkedSelection` |

### Where `sort` actually runs (#152, corrected 2026-08-27)

There are **two** sorts, and only the second one matches the line above.

1. **View-level sort** (`View.svelte` — `applySort(filteredFrame, viewSort)`) runs immediately
   after A, *before* the dashboard applies C and B. Every widget on the canvas receives an
   already-ordered frame.
2. **Widget-level sort** — the dashboard table sorts again from its own config
   (`DataTableContent.svelte` → `tableCanon.applySort`), after everything. This is the sort a
   person sees in a table.

The invariant as originally written — "sort runs after all A, C and B" — is therefore true of the
widget sort and false of the view sort.

**Decision: document it, do not move it.** `View.svelte` is shared by table, board, calendar,
gallery and dashboard; moving its sort behind the dashboard pipeline would change row order for
every non-dashboard view to fix an ordering nobody has reported, and the surface that matters —
the table — re-sorts last anyway. What the view sort does affect is the *input* order of the
pipeline (relevant to steps that depend on row order) and the series order of chart/stats widgets,
which have no second sort of their own. If that becomes a real complaint, the fix is a
dashboard-specific sort stage, not a change to the shared view.

Rendering consumes the resulting sorted frame.

## Implementation status

**Implemented** as of 2026-08-25. This section replaces the migration boundary
that stood here while the order was still aspirational; the invariant test that
pinned that wording was rewritten at the same time, because it had started to
protect a statement that was no longer true.

- **A → C** is wired in `WidgetHost.svelte`: `applyWidgetScope` narrows the
  enriched frame, and `executeTransform` receives the scoped frame (#118).
- **C → B** is wired in `DatabaseCallBlock.svelte`: the block applies the
  linked/canvas selection to the frame the host already scoped and transformed.
- **filter-tabs** compile to canonical `FilterCondition`s through
  `deriveTabCondition` and run on the single engine (#117).

### One conditional, and why it is not an exception

`applyWidgetScope` moves axis A ahead of axis C **only when the scope can be
evaluated there** — when every field its conditions name already exists on the
incoming frame.

Before #118 a block's `subFilter` was applied to the *transformed* frame, and
the filter UI offered that frame's fields, so a stored filter may legitimately
name a column the pipeline creates (`_value` from `unnest`, `_group_size`, a
computed column). Running such a filter ahead of the pipeline matches nothing
and empties the block. In that case the filter is left for the block to apply
after the transform, exactly as before, and `scopeApplied` is false so the block
knows to do it.

The invariant is the order in which the axes compose, not the position of the
code that enforces it. A scope that cannot be evaluated early is still axis A;
it is simply applied at the only point where it means what the user wrote.

This case was found by cross-model review after the unconditional form had
already shipped behind four green gates — see `TWO_MODEL_PROTOCOL.md`.

### Known gap

The linked-source path (`database-call` with its own `sourceConfig.projectId`)
renders the external frame with axes A and B applied but **never runs axis C**,
while still offering the pipeline editor. It predates this ADR and contradicts
it. Tracked as #132.

## Non-goals

The Calendar formula filter is outside this ADR. It uses a separate formula-based
advanced filtering model and is not part of the dashboard A → C → B migration.

# ADR: Canonical dashboard filter order

- Status: Accepted — target architecture
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

`sort` runs after all A, C, and B effects. Rendering consumes the resulting
sorted frame.

## Current state and migration boundary

This ADR specifies the target architecture; it does not describe the current
runtime wiring. The current runtime remains scattered across view filtering and
sorting, filter-tabs, widget transforms, block `subFilter`, linked selection,
and per-tab behavior. In particular, existing runtime order must not be inferred
from the target sequence above.

This document is a documentation contract. Its invariant test verifies the ADR's
claims only; it does not prove that existing runtime wiring implements this order.

## Ownership

- #117 owns routing filter-tabs through the canonical filter engine so that the
  scope boundary has consistent condition semantics.
- #118 owns splitting and migrating the transform pipeline into the target
  architecture, including the required behavior review for the changed order.

## Non-goals

The Calendar formula filter is outside this ADR. It uses a separate formula-based
advanced filtering model and is not part of the dashboard A → C → B migration.

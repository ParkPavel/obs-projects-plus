# Current project context

> **Updated:** 2026-07-18
> **Historical log:** `archive/CONTEXT_2026-06-26.md`
> **Active product contract:** `PRODUCT_RESET_2026-07-18.md`

## Current directive

Build a local Markdown-first system rather than a Notion clone. New product work follows the
Relation-first vertical slice in `BACKLOG.md` and must map to a scene in the Product Reset.
The old W2–W5 sequence is historical; it does not select the next product ticket.

## Working tree and release state

- Branch: `feat/095-pipeline-value-placeholder`.
- Existing working-tree stack: #105–#109, uncommitted and not pushed. It is technical
  stabilization, not product readiness.
- Documented validation of that stack (2026-06-26): build 0 errors; Jest 162 suites / 2287
  tests; lint 0; svelte-check 0; PX budget 177. These are historical results and must be
  rerun before any PR claim.
- User-owned remaining check: manual visual confirmation described in
  `DASHBOARD_GUIDE_AND_TESTING.md`, `TEST_REPORT_2026-06-26.md` and
  `UNTESTABLE_FEATURES_2026-06-26.md`; then merge/push remain user actions.

## Next product milestone

`M-RELATION-FIRST` is the active queue.

1. **#110 P0 — Relation-first design brief and baseline audit.** It has
   `analysis_required: true` and `analysis_done: false`; the orchestrator must stop at this
   gate until the analysis/design brief is approved.
2. **#111 P0 — Canonical Relation contract.** One model for WikiLink relation, inverse,
   resolution and unmatched records.
3. **#112/#113/#114 — Guided setup, related records/rollup, and relation-aware Dashboard.**
4. **#115 P0 — End-to-end Clients → Sessions acceptance vault.**

## Active sources of truth

| Question | Source |
|---|---|
| Product intent and delivery order | `PRODUCT_RESET_2026-07-18.md` |
| Original user experience | `DASHBOARD_V2_VISION.md` |
| Current executable ticket queue | `BACKLOG.md` |
| Technical architecture and invariants | `DASHBOARD_V2_SPEC.md`, `ARCHITECTURE_V5.md`, `AGENTS.md` |
| UI grammar reference | `specs/NOTION_GRADE_PIPELINE.md`, `UI_DESIGN_ARCHITECTURE.md` |
| Current manual validation | `DASHBOARD_GUIDE_AND_TESTING.md`, `TEST_REPORT_2026-06-26.md` |

## Documentation rules

- Use the archive for evidence only; do not select work from archived roadmaps.
- Four technical gates are necessary but do not prove user-flow readiness.
- A Relation feature is incomplete without creation, editing, inverse relation, related records,
  rollup, unmatched state, keyboard path and reactive Markdown update coverage.
- Do not begin implementation for #110 or its dependents before the required analysis gate is
  explicitly closed.

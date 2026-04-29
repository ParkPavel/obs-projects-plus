# Database Roadmap 2026

## Scope

Roadmap for Database direction after v3.4.1 stabilization.

- Product baseline: release 3.4.1 published.
- Quality baseline: 42 suites, 839 tests, production build success.
- Strategic target: overview-first UX, quick actions, relation/rollup-first analytics, fully usable transform pipeline.

## Principles

- One model, multiple views: table/board/gallery share one data context.
- Visual-first composition: core workflows must work without raw JSON editing.
- Release-safe delivery: each milestone must include tests, docs sync, and migration safety.

## Milestones

### M1 — Overview First (Q2 2026)

Outcome:

- User creates a useful Database overview in one action.

Deliverables:

- Overview preset blueprint.
- Quick Action Bar model and UI.
- Finance starter presets (Accounts, Journal, Categories, Monthly Summary).

Code anchors:

- `src/ui/views/Database/DatabaseView.svelte`
- `src/ui/views/Database/widgets/WidgetToolbar.svelte`
- `src/ui/views/Database/widgets/widgetTemplates.ts`
- `src/ui/views/Database/types.ts`

Definition of done:

- New overview preset is available from UI.
- Quick actions create prefilled records.
- User-guide section updated for overview and quick actions.

### M2 — Pipeline Completion (Q2-Q3 2026)

Outcome:

- All transform steps are fully configurable with clear feedback.

Deliverables:

- Complete step editors for filter, aggregate, pivot, unpivot, unnest.
- Step-level preview metadata (before/after rows and columns).
- Inline validation and actionable error hints.

Code anchors:

- `src/ui/views/Database/widgets/PipelineEditor.svelte`
- `src/ui/views/Database/engine/transformTypes.ts`
- `src/ui/views/Database/engine/transformExecutor.ts`

Definition of done:

- No step needs manual JSON editing.
- Step reorder impact is visible to user.
- Regression tests cover all step editors and critical edge cases.

### M3 — Relation and Rollup KPI Surface (Q3 2026)

Outcome:

- KPI widgets are relation-first and useful out of the box.

Deliverables:

- KPI templates with rollup-ready defaults.
- Empty-state guidance for relation-dependent widgets.
- Preset cards for common management and finance dashboards.

Code anchors:

- `src/ui/views/Database/widgets/StatsCard.svelte`
- `src/ui/views/Database/widgets/SummaryRow/SummaryRowWidget.svelte`
- `src/ui/views/Database/engine/relationResolver.ts`

Definition of done:

- KPI presets work on demo vault and real user structures.
- Relation setup guidance appears in widget empty states.
- User-guide examples include relation and rollup flows.

### M4 — Stabilization and Release Readiness (Q4 2026)

Outcome:

- Database UX and docs are release-ready for broad adoption.

Deliverables:

- Cross-view consistency pass (table, board, gallery).
- Performance and accessibility pass.
- Documentation release pass and cleanup.

Definition of done:

- Performance budget met on representative datasets.
- No high-severity audit findings.
- Product docs and changelog synchronized with shipped behavior.

## Dependencies and Risks

- Dependency: stable migration compatibility for existing Database configs.
- Dependency: consistent i18n updates across en/ru/uk/zh-CN where behavior changes.
- Risk: UX complexity can outgrow discoverability if presets lag behind engine growth.
- Risk: pipeline feature additions without test expansion can cause silent regressions.

## KPI Targets

- Time to first useful overview: under 2 minutes for a new user.
- Manual JSON edits for standard workflows: 0.
- Transform-related bug reports: decreasing trend after M2.
- Release documentation lag: 0 unresolved items at release cut.

## Governance

- Active execution details live in `docs/IMPLEMENTATION_PLAN_CURRENT.md`.
- This roadmap is the calendar-level source of truth for Database direction.
- Update after each milestone close or scope shift.
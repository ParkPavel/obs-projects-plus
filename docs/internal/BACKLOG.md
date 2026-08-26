# Project Backlog — obs-projects-plus

> **Plugin version**: see `package.json` (currently `3.5.1-alpha`)
> **Updated**: 2026-08-24 (active milestone **M-FILTER-CONSOLIDATION** on branch `feat/116-filter-order-adr`; #119/#116/#117/#121 ✅ DONE, #118/#120/#122 📋. M-RELATION-FIRST #110–#115 ✅ DONE on `feat/112` pending merge+smoke. Baseline **164 suites / 2313 tests**, tsc 0, `@ts-ignore` 0. Prior W2/W3 queue is historical — superseded by the product reset + this consolidation.)
> **Supersedes**: `REFACTOR_BACKLOG_V5.md` (legacy, archived); `.ai_internal/New-specification/BACKLOG.md` (working copy, archived)

> **Product priority reset (2026-07-18):** `PRODUCT_RESET_2026-07-18.md` is the active
> product contract. New user-facing work must map to a Vision scene and acceptance outcome.
> The next product milestone is **R1 Relation-first vertical slice**; existing W2/W3 entries
> are not deleted, but must not supersede R1. Technical bugfixes and the #105–#109 validation
> stack may proceed independently.

## Ticket format

```
### #NNN — Title
- Status:             BACKLOG | IN-PROGRESS | DONE | DEFERRED
- Milestone:          M-<name>
- Priority:           P0 / P1 / P2 / P3
- Complexity:         XS (≤30 LOC) | S (≤200) | M (≤500) | L (≤1500) | XL (>1500)
- analysis_required:  true | false
- analysis_done:      true | false   ← only when analysis_required: true
- Depends on:         #NNN
- Blocks:             #NNN
```

> **NEEDS-ANALYSIS gate**: if `analysis_required: true` and `analysis_done: false`,
> the orchestrator must run a dedicated analytics session before any dev work starts.

---

## Milestone M-FILTER-CONSOLIDATION — 🔥 ACTIVE (consolidation before R3/R4)

> Basis: `ARCHITECTURE_DEBT_AUDIT_2026-08-22.md` + design `FILTER_CONSOLIDATION_DESIGN.md`.
> A user manual-test session surfaced 6 overlapping filter layers + an un-split transform
> pipeline + dead code — architecture tangled to critical mass. Approved by user 2026-08-22 to
> run BEFORE relation-first R3/R4. Goal (PRODUCT_RESET §R2): collapse 6 layers into 3 axes
> (A Scope / B Reactive / C Advanced), one engine, one documented order. Branch:
> `feat/122-filter-consolidation`. Implementation order: #119 → #116 → #117 → #121 → #118 → #120 → #122.

### #119 — Delete dead src/archive/dashboard-v1
- Status: ✅ DONE (2026-08-22, commit `2e886a7`)
- Milestone: M-FILTER-CONSOLIDATION | Priority: P2 | Complexity: S
- 5401 LOC / 25 prod files + 6 archived test suites, 0 prod imports (R0_4). Baseline 168/2336 → 162/2288.

### #116 — Filter-order ADR + order-invariant test
- Status: ✅ DONE (2026-08-24, commits `0c70f7a` + `9b1aaad`) | Milestone: M-FILTER-CONSOLIDATION | Priority: P1 | Complexity: S
- analysis_required: false | Blocks: #117, #118
- `docs/internal/FILTER_ORDER_ADR.md` documenting the canonical A→C→B order; a red-first
  order-invariant test that pins it (`src/__tests__/R_filterOrder.invariant.test.ts`, PASS).
  Foundation for the rest.

### #117 — Route filter-tabs through the canonical engine
- Status: ✅ DONE (2026-08-24, commit `a3d9d77`) | Milestone: M-FILTER-CONSOLIDATION | Priority: P1 | Complexity: XS
- Depends on: #116
- Killed the parallel comparator `applyFilterTab`/`dashboardFilters.ts` (`String(raw)===value`);
  added `deriveTabCondition(field, active)`, dispatched by `DataFieldType`, and delegated to
  `filterByLinkedSelection` → `matchesCondition`. Condition-parity golden test
  (`dashboardFilters.test.ts`, 24 cases) covers String/Select/Status/Relation/Number/Boolean/
  Date/List, including the Relation bare-name-vs-wikilink regression and a Select
  case-sensitivity guard. `applyFilterTab` public signature unchanged.

### #121 — Unify the two Pipeline config entry points
- Status: ✅ DONE (2026-08-24, commits `7084897` + `4eb3458`) | Milestone: M-FILTER-CONSOLIDATION | Priority: P2 | Complexity: S
- Depends on: #116 | `WidgetHost.svelte:183` + `:199` → single entry.
- Removed the "Expand list" unnest quick-toggle from `DatabaseCallSettings` (Option a).
  Database-call unnest now goes exclusively through the Σ `PipelineEditor`'s "Array fields
  detected" banner (`addUnnestForField`). Deleted the 5 unnest-as-block-property tests in
  `databaseCallSettings.test.ts`, added a no-affordance regression guard there, and added
  banner coverage (detection, exclusion of already-unnested fields, debounced apply) to
  `PipelineEditor.mutation.test.ts`. Net test count unchanged (164/2313).

### #118 — Split the transform pipeline (advanced mode) + migration
- Status: ✅ DONE (2026-08-24, commit `f66a9a6`) | Milestone: M-FILTER-CONSOLIDATION | Priority: P1 | Complexity: L
- analysis_required: true | analysis_done: true (design done) | Depends on: #116, #121
- Terminal `filter` step → migrates to `subFilter`; terminal `group-by` → view-level group;
  `pivot/join/unnest/unpivot/aggregate/compute` stay as explicit Advanced mode (closes R2 decl).
  Union `TransformStepType` NOT trimmed immediately (schema-evolution); idempotent migration, never
  loses data. **User decision: RESOLVED 2026-08-24** — the user explicitly confirmed the A→C→B order.
  Pipeline-filter now applies AFTER subFilter (an inversion of previous behavior — data safe,
  behavior changes).
- Delivered: `widgetScope.ts` (axis A, pure) applied in `WidgetHost` before `executeTransform`;
  `DatabaseCallBlock.scopeApplied` stops the double-filter (re-applying after a reshape could drop
  every row); `migrateTransformToViewLevel` in `legacyMigration.ts` wired at load via
  `migrateDashboardTransforms` → `dashboardView.onOpen`. Migration lifts a leading `filter` run to
  `subFilter` and a lone terminal `group-by` to view level; everything unprovable stays in the
  pipeline. Idempotent. `PipelineEditor` retitled "Advanced transforms" + hint (4 locales).
- Found while wiring: AND-merges are flattened (a groups-only shape reads as "empty" to UI guards)
  and `DatabaseCallBlock`'s own guard now counts `groups`, not just `conditions`.

### #120 — Remove retired WidgetTypes + orphaned config panels
- Status: ✅ DONE (2026-08-25) | Milestone: M-FILTER-CONSOLIDATION | Priority: P2 | Complexity: S
- Depends on: #118 | 7 retired types (of 16, ~8 live) + `configPanelRegistry.ts:70-186`.
- **Scope corrected during implementation — the `WidgetType` union was NOT trimmed.** The ticket
  title asked to remove the retired types, but four of the seven (`comparison`, `timeline`,
  `yaml-visualizer`, `sub-base-canvas`) have no successor: the documented fate table keeps their
  stored configs and renders `LegacyWidgetPlaceholder`. Dropping them from the union would leave a
  stored `data.json` widget unmodellable and unrenderable — data loss, and a direct violation of the
  schema-evolution rule in CLAUDE.md. They also stay in `WIDGET_REGISTRY`, which supplies the
  placeholder's label/icon, and are already excluded from creation by the `legacy` palette filter.
- Delivered: the seven orphaned `configPanelRegistry` entries are gone. They were provably dead —
  the cog is gated on `WIDGET_PANELS[type]` existing (`WidgetHost.svelte:165`) and no retired type
  has a panel component, so `hasCog`/`isConfigured`/`initDefaults` were unreachable maintenance
  weight. `PANELS` is now `Partial<Record<WidgetType, …>>`; `getConfigPanel` stays **total** via a
  shared `NO_PANEL` fallback, because `WidgetHost` dereferences `.hasCog` unconditionally and an
  undefined lookup would crash the widget. `configPanelRegistry.ts` 217 → 155 lines.

### #122 — Unified filter mental model (umbrella)
- Status: ✅ DONE (2026-08-25) | Milestone: M-FILTER-CONSOLIDATION | Priority: P1 | Complexity: M
- Depends on: #116, #117, #118, #120, #121 | Closes the 6→3-axis consolidation.
- Delivered `docs/internal/FILTER_MODEL.md`: the user-facing counterpart to `FILTER_ORDER_ADR.md`
  (which states the engine invariant). Names the one question each axis answers, maps every
  configuration surface to its application point with `file:line`, gives the "what affects what"
  table that answers "why is this row missing?", explains *why* A precedes C (a reshape step can
  rename away the fields a scope condition names), lists what sits outside the model (Calendar
  formula filter, datasource-level filters, cross-project resolution), and states the rule for
  adding a new filter surface — including the two traps this milestone actually hit: writing a
  private comparator (#117) and a `conditions.length` emptiness guard that ignores `groups` (#118).
- Cleared the stale `DataTableContent.svelte` doc-comment: it pointed at `src/archive/dashboard-v1`
  (deleted in #119) and described F2.4/F2.5 work as still upcoming, though header menu, resize and
  grouping had all landed. No other source reference to the deleted archive remains.

### #123 — promoteFilterTabToGlobal drops records for non-String filter-tab fields
- Status: ✅ DONE (2026-08-25) | Milestone: M-FILTER-CONSOLIDATION | Priority: P2 | Complexity: XS
- Found by audit-manager during #117 review (2026-08-24), out of #117's scope (function untouched
  by that diff). `promoteFilterTabToGlobal` (`src/ui/views/Dashboard/dashboardFilters.ts:66-81`)
  always emits `{ field, operator: "is", value, enabled: true }` regardless of the field's
  `DataFieldType`. `"is"` is a `StringFilterOperator` only (`src/settings/base/settings.ts:67,75,
  83,134`) — not a member of `NumberFilterOperator`/`BooleanFilterOperator`/`DateFilterOperator`/
  `ListFilterOperator`. Traced through `matchesCondition` (`src/lib/engine/filterEvaluator.ts:
  130-152,172-175`): for a Number/Boolean/Date/List field, no typed branch fires on operator `"is"`,
  so it falls through to `console.warn("[FilterEngine] Unhandled filter…")` / `return false` —
  every record is silently dropped. Confirmed reachable: `FilterTabsConfig.svelte`/
  `FilterTabsWidget.svelte` place no `DataFieldType` restriction on which field can back a
  filter-tab, and `DashboardCanvas.svelte:108-111` (`promoteLocalToGlobal`) calls
  `promoteFilterTabToGlobal` unconditionally. Fix: dispatch by `DataFieldType` the same way
  `deriveTabCondition` (added in #117, same file) already does — `frame.fields` is already
  available at the `DashboardCanvas.svelte:110` call site. Needs a regression test for each
  affected `DataFieldType` (Number/Boolean/Date/List) promoted to global filter.

### #124 — Orphaned unnest-* i18n keys left after #121
- Status: ✅ DONE (2026-08-25) | Milestone: M-FILTER-CONSOLIDATION | Priority: P3 | Complexity: XS
- Found by audit-manager during #121 review (2026-08-24). #121 deleted the "Expand list" unnest
  checkbox markup from `DatabaseCallSettings.svelte` but left the 4 i18n keys it used —
  `views.dashboard.database-call.settings.unnest-label` / `-field` / `-none` / `-hint` — in all
  4 locale files (`src/lib/stores/translations/{en,ru,uk,zh-CN}.json`), 16 dead string entries
  total. Harmless (i18next silently ignores unused keys) but should be cleaned up. Confirmed via
  grep: no remaining code reference to any of the 4 keys.

---

## Milestone M-RELATION-FIRST — ✅ DONE (pending merge + manual acceptance)

> Product contract: `PRODUCT_RESET_2026-07-18.md` §3–§6. This milestone is a vertical
> user outcome, not a collection of dashboard controls. It takes precedence over new W2/W3
> product work. Existing crash/security/regression fixes may continue independently.
> All tickets #110–#115 ✅ implemented on `feat/112-guided-relation-setup` (pushed); user
> gates remaining: OBStests visual smoke + merge. Follow-on debt is M-FILTER-CONSOLIDATION above.

### #110 — Relation-first design brief and baseline audit
- Status: ✅ DONE (2026-07-18)
- Milestone: M-RELATION-FIRST | Priority: P0 | Complexity: M
- analysis_required: true
- analysis_done: true
- Blocks: #111, #112, #113, #114

Implementation decision: approved design brief is
`RELATION_FIRST_DESIGN_BRIEF_110.md` (2026-07-18).

Deliverable: one approved design brief for `Clients → Sessions`: canonical Relation contract,
entry points, current-state screenshots/steps, data migration, terminology, accessibility and
end-to-end acceptance. It must explicitly distinguish Relation, `linkedSelection` and chart
correlation; no implementation begins before the distinction is approved.

### #111 — Canonical Relation contract and compatibility boundary
- Status: 🚧 IN-PROGRESS (2026-07-18)
- Milestone: M-RELATION-FIRST | Priority: P0 | Complexity: L
- analysis_required: true
- analysis_done: true
- Depends on: #110
- Blocks: #112, #113, #114

Analysis record: `RELATION_CONTRACT_ANALYSIS_111.md` (2026-07-18). One domain contract for WikiLink relations, inverse relations, target resolution, unmatched
records and relation metadata. `linkedSelection` may consume this contract but must not become
an alternate relation model. Include migration/compatibility tests for existing frontmatter.

Progress (verified 2026-08-22): implementation committed `2ed9903` — `src/lib/relations/relationContract.ts`
delivers resolution (resolved/unmatched/ambiguous), `validateLegacyLinkedSelection` (legacy
`linkedSelection` consumes the contract, no parallel model), and `adaptRelationFieldConfig` migration.
Unit tests green (`relationContract.test.ts`). Not merged/pushed. Candidate for DONE review at the merge gate.

### #112 — Guided Relation setup and record editing flow
- Status: ✅ DONE (2026-08-22)
- Milestone: M-RELATION-FIRST | Priority: P0 | Complexity: XL
- analysis_required: true
- analysis_done: true
- Depends on: #110, #111
- Blocks: #115

Architecture: `GUIDED_RELATION_SETUP_ARCHITECTURE_112.md` (2026-07-19). Delivered: pure layer
(`relationSetup.ts` — validate/preview/summary/config), wizard UI (`RelationSetup.svelte` — full
i18n 4 locales, displayField picker), modal wrapper (`relationSetupModal.ts`), controller
(`relationSetupController.ts`). Entry points: schema editor, Configure field form, Create field
form, empty Relation cell (event chain RelationPickerPopover → EditableCell → TableRow →
DataTableContent). Controller unit tests (7 tests). All 4 gates PASS: 165 suites / 2305 tests,
build 0, lint 0, svelte-check 0, px ≤177. Audit: READY FOR PR (no P0/P1 findings).

### #113 — Related records and rollup starter surface
- Status: ✅ DONE (2026-08-22)
- Milestone: M-RELATION-FIRST | Priority: P0 | Complexity: L
- analysis_required: true
- analysis_done: true
- Depends on: #111
- Blocks: #115

After a Relation exists, expose related records and a `count` rollup without configuring a
pipeline. Offer a clear next action to create a linked Database Call or a chart from the same
relation; verify reactive Markdown updates.

### #114 — Relation-aware Dashboard interactions
- Status: ✅ DONE (2026-08-22)
- Milestone: M-RELATION-FIRST | Priority: P1 | Complexity: L
- analysis_required: true
- analysis_done: true
- Depends on: #111, #112
- Blocks: #115

Make Selection Bus and linked blocks explain and reuse the configured Relation. When no Relation
exists, distinguish a temporary filter from a persistent relationship. Do not add another
dashboard-only linking configuration.

### #115 — Clients → Sessions end-to-end acceptance vault
- Status: ✅ DONE (2026-08-22, manual acceptance pending)
- Milestone: M-RELATION-FIRST | Priority: P0 | Complexity: M
- analysis_required: false
- Depends on: #112, #113, #114

Acceptance in a clean `OBStests` scenario: create/link a session to a client, observe inverse
related records and session count, edit Markdown externally, see every relevant view update,
and open a date/pain chart. Evidence: automated tests, four technical gates, manual screenshots
and an accessible keyboard path.

---

## Milestone M-ENGINE-CLEANUP — ✅ COMPLETE

### #006 — Migrate all `new Menu()` to `openContextMenu`
- Status: ✅ DONE (2026-05-06)
- Milestone: M-ENGINE-CLEANUP | Priority: P2 | Complexity: M
- analysis_required: false

### #007 — ReDoS guards + JSON.parse safety
- Status: ✅ DONE (2026-05-06)
- Milestone: M-ENGINE-CLEANUP | Priority: P1-security | Complexity: XS
- analysis_required: false

### #015 — Replace `(view as any).$set` with typed `updateProps()`
- Status: ✅ DONE (2026-05-06)
- Milestone: M-ENGINE-CLEANUP | Priority: P3 | Complexity: M
- analysis_required: false

### #014 — Tests on UI-critical paths
- Status: ✅ DONE (2026-05-06) — useView (8), folder datasource (14), dataview (12), viewHelpers (15)
- Milestone: M-ENGINE-CLEANUP | Priority: P2 | Complexity: L
- analysis_required: false

### #002 — Unify formula stack (Phase 1: canonical imports)
- Status: ✅ Phase 1 DONE (2026-05-06). Phase 2 (evaluateValue move) → M-YAML-FORMULA-UI.
- Milestone: M-ENGINE-CLEANUP | Priority: P2 | Complexity: XL (total)
- analysis_required: false

---

## Milestone M-COLOR-SETTINGS — ✅ COMPLETE

### #005 — Unified Color/Palette system
- Status: ✅ DONE (2026-05-06)
- Milestone: M-COLOR-SETTINGS | Priority: P2 | Complexity: M
- analysis_required: false

### #008 — Settings migration v3 → v4
- Status: ✅ DONE (2026-05-06)
- Milestone: M-COLOR-SETTINGS | Priority: P2 | Complexity: M
- analysis_required: false
- Depends on: #005

---

## Milestone M-CANVAS-REACTIVE — 🔄 ACTIVE

Goal: Decompose DashboardCanvas, then close the reactive loop. #016 needs the clean
structure from #013 as its subscription point.

### #013 — Decompose DashboardCanvas.svelte (~700 LOC)
- Status: 📋 BACKLOG
- Milestone: M-CANVAS-REACTIVE | Priority: P2 | Complexity: L
- **analysis_required: true**
- **analysis_done: false**
- Depends on: #002 (formula bar simplifies after Phase 1)
- Blocks: #016, #009

Analysis needed: Map all concern boundaries inside DashboardCanvas before splitting.
Identify: layout/dnd owner, command-bus subscribers, preload logic, reactive chains.

Files:
- `src/ui/views/Dashboard/DashboardCanvas.svelte` — leave only layout/dnd (~250 LOC)
- new `src/ui/views/Dashboard/dashboardCommands.ts` — command-bus subscribers
- new `src/ui/views/Dashboard/dashboardPreload.ts` — right-frame preload + generation token

### #016 — Close reactive loop: vault events → cache → UI push
- Status: ✅ DONE (2026-05-19) — Phase 1 closed via merge `b1b3102` (`feat/016` → main)
- Milestone: M-CANVAS-REACTIVE | Priority: P0 | Complexity: S
- analysis_required: true | analysis_done: true (diagnosis revised during implementation — see commit `db6d604`)
- Depended on: #013 (descoped — fix shipped without full canvas split)
- Blocks: #010 (now unblocked)

Final fix (commit `db6d604` "fix(#016): co-locate transform-cache invalidation with dataFrame mutators"):
- Cache invalidation co-located with `dataFrame` mutators in `src/lib/stores/dataframe.ts`
- `src/ui/views/Dashboard/engine/transformCache.ts` exposes `invalidate(projectId)` + `invalidateAll()`
- New test suite `src/lib/stores/dataframe.invalidation.test.ts` (186 LOC) covers the closed loop
- Acceptance met: modify source file → Dashboard updates in ≤500ms without manual action.

Original diagnosis (2026-05-08 `ANALYTICAL_REVIEW`) was partially incorrect — invalidation was already
wired in `App.svelte` for vault events; the actual gap was co-location with `dataFrame` mutators
(merge/refresh paths). Documented for future analytics-vs-implementation parity.

### #031 — DataProvider Registry (per-canvas, Svelte context)
- Status: ✅ DONE (2026-05-19) — 3 sub-PRs landed on `feat/031.x-*` branches
- Milestone: M-CANVAS-REACTIVE | Priority: P1 | Complexity: M
- analysis_required: false (resolved during implementation)
- Depends on: none (works on current reactive cycle independently of #016)

Outcome: per-canvas registry of widgets that expose data (`DataProvider` interface).
Foundation for cross-widget filtering (#035) and chart wiring on top of Database
Windows. Not a singleton — each `DashboardCanvas` mounts its own registry via
`setContext(DATA_PROVIDER_REGISTRY_CONTEXT_KEY, ...)`.

Sub-PRs:
- **31.1** `feat/031.1-dataprovider-registry-factory` (e787b90):
  `src/lib/stores/dataProviderRegistry.ts` + `__tests__/dataProviderRegistry.test.ts`
  (9 tests). Pure module: `DataProvider`/`DataProviderRegistry` types, Symbol context
  key, factory with `register`/`unregister`/`getProvider`/`notifyAll`/`clear` + reactive
  `subscribe`. Each `update()` creates a new Map for reactivity.
- **31.2** `feat/031.2-dataprovider-registry-wiring` (6056f5a):
  `DashboardCanvas.svelte` instantiates per-canvas registry, sets context, clears on
  destroy. No consumers yet.
- **31.3** `feat/031.3-dataprovider-registry-consumers` (8f303c7):
  `DatabaseCallBlock.svelte` gains `widgetId`/`widgetTitle` props, mounts a
  `providerFrame` writable mirroring the `frame` prop, registers via context on mount,
  unregisters on destroy. `WidgetHost.svelte` propagates the ids. New 6-test suite
  `dataProviderRegistration.test.ts` covers lifecycle, frame reactivity, title fallback,
  no-context no-op.
- **31.4** — ProviderPicker UI component deferred to #035 (cross-widget filtering)
  per IMPLEMENTATION_ROADMAP.md.

Gates: tsc 0 errors, Jest 118 suites / 1815 tests PASS, no `@ts-ignore`, no new px values.

---

## Milestone M-TABLE-REWRITE — ✅ DONE

### #001 — Replace legacy DataGrid with Dashboard DataTable widget
- Status: ✅ DONE (2026-05-21) — DataTable widget реализован с column virtualization и group headers, legacy DataGrid используется как shared library
- Milestone: M-TABLE-REWRITE | Priority: P1 | Complexity: L
- analysis_required: false
- Depends on: #005, #008, #014
- Blocks: #009

Files:
- delete `src/ui/views/Table/TableView.svelte` (~424 LOC) + `src/ui/views/Table/tableView.ts` (archived to `.ai_internal/Archive/legacy-TableView/`)
- remove remap in `src/ui/app/useView.ts`
- finalize `src/ui/views/Dashboard/widgets/DataTable/` (column virtualization + group headers — COMPLETE)

### #004 — Fix footer aggregation `count` semantic divergence
- Status: ⏸ DEFERRED → after #001
- Milestone: M-TABLE-REWRITE | Priority: P1 | Complexity: S
- analysis_required: false
- Depends on: #001

---

## Milestone M-SUBBASES — ✅ COMPLETE

Goal: Matryoshka-style nested canvases with cross-base data flow.

### #009 — Sub-base canvas (Matryoshka first deliverable)
- Status: ✅ DONE (2026-05-21) — analysis + implementation shipped
- Milestone: M-SUBBASES | Priority: P2 | Complexity: XL (~1500 LOC)
- analysis_required: true | analysis_done: true
- Depends on: #001 (✅), #008 (✅)
- Blocks: #010

**Implementation (2026-05-21)**:
- Mount chain verified: `DashboardCanvas` → `WidgetGrid` / `FreeCanvas` → `WindowShell` → `WidgetHost` → branch `widget.type === "sub-base-canvas"` → `<SubBaseCanvasWidget>` (`SubBaseCanvasWidget.svelte:1–263`, 263 LOC).
- `deriveSubBasePartition.ts` exports: `partitionFrame`, `deriveSubBaseItems`, `SubBaseLike` — correct, no naming conflicts.
- CRUD handlers: `handleSelect` / `handleAdd` / `handleRename` / `handleRemove` — emit `change` events up through `dashboardWidgets.ts`.
- `SubBaseTabs.svelte` hook-up at `SubBaseCanvasWidget.svelte:139–147`.
- Gate: `crossSubBase` tests **3 suites / 31 tests PASS** (incl. `resolveAcrossSubBases`, `resolveWithinBase`).

### #010 — Bidirectional relations + rollups across sub-bases
- Status: ✅ DONE (2026-05-21) — analysis + implementation shipped
- Milestone: M-SUBBASES | Priority: P2 | Complexity: XL (~800 LOC)
- analysis_required: true | analysis_done: true
- Depends on: #009 (✅)
- Blocks: M-DATAVIEW-BRIDGE (analytical baseline for Dataview absorbtion)

**R5-010 (реализовано в `SubBaseCanvasWidget.svelte:41–88`, `crossSubBase.ts:121–233`)**:
- `inverseTarget` lookup (3-tier matching): exact `id` → `basename` (no extension, case-insensitive) → `name`/`title` field value — `SubBaseCanvasWidget.svelte:45–65`.
- `resolveInverseAcrossSubBases(target, field, frame, tabsModel) → CrossSubBaseResult[]` — `src/lib/relations/crossSubBase.ts:189`.
- `resolveAcrossSubBases` (forward): `src/lib/relations/crossSubBase.ts:121`.
- `buildParentIndex` + `resolveTargets`: index-based O(N) wikilink resolution — `crossSubBase.ts:1–120`.
- Results partitioned by `activeId`, rendered via `syntheticFrame` + `deriveListItems` — `SubBaseCanvasWidget.svelte:66–88`.
- Gate: 3 test suites / 31 tests PASS (forward + inverse + same-base).

---

## Milestone M-YAML-FORMULA-UI — 📋 BACKLOG

### #003 — Merge Calendar agenda filterEngine into filterEvaluator
- Status: ✅ DONE (shipped in a prior session as "R5-003"; status sweep 2026-05-21)
- Milestone: M-YAML-FORMULA-UI | Priority: P1 | Complexity: M (delivered)
- analysis_required: false
- Depends on: #002 Phase 1 (✅)

Outcome: `src/ui/views/Calendar/agenda/filterEngine.ts` collapsed from ~396 LOC
into a 121-LOC thin delegator over canonical `lib/engine/filterEvaluator`.
Calendar-specific semantics (regex op, strict `is-upcoming`, formula
resolution relative to agenda's `baseDate`) are now expressed via canonical
operators + `FilterOpts.upcomingInclusive: false`. Legacy v3.0.4 operator
names (`equals`, `not_equals`, …) are mapped to canonical ones inside
`toCondition`. Closes the CLAUDE.md invariant "filterEvaluator.ts —
единственный filter engine: не создавать параллельных реализаций".

Test coverage: `src/ui/views/Calendar/agenda/filterEngine.test.ts` covers
the delegation contract. Source file header documents the migration.

### #002 Phase 2 — Move `evaluateValue` to `lib/formula/index.ts`
- Status: ✅ DONE — retroactive documentation (drift recovery 2026-05-25)
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: M
- analysis_required: false

`evaluateValue` уже перемещён в `src/lib/formula/extendedEvaluator.ts` и re-exported из `src/lib/formula/index.ts` как `evaluateFormulaValue` / `evaluateFormulaWithError`. `src/ui/views/Dashboard/engine/formulaEngine.ts` — 21-LOC re-export shell с явным header "R5-002 Phase 2".

### #022 — UnifiedFormulaConstructor (replace AST node system in FormulaVisualEditor)
- Status: ✅ DONE (core unification) — retroactive documentation (drift recovery 2026-05-25)
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: XL (на бумаге; фактически доставлено)
- analysis_required: true | analysis_done: true (см. `docs/internal/NEEDS-ANALYSIS/022-UnifiedFormulaConstructor.md`)
- Depends on: #002 Phase 2 (✅)
- Follow-ups: #022.2 (archive dead code), #022.3 (Ctrl+Space), #022.4 (FloatingPopup portal), #022.5 (JSDOM tests), #022.6 (migrate AdvancedFilterEditor)

Доставлено: `FormulaVisualEditor.svelte` удалён, `FormulaConstructor.svelte` (368 LOC) создан как unified surface, потребляется и `FormulaBar`, и `FormulaEditor` (через slot-wrapper). Code/visual mode toggle удалён.

Остаток (см. NEEDS-ANALYSIS doc):
- 208 LOC dead code (`FormulaNode.svelte` + `formulaSerializer.ts`) → archive в `.ai_internal/Archive/` (#022.2)
- Опциональные UX-улучшения: Ctrl+Space force-open, FloatingPopup portal для suggestion dropdown, JSDOM unit tests, migration `AdvancedFilterEditor` → FormulaConstructor

### #011 — Move YAML Visualizer into Dashboard widget
- Status: ❌ SUPERSEDED (2026-06-11) — YamlVisualizerWidget заархивирован в #056 (V2 fate
  table); продуктовая цель («заметка как типизированная карточка», R5-012 в дизайн-стеке)
  переоформлена в **#082**. См. specs/UT2026-G §C.
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: S

### #012 — Replace Obsidian Properties pane with YAML Visualizer
- Status: ❌ SUPERSEDED (2026-06-11) — см. #011; цель переехала в **#082** (typed-карточка
  записи через RecordCardView/SlideInPanel, не через архивный виджет).
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: M

---

## Milestone M-DATAVIEW-BRIDGE — ✅ COMPLETE

Full Dataview adaptive bridge — begins after M-SUBBASES is complete.
Plan: `docs/internal/DATAVIEW_ABSORPTION_PLAN.md`

### #045 — Dataview Adaptive Bridge (parent ticket)
- Status: ✅ DONE (2026-05-27) — all sub-tickets (#045.1–#045.6) merged into main via `7756cd6`
- Milestone: M-DATAVIEW-BRIDGE | Priority: P1 | Complexity: XL
- **analysis_required: true**
- **analysis_done: true** ✔ (2026-05-21)
- Depends on: #009 (✅), #010 (✅) — M-SUBBASES cleared analytical baseline
- Blocks: #045.1, #045.2, #045.3, #045.4, #045.5

Scope: adaptive bridge bridges Notion patterns down to Dataview + native Obsidian layers.
Sub-tickets to derive from analysis: #045.1 (DataviewEnhancedSource + graceful degradation),
#045.2 (native-query lightweight layer), #045.3 (Gap 1 Relation UI), #045.4 (Gap 5 Rollup UI),
#045.5 (Unified Dataview filter semantics via filterEvaluator canonical kernel), #045.6 (Status/Board semantics).
See `DATAVIEW_ABSORPTION_PLAN.md` for gap matrix and V5.8 scope.

---

## Milestone M-POPUP-STANDARDISATION — ✅ COMPLETE

### #034 — Popup standardisation (FloatingPopup engine + migrations)
- Status: ✅ DONE (2026-05-19)
- Milestone: M-POPUP-STANDARDISATION | Priority: P2 | Complexity: L
- analysis_required: false
- Sub-PRs:
  - #034.1 — FloatingPopup engine + 3 migrations + WindowShell `badges` slot API (8f6b6f0)
  - #034.2a — 6 popoverDropdown consumers → FloatingPopup + PopoverList helper (c659b5e)
  - #034.2b — archive dead SwitchSelect; document non-migratable popups (8d92cbb)
  - #034.3 — inline header badges via `badges` slot for stats/chart/data-table (this branch)

### #040 — Inline header badges in widgets
- Status: ✅ DONE (2026-05-19)
- Milestone: M-POPUP-STANDARDISATION | Priority: P3 | Complexity: S
- analysis_required: false
- Sub-PRs:
  - #040.1 — WindowShell `<slot name="badges" />` API + wrapper CSS (in #034.1)
  - #040.2 — WidgetInlineBadges.svelte consumer wiring + DashboardCanvas hookup (this branch)

---

## Milestone M-FREE-CANVAS — ✅ COMPLETE (Phase 3, Dashboard V3 surface)

Goal: turn the existing `layoutMode === "free"` skeleton into the full Dashboard V3 surface
specified by `.ai_internal/New-specification/`. Covers canvas shell, window primitives,
popup-first UX, and DataProvider Registry foundation.

### #030 — Spec doc fix-up (pre-implementation)
- Status: ✅ DONE (2026-05-19) — 7 corrections applied to spec docs prior to #031..#036
- Milestone: M-FREE-CANVAS | Priority: P0 | Complexity: S
- analysis_required: false

### #032 — FreeCanvas shell components
- Status: ✅ DONE (2026-05-19) — 4 sub-PRs merged: 032.1 (collision resolver), 032.2 (skeleton + migration), 032.3 (WindowShell drag/resize), 032.4 (integration + DEMOLISH legacy WidgetGrid free-mode)
- Milestone: M-FREE-CANVAS | Priority: P1 | Complexity: L
- analysis_required: false (spec detailed in FREE_CANVAS_SPEC §4-7)
- Merge commits: `bcd7dfb`, `90a42b2`, `0fa2897`, `dedf5d5`

New components under `src/ui/views/Dashboard/FreeCanvas/`:
`FreeCanvas.svelte`, `CanvasViewport.svelte`, `WindowHost.svelte`, `WindowShell.svelte`,
`CanvasControls.svelte`, `DragHandle.svelte`, `WindowTitleBar.svelte`, `ToolbarGhost.svelte`,
`ResizeHandle.svelte`, plus `collisionResolver.ts` (AABB push semantics per #037 decision).

### #033 — `WidgetLayout` units migration (grid → rem)
- Status: ✅ DONE (2026-05-21)
- Milestone: M-FREE-CANVAS | Priority: P1 | Complexity: M
- analysis_required: true | analysis_done: true
- Depends on: #032 (✅)

**Outcome**: `src/ui/views/Dashboard/FreeCanvas/layoutMigration.ts` implements `migrateLayoutV1ToV2(canvasLayout): CanvasLayoutV2` per spec §3.5. Conversion factor `GRID_UNIT_TO_REM = 4` (1 grid unit = 4rem). Function is pure, idempotent (V2 input returned as-is), and does not mutate input. Test suite `layoutMigration.test.ts` (11 tests) covers empty canvas, single/multiple widgets, zero coordinates, fractional input, idempotency, and mutation safety.

### #036 — Mobile interaction spec + implementation
- Status: 📋 BACKLOG | Milestone: M-FREE-CANVAS | Priority: P2 | Complexity: M
- **analysis_required: true** | **analysis_done: true**
- Depends on: #032 (✅)

**Analysis Summary (2026-05-21)**:

#### Current Touch Implementation State
- `WindowShell.svelte` uses Pointer Events API (`on:pointerdown`, `on:pointermove`, `on:pointerup`, `on:pointercancel`)
- `gestureHandler.ts` exists as REFERENCE-ONLY (marked 🚨 NOT CURRENTLY USED)
- `lib/stores/ui.ts` provides `$isCoarsePointer` store for device detection via `matchMedia('(pointer: coarse)')`
- `touch-action: none` already set on `.ppp-drag-handle` and `.ppp-resize-handle` (WindowShell.svelte:266, 299)
- Design tokens in `designTokens.ts` define `TOUCH.coarse: "2.75rem"` (44px minimum hit area)

#### Gaps Identified
1. **No long-press activation**: Drag starts immediately on `pointerdown`, conflicts with scroll inside windows on mobile
2. **ToolbarGhost visibility**: Relies on `:hover` CSS (spec §6 lines 486-496), which doesn't trigger on touch devices
3. **Resize handles**: Current visual size 0.5rem-0.75rem far below 44px minimum; no fallback sizing for touch
4. **Pinch-to-zoom**: No gesture handling in `FreeCanvas.svelte`; wheel zoom exists for desktop only
5. **Viewport pan**: No touch-pan implementation for mobile canvas navigation

#### Technical Decisions
| Issue | Decision | Rationale |
|-------|----------|-----------|
| ToolbarGhost on touch | Always visible on mobile (`.ppp-window--mobile` modifier) | `:hover` unavailable; spec §6 lines 492-496 already define `.ppp-window--mobile .ppp-toolbar-ghost { opacity: 1 }` |
| Long-press drag activation | 300ms delay before initiating drag | Per FREE_CANVAS_SPEC §6 lines 597-598: "На mobile drag активируется по long-press (300ms) во избежание конфликта со scroll'ем списка внутри окна" |
| Drag handle hit area | Use `--ppp-window-title-hit-area: 2.75rem` (44px) with internal padding compensation | Per CSS token in `designTokens.ts:32`; spec §2 line 77 |
| Resize handles on mobile | DISABLED per rev 1.3 spec | FREE_CANVAS_SPEC §6 lines 597-599: "Resize на mobile отключён в rev 1.3" |
| Minimum window sizes | Desktop tokens apply; no mobile-specific override needed | Spec §2 lines 79-87 define `--ppp-window-min-w-database: 20rem` etc. |
| Pinch-to-zoom | Two-finger pinch gesture on viewport with `gesturestart`/`gesturechange` legacy support | Standard mobile interaction; implement in `CanvasViewport.svelte` |
| Pan gesture | Single-finger drag on empty canvas (not on windows) | Avoid conflict with window drag; use `pointer-events: none` on windows during pan mode |

#### Implementation Plan
1. **`WindowShell.svelte` modifications**:
   - Add `isMobile: boolean = false` prop (derived from `$isCoarsePointer` store)
   - Apply `.ppp-window--mobile` class when `isMobile`
   - Implement long-press timer (300ms) before setting `isDragging`
   - Increase drag handle hit area via CSS variable (already defined in tokens)

2. **`gestureHandler.ts` integration**:
   - Convert from reference to production-ready module
   - Add `createTouchDragHandler` for WindowShell's long-press activation
   - Export `isCoarsePointer` Svelte store for component consumption

3. **`CanvasViewport.svelte`** (new, per spec §7):
   - Add touch event listeners for two-finger pinch (scale)
   - Add single-finger pan with `touch-action: none` and `pointer-events: none` on child elements during pan

4. **`FreeCanvas.svelte`**:
   - Wire `onBackgroundClick` to trigger empty-canvas pan mode on long-press
   - Pass `isMobile` prop to WindowShell instances

---

## Milestone M-V35-HOTFIX-UX — 🔄 PARTIAL (user feedback 2026-05-19)

> Источник: пользователь не смог пройти Phase 1 #016 repro в OBStests демо-проекте
> из-за серии UX-блокеров. Эти тикеты ОТВЯЗАНЫ от Dashboard V3 — чинят
> существующий код, не предвосхищая V3-рефакторинг.

### #037 — DECISION: tile vs free-overlap policy
- Status: ✅ DECIDED (2026-05-19) — **Option 2: Collision-prevent free**
- Milestone: M-V35-HOTFIX-UX | Priority: P0 | Complexity: XS
- analysis_required: true | analysis_done: true
- Unblocked: FREE_CANVAS_SPEC, #032, #033

Решение: координаты окон сохраняются (свободное позиционирование), но при drag/resize
окна физически толкают друг друга — наложение запрещено. Реализовано в #032.1
через `collisionResolver.ts` (AABB push).

### #038 — Side-panel artefact on double-click of dashboard view
- Status: ✅ DONE (локально, не запушено) — merged via `be6f586` "Merge fix/038"
- Milestone: M-V35-HOTFIX-UX | Priority: P1 | Complexity: S

Фикс в `src/ui/components/SlideInPanel/`: `<svelte:fragment>` slot должен быть прямым
потомком `SlideInPanel` (commit `4934a80`).

### #039 — Window resize is jumpy/non-smooth in free-mode
- Status: ✅ DONE (2026-05-27) — merged via `b2fc77d` "Merge fix/039-window-resize-smoothness"
- Milestone: M-V35-HOTFIX-UX | Priority: P1 | Complexity: M
- analysis_required: false (analysis_done: 2026-05-26)
- Root cause: WindowShell вызывал store на каждое pointermove → flood;
  DashboardCanvas subscriber писал `saveConfig` на каждое изменение
  (disk thrash); N/W/NW/NE/SW делали 2 store-вызова на pointermove.
- Fix: RAF coalescing в WindowShell (1 mutation/frame); атомарный
  `moveResizeWindow` для top/left handles; `beginInteraction`/
  `endInteraction` + `interactingId` flag в store; saveConfig gating
  в DashboardCanvas (flush один раз на gesture-end).
- Tests: +12 (rAF coalesce, gesture lifecycle, atomic moveResize,
  pointercancel). Existing drag/resize tests updated to drive rAF.
- Gates: 137 / 2048 / 0 tsc / build OK / PX ≤186.

### #040 — Widget settings popup hides data access / aggregation info
- Status: ✅ DONE — #040.1 slot API в #034.1 (`8f6b6f0`); #040.2 consumer wiring в #034.3 (`0ed8367` "Merge feat/034.3: WidgetInlineBadges + #040 close")
- Milestone: M-V35-HOTFIX-UX (Strategy: DEMOLISH — поглощён #034) | Priority: P1 | Complexity: M

### #041 — Widget toolbar overflow / clipping
- Status: ✅ DONE (локально, не запушено) — merged via `92554f5` "Merge fix/041"
- Milestone: M-V35-HOTFIX-UX | Priority: P2 | Complexity: S

Фикс в `src/ui/components/Navigation/ViewSwitcher.svelte`: `flex: 1 1 auto` активирует
overflow handling tab strip (commit `8e22ec1`).

### #042 — Project title row clipped at top
- Status: ✅ DONE (2026-05-27) — merged via `6ea3f39` "Merge fix/042-project-title-clip" (commit `a71bf27`)

### #043 — Demo project uses outdated/irrelevant configs
- Status: ✅ DONE (2026-05-21) — initial demo regen shipped as `feat/043-*` (см. Завершённые milestones, CONTEXT.md)
- Milestone: M-V35-HOTFIX-UX | Priority: P1 | Complexity: M

---

## Milestone M-UX — 🔄 ACTIVE

### #046 — Demo project full refactor (single coherent domain, 5 views, <700 LOC)
- Status: ✅ DONE (2026-06-05) — commit `6336165` on branch `feat/046-demo-project-refactor`, **awaiting user merge into main**
- Milestone: M-UX | Priority: P2 | Complexity: M
- analysis_required: false
- Depends on: #043 (✅) — supersedes initial demo content/structure
- Blocks: none

Goal: collapse current 67-file / 12-view mishmash demo (fitness + finance + CRM + RU tasks) into a single coherent **B2B agency / studio** domain with ~28-30 files and exactly **5 views** (Обзор / Pipeline / График / Клиенты / Портфолио). `demoProject.ts` must drop from 1937 LOC → <700 LOC; `demoVerticals.ts` removed or compressed to <100 LOC.

Entities (canonical schema):
- **Client** (~6 files): name, industry, stage, mrr, signupDate
- **Project** (~8 files): name, client (→Client), value, startDate, deadline, status, progress
- **Task** (~10 files): title, project (→Project), assignee, dueDate, priority, status, estimate
- **Meeting** (~4-6 files): title, client (→Client), startDate, startTime, endTime, participants

Views:
1. Обзор — Stats + Chart + DataTable + SummaryRow (dashboard)
2. Pipeline — board grouped by Project.status
3. График — calendar (meetings + task deadlines)
4. Клиенты — dashboard with DataTable, rollup MRR sum
5. Портфолио — gallery (projects with covers)

Acceptance:
- `demoProject.ts` <700 LOC; total demo files 25-32; views exactly 5; every project file has valid relation to a client; tests updated; baseline +delta; tsc 0; build OK; PX ≤186.

### #047 — UX audit: emoji→Lucide icon sweep + i18n gaps + P0/P1 bug fixes
- Status: ✅ DONE (2026-06-05) — branch `fix/audit-ux-critical-bugs` (commits `008ba39`, `555e8f4`), **awaiting user merge into main**
- Milestone: M-UX | Priority: P0 (contains P0 fix) | Complexity: M
- analysis_required: false
- Depends on: none
- Blocks: none

**P0 fix — Duplicate "Dashboard" in AddView dialog:**
- `src/ui/modals/components/AddView.svelte`: deduplicate `Object.values($customViews)` by viewType; normalize "database"→"dashboard"; default type changed to "dashboard".
- Root cause: `view.ts` registers both "dashboard" and "database" keys → same DashboardView instance → `Object.values()` returns it twice.

**P1 fix — `new Menu()` invariant violation in DataTableWidget:**
- `src/ui/views/Dashboard/widgets/DataTable/DataTableWidget.svelte`: replaced `new Menu()` with `openContextMenu()` from `src/lib/contextMenu.ts`.

**P2 — emoji→Lucide `<Icon>` sweep (7 files):**
- `WidgetHost.svelte`: ⚙🔒🔓✕⚠📊📈 → settings-2/lock/unlock/x/alert-triangle/bar-chart-2/trending-up
- `DashboardToolbar.svelte`: −/+/⊞/≡/⚙ → minus/plus/layout-grid/layout-list/settings-2
- `FilterBridge.svelte`: 🌐/⎘ → globe/filter
- `ViewTabBar.svelte`: emoji string map → lucide icon names + `<Icon>`
- `VisualizerPane.svelte`: 📌/👁/⊘ → pin/eye/eye-off
- `ErrorBoundary.svelte`: ⚠️ → alert-triangle
- `Schema.svelte`: 📅 → `"D"` text badge

**i18n fixes:**
- `en.json`/`ru.json`: views.dashboard.name "Database"→"Dashboard"; +8 missing widget type keys (data-list, sub-base-canvas, yaml-visualizer, database-call, timeline, cover-banner, text, divider).

**Test mock fix:**
- `src/__mocks__/obsidian-svelte.js`: noopComponent → proper Svelte-compatible constructor with `this.$$` (required by `new Icon(...)`).

**Deep audit findings (open, not yet ticketed):**
- F-02 (P1): `native-query` datasource has no UI entry point in `CreateProject.svelte`
- F-08 (P2): filter operator labels hardcoded in Russian in `filterHelpers.ts`
- F-13 (P3): `FieldSettingsPanel.svelte` is dead code (not imported anywhere)

Gates: tsc 0 errors ✅ / 139 suites / 2099 tests PASS ✅ / build 0 errors (4 pre-existing warnings) ✅

### #048 — Add native-query datasource UI entry point in CreateProject
- Status: ✅ DONE (2026-06-11) — on `feat/dashboard-v2`
- Milestone: M-UX | Priority: P1 | Complexity: S→M (persisted kind required)
- analysis_required: false
- Depends on: #045.2 (✅ engine implemented)
- Blocks: none

**Context**: `src/lib/datasources/native-query/nativeQuery.ts` is fully implemented (#045.2), but
`CreateProject.svelte` only offers `folder`, `tag`, and `dataview` as datasource types.
Users have no way to create filter-based ("virtual") databases from the UI.

**Delivered** (scope grew: #045.2 deliberately did not register a persisted kind, so the UI
entry point required one):
- Settings: `NativeQueryDataSource` type added to v3 `DataSource` union (`from: folder|tag`,
  `where?: FilterDefinition`, `limit?: number`), re-exported in v4. Optional/additive — no migration.
- `src/lib/datasources/native-query/datasource.ts` — thin adapter over `executeNativeQuery`:
  `queryAll` = FROM→WHERE→LIMIT via canonical filterEvaluator; `includes` delegates to inner
  folder/tag source; `queryOne` re-runs full query (mirrors DataviewDataSource — single-record
  merge can't express records entering/leaving the WHERE set).
- Factory case in `createDataSource` (works without Dataview).
- `dataApi.createDataRecord` + `createNoteModal`/`CreateNote` honour native-query `from`
  (default folder / tag stamping).
- `CreateProject.svelte`: 4th option + from-kind sub-select + inline WHERE builder
  (field/operator/value rows, unary ops hide value, AND) + limit input. No `as`-casts in markup.
- `Archives.svelte` label; i18n keys en+ru (`modals.project.native-query.*`, `datasources.native-query`).
- Tests: `datasource.test.ts` (8 tests — WHERE/LIMIT/tag/excludedNotes/includes/queryOne/factory).
- Gates: build ✅ | 135/2028 ✅ | lint 0 errors ✅ | svelte-check 0 ✅

### #049 — Restore green CI baseline: fix ESLint + svelte-check errors
- Status: ✅ DONE (2026-06-10) — all 4 CI gates green at baseline 134/2020
- Milestone: M-UX | Priority: P0 | Complexity: M
- analysis_required: true
- analysis_done: true
- Depends on: none
- Blocks: clean PRs for all subsequent tickets

**Context**: Discovered during agent-system semantic audit (2026-06-07). CI (`.github/workflows/ci.yml`) gates merge on FOUR checks — `build`, `test`, `lint`, `svelte-check` — but two were red while `tsc`+`jest` were green:
- `npm run lint` → **55 errors, 130 warnings** (e.g. `obsidianmd/no-tfile-tfolder-cast`, tsdoc tags)
- `npm run svelte-check` → **72 errors, 4 warnings in 26 files** (e.g. `Unexpected token (ts)` in `FieldSettingsPanel.svelte:174`, inline `as`-casts in markup)

This is the root cause of prior "build looked green but runtime broke" hallucinations: agents only gated on `tsc`+`jest`. Agent configs are now fixed to run all 4 gates; this ticket fixes the actual code so the baseline is green.

**Scope**:
- Triage: categorize the 55 ESLint + 72 svelte-check errors by rule/file (analysis phase).
- Fix `as`-cast-in-template errors (move casts into `<script>` or use type guards).
- Apply `instanceof TFile`/`TFolder` narrowing instead of casts (lint rule `obsidianmd/no-tfile-tfolder-cast`).
- Resolve or correctly suppress tsdoc warnings (`@since` tag config).
- Do NOT introduce `@ts-ignore`. Fix types properly.

**Acceptance**:
- `npm run lint` → 0 errors (warnings ideally 0, document any deferred).
- `npm run svelte-check` → 0 errors.
- `npm test` → baseline holds (139/2099).
- `npm run build` → 0 errors.
- No new `@ts-ignore`; PX-budget ≤ 186.

---

## Milestone M-INTERACTIVE-DASHBOARD — ✅ COMPLETE (Phase 5, 2026-05-27)

> Goal: turn static-render canvas into interactive. Clicks on data-bearing widgets
> (Chart segments, DataTable rows) become *selections* that narrow visible data in
> sibling widgets on the same canvas. Selection lives in a per-canvas Svelte context
> store; no global state.

### #044 — Cross-widget interactive filtering
- Status: ✅ DONE (2026-05-27) — all sub-PRs (#044.1–#044.5 + #044.3b) merged into main
- Milestone: M-INTERACTIVE-DASHBOARD | Priority: P2 | Complexity: L (~1120 LOC across 5 sub-PRs)
- Strategy: BUILD (new feature)
- analysis_required: true | **analysis_done: true** (spec `.ai_internal/New-specification/CROSS_WIDGET_SPEC.md` v1.0)
- Depends on: #032 (✅), #034.1 (✅), #040.1 (✅)
- Spec: `.ai_internal/New-specification/CROSS_WIDGET_SPEC.md`

#### Sub-PR status
- **#044.1** ✅ DONE — `selectionStore.ts` + `composeEffectiveFilter()` + DashboardCanvas `setContext` wiring + unit tests. Merge `d9323ec`.
- **#044.2** ✅ DONE — ChartWidget driver, 7 chart types, bar/pie click → `setSelection`, active/dimmed segment styling. Merge `15910cb`.
- **#044.3** — split into 3a (receiver) + 3b (driver).
  - **#044.3a** ✅ DONE — merged `cf816c0`. Receiver only: `dataTableSelectionReceiver.ts` (101 LOC pure helper) + DataTableWidget receiver wiring + per-row `highlighted`/`dimmed` flags propagated through `DataGrid` → `GridRow` → `GridCellGroup`. Self-skip rule via `dataTableSourceId(myWidgetId)`. Hidden rows preserved (geometry intact, per spec §5.2).
  - **#044.3b** ✅ DONE — merged `21fc4fb`. Driver via **context-menu entry "Filter canvas by this row" / "Clear canvas filter"**. Files: `dataTableSelectionDriver.ts` + `DataGrid.svelte` + `DataTableWidget.svelte`. Gates: tsc 0, Jest 133/1979 PASS (+1 suite, +11 tests), build OK.
- **#044.4** ✅ DONE — merged `99035e6`. StatsWidget receiver: recompute aggregates over `effectiveFilter`-narrowed records; subtle "filtered" dot next to each card's value. Gates: tsc 0, Jest 131/1955 PASS, build OK, PX-budget 191/191.
- **#044.5** ✅ DONE — merged `4993681`. `SelectionBadge.svelte` + `shouldShowSelectionBadge` + DashboardCanvas integration (Escape handler, click-outside). Gates: tsc 0, Jest 132/1968 PASS, build OK.

#### Invariants (from #016 lesson)
- Selection writes carry a `source` discriminator; driver/receiver hybrids self-skip via `composeEffectiveFilter({myWidgetId})`.
- `setSelection()` is no-op on shallow-equal payload (idempotence).
- `composeEffectiveFilter()` is pure; receivers never write to the store from a reactive block.
- No new code path inside `filterEvaluator.ts` — selection is an extra layer that appends a `FilterCondition` through the canonical engine. **Exception**: DataTable receiver (#044.3a) intentionally bypasses filterEvaluator and uses `computeMatchingRowIds` to decorate rows (geometry preservation per spec §5.2).

#### Out of scope (v1 — see spec §9); delivered in Phase 4.5 (#044.6)
- Multi-select (Cmd-click, range select) → **delivered** via `is-any-of` + `values[]` (#044.6 / Phase 4.5)
- Cross-provider selection broadcast, StatsCard as driver, persistence across tab switches

### #044.6 — Phase 4.5: Multi-select Selection Bus (is-any-of + values[])
- Status: ✅ DONE (2026-06-10) — commit `92f5073` on `feat/dashboard-v2`
- Milestone: M-INTERACTIVE-DASHBOARD | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #044.5 (✅)

`SelectionState.value: string|null` → `SelectionState.values: ReadonlyArray<string>`.
`SelectionOp` adds `"is-any-of"`. `SetSelectionInput.values[]` for multi-write.
All receivers migrated: `dataTableSelectionReceiver.ts`, `statsSelectionReceiver.ts`, `SelectionBadge.svelte`, `ChartWidget.svelte`.
Driver function args still take `{ value: string }` (single click = single value input).
FilterCondition type unchanged (`value?: string` singular).
Gates: 134 suites / 2020 tests PASS, tsc 0, build 0, lint 0, svelte-check 0.

---

## Milestone M-DATA-PROVIDER (parked) — see #031

### #035 — ProviderPicker / multi-source widgets (parked)
- Status: ⏸ DEFERRED — was Option B alternative; reopens once #031 lands on `origin/main` (currently local-only)
- Milestone: M-FREE-CANVAS | Priority: P2 | Complexity: M
- analysis_required: false
- Depends on: #031 (✅ locally, awaiting push)

Adds `ProviderPicker.svelte`, `ChartSeriesConfig[]` / `MultiSourceChartConfig` support to
ChartWidget and StatsWidget. Stack mode untouched.

---

---

## Milestone M-UI-MODERNIZATION — ПОЛНЫЙ РЕФАКТОРИНГ DASHBOARD UI

> Triggered: 2026-06-10 — real Obsidian API testing revealed legacy UI patterns across all 18 widget types.
> Spec: `docs/internal/UI_MODERNIZATION_PLAN.md`

### #050 — Design System Foundation: Dashboard Token Layer
- Status: ✅ DONE (2026-06-10) — коммит d82315f
- Milestone: M-UI-MODERNIZATION | Priority: P0 | Complexity: L
- analysis_required: false
- Blocks: #051, #052, #053, #054, #055, #056

Create `src/ui/views/Dashboard/tokens/dashboardTokens.css` with full `--ppp-db-*` semantic token set.
Remove all 40+ hardcoded px/hex/hsl values from widget files.
Unify z-index under `--ppp-z-*` scale (kill z-index:100, z-index:200 magic numbers).
Add `--ppp-border-thin`, `--ppp-shadow-sm/md/lg`, `--ppp-db-row-compact/default/expanded` tokens.

### #051 — DatabaseCall Table View Mode (DataTable absorbed)
- Status: ✅ DONE (2026-06-10) — коммит 76fd1b2
- Milestone: M-UI-MODERNIZATION | Priority: P0 | Complexity: XL
- analysis_required: true | analysis_done: true
- Depends on: #050
- Blocks: #056 (archive standalone DataTableWidget only after this done)

**SCOPE (V2-aligned)**: NOT standalone DataTable rebuild. Data-table functionality is absorbed into `DatabaseCallBlock.svelte` as its Table view tab per DASHBOARD_V2_SPEC.md §4.

Implement Table view inside `database-call`:
- CSS Grid via `--ppp-dt-columns` custom property (single context for header + rows = fixes column alignment)
- Sticky header + aggregation row without z-index conflicts
- Virtual scroll without global overflow
- Decompose: DataTableContent component inside database-call ≤ 400 LOC
- Standalone `DataTableWidget.svelte` → prepare for archive in #056 (add alias for compatibility)

### #052 — WidgetShell: Replace WidgetHost (947 LOC)
- Status: ✅ CLOSED (2026-06-11, `d4b7f4a`) — dead code (WidgetShell 161 LOC + WidgetHeaderActions 80 LOC) удалён; декомпозиция WidgetHost (947 LOC) вынесена в #067 как clean re-implementation
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: L
- analysis_required: false
- Depends on: #050

New `WidgetShell.svelte` ≤ 350 LOC. CSS Grid: `grid-template-areas: "header" "content"`.
Dedicated `WidgetToolbar.svelte`. Resize via ResizeObserver + CSS variables.
SelectionBadge in header slot. DnD handles via `.ppp-widget-drag-handle`.

### #053 — Chart Widget Modernization
- Status: ✅ DONE (2026-06-10) — коммит 76fd1b2
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #050

Container: `aspect-ratio: var(--ppp-chart-aspect, 16/9)` instead of hardcoded heights.
Legend: token-based design. Empty state: shared `EmptyState.svelte` component.
Scatter: CSS Grid for axis labels.

### #054 — Stats Widget Modernization
- Status: ✅ DONE (2026-06-10) — коммит 76fd1b2
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: S
- analysis_required: false
- Depends on: #050

**SCOPE (V2-aligned)**: Stats widget only. Comparison + SummaryRow → archive (#056) per DASHBOARD_V2_SPEC.md §4.

Stats: CSS Grid `repeat(auto-fill, minmax(10rem, 1fr))`.
Typography: value = `--ppp-font-size-2xl bold`, label = `--ppp-font-size-xs muted`.
"Filtered" dot via CSS `::before` with `var(--ppp-color-accent)`.
Remove `color ?? "#6a6a8f"` hardcoded fallback → `var(--ppp-db-text-secondary)`.

### #055 — FilterTabs, Checklist, DatabaseCallBlock Modernization
- Status: ✅ DONE (2026-06-10) — коммит 76fd1b2
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #050

FilterTabs: `overflow-x: auto; scroll-snap-type: x`. Overflow → "..." dropdown.
Checklist: CSS `appearance:none` checkbox + `:checked` + `var(--ppp-color-success)`.
DatabaseCallBlock: status dot via `var(--ppp-color-success/warning/error)`. Query font: `var(--font-monospace)`.

### #056 — V2 Widget Archive: Delete V1-only widgets from active code
- Status: ✅ DONE (2026-06-10) — коммит 4ac7cac (git mv; V1 виджеты перемещены в src/archive/dashboard-v1/)
- Milestone: M-UI-MODERNIZATION | Priority: P2 | Complexity: L
- analysis_required: false
- Depends on: #051 (DatabaseCall Table View must cover data-table functionality first)

**SCOPE (V2-aligned)**: NOT modernization — ARCHIVATION. Per DASHBOARD_V2_SPEC.md §4, these widget types are deleted from Dashboard V2. Move to `archive/dashboard-v1/` (do NOT delete from git).

**Move to `archive/dashboard-v1/`:**
- `TimelineWidget.svelte` + `TimelineWidgetConfig.svelte`
- `ComparisonWidget.svelte` + config
- `SummaryRowWidget.svelte` + config
- `YamlVisualizerWidget.svelte` + config (→ будет отдельным View в будущем)
- `ViewPortWidget.svelte` + config (функционал покрыт database-call general wrapper)
- `DataListWidget.svelte` + config (функционал покрыт database-call List tab)
- `SubBaseCanvasWidget.svelte` (функционал → SubBasePanel внутри database-call)
- Standalone `DataTableWidget.svelte` (функционал переехал в database-call Table tab via #051)

**Prerequisite**: database-call covers Table/List/SubBase functionality (verified via #051 completion).
**WidgetType union** post-archive: `database-call | chart | stats | checklist | filter-tabs | text | divider | cover-banner` (8 types).

### #057 — Legacy Type Cleanup: Remove Orphan Types
- Status: ✅ DONE (2026-06-10) — коммит d82315f (legacy aliases removed)
- Milestone: M-UI-MODERNIZATION | Priority: P0 | Complexity: L
- analysis_required: true | analysis_done: true
- Depends on: (none — can run parallel with #050)

Audit and remove: WidgetConfigV1/V2, FreeCanvasLayout orphans (post Phase-3), old GridColumnDef format,
duplicated union types in types.ts/settings.ts, FilterConditionV1/SortConditionV1.
Goal: 0 `@deprecated` in src/, 0 unused exports from widget type files.

### #058 — UI Modernization Integration & Full Test
- Status: ✅ DONE (2026-06-10) — коммиты 66386bc, 53ed8a8 (a11y fixes, z-index scale)
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #051, #052, #053, #054, #055, #056, #057

PX-budget ratchet recount (target ≤ 60 from current 186).
Full Obsidian API test: all 5 demo-project views, all 18 widget types.
svelte-check 0 warnings (currently 4). Visual audit in OBStests vault.

---

### #067 — WidgetHost Decomposition: Replace 947 LOC Monolith
- Status: ✅ DONE (2026-06-11, `931d42a`) — F1 исполнена: WidgetHost 947 → **208 LOC**
  (роутер + реактивный WidgetRenderContext), WidgetShell 263, WidgetHeaderActions 168,
  WidgetSetupWizard 58, widgetComponentRegistry (34 ветки → таблица). Поведение 1:1,
  DatabaseCallSettings — явная ветка (особый event-контракт). R0_6_locBudget.test.ts
  делает потолки §7 исполняемыми. 144 suites / 2090 tests. Визуальный чек
  (DnD/resize/collapse) — в чек-листе pipeline §5.
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: XL
- analysis_required: true | analysis_done: true (UT2026-F)
- Depends on: (none — new clean implementation, no dead code risk)

**Context**: #052 was PARTIAL — WidgetShell.svelte (161 LOC) and WidgetHeaderActions.svelte (80 LOC) were created but never integrated. Both deleted 2026-06-11 as dead code. WidgetHost.svelte remains at 947 LOC with 34 type-dispatch branches and 44 imports.
> Renumbered from #060 (commit `d4b7f4a` opened it as #060 — collision with M-VISION-PARITY #060 Field transparency).

**Goal**: Replace WidgetHost.svelte with a proper decomposition:
- New `WidgetShell.svelte` ≤ 350 LOC — CSS Grid frame, header/content/footer slots, ResizeObserver, drag handle
- New `WidgetHeaderActions.svelte` ≤ 150 LOC — collapse, config, pipeline, lock, remove buttons
- `WidgetHost.svelte` becomes thin router (type → component) ≤ 200 LOC
- SelectionBadge wired into WidgetShell header slot
- All 16 active widget types route through new shell

**Approach**: Architect plan required before any code. Read DASHBOARD_V2_SPEC.md §6 (widget contract) first.

---

## Milestone M-VISION-PARITY — Продуктовый слой (Vision Scenes 2, 5, 6, 7, 8)

> Triggered: 2026-06-10 — Vision alignment audit обнаружил 5 сцен Vision без технических тикетов.
> Source: `docs/internal/AUDIT_VISION_ALIGNMENT.md`
> Spec: `docs/internal/DASHBOARD_V2_VISION.md`

### #059 — SmartSuggest: проактивные подсказки по типам данных
- Status: ✅ DONE (2026-06-11) — on `feat/dashboard-v2`
- Milestone: M-VISION-PARITY | Priority: P1 | Complexity: L
- analysis_required: true | analysis_done: true (inline, 2026-06-11)
- Depends on: #051 (Table View ready — подсказки показываются в контексте блока данных)

**Vision §6 — «центральная инновация»**: "Видишь числовое поле? Покажу сумму. Видишь связи? Покажу частоту визитов."

**Delivered (MVP)**:
- `smartSuggest.ts` — чистый rule engine: `computeSuggestions(fields, widgets, dismissed)`;
  правила `numeric-stats` (Number-поле + нет stats-виджета → добавить `stats`; StatsWidget сам
  строит sum/avg карточки по первому числовому полю) и `relation-block` (Relation-поле + нет
  database-call с `linkedSelection` → добавить `database-call`)
- `SmartSuggestionBus.svelte` — singleton-строка на канвасе (между FilterBridge и WidgetGrid),
  одна подсказка за раз; × = session dismiss, «Не предлагать снова» = persisted
- `DatabaseViewConfig.dismissedSuggestions?: string[]` — аддитивно, без миграции;
  accept тоже персистит dismissal (гейт relation-правила не закрывается простым добавлением блока)
- Не рендерится на пустом канвасе (zero-state #065 владеет этим моментом) и в readonly
- i18n: `views.dashboard.smart-suggest.*` в en/ru (uk/zh — defaultValue fallback, как в #065)
- Тесты: `smartSuggest.test.ts` (11) + `SmartSuggestionBus.test.ts` (7)

**Отклонение от тикета**: CTA Relation-подсказки добавляет `database-call`, а НЕ legacy
`sub-base-canvas` — по DASHBOARD_V2_SPEC §4 sub-base-canvas подлежит удалению (sub-base
живёт внутри database-call). Метрики «частота визитов / прогноз» — вне MVP, V3.

### #060 — Field transparency: column header → frontmatter key tooltip
- Status: 📋 BACKLOG
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: S
- analysis_required: false
- Depends on: #051

**Vision §3**: "Курсор по колонке — подсветка frontmatter ключа. Двойной клик по ячейке — открытие файла на нужной строке."

Scope:
- Column header hover tooltip: показывает frontmatter key name (напр. `client:`, `pain_level:`)
- Double-click on row expander icon → `app.workspace.openLinkText(file.path, '', false)` + scroll to frontmatter field via Obsidian API
- Визуальная «подсветка» в split-view (если открыт) — scope отдельного subticket

### #061 — Template Library: канвас-пресеты + onboarding-профили
- Status: 📋 BACKLOG — **рескоуп 2026-06-11 (UT2026-G §B3)**: два слоя вместо одного.
  (1) **4 канвас-пресета** из visual stack как WIDGET_TEMPLATES: Project Tracker
  (kanban+timeline+sub-base tasks), Finance KPI (stats×3+revenue chart+comparison→stats+journal),
  Analytics Lab (pipeline compute/filter/group/aggregate + scatter + donut), Content Library
  (filter-tabs+gallery+tag-consistency table). Составы повиджетно — в схемах «Пресет *.png».
  (2) **3 onboarding-профиля** Vision §7 (clients/fitness/journal) — генерируют папки+данные
  и ссылаются на пресеты. Первый экран CreateProject = три primary actions (из #065).
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: L
- analysis_required: true | analysis_done: partial (состав пресетов задан дизайном)
- Depends on: #046 (demo project pattern established)

**Vision §7**: "'Я веду клиентов' — готовый набор баз, представлений и связей. Начать за 5 минут."

Scope:
- `CreateProject.svelte`: добавить step "Choose profile" перед folder selection
- Profile 1: **Clients** (Clients + Sessions + Tasks + Calendar view)
- Profile 2: **Fitness** (Workouts + Exercises + Nutrition cross-stats)
- Profile 3: **Project journal** (Projects + Tasks + Meetings timeline)
- Каждый профиль генерирует папки + demo records + pre-configured Dashboard
- (из #065, re-scoped 2026-06-11) Первый экран модалки = три primary actions
  ("Создать базу" / "Открыть пример" / "Импортировать папку"), не длинный список настроек

### #062 — Drag-to-link: drag card to express relation between blocks (V3)
- Status: ⏸ DEFERRED — V3 roadmap item
- Milestone: M-VISION-PARITY | Priority: P3 | Complexity: XL
- analysis_required: true | analysis_done: false
- Depends on: complete V2 block system stable

**Vision §7**: "Тащу карточку на карточку — связь создаётся. Тащу поле из бокового списка в заголовок таблицы — колонка добавляется."

Deferred because: requires cross-block DnD with drop-zone detection between database-call instances. Technical complexity would block V2 milestone entirely. V2 uses "Link to..." context menu as stepping stone.

### #063 — Timeline View (V3 roadmap — deferred from V2)
- Status: ⏸ DEFERRED — V3 roadmap item
- Milestone: M-VISION-PARITY | Priority: P3 | Complexity: XL
- analysis_required: true | analysis_done: false
- Depends on: calendar engine maturity (TBD)

**Vision §1**: "Временная шкала" — описана как стандартная зона рабочей поверхности.

Deferred from V2: depends on calendar rendering engine. Code archived in `archive/dashboard-v1`.
V3 target: Timeline as a view tab inside `database-call` (alongside Table/Board/Calendar/Gallery).

### #064 — Graph View: relation graph between records (V3 roadmap)
- Status: ⏸ DEFERRED — V3 roadmap item
- Milestone: M-VISION-PARITY | Priority: P3 | Complexity: XL
- analysis_required: true | analysis_done: false
- Depends on: #010 (bidirectional relations — ✅ done)

**Vision §1**: "Граф связей" — описан наряду с Calendar/Board/Table как стандартное представление.

Деферировано: визуализация графа (force-directed layout, d3.js или vis.js) — отдельный большой milestone. Технический фундамент (#010) готов.

### #065 — Canvas zero-state + onboarding progressive disclosure
- Status: ✅ DONE (2026-06-11) — on `feat/dashboard-v2`
- Milestone: M-VISION-PARITY | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #050 (tokens — для стилизации empty state)

**Vision §7**: "Первый экран — три кнопки: 'Создать базу', 'Открыть пример', 'Импортировать папку'."

**Delivered**:
- Shared `src/ui/components/EmptyState/EmptyState.svelte` — icon/title/hint + `actions` slot
  with unified CTA button styling (`:global` within actions container). 5-test suite.
- Empty canvas (`WidgetGrid.svelte`): EmptyState + CTA "Добавить блок данных" (adds
  `database-call`) + per-template CTAs (`WIDGET_TEMPLATES`, new `applyTemplate` event wired
  через DashboardCanvas без роста LOC — остаётся 200). Killed "⊞" glyph.
- Empty table (`DatabaseCallBlock` table tab): "Нет записей" + "Добавить первую запись"
  (CreateNoteModal → api.addRecord). Hidden when readonly/no project.
- Empty filter result (`DatabaseCallBlock`): `effectiveFrame` пуст при непустом `frame`
  (selection-bus auto-filter) → "Нет совпадений" + "Очистить фильтр" (clearSelection).
- Zero-tabs state в DatabaseCallBlock переведён на EmptyState (killed 📊 emoji, survivor #047).
- Board column "+ Новая запись" — уже существовал (`BoardColumn.svelte:143`), без изменений.
- i18n: en+ru (`views.dashboard.canvas.empty-*`, `views.dashboard.database-call.*`).

**Re-scoped**: `CreateProject.svelte` "три primary actions" first screen → перенесён в #061
(Template Library): первый экран выбора профиля и есть это three-action surface; делать
редизайн модалки дважды (до и после профилей) — двойная работа.

### #066 — Dashboard config: YAML-readable format strategy (V3 decision required)
- Status: ✅ RESOLVED (2026-06-15, решение пользователя — Option B); decided-defer-to-V3
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: XL
- analysis_required: true | analysis_done: false (решение принято без analysis session)
- Depends on: none

**Vision §8**: "Сам дашборд — тоже markdown-файл. Не закрытая конфигурация в JSON, а читаемая, версионируемая, синхронизируемая через git заметка."

**Текущая реальность**: Dashboard конфигурация живёт в `data.json` (ProjectDefinition schema v4) — непрозрачный JSON, не открывается в Vim с понятной структурой.

Требует принятия решения:
- Option A: Миграция ProjectDefinition → YAML frontmatter в специальном `.md` файле проекта
- Option B: Zафиксировать осознанный компромисс: data.json остаётся до V3, с обоснованием (backward compat, performance, complexity)
- Option C: Human-readable JSON с комментариями + schema documentation

Это архитектурное решение, влияющее на всю систему. Требует dedicated analysis session.

**РЕШЕНИЕ (2026-06-15) — Option B (осознанный компромисс, defer-to-V3):**
`data.json` (ProjectDefinition schema v4) остаётся каноническим хранилищем конфигурации
вплоть до V3. Обоснование: Notion сам хранит конфиг непрозрачно — читаемый markdown-конфиг
не является Notion-parity-целью, это Obsidian-native цель, лежащая за пределами текущего
parity-скоупа и относящаяся к V3. Флаг «требует решения / requires decision» снят. Тикет
RESOLVED, помечен decided-defer-to-V3 (backward compat + performance + complexity сохранены).

---

## Milestone M-UT-FIXES — Дефекты пользовательского тестирования 2026-06-11

> Источник: пользовательское тестирование на OBStests (стек `2b9d1fd` + docs), скриншоты
> `C:\Users\Park\OBSv1.0\screanshots\` (9 PNG; точечный анализ выполнен 2026-06-11).
> Сквозная первопричина большинства дефектов: legacy V1-код (`src/archive/dashboard-v1/`)
> всё ещё маршрутизируется живым через WidgetHost и палитру виджетов.

### #068 — P0: fields/groups поповер в data-table рушит весь вью
- Status: ✅ DONE (2026-06-11, `e105aef`) — закрыт архитектурно фазой F3: архивный
  DataTableWidget больше нигде не исполняется (R0_4 archive-containment ratchet = 0 импортов
  из src/archive), data-table рендерится через DatabaseCallBlock/Table V2. Краш-поверхность
  недостижима.
- Milestone: M-UT-FIXES | Priority: P0 | Complexity: M
- Repro (исторический): дашборд «Клиенты» демо → таблица → Fields/Group

Скриншот `19-53-50.png`: открытие поповера разваливает layout вью; всплывает пустой
`RecordCardView` («No record selected», `RecordCardView.svelte:170`), контент дашборда исчезает.
Код: `src/archive/dashboard-v1/DataTable/DataTableWidget.svelte` — `openFieldVisibilityPop`
(:577) / `openGroupPop` (:622) → `FloatingPopup` (:1419). **Архивный V1-код живой в проде**:
`WidgetHost.svelte:14` импортирует `DataTableWidget` из `src/archive/dashboard-v1/`.
Вероятная причина — uncaught exception в reactive-обновлении рвёт DOM-дерево (нужна консоль).
Interim-фикс ИЛИ закрытие через #074 (deprecate data-table). Решить вместе с #074.

### #069 — P0: порча кодировки в исходниках — 25 битых литералов (`??`, `�`)
- Status: ✅ DONE (2026-06-11) — spec UT2026-B. PipelineEditor: Lucide-иконки через `<Icon>`,
  unset-фоллбеки, ключи `unnest`/`select-field` en+ru; em-dash восстановлены в CreateField,
  mocks, archive DataTable (+Σ, +русские строки коммента). Инвариант `R0_5_textIntegrity.test.ts`
  нашёл сверх анализа ещё 2 файла с invalid-UTF8 байтами (FormulaDebugPanel, GridSelectCell) —
  исправлены. Итог: 0 U+FFFD в src, ratchet включён.
- analysis_required: false

Скриншот `19-55-08.png`: конвейер трансформаций показывает «?? Фильтр», «? Агрегация»,
сырой ключ `views.dashboard.pipeline.unnest`. Грep `�` по src: **PipelineEditor.svelte (12)**,
archive/DataTable/DataTableWidget.svelte (7), modals/components/CreateField.svelte (4),
__mocks__/obsidian.ts (2). Это испорченные эмодзи из какого-то коммита с битой кодировкой.
Фикс: заменить на Lucide-иконки (инвариант #047 — эмодзи в UI запрещены; заодно 🔍 и ⬇
в DataTableWidget:1128,1135); добавить отсутствующие ключи `views.dashboard.pipeline.*`
в ru.json (минимум `unnest`). Добавить jest-инвариант: грep `�` по src = 0.

### #070 — P1: унификация системы цвета записей (3 параллельных механизма)
- Status: ✅ DONE (2026-06-11) — spec UT2026-C. Новый `src/lib/colors/recordColor.ts`:
  `resolveRecordColor` (explicit → rule → null), `normalizeHexColor` (#RGB/#RRGGBB/регистр/
  пробелы), case-tolerant lookup поля. **Root cause найден**: старый `extractEventColor`
  принимал ТОЛЬКО строгий `#RRGGBB` — ручной ввод из EditNote (`#0fb`, пробелы) молча
  отбрасывался, попап же всегда давал канонический hex. Процессор календаря переведён на
  контракт; дубль COLOR_FIELDS в EditNote/FieldControl устранён; FieldControl канонизирует
  ручной hex при сохранении. Инвалидация кэша проверена: dataVersion бампится на каждом
  внешнем обновлении (calendarView.ts:39). 19 тестов `recordColor.test.ts`.
  Визуальная верификация в OBStests — в чек-листе pipeline §5.
- analysis_required: true | analysis_done: true (2026-06-11)
- Repro: календарь → popup дня → «Цвет» работает; «Редактировать заметку» → Colors → не работает корректно

Сейчас три механизма цвета:
1. `getRecordColor` — цветовые правила проекта (color rules), приоритет в рендере;
2. `config.eventColorField` — hex в frontmatter, пишется popup'ом календаря
   (`CalendarView.svelte:1094` `handleDayPopupRecordColorChange` → `api.updateRecord`);
3. эвристика «поле цвета по имени» `COLOR_FIELDS = ['color','eventColor',...]` —
   **продублирована** в `EditNote.svelte:214` и `FieldControl.svelte:89`.
Календарь читает И правила, И eventColorField (`CalendarView.svelte:1166,1977,2058`) — порядок
приоритета нигде не зафиксирован. EditNote пишет то же поле через FieldControl (debounce 500ms,
:111), но результат в календаре некорректен (расхождение кэша `lastProcessedVersion`?).
Фикс: единый контракт resolve-цвета (документированный приоритет), одна точка детекции
color-поля, инвалидация календарного кэша после внешнего обновления записи.

### #071 — P1: CoverBanner config — выбор не применяется + хардкод-английский
- Status: ⚠️ PARTIAL (2026-06-11) — i18n-часть DONE: панель переведена
  (`views.dashboard.cover-banner-config.*`, en+ru). Дефект «select не применяется» ОТКРЫТ —
  ждёт репродукции пользователя с консолью (Ctrl+Shift+I), затем фикс по UT2026-D P2
  + компонент-тест на round-trip.
- analysis_required: false
- Repro: виджет «Обложка» → настройки → смена Width/Fit/Position не меняется

Проводка по коду корректна (`CoverBannerConfig.svelte` dispatch change →
`WidgetHost.svelte:463-467` → `handleWidgetConfigChange:132` → canvas saveConfig) —
нужна репродукция с консолью; подозрение на ре-биндинг `<select value=>` при
несинхронном обновлении `widget.config`. Отдельный подтверждённый дефект: все строки
панели хардкод-английские (Image source / Width / Fit / Position / Done) — нет i18n.

### #072 — P1: stats-карточки демо показывают «—» (aggregation: "count")
- Status: ✅ DONE (2026-06-11) — spec UT2026-D. demoProject: k1→industry/count_values (честный
  сегмент «только клиенты»), k2→status/count_values, c1→count_total, c2→«Первый клиент»
  earliest(signupDate) (для «Активных» нужен per-card фильтр, которого нет), chart yAxis→count_total.
  `configProvenance.test.ts`: migrate(generate()) — reference-equal no-op. Существующий демо в
  vault'ах чинит migrateAggregationCount при загрузке.
- analysis_required: false (root cause найден)

Скриншот `19-37-22.png`: «Клиентов» и «Проектов» = «—», при этом count_unchecked и sum работают.
Причина: `demoProject.ts:260-261` генерирует `aggregation: "count"` — литерал, который R5-004
переименовал в `"count_total"`. Миграция `migrateAggregationCount` чинит сохранённые конфиги,
но генератор демо порождает новые со старым значением. Фикс: `"count"` → `"count_total"`
в demoProject.ts (2 строки) + jest-тест на демо-конфиг; решить, поддерживает ли stats-ядро
kernel-`count` вообще (если нет — убрать из ColumnAggregation или замапить).

### #073 — P2: палитра виджетов показывает legacy/archived типы + переполнение
- Status: ✅ DONE (2026-06-11) — spec UT2026-A L2. `WidgetMeta.legacy` на 8 типах; палитра
  показывает legacy-тип только при существующем экземпляре на канвасе; список ограничен
  max-height 60vh + scroll.
- analysis_required: false

Скриншот `19-45-16.png`: «+ Добавить виджет» предлагает Таблицу данных, Итоговую строку,
Список, Сравнение, Окно просмотра, Канвас подбаз, Свойства, Таймлайн — всё это V2 spec §4
отправляет в archive/replace. `DashboardBlockPalette.svelte:39` рендерит весь WIDGET_REGISTRY
без фильтра (скрытие legacy из #059-аудита палитру не покрыло). Плюс список выходит за нижний
край экрана (нет max-height/scroll у FloatingPopup-контента). Фикс: флаг `legacy: true`
в WidgetMeta + фильтр в палитре (legacy показывать только если виджет такого типа уже есть
на канвасе), max-height + overflow-y.

### #074 — EPIC P1: Table view — полная перестройка с нуля (мандат пользователя)
- Status: ✅ DONE (2026-06-12, эпик закрыт коммитами `931d42a`→`edee977`) — все фазы:
  F1 Shell+Router; F2.1 скелет по канону; F2.2 in-place редакторы по DataFieldType;
  F2.3 row ops + New row; F2.4 меню колонки (sort/Calculate▸/hide/group) + resize +
  `[+]` add property; F2.5 группировка (groupRows un-archived, TableGroupSection,
  collapse персистится); F3 legacy containment + миграция. R2-фиксы (#083–#087) влиты.
  **Остаточные мелочи** (вне эпика, в W2): Edit property из меню колонки (нужна обвязка
  ConfigureFieldModal), freeze-up-to, drag-перестановка колонок, wrap-toggle.
  Канон: specs/TABLE_V2_CANON.md.
- **F2 canon (2026-06-11, финальный)**: **`specs/TABLE_V2_CANON.md`** — концептуальная
  перестройка с нуля по образцу Notion-таблиц (вердикт пользователя; PNG-канон из visual
  stack отменён как наследующий V1). Концептуальные сдвиги: строка = страница (Name —
  первичная колонка с ↗ OPEN), ячейка = свойство с редактором на месте по `DataFieldType`,
  вид = линза (Filter/Sort pills в ControlBar), sub-base = вкладка ViewTabBar (НЕ нижние
  табы), `[+]` add property в header (закрывает Vision §2), bulk-бар, полная стилистическая
  матрица на Notion Visual DNA токенах. Подэтапы F2.1–F2.5 и бюджеты 7 компонентов — в каноне.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: XL
- analysis_required: true | analysis_done: true (UT2026-F)
- Depends on: #067 (WidgetHost decomposition — общий план UT2026-F, фаза F1)

**Мандат пользователя (2026-06-11)**: «Сам вид Таблиц требует полной перестройки с нуля
без оглядки на прошлый экземпляр». Скриншот `19-53-17.png`: старые артефакты — emoji-кнопки,
перегруженный тулбар (Макет/Hidden/Group/Sort/Σ/🔍/⬇), обрезанные дубли колонок, баннер-хинт.
Скоуп:
- Новый Table view ВНУТРИ `database-call` (развитие DataTableContent), не правка архивного кода
- Interaction parity (gap-матрица UI_DESIGN_ARCHITECTURE §6): inline cell edit (P0),
  row hover actions, inline «+ New row», column header menu
- `data-table` widget type → deprecate: миграция существующих конфигов в `database-call`
  Table tab; demoProject больше не генерирует `data-table` (сейчас «Клиенты» = data-table!)
- Закрывает #068 архитектурно (архивный DataTableWidget перестаёт маршрутизироваться)
Architect-план обязателен ДО кода (как #067).

### #075 — P1 UX: конвейер трансформаций — дискаверабилити и язык
- Status: ✅ READY FOR PR (2026-06-21) — остаток закрыт на ветке
  `feat/095-pipeline-value-placeholder` (коммит `15eafca`): обучающий empty-state конвейера
  «было→стало» (заголовок `wand-2` + grid колонок + `arrow-right`, все размеры в rem на
  существующих `--ppp-*` токенах, новых токенов не потребовалось), кнопка «Очистить конвейер»
  (`trash-2`, один клик, Решение 1C) в футере PipelineEditor. Копирайт 2A («на языке задач»):
  tooltip ∑ и пункт меню переформулированы во всех 4 локалях (только значения, ключи не тронуты).
  Попутно закрыт i18n-пробел `database-call.*` в uk/zh-CN (коммит `ed37238`). px-budget ≤177
  держится. 4 гейта зелёные. Ранний слой D1 (`*-desc` ключи) учтён. Остатка нет.
- Прежний статус: ⚠️ PARTIAL (2026-06-11) — слой D1 (описания шагов на языке задач, tooltip).
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: M
- analysis_required: false | design_required: true (senior-designer)
- Depends on: #069 ✅

Пользователь: «не понятно как пользоваться конвейером трансформаций и что это такое».
После #069 нужен UX-слой: человеческое объяснение (Vision §7 «объяснения на месте» —
не «Unnest», а «развернуть список в строки — например, по одному участнику на строку»),
пустое состояние конвейера с примером, tooltip на кнопке пайплайна в WidgetHost.

### #076 — P2 UX: пользовательский путь «создать базу/суб-базу вытягиванием»
- Status: 📋 BACKLOG
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: M
- analysis_required: false | design_required: true (senior-designer)

Пользователь: «остаётся неясным путь для создания баз и суб-баз по вытягиваниям».
Механика есть (Матрёшка, SubBasePanel, linkedSelection), входных точек в UI нет. Дизайн:
entry points из Relation-поля («показать связанные как суб-базу» — пересекается с #059
SmartSuggest relation-CTA), из database-call (кнопка «+ суб-база»), документированный
happy-path в демо.

### #077 — P1 UX: «машина функций» — единый FormulaConstructor во всех точках + filter-pills
- Status: ✅ COMPLETED (2026-06-18, отгружен в origin/main `7cc3d66`) — спека = схема
  «Formula builder — Anatomy.png» (visual stack): слои toolbar → input (подсветка +
  автокомплит сигнатур) → live preview → help-панель категорий. Приоритет поднят P2→P1.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: L
- analysis_required: false | design_required: ✅ закрыт дизайн-стеком

Скоуп по дизайну: FormulaConstructor — единый компонент для ВСЕХ точек ввода формул
(TableProperty, AdvancedFilterEditor, FormulaBar, ConfigureField, FilterEditor + Dashboard);
именованный popup-вход «Формулы» вместо безымянной fx; filter-pills в тулбаре вью
(Notion-parity P0). Связка с #075.

Реализация (4 слайса + финальный XS, всё в origin/main):
- slice 1 (`08398a2`, `a78fe9c`) — formula syntax-highlight overlay + metadata-driven FormulaHelpPanel.
- slice 2 (`dd90c92`) — composition-wrapper FormulaConstructorFull (toolbar + lean FC +
  preview-slot + help-panel); ретайр hand-rolled chrome в AdvancedFilterEditor.
- slice 4 (`5cbb97f`) — ретайр imperative-портала DateFormulaInput → thin FC-wrapper;
  px-budget отжат 186→177 (`R0_3_pxBudget.test.ts`, `PX_BUDGET=177`).
- финальный XS (`7cc3d66`) — i18n-ключ `views.dashboard.canvas.formula-builder` →
  «Формулы» (ru) / «Formulas» (en) / «Формули» (uk) / «公式» (zh-CN) + defaultValue-fallback
  в DashboardToolbar.svelte и YamlVisualizer.svelte (user-decision: «Формулы», не «Конструктор формул»).
- slice 3 (FormulaBar) — НАМЕРЕННО отложен архитектором (FormulaBar уже корректен,
  миграция была бы косметической).

Архитектурное решение: lean FormulaConstructor НЕ поглощает все 4 слоя дизайна — добавлен
composition-wrapper FormulaConstructorFull. Параллельная реализация DateFormulaInput
(свой портал/клавиатура/preview/suggestion-движок) полностью ретайрнута — третьего пути
ввода формул нет. Baseline вырос 152/2205 → 155/2232 (новые тест-файлы FilterPills,
FormulaConstructor, formulaHelpGroups — не регрессия).

### #078 — P2: CalendarView decomposition (2328 LOC — крупнейший монолит без потолка)
- Status: 📋 BACKLOG
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: XL
- analysis_required: true | analysis_done: false

Аудит 2026-06-11: CalendarView.svelte = 2328 LOC, не покрыт ни одним планом декомпозиции.
#070 показал симптом монолита: цветовая логика была рассинхронизирована с системой.
Скоуп: architect-план по образцу UT2026-F (контроллеры/чистые модули + LOC-потолок в R0_6).
Делать ПОСЛЕ F1–F3 (паттерн Shell/Router будет отработан).

### #079 — P2: hex-ratchet — машинный инвариант на hardcoded-цвета
- Status: 📋 BACKLOG
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: S
- analysis_required: false

Аудит 2026-06-11: 32 hex-вхождения в 15 файлах вне архива/тестов (fieldTypes 5,
YearHeatmap 9, ConditionalFormatBuilder 3, …); pre-PR аудит ловит только изменённые файлы.
Скоуп: `R0_7_hexRatchet.test.ts` по образцу px-budget — список легитимных исключений
(palettes.ts, ColorPicker, colors/math) + ratchet на остальное; снижение долга → palette store.

### #080 — DECISION: Formula Node widget (fx-блок на канвасе)
- Status: ❌ CLOSED / DECLINED (2026-06-15, решение пользователя — Option B)
- Milestone: M-VISION-PARITY | Priority: P3 | Complexity: L
- analysis_required: true | analysis_done: false (закрыт без реализации)
- Replaced by: #077 (FormulaConstructor) + stats/compute-шаг пайплайна

Дизайн-стек (Таксономия №11): fx-виджет `=sum(@budget) + progress` — формула как
самостоятельный блок канваса. В WidgetType отсутствует, тикета не было (потерян план).
Варианты: (A) V2.5 — новый виджет поверх FormulaConstructor/#077; (B) отказ — покрывается
stats+compute-шагом пайплайна (зафиксировать компромисс). См. UT2026-G §C.

**РЕШЕНИЕ (2026-06-15) — Option B (отказ), зафиксированный компромисс:**
В Notion нет плавающего fx-блока на странице; формула там = свойство базы (колонка/rollup)
либо compute-шаг пайплайна. Самостоятельный fx-виджет на канвасе — НЕ Notion-parity-паттерн.
Функциональность полностью покрывается FormulaConstructor (#077) как единой точкой ввода
формул + stats/compute-шагом конвейера трансформаций. Причина закрытия — Notion-parity;
замена — #077. Тикет CLOSED как DECLINED, без добавления нового WidgetType.

### #081 — P2: RelationPickerPopover — поиск + multiselect для связей
- Status: ✅ DONE (2026-06-12, `edee977`) — редактор Relation-ячейки: поиск по записям целевого проекта (targetProjectId → resolveExternalFrame, fallback на wikilink-цели колонки), multi по Done, single по клику; запись через viewApi.updateRecord
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: M
- analysis_required: false (дизайн: схема «Система связей», RS-019)
- Depends on: #074 F2 (точка вызова — Relation-ячейка Table V2)

Дизайн: попап с поиском по записям, чекбоксы, «3 selected · Done». Закрывает
Notion-parity gap «Relation picker popup — Partial». Единый компонент для Table-ячейки,
EditNote и FormulaConstructor (@-mention).

### #082 — P2: Запись как типизированная карточка (наследник R5-012, ex-#011/#012)
- Status: 📋 BACKLOG
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: M
- analysis_required: false (дизайн: схема «YAML Visualizer → typed card»)

Цель R5-012 без архивного виджета: RecordCardView/SlideInPanel выравниваются с дизайном
typed-карточки — status pills, цветные chips, типизированные поля, expandable details.
Заменяет YamlVisualizer-путь (#011/#012 SUPERSEDED).

## UT-R2 — Ручное тестирование, раунд 2 (2026-06-12)

> Скриншоты 2026-06-12 в `screanshots/`. Таблица «гораздо лучше, но не идеал».
> Исправлено немедленно (один коммит с аудитом):
> **#083 ✅ P0** — h-scroll рассинхрон header/body: единый scroll-контейнер
> (header/footer sticky внутри), грид-треки фиксированные (minmax давал расхождение).
> **#084 ✅** — `path` скрыт по умолчанию (housekeeping; unhide через hide:false).
> **#085 ✅** — wikilinks в String-ячейках рендерятся чипами, не сырым `[[…]]`.
> **#086 ✅** — WidgetToolbar «+ Добавить виджет» показывал все legacy-типы
> (вторая поверхность создания, не покрытая #073) — фильтр L2 применён; закрывает carried B3.
> **#087 ✅** — демо «Проектов»=17: status есть и у задач → счёт по project-only `progress`.

### #088 — P1: Управление представлениями блока (вкладки вида)
- Status: ✅ DONE (2026-06-12, `7a258f0`) — + с выбором типа, имена по типу с счётчиком, dblclick-rename, ⋯/ПКМ меню Rename/Delete (последняя вкладка защищена)
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: M

Скриншот 10-15-10: «New View | New View | New View» — `+` плодит безымянные вкладки.
Скоуп: дефолтное имя по типу вида («Table 2», «Board»), выбор типа вида ПРИ создании
(popover: Table/Board/Calendar/Gallery), rename по двойному клику, удаление с подтверждением,
меню вкладки (rename/duplicate/delete/change type). Это и есть «управление представлениями».

### #089 — P2: Галерея — «Поле обложки» (выбор/применение)
- Status: 📋 BACKLOG (нужна репродукция: применяется ли выбор)
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: S

Скриншот 10-10-31: dropdown «Поле обложки» в настройках галереи. Проверить: фильтрацию
списка до полей с изображениями/URL, применение выбора, превью. Связано с #071-паттерном
(round-trip конфига вью).

### #090 — P1 DESIGN: Панели настроек виджетов — единый Notion-стиль
- Status: ✅ DONE (2026-06-19, стеки `feat/090` 5 коммитов + `feat/090b` 1 коммит) — slice 1 ChartConfig слайдеры показывают значение (§3); slice 2 DatabaseCallSettings человеческие подписи «Данные этого вью (по умолчанию)»/«Без связи — показать все записи» + D1-пояснения; slice 3 §3-секции «простыни» ChartConfig (Данные/Точечная); slice 4a i18n ChecklistConfig; slice 4b i18n StatsConfig + FilterTabsConfig + новый блок `views.dashboard.agg` (17 меток агрегаций). Config-panel i18n-дыра (англ. fallback в ru/uk/zh) закрыта во всех панелях. Опц. остаток (slice 4c, низкий приоритет): промоут `SettingsSection` в shared + раскатка §3-аккордеонов. Программное тестирование зелёное (headless build/jest 158/2246/lint/svelte-check + API 11/11). Baseline 158/2246.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: L

Скриншоты 10-16-23 (chart: «простыня» из 15 контролов, слайдеры без значений) и
10-15-10 (DatabaseCallSettings: «— inherit from view — / — standalone —» без объяснения).
Скоуп: единая анатомия панели (секции-аккордеоны, человеческие подписи с примерами — D1),
значения у слайдеров, прогрессивное раскрытие (базовое/продвинутое). «Сырой дизайн
управления параметрами/фильтрами/преобразованиями/расчётами» — сюда.

### #091 — P1 UX: Связи — управляемый флоу «Link to block»
- Status: 📋 BACKLOG | design_required
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: M
- Depends on: #081 (RelationPickerPopover), #076

«Всё ещё непонятно как делать связи». Скоуп: мастер в DatabaseCallSettings
(шаг 1: выбрать блок-мастер из списка С ИМЕНАМИ и превью; шаг 2: поле связи с
подсказкой-примером; пустые состояния объясняют, ЧТО даст связь), + вход из
SmartSuggest relation-CTA (#059) сразу в мастер.

### #092 — P1: Восстановление из пустого конвейера («Нет данных»)
- Status: ✅ READY FOR PR (2026-06-21) — recovery-узел реализован на ветке
  `feat/095-pipeline-value-placeholder`: при непустом конвейере, скрывшем все строки
  (`pipelineStepCount>0 && inputRowCount>0 && records===0 && !isFilterEmpty`), показывается
  EmptyState `filter-x` «Конвейер скрыл все записи (N шагов)» с [Открыть конвейер] [Очистить
  конвейер] (один клик, Решение 1C). Проброс `inputRowCount` WidgetHost→ctx→DatabaseCallBlock
  (коммит `ccf051b`); фикс ложного срабатывания при linked source (`1224481`). Round-trip Jest
  (`pipelineRecovery.test.ts`). 4 гейта зелёные: build 0 / 159 suites · 2264 tests / lint 0 /
  svelte-check 0. Аудит READY FOR PR. NB: #099 ранее помечал #092 как поглощённый — фактически
  закрыт этим тонким UX-слоем поверх существующего движка, без дубля filter engine.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: S

Скриншот 10-17-34: «Проекты по статусу» = «Нет данных», бейдж Σ4 — шаги конвейера
опустошили данные, пути назад не видно. Скоуп: empty-state виджета с данными-узлом
«Конвейер скрыл все записи (N шагов): [Открыть конвейер] [Очистить конвейер]»;
кнопка «Очистить» и в самом PipelineEditor. Расширяет #075.

## UT-R3 — Ручное тестирование, раунд 3 (2026-06-12, вечер)

> Скриншоты 21-18…21-25. Вердикт пользователя: «тестировщики из-за кривости дизайна не могут
> протестировать функции» — W2 исполняется жёстко. Исправлено в коммите аудита:
> **✅ P0 управление виджетами** — всегда видимое «⋯»-меню виджета с подписями (canonical
> contextMenu: Настроить/Конвейер/Переименовать/Закрепить/Удалить; чистый builder
> `widgetMenu.ts`), переименование по dblclick заголовка.
> **✅ Шаблоны** — показывали СЫРЫЕ i18n-ключи (переводов не существовало) — добавлены en+ru
> для всех 8 шаблонов.
> **✅ Primary-колонка** — показывала полный vault-путь — теперь basename (как заголовок
> страницы в Notion).
> **✅ StatsConfig** — селект агрегации был ПУСТЫМ для сохранённых значений вне списка
> (демо count_unchecked) — полный набор ColumnAggregation.
> **✅ EditNote Цвет** — секция Colors исчезала без существующего поля — теперь постоянная
> секция «Цвет», выбор создаёт `color`-frontmatter.
> **✅ Selection Bus driver в Table V2** — отсутствовал (динамические связи нечем включить
> из таблицы): пункт меню строки «Фильтровать связанные блоки», driving-подсветка строки.
> **✅ Демо-модернизация** — связанная пара «Клиенты (мастер) → Проекты клиента» в Обзоре,
> hex-цвета встреч + `eventColorField: "color"` (был "priority" — нечисловой, цвет не
> резолвился).

### #093 — P1: SettingsMenu (настройки вью/проекта) — рециклинг по канону §3
- Status: ✅ DONE (2026-06-19, стек `feat/093`, 6 коммитов) — slice 1 i18n ViewConfigTab (смесь языков устранена, en/ru/uk/zh); slice 2 verified-clean (Project/Views/ColorFilters/Sort уже переведены); slice 3 `FieldComboInput.svelte` — field-пикеры с affordance (иконка типа + caret + «новое поле», без потери create-new); slice 4 `SettingsSection.svelte` §3-аккордеоны на calendar (timeline свёрнут) + фикс хардкод-заголовка; slice 4b rollout пикера на все 9 инлайн-полей board/gallery/table. +9 тестов. Остаток: D1-подписи примерами (опц.), §3 на других вкладках (board/gallery плоские — accordion не нужен). Baseline 156/2237 → 158/2246.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: L

Скриншоты 21-19-36/21-21-45: смесь языков (Wrap text in cells / Скрыть поля), текст-инпуты
«Введите или выберите поле» вместо пикеров полей, англ. подсказки. Скоуп: все вкладки
SettingsMenu (Вид/Проекты/Виды/Фильтры/Цвета/Сортировка) → анатомия §3, field-селекты
вместо инпутов, полная i18n; сюда же выбор поля-обложки галереи (#089) и поля-цвета
календаря как явные пикеры с превью.

### #094 — P2: Словарь значений в визуализациях (легенды/группы)
- Status: ✅ READY FOR PR (2026-06-20, Option B реализован на ветке `feat/095-pipeline-value-placeholder`,
  стек поверх #095, НЕ слит/не запушен — гейт пользователя). Чарт-легенда дашборда теперь
  показывает семантические бакеты (To Do / In Progress / Done / No Status) вместо сырых ключей
  статусов (inProgress/done/planning/review) — чарт honor `statusGroups` так же, как Board/DataTable.
  БЕЗ миграции схемы: `statusGroups` читаются из `source.fields[].typeConfig` (тот же путь, что Board:
  `board.ts:55,204`). Реализация: `chartDataPipeline.ts` (`computeChartData` — гард `semanticActive` по
  `DataFieldType.Status` + бакетизация ПОСЛЕ агрегации со слиянием value аддитивно); чистая функция
  `bucketLabelForRaw` вынесена в `src/ui/views/Dashboard/widgets/DatabaseCall/groupRows.ts` (единый
  источник 3-bucket логики, переиспользуется чартом и DataTable; `buildSemanticGroups` отрефакторен
  на её вызов); `ChartWidget.svelte` прокидывает i18n-метки. Ограничение задокументировано в коде:
  не-аддитивные Y-агрегаты (avg/min/max) по Status-оси out-of-scope для #094.
  Гейты все зелёные: build 0 / jest **158 suites / 2260 tests** PASS / lint 0 / svelte-check 0;
  `@ts-ignore`=0; baseline 2246→2260 (+14); px-budget ≤177 не изменён (`styles.css` не тронут).
  Follow-up: #104 (унификация Board getSemanticColumns на `bucketLabelForRaw`).
- **✅ ЗАКРЫТ через #107 (2026-06-26, в рабочем дереве, ожидает merge пользователя)**: визуальный
  прогон 2026-06-26 показал, что семантическая легенда чарта была недостижима на дефолтных
  настройках (гейт по `DataFieldType.Status`). #107 ввёл явный UI-toggle режима группировки
  (`config.groupMode === "semantic"`), дефолт `"values"` НЕ менялся — семантические бакеты в
  легенде теперь достижимы по переключателю. Обещание #094 («легенда показывает бакеты»)
  выполнимо через toggle.
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: M (re-scoped с S; реализован Option B)

Скриншот 21-25-49: легенда «inProgress/done/planning/review» — сырые ключи статусов.
Премиса для Option B оказалась ВАЛИДНОЙ: `statusGroups` достижимы через `typeConfig` X-поля
(`source.fields[].typeConfig`, тот же путь, что Board) — маппинг 3-bucket переиспользован из общей
функции `bucketLabelForRaw`. (Ранний вывод 2026-06-20 «премиса ложна» относился к Option A —
per-value словарю «сырой ключ → метка»; он по-прежнему отсутствует и out-of-scope.)

### #095 — P2: PipelineEditor — operator-select и значения по канону
- Status: ✅ READY FOR PR (2026-06-20, ветка `feat/095-pipeline-value-placeholder`, коммит `1660e59`) — operator-select уже был каноничен (getOperatorLabel + operatorNeedsValue из #099); оставалась единственная дивергенция — value-инпут использовал приватный ключ `views.dashboard.pipeline.value` (defaultValue "Value"). Переведён на канонический `common.value-placeholder` («Значение…»), подтверждён во всех 4 локалях (en/ru/uk/zh-CN). Audit READY FOR PR, все 4 гейта зелёные (build 0 / jest 158-2246 / lint 0 / svelte-check 0). НЕ слит/запушен — гейт пользователя. P3-остаток: orphaned-ключ `views.dashboard.pipeline.value` (cleanup).
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: S

Скриншот 21-19-21: нативный select операторов, value-инпут без подсказки примера.

### #105 — P0: PipelineEditor — краш «read only property» при правке существующего шага конвейера

- Status: 📋 BACKLOG (заведён 2026-06-26 по итогам визуального прогона, computer-use +
  REST API, ветка `feat/095-pipeline-value-placeholder`, коммит `f558b48`)
- Milestone: M-UT-FIXES | Priority: P0 | Complexity: S–M (неизвестно до анализа)
- analysis_required: true
- analysis_done: false
- Источник репро: `docs/internal/TEST_REPORT_2026-06-26.md`, «Дефект 1»

**Симптом**: любое мутирующее действие в открытом редакторе конвейера («⋯ → Конвейер
данных») на УЖЕ СУЩЕСТВУЮЩЕМ шаге выбрасывает необработанное исключение и не применяется:

```
Uncaught TypeError: Cannot assign to read only property '0'/'1' of object '[object Array]'
    at V (plugin:obs-projects-plus:304:81544)
    at Y/O (plugin:obs-projects-plus:304:8377x)
    at Array.Le/ce (plugin:obs-projects-plus:304:8x)
    at HTMLButtonElement/HTMLInputElement (plugin:obs-projects-plus:304:5x)
```

Индекс в сообщении (`'0'`, `'1'`) совпадает с индексом редактируемого шага — указывает на
мутацию `steps[i]`/`conditions[i]` напрямую без клонирования. Sourcemap для `main.js`
отсутствует, поэтому привязка к `src/` не сделана — первая задача анализа: воспроизвести в
dev-режиме (`npm run dev`/несжатая сборка) или забить breakpoint по паттерну ошибки, чтобы
получить реальный `file:line` в `src/ui/views/Dashboard/...` (предположительно компонент
шага конвейера / PipelineEditor, см. `NOTION_DM_RESEARCH.md` §2–§4 про устройство шага).

**Воспроизведено на 3 независимых действиях** (т.е. не специфично для group-by):
1. Выбор поля в селекте «Group by field» (шаг «Группировка») — конфиг шага не обновляется,
   счётчик остаётся `N→N`, заголовок шага — «(не задано)».
2. Клик по иконке 👁 («Отключить шаг», non-destructive disable) — на шаге 1 (Фильтр) И на
   шаге 2 (Группировка).
3. Клик «+ Add condition» внутри шага «Фильтр» — и на свежесозданном шаге, и на
   существовавшем изначально.

**НЕ крашится** (контрольная группа, для сужения локализации):
- добавление НОВОГО шага в конвейер (кнопки «Фильтр / Группировка / Агрегация…» в футере);
- кнопка «Очистить» (footer, trash-2, #075) — мгновенно удаляет все шаги.

Гипотеза: разница между «не крашится» и «крашится» — создание нового шага кладёт новый
объект в массив (immutable push/spread), а редактирование существующего шага мутирует
элемент массива на месте. Если массив шагов приходит в дочерний компонент как `readonly
Step[]` (TypeScript) без фактического клонирования при передаче через Svelte props/store,
любая попытка `steps[i].field = x` или `steps[i] = {...}` упадёт именно так.

**Связь с историей проекта**: это НЕ повторение уже закрытой проблемы #099/#100
(«PipelineEditor: draft применяется только по Сохранить» — тот класс проблем закрыт
2026-06-13, `2db4124`/`97b7079`/`2209a8a`, READY FOR PR). Это новая, более тяжёлая
регрессия для другого пути (правка существующего шага), которую #099/#100 не покрывали
тестами. Нужен новый regression-тест на именно «открыть существующий шаг → изменить
параметр → проверить, что конфиг применился без исключения», иначе фикс рискует не
закрыть класс целиком (как уже случилось один раз с #099/#100).

**Acceptance**:
- [ ] Воспроизведено в dev-режиме с точным `file:line`.
- [ ] Все 3 действия из репро работают без исключений: выбор group-by применяется и
      отражается в заголовке/счётчике шага; disable-step (👁) переключает шаг
      non-destructively; add condition добавляет строку без падения.
- [ ] Новый regression-тест на мутацию существующего шага (не только создание нового).
- [ ] 4 гейта зелёные, передеплой в OBStests + REST API верификация + повторный визуальный
      прогон по `docs/internal/DASHBOARD_GUIDE_AND_TESTING.md` §4.3 (Jest здесь
      недостаточен — см. вывод `TEST_REPORT_2026-06-26.md`).

---

### #106 — P0: Регрессия замороженного контракта Selection Bus — Сценарий A связей (`linkedSelection`) не фильтрует приёмника, Escape не снимает выбор

- Status: 📋 BACKLOG (заведён 2026-06-26)
- Milestone: M-UT-FIXES | Priority: P0 | Complexity: S–M
- analysis_required: true
- analysis_done: false
- **Требует backend-architect-план перед фиксом** — затронут архитектурный инвариант
  («Selection Bus API контракт заморожен — не меняется», `CONTEXT.md` →
  «Ключевые решения»; «Selection Bus заморожен», `TABLE_V2_CANON.md`,
  `VISION_COMPLIANCE.md` line 29).
- Источник репро: `docs/internal/TEST_REPORT_2026-06-26.md`, «Дефект 2»

**Шаги** (демо «Обзор», мастер `database-call` «Клиенты» → приёмник `database-call`
«Проекты клиента», `linkedSelection.sourceWidgetId` указывает на мастера,
`relationField="client"`):
1. На строке «Acme Studio» в мастере → «⋯» → «Фильтровать связанные блоки по этой строке».
2. Строка корректно подсвечивается как driving (фиолетовая полоса слева).
3. **Ожидание**: приёмник показывает 2 записи (`Redesign — Acme Studio`,
   `Onboarding Flow — Acme Studio`, у которых `client: [[Acme Studio]]` в frontmatter).
4. **Факт**: приёмник показывает «Нет совпадений» (0 записей).

Воспроизведено стабильно 2 раза подряд, включая прогон с очищенной DevTools-консолью без
сопутствующих исключений — это логическая ошибка сравнения значений, не падение. Гипотеза
для анализа: значение выбора (строка `"Acme Studio"`, имя заметки) должно сравниваться с
полем `client` в данных приёмника, которое хранится как **wikilink**
(`client: "[[Acme Studio]]"`, после парсинга `DataFieldType.Relation` → массив
`["Acme Studio"]` через `stripWikiLink`, см. `src/lib/datasources/helpers.ts:74-83`).
Нужно сверить, как `canvasSelectionStore.ts` формирует условие
`{ field: relationField, operator: "is"/"is-any-of", value: <выбор> }` и какое именно
значение оно туда кладёт (raw note name vs `[[wikilink]]` vs уже распарсенное) — вероятный
mismatch именно на этом стыке (Selection Bus отдаёт один формат, `filterEvaluator.ts`
ожидает другой).

**Снятие выбора — раздельные результаты**:
- повторный клик по тому же пункту меню (теперь «Перестать фильтровать по этой строке») —
  **работает**, приёмник возвращается к полным 8 записям;
- клавиша **Escape** — **не работает**, выбор и подсветка остаются активными (нарушает
  §3.4 шаг 5 `DASHBOARD_GUIDE_AND_TESTING.md`: «Escape очищает выбор по всему канвасу»).

**Контрольная проверка (Сценарий B — chart-мастер → stats, БЕЗ `linkedSelection`)**: клик
по сектору donut-чарта корректно фильтрует stats-виджет (6/8/8/$42000 → 0/3/0/$0), сектор
подсвечивается, повторный клик снимает выбор и восстанавливает значения. **Вывод**:
Selection Bus как механизм публикации/подписки жив; баг локализован в (a) пути
`linkedSelection.relationField` специфично для `database-call`-приёмника и/или (b)
Escape-обработчике (возможно, общем — не проверено отдельно для Сценария B).

**Контекст серьёзности**: `NOTION_DM_RESEARCH.md` (2026-06-12, аудит реактивности, §3)
аттестовал Selection Bus как «✅ идемпотентный store, мгновенный» на момент исследования —
то есть механизм на тот момент работал по этому самому пути (Сценарий A — единственный
полностью настроенный пример связи в демо с момента её создания). Это регрессия в
контракте, который другие тикеты (#091 Link-флоу связей, волна W3) собираются расширять,
предполагая стабильность — фиксить нужно ДО начала #091.

**Acceptance**:
- [ ] backend-architect-план: точная диагностика mismatch (значение выбора vs формат
      `client`-поля) + минимальный фикс без изменения публичного контракта Selection Bus.
- [ ] Сценарий A полностью проходит §3.4 гайда: выбор фильтрует, повторный клик снимает,
      **Escape снимает**.
- [ ] Новый regression-тест именно на «таблица-мастер → таблица-приёмник через
      relationField + wikilink-значение» — этот путь был непокрыт, раз регрессия не
      была замечена.
- [ ] 4 гейта зелёные + REST API верификация + повторный визуальный прогон §3.4/§4.4.

---

### #107 — P1: Семантические бакеты статусов (#094/#104) не активны по умолчанию — `groupMode` Board и type-guard чарта

- Status: ✅ **FIXED (2026-06-26, в рабочем дереве ветки `feat/095-pipeline-value-placeholder`,
  НЕ закоммичено/слито/запушено — ожидает merge пользователя)**
- **РЕШЕНИЕ (продуктовое)**: выбран вариант «явный UI-toggle», НЕ смена дефолта. Режим
  группировки переключается пользователем (`values | semantic`); дефолт `"values"` сохранён
  (обратная совместимость, авто-включения нет). Семантические бакеты статусов теперь ДОСТУПНЫ
  по переключателю в чарте и Board, а не недостижимы из-за дефолтных настроек.
  - **Чарт**: гейт `src/lib/dashboard-engine/chartDataPipeline.ts:124-125` перевёрнут с
    `xFieldDef?.type === DataFieldType.Status` на `config.groupMode === "semantic"` — бакетизация
    активируется по режиму группировки, не по выведенному типу X-поля.
  - **Board**: toggle уже существовал (`BoardSettings` → `config.groupMode`, путь
    `BoardOptionsProvider.svelte:20` → `board.ts:51-58` → `BoardView.svelte:524`); дополнительной
    логики не потребовалось.
  - Закрывает визуальный FAIL #094 и #104 (см. их записи). Изменённые файлы:
    `src/lib/dashboard-engine/chartDataPipeline.ts` (gate flip) + связанные тесты чарт-пайплайна.
  - Гейты (независимо подтверждены tester И audit-manager): build 0 / jest **162 suites /
    2287 tests PASS** / lint 0 / svelte-check 0 / PX-ratchet 177; деплой OBStests + REST OK;
    аудит READY FOR PR. Визуальный реконфирм §4.2 (toggle/легенда/колонки) — Untestable (UI-only),
    ожидает ручной проверки пользователя.
- Milestone: M-UT-FIXES | Priority: P1 (повышен с предполагаемого P3 — см. ниже) |
  Complexity: XS–S (если гипотеза верна — это смена дефолта/генератора, не новая логика)
- analysis_required: false (root cause найден ниже с точными `file:line`)
- Depends on: #094 (✅ READY FOR PR), #104 (✅ READY FOR PR `9cb69ec`)
- Источник репро: `docs/internal/TEST_REPORT_2026-06-26.md`, «Дефект 3»

**Факт визуальной проверки** (2026-06-26): легенда donut-чарта «Проекты по статусу»
(демо, вид «Обзор») показывает сырые ключи `inProgress`/`done`/`planning`/`review`, НЕ
семантические метки «To Do / In Progress / Done». Колонки Board-вида «Pipeline» показывают
те же сырые ключи в произвольном порядке. Это закрывает (с результатом FAIL) пп. 1–2
`UNTESTABLE_FEATURES_W2_2026-06-22.md`, которые были явно отложены на «визуальный прогон
человеком» с момента закрытия #094/#104.

**Это НЕ означает, что #094/#104 реализованы неверно** — `data.json` демо подтверждает:
`fieldConfig.status.statusGroups` присутствует и корректен
(`todo:[planning,todo]`, `inProgress:[inProgress,doing,review]`, `complete:[done]`), а
код (`bucketLabelForRaw` в `groupRows.ts`, переиспользуется чартом и Board) — на месте.
**Найденная точная причина — два РАЗНЫХ гейта активации, оба отдельно от `statusGroups`,
и ни один из них демо-проект не включает:**

1. **Чарт** (`src/lib/dashboard-engine/chartDataPipeline.ts:124-125`):
   ```ts
   const semanticActive =
     xFieldDef?.type === DataFieldType.Status && hasAnyBucket && dateGrouping == null;
   ```
   Бакетизация активируется ТОЛЬКО если ось X имеет `DataFieldType.Status`. Демо-генератор
   (`src/ui/app/onboarding/demoProject.ts`) НЕ присваивает полю `status` явный тип
   `DataFieldType.Status` — поле определяется через `fieldConfig.status.statusGroups`
   (другое пространство конфига), без отдельного объявления `type`. Если тип поля
   `status` в проекте инферится автоматически (а не явно как `Status`), `semanticActive`
   всегда `false`. **Нужно проверить**, как вообще присваивается `DataFieldType.Status`
   полю в folder-datasource проекте без явной схемы (`fields[]`) — через
   `ConfigureField`/`Schema.svelte` (см. `dataFieldTypeOptions.ts`) пользователь может
   назначить тип Status вручную, но демо-генератор не делает этого программно.

2. **Board** (`src/ui/views/Board/BoardOptionsProvider.svelte:20`):
   ```ts
   $: groupMode = config?.groupMode ?? "values";
   ```
   и (`src/ui/views/Board/board.ts:51-58`, `getColumns`):
   ```ts
   if (semanticGroupMode && grouByField && grouByField.typeConfig?.statusGroups) {
     return getSemanticColumns(...);
   }
   ```
   `groupMode` по умолчанию `"values"` (= raw), а не `"semantic"` — переключение в
   `BoardView.svelte:524` передаётся как `groupMode === "semantic"`. Демо-генератор не
   устанавливает `config.groupMode = "semantic"` для вида «Pipeline», поэтому семантическая
   ветка `getSemanticColumns` никогда не вызывается, несмотря на корректные
   `statusGroups`. **Это объясняет, почему #104 — чистый рефакторинг «поведение
   идентично построчно» (как и заявлено в его описании) — ничего не изменил визуально:
   #104 рефакторил `getSemanticColumns` (когда она вызывается), но не трогал условие
   ЕЁ ВЫЗОВА, которое зависит от `groupMode`, остающегося `"values"` по умолчанию.**

**Открытый вопрос для анализа** (помечен как `analysis_required: false`, т.к. гипотеза
конкретна, но решение зависит от продуктового выбора): существует ли в UI Board-вида
переключатель «сырые значения / семантические бакеты» для `groupMode`, который пользователь
может включить вручную? Если да — баг в том, что демо не включает его по умолчанию
(легкий фикс генератора). Если нет — это пробел дискаверабилити (#104 предполагал, что
существующий путь активации работает, но пользователю/демо неоткуда узнать о
`groupMode: "semantic"`, если нет UI-входа).

**Severity**: P1 (повышен с тех-долгового P3 у #104) — потому что #094 был READY FOR PR
именно с обещанием «легенда показывает семантические бакеты», и реальный рендер (на
дефолтных настройках, как видит обычный пользователь/демо) этого не делает. Расхождение
между Jest (зелёный, юнит-тесты вызывают функции напрямую с явными аргументами) и
интеграционным поведением (дефолты не совпадают) — см. вывод `TEST_REPORT_2026-06-26.md`
о том, что Jest здесь недостаточен как единственный гейт.

**Acceptance**:
- [ ] Решить (продуктово): семантический режим — это новый ДЕФОЛТ при наличии
      `statusGroups`, или явный UI-toggle? Зафиксировать решение в `CONTEXT.md`.
- [ ] Если дефолт: изменить `groupMode` default-логику (`BoardOptionsProvider.svelte:20`)
      на авто-включение semantic при `typeConfig.statusGroups` присутствует и явно не
      выключен пользователем; присвоить `DataFieldType.Status` полю `status` в
      демо-генераторе (или общем авто-определении типа для select-like строковых полей).
- [ ] Если toggle: обеспечить видимый UI-вход + обновить демо-генератор, чтобы включать
      его в демо (по правилу schema evolution из `CLAUDE.md`: «grep all generators»).
- [ ] Повторный визуальный прогон §4.2 гайда после фикса — обязателен, Jest не
      эквивалентен.

---

### #108 — P2: Утечка русских меток операторов фильтра под uk/zh-CN (i18n)

- Status: 📋 BACKLOG (заведён 2026-06-26)
- Milestone: M-UT-FIXES | Priority: P2 | Complexity: XS
- analysis_required: false
- Источник репро: `docs/internal/TEST_REPORT_2026-06-26.md`, «Дефект 4»

`src/ui/components/Navigation/SettingsMenu/tabs/filterHelpers.ts:59-103` — `OPERATOR_LABELS`
это хардкод-`Record` русских строк, а `getOperatorLabel` (`:108-110`) возвращает его напрямую,
поэтому пилюли фильтра показывают «Равно»/«Содержит» и т.п. под локалями uk/zh-CN. Скоуп:
маршрутизировать `getOperatorLabel` через i18n (`components.filter.operators.<op>`, паттерн
`get(i18n)` как в `board.ts`), оставив `OPERATOR_LABELS` как `defaultValue`-fallback; добавить
ключи операторов во все 4 локали (en/ru/uk/zh-CN), символьные операторы (`=`,`≠`,`<`,`>`,`≤`,`≥`)
языконезависимы. Acceptance: пилюли локализуются; ru без регрессии; baseline держится; 4 гейта 0.

### #109 — P3: Дублирование поля-заголовка на карточках Board (custom header)

- Status: 📋 BACKLOG (заведён 2026-06-26)
- Milestone: M-UT-FIXES | Priority: P3 | Complexity: XS
- analysis_required: false
- Источник репро: `docs/internal/TEST_REPORT_2026-06-26.md`, «Дефект 5»

`src/ui/views/Board/components/Board/CardList.svelte:158` рендерит
`<CardMetadata fields={includeFields} />` для тела карточки, а заголовок (при заданном
`customHeader`, `:155`) ТАКЖЕ рендерит это поле — когда `customHeader` входит в `includeFields`,
оно показывается дважды. Скоуп: вынести чистый хелпер `excludeHeaderField(includeFields,
customHeader)` в `boardHelpers.ts` (Jest-тестируемый), использовать `bodyFields` в теле карточки;
поведение заголовка без изменений. Acceptance: дубль убран при наличии header в списке; no-op
когда `customHeader` undefined/не в списке; baseline держится; 4 гейта 0.

---

### #104 — P3: Унифицировать Board getSemanticColumns на `bucketLabelForRaw` (последняя копия 3-bucket логики)
- Status: ✅ READY FOR PR (2026-06-21, ветка `feat/095-pipeline-value-placeholder`, коммит `9cb69ec`, стек поверх #094, НЕ слит/не запушен — гейт пользователя). `getSemanticColumns` (`board.ts:~203`) переведён с локальных `Set` + if/else-цепочки на вызов канонической `bucketLabelForRaw(str, groups, LABELS)` — последняя 2-я копия 3-bucket логики устранена (0 дублей). Чистый рефактор, поведение идентично построчно (null→none, порядок todo→inProgress→complete→none, `Set.has`↔`Array.includes`). Гейты: tsc 0 / jest по затронутым модулям 58 suites / 811 tests PASS / baseline 158/2260 держится. P3-остаток отсутствует.
- **✅ ЗАКРЫТ через #107 (2026-06-26, в рабочем дереве, ожидает merge пользователя)**:
  `getSemanticColumns` → `bucketLabelForRaw` уже был в коде (этот рефактор), но не активировался
  визуально — вызов гейтился `groupMode==="values"` по умолчанию. #107 обеспечил активацию через
  Board `groupMode` toggle (`config.groupMode === "semantic"`). Дедупликация 3-bucket логики этого
  тикета остаётся в силе; визуальный фейл закрыт #107.
- Milestone: M-UT-FIXES | Priority: P3 | Complexity: XS
- analysis_required: false
- Depends on: #094 (✅ READY FOR PR — вынес `bucketLabelForRaw`)

После #094 единый источник 3-bucket логики (To Do / In Progress / Done / No Status) — чистая функция
`bucketLabelForRaw` в `src/ui/views/Dashboard/widgets/DatabaseCall/groupRows.ts`; её переиспользуют
чарт (`chartDataPipeline.ts`) и DataTable (`buildSemanticGroups`). Осталась 2-я (последняя) копия той
же логики — inline в `src/ui/views/Board/board.ts` `getSemanticColumns` (~:197–233). Скоуп:
отрефакторить `getSemanticColumns` на вызов `bucketLabelForRaw`, закрыв последнюю дубль-реализацию
3-bucket маппинга. Поведенческих изменений быть не должно — только дедупликация. Acceptance: 0
дублей 3-bucket логики; baseline держится; tsc/lint/svelte-check 0.

> Скриншоты `C:\Users\Park\OBSv1.0\screanshots` (12 шт, 21:46–21:59). Полная сверка
> «отчёт ↔ код» + декомпозиция + скорректированная дорожная карта:
> **`docs/internal/AUDIT_ROADMAP_2026-06-18.md`** (канон последовательности на W2–W5).
> Критический конфаунд: тест снят с устаревшего билда (20:26, без последних переводов) —
> deploy-гейт перед ручным тестом теперь обязателен (AUDIT_ROADMAP §4А).

### #103 — EPIC P1: Filter UX unification (единый источник правды фильтра вью)
- Status: ✅ DONE (2026-06-18, в origin/main `590ae06`) — FilterBridge global-chip удалён (pills = единственная поверхность), ViewConfigTab quick-links → навигация, `filterBridge.test.ts` (+5) фиксирует инвариант; попутно исправлен дубликат i18n-ключа `views.dashboard.templates` (реальная причина сырого ключа из UT-R5). Baseline 155/2232 → 156/2237.
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: S–M
- Спека: `docs/internal/AUDIT_ROADMAP_2026-06-18.md` §3 (W2.0), кластер B

Emergent-долг от эпиков #099 + #077: один и тот же `view.filter` рендерится в ТРЁХ
поверхностях — `ViewFilterBar` pills (`App.svelte:300`), `FilterBridge` бейдж
«Глобальный фильтр: N условий» (`DashboardCanvas.svelte:168`), редактор в SettingsMenu.
Пользователь: «представление глобальных фильтров в шапке убрать — дублирование усложняет».

Scope:
1. Один источник правды для `view.filter` в UI. По умолчанию: оставить `ViewFilterBar`
   pills (редактируемые, реактивные), **удалить** `FilterBridge` глобал-бейдж; оставить
   только локальный filter-tab-чип с «↥ promote» (это другое состояние, не дубль).
2. `ViewConfigTab` quick-links (`:612-619`) — убрать визуальное сходство с tablist
   (граница с #093).
3. Round-trip компонент-тест: правка фильтра в SettingsMenu ↔ pills синхронны (зафиксировать
   реактивный инвариант; по коду `App.svelte:62,70` уже реактивно).
4. Ре-репро edge-collision поповера фильтра на свежем билде; если воспроизводится —
   доработка #098.

Acceptance criteria:
1. В шапке Обзора нет двух представлений глобального фильтра (бейдж удалён или объединён с pills).
2. Правка фильтра в SettingsMenu мгновенно отражается в pills и наоборот (тест).
3. `ViewConfigTab` quick-links не выглядят как второй ряд табов.
4. 4 гейта зелёные; px-budget не растёт; нет параллельного filter-движка (потребляется `filterEvaluator.ts`).

## UT-R4 — Раунд 4 + ресерч Notion (2026-06-12, поздний вечер)

> Скриншоты 22-15…22-18 + ресерч `specs/NOTION_DM_RESEARCH.md` (КОНЕЧНЫЙ ПЛАН-ЭТАЛОН
> управления данными). Ключ: в Notion НЕТ конвейера — операции живут у объектов и
> применяются мгновенно. Реактивный фундамент у нас здоров (vault→cache→frame подтверждено
> кодом); болевые точки: конвейер-Save, панельный round-trip, модалка-снапшот.

### #099 — EPIC P1: Расщепление конвейера трансформаций (Notion-модель данных)
- Status: ✅ CLOSED 2026-06-13 — filter pills bar + live-apply pipeline editor (`2db4124`), disable-step non-destructive (`97b7079`), #099.3 unnest как свойство блока (`2209a8a`). Поглотил #092, #095. Спека `specs/NOTION_DM_RESEARCH.md` §2
- Milestone: M-UT-FIXES | Priority: P1 | Complexity: XL | Волна: W2-ядро
- Поглощает: #075-остаток, #092, #095

filter → pills ControlBar (живые, FilterPanel-builder); unnest/join → свойства блока;
compute → formula-поле (#077); остаток конвейера = «Расширенные преобразования»:
БЕЗ Save/Отмена, живые счётчики N→M на шаг (executeTransform.meta готов), шаг с 0 записей
подсвечен с «Отключить шаг», типизированный пикер полей без housekeeping.

#### #099.3 — P1: unnest как свойство блока в DatabaseCallSettings
- Status: ✅ CLOSED 2026-06-13 — `2209a8a` (DatabaseCallSettings проп + пикер + dispatch, общий `arrayFieldDetection.ts`, round-trip тест)
- Milestone: M-UT-FIXES | Priority: P1 (наследует epic #099) | Complexity: S
- Спека: `specs/NOTION_DM_RESEARCH.md` §2 (~стр.52, тумблер «Развернуть список: <field>»)

Scope: вынести unnest из конвейера в настройки блока database-call как
свойство «Развернуть список» — типизированный пикер array-полей + тумблер on/off.
Движок unnest уже готов (UnnestStep / executeUnnest), новый engine-код НЕ нужен.

Routing decision: **Option A** — DatabaseCallSettings получает `transform`
пропом и диспатчит новый `transformChange: TransformPipeline`; WidgetHost
обрабатывает через `patchWidget({ transform })`. Запись хранится в
`widget.transform` (тот же канал, что и PipelineEditor) → две UI правят один
источник, double-unnest невозможен. Toggle переписывает существующий unnest-шаг
для выбранного поля (prepend, как `addUnnestForField`), а не добавляет второй.

Affected files:
- `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte` (новый проп + пикер + dispatch)
- `src/ui/views/Dashboard/widgets/WidgetHost.svelte` (передать `transform={currentPipeline}`, повесить `on:transformChange`)
- `src/ui/views/Dashboard/widgets/_shared/arrayFieldDetection.ts` (НОВЫЙ — извлечь detectArrayFields из PipelineEditor.svelte:79-102)
- `src/ui/views/Dashboard/widgets/PipelineEditor.svelte` (импортировать общий detectArrayFields вместо локального)
- `src/lib/stores/translations/{en,ru,uk,zh-CN}.json` (ключи database-call.settings.unnest-*)
- `src/ui/views/Dashboard/__tests__/databaseCallSettings.test.ts` (round-trip + helper-тест)

Acceptance criteria:
1. В DatabaseCallSettings есть секция «Развернуть список»: пикер array-полей (по `arrayFieldDetection`, без housekeeping) + тумблер on/off.
2. Включение тумблера для поля F → `widget.transform.steps` содержит `{ type: "unnest", field: F }` (prepend); выключение удаляет именно этот шаг.
3. Round-trip (#100-инвариант): toggle on → закрыть/переоткрыть панель → состояние тумблера и выбранное поле отражают `widget.transform`.
4. Нет параллельной реализации детекции массивов: PipelineEditor и Settings используют один `arrayFieldDetection.ts` (инвариант single-impl).
5. Toggle в Settings + ручной unnest-шаг в PipelineEditor для того же поля не создают двух unnest-шагов.
6. Новый CSS только в rem (px-budget headroom = 2); 4 гейта зелёные.

### #100 — P1: Reactivity hardening — панельный round-trip на все конфиг-панели
- Status: ✅ DONE (2026-06-13) — READY FOR PR (не слит/запушен — гейт пользователя)
- Milestone: W2 | Priority: P1 | Complexity: M
- Контракт UT2026-D P2 + optimistic-эхо; закрывает класс багов «#071 select не применяется».
- Доставлено в 4 коммита: `cf87da6` (slice 1 — pure config-echo guard helper + unit-тесты),
  `b4bd4ea` (slice 2 — wire guard в DashboardCanvas), `65165ad` (slice 3 — config panel
  round-trip harness + #071 regression), `a4019ed` (fix — echo guard игнорирует
  replayed stale prop / `lastProp`).
- Новые файлы: `src/ui/views/Dashboard/dashboardConfigEcho.ts` (pure optimistic-echo guard),
  `dashboardCanvasEcho.test.ts` (6), `configPanelRoundTrip.test.ts` (6).
- Закрывает класс багов #071. Audit READY FOR PR. Follow-up: **#102** (P2, rapid double-commit edge).

### #101 — P2: EditNote — живая модалка (подписка на обновления записи)
- Status: ✅ DONE (2026-06-14) — READY FOR PR (не слит/запушен — гейт пользователя)
- **Delivered** (`c1becb4`): все три среза доставлены одним коммитом — #101.1 чистый `mergeExternal(local, store, dirty)` helper в `src/ui/modals/components/editNoteMerge.ts` (untouched-ключи из store, dirty-ключи из local, id из store) + 8 unit-тестов в новом `editNoteMerge.test.ts`; #101.2 dirty `Set<string>` заполняется в `setValue`, чистится на обоих save-success путях (autosave + handleManualSave); #101.3 `$dataFrame` auto-subscribe + live-lookup по захваченному `recordId` (фикс Svelte cyclical-dep `record→live→record`) + реактивная склейка. Без `metadataCache.on`, без ручного unsubscribe (`$store` auto-teardown). Гейты: build 0, jest 152/2203 (+1 suite/+8), lint 0, svelte-check 0/0. Авто-закрытие модалки при удалении записи извне — явный out-of-scope follow-up (см. «Запись удалена внешне» ниже).
- Complexity: **S–M** | architect-signed 2026-06-14 (backend-architect, ровно 2 модуля: EditNote.svelte + editNoteModal.ts; store/API/types переиспользуются БЕЗ изменений).
- **Баг**: EditNote.svelte:109 `$: valuesSnapshot = { ...record.values }` реагирует только на локальный prop `record`. Этот prop захватывается one-shot в editNoteModal.ts:30 (`record: this.defaults`) и больше никогда не связан с живым стором. Внешние изменения записи (vault/metadataCache → `dataFrame.merge()`; api.updateRecord → `dataFrame.updateRecord()`) не перерисовывают модалку. Модалка — ЕДИНСТВЕННЫЙ consumer, отстёгивающий одну запись от потока `$dataFrame` (views читают `$: ({fields,records}=frame)` из DataFrameProvider.svelte:153).

#### Ратифицированная dirty-merge политика (load-bearing решение)
- **Scope dirty = per-field**, НЕ per-record. Вводится `let dirty = new Set<string>()` (имена тронутых полей). `setValue` (EditNote.svelte:173) добавляет `fieldName` в `dirty`. `dirty` чистится после успешного `performSave` (поле улетело в стор → больше не «грязное»).
- **Last-writer-wins per UNTOUCHED поле** — согласовано с инвариантом всего приложения (`updateRecord` = wholesale replace, dataframe.ts:95). При внешнем изменении записи:
  - (a) **untouched поле** → перезаписывается значением из стора (внешний писатель победил; пользователь его не трогал).
  - (b) **поле, которое пользователь редактирует прямо сейчас (в `dirty`)** → НЕ трогаем; локальный pending-edit сохраняется (autosave ~300ms сам отправит его в стор, окно конфликта мало).
  - (c) **поле, тронутое пользователем (в `dirty`) И изменённое внешним писателем** → локальное значение побеждает (last-writer-wins на уровне модалки; пользователь = последний писатель в этом UI). Никакого conflict-resolution UI — out of scope, не «trivially free».
- **Merge-функция** (чистая, тестируемая, вне Svelte): `mergeExternal(localRecord, storeRecord, dirty) → DataRecord`. Берёт `storeRecord.values` как базу, накладывает поверх `localRecord.values` для каждого ключа из `dirty`. Поля метаданных (`id`) берутся из `storeRecord` (id стабилен — ключ идентичности и в updateRecord, и в merge). Это вычистит и переименования полей, прилетевшие через стор, для нетронутых ключей.

#### Механизм подписки
- **`$dataFrame` auto-subscribe** (предпочтительно) — НЕ `metadataCache.on`. Обоснование: внешние изменения (vault, metadata, api) уже воронятся через `dataFrame` (единый источник истины, dataframe.ts:68). Подписка на `metadataCache` дала бы ПАРАЛЛЕЛЬНЫЙ канал, читающий сырые frontmatter мимо formula/relations-пайплайна → нарушение инварианта #4 и дубль источника. `$dataFrame` отдаёт уже обогащённую запись тем же путём, что и views.
- **Props contract**: EditNote.svelte импортирует стор напрямую — `import { dataFrame } from "src/lib/stores/dataframe"` (тот же импорт-паттерн, что DataFrameProvider). editNoteModal.ts НЕ меняет сигнатуру конструктора и НЕ передаёт живую ссылку — он по-прежнему передаёт `record: this.defaults` (initial seed). Идентичность — `record.id`; модалка реактивно находит свежую запись: `$: live = $dataFrame.records.find(r => r.id === record.id)`.
- **Реактивная склейка**: `$: if (live) record = mergeExternal(record, live, dirty)`. valuesSnapshot (line 109) остаётся как есть — он уже реагирует на `record`. Никакой второй snapshot-логики.

#### Инвариант единственного источника
- Фикс НЕ вводит параллельную подписку/фильтр-движок: единственный новый канал — auto-subscribe `$dataFrame` (канонический паттерн a из DataFrameProvider.svelte:153 / GalleryView.svelte:43). `filterEvaluator.ts` не трогается.
- **Teardown**: Svelte auto-subscription (`$store`) сам отписывается при `$destroy` компонента — отдельный `onDestroy`-unsubscribe НЕ нужен (в отличие от ручного `metadataCache.on`, который потребовал бы offref). Существующий `onDestroy` (EditNote.svelte:123, clearTimeout) не трогаем.

#### Под-тикеты (срезы, каждый зелёный на 4 гейтах; baseline 151/2195 не регрессирует; PX≤186; zero @ts-ignore)
- **#101.1 (XS)** — Чистая merge-функция `mergeExternal(local, store, dirty)` в новом модуле `src/ui/modals/components/editNoteMerge.ts` (или co-located helper). Без Svelte, без стора — чистый ТС. AC: «untouched ключи берутся из store, dirty ключи — из local, id из store». Тесты: **новый** `editNoteMerge.test.ts` (untouched-wins, dirty-wins, mixed, удалённый-в-store ключ, пустой dirty == полная замена).
- **#101.2 (S)** — Dirty-tracking: `dirty: Set<string>` + регистрация в `setValue` (EditNote.svelte:173) + очистка после успешного `performSave` (после line 147). AC: «после ввода в поле X имя X ∈ dirty; после успешного автосейва dirty пуст». Тест: расширить/создать `EditNote.dirty.test.ts` (unit на хелперах dirty add/clear; UI-часть → untestable-features note если Svelte-mount недоступен в jest).
- **#101.3 (S)** — Подписка: `$dataFrame` auto-subscribe + `$: live = ...find(id)` + `$: if (live) record = mergeExternal(...)`. AC: «при `dataFrame.updateRecord(внешняя версия)` нетронутые поля открытой модалки обновляются, dirty-поля сохраняются». Тест: интеграционный на mergeExternal + store-mutation (через стор-мок), переиспользовать паттерн стор-тестов.

#### Риски
- **Subscription leak** — снят выбором `$store` auto-subscribe (Svelte отписывает сам при $destroy). Если разработчик соскользнёт на ручной `subscribe()` — обязан unsubscribe в onDestroy:123.
- **Infinite loop** (store write → reactive → store write): реальный риск. `$: record = mergeExternal(...)` НЕ должен триггерить save. setValue (user-инициированный) — единственный путь к autosave; реактивная склейка от стора пишет только `record`, не вызывает performSave. Тест должен подтвердить, что внешний апдейт НЕ вызывает onSave.
- **Запись удалена внешне** (record.id больше нет во фрейме): `live` станет `undefined` → guard `if (live)` оставляет последнее `record` на экране. Out-of-scope для #101 авто-закрытие модалки; задокументировать как follow-up если потребуется UX.
- **id stability**: `record.id` (путь .md) — ключ и в updateRecord (dataframe.ts:95), и в merge (dataframe.ts:164). Rename меняет id и уже закрывает модалку (editNoteModal.ts:43) — конфликта нет.
- **dirty не чистится при manual-save режиме** (handleManualSave, line 199): убедиться, что очистка dirty висит на общем save-success, а не только на autosave-ветке.



### #096 — P2: Чарты — менеджмент осей (auto-skip/rotate дат, date-bucketing)
- Status: ✅ DONE (2026-06-14) — READY FOR PR (не слит/запушен — гейт пользователя). Скриншот 22-16-35: подписи дат слипаются в кашу.
- Complexity: M | architect-signed 2026-06-13 (backend-architect, ≥2 модуля + engine).
- Доставлено в трёх срезах: #096.1 (`b2947c1`) engine date-bucketing, #096.2 (`7e4e4d7`) density-based `axisLabels.ts`, #096.3 (`e23abbc`) granularity config UI. #096.4 остаётся открыт P3.
- Подход: переиспользовать существующий engine `DateGrouping` (transformExecutor.ts) — НЕ
  строить параллель; auto-default `month` для Date X-полей + явный override `dateGranularity?`
  в `ChartAxisX` (additive optional → миграция НЕ нужна). Унификация skip/rotate в один pure
  helper `axisLabels.ts` (density-based, Chart-local, не в engine).
- Под-тикеты (срезы, каждый зелёный на 4 гейтах):
  - #096.1 (S) — Engine: wire date-bucketing в chart pipeline. `chartDataPipeline.ts`
    (buildChartPipeline emit dateGrouping когда X=Date + computeChartData читает derived
    `${xField}_${gran}`), optional `fields` param от source.fields. Type `ChartAxisX.dateGranularity`.
    Тесты: chartDataPipeline.test.ts (auto-month, explicit gran, non-Date regression, sort);
    transformExecutor.test.ts +week(ISO-Thursday)/quarter/year/__empty__/__invalid__.
  - #096.2 (M) — Render: shared density-based label helper `axisLabels.ts` + `axisLabels.test.ts`;
    адаптировать LineChart.svelte (заменить /8 magic) + BarChart.svelte (skip отсутствует → overlap),
    reconcile bottom-padding под rotation.
  - #096.3 (S) — Config UI: granularity `<select>` в ChartConfig.svelte, gated на
    DataFieldType.Date (dispatch by type, инвариант #1) + i18n en/ru/uk/zh-CN + round-trip тест.
- Behavior change (PR-note): существующие date-чарты (templates `property:"date"`) начнут
  bucket-иться по месяцу автоматически. Намеренный фикс. Inherit default — без миграции.
- PX-budget impact: ~0 (label-геометрия = unitless SVG-атрибуты, не CSS px).

### #096.4 — P3: Чарты — reconcile dayjs vs raw Date в truncateDate (follow-up #096)
- Status: ✅ DONE (2026-06-15, `065331e`) — READY FOR PR (не слит/запушен — гейт пользователя).
- **Delivered** (`065331e`): `src/lib/dashboard-engine/transformExecutor.ts` truncateDate
  string-fallback заменён с `new Date(String(dateVal))` на `dayjs(String(dateVal)).toDate()` —
  унификация на канонический dayjs date-слой (`src/lib/helpers/dateFormatting.ts`); фиксит
  off-by-one date-bucket drift в negative-offset таймзонах. Fast-path `instanceof Date`
  сохранён, `isNaN` invalid-guard сохранён. +2 TZ-boundary regression-теста в
  `transformExecutor.test.ts`.
- **Resolution note**: architect DEFER-опасение (регрессия существующих month/week/quarter/year
  тестов) проверено semantic-analyzer и НЕ подтвердилось — 6 существующих assertion'ов
  boundary-safe; фикс behavior-preserving для них и добавляет non-ISO/TZ-покрытие.
- Гейты: build 0 err, jest 152/2205 (+2), lint 0 err, svelte-check 0 err. Audit verdict:
  zero P0/P1/P2/P3 findings.

### #097 — ✅ DONE (2026-06-12) — debug-строка чеклиста («Source: 28 · check=—…») удалена.

### #098 — P2: FloatingPopup — коллизия с краем окна
- Status: ✅ DONE (2026-06-13) — READY FOR PR (не слит/запушен — гейт пользователя)
- Milestone: W2 | Priority: P2 | Complexity: S — скриншот 22-18-21: палитра у правого края обрезана.
- Доставлено в коммит `7fe7756`: viewport width-clamp = MIN(viewport-cap, CSS max-width) +
  слушатели reposition на window resize / capturing-scroll.
- Файлы: `src/ui/components/FloatingPopup/FloatingPopup.svelte` + его тест (+3 теста).
- Deferred (P3, awareness only): un-throttled scroll reposition (нет rAF-коалесинга);
  width-only scope (нет max-height cap — вертикальный overflow только top-clamp). При
  необходимости — отдельный тикет на vertical-overflow gap.

### #102 — P2: config-echo guard — rapid double-commit edge (follow-up #100)
- Status: ✅ CLOSED (2026-06-14, `57ae744`, READY FOR PR) | W2 — audit-manager finding (#100 audit, 2026-06-13).
- dashboardConfigEcho.reconcile() сбрасывал pendingWrites=0 абсолютно, а не декрементом. При двух commit подряд в одном microtask-окне с interleaved echo первого write reconcile мог force-adopt-нуть устаревшее значение, затирая более новый optimistic. Single-commit путь (доминирующий, все панели) корректен. Не регрессия vs pre-#100.
- Fix: `reconcile()` теперь декрементит `pendingWrites -= 1` симметрично с `commit()` + clear-pending при `eq(cfg, current)`. +3 state-machine теста. Все 4 гейта зелёные.

---

## Dependency graph

```
M-ENGINE-CLEANUP ✅, M-COLOR-SETTINGS ✅:
#014 ✅ ──► #002 Ph1 ✅ ──► #003 (calendar filter)
                         └──► #013 (canvas split, BACKLOG) ──► #009 ✅ ──► #010 ✅
#007 ✅  #006 ✅  #015 ✅  (independent, all done)
#005 ✅ ──► #008 ✅ ──► #001 ✅ ──► #009 ✅
                           └──► #011 ──► #012

M-CANVAS-REACTIVE: #016 ✅ DONE (Phase 1 closed); #031 ✅ DONE (Phase 2 closed)

M-TABLE-REWRITE ✅:
#001 ✅ ──► #009 ✅ (M-SUBBASES DONE)

M-DATAVIEW-BRIDGE ✅ COMPLETE (2026-05-27):
#045 (parent) ◄── #009 ✅, #010 ✅
├──► #045.1 ✅, #045.2 ✅, #045.3 ✅, #045.4 ✅, #045.5 ✅, #045.6 ✅
All sub-tickets merged via 7756cd6.

M-FREE-CANVAS ✅ COMPLETE (Phase 3, Dashboard V3):
#030 ✅ ──► #032 ✅ ──┬──► #033 (BACKLOG)
                    └──► #036 (BACKLOG, NEEDS-ANALYSIS done)

M-POPUP-STANDARDISATION ✅: #034 ✅ DONE, #040 ✅ DONE

M-INTERACTIVE-DASHBOARD ✅ COMPLETE (Phase 5, 2026-05-27):
#044.1 ✅ ──► #044.2 ✅ ──► #044.3a ✅ ──► #044.3b ✅
                        ├──► #044.4 ✅
                        └──► #044.5 ✅
All sub-PRs merged into main.

M-V35-HOTFIX-UX ✅ COMPLETE:
#037 ✅, #038 ✅, #039 ✅, #040 ✅, #041 ✅, #042 ✅, #043 ✅

M-UX 🔄 ACTIVE:
#046 ✅ (awaiting user merge → main)
#047 ✅ (awaiting user merge → main)
Next: #011 (YamlVisualizer widget test), #048 (native-query UI, to be created)

M-UI-MODERNIZATION 🔄 PLANNED (адаптирован 2026-06-10 — V2-aligned):
#057 (type cleanup, P0) ──────────────────────────── [параллельно с #050]
#050 (tokens, P0) ──► #051 (DB Table View, XL) ──► #056 (V2 archive, depends on #051)
                  ──► #052 (WidgetShell, L)
                  ──► #053 (Chart, M)
                  ──► #054 (Stats только, S) [Comparison/SummaryRow → #056]
                  ──► #055 (FilterTabs/Checklist/DB UI, M)
All → #058 (integration, M) [last]

M-VISION-PARITY 📋 PLANNED (2026-06-10 — Vision alignment audit):
#059 (SmartSuggest, P1) ──► depends on #051
#060 (Field transparency, P2) ──► depends on #051
#061 (Template Library, P2) ──► depends on #046 ✅
#065 (Canvas zero-state, P1) ──► depends on #050
#062 (Drag-to-link, P3) ──► DEFERRED V3
#063 (Timeline, P3) ──► DEFERRED V3
#064 (Graph View, P3) ──► DEFERRED V3
#066 (Dashboard as YAML, P2) ──► requires decision session
```

### #125 — promoteLocalToGlobal destroys groups, `or` conjunction and disabled conditions
- Status: ✅ DONE (2026-08-25) | Milestone: (next) | Priority: P1 | Complexity: S
- Found by audit-manager 2026-08-25. Pre-existing, NOT introduced by #123.
  `DashboardCanvas.svelte:108-113` overwrites `view.filter` with a flat
  `{ conjunction: "and", conditions: [...] }`. Three losses in one click on a FilterBridge chip:
  (a) `view.filter.groups` are erased; (b) an `or` conjunction is forced to `and`, inverting the
  filter's meaning; (c) `globalFilters` arrives already filtered by `enabled` (`View.svelte:251`),
  so every disabled condition is dropped from the saved filter. `handleViewFilterChange`
  (`View.svelte:233-235`) persists it without merging.
- Fixed by giving the canvas the whole definition instead of the enabled subset: `DataQueryResult`
  gained an additive optional `filter`, plumbed `View.svelte` → `dashboardView.onData` →
  `DashboardCanvas.globalFilter`. `promoteFilterTabToGlobal` now takes and returns a
  `FilterDefinition` and composes through the new shared `lib/engine/filterCompose.ts`, so an `or`
  filter is nested rather than appended to. Dedup runs against every stored condition, disabled
  ones included. The public `saveViewFilter` signature is unchanged — its "replace the filter"
  contract is correct; the bug was that the caller could not see what it was replacing.
- `andComposeFilters` moved out of `legacyMigration.ts` into `lib/engine/filterCompose.ts` rather
  than being copied: the #118 migration and this promotion now share one implementation of the
  or-nesting rule.

### #126 — ReDoS policy duplicated three times
- Status: ✅ DONE (2026-08-26) | Milestone: (next) | Priority: P2 | Complexity: XS
- `filterEvaluator.ts:239-253` carries byte-copies of the guard regexes and its own
  `MAX_REGEX_LENGTH`/`MAX_REGEX_INPUT` instead of using `lib/helpers/regexSafety.ts:7-15`;
  `extendedEvaluator.ts:712,721` hardcodes `pattern.length > 200` next to an import of
  `MAX_REGEX_INPUT_LENGTH`. Tightening `isUnsafePattern` would not reach the filter engine.
- Fixed: `regexSafety.ts` gained `MAX_REGEX_PATTERN_LENGTH`, and all four consumers
  (`filterEvaluator`, `extendedEvaluator`, `transformExecutor`, and the helper itself) now go
  through it. The guard regexes exist in exactly one file.
- The alternation gap (`^(a|a)+$` passes) is left open **deliberately** and documented at the
  constant: closing it naively would also reject `(cat|dog)+`, which users legitimately write in
  their own formulas. It needs a real analyser, not another regex — and it is now a one-file change.
- A test pins the single-implementation property. Note: its first version compared against an
  unescaped literal, so the three "no copy here" assertions passed against any file at all. The
  positive assertion caught it. A guard test that cannot fail is worse than none.

### #127 — FieldControl name heuristics: substring match inside the String branch
- Status: 📋 BACKLOG | Milestone: (next) | Priority: **P3** (downgraded from P2) | Complexity: XS
- **The original report was wrong and is corrected here.** audit-manager filed this as a direct
  violation of invariant 1, claiming a Number field named "Estimated time" would get a time input.
  It would not. Verified by walking the template's block nesting: `{:else if isImageField}` (:237)
  and `{:else if isTimeField}` (:257) sit at indent 4 **inside**
  `{:else if field.type === DataFieldType.String}` (:183, indent 2). A Number field reaches its own
  branch at :286. The heuristics are already gated by `DataFieldType`; dispatch is by type, and the
  name only refines within the correct type — which is exactly what the sanctioned
  `isColorFieldName` (UT2026-C) does two lines above, and which the same audit called legitimate.
- **What is actually true**, and all that is left: within the String branch the match is a
  substring, so a String field named "Icon type" gets the image control because "icon" appears in
  it. Cosmetic, same class as the accepted colour heuristic, no cross-type leakage.
- If it is worth fixing at all, the real mechanism already exists elsewhere: `field.typeConfig`
  (see `:294`, `field.typeConfig?.time` on Date fields). An explicit `typeConfig.format` for
  image/time strings would remove the guesswork — but that is schema evolution, needs a migration,
  and is disproportionate to a cosmetic mismatch.
- Lesson worth keeping: an audit finding is a lead, not a fact. This one was nearly implemented as
  filed.

### #128 — R_filterOrder.invariant.test.ts freezes the ADR in its pre-#118 wording
- Status: ✅ DONE (2026-08-26) | Milestone: (next) | Priority: P2 | Complexity: S
- The test asserts substrings in a markdown file, not a runtime invariant. It requires
  `FILTER_ORDER_ADR.md` to keep saying it "does not describe the current runtime wiring" — but
  #118 landed, so the ADR now cannot be brought in line with the code without breaking the test.
  `FILTER_MODEL.md` already states the order as fact, contradicting the ADR.
- Fixed: the ADR gained an "Implementation status" section describing the wired order, the
  conditional-scope nuance and the #132 gap, and the test now pins two separate things — that the
  ADR still STATES the contract, and that the code still WIRES it. The wiring assertions target the
  single line whose change silently undoes #118 (`executeTransform(scope.frame` vs `enrichedFrame`),
  plus `scopeApplied` and the block's selection-after-transform ordering.
- Verified the guard can actually fail: reverting the inversion in a scratch edit turned exactly
  that assertion red, then it was restored. A green guard that has never been shown to redden is
  not evidence.

### #129 — Dead files with no importers (~1940 LOC)
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P3 | Complexity: S
- Found by audit-manager 2026-08-25 via a full import scan: `lib/helpers/gestureHandler.ts` (465,
  superseded by `gestures/GestureCoordinator`), `ConditionalFormatBuilder.svelte` (624),
  `FieldSettingsPanel.svelte` (374), `FilterPanelVisual.svelte` (341 — another filter surface
  outside the model), `RecordCardView.svelte` (311), `keyboard/viewShortcuts.ts` (58),
  `modals/inspector.ts` (35), `Board/settings/settingsModal.ts` (38),
  `Gallery/settings/settingsModal.ts` (35), `Calendar/agenda/suggestionCollector.ts` (142),
  `Calendar/components/Calendar/Calendar.svelte` (29), `MonthHeader.svelte` (38). Also
  `YamlVisualizer.svelte`, retained per `view.ts:18-20` "for the upcoming widget" — that rationale
  expired when #120 confirmed `yaml-visualizer` as retired.

### #130 — i18n key sets diverge across locales
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P3 | Complexity: S
- `en` 1224 / `ru` 1266 / `uk` 1151 / `zh-CN` 1151. `ru` holds 42 `views.dashboard.table-v2.*` keys
  missing from `en` although the code uses them; `uk`/`zh-CN` lack 73 keys relative to `en`
  (`native-query.*`, `create-demo-project.*`). Nothing breaks — every call site passes
  `defaultValue` — but the canonical key set de facto lives in `ru.json`, not `en.json`.

### #131 — Docs drift: CLAUDE.md WidgetType block, table search surface, CHANGELOG
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P3 | Complexity: XS
- `CLAUDE.md:120-125` lists 12 WidgetTypes; the union has 16 (`types.ts:7-32` — missing `timeline`,
  `cover-banner`, `text`, `divider`). `tableCanon.ts:151-155` free-text table search is a filtering
  surface absent from `FILTER_MODEL.md` and the ADR. The #118 behavioral inversion is not in
  `CHANGELOG.md` / user-facing docs, though it changes a visible result for installed plugins.

### #132 — linked-source database-call skips the transform pipeline entirely
- Status: 📋 BACKLOG (Gate 0 done — plan refuted, redesign needed) | Milestone: (next) | Priority: P1 | Complexity: L
- Found by Codex cross-model review 2026-08-25. `WidgetHost.svelte:86` —
  `dbCallFrame = sourceConfig?.projectId ? rightFrames.get(...) ?? frame : transformedFrame`.
  A `database-call` widget with its own `sourceConfig.projectId` therefore renders the external
  frame with axis A and B applied but **axis C never runs**: `unnest`/`compute`/`filter` steps are
  silently inert, while the pipeline button stays available and the editor accepts steps. Predates
  #118 (`#092` bypassed pipeline counters for this path) but now directly contradicts
  `FILTER_ORDER_ADR.md` and the description of database-call as a self-contained query→display
  pipeline. Decide: run the pipeline on the external frame, or hide the pipeline entry for
  linked-source blocks. Silently accepting steps that never execute is the one option to rule out.
- **Gate 0, 2026-08-27 — the proposed fix was refuted before implementation.** Plan was Option A
  (run the pipeline on the external frame). Codex challenged the brief's equivalence claims:
  - *Claim "the axes depend only on the frame's fields, not its origin"* — **REFUTED**, and by our
    own code: `applyWidgetScope` moves axis A ahead of C only when every field the conditions name
    exists on that frame (`widgetScope.ts`). That conditional is precisely why two different
    sources are not interchangeable. The fix from the previous round is the counter-evidence to
    the new claim.
  - *Claim "an empty pipeline makes A a no-op"* — **partially true**; necessary, not sufficient.
    Axis A currently runs inside `DatabaseCallBlock` for this path, so moving it to the host is
    equivalent only if the host reproduces `applyWidgetScope` semantics including
    `scopeApplied=false`.
  - *Claim "no config combines linked-source with pipeline steps"* — **confirmed for the tracked
    repo** by full static search, and explicitly proves nothing about user vaults. Unconditional A
    would retroactively activate stored steps for an unknown number of users: the exact silent
    behavior change this milestone spent seven tickets removing.
- **Revised approach — versioned opt-in, not automatic migration.** A persisted marker
  (`transformExecution: "linked-source-v1"`); legacy `projectId + steps` without the marker keeps
  today's rendering, shows the stored steps as inert with an explicit "enable pipeline for the
  external source" action; only that action writes the marker. New linked-source blocks get it on
  first pipeline save. This is schema evolution — needs a migration and `configProvenance` no-op
  coverage — so complexity rises from M to **L**, and it needs its own design brief.
- Also required for any version of the fix: `PipelineEditor` must receive the resolved external
  frame, and `scopeApplied` must come from that frame's scope rather than `!dbCallUsesLinkedSource`.

### #133 — pipeline `group-by` and view-level `groupBy` are different operations with the same name
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P2 | Complexity: M
- `executeGroupBy` (`transformExecutor.ts:682`) collapses the frame to one record per group and
  adds `_group_size` — an aggregation. `DataTableConfig.groupBy` sections the original records and
  changes no row count — presentation. The names invite exactly the mistake #118 made: its
  migration moved one into the other, turning two aggregated rows into three rows in two sections
  and persisting that on open. Removed in the same milestone once Codex identified it.
- Two things worth doing: rename one of them so the distinction is visible at the call site, and
  consider offering a real presentation-only "group rows" operation so the pipeline `group-by` is
  not what users reach for when they want sections.

### #134 — Rebuild the demo project as an investor-grade product tour
- Status: 📋 BACKLOG | Milestone: (after the current cycle) | Priority: P1 | Complexity: XL
- Requested 2026-08-26. The demo project auto-created on first open must become a **complete,
  presentable tour of the product** — something an investor or a first-time user can open and see
  what the plugin actually does, covering the whole feature surface rather than a slice of it.
- **Where it lives:** `src/ui/app/onboarding/demoProject.ts` (641 LOC). This is generated in CODE
  at onboarding time. It is NOT the user's `OBStests/Projects Plus - Демо/` vault folder — edits
  belong in the generator, never in a stored `data.json`.
- **Current coverage is narrow.** Four entities (Clients / Projects / Tasks / Meetings) and only
  three widget types out of the sixteen in the union: `chart`, `stats`, `database-call`. Nothing
  exercises relations end-to-end, rollups, the formula stack (115+ functions), filter-tabs, the
  advanced transform pipeline, Board/Calendar/Gallery views, conditional formatting, grouping, or
  the cover banner. A tour that shows a fifth of the product undersells it.
- **Requirements to design against:**
  - Every shipped capability appears at least once, in a place where it reads as useful rather
    than as a demo of itself.
  - The narrative works top to bottom: someone opening it for the first time should understand
    the product without a guide.
  - It must survive the invariants the rest of the codebase is held to — in particular the
    schema-evolution rule: the generator emits the CURRENT schema and its output must pass
    migrations as a no-op (`configProvenance.test.ts`).
  - It must not depend on the network. 14 cover images are currently fetched from Unsplash by URL;
    an investor demo that renders broken images offline is worse than one with no images.
- **Blocked on:** the current cycle finishing, so the feature surface it advertises is the one that
  actually exists (the A→C→B order, the filter model, the relation contract).
- Needs a design brief with equivalence claims and Gate 0 before implementation — XL, user-facing,
  and it generates stored data.

### #135 — External review of the codebase
- Status: 📋 BACKLOG | Milestone: (after the current cycle) | Priority: P2 | Complexity: M
- Requested 2026-08-26. Bring in review from outside the two-model loop.
- Rationale: Claude and Codex now cross-check each other (`TWO_MODEL_PROTOCOL.md`), and that
  already caught defects four green gates and two in-house audits had missed. But both are models
  reading the same repository under similar framings. An outside reviewer — human, or a different
  toolchain — sees a third class of problem: whether the product makes sense at all, whether the
  architecture would be legible to a new maintainer, whether the invariants are the right ones.
- Scope to decide when it is scheduled: whole codebase, or the engine layer plus the public
  surfaces (`customViewApi.ts`, settings schema, plugin manifest).
- Sequencing note: worth doing before #134 ships publicly, since a demo aimed at investors makes
  the codebase's public surfaces visible in a way they are not today.

### #136 — linked-source block silently renders the WRONG project's records
- Status: 📋 BACKLOG | Milestone: (next) | Priority: **P1** | Complexity: M
- Found by Codex during Gate 0 on #132, 2026-08-27. `WidgetHost.svelte:86`:
  `rightFrames.get(projectId) ?? frame` — when the external frame has not resolved (still loading,
  project renamed, deleted, permission), the block falls back to the **parent project's frame** and
  renders it with no indication. The user sees plausible records from a different project and has
  no way to tell.
- A fallback is not a loading state. This needs an explicit loading/error state, or a strictly
  defined and tested fallback semantic — not a silent substitution.
- Compounds #132: if the pipeline is ever enabled for this path, it would also run the transform
  over the foreign data.

### #137 — PipelineEditor is configured against the parent frame, not the block's own source
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P2 | Complexity: M
- Found by Codex during Gate 0 on #132. `WidgetHost.svelte:200-201` passes `fields={frame.fields}`
  and `source={frame}` unconditionally. For a `database-call` with its own `sourceConfig.projectId`
  the editor therefore offers the **parent project's** fields and sample data — a user can build a
  step referencing a field that does not exist in the source the block actually reads.
- Separately, the editor's live counters run steps without `rightFrames`
  (`PipelineEditor.svelte:62,69`), so a `join` preview does not match runtime even today.
- Blocks #132: enabling axis C on this path while the editor lies about the fields would let users
  build pipelines that cannot work.

### #138 — external frames never get backlink enrichment
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P2 | Complexity: M
- Found by Codex during Gate 0 on #132. Two paths, both missing it:
  - Fallback path: `WidgetHost.svelte:86` selects the raw `frame`, not `enrichedFrame`, so
    `enrichWithBacklinks` (`relationResolver.ts:191,227` — adds the derived `*_backlinks` field) is
    skipped.
  - Normal external path: the preloader stores what `api.resolveExternalFrame` returns
    (`DashboardCanvas.svelte:102-104`), and the resolver returns a raw `queryAll()`
    (`externalFrameResolver.ts:52,60`). `View.svelte:141` enriches the parent's cross-project
    relations, but that is `enrichFrameWithAllRelations` producing `__resolved__…` — a different
    mechanism, not backlinks.
- Consequence: a relation-driven view over an external source is missing derived backlink fields
  that the same view would have over the parent project.

# Project Backlog — obs-projects-plus

> **Plugin version**: see `package.json` (currently `3.5.1-alpha`)
> **Updated**: 2026-05-19 (synced with `.ai_internal/New-specification/BACKLOG.md` — git-tracked file is now the single source of truth)
> **Supersedes**: `REFACTOR_BACKLOG_V5.md` (legacy, archived); `.ai_internal/New-specification/BACKLOG.md` (working copy, archived)

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

## Milestone M-TABLE-REWRITE — 📋 BACKLOG

### #001 — Replace legacy DataGrid with Dashboard DataTable widget
- Status: 📋 BACKLOG
- Milestone: M-TABLE-REWRITE | Priority: P1 | Complexity: L
- analysis_required: false  ← scope confirmed: TableView.svelte = 424 LOC
- Depends on: #005, #008, #014
- Blocks: #009

Files:
- delete `src/ui/views/Table/TableView.svelte` (~424 LOC) + `src/ui/views/Table/tableView.ts`
- remove remap in `src/ui/app/useView.ts`
- finalize `src/ui/views/Dashboard/widgets/DataTable/` (column virtualization, group headers)

### #004 — Fix footer aggregation `count` semantic divergence
- Status: ⏸ DEFERRED → after #001
- Milestone: M-TABLE-REWRITE | Priority: P1 | Complexity: S
- analysis_required: false
- Depends on: #001

---

## Milestone M-SUBBASES — 📋 BACKLOG

### #009 — Sub-base canvas (Matryoshka first deliverable)
- Status: 📋 BACKLOG
- Milestone: M-SUBBASES | Priority: P2 | Complexity: XL (~1500 LOC)
- **analysis_required: true**
- **analysis_done: false**
- Depends on: #001, #008, #013

### #010 — Bidirectional relations + rollups across sub-bases
- Status: 📋 BACKLOG
- Milestone: M-SUBBASES | Priority: P2 | Complexity: XL (~800 LOC)
- **analysis_required: true**
- **analysis_done: false**
- Depends on: #009, #016

---

## Milestone M-YAML-FORMULA-UI — 📋 BACKLOG

### #003 — Merge Calendar agenda filterEngine into filterEvaluator
- Status: 📋 BACKLOG
- Milestone: M-YAML-FORMULA-UI | Priority: P1 | Complexity: M
- analysis_required: false
- Depends on: #002

### #002 Phase 2 — Move `evaluateValue` to `lib/formula/index.ts`
- Status: ⏸ DEFERRED to M-YAML-FORMULA-UI
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: M
- analysis_required: false

### #022 — UnifiedFormulaConstructor (replace AST node system in FormulaVisualEditor)
- Status: 📋 BACKLOG
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: XL
- **analysis_required: true**
- **analysis_done: false** ← FORMULA_CONSTRUCTOR_AUDIT_2026-05-08.md is a partial start, not sufficient
- Depends on: #002 Phase 2

Analysis needed: Full deletion scope of FormulaVisualEditor.svelte, AdvancedFilterEditor.svelte
as gold-standard baseline UX, keyboard spec (Ctrl+Space, Tab/Enter, Esc), portal pattern
for overflow escape.

### #011 — Move YAML Visualizer into Dashboard widget
- Status: 📋 BACKLOG
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: S
- analysis_required: false
- Depends on: #001

### #012 — Replace Obsidian Properties pane with YAML Visualizer
- Status: 📋 BACKLOG
- Milestone: M-YAML-FORMULA-UI | Priority: P2 | Complexity: M
- analysis_required: false
- Depends on: #011

---

## Milestone M-DATAVIEW-BRIDGE — 🗓 PLANNING

Full Dataview adaptive bridge — begins after M-SUBBASES is complete.
Plan: `docs/internal/DATAVIEW_ABSORPTION_PLAN.md`

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
- Status: 📋 BACKLOG | Milestone: M-FREE-CANVAS | Priority: P1 | Complexity: M
- **analysis_required: true** | analysis_done: false
- Depends on: #032 (✅)

Analysis needed: enumerate all readers/writers of `WidgetLayout.{x,y,w,h}`. Define migration
function `migrateLayoutV1ToV2(widget) → widget` invoked once via `layoutVersion` bump.

### #036 — Mobile interaction spec + implementation
- Status: 📋 BACKLOG | Milestone: M-FREE-CANVAS | Priority: P2 | Complexity: M
- **analysis_required: true** | analysis_done: false
- Depends on: #032 (✅)

Analysis needed: gesture model for pan/zoom/resize on touch, persistent toolbar density,
fallback for drag-handle hit area (≥44px), bottom-sheet popup under iOS Safari.

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
- Status: 📋 BACKLOG (вероятно частично закрыт через #032.3 WindowShell drag/resize)
- Milestone: M-V35-HOTFIX-UX | Priority: P1 | Complexity: M
- analysis_required: false (нужна проверка после #032)

### #040 — Widget settings popup hides data access / aggregation info
- Status: ✅ DONE — #040.1 slot API в #034.1 (`8f6b6f0`); #040.2 consumer wiring в #034.3 (`0ed8367` "Merge feat/034.3: WidgetInlineBadges + #040 close")
- Milestone: M-V35-HOTFIX-UX (Strategy: DEMOLISH — поглощён #034) | Priority: P1 | Complexity: M

### #041 — Widget toolbar overflow / clipping
- Status: ✅ DONE (локально, не запушено) — merged via `92554f5` "Merge fix/041"
- Milestone: M-V35-HOTFIX-UX | Priority: P2 | Complexity: S

Фикс в `src/ui/components/Navigation/ViewSwitcher.svelte`: `flex: 1 1 auto` активирует
overflow handling tab strip (commit `8e22ec1`).

### #042 — Project title row clipped at top
- Status: 📋 BACKLOG | Milestone: M-V35-HOTFIX-UX | Priority: P2 | Complexity: XS

### #043 — Demo project uses outdated/irrelevant configs
- Status: 📋 BACKLOG (Strategy: REGEN vault data, не код) — блокирует Phase 1 #016 repro
- Milestone: M-V35-HOTFIX-UX | Priority: P1 | Complexity: M

---

## Milestone M-INTERACTIVE-DASHBOARD — 🔄 ACTIVE (Phase 5, 2026-05-19)

> Goal: turn static-render canvas into interactive. Clicks on data-bearing widgets
> (Chart segments, DataTable rows) become *selections* that narrow visible data in
> sibling widgets on the same canvas. Selection lives in a per-canvas Svelte context
> store; no global state.

### #044 — Cross-widget interactive filtering
- Status: 🔄 IN-PROGRESS — #044.1 + #044.2 merged; #044.3a awaiting merge; #044.3b/4/5 backlog
- Milestone: M-INTERACTIVE-DASHBOARD | Priority: P2 | Complexity: L (~1120 LOC across 5 sub-PRs)
- Strategy: BUILD (new feature)
- analysis_required: true | **analysis_done: true** (spec `.ai_internal/New-specification/CROSS_WIDGET_SPEC.md` v1.0)
- Depends on: #032 (✅), #034.1 (✅), #040.1 (✅)
- Spec: `.ai_internal/New-specification/CROSS_WIDGET_SPEC.md`

#### Sub-PR status
- **#044.1** ✅ DONE — `selectionStore.ts` + `composeEffectiveFilter()` + DashboardCanvas `setContext` wiring + unit tests. Merge `d9323ec`.
- **#044.2** ✅ DONE — ChartWidget driver, 7 chart types, bar/pie click → `setSelection`, active/dimmed segment styling. Merge `15910cb`.
- **#044.3** — split into 3a (receiver) + 3b (driver).
  - **#044.3a** 🔄 READY FOR MERGE — Receiver only: `dataTableSelectionReceiver.ts` (101 LOC pure helper) + DataTableWidget receiver wiring + per-row `highlighted`/`dimmed` flags propagated through `DataGrid` → `GridRow` → `GridCellGroup`. Self-skip rule via `dataTableSourceId(myWidgetId)`. Hidden rows preserved (geometry intact, per spec §5.2). Branch: `feat/044.3a-datatable-receiver`. Audit verdict: ✅ READY (audit-manager 2026-05-19). Gates: tsc 0 errors, Jest 130 suites / 1942 tests PASS, PX-budget 191/191, build OK. **Reality vs label**: WIP commit message says "NOT FINISHED" but code is production-ready — receiver scope completed; driver scope explicitly split out as #044.3b. Awaiting user merge (agents do not merge into main).
  - **#044.3b** 📋 BLOCKED (`analysis_required: true, analysis_done: false`) — Driver (UX design needed). Adding row-click driver semantics conflicts with inline-cell editing. Requires UX decision: (a) modifier-click (Alt/Shift), (b) gutter row-marker affordance, (c) context-menu "Filter canvas by this row". Output: spec amendment to `CROSS_WIDGET_SPEC §5.2`, then ~120 LOC driver impl.
- **#044.4** 📋 BACKLOG — StatsWidget receiver: recompute aggregates over `effectiveFilter`; "filtered" dot. Target: ~120 LOC. **Not blocked** — can proceed.
- **#044.5** 📋 BACKLOG — `SelectionBadge.svelte` (`_shared/`) + WindowShell badge wiring + Escape + click-outside-canvas → `clearSelection`. Target: ~250 LOC. **Not blocked** — depends on #034.1 (✅).

#### Invariants (from #016 lesson)
- Selection writes carry a `source` discriminator; driver/receiver hybrids self-skip via `composeEffectiveFilter({myWidgetId})`.
- `setSelection()` is no-op on shallow-equal payload (idempotence).
- `composeEffectiveFilter()` is pure; receivers never write to the store from a reactive block.
- No new code path inside `filterEvaluator.ts` — selection is an extra layer that appends a `FilterCondition` through the canonical engine. **Exception**: DataTable receiver (#044.3a) intentionally bypasses filterEvaluator and uses `computeMatchingRowIds` to decorate rows (geometry preservation per spec §5.2).

#### Out of scope (v2 — see spec §9)
- Multi-select (Cmd-click, range select), brush-range on line/area charts
- Cross-provider selection broadcast, StatsCard as driver, persistence across tab switches

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

## Dependency graph

```
M-ENGINE-CLEANUP ✅, M-COLOR-SETTINGS ✅:
#014 ✅ ──► #002 Ph1 ✅ ──► #003 (calendar filter)
                       └──► #013 (canvas split, BACKLOG) ──► #009 ──► #010
#007 ✅  #006 ✅  #015 ✅  (independent, all done)
#005 ✅ ──► #008 ✅ ──► #001 ──► #009
                          └──► #011 ──► #012

M-CANVAS-REACTIVE: #016 ✅ DONE (Phase 1 closed); #031 ✅ DONE (Phase 2 closed)

M-FREE-CANVAS (Phase 3, Dashboard V3):
#030 ✅ ──► #032 ✅ ──┬──► #033 (BACKLOG)
                    └──► #036 (BACKLOG, NEEDS-ANALYSIS)

M-POPUP-STANDARDISATION (Phase 4): #034 ✅ DONE, #040 ✅ DONE

M-INTERACTIVE-DASHBOARD (Phase 5):
#044.1 ✅ ──► #044.2 ✅
         └──► #044.3a 🔄 (audit PASS, awaiting merge) ──► #044.3b (NEEDS-ANALYSIS)
         ├──► #044.4 (BACKLOG, unblocked)
         └──► #044.5 (BACKLOG, unblocked, depends on #034.1 ✅)

M-V35-HOTFIX-UX:
#037 ✅ DECIDED ──► unblocked #032 ✅
#038 ✅, #041 ✅ — merged locally
#039 (BACKLOG, может быть закрыт через #032.3), #042 (BACKLOG), #043 (REGEN, blocks #016 repro)

Unrelated to git push: 34 commits ahead of origin/main not yet pushed (user-driven action).
```

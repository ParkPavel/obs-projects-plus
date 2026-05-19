# Project Backlog — obs-projects-plus

> **Plugin version**: see `package.json` (currently `3.5.1-alpha`)
> **Updated**: 2026-05-14
> **Supersedes**: `REFACTOR_BACKLOG_V5.md` (legacy, archived)

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
- Status: 🔄 IN-PROGRESS (branch: `feat/R5-016-reactive-loop`)
- Milestone: M-CANVAS-REACTIVE | Priority: **P0** | Complexity: S
- analysis_required: true
- **analysis_done: true** ← ANALYTICAL_REVIEW_2026-05-08.md
- Depends on: #013
- Blocks: #010

Problem: `invalidateTransformCache()` exists in `transformCache.ts` but is NOT called
from vault event handlers. Dashboard renders once on open and becomes a static snapshot.

Root cause:
```
vault.on("modify") → DataFrameProvider.refresh() ✅ → DataFrame rebuild ✅
    → transformCache.get(key) ❌ (returns stale TTL=5min result)
        → Dashboard does not update ❌
```

Files:
- `src/ui/views/Dashboard/engine/transformCache.ts` — add `invalidate(projectId)` + `invalidateAll()`
- `src/ui/app/DataFrameProvider.svelte` — call `invalidate(projectId)` in `refresh()`
- `src/ui/views/Dashboard/DashboardCanvas.svelte` — add `isRecalculating` indicator
- `src/lib/datasources/folder/datasource.ts` — verify chain `onVaultChange → refresh`

AC: Modify source file → Dashboard updates in ≤500ms, no manual action required.

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

## Dependency graph

```
#014 ✅ ──┬──► #002 Ph1 ✅ ──► #003 (calendar filter)
          │               └──► #013 (canvas split) ──► #009 ──► #010
          │                          ↑
#016 (P0) ─────depends on────────────┘
          └──blocks──► #010

#007 ✅  #006 ✅  #015 ✅  (independent, all done)

#005 ✅ ──► #008 ✅ ──► #001 ──► #009
                          └──► #011 ──► #012
```

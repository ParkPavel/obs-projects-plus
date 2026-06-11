# Project Backlog — obs-projects-plus

> **Plugin version**: see `package.json` (currently `3.5.1-alpha`)
> **Updated**: 2026-06-10 (#050–#058 added — M-UI-MODERNIZATION: полный рефакторинг Dashboard UI; Phase 4.5 ✅ DONE multi-select Selection Bus; baseline 134/2020)
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
- Status: ⚠️ PARTIAL (2026-06-10) — WidgetShell.svelte (161 LOC) + WidgetHeaderActions.svelte (80 LOC) созданы; интеграция в WidgetHost не выполнена (dead code); WidgetHost остаётся 947 LOC
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
- Status: 📋 BACKLOG
- Milestone: M-UI-MODERNIZATION | Priority: P1 | Complexity: XL
- analysis_required: true | analysis_done: false
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

### #061 — Template Library: 3 starter profiles (clients / fitness / journal)
- Status: 📋 BACKLOG
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: L
- analysis_required: true | analysis_done: false
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
- Status: 📋 BACKLOG (требует решения)
- Milestone: M-VISION-PARITY | Priority: P2 | Complexity: XL
- analysis_required: true | analysis_done: false
- Depends on: none

**Vision §8**: "Сам дашборд — тоже markdown-файл. Не закрытая конфигурация в JSON, а читаемая, версионируемая, синхронизируемая через git заметка."

**Текущая реальность**: Dashboard конфигурация живёт в `data.json` (ProjectDefinition schema v4) — непрозрачный JSON, не открывается в Vim с понятной структурой.

Требует принятия решения:
- Option A: Миграция ProjectDefinition → YAML frontmatter в специальном `.md` файле проекта
- Option B: Zафиксировать осознанный компромисс: data.json остаётся до V3, с обоснованием (backward compat, performance, complexity)
- Option C: Human-readable JSON с комментариями + schema documentation

Это архитектурное решение, влияющее на всю систему. Требует dedicated analysis session.

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

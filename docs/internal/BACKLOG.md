# Project Backlog — obs-projects-plus

> **Plugin version**: see `package.json` (currently `3.5.1-alpha`)
> **Updated**: 2026-08-30 (#164 closed on a live run; the stack is merged and pushed) — filed #141–#170: Codex meta-audit + render pass (see the section at the end of this file; findings in `CODEX_META_AUDIT_FINDINGS_2026-08-27.md`). live API run against the OBStests vault (#162–#164), and the Notion reference analysis (`M-MATRYOSHKA`, #165–#170). Baseline numbers live in `CONTEXT.md`, not here.

> **О статусах ниже по файлу (§2.4 пред-релизного аудита, исправлено 2026-08-31).**
> Десяток тикетов лета несёт пометки вида «НЕ слит/запушен — гейт пользователя». **Все они
> историчны.** `main` содержит всё: M-RELATION-FIRST, M-FILTER-CONSOLIDATION, стек мета-аудита
> #141–#164 и работы #171–#177, и с 2026-08-30 репозиторий запушен, а версия выпущена как
> `3.6.0-alpha`. Проверять «слито ли» надо через `git merge-base --is-ancestor <sha> main`, а не
> по этим строкам.
> Выборочная проверка: `9cb69ec` (#095) — в `main`; `065331e`, на который ссылается #096, **в
> репозитории не существует вовсе** — ветка удалена либо хеш записан с ошибкой, установить это
> уже нельзя. Ссылки на коммиты в старых записях следует считать непроверенными, пока не проверены.
> Прежняя редакция этой шапки называла дрейф «не фактом» и отсылала к #146; #146 закрыт, а тело
> файла осталось прежним — поэтому здесь теперь правило, а не предупреждение. Prior W2/W3 queue is historical, superseded by the product reset.
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
- Vision scene:       1–8, or "none — maintenance"   ← required for product tickets
- User outcome:       what the person can do afterwards that they could not before
```

**Why the last two fields exist (#154).** `PRODUCT_RESET` §6 has required a scene reference and a
checkable user outcome since 2026-07-18, but the template carried neither, so the rule was
unenforceable: of 128 ticket sections written under it, 8 mentioned a scene at all. A rule that
lives only in prose is a rule nobody can follow by filling in the form.

`Vision scene: none — maintenance` is a legitimate answer — a crash fix owes no scene. What is not
legitimate is leaving the field out: that is how "fixed a crash" and "the user understood the flow"
got recorded as the same kind of progress.

**Not enforced by a test, deliberately.** A ratchet over the whole file would fail on 120 historical
tickets, and rewriting their scene references after the fact would invent intent nobody had. The
fields are enforced going forward by being in the template, the same way the four gates are.

> **NEEDS-ANALYSIS gate**: if `analysis_required: true` and `analysis_done: false`,
> the orchestrator must run a dedicated analytics session before any dev work starts.

---

## Milestone M-FILTER-CONSOLIDATION — ✅ COMPLETE, merged in `64863ed` (2026-08-27)

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

## Milestone M-RELATION-FIRST — ✅ code merged in `64863ed`; user acceptance OPEN (#158)

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
- Status: ✅ DONE — `relationContract.ts` shipped and merged in `64863ed` (status corrected 2026-08-27 by #146)
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

## Milestone M-SUBBASES — ⛔ ОТОЗВАНА (2026-08-31)

Goal (историческая формулировка): Matryoshka-style nested canvases with cross-base data flow.

> **Веха отозвана, а не выполнена.** Виджет `SubBaseCanvas` удалён в #119, модель целиком —
> в #160 (`subBase.ts`, `subBasePartition.ts`, `crossSubBase.ts` и их сюиты), команда
> `add-sub-base` снята и подтверждена отсутствующей живым прогоном (10 команд вместо 11).
> В типе намеренно оставлены ключи `DataTableConfig.subBases`: 3.5.0-alpha (`2af8a50`)
> **поставляла** виджет, который их писал, и удаление полей сделало бы существующие данные
> немоделируемыми. Они переносятся, но не интерпретируются.
> Замена проектируется с нуля как адресуемая сущность — `M-SAVED-SELECTION`, решение #147, бриф
> #159 (дважды отклонён на Gate 0). Записи ниже сохранены как история поставки, не как статус.

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
- Status: ✅ DONE (2026-08-27) | Milestone: (next) | Priority: P3 | Complexity: S
- Found by audit-manager 2026-08-25 via a full import scan: `lib/helpers/gestureHandler.ts` (465,
  superseded by `gestures/GestureCoordinator`), `ConditionalFormatBuilder.svelte` (624),
  `FieldSettingsPanel.svelte` (374), `FilterPanelVisual.svelte` (341 — another filter surface
  outside the model), `RecordCardView.svelte` (311), `keyboard/viewShortcuts.ts` (58),
  `modals/inspector.ts` (35), `Board/settings/settingsModal.ts` (38),
  `Gallery/settings/settingsModal.ts` (35), `Calendar/agenda/suggestionCollector.ts` (142),
  `Calendar/components/Calendar/Calendar.svelte` (29), `MonthHeader.svelte` (38). Also
  `YamlVisualizer.svelte`, retained per `view.ts:18-20` "for the upcoming widget".
- **Two of the thirteen were kept — the audit checked imports, not plans.** "No importer" answers a
  different question from "nothing depends on this":
  - `lib/helpers/gestureHandler.ts` — **#036** (Mobile interaction spec, open) plans to convert it
    from reference to production (`createTouchDragHandler`, `isCoarsePointer` store).
  - `RecordCardView.svelte` — **#082** (typed record card, open) names it as the foundation of the
    design that superseded #011/#012.
  Both now carry a `RESERVED, NOT DEAD` header so a fourth sweep does not re-file them.
- **A third near-miss:** the whole `YamlVisualizer/` directory looked deletable, but
  `RelationListView.svelte` inside it is imported by `GridRelationCell.svelte`. Only
  `YamlVisualizer.svelte` and its private `types.ts` went; the directory stays.
- Deleted 12 files. `view.ts`'s retention comment for YamlVisualizer is now stale and should be
  cleaned when that file is next touched — #011/#012 are SUPERSEDED and #082 explicitly takes the
  non-widget route.

### #130 — i18n key sets diverge across locales
- Status: ✅ DONE (2026-08-27) — en/ru aligned; uk/zh-CN deliberately left to fall back | Milestone: (next) | Priority: P3 | Complexity: S
- `en` 1224 / `ru` 1266 / `uk` 1151 / `zh-CN` 1151. Two different problems were filed as one.
- **Fixed — `en` was missing 42 keys that `ru` had.** English text was not lost: every call site
  passes it positionally as `t("key", "English")`, or as `def:` in `VIEW_TYPE_LABELS`. But that put
  the canonical English in *component code* while `ru.json` held the canonical key set — backwards.
  All 42 extracted from their call sites into `en.json`; `en` and `ru` now have identical key sets
  (1266 each, zero divergence either way).
- **Not fixed, deliberately — `uk`/`zh-CN` lack 115 keys.** The i18n config falls back to `en`
  (`i18n.ts:104-109`, `default: ["en"]`), so those keys render correct English today. Filling them
  with machine translation would replace correct English with unreviewed Ukrainian and Chinese —
  strictly worse for a user of those locales. Proper translation needs a speaker; filed as **#140**.
- Note on the diff: `en.json` gained 48 lines and lost 2. One deleted line is a trailing-comma
  change; the other re-writes `⭐` as a literal `⭐`, which is the same JSON. The file's own
  escaping convention was already inconsistent.

### #131 — Docs drift: CLAUDE.md WidgetType block, table search surface, CHANGELOG
- Status: ✅ DONE (2026-08-27) | Milestone: (next) | Priority: P3 | Complexity: XS
- `CLAUDE.md:120-125` listed 12 WidgetTypes; the union has 16. Rewritten to split live from retired
  and to say *why* the retired seven stay — the union describes the STORED format, so dropping one
  makes a saved widget unmodellable (#120). Points at `isRetiredLegacyType` as the authority rather
  than being a list that can drift again. Verified both directions: nothing in the doc that is not
  in the code, nothing in the code that is not in the doc.
- `tableCanon.ts` free-text search added to `FILTER_MODEL.md` under "Outside this model", with the
  point that matters in practice: it is the one row-removing surface the "what affects what" table
  does not account for, so it is the first thing to check when someone asks why a row is missing.
- `CHANGELOG.md` gained the #118 behavior-change notice under Unreleased → Changed: filtering order
  inverted, stored data unaffected, migration described, docs linked.
- **Noted, not changed:** the CHANGELOG's `Test gate: 102 suites / 1650 tests` line is a fifth
  generation of stale baseline, but a changelog recording the gate at a point in time is history
  rather than drift. R0.7 deliberately does not scan it.

### #132 — linked-source database-call skips the transform pipeline entirely
- Status: 📋 BACKLOG (Gate 0 done — plan refuted, redesign needed) | Milestone: (next) | Priority: P1 | Complexity: L
- **Design:** `docs/internal/LINKED_SOURCE_DESIGN.md` — one decision for all four, grounded in
  `specs/NOTION_DM_RESEARCH.md`. Order: #138 → #136 → #137 → #132.
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
- Status: ✅ DONE (2026-08-27) | Milestone: (next) | Priority: **P1** | Complexity: M
- **Design:** `docs/internal/LINKED_SOURCE_DESIGN.md` — one decision for all four, grounded in
  `specs/NOTION_DM_RESEARCH.md`. Order: #138 → #136 → #137 → #132.
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
- Status: ✅ DONE (2026-08-27) | Milestone: (next) | Priority: P2 | Complexity: M
- **Design:** `docs/internal/LINKED_SOURCE_DESIGN.md` — one decision for all four, grounded in
  `specs/NOTION_DM_RESEARCH.md`. Order: #138 → #136 → #137 → #132.
- Found by Codex during Gate 0 on #132. `WidgetHost.svelte:200-201` passes `fields={frame.fields}`
  and `source={frame}` unconditionally. For a `database-call` with its own `sourceConfig.projectId`
  the editor therefore offers the **parent project's** fields and sample data — a user can build a
  step referencing a field that does not exist in the source the block actually reads.
- Separately, the editor's live counters run steps without `rightFrames`
  (`PipelineEditor.svelte:62,69`), so a `join` preview does not match runtime even today.
- Blocks #132: enabling axis C on this path while the editor lies about the fields would let users
  build pipelines that cannot work.
- **Fixed.** The host derives `pipelineSource` — the external frame for a linked block, otherwise
  `scope.frame`, which is what `executeTransform` actually receives — and hands it to the editor as
  both `fields` and `source`. The editor also receives `rightFrames`, so a `join` step's live
  counter executes the same way the runtime does; without it the preview resolved no right frame
  and quietly reported different numbers than the widget behind the popup.
- When the source is not ready there is no schema to configure against, so the editor says so
  instead of falling back to the parent's fields.
- Two pure narrowing helpers (`asChartConfig`, `asStatsConfig`) moved out of `WidgetHost` into
  `linkedSourceState.ts` to make room inside the 240-line budget. The budget was not raised.

### #138 — external frames never get backlink enrichment
- Status: ✅ DONE (2026-08-27) | Milestone: (next) | Priority: P2 | Complexity: M
- **Design:** `docs/internal/LINKED_SOURCE_DESIGN.md` — one decision for all four, grounded in
  `specs/NOTION_DM_RESEARCH.md`. Order: #138 → #136 → #137 → #132.
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
- **Fixed at `externalFrameResolver`**, not the canvas preloader or the host: `App` already caches
  the resolver's promise per project id, so enrichment costs once per source rather than once per
  canvas or once per widget.
- **Collision guard added to `enrichWithBacklinks` — a separate data-safety fix.** The function
  appended `<relation>_backlinks` without checking and clobbered any same-named stored value through
  the `...extraValues` spread. A vault is free to have a real frontmatter property with that name,
  and it was being destroyed. Colliding relations are now skipped with a warning; the rest still
  enrich. Flagged by Codex at Gate 0 as claim 3, which said enrichment was additive — it was not.
- **`join` output schema widens, deliberately.** `join` copies every right-frame field except the
  key into its output, so enriching right frames adds the derived backlink fields there too.
  Recorded with a regression test rather than left to be discovered.

### #139 — external-source block writes to the PARENT project
- Status: ✅ DONE (2026-08-27) — read-only guard shipped; source-specific write API still open | Milestone: (next) | Priority: **P1** | Complexity: M
- Found by Codex at Gate 0 on the linked-source brief, 2026-08-27. Verified against the code.
- A `database-call` block with its own `sourceConfig.projectId` reads the external project but
  receives the **parent** dashboard's `api` and `project` (`widgetComponentRegistry.ts:145`).
  Consequences: "Add first record" on an empty external source creates the note in the parent
  project (`DatabaseCallBlock.svelte:196`), and row edits go through the parent's api
  (`DataTableContent.svelte:126`).
- Worse than the display defects #136-#138 because it **writes**. A user looking at project B's
  records adds a record and it lands in project A, with no indication.
- **Guard shipped 2026-08-27.** New `sourceReadOnly` prop on `DatabaseCallBlock`, fed from
  `dbCallUsesLinkedSource` through the registry. Record creation is gated on it, and all three view
  components (`DataTableContent`, `BoardView`, `CalendarView`) receive `readonly || sourceReadOnly`
  so row edits are disabled.
- **Deliberately NOT reusing the dashboard-level `readonly` flag.** That one also gates CONFIG
  edits — adding a view tab, editing the block filter — and those legitimately belong to the parent
  dashboard, which is where they are stored. Forcing `readonly` on would have broken configuring a
  linked block to fix a data problem that has nothing to do with configuration.
- Still open: a source-specific write API, so an external block can write where it reads instead of
  being read-only. Tracked in `LINKED_SOURCE_DESIGN.md` under what the brief does not decide.
- Design: `docs/internal/LINKED_SOURCE_DESIGN.md` (revision 2).

### #140 — uk / zh-CN locales lack 115 keys
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P3 | Complexity: S
- Split out of #130 on 2026-08-27. `uk` and `zh-CN` hold 1151 keys against `en`'s 1266.
- **Not a functional defect.** `i18n.ts:104-109` sets `default: ["en"]`, so a missing key renders
  correct English rather than a raw key.
- **Deliberately not machine-translated.** Replacing correct English with unreviewed Ukrainian or
  Chinese is worse for a speaker of those languages than the fallback is. This needs a translator,
  not a sweep — which is why it is a separate ticket rather than a loose end in #130.
- The missing sets are dominated by `native-query.*`, `create-demo-project.*`, and the 42
  `table-v2.*` / `database-call.*` keys that #130 added to `en`.

---

## Codex meta-audit + render pass 2026-08-27 — #141–#158

> **Basis:** `CODEX_META_AUDIT_2026-08-27.md` (5 брифов) + `CODEX_RENDER_TASKS_2026-08-27.md`
> (4 брифа), отчёты в `codex-reports/CX-A…E.md` и `CX-R1…R4.md`, сведение и перепроверка в
> `CODEX_META_AUDIT_FINDINGS_2026-08-27.md`.
> **Что это было:** проверка всех текущих решений на соответствие исходному эссе
> `DASHBOARD_V2_VISION.md`, затем реконструкция экранов из кода вместо ручной приёмки —
> тикеты на визуальный тест ещё не написаны, поэтому #158 отложен, а его роль временно
> исполняет рендер-проход.
> **Каждая находка ниже перепроверена по коду** отдельно от отчёта Codex. Находки, которые
> не подтвердились или оказались слабее заявленного, в тикеты не попали и записаны в findings
> как смягчения.

### Порядок разработки (2026-08-27)

Очередь построена по одному правилу: **сначала то, без чего следующее решение принимается вслепую.**

1. **#141 ✅, #142 ✅, #144 ✅, #145 ✅, #146 ✅** — сделано. Это фундамент: считающийся rollup,
   запись, которая не врёт об успехе, обратимая миграция и документы, совпадающие с кодом.
2. **#143 — inverse relation (решение пользователя).** Стоит первым из открытого, потому что от
   него зависит #159 (может ли relation указывать на выборку) и правдивость текста в мастере. Пока
   не решено, любая работа над связями и над выборками строится на догадке.
3. **#160 — удалить брошенную модель sub-base.** Дешёвый P1, идёт до проектирования: убирает
   мёртвую команду из палитры и вторую модель выборки, чтобы бриф не рассуждал о коде, которого не
   будет.
4. **#159 — бриф выборки-как-сущности + Gate 0.** Implementation-тикеты появляются после него.
5. **P2-хвост** — #148–#157. Не блокирует ничего из верхних пунктов; берётся в паузах или после
   утверждения брифа. Внутри хвоста первым разумно взять #157 (реестр отклонений): он дешёвый и
   удерживает документы честными, пока идёт крупная работа.
6. **#158 — ручная приёмка R0/R1.** Отложена до появления тикетов на визуальный тест; до тех пор
   роль доказательства исполняет рендер из кода (`codex-reports/CX-R1…R4.md`).

Не в очереди, потому что не тикеты: конструктор формул (code-only — отменённое обещание, попадает
в #157) и сцена 8 (dashboard-as-file — там же).

### #141 — Rollup, настроенный через UI, не вычисляется никогда
- Status: ✅ DONE (2026-08-27, рабочее дерево, без коммита)
- **Как решено:** вариант (b) — цель резолвится на чтении, из relation-поля, которое rollup уже
  называет. Логика вынесена в `src/ui/app/rollupColumns.ts` (чистая функция, тестируемая без
  Svelte), `View.svelte` вызывает `applyRollupColumns`. **Явный `targetProjectId` игнорируется.**
  Первая версия его уважала (ни одна версия кода его не писала, значит появиться он мог только
  ручной правкой). Кросс-модельное ревью показало цену: id, не совпадающий с целью relation,
  резолвит ссылки в чужом проекте, где совпадение по basename даёт правдоподобное и неверное число
  без единой ошибки. Одна истина о том, «какой это проект»; тест закрепляет именно это.
  *Формулировка исправлена 2026-08-28 после CV-1: текст описывал поведение до ревью.*
- **Второй разрыв, найденный на Gate 0, закрыт вместе с первым:** ранний выход
  `externalFramesMap.size === 0` отбрасывал rollup по self-relation целиком; теперь такой rollup
  считается против текущего frame.
- **Детерминизм:** все rollup считаются от снимка frame, снятого до цикла, поэтому результат не
  зависит от порядка ключей `fieldConfig` в сохранённом JSON.
- Тесты: `src/ui/app/rollupColumns.test.ts` — 8 случаев | Milestone: (next) | Priority: **P0** | Complexity: S
- analysis_required: false
- Vision scene: 4 (Клиенты → Сеансы). User outcome: поле «Количество сеансов», созданное через
  Create field → Rollup, показывает число, а не пустую колонку.
- **Цепочка (проверена):** `patchRollup` (`ConfigureField.svelte:481-484`) намеренно удаляет
  `targetProjectId`, когда он пуст, «чтобы конфиг оставался минимальным». Ни один контрол его не
  заполняет: `rollupResolvedTargetProjectId` (`:416-427`) выводит цель из relation-поля **только
  для отрисовки** списка полей и обратно в конфиг не пишет. Дальше
  `collectExternalTargetIds` (`viewHelpers.ts:26`) добавляет внешний проект в загрузку только при
  наличии `cfg.rollup.targetProjectId` — внешний frame даже не запрашивается. И наконец
  `View.svelte:156-158` делает `if (!ext) continue` — rollup пропускается молча.
- **Экран выглядит настроенным:** `Through relation` / `Aggregate field` / `Function` заполнены,
  ошибки нет, колонка пустая. Это не деградация UX, это неработающая фича на центральном
  обещании эссе.
- **Развилка реализации (решить в тикете, не после):** (a) писать `targetProjectId` в конфиг при
  сохранении — минимальная правка, но конфиг дублирует то, что уже знает relation-поле, и
  расходится при смене цели relation; (b) резолвить цель на чтении, из relation-поля, и тогда
  `viewHelpers` и `View.svelte` должны спрашивать relation, а не rollup. (b) устраняет класс
  ошибки целиком; (a) чинит быстрее.
- Регресс-тест обязателен на оба пути: rollup без `targetProjectId` в конфиге должен вычисляться.
- Найдено рендер-проходом CX-R2; аудиты CX-A и CX-B оба назвали rollup «PARTIAL, работает по явной
  настройке» — то есть архитектурный проход эту поломку пропустил.
- **Gate 0, роли переставлены (2026-08-27).** Эксперимент по решению пользователя: Codex ведёт
  строительство, Claude проверяет посылки. Codex выбрал вариант (b) — резолвинг цели на чтении.
  Кода пока нет: обе попытки оборвались на лимите ChatGPT (`usage limit`, сброс в 20:02),
  `src/` не тронут. Разбор его claims второй моделью:
  - **Claim «отсутствующий и явный `targetProjectId` эквивалентны» — ложен для self-relation.**
    `extractRelationTargetIds` (`viewHelpers.ts:24-28`) исключает self-reference намеренно, а
    `View.svelte:156-158` трактует отсутствие внешнего frame как отсутствие rollup. Вариант (b)
    сам по себе этот класс не чинит.
  - **Claim «устаревший явный id не должен побеждать» — не эквивалентность, а смена семантики.**
    В типе (`settings.ts:280`) поле объявлено просто как optional; слово «override» живёт только
    в inline-комментарии `ConfigureField`. Должно быть заявлено решением, а не равенством.
  - **Claim о наборе загружаемых frame называет не тот риск.** Для межпроектного rollup цель
    **уже** загружена по relation-ветке (`viewHelpers.ts:20-22`), потому что rollup всегда
    ссылается на relation-поле. Менять набор не нужно; если менять — это заход на #138, где
    аддитивность обогащения уже была опровергнута коллизией имён производных полей.
  - **Обоснование Codex оказалось сильнее, чем его формулировка.** Он списал отказ от явного
    `targetProjectId` на «необнаруживаемость в сохранённых данных», опираясь на выборку из двух
    vault. Проверка истории (`git log -S`, `2af8a50` и раньше) показывает больше: поле **никогда
    не записывалось ни одной версией кода** — только читалось (`rollupResolvedTargetProjectId`).
    Значит стороннее значение может появиться лишь ручной правкой `data.json`. Это структурный
    аргумент, а не статистический.
  - **Новый риск в его же плане: порядок вычисления.** Для self-relation план предлагает подать
    текущий frame как целевой. Но `View.svelte:159-176` наращивает `out` внутри цикла по
    `Object.entries(fieldConfig)`, а `computeCrossProjectRollup` читает значения цели из
    переданного frame (`crossProjectRollup.ts:107-110`). Rollup, чей `targetField` — результат
    другого rollup, начнёт зависеть от порядка ключей в сохранённом JSON. Дешёвая защита:
    подавать снимок frame, сделанный **до** цикла rollup, а не растущий `out`.
- **Критерии приёмки (заданы до кода):** два регресс-теста — межпроектный rollup без явного
  `targetProjectId` и rollup по self-relation; правка не расширяет набор загружаемых внешних
  frame; порядок ключей `fieldConfig` не влияет на результат.

### #142 — Внешний источник в Gallery: нет read-only, `+` пишет в родительский проект
- Status: ✅ DONE (2026-08-27, рабочее дерево, без коммита)
- `GalleryView` получил проп `readonly` (по умолчанию `false`, поэтому standalone-галерея не
  изменилась), `DatabaseCallBlock` передаёт `readonly || sourceReadOnly` — теперь во все четыре
  вида, а не в три. Кнопка `+` скрыта; клик по карточке в read-only открывает заметку вместо
  модалки редактирования: смотреть можно, писать в чужой проект нельзя.
- Тесты: `linkedSourceWrites.test.ts`, блок #142 (4 случая); счётчик видов поднят с 3 до 4,
  чтобы пятый вид нельзя было добавить молча | Milestone: (next) | Priority: **P1** | Complexity: XS
- analysis_required: false | Depends on: #139
- Vision scene: 4. User outcome: в блоке, читающем чужой проект, нельзя создать запись в текущем.
- #139 закрыл ровно этот класс дефекта, но одну вкладку пропустил. `DatabaseCallBlock.svelte:498`
  и `:511` передают `readonly={readonly || sourceReadOnly}` в Board и Calendar; `:518-524`
  передаёт в `GalleryView` только `project`, `frame`, `api`, `getRecordColor`, `config`.
- У `GalleryView` вообще нет пропа `readonly` (`GalleryView.svelte:32-38`), а кнопка `+`
  вызывает `api.addRecord` с **родительским** `project` (`:209-214`). Заметка создаётся не в том
  проекте, из которого блок читает, без единого предупреждения.
- Работа: добавить `readonly` в `GalleryView` (как в остальных трёх видах), пробросить
  `readonly || sourceReadOnly`, закрыть `+` и inline-правки. Регресс-тест на внешнюю gallery.
- Проверять при этом остальные виды на тот же пропуск — #139 показал, что список видов
  расширяется быстрее, чем правится.

### #143 — Inverse relation: обещание в UI не соответствует ничему в коде
- Status: ✅ DONE (2026-08-28, рабочее дерево, без коммита) | Milestone: (next) | Priority: **P1** | Complexity: M
- analysis_required: true | analysis_done: true
- **Принят вариант (A): обратная связь выводится, а не записывается.** Решение предложено мной
  2026-08-28 под указанием «закрыть все задачи» и **явно одобрено пользователем в тот же день**.
  Остаётся обратимым: путь записи в коде цел, меняется только смысл по умолчанию.
  Обоснование: WikiLink остаётся единственным внешним ключом (принцип 3 контракта). Записываемая
  копия в карточке цели создаёт вторую истину, которую надо согласовывать при переименовании и
  удалении — а этого согласования нет (CX-B §6), то есть вариант (B) закрывал бы обещание, открывая
  долг. Зафиксировано в `VISION_DEVIATIONS.md` D-6.
- **Что сделано:** (1) мастер больше не обещает создание свойства в схеме цели — исправлены и
  пояснение, и **сам заголовок чекбокса**: было «Create inverse property in schema», стало «Name the
  back-reference property on the other side». Первая правка тронула только пояснение под ним, и
  CV-1 это поймал: чекбокс продолжал обещать ровно то, что решение отменило; (2) `fireInverseRelations` перестал выбрасывать
  `RelationWriteOutcome`: `target-not-found` и `write-failed` теперь видны пользователю и в
  консоли, а `inverse-field-missing` молчит намеренно — при выводимой связи это норма, а не сбой.
- **Что НЕ сделано и почему:** межпроектный выводимый inverse как отдельное поле
  (`enrichWithBacklinks` работает внутри одного frame) не добавлен — это не honesty-fix, а фича
  уровня #113/#159, и делать её до брифа выборки значит проектировать вслепую.
- Vision scene: 4. User outcome: включив «Create inverse property in schema», пользователь либо
  получает работающую обратную связь, либо честный текст о том, что связь односторонняя.
- **Разрыв (проверен, два места):** `RelationSetup.svelte:43` обещает создание inverse-свойства;
  `relationSetupController.ts:20-32` пишет только `fieldConfig` **исходного** проекта; в схеме
  цели не появляется ничего. Затем `adaptRelationFieldConfig` (`relationContract.ts:71`) жёстко
  задаёт `createIfMissing: false`, `writeOne` возвращает `inverse-field-missing`
  (`relationsWriter.ts:96-120`), а `fireInverseRelations` (`viewApi.ts:113-126`) выбрасывает весь
  `RelationWriteOutcome` — ни Notice, ни бейджа, ни лога.
- **Почему analysis_required:** в репозитории уже две реализации обратной связи, и решение — какая
  из них каноническая — продуктовое, а не техническое:
  - **(A) Выводимый inverse.** `enrichWithBacklinks` (`relationResolver.ts:191`) уже считает
    `<relation>_backlinks` и вызывается для каждого виджета (`WidgetHost.svelte:68`) и для внешнего
    frame (`externalFrameResolver.ts:80`). Ничего не пишет, WikiLink остаётся единственным внешним
    ключом — принцип 3 `PRODUCT_RESET`. **Но:** `computeBacklinks` строит индекс из одного frame,
    поэтому межпроектный случай эссе «Клиент → все его сеансы» этим путём НЕ покрыт; добирать надо
    на стороне `crossProjectResolver`, где межпроектное разрешение уже есть.
  - **(B) Записываемый inverse.** Тогда обязательны создание поля в цели, чтение
    `RelationWriteOutcome.issues` в UI и согласование двух копий при rename/delete цели —
    последнее сейчас не сделано вообще (см. #144 по исходам и CX-B §6).
- **Мина под обоими вариантами:** `settings.updateFieldConfig(projectId, fieldName, fields, config)`
  удаляет из `fieldConfig` все ключи, которых нет в аргументе `fields` (`settings.ts:163-167`).
  Любая запись конфига в **целевой** проект обязана передавать полный список его полей, иначе молча
  сотрёт остальные конфиги цели. Отдельный регресс-тест, независимо от выбранного варианта.
- До решения текст в UI не должен обещать того, чего нет: это часть тикета, а не отдельный.

### #144 — Исходы записи на границе ViewApi: три дефекта одной формы
- Status: ✅ DONE (2026-08-27, рабочее дерево, без коммита)
- **(1)** `ViewApi.updateRecord` ловит отказ записи, возвращает в store прежнюю запись и показывает
  Notice. Исключение дальше намеренно не пробрасывается: часть вызовов не ждёт промис, и unhandled
  rejection заменил бы видимое сообщение записью в консоли.
- **(2)** `DataApi.writeAcrossFiles` (`allSettled`) возвращает `BulkFieldWriteOutcome`: сколько
  заметок записано, какие упали и с какой ошибкой, какие пути не нашлись. Применено к `addField`,
  `renameField`, `deleteField` — дыра была одинаковая во всех трёх. `ViewApi` ждёт исход и
  сообщает о неполной записи.
- **(3)** Форма создания поля показывает строку последствий с фактическим числом заметок (сцена 2
  эссе). Для типов, которые ничего не пишут во frontmatter, строка не показывается.
- Побочно закрыта часть #150: `relationSetupController` теперь ждёт реальную запись, поэтому
  `Relation saved.` больше её не опережает.
- Тесты: `src/lib/__tests__/bulkFieldWrite.test.ts` — 4 случая | Milestone: (next) | Priority: **P1** | Complexity: M
- analysis_required: false
- Vision scenes: 2 и 3. User outcome: если запись в Markdown не удалась, пользователь это видит,
  а интерфейс не показывает несуществующее состояние.
- **(1) `updateRecord` без компенсации** (`viewApi.ts:41-51`): store обновляется до
  `await this.dataApi.updateRecord`, исключение не ловится. `oldRecord` уже лежит в локальной
  переменной строкой выше — компенсация это `try/catch` с возвратом `dataFrame.updateRecord(oldRecord)`
  и Notice, ничего нового вычислять не нужно.
- **(2) `addField` без пофайлового результата** (`viewApi.ts:67-75`, `dataApi.ts:70-83`): Promise
  отбрасывается через `void`, внутри один `Promise.all`. При отказе части файлов vault остаётся в
  смешанном состоянии молча. Минимальная правка: `allSettled` + возврат исходов + сводка по отказам.
- **(3) `CreateFieldModal` без подтверждения объёма** (`createFieldModal.ts:41-44`): закрывается
  сразу. Сцена 2 эссе диктует текст дословно — «Создать поле `problem_type` во всех заметках?
  Будут добавлены пустые значения, существующие данные не пострадают» — с фактическим числом
  заметок. Это же требует `PRODUCT_RESET` §4 (Create field показывает последствия bulk-write).
- **Инвариант, который нельзя сломать:** UI не блокируется на всю массовую запись — сводка
  приходит после, а не вместо реактивности.
- Побочный эффект (2): мастер Relation перестанет показывать `Relation saved.` до завершения
  фоновой записи — см. #150.

### #145 — Одноразовая точка восстановления перед мигрирующей записью на onOpen
- Status: ✅ DONE (2026-08-27, рабочее дерево, без коммита)
- `src/lib/settingsBackup.ts`: копия `data.json` соседним файлом `data.backup-<ts>.json`.
  Идемпотентность даёт файловая система, а не флаг в settings — если копия уже есть, это не первая
  мигрирующая запись. Схема settings не тронута, миграциям settings знать об этом не нужно.
- **Копия берётся из памяти, а не с диска, и поэтому порядок записи не важен.** Первая версия
  читала `data.json` обратно и ради этого откладывала сохранение мигрированного конфига — кросс-
  модельное ревью показало гонку: между отложенной записью и чтением пользователь или другая
  вкладка могли сохранить более новый дашборд, и поздняя запись затирала его устаревшим конфигом
  (идемпотентность миграции от lost update не защищает). Сейчас `saveConfig` снова синхронный, а
  бэкап пишет **до-миграционный конфиг, который у вызывающего уже на руках**.
- Файл называется `migration-backup-<projectId>-<viewId>-<ts>.json`, и копия одна **на вид**, а не
  одна на vault: вторая миграция того же вида сохранила бы уже мигрированную форму.
  *Формулировка исправлена 2026-08-28 после CV-1: текст описывал первую версию.*
- Провал копирования никогда не блокирует миграцию: логируется и проглатывается.
- Тесты: `src/lib/__tests__/settingsBackup.test.ts` — 6 случаев, включая уважение к `configDir`
- **Исправлено ручным прогоном через Obsidian API 2026-08-28.** Правило «одна копия на вид»
  оказалось неверным: я посеял второй legacy-пайплайн в тот же вид, миграция отработала, а копия
  не появилась — до-состояние второго события потерялось молча. Обоснование правила («вторая копия
  захватит уже мигрированную форму») ложно: payload берётся из памяти и всегда является
  до-состоянием ИМЕННО этого события. Стало: копия на каждое событие миграции, имя устойчиво к
  коллизии в одну миллисекунду. Перепроверено вживую — два файла, у каждого своё корректное
  до-состояние, verified `projectId`/`viewId` и отсутствие `subFilter` в payload.
- **Ужесточено после кросс-модельного аудита улик (2026-08-28):** до-состояние копируется
  структурно, а не по ссылке; бросающий `exists` больше не отменяет запись (имя уступает, а не
  файл); отсутствие `app` и неудачная запись больше не молчат — консоль и Notice, потому что
  «точки восстановления нет» это то, о чём пользователь должен узнать сразу, а не при откате. | Milestone: (next) | Priority: **P1** | Complexity: S
- analysis_required: false
- User outcome: после первого открытия дашборда пользователь может вернуться к прежней
  конфигурации, если миграция сделала не то.
- `DashboardView.onOpen` (`dashboardView.ts:53-72`) выполняет две миграции подряд —
  `migrateTableConfig` и `migrateDashboardTransforms` — и каждая немедленно вызывает
  `props.saveConfig`. Ни подтверждения, ни undo, ни снимка.
- Существующий бэкап (`main.ts:531-540`, `__broken_backup`) покрывает только неразбираемые
  settings, не успешную миграцию.
- **Предлагаемая форма:** соседний файл через adapter (`data.backup-<timestamp>.json`), а не ключ
  внутри живого `data.json` — иначе копию затрёт следующая же запись. Срабатывание однократное,
  по флагу в settings, а не при каждом открытии.
- Открытый вопрос из `QUALITY_DEBT_2026-08-25.md`, оставленный второй модели; Codex (CX-C) ответил
  «нужен», с разбором сценария потери: старый `transform.steps = [filter, pivot]` превращается в
  `subFilter + [pivot]`, после чего исходный порядок из сохранённого конфига невосстановим.

### #146 — Документы описывают уже слитый код как pending
- Status: ✅ DONE (2026-08-27)
- `CONTEXT.md`: раздел состояния переписан на факт (`main` = `64863ed`, обе ветки внутри), добавлено
  правило «merged ≠ accepted», `AGENTS.md`/`CLAUDE.md` убраны из активных источников (сняты с
  трекинга намеренно в `4e094ef`), базовые числа обновлены.
- `BACKLOG.md`: заголовки M-FILTER-CONSOLIDATION и M-RELATION-FIRST приведены к факту, #111
  переведён из IN-PROGRESS в DONE.
- `SESSION_REPORT_2026-08-27.md`: постскриптум вместо переписывания — отчёт остаётся свидетельством
  момента, статус живёт в `CONTEXT.md`. | Milestone: (next) | Priority: **P1** | Complexity: XS
- analysis_required: false
- User outcome (внутренний): следующая сессия стартует с верной картиной состояния.
- `CONTEXT.md:15-18` и `SESSION_REPORT_2026-08-27.md:3` утверждают, что `feat/116-filter-order-adr`
  не слита и `main` не тронут. Фактически `64863ed` — merge-коммит, и код relation-first и
  filter-стека в `main`.
- `BACKLOG.md:32` держит M-FILTER-CONSOLIDATION активным, `CONTEXT.md:45-50` называет его
  COMPLETE; `BACKLOG.md:152-190` помечает M-RELATION-FIRST «pending merge», а #111 IN-PROGRESS.
- `CONTEXT.md:99-100` перечисляет `AGENTS.md` и `CLAUDE.md` среди активных источников истины,
  хотя `4e094ef` снял их с трекинга намеренно (репозиторий публичный). Правится строкой в
  `CONTEXT.md`, **не** возвратом файлов.
- Шапка `BACKLOG.md` (`Updated:`) — та же проблема: обновлена на 2026-08-24 и описывает состояние
  до merge.

### #147 — Решение: сохранённая выборка как адресуемый источник (Vision scene 5)
- Status: ✅ РЕШЕНО 2026-08-27 (решение пользователя) → исполняется в **M-SAVED-SELECTION**, #159–#160
- Milestone: (next) | Priority: **P1** | Complexity: L
- analysis_required: true | analysis_done: true (решение принято пользователем, не аналитикой)
- **Принят вариант 2 из трёх: выборка становится настоящей сущностью.** Не «именованный дашборд
  как официальный ответ» и не достройка брошенной заготовки. Выборка получает собственное имя и
  идентификатор, появляется в списке источников наравне с проектом, на неё можно сослаться из
  другого блока, состав пересобирается реактивно.
- **Брошенная заготовка удаляется, а не достраивается** — по решению пользователя: доверия к её
  соответствию текущему состоянию проекта нет. Удаление вынесено в #160 и идёт ДО проектирования,
  чтобы бриф не рассуждал о коде, которого не будет.
- Vision scene: 5 — «фильтр сам становится базой». User outcome: пользователь создаёт именованную
  выборку и открывает её как источник другого представления.
- **Это упирается в модель данных, не в UI.** `view.filter` не имеет ни `id`, ни имени, ни
  собственных представлений (`settings.ts:11-38`); `DatabaseViewConfig` не содержит списка
  сохранённых выборок (`types.ts:315-349`); `WidgetSourceConfig` знает только `projectId`
  (`types.ts:54-63`), поэтому выбрать выборку источником нельзя в принципе.
- В коде уже есть неподключённая модель именованной sub-base (`subBase.ts:24-55`), а тип виджета
  `sub-base-canvas` отсутствует в `WIDGET_CONTENT` (`widgetComponentRegistry.ts:37-49`) — то есть
  однажды это начинали и не довели.
- Ближайший работающий эквивалент — именованный Dashboard view с фильтром. Решение тикета: либо
  признать его официальным ответом на сцену 5 и описать в `FILTER_MODEL.md`, либо ввести сущность
  выборки. Промежуточное состояние — худший вариант: оно выглядит как обещание.
- Три отчёта (CX-A §5, CX-C §2, CX-E) пришли к этому независимо.

### #148 — Граница Relation и field-join: join/scatter связывают в обход контракта
- Status: ✅ DONE (2026-08-28, документация)
- Границу зафиксировали, а не стёрли: `FILTER_MODEL.md` §Outside this model получил раздел
  «Analytical joins are not relations» — join и scatter-correlation парят произвольные поля, не
  читают `RelationFieldConfig`, не различают resolved/unmatched/ambiguous, inner отбрасывает
  несовпавшие, scatter берёт первое из нескольких. Связь — объявленное свойство данных, join —
  заданный им вопрос. Два следствия названы явно: join может спарить то, что контракт назвал бы
  ambiguous, и его числа несопоставимы с rollup по тому же полю. | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: false
- Vision scene: 4. User outcome: одинаково выглядящие связи ведут себя одинаково, а аналитический
  join честно назван join.
- `computeScatterData` (`chartDataPipeline.ts:247-290`) строит индекс по `joinKey(rightKey)` и
  ищет совпадение по `joinKey(leftKey)`; `RelationFieldConfig` и `relationContract` не участвуют.
  При нескольких совпадениях берётся первое, при отсутствии — левая запись молча пропускается.
- `executeJoin` (`transformExecutor.ts:1077-1156`) соединяет произвольные поля: inner отбрасывает
  unmatched, left оставляет с `null`, множественные совпадения разворачивают строки.
- Контракт различает `resolved` / `unmatched` / `ambiguous` (`relationContract.ts:98-125`) —
  join не использует ни один из статусов.
- Работа: не объединять механизмы, а зафиксировать границу — join остаётся аналитическим и
  маркируется как advanced, unmatched/ambiguous получают единый словарь и видимость.

### #149 — linkedSelection: не видно, какая связь применена, и поломка маскируется
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- **Правка после CV-1 (2026-08-28):** сообщение о поломке утверждало «блок фильтруется обычным
  выделением» даже когда выделения нет — состояние `broken` не зависело от активности выделения.
  Теперь при отсутствии выделения оно честно говорит, что блок показывает все записи.
- Ярлык перестал описывать проводку и начал описывать данные. Было «Filtered by relation» при
  валидном, но простаивающем связывании — то есть при показе всех записей. Стало три состояния:
  «Showing records where <поле> is <запись>» когда связь реально сужает; «Linked through <поле> —
  select a row to narrow this block» когда связь настроена и ждёт выбора; при поломке —
  «Relation '<поле>' is broken (<причина>) — this block is filtered by the plain selection
  instead», потому что fallback на canvas-фильтр действительно продолжает сужать данные, и раньше
  об этом не сообщалось. | Milestone: (next) | Priority: P2 | Complexity: S
- analysis_required: false
- Vision scene: 4. User outcome: по экрану понятно, какая relation сузила данные и какая запись
  сейчас выбрана.
- `DatabaseCallBlock.svelte:127-133` показывает обобщённое `Filtered by relation` — без имени
  relation, без цели, без имени выбранной записи; при поломке — `Relation broken: <status>`.
- Само сопоставление не вызывает `resolveRelationValue`: `filterByLinkedSelection`
  (`relationFilterAdapter.ts:68-90`) нормализует строку через `parseRelationLinks` и
  `canonicalLinkKey`.
- При невалидной relation `composeEffectiveFilter` (`canvasSelectionStore.ts:250-274`) пропускает
  relation-условие, но всё ещё добавляет обычное canvas-условие по имени поля — данные сужаются
  другим способом, а бейдж сообщает только о поломке.
- Рендер CX-R4 добавил: `Filtered by relation` показывается при валидном конфиге даже без
  активного выделения, то есть когда фильтрации нет вообще.

### #150 — Мастер Relation: успех до записи, потерянный displayField, недостижимый алерт
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- Мастер закрывается после успешного сохранения. Раньше оставался открытым с Notice «Relation
  saved.», и единственным признаком успеха было сообщение рядом с формой, выглядящей неотправленной.
- Ошибка сохранения рендерится внутри мастера через уже существовавший `role="alert"`, который был
  недостижим: контроллер никогда не передавал `error`.
- Кнопки блокируются на время записи, поэтому двойное сохранение невозможно.
- Вход из редактора схемы больше не теряет `displayField` и имя обратного поля — раньше сохранение
  из этой точки молча стирало и то, и другое.
- «Успех до записи» закрыт в #144: `addField` стал awaitable, и контроллер ждёт реальную запись.
- **Правка после CV-1 (2026-08-28):** ждать оказалось мало. `addField` сообщает о частичной записи
  исходом, а не исключением, и мастер отвечал на это «Relation saved.» — связь действительно
  сохранена, но часть заметок свойства не получила, и сказать только первую половину значит
  показать здоровым наполовину записанный vault. Теперь конфиг сохраняется, а мастер остаётся
  открытым с сообщением, в скольких заметках свойство не появилось. | Milestone: (next) | Priority: P2 | Complexity: S
- analysis_required: false | Depends on: #144
- Vision scene: 4. User outcome: после Save пользователь понимает, что именно сохранилось.
- Модалка **не закрывается** после Save, но показывает `Relation saved.`
  (`relationSetupController.ts:43`).
- `Relation saved.` появляется **до** завершения фоновой записи frontmatter, потому что
  `ViewApi.addField` не возвращает promise (`viewApi.ts:67`) — общая причина с #144.
- Вход из schema editor теряет уже настроенный `displayField` и строит preview на frame с
  `records: []` (`dashboardSchema.ts:49,159`): счётчики совпадений всегда `0`, а повторное
  сохранение из этого входа затирает прежний `displayField`.
- `Save relation` никогда не disabled; ошибки валидации уходят в Notice, а предусмотренный в
  разметке `role="alert"` недостижим, потому что контроллер не передаёт `error`
  (`RelationSetup.svelte:52`).
- Нет состояния загрузки и ошибки для внешнего frame: при `null` мастер просто не рисует счётчик,
  хотя перевод строки «The selected database could not be loaded.» уже существует.

### #151 — Статусы ссылки известны контракту и не доходят до экрана
- Status: 🔶 ЧАСТИЧНО (2026-08-28) — закрыт `invalid-field`, остальное открыто
- Панель настроек предупреждала при `missing-relation` и `wrong-target-project`, но молчала при
  `invalid-field`: удалённое Relation-поле оставляло панель выглядящей настроенной, пока блок тихо
  фильтровался обычным выделением. Теперь предупреждает.
- **Не сделано и почему:** пометка конкретной неразрешённой ссылки в ячейке требует целевого frame
  в самой ячейке, которого там нет. Тянуть его ради индикатора значит менять контракт рендера
  таблицы — это отдельная работа, она остаётся открытой частью этого тикета. | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: false
- Vision scene: 4. User outcome: пользователь видит, какая именно ссылка не нашлась и почему.
- Unmatched-ссылка в ячейке выглядит обычной пилюлей — статуса нет
  (`relationContract.ts:98-125` против рендера `tableCanon.ts:237`).
- Preview мастера показывает три числа (`Matched / Not found / Ambiguous`) без строк и причин
  (`relationSetup.ts:64`).
- `DatabaseCallSettings.svelte:35` предупреждает при `missing-relation` и `wrong-target-project`,
  но не при `invalid-field` — после удаления выбранного Relation-поля предупреждения нет.
- При пустом результате (`Нет совпадений`) нельзя понять, какая ось убрала строки: scope,
  transform или selection; для Board/Calendar/Gallery специальных состояний нет вовсе.

### #152 — Порядок sort противоречит FILTER_ORDER_ADR
- Status: ✅ DONE (2026-08-28, документация — решение «описать, не двигать»)
- `FILTER_ORDER_ADR.md` получил раздел «Where `sort` actually runs»: сортировок две. Вид сортирует
  сразу после A, до C и B; таблица дашборда сортирует ещё раз после всего. Инвариант в исходной
  формулировке верен для второй и ложен для первой.
- **Решение: документировать, а не переносить.** `View.svelte` общий для table/board/calendar/
  gallery/dashboard; перенос его сортировки за пайплайн изменил бы порядок строк во всех
  представлениях ради упорядочивания, на которое никто не жаловался, а поверхность, где это видно —
  таблица — пересортировывает последней. Реально затронуты порядок входа в пайплайн и порядок
  серий chart/stats, у которых своей сортировки нет. Если это станет жалобой, лечится отдельной
  стадией сортировки для дашборда, а не правкой общего вида. | Milestone: (next) | Priority: P2 | Complexity: S
- analysis_required: false
- `FILTER_ORDER_ADR.md:12` и `FILTER_MODEL.md:65` фиксируют `A → C → B → sort` и обосновывают:
  «сортировать вывод pivot — это то, что человек реально видит».
- Фактически `View.svelte:184-188` сортирует сразу после A, до C и B
  (`dashboardView.ts:47-50` → `DashboardCanvas` → `WidgetHost:69-71`).
- Смягчение: таблица дашборда сортирует ещё раз своим `applySort` после всего
  (`DataTableContent.svelte:85`), поэтому видимый эффект ограничен порядком строк, входящих в
  pipeline, и сериями chart/stats.
- Решение любое из двух — перенести sort или уточнить ADR, — но текущее состояние делает
  order-invariant тест защитой неверного утверждения (родственно #128).

### #153 — Stats receiver сравнивает Relation-поля не каноническим ключом
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- Stats сравнивал `String(cell)`, relation-путь — канонический ключ, поэтому карточка могла
  агрегировать не ту когорту, которую подсвечивала таблица рядом.
- **Правка после CV-1 (2026-08-28): первая версия была инертна в боевом пути.** Канонизация
  включалась, только если *выбранное значение* выглядело как ссылка, а драйвер таблицы публикует
  голый basename (`rowSelectionValue` → `recordBaseName`) — то есть ячейка `[[Ivan Petrov]]` так и
  не встречалась с выбором `Ivan Petrov`. Теперь сторона выбора канонизируется всегда.
- Асимметрия осталась намеренной: сторона **ячейки** идёт по ссылочному пути только если в ней есть
  wikilink. `parseRelationLinks` дробит обычные строки по запятой, и пропустить через него все поля
  значило бы молча изменить поведение String-полей — «Ivan, Petrov» начал бы совпадать с «Ivan».
- Граница честно названа в тесте: канонический ключ уравнивает скобки, алиас и регистр, но **не**
  путь с basename — ровно как relation-путь, совпадение с которым и есть цель тикета.
- Тесты: `statsSelectionRelation.test.ts` — 4 случая. | Milestone: (next) | Priority: P2 | Complexity: XS
- analysis_required: false
- `filterRecordsBySelection` (`statsSelectionReceiver.ts:88-97`) сравнивает `String(cell)`, тогда
  как relation-путь использует `canonicalLinkKey` (`relationFilterAdapter.ts:68-90`). Для Relation
  и типизированных полей Stats и таблица могут описывать разные наборы записей.
- **Дублирование comparator'а здесь осознанное и задокументировано в самом файле** («оба receiver'а
  обязаны совпадать»), поэтому тикет не про «убрать дубль», а про совпадение семантики на
  Relation-полях. Если появится третий receiver — извлекать общий, как и написано в комментарии.

### #154 — Vision scene и user outcome как обязательные поля шаблона тикета
- Status: ✅ DONE (2026-08-28)
- В шаблон добавлены `Vision scene:` и `User outcome:`. `Vision scene: none — maintenance` —
  легитимный ответ; отсутствие поля — нет. Именно так «починен crash» и «пользователь понял флоу»
  оказывались одинаковым прогрессом.
- **Тестом не проверяется намеренно:** ратчет по всему файлу упал бы на 120 исторических тикетах, а
  дописывать им ссылки на сцены задним числом значит выдумывать намерение, которого не было. | Milestone: (next) | Priority: P2 | Complexity: XS
- analysis_required: false
- `PRODUCT_RESET` §6 требует, чтобы каждый product-тикет ссылался на сцену и имел проверяемый
  user outcome. Шаблон в `BACKLOG.md:13-25` таких полей не содержит, поэтому правило неисполнимо
  механически: в файле 128 тикет-секций и 8 строк, где сцена вообще упоминается.
- Работа: добавить в шаблон `Vision scene:` и `User outcome:`, отметить их обязательными для
  product-тикетов (не для технических), и проверить их наличие тем же тестом, что уже сторожит
  дрейф конфигов (`R0_7_configDrift.test.ts`).

### #155 — Проактивные подсказки: расширить или честно назвать MVP
- Status: ✅ DONE (2026-08-28) — честность, не расширение
- Дефект: подсказка relation-block предлагалась для Relation-поля без цели, и её принятие добавляло
  **пустой** `database-call` — обещание «связанные записи» превращалось в пустой блок, что читается
  как сломанная фича, а не как ненастроенное поле. Теперь правило требует цели.
- Объём подсказок зафиксирован как MVP в `VISION_DEVIATIONS.md` D-4: две подсказки против списка
  сцены 6 (рост к периоду, тренд, аномалии, частота, пауза, прогноз). Расширение — отдельная
  продуктовая работа, а не долг этого тикета. | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: false
- Vision scene: 6. User outcome: пользователь получает подсказки по своим типам данных, а не
  считает вручную.
- `smartSuggest.ts:16-26` содержит ровно два правила: `numeric-stats` и `relation-block`. Эссе
  перечисляет: сумма/среднее/рост к периоду, динамика/тренд/аномалии, частота визитов/средняя
  пауза/прогноз следующего обращения. Нет правил для Date вообще.
- `dashboardSuggest.ts:35-47`: при relation без `targetProjectId` принятие подсказки добавляет
  обычный пустой `database-call`, а не связанный блок — подсказка обещает больше, чем делает.
- Strip показывается только на непустом редактируемом canvas (`DashboardCanvas.svelte:170-173`),
  то есть ровно там, где пользователь уже разобрался; на zero state его нет.
- Минимум по этому тикету — честность: #059 помечен DONE без пометки MVP, из-за чего покрытие
  сцены 6 выглядит полным.

### #156 — Первый запуск умалчивает о том, что делает
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- Форма создания проекта говорит, что делает: при пустом пути — «весь vault: каждая заметка
  становится записью», при заданном — «читает заметки, уже лежащие в <папке>; папка не создаётся и
  заметки не пишутся — проект это вид поверх существующих файлов».
- Демо перестало глотать отказы: «уже существует» проверяется до записи, идемпотентность сохранена,
  а настоящий отказ записи собирается и показывается — «создан, но N заметок записать не удалось».
  Отказ создания самой папки больше не приводит к регистрации проекта, указывающего в никуда.
- **Не сделано:** третье действие «Импортировать папку» на первом экране — это новый флоу, а не
  честность формулировок; остаётся продуктовой работой по сцене 7. | Milestone: (next) | Priority: P2 | Complexity: S
- analysis_required: false
- Vision scenes: 2 и 7. User outcome: пользователь понимает, что создалось на диске, а что только
  в настройках.
- `Create project` создаёт запись в plugin settings и один view; папку и заметки не создаёт
  (`dataApi.ts:307`, `settings.ts:33`), и нигде этого не говорит.
- Пустой `Path` молча означает весь vault — из UI это не следует.
- `createDemoProject` глотает ошибки `createFolder` и `vault.create` и регистрирует проект всё
  равно (`demoProject.ts:462,475`); пользователь не узнает, что часть заметок не создалась.
- Onboarding предлагает два действия вместо трёх из эссе; пути «превратить существующую папку в
  базу» на главном экране нет, он есть только как вторичная инструкция на вкладке
  (`Onboarding.svelte:39-50`).

### #157 — Реестр отклонений от Vision: свести три статуса в один
- Status: ✅ DONE (2026-08-28)
- Создан `VISION_DEVIATIONS.md`: шесть строк D-1…D-6 с реальностью и статусом каждого осознанного
  отклонения — dashboard-as-file, конструктор формул, внешний источник только на чтение, объём
  подсказок, выборка-как-база, выводимый inverse. `PRODUCT_RESET` §4 и `CONTEXT.md` ссылаются на
  него вместо того, чтобы повторять статусы по-разному.
- Правило записано в самом файле: отклонение — это **решение**. Не решённое — пробел в бэклоге, а
  не строка в реестре. | Milestone: (next) | Priority: P2 | Complexity: S (decision)
- analysis_required: false
- Три отклонения приняты в коде, но их статус в документах разный, и из-за этого продукт выглядит
  ближе к эссе, чем он есть:
  - **Сцена 8, дашборд-как-markdown.** Конфиг живёт в общем `data.json` (`main.ts:356-360`).
    `BACKLOG.md:1107-1129` фиксирует Option B (defer до V3), `PRODUCT_RESET` §4 держит «decision gap».
  - **Конструктор формул.** `FormulaConstructor.svelte:10-18` прямо фиксирует code-only, «no
    visual/node mode», тогда как эссе (сцена 6) требует «жесты и слова». Это отменённое обещание,
    а не долг реализации.
  - **Внешний источник read-only.** #139 закрыл запись сознательно; как это соотносится с
    принципом «одна сущность в двух интерфейсах», нигде не записано.
- Работа: один раздел с решением по каждому — принято / отложено до версии X / отменено — и
  ссылка из `PRODUCT_RESET` §4, чтобы матрица сцен перестала расходиться с кодом.

### Кросс-модельное ревью стека #141–#145 (Codex, 2026-08-27)

Отчёт: `codex-reports/CX-REVIEW-stack-141-145.md`. Восемь утверждений ушли на проверку, шесть
объявлены ложными. Разбор — что принято, что отклонено:

- **Принято, исправлено: явный `targetProjectId` небезопасен** (#141). Приоритет ручного значения
  убран: id, не совпадающий с целью relation, резолвит ссылки в чужом проекте, где совпадение по
  basename даёт правдоподобное и неверное число без единой ошибки. Осталась одна истина о том,
  «какой это проект». Тест переписан на противоположное ожидание.
- **Принято, переформулировано: эквивалентности с прежним кодом нет** (#141). `FieldConfig`
  допускает relation и rollup на одном поле, поэтому прежний цикл мог резолвить ссылку, которую
  предыдущий rollup уже затёр своим результатом. Новое поведение лучше, но это **решение, а не
  равенство**, и записано так. Слабый тест порядка заменён: теперь он строит именно этот случай.
- **Принято, исправлено: исчезнувший файл выглядел успехом** (#144). `DataApi.updateRecord`
  возвращал `void` и просто выходил, если заметки нет; теперь возвращает `boolean`, а `ViewApi`
  откатывает store и сообщает. Плюс сам откат защищён: он не сработает, если в store уже легло
  что-то новее — иначе компенсация затирала бы чужую правку.
- **Принято, исправлено: гонка на потерю правок** (#145). Отложенный `saveConfig` мог перезаписать
  дашборд, сохранённый пользователем или другой вкладкой, пока шло чтение `data.json`.
  Идемпотентность миграции от lost update не защищает. Переделано: снимок берётся из памяти
  (конфиг уже на руках), сохранение снова синхронное, бэкап — один на вид, а не один на vault.
- **Принято, исправлено: standalone-галерея игнорировала read-only** (#142). Пре-существующий
  пробел, не мой: `galleryView.ts` не передавал `props.readonly`. Теперь передаёт, как Board.
- **Принято, исправлено: rename/delete не ждали исход** (#144). `dashboardSchema` не ждал
  `updateField`/`deleteField`, поэтому схема перерисовывалась раньше, чем становилось известно о
  неполной записи.
- **Принято как есть: контракт `addField` изменился** (#144). Да, метод стал awaitable, и создание
  поля теперь ждёт запись. Это намеренно: «поле создано» перестаёт означать «UI успел
  нарисовать». Зафиксировано, не откачено.
- **Отклонено: `ViewTabBar` / `BlockFilterBar` получают только `readonly`.** Это не дефект, а
  решение #139: правки *конфигурации* принадлежат родительскому дашборду, где и хранятся. Иначе
  нельзя было бы настроить связанный блок, чтобы починить проблему с данными. Тест #139 это
  прямо сторожит.
- **Вынесено в #161:** вызывающие, которые после `await api.updateRecord()` кладут запись в свой
  локальный стейт независимо от исхода.

Замечание Codex, что он не смог запустить jest в своей read-only песочнице, верно: гейты
прогонялись здесь — 173 сьюта / 2440 тестов PASS, tsc 0, svelte-check 0/0, lint 0 ошибок.

### Сквозная перепроверка проекта с Codex (2026-08-28)

Три параллельных read-only среза по всему проекту после закрытия очереди. Отчёты:
`codex-reports/CV-1-ticket-claims.md`, `CV-2-invariants.md`, `CV-3-vision-movement.md`.
Плюс два прохода Gate 0 по брифу #159 (`CX-GATE0-159.md`, `CX-GATE0-159-rev2.md`).

**Главный результат: расхождения нашлись не в коде, а между кодом и тем, что я о нём написал.**
CV-1 сверил 18 тикетов с фактическим кодом и пометил семь формулировок; из них две были устаревшим
текстом (#141, #145 описывали поведение до правок по ревью), три — реальными недоделками (#143
чекбокс, #149 безусловное сообщение, #150 «сохранено» при частичной записи), одна — инертной
правкой (#153), одна — следствием (#157 повторял формулировку #143). Все исправлены.

- **#153 был инертен в боевом пути.** Канонизация включалась, только если выбранное значение
  выглядело как ссылка, а драйвер таблицы публикует голый basename (`rowSelectionValue` →
  `recordBaseName`). То есть ячейка `[[Ivan Petrov]]` так и не встречалась с выбором `Ivan Petrov` —
  ровно то расхождение, ради которого тикет и заводился. Сторона выбора теперь канонизируется
  всегда; асимметрия со стороной ячейки осталась намеренной. Добавлены три теста на реальную форму
  драйвера.
- **#143: чекбокс продолжал обещать отменённое.** Первая правка тронула пояснение под ним, но не
  заголовок «Create inverse property in schema». Заголовок заменён; D-6 в реестре уточнён.
- **#150: ждать записи оказалось мало.** `addField` сообщает о частичной записи исходом, а не
  исключением, и мастер отвечал «Relation saved.». Теперь конфиг сохраняется, а мастер остаётся
  открытым с числом заметок, куда свойство не попало.
- **CV-2 нашёл регресс, который внёс я:** `await` в контроллере схемы (#144) позволял модалке
  открыться после закрытия вида. Добавлен `dispose()`, канвас вызывает его на destroy. Ратчет
  R0.6 при этом поймал выход за бюджет строк — уложился, инлайнив `openSchema`.
- **CV-2, безопасность:** `safeRegexCompile` в unpivot не применял ограничение длины паттерна,
  которое применяют два других regex-пути. Применяет. Оставшийся разрыв — alternation внутри
  квантифицированной группы — прежний и известный (#126), закрывается анализатором, а не ещё одним
  regex.
- **CV-3:** единственная сцена, сменившая статус, — сцена 2 (`PARTIAL → MET`), и сменила её реальная
  работа: предупреждение об объёме записи, пофайловый исход, обработка частичного отказа. Остальные
  улучшения — честность интерфейса, и они намеренно НЕ засчитаны как прогресс. Отдельно CV-3 нашёл
  брата #144, которого я пропустил: `updateRecords` (путь Board) без компенсации → #163.
- **Gate 0 по #159 отклонил обе ревизии.** Ревизия 1 — три ложных claim'а; ревизия 2 — доказала, что
  `pending` не отличим от пустоты на уровне вида, и что таблица инвалидации неполна. Из этого
  разбора вышел #162 — дефект не в дизайне, а в выпущенном коде.

Гейты после всех правок: **174 сьюта / 2450 тестов PASS, tsc 0, svelte-check 0/0, lint 0 ошибок.**

### #164 — Демо-генератор поставляет конфиги, которые сам же продукт мигрирует при открытии
- Status: ✅ DONE (2026-08-30, код + живой прогон) | Milestone: (next) | Priority: P2 | Complexity: S
- **Сделано:** генератор больше не отдаёт `transform` вовсе — пять блоков (чарт «Проекты по
  статусу», «Приоритетные задачи», «Встречи», «Клиенты (мастер связи)», «Проекты клиента»)
  получили `config.subFilter`; хелпер `typeFilter`, строивший пайплайн, заменён на `typeScope`,
  строящий `FilterDefinition`. `configProvenance.test.ts` расширен четырьмя тестами: no-op
  `migrateDashboardTransforms` для демо и для шаблонов, запрет ведущего шага `filter` у любого
  генератора, и счётчик блоков со scope — чтобы «починка» удалением фильтров не прошла молча.
  Показано, что все три новых теста краснеют на до-фиксовом генераторе.
- **Живая проверка 2026-08-30 (OBStests, REST API).** Из `data.json` убрана только запись проекта
  (заметки не тронуты, бэкап конфига снят), развёрнута сборка с фиксом, выполнен
  `create-demo-project` → новый проект `c6c4061f`. Затем `show-projects`, открывающий «Обзор»:
  **число файлов `migration-backup-*.json` не изменилось (5 → 5)** — миграции не было. В свежем
  конфиге ни один виджет не несёт `transform`, все пять блоков несут `config.subFilter`
  (`type is project`, `type is task`+`completed is-not-checked`, `type is meeting`,
  `type is client`, `type is project`). 28 заметок на месте, не задублированы; команд 10.
- **Чего REST не видит:** что блоки на экране действительно сузились до своего типа. Отсутствие
  миграции доказано, визуальный результат фильтрации — нет.
- **ИСТОРИЯ (утро 2026-08-30, до фикса выше) — тикет был ложно закрыт.** Стек #141–#164 тронул
  `demoProject.ts` только по #156 (отчёт о неудачной записи заметок), ведущие шаги `filter`
  оставались на месте (тогдашний хелпер `typeFilter`), и продукт мигрировал собственный
  демо-конфиг при открытии. Коммит `0d24c03` и merge `3f9251b` называют тикет закрытым ошибочно;
  исправление записано в `CONTEXT.md` (`87a6f88`), история не переписывалась. Этот пункт оставлен
  как след, а не как текущее состояние: `typeFilter` больше не существует.
- analysis_required: false
- Vision scene: 7 | User outcome: первый открытый дашборд не переписывает сам себя на диске
- **Найдено ручным прогоном через Obsidian API 2026-08-28** и подтверждено кросс-моделью:
  `demoProject.ts:299,320,341,364` создаёт виджеты с ведущим шагом `type: "filter"` в
  `widget.transform`. Это ровно та форма, которую #118 переносит в `config.subFilter`. Значит
  свежесозданное демо при первом же открытии «Обзора» мигрирует само себя, пишет `data.json` и
  создаёт файл восстановления (#145).
- Наблюдалось вживую: первый `migration-backup-*.json` в тестовом хранилище появился не от моего
  посева, а от штатного открытия только что созданного демо. Его до-состояние —
  `[('filter','type')]`.
- **Почему это не безобидно:** демо задумано как эталон «актуальной конфигурации» (об этом прямо
  говорит комментарий генератора), а фактически оно эталон legacy-формы. Пользователь на первом
  экране получает запись на диск, которой не просил, и любой, кто копирует демо-конфиг как
  образец, копирует форму, помеченную к миграции.
- **Работа:** переписать генератор так, чтобы фильтры сразу лежали в `config.subFilter`, а
  `transform` оставался только для того, что действительно является пайплайном. Плюс расширить
  `configProvenance.test.ts`: он проверяет no-op для `migrateAggregationCount`, но не для
  `migrateDashboardTransforms` — то есть ровно этот класс дрейфа тест не ловит.

### #163 — Пакетная запись (Board) не компенсируется при отказе
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- Milestone: (next) | Priority: P1 | Complexity: XS
- analysis_required: false
- Vision scene: 1 | User outcome: карточка не остаётся в новой колонке, если запись не удалась
- Найдено CV-3 при сквозной перепроверке. `updateRecords` — пакетный брат `updateRecord`, и дыра
  была та же: store обновлялся первым, запись ждали без `catch`. Перетаскивание карточки на Board
  пишет несколько записей разом, поэтому отказ оставлял карточку в новой колонке, за которой в
  Markdown ничего нет — сцена 1 эссе показывала сторону, которой не существует.
- Возвращает `boolean`, откатывает только те записи, что писал сам, и только если в store всё ещё
  лежит положенное им значение — то же правило, что в `revertOptimistic`.
- Тесты: `recordWriteCompensation.test.ts`, блок #163.

### #162 — Вид не обновляет rollup и relation, когда меняется целевой проект
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- Milestone: (next) | Priority: **P1** | Complexity: XS
- analysis_required: false
- Vision scene: 4 | User outcome: добавил сеанс — счётчик сеансов у клиента изменился, без
  переоткрытия вида
- **Найдено Gate 0 ревизии 2 по брифу #159** (`codex-reports/CX-GATE0-159-rev2.md`), то есть
  ревью дизайна нашло дефект не в дизайне, а в выпущенном коде. Проверено отдельно.
- `View.svelte` перезагружал внешние фреймы только при смене набора целевых id или собственного
  кадра (`dataGeneration`). Изменение заметки в **целевом** проекте ни то, ни другое не двигает,
  поэтому rollup и relation-производные колонки оставались с прежними числами до тех пор, пока не
  изменится сам проект-источник или вид не откроют заново.
- Это ровно сценарий эссе: «в дашборде клиентов появляется колонка "Количество сеансов" — она
  вычисляется автоматически». Автоматичность ломалась молча, и #141 без этой правки чинил только
  половину пути: значение считалось верно один раз.
- Механизм уже существовал и использовался: `externalFrameInvalidation` бампится в `App.svelte` на
  каждое vault-событие create/modify/delete/rename, и `DashboardCanvas` слушает его с самого
  начала. Вид просто не был подписан — правка в одну зависимость реактивного блока.
- **Не закрыто этим тикетом (осталось в #159 как вход для дизайна):** ключ кэша внешних фреймов в
  `App.svelte` состоит из `id|name`, поэтому смена `fieldConfig`, native-query или Dataview-запроса
  целевого проекта кэш не инвалидирует; и пока внешние фреймы грузятся, вид считает по сырому
  кадру, не отличая «ещё не готово» от «пусто».

### #161 — Вызывающие считают неудачную запись успешной
- Status: ✅ DONE (2026-08-28, рабочее дерево)
- `ViewApi.updateRecord` возвращает `boolean`: дошло ли изменение до файла.
- `CalendarView` перестал зеркалить неудачу в трёх местах — редактирование заметки, смена цвета,
  чекбокс в поповере дня. Раньше после отката в store календарь клал значение обратно на экран.
- Notice о неполной массовой записи по-прежнему без контекста вида — известное ограничение,
  отмечено здесь; контекст появится вместе с привязкой уведомлений к виду. | Milestone: (next) | Priority: P2 | Complexity: S
- analysis_required: false | Depends on: #144
- Vision scene: 3. User outcome: если запись не удалась, ни одно представление не показывает
  значение, которого нет в файле.
- После #144 `ViewApi.updateRecord` откатывает свой store и показывает Notice, но вызывающие,
  которые ведут собственную копию, об этом не знают: `CalendarView.svelte:926` после `await`
  кладёт запись в локальный frame безусловно. Найдено кросс-модельным ревью 2026-08-27.
- Работа: пройти вызовы `api.updateRecord` и либо перевести их на исход (сделать его
  возвращаемым значением), либо убрать локальное дублирование стейта там, где оно не нужно.
- Заодно: Notice о неполной массовой записи не несёт контекста проекта/вида и может всплыть уже
  после переключения — стоит либо добавить контекст, либо привязать к виду.

### #158 — R0/R1 user acceptance в чистом OBStests vault
- Status: 🔶 ЧАСТИЧНО (2026-08-28) — API-наблюдаемая часть пройдена, визуальная остаётся
- Milestone: (next) | Priority: P0 | Complexity: M
- **Пройдено 2026-08-28 через Obsidian Local REST API** (`MANUAL_TESTING_PIPELINE.md` §1–§4a):
  деплой трёх артефактов, reload, ровно 10 команд, смоук демо A1–A7, roundtrip PUT/GET/DELETE,
  и новый раздел 4a — миграция конфигурации M1–M5 с проверкой содержимого файлов восстановления.
- **Прогон нашёл два дефекта, оба исправлены и перепроверены вживую:** правило «одна копия на вид»
  в #145 теряло до-состояние второго события миграции; демо-генератор поставляет legacy-пайплайны
  и мигрирует сам себя при первом открытии (#164).
- **Остаётся человеку:** всё, что REST не видит — рендер, консольные ошибки, DnD, hover.
  Чек-лист по тикетам этого стека: `UNTESTABLE_FEATURES_2026-08-28.md`.
- **Честная граница (из кросс-модельного аудита улик):** 10 зарегистрированных команд не
  доказывают работоспособность ни одного callback; успешное создание демо не доказывает, что
  дашборд отрисовался; наличие файлов восстановления не доказывает возможность восстановления.
  Поэтому статус «частично», а не DONE.
- analysis_required: false
- Vision scene: 4. User outcome: сценарий «Клиенты → Сеансы» проходится в реальном Obsidian со
  скриншотами, клавиатурным путём и внешней правкой Markdown.
- **Почему отложен:** тикеты на визуальный тест ещё не написаны. До их появления роль
  доказательства исполняет рендер-проход из кода (`CODEX_RENDER_TASKS_2026-08-27.md`,
  отчёты `CX-R1…R4`), который уже нашёл #141 и #142.
- **Чем рендер не является:** это гипотеза из кода, а не наблюдение. Он не закрывает
  `MANUAL_TESTING_PIPELINE.md:130-161` (четыре пустых чекбокса) и не отменяет того, что #115
  помечен DONE с непройденной ручной приёмкой.
- Разблокировать вместе с тикетами на визуальный тест и вернуть в P0.


---

## Пред-релизный аудит 2026-08-31 — #171–#177

Заведены по `PRE_RELEASE_AUDIT_2026-08-31.md`. #172, #173, #175 — блокеры объявления пре-альфы.

### #171 — `main.js` и `releases/`: 15 МБ собранных бандлов в дереве вопреки собственной политике
- Status: 📋 BACKLOG (→ аудит Codex, решение пользователя) | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: **true — разбор поручен Codex**
- Vision scene: none — инфраструктура | User outcome: публикация бандла уходит отдельным релизом, а не коммитом
- `.gitignore:8-10` объявляет «Don't include the compiled main.js file in the repo. They should be
  uploaded to GitHub releases instead» и тут же отменяет это строкой `!releases/*/main.js`.
- Замерено: `releases/` — 32 файла / **12,3 МБ**, из них 7 бандлов; корневой `main.js` — 2,78 МБ;
  `.git` — 61 МБ. Корневой файл отслеживается только потому, что правило появилось позже него.
- Ни `ci.yml`, ни `release.yml` закоммиченный бандл не читают — оба собирают свой.
- Цена: неразрешимый конфликт в минифицированном файле между любыми двумя собиравшимися ветками
  (наблюдалось 2026-08-30), грязное дерево у CI-раннера, вес клона.
- **Почему не правится напрямую:** снятие с учёта ломает установку плагина прямо из репозитория.
  Пользователь решил отдать вопрос аудиту Codex — суть ограничения в том, чтобы публикации бандла
  шли отдельным релизом.

### #172 — CHANGELOG не знает о четырёх месяцах работы — БЛОКЕР РЕЛИЗА
- Status: ✅ DONE (2026-08-31) | Milestone: pre-alpha | Priority: **P0** | Complexity: M
- **Сделано:** добавлен раздел `[Unreleased] — 3.5.1-alpha плюс 310 коммитов` (Added / Changed /
  Fixed / Removed) и отметки версий `[3.5.1-alpha] 2026-05-14`, `[3.5.0-alpha] 2026-05-10`,
  `[3.4.2] 2026-05-05` с коммитами, которыми они проставлены. Покрыты M-RELATION-FIRST (#110–#115),
  M-FILTER-CONSOLIDATION (#116–#128), граница внешнего источника (#136–#139, #142), исходы записи
  (#141, #144, #161–#163), честность интерфейса (#155, #156), удаления (#119, #120, #129, #160),
  i18n (#130) и потеря/восстановление `styles.css`.
- **Чего НЕ делал:** раздел «[Unreleased — V5 internal] (3.4.2)» оставлен как есть. Его подпись
  неточна (он написан до отметок 3.5.0/3.5.1), и это сказано прямо в новом разделе — но его
  содержание построчно не перепроверялось, а переписывать непроверенное хуже, чем пометить.
- analysis_required: false
- Vision scene: none — релизная гигиена | User outcome: пользователь понимает, что изменилось
- Последняя версионная запись — `[3.4.1] - 2026-04-21`, дальше только «Unreleased — V5 internal
  (3.4.2)» и «Documentation drift recovery — 2026-05-25». Текущая версия — `3.5.1-alpha`.
- В файле нет ни одного упоминания #115, #141, #160, #164; `#118` встречается один раз.
- Не описаны: M-RELATION-FIRST, M-FILTER-CONSOLIDATION, весь стек мета-аудита #141–#164, удаление
  модели sub-base, восстановление `styles.css`.

### #173 — README обещает удалённую функцию — БЛОКЕР РЕЛИЗА
- Status: ✅ DONE (2026-08-31) | Milestone: pre-alpha | Priority: **P0** | Complexity: S
- **Сделано:** в `README.md` и `README-EN.md` строка про «Матрёшка (sub-bases)» заменена на то,
  что действительно есть — связи между проектами со статусами ссылки, обратной связью и rollup.
  Строка вех `M-SUBBASES` помечена «⛔ Отозвано» со ссылками на #119/#160, рядом добавлены
  M-RELATION-FIRST и M-FILTER-CONSOLIDATION, которых в таблице не было вовсе. В `RELEASES.md` и
  `RELEASES-EN.md` строка дорожной карты «Dashboard Engine — relations, rollup, **sub-bases**,
  Dataview bridge … В разработке» больше не обещает sub-bases; отзыв вынесен отдельной строкой.
- **Проверено отдельно:** «Матрёшка» в строке 239 обеих локалей — это архитектурная метафора
  (Shell → UI → Engine → Data) и принцип адаптивности M-MATRYOSHKA, а не функция sub-base.
  Оставлена намеренно. `RELEASES` в остальном описывает прошлые выпуски и не переписывался.
- analysis_required: false
- Vision scene: 7 | User outcome: обещанное на витрине существует в продукте
- `README.md:107` — «**Матрёшка** (sub-bases) — база данных внутри базы данных через wikilink-связи»;
  `README.md:161` — «`M-SUBBASES` … ✅ Готово». То же в `README-EN.md`, `RELEASES.md`, `RELEASES-EN.md`.
- Факт: `SubBaseCanvas` удалён в #119, модель — в #160, команда `add-sub-base` снята (живой прогон:
  10 команд). Остались только ключи `DataTableConfig.subBases` как несовместимые-к-удалению данные.
- Тот же класс, что #155/#156: интерфейс обещает то, чего нет.

### #174 — Канонические контракты не имеют заголовков и TSDoc
- Status: ✅ DONE (2026-08-31) — четыре «Key files» и весь названный остаток | Milestone: (next) | Priority: P1 | Complexity: M
- **Сделано:** заголовки и TSDoc для всех четырёх файлов, на которые `CLAUDE.md` указывает как на
  «Key files»: `relationContract.ts` (что такое связь, лестница сопоставления путь → basename →
  display, граница с аналитическим join по #148), `relationSetup.ts` (почему чистая половина
  мастера отделена от модалки — три дефекта #150), `crossProjectResolver.ts` (обогащение как первая
  стадия канонического порядка, живой `targetSubBaseFilter` вопреки имени, легаси-fallback'и
  display-поля), `dataframe.ts` (`record.id` = путь в хранилище, `null` ≠ отсутствие, `derived` не
  пишется во frontmatter). Все экспорты этих файлов описаны.
- **ПОПРАВКА к исходному замеру.** Аудит назвал 628 экспортов (61 %) недокументированными —
  завышено дефектом самого скрипта: он считал документированным только то, перед чем строка
  **начинается** с `*/`, и пропускал однострочные `/** … */` (их 101). Плюс 27 самоочевидных
  type guard'ов. Проверенное значение — **485 из 1037 (47 %)**. Вывод не изменился, величина да.
- **Остаток закрыт 2026-08-31.** `transformTypes.ts`, `filterEvaluator.ts`, `contracts.ts`,
  `accessibility.ts` получили заголовки и TSDoc на все экспорты по тому же стандарту, что и
  четыре «Key files»: почему модуль существует и что нельзя сломать, а не пересказ строк.
- **Работа над остатком вскрыла три расхождения документации с кодом. Все три записаны в самих
  файлах, потому что там их прочтут:**
  1. **`contracts.ts` называет себя «NORMATIVE source of truth» несуществующего движка.**
     Проверено по дереву: за пределами файла кто-либо импортирует только `RecordId` и `ProjectId`
     (последний — сам ре-экспорт из `settings/base/settings`). У `FilterIR`, `RollupIR`,
     `FormulaIR`, `AggregateFn`, `SortIR`, `GroupIR`, `ComputeIR`, `AggregateIR`, `TransformStep`,
     `EngineDiagnostic`, `DataEngineRequest`, `DataEngineResult` — **ноль потребителей**. Заголовок
     теперь начинается с этого факта и таблицы «что здесь написано / что реально работает»;
     исходный текст оставлен ниже как запись замысла, а не как описание кода.
  2. **Два разных экспортируемых типа с именем `TransformStep`.** В `contracts.ts` — по `kind` с
     вложенным `payload` (мёртвый), в `dashboard-engine/transformTypes.ts` — по `type`, плоский
     (живой, хранится на диске и исполняется). Импорт не того типа проходит проверку типов в ряде
     мест. Предупреждение добавлено в оба файла.
  3. **`AggregationFunction` — третий, ни с чем не связанный словарь агрегации.** Пайплайн не
     делегирует ядру: `computeAggFn` в `transformExecutor.ts` считает SUM/AVG/… сам, тогда как
     `lib/engine/aggregate.ts` живёт на `RollupFunction`, а подвалы таблиц — на
     `ColumnAggregation`. Исправление в ядре до пайплайна не доходит. Это записано, но **не
     исправлено** — сведение словарей меняет сохранённые данные и требует тикета и решения.
- **Прочее найденное и исправленное по ходу:** устаревший путь в первой строке `transformTypes.ts`
  (`src/ui/views/Dashboard/engine/…` — файл лежит в `src/lib/dashboard-engine/`); список «Used by»
  в шапке `filterEvaluator.ts` называл два потребителя, один из них по несуществующему пути, тогда
  как импортёров около дюжины; комментарий `announceChange` обещал «Get … text», хотя функция
  ничего не возвращает, а пишет.
- **`accessibility.ts`: у модуля почти нет потребителей.** В продукте вызывается только
  `ariaWidget` (`WidgetShell.svelte`); `ariaGrid`, `ariaGridCell`, `navigateGrid`, `navigateList`,
  `focusGridCell`, `announceChange` достижимы лишь из собственной сюиты. Одноимённая `navigateGrid`
  в `Calendar/Day.svelte` — другая локальная функция, этот модуль она не импортирует. Сказано в
  заголовке прямо, чтобы зелёная сюита не читалась как доказательство доступности виджета.
- **Чего НЕ делал:** 122 tsdoc-warning не трогал — они остаются «pre-existing and counted»
  (проверено, что новых не внесено: два появившихся исправлены до нуля). `.svelte` по-прежнему вне
  метрики. Содержательное качество ранее существовавших комментариев не пересматривалось, кроме
  четырёх прямо ошибочных мест выше. Мёртвый код не удалялся: `contracts.ts` описан, а не вычищен —
  удаление слоя это отдельное решение.
- Гейты: build 0, jest 176/2473, lint 0 errors / 122 warnings, svelte-check 0/0.
  `main.js` и `styles.css` не изменились (`git diff --numstat` — только четыре исходника):
  правка только в комментариях, минифицированный бандл побайтово тот же.
- analysis_required: false
- Vision scene: none — сопровождаемость | User outcome: мейнтейнер, идущий по `CLAUDE.md`, попадает в объяснённый код
- Замерено по 263 не-тестовым `.ts`: **53 %** модулей без заголовочного комментария,
  **628 из 1037 (61 %)** экспортов без документации.
- Хуже всего — ровно те файлы, что `CLAUDE.md` называет «Key files»: `lib/dataframe/dataframe.ts`
  (нет заголовка, 18 недокументированных экспортов), `lib/relations/relationContract.ts` (нет
  заголовка, 12), `lib/relations/relationSetup.ts` (нет, 8), `lib/engine/crossProjectResolver.ts`
  (нет, 5). Далее `transformTypes.ts` (16), `filterEvaluator.ts` (12), `contracts.ts` (11).
- Плюс 122 tsdoc-warning в 47 файлах — там, где комментарии есть, они не парсятся как TSDoc.
- **Работа:** начать с четырёх «Key files», а не с общего долга. Метрика `.svelte` не покрывает —
  реальная доля выше.

### #175 — Идентичность релиза: три разных числа для одной сборки — БЛОКЕР РЕЛИЗА
- Status: ✅ DONE (2026-08-31) — решение принято пользователем, репозиторий приведён | Milestone: pre-alpha | Priority: **P0** | Complexity: S
- **Решение пользователя (2026-08-31):** поднять версию в репозитории и выпускать осмысленные
  релизы отдельным тегом, оставив поток `0.0.0-<прогон>` служебным.
- **Сделано:** `package.json` и `manifest.json` подняты `3.5.1-alpha` → **`3.6.0-alpha`**, в
  `versions.json` добавлена запись `3.6.0-alpha → 1.5.7`, раздел CHANGELOG переименован из
  `[Unreleased]` в `[3.6.0-alpha] - 2026-08-31` с объяснением, почему minor, а не patch.
- **Почему не `3.4.2-alpha`,** как предполагалось изначально: по semver
  `3.4.2-alpha < 3.4.2-alpha.1 < 3.4.2 < 3.5.0-alpha < 3.5.1-alpha`, то есть это шаг ниже всего
  уже выпущенного, и обновление не было бы предложено никому. Источник заблуждения найден —
  секция CHANGELOG «[Unreleased — V5 internal] (3.4.2)» продолжала называть текущую разработку
  3.4.2 после того, как `package.json` ушёл на 3.5.x в мае.
- **Установлено: 3.5.0-alpha существовала.** Коммит `2af8a50` (2026-05-10, «feat(v6): Dashboard V2
  alpha») ставит `3.5.0-alpha` и в `package.json`, и в `manifest.json` — это ровно тот коммит, на
  который ссылается `types.ts`. Обоснование в коде верно; неполон был `versions.json`.
- **Сделано:** в `versions.json` добавлены пропущенные `3.4.2` и `3.5.0-alpha` (обе `minAppVersion
  1.5.7`, взято из манифестов тех коммитов). Обоснование сохранения `DataTableConfig.subBases`
  подтверждено фактом, а не снято.
- **Установлено: версия перестала отслеживать реальность 14 мая.** `3.5.1-alpha` проставлена
  `9034cea` 2026-05-14, поверх неё легло **310 коммитов** без единого повышения.
- **Осталось за пользователем — решение, а не работа:** какой номер несёт пре-альфа и что делать
  со схемой тегов. Сейчас `ci.yml` на каждый пуш в `main` публикует пререлиз с тегом
  `0.0.0-${{ github.run_number }}`, кладя внутрь `manifest.json` с версией `3.5.1-beta.<N>`, тогда
  как репозиторий говорит `3.5.1-alpha`. Тег `0.0.0-58` пользователю не сообщает ничего.
- analysis_required: false
- Vision scene: none — релизная гигиена | User outcome: версия в релизе означает что-то определённое
- `ci.yml` на каждый пуш в `main` делает `cp manifest-beta.json manifest.json` и публикует пререлиз
  с тегом `0.0.0-${{ github.run_number }}`. Отсюда: тег `0.0.0-58`, `manifest.json` в артефакте
  `3.5.1-beta.58`, репозиторий `3.5.1-alpha`.
- `versions.json` не содержит `3.5.0` (идёт `3.4.2-alpha.1 → 3.5.1-alpha`), при том что
  `types.ts` обосновывает сохранение ключей `subBases` тем, что «3.5.0-alpha **SHIPPED**» виджет.
  От ответа зависит, обязаны ли мы дальше тащить `DataTableConfig.subBases`.

### #176 — Инвариант 7 стережёт несуществующий каталог
- Status: ✅ DONE (2026-08-31) | Milestone: (next) | Priority: P3 | Complexity: XS
- **Решение: инвариант помечен историческим, каталог НЕ возвращён.** `src/archive/dashboard-v1`
  удалён коммитом `2e886a7` (#119, 5401 LOC) намеренно как мёртвый код; возвращать его — значит
  вернуть в дерево ровно то, от чего избавлялись. История хранится в git, а не в `src/`.
- **Сделано:** `R0_4_archiveContainment.test.ts` переписан так, что он больше не может пройти
  «ни на чём». Введена константа `ARCHIVE_PRESENT = false` — заявленный режим; первый тест падает,
  если дерево с ней разошлось. Вернуть архив по-прежнему можно: это осознанный флип константы,
  который тем же коммитом снова взводит скан вложенности. `CLAUDE.md` инвариант 7 переписан как
  HISTORICAL с объяснением, чтобы читатель отличал живое правило от мёртвого предмета.
- **Найдено сверх тикета: старый матчер был дефектен и до удаления каталога.** Он искал только
  `from "src/archive/…"` и `require("src/archive/…")`. Проверено запуском обеих старых регулярок:
  они не ловят ни `jest.mock("src/archive/…")` — а это ровно та последняя ссылка на архив, что
  дожила до `2e886a7^` в `dataProviderRegistration.test.ts`, — ни относительный `../archive/…`,
  которых в дереве 264 штуки по стилю импорта. То есть ратчет был дырявым и в те дни, когда предмет
  существовал. Новый матчер покрывает `from`, голый `import`, `require`, динамический `import()` и
  `jest.mock`, и намеренно НЕ считает импортом строку-данные: `{ id: "archive/Sam.md" }` из
  `relationSetup.test.ts` — идентификатор записи, а не спецификатор модуля.
- **Логика вложенности вынесена в чистую функцию** и проверяется своими случаями независимо от
  того, что лежит на диске: правило доказано работающим до того, как снова понадобится.
- **Проверено падением, а не рассуждением** (как #164 и R0.8): (1) создан `src/archive/probe.ts` →
  тест режима упал `Expected: false / Received: true`; (2) в `customViewApi.ts` добавлен
  `jest.mock("src/archive/probe")` → скан упал с `customViewApi.ts → src/archive/probe`. Обе пробы
  откачены, дерево чистое.
- **Чего НЕ делал:** сам файл ратчета исключён из живого скана (он обязан цитировать нарушения,
  которые описывает) — та же самооговорка, что у R0.7 для чисел. Чтобы исключение не разрослось,
  добавлен тест «scans the tree it claims to scan». Каталог `src/archive` не восстанавливался;
  прочие инварианты `CLAUDE.md` на живость не перепроверялись — проверялся только седьмой.
- Гейты: build 0, jest 175/2465 (+5 к базовой линии), lint 0 errors / 122 warnings, svelte-check 0/0.
  `main.js` и `styles.css` пересобраны побайтово идентично (`git diff --numstat` — только тест).
- analysis_required: false
- Vision scene: none | User outcome: список инвариантов не содержит мёртвых
- `CLAUDE.md` инвариант 7 и ратчет `R0_4_archiveContainment.test.ts` защищают `src/archive`.
  Каталога в дереве нет — ратчет проходит вакуумно.
- **Работа:** либо пометить инвариант как исторический, либо вернуть каталог. Сейчас читатель не
  может отличить живое правило от мёртвого.

### #177 — Хук `check-commit-branch` даёт ложные срабатывания
- Status: ✅ DONE (2026-08-31) | Milestone: (next) | Priority: P2 | Complexity: S
- **Сделано:** хук больше не ищет подстроку и не верит снимку. Он маскирует heredoc'и и
  закавыченные аргументы (там живёт «упоминание»), режет остаток на сегменты команд, читает
  **командную позицию** каждого сегмента, и проходит по ним по порядку, отслеживая ветку, на
  которой последовательность реально окажется. Каждый `commit` судится по той ветке, что будет
  текущей в момент его выполнения, а не в момент проверки.
- **Найдено сверх тикета — хук был не только шумным, но и дырявым.** Инвариант 12 обходился двумя
  способами, и оба воспроизведены до правки:
  1. `git checkout main && git commit …` с фиче-ветки — **разрешалось**, потому что на момент
     проверки HEAD ещё на фиче-ветке. Это ровно то нарушение, ради которого правило существует.
  2. `git -C . commit …` на `main` — **разрешалось**, потому что регулярка требовала `git` и
     `commit` вплотную. Любая опция между ними снимала защиту.
- **Найдено сверх тикета — молчаливое отключение.** Первая версия правки содержала длинное тире;
  PowerShell 5.1 читает `.ps1` без BOM как ANSI, и файл перестал компилироваться. Ошибка разбора
  даёт **exit 1**, а не 2, то есть Claude Code читает это как ALLOW: хук не охранял ничего и никак
  об этом не сообщал. Отсюда правило «ASCII only» в шапке хука и тест «the hook still compiles».
  Остальные четыре хука проверены на не-ASCII — чисто (0 байт >127 в каждом).
- **Ратчет R0.9** (`src/__tests__/R0_9_commitHookPrecision.test.ts`) — 8 тестов, закрепляющих оба
  ложных срабатывания, обе дыры и живость файла. HEAD берётся из одноразовых репозиториев во
  временном каталоге, а не из текущего checkout, поэтому ожидания не зависят от ветки мейнтейнера.
  Все случаи судятся в **одном** процессе PowerShell через новую точку входа `-Command`: спавн на
  случай стоил 24 с — больше, чем весь остальной прогон; стало 4,7 с.
- **Проверено падением, а не рассуждением:** пре-#177 логика возвращена на место (с той же точкой
  входа `-Command`, чтобы сравнивалась именно логика) — R0.9 упал **5 из 8**, при этом «blocks a
  real commit on main» и «allows a commit on a feature branch» остались зелёными. То есть сюита
  различает исправленное поведение, а не падает целиком.
- **Живая проверка через настоящую обвязку, а не только через сюиту:** на `main`
  `grep -n "git commit" .github/workflows/ci.yml` теперь читается (строка 62 — коммит CI-бота);
  `git commit --allow-empty` на `main` заблокирован новым сообщением; `git checkout -b … && git
  commit …` одной командой дошёл до git, который отказал сам («nothing to commit»).
- **Чего НЕ делал:** вне охвата остались алиасы и функции оболочки, `$(...)`, раскрывающийся в
  коммит, и прочие порождающие коммит команды — `revert`, `cherry-pick`, `merge`. `merge` исключён
  намеренно: слияние в `main` — санкционированный путь и с 2026-08-30 не является гейтом.
  Незакрытый heredoc деградирует в пере-блокировку, то есть в безопасную сторону. Всё это записано
  в шапке хука, а не только здесь.
- **Важно для читателя:** `.claude/` в `.gitignore` — сам хук в репозиторий не попадает и живёт
  только на машине мейнтейнера. В git уходят ратчет R0.9 и эта запись; R0.9 пропускает себя
  (`describe.skip`) там, где хука нет, — та же позиция, что у R0.7 к агентским конфигам.
- Гейты: build 0, jest 176/2473, lint 0 errors / 122 warnings (новых tsdoc-предупреждений не
  внесено — два появившихся исправлены), svelte-check 0/0.
- analysis_required: false
- Vision scene: none — инструментарий | User outcome: защита ловит нарушения, а не упоминания
- Хук ищет подстроку в тексте команды и читает ветку **до** выполнения. Наблюдено 2026-08-30/31:
  (1) `grep` по `ci.yml` с искомой строкой в шаблоне блокируется — workflow нельзя прочитать на
  `main`; (2) «создать ветку и закоммитить» одной командой блокируется, потому что HEAD ещё на `main`.
- Инвариант 12 правильный и остаётся — чинить реализацию, а не правило.

## Находки оркестратора 2026-08-31 — #178–#180

Найдены при документировании #174, намеренно **не** починены: каждая меняет либо хранимые данные,
либо состав слоёв, то есть требует решения, а не уборки. Все три перепроверены в основной сессии.

### #178 — `lib/engine/contracts.ts` описывает движок, который не построили
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: **true** — это решение об архитектуре, а не правка
- Vision scene: none — сопровождаемость | User outcome: «нормативный» документ не расходится с кодом
- Заголовок файла называет себя «NORMATIVE source of truth», при этом наружу используются только
  `RecordId` (1 файл) и `ProjectId` (22 файла). Проверено 2026-08-31: `FilterIR`, `RollupIR`,
  `AggregateFn` — **ноль** потребителей вне самого файла; то же у конвертов DataEngine.
- Оркестратор уже вписал в шапку файла предупреждение «UNCONSUMED. Read this paragraph before
  believing the rest of the header», так что читатель больше не введён в заблуждение. Открытым
  остаётся вопрос: достроить слой, вынести два живых типа и удалить остальное, или оставить как
  проектный документ — но тогда не в `src/`.

### #179 — `TransformStep` — имя двух разных экспортируемых типов
- Status: 📋 BACKLOG | Milestone: (next) | Priority: **P1** | Complexity: S
- analysis_required: false
- Vision scene: none | User outcome: невозможно импортировать не тот тип и не заметить
- `src/lib/dashboard-engine/transformTypes.ts:62` — живой хранимый тип, различитель `type`.
  `src/lib/engine/contracts.ts:282` — мёртвый IR, различитель `kind`.
- Обе строки проверены 2026-08-31. Импорт не того типа проходит проверку типов там, где поля
  пересекаются, — а `kind` вместо `type` это ровно та ловушка посева, о которой дважды
  предупреждает `MANUAL_TESTING_PIPELINE.md` §4a: мигратор молча игнорирует шаг с `kind`.
- P1 не по объёму, а по цене ошибки: она молчаливая.

### #180 — Третий словарь агрегаций: `computeAggFn` не зовёт ядро
- Status: 📋 BACKLOG | Milestone: (next) | Priority: P2 | Complexity: M
- analysis_required: **true** — унификация словарей меняет хранимые конфиги
- Vision scene: none | User outcome: исправление в ядре агрегации доходит до конвейера
- `transformExecutor.ts:804` — `computeAggFn` реализует `SUM`, `AVG`, `MEDIAN`, `COUNT`,
  `COUNT_DISTINCT` собственным `switch`, не обращаясь к `lib/engine/aggregate.ts`. Проверено
  2026-08-31: в `transformExecutor.ts` импорта ядра нет.
- Следствие: правка в ядре (например, обращение с `null` или пустым списком) до конвейера не
  доходит. Это тот же класс, что #104 и #126 — параллельная копия логики, которую гейты не видят,
  потому что обе копии зелены по отдельности.
- Словарей три: `AggregationFunction` (конвейер, ВЕРХНИЙ регистр), агрегации Stats-карточек
  (`count_total` / `count_values` / …) и ядро `aggregate.ts`. Свести — значит тронуть хранимые
  конфиги, поэтому нужен план.

### #181 — Ратчеты рабочего стека не переживают собственный worktree
- Status: 📋 BACKLOG | Milestone: (инфраструктура) | Priority: **P1** | Complexity: XS
- analysis_required: false
- Vision scene: none | User outcome: делегирование по маршрутизации перестаёт красить гейты
- **Найдено 2026-09-01 живым прогоном**, а не рассуждением: после работы `implementer`
  (в его определении `isolation: worktree`) `npx jest` дал три красных сьюта — R0.7, R0.10, R0.11.
  Ни одно из «нарушений» не относилось к изменению: R0.7 сообщил 156 находок, первые из них —
  `CHANGELOG.md` внутри `.claude/worktrees/agent-<id>/`.
- **Причина одна на три файла:** `R0_7:58`, `R0_10:77`, `R0_11:58` — три одинаковых рекурсивных
  обхода без единого исключения, а `.claude/worktrees/` это полная копия репозитория, включая
  `node_modules`. Обход `.claude` сам по себе верен; неверно то, что worktree живёт внутри
  сканируемого корня.
- **Почему это не заметили раньше:** внутри worktree у ратчетов нет своего `.claude/`, и сьюты
  там **скипаются** (`3 skipped` в прогоне агента). Главное дерево видит ложные падения, агент —
  ложную тишину. Ни одна из сторон не видит правды, что и есть определение дыры в гейте.
- **Работа:** исключить `worktrees` (и вложенные `node_modules`, `.git`) из обхода во всех трёх
  ратчетах — один общий предикат, а не три копии предиката. Плюс кейс, доказывающий исключение:
  подсаженный файл в `worktrees/` не должен давать находку, подсаженный в `.claude/agents/` —
  должен. Иначе исключение однажды проглотит настоящую находку.
- **Смежная операционная ловушка, найденная тем же прогоном.** Агент кладёт в worktree junction на
  настоящий `node_modules`; `git worktree remove --force` проходит по junction и вычищает реальный
  каталог зависимостей (восстанавливается `npm ci`, исходники не страдают). Снимать junction до
  удаления worktree — записать в протокол, а не запоминать.

## Milestone M-MATRYOSHKA — 📋 PLANNED (референс-анализ Notion, 2026-08-28)

> **Основание:** `REFERENCE_NOTION_UI_2026.md` (свежий анализ Notion по совпадающим элементам +
> цепочки «внимание → действие») и холодный аудит адаптивности
> `codex-reports/CX-MATRYOSHKA-audit.md`.
> **Принцип вехи:** *контейнер определяет размер, вид определяет вопрос, источник определяет ответ.*
> **Порядок:** #165 → #166 → #167 (адаптивность), параллельно #168 → #169 (внимание и фокус).
> #170 — ревизия решения по сцене 5 с учётом референса.

### #165 — Принцип матрёшки не участвует в сборке
- Status: ⚠ КОД ГОТОВ, МЕХАНИЗМ ИЗМЕРЕН 2026-09-02, ждёт adversarial-ревью и слияния (ветка
  `feat/165-token-consolidation`; в `main` НЕ слито) | Milestone: M-MATRYOSHKA | Priority: **P1** | Complexity: M (было S)
- **Сделано 2026-09-01:** четыре шага плана (`b3fa019`, `81ab75c`, `dabcc34`, `9e870e4`) плюс
  усиление ратчета по итогам аудита Codex (`e3f949c`). Четыре гейта зелёные, база выросла
  (см. `CONTEXT.md`). Живой прогон в OBStests: плагин грузится, ровно 10 команд, dashboard-вью
  открывается, `getDesignTokenCSS` отсутствует в поставляемом бандле, пилотное правило в нём есть.
- **Механизм второго уровня измерен 2026-09-02** (`UNTESTABLE_FEATURES_2026-09-01.md`
  §"Resolved 2026-09-02"): проба `docs/internal/probes/165-cqi-in-custom-property.html` в headless
  Chrome даёт 16px в контейнере 200px и 18.4px в контейнере 800px — ровно арифметика объявления и
  один в один с формулой, записанной inline. `cqi` внутри наследуемого custom property разрешается
  у потребителя, а не в `:root`; условия отката `9e870e4` больше нет. Побочная находка: без
  контейнера-предка потребитель получает **максимум** шкалы (fallback на viewport) — ограничение
  для #166, R0.13 этого не видит. Что осталось — суждение о внешнем виде роста в широком чарте;
  пол шкалы равен наследуемому размеру, так что худший случай — сегодняшний рендер.
- **Adversarial-ревью 2026-09-02 (`codex-reports/CX-ADV-165.md`): вердикт BLOCK, две находки,
  обе верны по коду, обе закрыты в ветке.**
  - **P1 — пилот не делает подписи SVG-чартов контейнерными.** Проверено: `BarChart:157`,
    `LineChart:175`, `ScatterChart:145`, `PieChart:129`, `ProgressChart:26` задают
    `font-size="11"`-атрибуты в user units viewBox — они игнорируют наследование и растут
    геометрически вместе с SVG (у корня только `viewBox`, ширины нет). Токен на обёртке доходит
    до HTML-текста — `NumberChart` (без своего font-size) и баннеров — и до отступов.
    **Решение: исправлено обещание, а не дописана фича** — комментарий в `ChartWidget.svelte`,
    пост-заметка в ADR, поправка в `UNTESTABLE_FEATURES`; маршрутизация SVG-подписей через шкалу
    записана в #166. Пилот стоит на измеренном механизме и настоящем потребителе.
  - **P2 — R0.13 ловил только строковую форму второй шкалы.** `setProperty("--ppp-…")` и `.js`
    прошли бы. Закрыто правилом: `assignedTokenNames` + тест «no module assigns a name from the
    scale through the CSSOM» (только имена, которыми владеет `tokens.css`, per-instance
    переменные проходят), `.js` включён в обход. Доказано на подсаженном файле: владеемое имя —
    падение с точным путём, per-instance — зелёный. **Граница, записанная в тесте:** имя,
    собранное в рантайме или разбитое по строкам, ратчет не увидит.
  - Без находки: путь к потолку (потребитель без контейнера) в продукте сейчас отсутствует —
    `ChartWidget` → `WidgetHost` → `WidgetShell`. Шим радиусов сохраняет значения, но переезд
    из inline `style` в стилевой файл меняет приоритет каскада относительно пользовательских
    сниппетов — условный риск, не регресс; фиксируется здесь, действий нет.
- analysis_required: **true** (было false) — **ГЕЙТ ЗАКРЫТ 2026-09-01**: план `ADR_TOKENS_MATRYOSHKA_2026-09-01.md` | Blocks: #166, #167
- **План принят (`docs/internal/ADR_TOKENS_MATRYOSHKA_2026-09-01.md`)** — четыре коммита:
  удалить мёртвый файл + ратчет R0.13 → слить `dashboardTokens.css` в `tokens.css` → снять
  TS-инъекцию (`getDesignTokenCSS`) с совместимостным шимом радиусов → второй уровень шкалы
  с одним пилотным потребителем. Ратчет — **R0.13**, не R0.12: `R0_12_hookPrecision` уже занят.
- **Найдено при планировании и решено внутри тикета:** `--ppp-radius-*` объявлен дважды со
  сдвигом на шаг (`tokens.css:51-57` против `designTokens.ts:44-51`), поэтому `--ppp-radius-md`
  значит разное под канвой и вне её. Сводим в один файл, сохраняя сегодняшнюю картинку через
  блок `.ppp-database-root`; выбор самой шкалы радиусов — отдельный тикет-последователь.
- **Тикет был написан против трёх CSS-файлов. Источников четыре, и один из них — TypeScript.**
  Замерено 2026-08-31:

| Источник | Кто импортирует | Состояние |
|---|---|---|
| `src/ui/tokens/tokens.css` (353 стр.) | `src/main.ts:11` | живой, **главный** |
| `src/ui/views/Dashboard/tokens/dashboardTokens.css` (51) | `src/main.ts:12` | живой |
| `src/ui/views/Dashboard/designTokens.ts` | `DashboardCanvas.svelte` → `getDesignTokenCSS` | **живой, TS, а не CSS** — вкладывает переменные в контейнер канвы |
| `src/lib/tokens/design-tokens.css` (314) | никто | мёртвый |

- **`styles.css` источником не является** — это результат пост-сборочного слияния (`mergeCSS`).
  Формулировка «действующие токены приходят из `ui/tokens/tokens.css`» была верна, а список в
  `CLAUDE.md` — нет; оба документа исправлены.
- **Принцип реализован наполовину, а не отсутствует.** `@container`-запросы живы в 6 компонентах
  (Календарь `Day` / `AllDayEventStrip` / `HeaderStripsSection`, Дашборд `ChartWidget` /
  `FilterTabsWidget` / `WidgetConfigShell`), `container-type: inline-size` объявлен в
  `ViewContent.svelte` и `Day.svelte`. То есть контейнер уже решает **точки перелома**. Чего он не
  решает — **размер**: контейнерных единиц (`cqi`/`cqw`/`cqh`/`cqb`/`cqmin`/`cqmax`) в `src/`
  **ноль**. Формулировка аудита «zero container units» верна буквально и вводит в заблуждение по
  смыслу, если читать её как «контейнерных запросов нет».
- `designTokens.ts` в собственной шапке заявляет «Container Queries (Матрёшка pattern)», поставляя
  при этом `rem`-шкалу — шапка обещает больше, чем модуль даёт.
- **Почему теперь нужен архитектор:** свести четыре источника к одному — значит тронуть путь,
  которым переменные попадают на канву (`getDesignTokenCSS`), а не просто удалить мёртвый файл.
  По правилам маршрутизации CLAUDE.md это эскалация, а не прямая правка.
- Vision scene: none — техническая база | User outcome: правки «по матрёшке» начинают влиять на пиксели
- `src/lib/tokens/design-tokens.css` — файл, который декларирует шкалу и принцип, — **мёртвый код**:
  он никогда не импортируется, действующие токены приходят из `ui/tokens/tokens.css`. Это записано
  в самом репозитории (`dashboardTokens.css:20`) и подтверждено аудитом. Пока это так, любая работа
  «по принципу» правит документ, а не интерфейс.
- **Работа:** свести к одному живому источнику токенов и удалить мёртвый; ввести **два уровня**
  шкалы — `:root` (абсолютная, как сейчас) и контейнерная (производная: отступы в `em`, типографика
  через `clamp()` от `cqi`).
- Регресс: тест, который падает, если файл токенов перестаёт быть импортирован.

### #166 — Родственность: размер вложенного определяется контейнером
- Status: 📋 BACKLOG | Milestone: M-MATRYOSHKA | Priority: **P1** | Complexity: L
- analysis_required: false | Depends on: #165
- Vision scene: 7 | User outcome: один и тот же блок в узкой колонке и во всю ширину выглядит
  соразмерно, а не одинаково
- **Передано из #165 (2026-09-02, CX-ADV-165):** подписи SVG-чартов — `font-size="11"`-атрибуты в
  user units viewBox (`BarChart:157`, `LineChart:175`, `ScatterChart:145`, `PieChart:129`,
  `ProgressChart:26`); они не наследуют `--ppp-local-*` и растут геометрически с SVG. Решить,
  переводить ли их на шкалу (CSS `font-size` на `text` перебивает атрибут) или оставить
  геометрию; сейчас шкала доходит только до `NumberChart` и баннеров. И ограничение из пробы:
  потребитель `--ppp-local-*` без контейнера-предка получает **потолок** clamp, а R0.13
  структурно этого не проверяет — каждому новому потребителю нужен контейнер выше.
- Измерено: 3378 `rem` против 31 `em`, **ноль** контейнерных единиц, 5 исполняемых `container-type`,
  из них один (`DataTableContent.svelte:255`) объявлен и никем не запрошен.
- **P0 внутри тикета — два места, где ломается содержимое:**
  - график получает фиксированный `width={480}` и реагирует на узкий контейнер только скрытием
    легенды (`ChartWidget.svelte:137,176`);
  - колонки таблицы фиксированы в `rem` при `min-width: max-content`, то есть горизонтальный скролл
    закреплён как контракт (`tableCanon.ts:29,95`).
- P1: `BlockFilterBar { min-width: 22rem }` в блоке, который может быть уже; `PipelineEditor`
  переключает раскладку по `@media`, то есть по окну, а не по виджету; попапы уходят в `body` и
  клампятся по viewport (`FloatingPopup.svelte:114,249,302`).
- **Работа:** каждый уровень цепочки (`ViewContent` → `DashboardCanvas` → `WidgetGrid` →
  `WidgetShell` → содержимое → попап) объявляет себя контейнером и задаёт детям локальную базу;
  фиксированные минимумы заменяются на `min(…, 100cqi)`; график и таблица получают ширину от
  контейнера.
- **Граница:** попапы и модалки верхнего уровня остаются привязанными к окну намеренно — это
  осознанный разрыв родственности, а не забытый; он должен быть записан, а не разрешаться молча.

### #167 — Инвариант: внутри контейнера нет `rem`
- Status: 📋 BACKLOG | Milestone: M-MATRYOSHKA | Priority: P2 | Complexity: S
- analysis_required: false | Depends on: #166
- Vision scene: none — инвариант | User outcome: принцип перестаёт зависеть от дисциплины
- `PX_BUDGET = 177` сторожит букву («мало px») и пропускает смысл: `rem` — это привязка к корню, то
  есть все матрёшки одного размера независимо от вложенности. Тест не заметил, что принцип потерян.
- **Работа:** заменить/дополнить бюджет проверкой родственности — внутри компонентов, лежащих в
  объявленном контейнере, размеры задаются `em`/`%`/`cq*`, а `rem` допустим только в списке
  верхнеуровневых поверхностей. Список — часть теста, а не соглашение.

### #168 — Пик вместо ухода: открытие записи не должно терять контекст
- Status: 📋 BACKLOG | Milestone: M-MATRYOSHKA | Priority: **P1** | Complexity: M
- analysis_required: false
- Vision scene: 3 | User outcome: клик по строке показывает запись, не уводя из представления
- Референс: у Notion три способа открыть запись — full page, **center peek**, **side peek**; во всех
  случаях, кроме первого, контекст остаётся `[док]`. У нас 32 места вызывают
  `workspace.openLinkText(...)` — то есть уход в редактор, и 4 места открывают модалку.
- **Работа:** контракт «открытие из представления по умолчанию — side peek» поверх существующего
  `VisualizerPane`; полноэкранный переход по модификатору. В пике показывать соответствие
  «поле ↔ ключ frontmatter» — этим закрывается сцена 3, которую сейчас не закрывает ничего.
- Побочно снимает часть #151: статус ссылки удобнее показывать в пике, чем в ячейке.

### #169 — Приоритет фокуса: визуальный вес и клавиатурный путь должны совпадать
- Status: 📋 BACKLOG | Milestone: M-MATRYOSHKA | Priority: P2 | Complexity: M
- analysis_required: false
- Vision scene: 7 | User outcome: клавиатурой доходишь до действия так же коротко, как мышью
- Аудит нашёл четыре расхождения: `SettingsMenuPopover` и `SlideInPanel` объявлены модальными, но не
  берут фокус, не держат Tab и не возвращают его (`SettingsMenuPopover.svelte:107,135`,
  `SlideInPanel.svelte:29,51`); скрытые hover-действия остаются в табуляции — `opacity: 0` без
  `inert` (`WidgetHeaderActions.svelte:121,145`); каждый `WidgetShell` добавляет лишнюю остановку
  Tab (`accessibility.ts:56`); слои используют разные шкалы `z-index`.
- **Работа:** focus-trap и возврат фокуса для модальных поверхностей, `inert` для скрытых действий,
  снятие лишней остановки, одна шкала слоёв. Плюс визуальный вес: первичное действие блока весомее
  cog, фильтр вида поднимается в постоянно видимую полосу — как у референса.

### #170 — Сцена 5 после референса: третий вариант, которого не было в брифе
- Status: 📋 BACKLOG | Milestone: M-MATRYOSHKA | Priority: **P1** | Complexity: M (решение)
- analysis_required: **true** | analysis_done: false | Depends on: #159
- Vision scene: 5 | User outcome: решение принимается со знанием того, как ту же задачу решил референс
- **Что показал референс `[док]`:** у Notion вид **никогда не бывает источником** — источником всегда
  является data source; фильтры живут на виде и не переиспользуются, связанный блок ссылается на
  источник и настраивает фильтры заново. То есть Notion **не выполняет** сцену 5 нашего эссе, он её
  обходит: делает виды дешёвыми и связываемыми и платит дублированием фильтров. Зато он ввёл
  уровень **контейнера** (`database`), который может держать несколько источников.
- **Следствие для нас:** у нас нет уровня контейнера, и именно его отсутствие толкает к введению
  четвёртой сущности «сохранённая выборка». Появляется третий вариант, которого не было в брифе
  #159: **проект как контейнер нескольких источников**, где именованная выборка — это источник, а не
  новая сущность рядом с видом.
- **Это не отменяет решение пользователя от 2026-08-27** (вариант 2). Тикет заводит сравнение трёх
  вариантов на одном столе: (A) компромисс Notion, (B) выборка как сущность (принято), (C) контейнер
  источников. Ревизия 3 брифа #159 обязана явно сказать, почему выбран тот, что выбран.


---

## Milestone M-SAVED-SELECTION — 📋 PLANNED (решение по #147, 2026-08-27)

> **Основание:** сцена 5 `DASHBOARD_V2_VISION.md` — «фильтр сам становится базой»; решение
> пользователя по #147 от 2026-08-27.
> **Порядок:** #160 (удалить заготовку) → #159 (бриф + Gate 0) → implementation-тикеты, которые
> заводятся ПОСЛЕ утверждения брифа, а не сейчас.
> **Не начинать реализацию до закрытия #143** — см. блок «Порядок разработки» ниже.

### #160 — Удалить брошенную модель sub-base, не задев живой `targetSubBaseFilter`
- Status: ✅ DONE (2026-08-27, рабочее дерево, без коммита) | Milestone: M-SAVED-SELECTION | Priority: P1 | Complexity: S
- **Удалено:** `subBase.ts`, `subBasePartition.ts`, `crossSubBase.ts` и четыре их тест-файла;
  команда палитры `add-sub-base` вместе с членом юниона `CommandBusAction` и записью в тесте;
  ключи i18n `add-sub-base` и `sub-bases` во всех четырёх локалях (валидность JSON проверена).
  Базовая линия: 176/2485 → 172/2436 — минус четыре сьюта мёртвого кода.
- **Найдено при удалении и потому НЕ удалено:** `DataTableConfig.subBases` /
  `activeSubBaseId`. `git log -S` показал, что 3.5.0-alpha (`2af8a50`) **выпускала** виджет
  `SubBaseCanvas`, который эти ключи писал (удалён позже в #119). Значит они могут лежать в
  реальном `data.json`, и удаление полей сделало бы сохранённый виджет немоделируемым — то же
  правило, что удержало отставленные `WidgetType` в #120. Поля оставлены, но отвязаны от
  удалённого модуля и типизированы как `readonly unknown[]`: переносятся, не интерпретируются.
- **Вход для #159 (что старая модель успела описать).** Sub-base был *именованным срезом внутри
  одного представления*: `id`, `name`, собственный `filter` поверх фильтра вида, необязательный
  `sort`, флаг `inheritColumns` и опциональный список колонок; партиционирование фрейма на срезы;
  резолвер связей «родительский индекс + предикат среза», чтобы не плодить по индексу на срез.
  Остановились строго перед UI («UI wiring lands in R2.2» — не случилось).
  **Почему это не заготовка для #159, а другой ответ:** старая модель по построению живёт внутри
  вида и не может быть выбрана источником где-то ещё — ровно то свойство, ради которого принят
  вариант 2. Ценен только резолвер «индекс + предикат»: он показывает, как считать связи в срез,
  не копируя записи.
- analysis_required: false | Blocks: #159
- Vision scene: 5. User outcome: в палитре команд нет пункта, который ничего не делает; в коде нет
  второй модели выборки, конкурирующей с будущей настоящей.
- **Что удаляется (проверено: production-импортов нет, только тесты друг друга):**
  - `src/lib/database/subBase.ts`, `src/lib/database/subBasePartition.ts` и их тесты;
  - `src/lib/relations/crossSubBase.ts` и его тесты (их два — `crossSubBase.test.ts` лежит и рядом
    с модулем, и в `__tests__/`);
  - команда палитры `add-sub-base` (`main.ts:298`) — **она живая и видна пользователю**, при этом
    `emitCommand("add-sub-base")` не обрабатывает никто: пункт есть, эффекта нет;
  - осиротевшие ключи i18n `commands.add-sub-base.*` и `views.dashboard…sub-bases.*` во всех
    четырёх локалях (правило #130: ключи убираются синхронно, не только в `en`).
- **Что НЕ удаляется, и это главный риск тикета:**
  - `RelationFieldConfig.targetSubBaseFilter` (`settings.ts:253`) — живой механизм: сужает цель
    связи, читается в `crossProjectResolver.ts:42` и `crossProjectRollup.ts:102`, редактируется в
    `ConfigureField.svelte:345-347`. После #141 этот путь стал реально достижимым, так что его
    поломка сразу видна пользователю. Одно слово, два разных механизма — ровно ловушка §3
    `PRODUCT_RESET`; в тикете это разводится явно.
  - Всё, что нужно уже сохранённому виджету `sub-base-canvas`, чтобы честно отрисоваться: член
    юниона `WidgetType` (решение #120 — иначе виджет в `data.json` перестаёт моделироваться),
    запись в `isRetiredLegacyType` и метаданные в `widgetRegistry`.
    **Правка тикета 2026-08-27:** сначала здесь было написано, что запись в `widgetRegistry`
    удаляется. Это неверно, проверено перед удалением: `DashboardBlockPalette.svelte:19` и
    `WidgetToolbar.svelte:38` скрывают legacy-типы, пока такого виджета нет на канве, — то есть
    запись ничего не рекламирует новому пользователю, а старому даёт лейбл и путь
    «Convert to V2 block». Убрав её, я ухудшил бы отображение чужих сохранённых дашбордов ради
    чистоты списка.
- **Побочный результат, который нужен #159:** при удалении зафиксировать в двух-трёх абзацах, что
  старая модель успела описать (id, имя, фильтр, настройки колонок; партиционирование фрейма) и на
  чём остановилась. Это вход для брифа, а не оправдание достройки.

### #159 — Бриф: выборка как адресуемый источник (design + Gate 0)
- Status: 🚧 IN-PROGRESS (2026-08-28) — ревизия 2 написана, ждёт повторного Gate 0
- Milestone: M-SAVED-SELECTION | Priority: P1 | Complexity: M (документ)
- analysis_required: true | analysis_done: false | Depends on: #160 ✅, #143 ✅
- Vision scene: 5 | User outcome: человек называет выборку и открывает её источником другого вида
- Документ: `SAVED_SELECTION_BRIEF_159.md`. **Ревизия 1 не прошла Gate 0** (2026-08-28,
  `codex-reports/CX-GATE0-159.md`): из трёх equivalence claims не выжил ни один, и два опровержения
  изменили дизайн, а не формулировки.
  - **«Выборка = блок с subFilter» — ложно.** `applyWidgetScope` откладывает `subFilter` за
    пайплайн, если он называет поле, которого нет в сыром frame (`widgetScope.ts:36`). Фильтр по
    `_group_size` или вычисленной колонке работает ПОСЛЕ C, а выборка, определённая как
    `applyFilter(raw, F)`, вернула бы пусто. → Ревизия 2 определяет выборку над **обогащённым**
    frame (после relation/rollup, до C) — иначе пример самого эссе («последний сеанс больше двух
    недель назад» — это rollup) невыразим.
  - **«Пересчитывается ровно при изменении frame» — ложно уже сегодня.** Членство движется вместе
    с часами (`is-today`, `is-overdue`, скользящие диапазоны) и с приходом внешних frame, при
    неизменном источнике; внешние frame к тому же кэшируются (`externalFrameCache`,
    `dashboardPreload`). → Ревизия 2 заменяет claim таблицей инвалидации; строка «часы» — с честной
    пометкой, что механизма нет, и выбором: либо запретить относительные даты в выборках, либо
    вводить тик.
  - **«Ничего не мигрирует» — ложно.** Смена `WidgetSourceConfig` на размеченное объединение ломает
    сохранённые внешние `database-call`: читатели спрашивают `sourceConfig.projectId`, и старый
    конфиг проваливается в parent-frame fallback, то есть молча показывает чужой проект — дефект
    #136, воспроизведённый сменой типа. → Нормализатор на чтении входит в v1.
  - **Q4 переписан.** Правило «все условия выразимы значением» не выживает: строгое сравнение пишет
    значение, не проходящее собственное условие; у отрицаний и унарных операторов нет
    удовлетворяющего значения; `OR` не требует всех условий, противоречивый `AND` не имеет решения;
    derived-поля вообще не пишутся во frontmatter (`dataApi.ts:233`); предикат самого источника
    (folder/tag/native-query) — вторые ворота. → Стало: создавать, только если систему может
    **построить кандидата и проверить его после записи**, иначе честное «Create in base».
- Дальше: ревизия 2 уходит на повторный Gate 0 (Q3 таблица инвалидации, Q4 verify-after-write,
  claim 3), и только после него бриф разбивается на implementation-тикеты.
- Vision scene: 5. User outcome брифа: описан путь, в котором человек называет выборку и открывает
  её как источник другого представления, и описано, что происходит во всех неудобных случаях.
- **Бриф обязан ответить, а не упомянуть:**
  1. **Хранение.** Где живёт выборка: рядом с проектами, внутри проекта, отдельным списком.
     Что является её идентичностью и что происходит при переименовании.
  2. **Область.** Выборка над одной базой или над несколькими; допускается ли выборка над выборкой.
  3. **Выбор источником.** `WidgetSourceConfig` сейчас знает только `projectId`
     (`types.ts:54-63`) — как он начинает различать проект и выборку, и что видит пользователь в
     списке источников.
  4. **Запись.** Добавление записи «в выборку»: в какую папку ложится файл, дописываются ли во
     frontmatter значения условий фильтра, и что делать, когда условие невыразимо значением
     (например `дата < сегодня - 14 дней`). Это главный вопрос: он отделяет живую базу от
     сохранённого запроса.
  5. **Поломка и пустота.** Удалено поле, по которому фильтрует выборка; выборка стала пустой;
     базы-источника больше нет. Для каждого — что видно на экране.
  6. **Отношение к трём осям фильтрации.** Выборка — это ось A (scope) с именем, или отдельный
     уровень над ней. Ответ обязан быть совместим с `FILTER_ORDER_ADR.md`, иначе ADR правится тем
     же брифом.
  7. **Отношение к Relation.** Может ли relation указывать на выборку, а не на проект. Ответ
     зависит от #143, поэтому #143 закрывается раньше.
  8. **Миграция.** Что происходит с существующими именованными представлениями-с-фильтром: они
     превращаются в выборки, сосуществуют или остаются как есть.
- **Обязательная секция equivalence claims** (`TWO_MODEL_PROTOCOL.md`): бриф переносит и заменяет
  существующие сущности, значит каждое «X и Y дают одинаковый результат» пишется отдельной строкой
  и уходит на Gate 0 в Codex до первой строки кода.
- Implementation-тикеты заводятся после утверждения брифа. Заранее их не плодим — размер и границы
  до ответов на пункты 1–8 неизвестны.

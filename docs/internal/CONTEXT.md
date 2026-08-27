# Current project context

> **Updated:** 2026-08-27 (post-#138; session report: `SESSION_REPORT_2026-08-27.md`)
> **Historical log:** `archive/CONTEXT_2026-06-26.md`
> **Active product contract:** `PRODUCT_RESET_2026-07-18.md`

## Current directive

Build a local Markdown-first system rather than a Notion clone. New product work follows the
Relation-first vertical slice in `BACKLOG.md` and must map to a scene in the Product Reset.
The old W2–W5 sequence is historical; it does not select the next product ticket.

## Working tree and release state

- **Branch `feat/116-filter-order-adr` — 54 commits, PUSHED to origin 2026-08-27, `main` untouched.**
  Working tree clean. Full account of the session in `SESSION_REPORT_2026-08-27.md`.
- **Open, user-owned:** Gate 3 (`/codex:review --base main`) has never run on this branch; merge to
  `main`; visual smoke of the A→C→B inversion in the OBStests vault.
- **Next ticket:** #132 (visible opt-in marker for linked-source pipelines) — the last of the
  linked-source stack, design in `LINKED_SOURCE_DESIGN.md` rev 2.

- Branch: `feat/112-guided-relation-setup` (accumulating #110+#111+#112+#113+#114; merge/push = user gate).
- Committed on this branch (not merged/pushed): `54217c1` (#105–#109 stabilization); `2785a4d`
  (#110 brief); `373a07e`+`2ed9903` (#111 canonical relation contract); `1c7df97` (#112 arch doc).
- Uncommitted WIP = complete #112+#113+#114 implementation: `relationSetup.ts`(+test),
  `RelationSetup.svelte` (full i18n 4 locales + displayField picker), `relationSetupModal.ts`,
  `relationSetupController.ts` (+7 controller unit tests), all entry points wired (schema editor /
  ConfigureField / CreateField / empty Relation cell event chain), `RelationPickerPopover.svelte`
  (setup-link + count badge), `EditableCell.svelte`/`TableRow.svelte`/`DataTableContent.svelte`
  (setupRelation event chain), `RelationCountBadge.svelte` (NEW), `smartSuggest.ts`+
  `dashboardSuggest.ts` (relation-block), `dashboardWidgets.ts` (initialConfig factory),
  `DashboardCanvas.svelte` (suggest + getPrimaryWidgetId extended), `canvasSelectionStore.ts`
  (composeEffectiveFilter extended, composeLinkedSelectionFilter unexported), `WidgetHost.svelte`
  (validateLegacyLinkedSelection wired), `DatabaseCallSettings.svelte` (relation-only picker),
  `DatabaseCallBlock.svelte` (3-state filter label), `SelectionBadge.svelte` (database-call added),
  widgetComponentRegistry.ts (LegacyLinkedSelectionStatus prop), canvasSelectionStore.test.ts
  (parity tests), relationFilterAdapter.test.ts (malformed-link edge cases). All 4 gates PASS.
- **Canonical baseline — branch `feat/116-filter-order-adr` (2026-08-27 post #138):
  173 suites / 2464 tests PASS, tsc 0, lint 0 (124 pre-existing tsdoc warnings),
  svelte-check 0/0, @ts-ignore 0, px ≤177.** Grew from 162/2288 via #117 (+24 filter-tab
  parity cases), #118 (+36: transform migration, widget scope, dashboard migration).
  Earlier history: #119 deleted dead dashboard-v1 archive → 168/2336 dropped to 162/2288
  (6 archived-code suites removed). Relation-first branch `feat/112` remains at 168/2336.
  Do not roll back.
- **Active milestone: M-FILTER-CONSOLIDATION** (audit `ARCHITECTURE_DEBT_AUDIT_2026-08-22.md`
  + design `FILTER_CONSOLIDATION_DESIGN.md`). Collapse 6 filter layers → 3 axes (A Scope /
  B Reactive / C Advanced), one engine, one documented order. **MILESTONE COMPLETE 2026-08-25:**
  #119 ✅ → #116 ✅ → #117 ✅ → #121 ✅ → #118 ✅ → #120 ✅ → #122 ✅. The model is documented in
  `FILTER_MODEL.md` (user-facing) + `FILTER_ORDER_ADR.md` (engine invariant). Ran BEFORE
  relation-first R3/R4 (user-approved 2026-08-22), which is now the next milestone.
- **#120 scope was corrected during implementation:** the `WidgetType` union was NOT trimmed. Four
  of the seven retired types have no successor, so dropping them would make stored `data.json`
  widgets unmodellable — data loss, and a schema-evolution violation. Only the provably dead
  `configPanelRegistry` entries went; `getConfigPanel` stays total via a `NO_PANEL` fallback because
  `WidgetHost` dereferences `.hasCog` unconditionally.
- **Follow-ups filed and closed 2026-08-25:** #123 ✅ (`promoteFilterTabToGlobal` now builds its
  condition via `deriveTabCondition`; it emitted a bare `"is"` for every field type, which silently
  dropped every record for Number/Boolean/Date/List) and #124 ✅ (16 orphaned `unnest-*` i18n keys
  removed across 4 locales).
- **Not yet done for this stack:** the Codex cross-model review (`/codex:review --base main`) and a
  visual smoke of the A→C→B inversion in the OBStests vault — a dashboard that mixes a pipeline
  `filter` with a block `subFilter` is the case to look at.
- **#118 landed the A→C→B behavioral inversion** (user confirmed 2026-08-24): the widget
  `subFilter` now narrows the frame BEFORE the transform pipeline, not after. Stored pipelines
  are split at load by `migrateDashboardTransforms` (idempotent, never drops a step it cannot
  prove equivalent). Not yet smoke-tested in the OBStests vault — a dashboard mixing a pipeline
  `filter` with a block `subFilter` is the case to look at.
- UX bug-fixes (2026-08-22, uncommitted): (1) legacy `data-table` lost `subFilter` on
  save+restore → fixed via `restoreDataTableConfig`/`persistDataTableSubFilter` in
  `legacyMigration.ts`, wired in `widgetComponentRegistry.ts` + `WidgetHost.svelte`
  (+`dataTableSubFilterRoundTrip.test.ts`). (2) `FloatingPopup` fixed-popup was contained by
  `WidgetShell` `container-type: inline-size` → empty scrollbar column + layout shift; fixed by
  `use:portal` to `document.body` (systemic, all popups). (3) `Inspector.svelte` overflow
  scroll→auto. Reported from user screenshot; needs vault visual smoke.
- User-owned: merge/push of this branch; manual visual smoke in OBStests vault (portal popup +
  live subFilter across reload).

## Next product milestone

`M-RELATION-FIRST` is the active queue.

1. **#110 P0 — ✅ DONE.** Approved design brief `RELATION_FIRST_DESIGN_BRIEF_110.md`.
2. **#111 P0 — ✅ DONE (impl, pending merge).** `relationContract.ts`: WikiLink resolution
   (resolved/unmatched/ambiguous), inverse, legacy `linkedSelection` validation + migration.
3. **#112 P0 — ✅ DONE (2026-08-22, pending merge).** Full wizard + all 4 entry points + i18n
   + displayField picker + controller unit tests. 165 suites / 2305 PASS. Audit: READY FOR PR.
4. **#113 P0 — ✅ DONE (2026-08-22, pending merge).** Related records surface + count badge +
   setupRelation event chain + dashboardSuggest relation-block + initialConfig factory. 166/2312 PASS.
5. **#114 P1 — ✅ DONE (2026-08-22, pending merge).** validateLegacyLinkedSelection wired; composeEffectiveFilter unified; relation-only picker; 3-state filter label; SelectionBadge extended. 166/2319 PASS.
6. **#115 P0 — ✅ DONE (2026-08-22, manual acceptance pending).** R1 integration tests (10 cases) + MANUAL_TESTING_PIPELINE.md section 8. 167/2329 PASS. Manual screenshots + keyboard path = user gate.

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

# Handoff V6.3 — Closing Audit

**Date:** 2026-05-09  
**Baseline at entry:** 108 suites / 1721 tests PASS, tsc 0 errors, PX-budget 181/191  
**Baseline at exit:** 110 suites / 1736 tests PASS, tsc 0 errors, PX-budget 181/191

---

## Tickets closed this session

### NPLAN-A1 — AutoTime fields (`created_time` / `last_edited_time`)

**Complexity:** M  
**Files changed:**
- `src/ui/views/Dashboard/engine/applyAutoFields.ts` — new pipeline step
- `src/ui/views/Dashboard/engine/applyAutoFields.test.ts` — 8 unit tests
- `src/ui/views/Dashboard/DashboardCanvas.svelte` — integrated into displayFrame pipeline
- `docs/internal/NOTION_PARITY.md` — rows 17 + 19 updated to ✅

**What was done:**  
Created `applyAutoFields(frame, getFileStat)` — a pure pipeline step that fills `DataFieldType.AutoTime` field values from `TFile.stat.ctime/mtime`. Injected `getFileStat` callback keeps the function decoupled from Obsidian's vault API (fully unit-testable). Integrated after `applyFormulaFields` in `DashboardCanvas.svelte`. Datasource-filled values win (not overwritten). Zero ctime/mtime values skipped.

---

### NPLAN-C1 — Status semantic groups overlay in Board

**Complexity:** M  
**Files changed:**
- `src/ui/modals/components/ConfigureField.svelte` — added statusGroups config UI for Select/Status fields
- `src/ui/views/Board/board.test.ts` — new, 7 tests for `getColumns` semantic mode
- `docs/internal/NOTION_PARITY.md` — status row + Board row updated to ✅

**What was done:**  
The engine (`getSemanticColumns` in `board.ts`), board toggle UI (`groupMode: "values" | "semantic"` in `BoardSettings.svelte`), and schema type (`FieldConfig.statusGroups`) were already implemented. The missing piece was a UI to set `statusGroups` on a field.

Added to `ConfigureField.svelte`:
- Reactive `statusGroupsCfg` + `optionsWithBuckets` derived vars
- `handleStatusGroupChange(opt, bucket)` — assigns an option value to a semantic bucket, prunes empty arrays, strips `statusGroups` key entirely when all unassigned (`exactOptionalPropertyTypes` compliant)
- Template section: shown only for Select/Status fields with ≥1 option; per-option Select with "—" / "To Do" / "In Progress" / "Done"
- `keep("statusGroups")` added to `handleTypeChange` switch (Select/Status cases) so assignment survives type round-trips

---

## Open tickets remaining (post-V6.3)

| ID | Ticket | Sprint | Size | Status |
|---|---|---|---|---|
| NPLAN-C2 | Two-way relations write-back + relation popover | 4 | L | ⬜ |
| NPLAN-C3 | Rollup full function set + visual (progress bar, chips) | 4 | M | ⬜ |
| NPLAN-B2 | Timeline (Gantt) view widget | 5 | XL | ⬜ |
| NPLAN-A2 | `unique_id` field type | 1 | S | ⬜ |
| NPLAN-S0.1-S0.3 | Sprint 0: design tokens, free canvas, slide-in scaffolding | 0 | L | ⬜ |
| NPLAN-S2.1-S2.3 | Sprint 2: database-call primitive + ViewTabBar | 2 | XL | ⬜ |
| NPLAN-S3.1-S3.3+B1 | Sprint 3: visual settings panels + relative-date filters | 3 | XL | ⬜ |
| NPLAN-S6.1-S6.3 | Sprint 6: node formula builder | 6 | XL | ⬜ |
| NPLAN-S7.1-S7.3 | Sprint 7: RecordCardView, export, keyboard shortcuts | 7 | L | ⬜ |

NPLAN-C2 is the highest-value next target (two-way relations, L complexity, all schema already in place via V6.2).

---

## Invariants verified

1. Dispatch by `DataFieldType` — never by `field.name` ✅
2. Board columns = derived from unique values (semantic = optional overlay) ✅
3. Dates = 4 params (`startDate`/`startTime`/`endDate`/`endTime`) ✅
4. Derived fields via pipeline: `applyFormulaFields` → `applyAutoFields` → display ✅
5. Zero `@ts-ignore` in `src/` ✅
6. PX-budget ratchet ≤ 191 (actual: 181) ✅
7. `filterEvaluator.ts` = single canonical filter engine ✅

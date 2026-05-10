# Handoff V6.4 — Closing Audit

**Date:** 2026-05-10  
**Baseline at entry:** 111 suites / 1744 tests PASS, tsc 0 errors, PX-budget 181/191  
**Baseline at exit:** 112 suites / 1749 tests PASS, tsc 0 errors, PX-budget 181/191

---

## Ticket closed this session

### NPLAN-A2 — `unique_id` field type

**Complexity:** S  
**Files changed:**
- `src/ui/modals/components/dataFieldTypeOptions.ts` — added `DataFieldType.UniqueId` to selectable types; count → 11
- `src/ui/modals/components/ConfigureField.svelte` — added `UniqueId` case in `handleTypeChange` (keeps `uniqueIdPrefix`); `$: uniqueIdPrefixValue` reactive var; `handleUniqueIdPrefixChange` handler; UniqueId sub-panel template with `TextInput` for prefix
- `src/ui/views/Table/components/DataGrid/GridCell/GridTypedCell.svelte` — added `{:else if column.type === "unique_id"}` branch rendering read-only `GridTextCell`
- `src/ui/modals/components/__tests__/dataFieldTypeOptions.test.ts` — new, 5 tests
- `docs/internal/NOTION_PARITY.md` — row 21 (`unique_id`) updated to ✅; property-type score updated

**What was done:**  
Schema (`DataFieldType.UniqueId`, `uniqueIdPrefix` in `FieldConfig`, `uniqueIdCounter` in `ProjectDefinition`) and DataTable auto-assign logic were already in place from prior work. Missing pieces:

1. **Type picker** — `UniqueId` was absent from `dataFieldTypeOptions`; users couldn't select it when creating/configuring a field.
2. **ConfigureField UI** — no UI to set `uniqueIdPrefix`. Added sub-panel with `TextInput` showing current prefix; clearing it strips the key (`exactOptionalPropertyTypes` compliant).
3. **GridTypedCell renderer** — `unique_id` column fell through to the generic `GridCell`. Added read-only `GridTextCell` branch (same pattern as `formula` string case, `onChange={() => undefined}`).
4. **Tests** — 5 unit tests for `dataFieldTypeOptions`: UniqueId presence, Unknown absence, count match, non-empty labels, no duplicates.

---

## Open tickets remaining (post-V6.4)

| ID | Ticket | Sprint | Size | Status |
|---|---|---|---|---|
| NPLAN-B2 | Timeline (Gantt) view widget | 5 | XL | ⬜ |
| NPLAN-S0.1-S0.3 | Sprint 0: design tokens, free canvas, slide-in scaffolding | 0 | L | ⬜ |
| NPLAN-S2.1-S2.3 | Sprint 2: database-call primitive + ViewTabBar | 2 | XL | ⬜ |
| NPLAN-S3.1-S3.3+B1 | Sprint 3: visual settings panels + relative-date filters | 3 | XL | ⬜ |
| NPLAN-S6.1-S6.3 | Sprint 6: node formula builder | 6 | XL | ⬜ |
| NPLAN-S7.1-S7.3 | Sprint 7: RecordCardView, export, keyboard shortcuts | 7 | L | ⬜ |

All parity-targeted schema/engine tickets (A1, A2, C1, C2, C3) are now ✅. Remaining backlog is UX overhaul (S0-S8) + Timeline (B2).

---

## Invariants verified

1. Dispatch by `DataFieldType` — never by `field.name` ✅
2. Board columns = derived from unique values ✅
3. Dates = 4 params ✅
4. Derived fields via pipeline ✅
5. Zero `@ts-ignore` in `src/` ✅
6. PX-budget ≤ 191 (actual: 181) ✅
7. `filterEvaluator.ts` = single canonical filter engine ✅

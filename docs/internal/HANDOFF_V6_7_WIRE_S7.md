# Handoff V6.7 — Wire Sprint 7 into DataTable UI

**Date:** 2026-05-10  
**Baseline at entry:** 112 suites / 1749 tests PASS, tsc 0 errors, PX-budget 181/191  
**Baseline at exit:** 112 suites / 1749 tests PASS, tsc 0 errors, PX-budget 181/191

---

## What was wired

Sprint 7 library code existed but was disconnected from any UI surface. This session connects all three to `DataTableWidget.svelte`.

### NPLAN-S7.2 — ExportService → DataTable toolbar

`exportRecords()` from `src/lib/export/exportService.ts` is now reachable from every DataTable widget.

**Changes:**
- `DataTableWidget.svelte` — added import `{ exportRecords, type ExportFormat }` + `{ Menu, Notice }` from obsidian
- Added reactive `$: exportableFields` — visible (non-hidden) columns mapped back to DataField[]
- Added `handleExportClick(e: MouseEvent)` — opens an Obsidian `Menu` with 4 format options (CSV/TSV/JSON/Markdown); on select, calls `exportRecords(frame.records, exportableFields, format)`, writes to clipboard, shows `Notice("Copied to clipboard")`
- Added `⬇` export button in `.ppp-datatable-toolbar` alongside `FieldPresetMenu`
- Added `.ppp-export-btn` CSS (rem-only, opacity 0.7 → 1 on hover, focus-visible ring)

**Shortcut:** Ctrl+Shift+E exports current view as CSV to clipboard (via viewShortcuts, see below).

### NPLAN-S7.1 — RecordCardView → replaces EditNoteModal

`src/ui/components/RecordCardView/RecordCardView.svelte` now renders inline as a SlideInPanel when a row is edited, replacing the `EditNoteModal` popup.

**Changes:**
- Removed `import { EditNoteModal }` (no longer used)
- Added `import RecordCardView` + `import { viewShortcuts }`
- Added `let cardViewOpen = false; let cardViewRecord: DataRecord | null = null;`
- `handleRowEdit` now sets `cardViewOpen = true; cardViewRecord = record` instead of opening a modal
- Added `handleCardSave` and `handleCardRename` handlers
- Added `<RecordCardView>` just before `</div>` — controlled by `cardViewOpen`/`cardViewRecord`

### NPLAN-S7.3 — viewShortcuts → DataTable root

`viewShortcuts` action from `src/lib/keyboard/viewShortcuts.ts` is now applied to the `.ppp-datatable-widget` root div.

Handlers wired:
- `new-record` → `handleAddRow()` (only when not readonly)
- `export` → CSV export to clipboard (Ctrl+Shift+E)

---

## Invariants verified

1. Dispatch by `DataFieldType` ✅
2. Board columns = derived from unique values ✅
3. Dates = 4 params ✅
4. Derived fields via pipeline ✅
5. Zero `@ts-ignore` in `src/` ✅
6. PX-budget ≤ 191 (actual: 181) ✅
7. `filterEvaluator.ts` = single canonical filter engine ✅

---

## Remaining (Phase E — out of V6)

- Automation / `button` field / triggers
- `people` / `created_by` / `last_edited_by` (single-user — N/A)
- Notion AI / `verification` (cloud LLM — N/A)

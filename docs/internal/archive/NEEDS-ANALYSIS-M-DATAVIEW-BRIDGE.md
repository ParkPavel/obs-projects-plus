# NEEDS-ANALYSIS — M-DATAVIEW-BRIDGE

> **Ticket**: #045 (parent)  
> **Milestone**: M-DATAVIEW-BRIDGE  
> **Date op: 2026-05-21**  
> **Analyst**: context-manager agent  
> **Status**: NEEDS-ANALYSIS complete ✔ — ready for architect agents to derive #045 sub-tickets

---

## 1. Gate pre-conditions

| Pre-condition | Status |
|---|---|
| #009 M-SUBBASES — ✅ DONE (2026-05-21) | ✔ |
| #010 Bidirectional relations — ✅ DONE (2026-05-21) | ✔ |
| All sub-base tests 3 suites / 31 tests PASS | ✔ (verified 2026-05-21) |
| TSC 0 errors | ✔ |
| 133 suites / 1979 tests PASS | ✔ |
| M-TABLE-REWRITE #001 DONE | ✔ |
| M-CANVAS-REACTIVE #016 DONE | ✔ |

## 2. Existing code inventory (relevant to bridge)

### DataviewDataSource — current state
- **File**: `src/lib/datasources/dataview/datasource.ts` (236 LOC)
- **What it does**: Wraps `DataviewApi.query()` and maps its result types (TABLE / LIST / TASK) into `DataFrame`. Marked `readonly() → true`.
- **Key methods**: `queryAll()`, `queryOne()` (alias for `queryAll`), `refresh()`, `includes()`, `sortFields()`, `standardizeRecords()`.
- **Gap**: Hard dependency on `obsidian-dataview` plugin via `getPlugin("dataview")`. No graceful degradation when DV is absent.
- **Tests**: `datasource.test.ts` (157 LOC, 157 LOC, 12 tests PASS) — pure-method only, no live query.

### Supporting files
| File | LOC | Role |
|---|---|---|
| `dataview/schema.ts` | 18 | `detectSchema()` — marks `File` as identifier, `derived: true` |
| `dataview/standardize.ts` | 47 | `standardizeValues()` — Dataview types → `DataValue` (links, timestamps) |
| `dataview/helpers` (in datasources/) | — | shared `parseRecords` |
| `dataview/__tests__/datasource.test.ts` | 157 | 12 tests: includes, sortFields, standardizeRecords |

### M-SUBBASES bridge code (just delivered — direct baseline for DV integration)
| File | LOC | Role |
|---|---|---|
| `crossSubBase.ts` | 233 | `resolveAcrossSubBases` (forward), `resolveInverseAcrossSubBases` (bidirectional), `buildParentIndex`, `resolveTargets`, `resolveWithinBase` |
| `SubBaseCanvasWidget.svelte` | 263 | UI: CRUD sub-bases, `inverseTarget` 3-tier matching (lines 41–88), `syntheticFrame` rendering, inverse mode via config `inverseTargetId` + `inverseRelationField` |
| `deriveSubBasePartition.ts` | — | `partitionFrame`, `deriveSubBaseItems`, `SubBaseLike` |
| `SubBaseTabs.svelte` | widget | Tab strip with add/rename/remove |

### CrossSubBase test results (verified 2026-05-21)
```
Test Suites: 3 passed, 3 total
Tests:       31 passed, 31 total
```

---

## 3. Gaps requiring M-DATAVIEW-BRIDGE (from DATAVIEW_ABSORPTION_PLAN.md)

### Gap 1 — Dataview DQL as query source with graceful degradation
**Current**: `DataviewDataSource` requires `getPlugin("dataview")` to be present. If absent → source is entirely unavailable and UI must still work.
**Adaptation**: `DataviewEnhancedSource` with explicit opt-in flag; when DV absent → fallback to folder/tag source transparently.
**Bridge scope**: `DataviewDataSource` refactor + `DataviewEnhancedSource` factory.

### Gap 2 — Native-query lightweight layer
**Current**: DV DQL is the only path for ad-hoc queries. Folder and tag sources exist but lack SQL-like WHERE/SELECT projections.
**Adaptation**: `src/lib/datasources/native-query/` — `FROM folder WHERE conditions SORT field LIMIT n`. Canonical `filterEvaluator.ts` as the kernel.
**Bridge scope**: New pure module `nativeQuery.ts` + factory wiring.

### Gap 3 — Relation UI pill-chip rendering (NEW gap, surfaced in D5 analysis)
**Current**: `crossSubBase.ts` resolves relational links correctly (bidirectional, across sub-bases). The result is rendered as plain text fields in `SubBaseCanvasWidget`.
**Adaptation**: Dedicated `RelationListView` component (pill-chips, overflow indicator `+N more`, hover preview) — follows `GridRelationCell` / `configureField` patterns already established in DataTable.
**Bridge scope**: New Svelte component `RelationListView.svelte` + driver wiring into SubBaseCanvas list items.

### Gap 4 — Status semantics in Board
**Current**: `StatusFieldTypeConfig.groups` exists in settings. Board doesn't apply 3-tier grouping semantics.
**Adaptation**: Board-side column rendering that reads `groups` from field config.
**Bridge scope**: Board grouping renderer.

### Gap 5 — Rollup UI
**Current**: `rollupMode.ts` + `crossProjectRollup.ts` implement 20+ functions. UI for create/configure — stub.
**Adaptation**: `ConfigureField.svelte` extension for rollup type + cell renderer integration.
**Bridge scope**: `ConfigureField` + `RollupCellRenderer`.

### Gap 6 — Unified Dataview filter semantics via canonical kernel
**Current**: `DataviewDataSource.queryAll()` passes results unfiltered through DV's native filter chain.
**Adaptation**: Apply `filterEvaluator.ts` as the canonical filter layer for all sources including DV — single semantics regardless of backend.
**Bridge scope**: `DataviewDataSource` refactor, `composeEffectiveFilter` applied after query, before record assembly.

---

## 4. M-DATAVIEW-BRIDGE code-prerequisites confirmed

All Gaps are cleared for architect/developer work:

| Prerequisite | Confirmed |
|---|---|
| `filterEvaluator.ts` canonical kernel — no modification during bridge work | ✔ (protected by CONTEXT.md prohibition) |
| M-SUBBASES #009 + #010 — analys + implementation done | ✔ |
| `crossSubBase.ts` signalling patterns available for Gap 3 integration | ✔ (buildParentIndex, resolveTargets, resolveInverseAcrossSubBases) |
| `SubBaseCanvasWidget` inverse mode config schema stable (`inverseTargetId`, `inverseRelationField`) | ✔ (SubBaseCanvasWidget lines 45–69) |
| DataProvider Registry (#031) — per-canvas context, no global state | ✔ |
| M-FREE-CANVAS WindowShell — slot architecture for inline widgets | ✔ |
| `src/lib/stores/dataframe.ts` — reactive `DataFrame`, invalidation `invalidate(projectId)`/`invalidateAll()` | ✔ |

---

## 5. Proposed sub-ticket breakdown (for ticket-creation session)

| Ticket | Title | Priority | Depends on |
|---|---|---|---|
| #045.1 | `DataviewEnhancedSource` factory + graceful degradation | P1 | #045 |
| #045.2 | Native-query lightweight layer (`nativeQuery.ts`) | P2 | #045 |
| #045.3 | Relation UI pill-chip (`RelationListView.svelte`) | P1 | #009, #045 |
| #045.4 | Rollup UI (`RollupCellRenderer` + `ConfigureField` extension) | P2 | #045 |
| #045.5 | Unified filter semantics for Dataview backend | P1 | #045 |
| #045.6 | Status semantics / Board 3-tier grouping | P2 | #045 |

---

## 6. Risk notes

- **DV plugin presence**: graceful-degradation path must be tested in OBStests with DV disabled. Agent tester must verify both branches.
- **filterEvaluator.ts immutability**: all gap work must consume the canonical engine, never re-export or alias it.
- **SubBaseCanvasWidget inverse config**: `inverseTargetId` + `inverseRelationField` are user-facing fields. Validation messages must be added when BK-345 values are missing (low priority — v2 work).
- **PX-budget**: any new Svelte component must pass `R0_3_pxBudget` ≤186 (locked).
- **Dataview v0 plugin API**: `obsidian-dataview` npm package type definitions may lag — type assertions or `@ts-expect-error` in those files only, never in core engine.

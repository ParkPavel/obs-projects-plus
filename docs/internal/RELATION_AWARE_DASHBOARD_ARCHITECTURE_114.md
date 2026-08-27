# Architecture Decision — #114 Relation-aware Dashboard Interactions

**Date**: 2026-08-22
**Ticket**: #114 — Relation-aware Dashboard interactions
**Milestone**: M-RELATION-FIRST
**Status**: APPROVED — implementation ready

## Ticket Summary

Make Selection Bus and linked blocks explain and reuse the configured Relation. When no Relation
exists, distinguish a temporary filter from a persistent relationship. Do not add another
dashboard-only linking configuration.

---

## Gap Dispositions (from semantic analysis)

### E1 — `validateLegacyLinkedSelection` never called from UI → Fix (wire, not refactor)
The validator in `src/lib/relations/relationContract.ts:42–59` is complete and pure. Wire it into
`WidgetHost.svelte` when building `widgetConfig` and into `DatabaseCallSettings.svelte` when
`linkedSelectionChange` is dispatched. Pass result as a new prop to `DatabaseCallBlock.svelte` for
diagnostic rendering. No new schema.

### E2 — "Filter by field" picker shows all fields → Fix
Add `relationFields = fields.filter(f => f.type === DataFieldType.Relation)` inside
`DatabaseCallSettings.svelte` and bind the picker to that constant. Zero new props or types.

### E3 — `linkedSelection.relationField` not cross-referenced to `RelationFieldConfig.targetProjectId` → Fix via E1
The existing `RelationFieldConfig` already carries `targetProjectId`. Make
`validateLegacyLinkedSelection` the mandatory runtime gate that performs the cross-reference.
When validation fails, show diagnostic state. Schema unchanged.

### E4 — No UX distinction between transient selection and persistent relation → Fix (minimal labeling)
Three visual states in `DatabaseCallBlock.svelte`:
- **Persistent valid**: `linkedSelection` configured + validation `"valid"` → "Filtered by relation"
- **Transient**: canvas selection active, no valid `linkedSelection` configured → "Filtered by canvas selection"
- **Broken**: `linkedSelection` configured but validation fails → "Relation broken" + reason

No new config, no new store. Derived from data already in scope.

### E5 — `getPrimaryWidgetId` only matches `"data-table"` → Fix (one line)
`DashboardCanvas.svelte:132` — extend match to include `"database-call"`.
`dataTableSourceId(id)` in `canvasSelectionStore.ts` is already source-type-agnostic.

### E6 — `SelectionBadge` excludes `"database-call"` receiver → Fix (one set-add)
Add `"database-call"` to `SELECTION_RECEIVER_TYPES` in `SelectionBadge.svelte:29`.

### E7 — Two parallel composition paths (`composeLinkedSelectionFilter` / `composeEffectiveFilter`) → Fix (consolidate; highest architectural risk)
1. Verify `composeEffectiveFilter` subsumes `composeLinkedSelectionFilter` behavior.
2. Replace all 4 subscriber call sites to use `composeEffectiveFilter`.
3. Un-export `composeLinkedSelectionFilter` — make it an internal helper.
4. `composeEffectiveFilter` receives optional `validationResult` param to skip broken relation filter.
**Gate**: parity unit tests must pass before switching subscribers.

### E8 — No wizard entry point from `DatabaseCallSettings` → Scope to simpler form
Out of scope to add full wizard navigation. Simpler: when validator returns `"missing-relation"` or
`"wrong-target-project"`, render a static inline hint in `DatabaseCallSettings.svelte` pointing user
to the schema editor. No navigation logic, no new route.

---

## Files Changed

| File | Change |
|---|---|
| `src/ui/views/Dashboard/canvasSelectionStore.ts` | Un-export `composeLinkedSelectionFilter`; add optional `validationResult` param to `composeEffectiveFilter` |
| `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte` | Wire `composeEffectiveFilter` as single filter source; receive `linkedSelectionValidation` prop; render E4 labels |
| `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte` | Filter picker to `DataFieldType.Relation` only (E2); inline hint on validation failure (E8) |
| `src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte` | Replace `composeLinkedSelectionFilter` → `composeEffectiveFilter` |
| `src/ui/views/Dashboard/widgets/Stats/StatsWidget.svelte` | Replace `composeLinkedSelectionFilter` → `composeEffectiveFilter` |
| `src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte` | Replace `composeLinkedSelectionFilter` → `composeEffectiveFilter` |
| `src/ui/views/Dashboard/DashboardCanvas.svelte` | Extend `getPrimaryWidgetId` to match `"database-call"` (E5) |
| `src/ui/views/Dashboard/widgets/_shared/SelectionBadge.svelte` | Add `"database-call"` to `SELECTION_RECEIVER_TYPES` (E6) |
| `src/ui/views/Dashboard/WidgetHost.svelte` | Call `validateLegacyLinkedSelection`, pass result as prop to DatabaseCallBlock |
| `src/lib/relations/relationContract.ts` | Confirm signature compatibility; add overload if needed — no behavior change |

**Total: 10 files changed. No new files. No new config schema.**

---

## New Interface Contracts

```typescript
// canvasSelectionStore.ts — additive extension
export function composeEffectiveFilter(
  linkedSelection: LinkedSelectionConfig | undefined,
  canvasSelection: CanvasSelection | undefined,
  fields: DataField[],
  validationResult?: "valid" | "missing-relation" | "invalid-field" | "wrong-target-project"
): AutoFilter | undefined

// DatabaseCallBlock.svelte — new additive prop
export let linkedSelectionValidation: "valid" | "missing-relation" | "invalid-field" | "wrong-target-project" | undefined = undefined;
```

---

## Dependency Order

1. `src/lib/relations/relationContract.ts` — confirm signature (no behavior change)
2. `src/ui/views/Dashboard/canvasSelectionStore.ts` — add param, un-export old compositor
3. **Write parity unit tests** (`canvasSelectionStore.test.ts`) BEFORE touching subscribers — gate for E7
4. `src/ui/views/Dashboard/WidgetHost.svelte` — call validator, pass prop
5. `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallSettings.svelte` — relation-only picker + inline hint
6. `src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte` — wire `composeEffectiveFilter`, render label
7. `src/ui/views/Dashboard/widgets/Chart/ChartWidget.svelte`, `widgets/Stats/StatsWidget.svelte`, `widgets/DatabaseCall/DataTableContent.svelte` — switch compositor (parallel)
8. `src/ui/views/Dashboard/DashboardCanvas.svelte` — extend `getPrimaryWidgetId`
9. `src/ui/views/Dashboard/widgets/_shared/SelectionBadge.svelte` — receiver set

---

## New Unit Tests Required

| Test file | Coverage |
|---|---|
| `src/lib/relations/__tests__/relationContract.test.ts` (extend) | All 4 validator return values; field lists include/exclude `relationField`; matching/mismatched `targetProjectId` |
| `src/ui/views/Dashboard/__tests__/canvasSelectionStore.test.ts` (new/extend) | Parity: `composeLinkedSelectionFilter` vs `composeEffectiveFilter` for linked-only / canvas-only / both / neither; `composeEffectiveFilter` with `"missing-relation"` skips filter; with `"valid"` applies it |
| `src/lib/dashboard-engine/__tests__/relationFilterAdapter.test.ts` (extend) | WikiLink positive match, no match, malformed link |

---

## Risks

1. **E7 behavioral divergence** — `composeEffectiveFilter` may not be a strict superset. Mitigation: parity tests before switching subscribers.
2. **E5 multi-master scenario** — two `database-call` blocks on same canvas: first one wins as primary. Existing limitation; now more likely to be hit. Acceptable.
3. **E3 runtime-only cross-reference** — misconfigured `linkedSelection` shows broken state until user visits settings. Makes existing silent error visible. No regression.
4. **`fields` in WidgetHost** — confirm `enrichWithBacklinks()` result still includes `RelationFieldConfig` in `typeConfig` before passing to validator.
5. **PX budget** — no new CSS values. Developer must confirm no `px` introduced in labels/hints.
6. **No `new Menu(`** — inline hints in `DatabaseCallSettings` must be static `<span>` elements, not Obsidian Menu instances.

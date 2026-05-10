# V5 Closure Report

**Date**: 2026-05-07
**Source of truth**: actual code state (`src/`), Jest run, tsc run.
**Not sourced from**: outdated sections of master prompt or stale planning docs.

## Baseline

- Jest: **106 suites / 1679 tests PASS**
- `tsc --noEmit` (strict + exactOptionalPropertyTypes): **0 errors**
- PX-budget ratchet: **191** (unchanged across V5)
- Widgets registered: **11**
- `@ts-ignore` count in `src/`: **0**

## Closed tickets — by subsystem

### Engine / filtering / formula
- **R5-002** (Phase 1+2) — formula evaluator unified.
- **R5-003** — `lib/engine/filterEvaluator.ts` is canonical; `regex` operator + `FilterOpts.upcomingInclusive` added. ReDoS guards (max-len 200, lookbehind/lookahead/nested-quantifier reject). `Calendar/agenda/filterEngine.ts` reduced 396→121 LOC, thin wrapper.
- **R5-003-prep** — `baseDateCtx` plumbed through evaluator.
- **MPLAN-001** — Formula inline render in cells via `engine/applyFormulaFields.ts`, wired in `DashboardCanvas.svelte`.

### Cells / Notion-parity surface
- **MPLAN-002** — `lib/helpers/linkable.ts` (strict URL/email/phone regex). `TextLabel.svelte` renders `<a class="ppp-linkable">`; bare emails → `mailto:`, phones → `tel:`.

### Filters UI
- **MPLAN-007** — Nested filter groups (depth-2) inline in `FiltersTab.svelte`. Hairlines `0.0625rem`.

### Widgets
- **R5-001-prep** — TableView deleted; DataGrid kept as shared library.
- **R5-001 final** — DataTable polish verified: row virt @100, 2-level subgrouping (`groupRows.ts:RowGroup.subGroups`), sticky cols, sub-base tabs.
- **R5-009** — `Dashboard/widgets/SubBaseCanvas/` MVP, owns its own `subBases[]`, decoupled from DataTable.
- **R5-011** — `Dashboard/widgets/YamlVisualizer/YamlVisualizerWidget.svelte` thin wrapper, `hasCog: false`.
- **R5-013** — Dashboard canvas split.
- **MPLAN-008** — `Dashboard/widgets/DataList/` (pure `deriveListItems.ts` + widget + config + 7 unit tests).

### Cross-base data
- **R5-010** — Cross-base relations with sub-base scope. `RelationFieldConfig.targetSubBaseFilter?: FilterDefinition` (`src/settings/base/settings.ts`). `enrichFrameWithRelations` filters resolved targets via `applyFilter(externalFrame, filter)`. `computeCrossProjectRollup` pre-filters `externalFrame` from the relation field's own config. Settings UI: advanced JSON textarea in `ConfigureField.svelte`. 2 new tests (resolver + rollup).

### Workspace integration
- **R5-012** — Properties pane replace. `ProjectsPluginPreferences.replaceObsidianProperties: boolean` (default false). `main.ts` `active-leaf-change` handler detaches `file-properties` leaves and reveals existing `VisualizerPaneView`. Pref propagated through v1/v2/v3/v4 defaults + datasource & settings test fixtures.

### Hygiene
- **R5-014** — UI tests.
- **MPLAN-009** — Zero `@ts-ignore`. `EditNote.svelte` immer mutation → plain spread.
- **Demo vault** — present.

## Held — not closed, need explicit sign-off

| Ticket | Reason held |
| --- | --- |
| **MPLAN-003** | Relative-date operators in UI presets — needs design for preset list and copy. |
| **MPLAN-004** | Status semantic groups + Board column mapping — needs schema (`FieldConfig.statusGroups`) + ConfigureField UI + Board rewrite. **See re-orientation below.** |
| **MPLAN-005** | `created_time` / `last_edited_time` auto-fields via `TFile.stat` — schema decision pending. |
| **MPLAN-006** | Unique-ID auto-increment — needs project-counter persistence + create-flow integration. |
| **R5-004** | `count` → `count_total` semantic split — silent number changes in saved DataTable/Stats/SummaryRow/chart configs; needs user sign-off. |

## Adaptive-logic re-orientation (apply to held tickets)

These are clarifications for any future implementer. They reflect how the plugin already works for non-status/non-date fields and must be preserved when MPLAN-004 / date-editing tickets are picked up.

### Board grouping
- Board columns are **derived from unique values** of the field the user selected as the grouping field. Columns are **not** hardcoded to "todo / in-progress / done".
- The grouping field is chosen by the user; its name is arbitrary. Logic must dispatch on `field.type` (and optional `fieldConfig` like `statusGroups` if MPLAN-004 lands), **never** on `field.name`.
- MPLAN-004's "status semantic groups" is therefore an **optional layer on top** of the existing dynamic-column derivation, not a replacement.

### Dates
- Dates carry **four parameters**: `startDate`, `startTime`, `endDate`, `endTime` — not two.
- Any date editor / picker / cell renderer added under MPLAN-003 or future date work must surface all four; existing date storage already supports this shape.

### Field-name independence
- The plugin lets users name fields freely. Logic keys off `DataFieldType` (and structured `fieldConfig`), never off the field's display name. Held tickets must preserve this invariant.

## Net effect

Entire V5 R5-ticket backlog is drained. All closed tickets verified against actual code, not against `MODERNIZATION_PLAN_V5.md` / `REFACTOR_BACKLOG_V5.md` (which are now historical artifacts). The 5 held items are blocked on design decisions, not on engineering.

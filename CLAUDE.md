# obs-projects-plus — CLAUDE.md

Obsidian plugin: project management with Database (8 widgets, 115 formulas), Calendar, Board, Gallery views.

## Stack

- **Svelte 3.59.2** (locked — do not upgrade)
- **TypeScript** strict + `exactOptionalPropertyTypes: true`
- **Jest 29** for unit tests
- **esbuild** bundler (no webpack)
- Zero `@ts-ignore` invariant — never add one

## Commands

```bash
npm run build       # tsc check + bundle
npm test            # jest (all suites)
npm run test:watch  # jest watch
npx tsc --noEmit    # type check only
```

**Baseline:** 107 suites / 1700 tests PASS, tsc 0 errors.

## Architecture

### Entry points

| File | Role |
|---|---|
| `src/main.ts` | Plugin init, command registration, leaf lifecycle |
| `src/view.ts` | Obsidian ItemView host, mounts DashboardCanvas |
| `src/customViewApi.ts` | External API surface |

### Core layers

```
src/lib/
├── engine/          filterEvaluator.ts (canonical — all filters go here)
├── formula/         extendedEvaluator.ts (115+ functions), applyFormulaFields.ts
├── relations/       crossProjectResolver.ts, relationsWriter.ts (full two-way write-back)
├── database/        subBase.ts, rollupMode.ts, crossProjectRollup.ts
├── dataframe/       dataframe.ts — DataFrame / DataField / DataFieldType / DataRecord
├── datasources/     folder | tag | dataview resolvers
├── frontmatter/     read/write YAML frontmatter
└── stores/          settings.ts (writable), i18n.ts
```

### UI views

```
src/ui/views/
├── Dashboard/       DashboardCanvas.svelte (12-col CSS grid), WidgetHost.svelte
│   ├── widgets/     DataTable, Chart, Stats, Comparison, Checklist, ViewPort,
│   │                FilterTabs, SummaryRow, DataList, SubBaseCanvas,
│   │                YamlVisualizer, DatabaseCall (V6 new)
│   ├── engine/      transformExecutor, rollup, accessibility, relationResolver
│   └── types.ts     WidgetType, WidgetLayout, WidgetDefinition, WidgetDataContext, ViewTab
├── Calendar/        month/week/day, Agenda 2.0, DnD, filterEngine (thin wrapper)
├── Board/           dynamic columns from unique values (never hardcoded)
├── Gallery/         card grid
└── Table/           DataGrid shared library (used by DataTable widget)
```

### Settings / schema

```
src/settings/
├── v4/settings.ts   ProjectDefinition (canonical), uniqueIdCounter (V6)
├── base/settings.ts FilterDefinition, FieldConfig (statusGroups, autoTime, uniqueIdPrefix — V6),
│                    RelationFieldConfig (inverseFieldName — V6), RollupFieldConfig
└── settings.ts      re-exports v4 types
```

### UI components

```
src/ui/components/
├── SlideInPanel/          Generic right-edge slide-in (V6 / DG-3)
├── FieldSettingsPanel/    Field edit in slide-in (V6 / S3.1)
├── FilterPanelVisual/     Filter editor in slide-in (V6 / S3.2)
├── ConditionalFormatBuilder/ CF rule list (V6 / S3.3)
├── FormulaEditor/         formula text editor
└── ... (Navigation, CardMetadata, ColorPicker, TagList, etc.)
```

## Key invariants (never break)

1. **Dispatch by `DataFieldType`** — never by `field.name`.
2. **Dates = 4 params**: `startDate`, `startTime`, `endDate`, `endTime`.
3. **Board columns = derived from unique values** of user-selected field; not hardcoded.
4. **Derived fields via pipeline**: `applyFormulaFields` → `enrichFrameWithRelations` → display.
5. **Zero `@ts-ignore`** in `src/`.
6. **PX-budget ratchet ≤ 191** (px-count test in `__tests__/`). All new values in `rem`.
7. **filterEvaluator.ts** is the single canonical filter engine — no parallel implementations.

## DataFieldType enum (dataframe.ts)

```
String | Number | Boolean | Date | List | Select | Status
Formula | Relation | Rollup
AutoTime (V6-A1) | UniqueId (V6-A2) | Unknown
```

## WidgetType union (Dashboard/types.ts)

```
data-table | chart | stats | comparison | checklist | view-port
filter-tabs | summary-row | data-list | sub-base-canvas
yaml-visualizer | database-call (V6-S2)
```

## Design tokens (tokens.css)

All spacing/typography in `rem`. Prefix `--ppp-*`. V6 added `--ppp-db-*` palette (pastel HSL, status/priority/chip colors, panel/block/node tokens).

## V6 / Dashboard V2 plan

Sprints 0-8 closed (tokens, schema, database-call, slide-in panels, relations/rollup/status, timeline, formula visual toggle, export/shortcuts, polish). Full plan: `docs/internal/NOTION_PARITY.md` §10. Design guidelines: `docs/internal/DASHBOARD_V2_MASTER_PROMPT.md`.

## Testing

- Jest config: `jest.config.js`
- Mocks: `src/__mocks__/`, `src/ui/views/Dashboard/widgets/__tests__/mocks/`
- When adding a new widget: update `widgetRegistry.test.ts` count + `configPanelRegistry.test.ts` type list.
- When adding new `DataFieldType` values: check exhaustive switch branches don't break (no `assertNever` in codebase, safe to add).

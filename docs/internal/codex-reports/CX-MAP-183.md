# CX-MAP-183 — usage map of the legacy Table/DataGrid tree (main @ 68b6aa9)

Run 2026-09-03 through `.codex/run-role.mjs --role code-mapper`. Commissioned by #183's own
precondition: the tree is RUNTIME code, so unlike #178 a clean `tsc` proves nothing — the
question is whether anything can reach it by any route.

**Result: nothing can.** Every exported symbol and every one of the 22 components reports NONE
outside the tree. Its only root is the `DataGrid/index.ts` barrel, which no file imports.
`helpers.ts` is reached only by its own test. There is no file shared with the live Dashboard
Table V2, and no shared CSS — `.ppp-rollup-cell` is a name collision, each side declaring its own.

SYMBOL

| Symbol / component | Definition | Consumers outside `src/ui/views/Table/` |
|---|---|---|
| `sortFields` | `src/ui/views/Table/helpers.ts:4` | NONE |
| `GridValidRowModel`, `GridRowModel`, `GridColType`, `GridColDef`, `GridRowId`, `GridRowProps` | `src/ui/views/Table/components/DataGrid/dataGrid.ts:4,5,6,8,17,19` | NONE |
| `DataGrid` barrel export | `src/ui/views/Table/components/DataGrid/index.ts:1` | NONE |
| `GridCell`, `GridTypedCell`, `TextLabel` barrel exports | `src/ui/views/Table/components/DataGrid/GridCell/index.ts:1,2,3` | NONE |
| `GridTextCell`, `TextLabel` barrel exports | `src/ui/views/Table/components/DataGrid/GridCell/GridTextCell/index.ts:1,2` | NONE |
| `GridBooleanCell`, `GridDateCell`, `GridDatetimeCell`, `GridFileCell`, `GridListCell`, `GridNumberCell`, `GridRelationCell`, `GridRollupCell`, `GridSelectCell` barrel exports | respective `index.ts:1` files under `GridCell/` | NONE |

| Svelte component (default component and `export let` API) | Definition / first public prop | Consumers outside tree |
|---|---|---|
| `BulkActionBar` | `BulkActionBar.svelte:1,5` | NONE |
| `DataGrid` | `DataGrid.svelte:1,24` | NONE |
| `GridCellGroup` | `GridCellGroup.svelte:1,2` | NONE |
| `GridRow` | `GridRow.svelte:1,17` | NONE |
| `GridCell` | `GridCell.svelte:1,13` | NONE |
| `GridTypedCell` | `GridTypedCell.svelte:1,26` | NONE |
| `Resizer` | `Resizer.svelte:1,2` | NONE |
| `GridBooleanCell` | `GridBooleanCell.svelte:1,7` | NONE |
| `GridDateCell` | `GridDateCell.svelte:1,18` | NONE |
| `GridDatetimeCell` | `GridDatetimeCell.svelte:1,17` | NONE |
| `GridFileCell` | `GridFileCell.svelte:1,10` | NONE |
| `GridListCell` | `GridListCell.svelte:1,7` | NONE |
| `GridNumberCell` | `GridNumberCell.svelte:1,13` | NONE |
| `NumberInput` | `NumberInput.svelte:1,4` | NONE |
| `NumberLabel` | `NumberLabel.svelte:1,2` | NONE |
| `GridRelationCell` | `GridRelationCell.svelte:1,11` | NONE |
| `GridRollupCell` | `GridRollupCell.svelte:1,7` | NONE |
| `GridSelectCell` | `GridSelectCell.svelte:1,15` | NONE |
| `GridTextCell` | `GridTextCell.svelte:1,11` | NONE |
| `TextLabel` | `TextLabel.svelte:1,8` | NONE |
| `GridColumnHeader` | `GridColumnHeader.svelte:1,10` | NONE |
| `GridHeader` | `GridHeader.svelte:1,11` | NONE |

CALLERS

| Internal caller | Target / context |
|---|---|
| `helpers.test.ts:6,21,48,75,102` | imports and calls `sortFields` |
| `DataGrid/index.ts:1` | re-exports `DataGrid.svelte` |
| `DataGrid.svelte:6,7,15,17` | imports `GridRow`, `BulkActionBar`, `GridCellGroup`, `GridHeader` |
| `GridRow.svelte:4,6` | imports `GridCell`, `GridTypedCell`, `GridCellGroup` |
| `GridHeader.svelte:2,6,7` | imports `GridCell`, `Resizer`, `GridColumnHeader` |
| `GridTypedCell.svelte:12,15-24` | imports `GridCell` and all typed cell variants |
| `GridNumberCell.svelte:2-4` | imports `GridCell`, `NumberLabel`, `NumberInput` |
| `GridTextCell.svelte:2,6` | imports `GridCell`, `TextLabel` |
| `GridDateCell.svelte:12-13`; `GridDatetimeCell.svelte:11-12` | import shared `GridCell` / `TextLabel` barrels |

FLOW

| Direction | Observed path |
|---|---|
| Plugin entry | `src/main.ts:51` imports `ProjectsView`; `src/main.ts:95-98` registers only that view type. |
| Built-in project view registry | `src/view.ts:14-17` imports Board, Calendar, Dashboard, Gallery; `src/view.ts:160-168` registers Board, Calendar, Gallery, Dashboard/database. No Table entry. |
| Live Dashboard Table V2 | `DatabaseCallBlock.svelte:20,509` imports and mounts `DataTableContent`; `DataTableContent.svelte:43-48` imports V2 `TableGroupSection`, `TableControlBar`, `TableHeader`, `TableRow`, `TableNewRow`, `TableFooter`. |
| Outside → legacy tree | NONE: no static import, `import()`, `require()`, `jest.mock()`, path string, or source registry reference to `views/Table` / `Table/components` was found. |
| Legacy tree → outside | `helpers.ts:1-2`; `GridRow.svelte:2,5,7,10-15`; `dataGrid.ts:1`; `GridHeader.svelte:3-4`; `DataGrid.svelte:2,4,16,22`; `BulkActionBar.svelte:2`; `GridColumnHeader.svelte:2-4`; `GridCell.svelte:2-4`; `GridTypedCell.svelte:2-10`; typed-cell files import shared dataframe/UI/Obsidian helpers at their import blocks. |

DEAD

- `src/ui/views/Table/components/DataGrid/index.ts:1` — zero static importers; it is the disconnected runtime root.
- `DataGrid.svelte` is reached only by that barrel re-export: `DataGrid/index.ts:1`.
- `helpers.ts` is test-only: `helpers.test.ts:6`.
- All remaining runtime components have internal importers, but their only root is the disconnected `DataGrid` barrel.

PARALLEL

| Parallel surface | Evidence |
|---|---|
| Dashboard Table V2, separate implementation | `DatabaseCallBlock.svelte:20,509` → `DataTableContent.svelte:43-48`; no legacy Table file is imported. |
| Shared file between legacy tree and Dashboard Table V2 | NONE. |
| Rollup display duplication | `GridRollupCell.svelte:23-24` explicitly mirrors `RollupCellRenderer` parsing; `RollupCellRenderer.svelte:80` has the matching `toNumber` path. |
| CSS-name collision, not shared CSS | Legacy `.ppp-rollup-cell`: `GridRollupCell.svelte:44,67`; standalone renderer declares its own `.ppp-rollup-cell`: `RollupCellRenderer.svelte:119,145`. |
| Related field-order functions | `helpers.ts:4`; `frontmatter/datasource.ts:93`; `dataview/datasource.ts:134`. Their ordering rules differ. |

UNKNOWN

- `src/view.ts:145-155` allows other installed plugins to register project views dynamically. Static reading cannot prove what foreign runtime code does.
- No Obsidian runtime or bundle-before/after comparison was run.
- Falsifiers: a runtime-loaded module/chunk containing a legacy Table path; a dynamic registry resolving `DataGrid`; an external plugin registering and mounting it; or a source import/path reference outside this tree.


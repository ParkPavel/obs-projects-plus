# CX-MAP-168 — code-mapper trace of the record-open paths (main @ 09fef14)

Run 2026-09-03 through `.codex/run-role.mjs --role code-mapper`, Codex session
01a06242-1b44-74a1-8161-dda6e1069b11. Commissioned to close the ADR's UNKNOWN about the Table's
row-open path and to check its A/B classification of the `openLinkText` sites.

**Three corrections to `ADR_RECORD_OPEN_CONTRACT_2026-09-02.md`, all verified in the main session
before being accepted** — see the ADR's "Corrections" section.

## SYMBOL | Symbol | Definition | |---|---| | `onRowOpen` | [GridRow.svelte](/C:/Users/Park/O...
[codex] Turn completion inferred after the main thread finished and subagent work drained.
## SYMBOL

| Symbol | Definition |
|---|---|
| `onRowOpen` | [GridRow.svelte](src/ui/views/Table/components/DataGrid/GridRow.svelte:36) |
| `LinkBehavior` | [settings.ts](src/settings/base/settings.ts:350): `"open-note" \| "open-editor"` |
| `EditNote` props | [EditNote.svelte](src/ui/modals/components/EditNote.svelte:31) |

## CALLERS

| Path | Context |
|---|---|
| [GridRow.svelte:69](src/ui/views/Table/components/DataGrid/GridRow.svelte:69) | Left row-header `mousedown` calls `onRowOpen(rowId, false \| "tab" \| "window")`; Shift → `"window"`, Ctrl/Meta → `"tab"`. |
| [GridRow.svelte:91](src/ui/views/Table/components/DataGrid/GridRow.svelte:91) | Touch long-press opens `showMobileNavMenu($app, String(rowId), sourcePath, e, () => onRowOpen(rowId, false))`. |
| [DataGrid.svelte:299](src/ui/views/Table/components/DataGrid/DataGrid.svelte:299) | Forwards only truthy `"tab"` / `"window"` to its optional parent `onRowOpen`; `false` calls `onRowEdit(rowId, row)`. |
| [DataGrid.svelte:303](src/ui/views/Table/components/DataGrid/DataGrid.svelte:303) | Plain row-header activation ends at required parent callback `onRowEdit`. No workspace call follows in this component tree. |
| [helpers.ts:148](src/ui/views/helpers.ts:148) | Mobile “Open note” calls the supplied callback, therefore reaches `onRowEdit` above. |
| [helpers.ts:152](src/ui/views/helpers.ts:152) | Mobile “Open in tab” ends at `workspace.openLinkText(linkText, sourcePath, "tab")`. |
| [helpers.ts:156](src/ui/views/helpers.ts:156) | Mobile “Open in window” ends at `workspace.openLinkText(linkText, sourcePath, "window")`. |

## FLOW

**Observed — legacy `GridRow` path**

```text
desktop row-header mousedown
GridRow.svelte:68–69
  → DataGrid.svelte:299–305
    false → parent onRowEdit(rowId, row)
    "tab" | "window" → optional parent onRowOpen(rowId, openMode)
```

- Plain desktop row-header click does not call `openLinkText`, `openFile`, or `getLeaf`; it invokes `onRowEdit` at [DataGrid.svelte:303](src/ui/views/Table/components/DataGrid/DataGrid.svelte:303).
- A double-click has no dedicated handler. Its constituent left `mousedown` events follow [GridRow.svelte:66](src/ui/views/Table/components/DataGrid/GridRow.svelte:66).
- Enter has no handler in `GridRow.svelte`.
- Long-press itself opens a menu. Tab/window choices call `openLinkText(String(rowId), sourcePath, mode)`, where `sourcePath` is `row["path"]` when string, otherwise `String(rowId)` at [GridRow.svelte:90](src/ui/views/Table/components/DataGrid/GridRow.svelte:90). “Open note” reaches `onRowEdit`, not workspace.
- No `getLeaf` or `openFile` occurs in this chain.

**Observed — current Dashboard Table V2 parallel path**

```text
TableRow.svelte:60 dispatch("openRecord", record)
  → DataTableContent.svelte:227 / 134–135
    → workspace.openLinkText(record.id, record.id, false)
```

[DatabaseCallBlock.svelte:509](src/ui/views/Dashboard/widgets/DatabaseCall/DatabaseCallBlock.svelte:509) mounts that Table V2 component.

**`openLinkText` inventory — observed arguments and classification**

| Site | `linkText`, `sourcePath` | Class |
|---|---|---|
| [BoardView.svelte:90](src/ui/views/Board/BoardView.svelte:90) | `record.id`, `record.id` | A — `DataRecord.id` is vault path. |
| [CalendarView.svelte:915](src/ui/views/Calendar/CalendarView.svelte:915) | `record.id`, `record.id` | A — record. |
| [CalendarView.svelte:947](src/ui/views/Calendar/CalendarView.svelte:947) | `record.id`, `record.id` | A — record. |
| [CalendarView.svelte:1548](src/ui/views/Calendar/CalendarView.svelte:1548) | `entry.id`, `entry.id` | A — modal record. |
| [CalendarView.svelte:1692](src/ui/views/Calendar/CalendarView.svelte:1692) | `id`, `id` | A — agenda event detail identifies a record. |
| [Day.svelte:408](src/ui/views/Calendar/components/Calendar/Day.svelte:408) | `record.id`, `record.id` | A — record. |
| [Day.svelte:411](src/ui/views/Calendar/components/Calendar/Day.svelte:411) | `record.id`, `record.id` | A — record. |
| [EventBarContainer.svelte:172](src/ui/views/Calendar/components/Calendar/EventBarContainer.svelte:172) | `record.id`, `record.id` | A — record. |
| [EventBarContainer.svelte:175](src/ui/views/Calendar/components/Calendar/EventBarContainer.svelte:175) | `record.id`, `record.id` | A — record. |
| [TimelineView.svelte:233](src/ui/views/Calendar/components/Calendar/TimelineView.svelte:233) | `found.record.id`, `found.record.id` | A — found record. |
| [EventList.svelte:99](src/ui/views/Calendar/components/Calendar/EventList.svelte:99) | emitted `linkText`, `sourcePath` | A — `InternalLink` is given `record.id`, `record.id` at [EventList.svelte:92](src/ui/views/Calendar/components/Calendar/EventList.svelte:92). |
| [EventList.svelte:101](src/ui/views/Calendar/components/Calendar/EventList.svelte:101) | emitted `linkText`, `sourcePath` | A — same fixed record inputs. |
| [GalleryView.svelte:57](src/ui/views/Gallery/GalleryView.svelte:57) | `record.id`, `record.id` | A — record. |
| [GalleryView.svelte:68](src/ui/views/Gallery/GalleryView.svelte:68) | `record.id`, `record.id` | A — modal record. |
| [GalleryView.svelte:165](src/ui/views/Gallery/GalleryView.svelte:165) | `record.id`, `""` | A — record. |
| [GalleryView.svelte:167](src/ui/views/Gallery/GalleryView.svelte:167) | `record.id`, `""` | A — record. |
| [GalleryView.svelte:194](src/ui/views/Gallery/GalleryView.svelte:194) | emitted `linkText`, `sourcePath` | A — fixed from `record.id`, `record.id` at [GalleryView.svelte:188](src/ui/views/Gallery/GalleryView.svelte:188). |
| [GalleryView.svelte:196](src/ui/views/Gallery/GalleryView.svelte:196) | emitted `linkText`, `sourcePath` | A — same fixed record inputs. |
| [Inspector.svelte:47](src/ui/modals/components/Inspector.svelte:47) | `error.recordId`, `""` | A — `RecordError` record identifier. |
| [CardList.svelte:132](src/ui/views/Board/components/Board/CardList.svelte:132) | emitted `linkText`, `sourcePath` | A — fixed from `item.id`, `item.id` at [CardList.svelte:126](src/ui/views/Board/components/Board/CardList.svelte:126). |
| [CardList.svelte:134](src/ui/views/Board/components/Board/CardList.svelte:134) | emitted `linkText`, `sourcePath` | A — same fixed record inputs. |
| [tableRowOps.ts:109](src/ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts:109) | `record.id`, `record.id` | A — record. |
| [tableRowOps.ts:114](src/ui/views/Dashboard/widgets/DatabaseCall/tableRowOps.ts:114) | `record.id`, `record.id` | A — record. |
| [DataTableContent.svelte:135](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:135) | `e.detail.id`, `e.detail.id` | A — `e.detail` is dispatched as `DataRecord` by [TableRow.svelte:60](src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:60). |
| [CardMetadata/Text.svelte:41](src/ui/components/CardMetadata/Text.svelte:41) | rendered-anchor `href`, context `sourcePath` | B — rendered Markdown link. |
| [RichTextTag.svelte:42](src/ui/components/TagList/RichTextTag.svelte:42) | rendered-anchor `href`, context `sourcePath` | B — rendered Markdown link. |
| [ColumnHeader.svelte:49](src/ui/views/Board/components/Board/ColumnHeader.svelte:49) | rendered-anchor `href`, context `sourcePath` | B — rendered Markdown link. |
| [TextLabel.svelte:44](src/ui/views/Table/components/DataGrid/GridCell/GridTextCell/TextLabel.svelte:44) | rendered-anchor `href`, context `sourcePath` | B — rendered Markdown link. |
| [GridFileCell.svelte:37](src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/GridFileCell.svelte:37) | parsed wikilink `target`, context `sourcePath` | B — arbitrary wikilink target. |
| [RelationListView.svelte:44](src/ui/views/YamlVisualizer/RelationListView.svelte:44) | `link`, context `sourcePath` | B — generic relation link input. |
| [helpers.ts:152](src/ui/views/helpers.ts:152) | parameters `linkText`, `sourcePath` | UNKNOWN — generic helper; current callers include record IDs, but its signature permits arbitrary links. |
| [helpers.ts:156](src/ui/views/helpers.ts:156) | parameters `linkText`, `sourcePath` | UNKNOWN — same helper. |

## DEAD

| Symbol | Zero-importer evidence |
|---|---|
| `DataGrid` | Defined at [DataGrid.svelte:1](src/ui/views/Table/components/DataGrid/DataGrid.svelte:1); only re-exported at [index.ts:1](src/ui/views/Table/components/DataGrid/index.ts:1). No source consumer found. |
| `RecordCardView` | Defined at [RecordCardView.svelte:9](src/ui/components/RecordCardView/RecordCardView.svelte:9); no production importer found. Its test does not import the component, [recordCardView.test.ts:7](src/ui/views/Dashboard/__tests__/recordCardView.test.ts:7). The component explicitly labels itself reserved at [RecordCardView.svelte:1](src/ui/components/RecordCardView/RecordCardView.svelte:1). |

## PARALLEL

| Logic | Paths |
|---|---|
| Legacy Table row activation | [GridRow.svelte:69](src/ui/views/Table/components/DataGrid/GridRow.svelte:69) → [DataGrid.svelte:299](src/ui/views/Table/components/DataGrid/DataGrid.svelte:299). Plain activation edits via `onRowEdit`. |
| Live Dashboard Table V2 record opening | [TableRow.svelte:60](src/ui/views/Dashboard/widgets/DatabaseCall/TableRow.svelte:60) → [DataTableContent.svelte:135](src/ui/views/Dashboard/widgets/DatabaseCall/DataTableContent.svelte:135) → `openLinkText(id, id, false)`. |

## UNKNOWN

- ADR §2’s **18 A / 14 B** is not supported by the fixed `InternalLink` inputs at [CardList.svelte:126](src/ui/views/Board/components/Board/CardList.svelte:126), [EventList.svelte:92](src/ui/views/Calendar/components/Calendar/EventList.svelte:92), and [GalleryView.svelte:188](src/ui/views/Gallery/GalleryView.svelte:188). Those six sites are A, not B. Observed result: **24 A / 6 B / 2 generic-helper UNKNOWN**. No production site was missed; the extra `rg` result is the test regex at [linkedSourceWrites.test.ts:96](src/ui/views/Dashboard/widgets/__tests__/linkedSourceWrites.test.ts:96).
- `RecordCardView` is statically prop-compatible with `EditNote`: it passes `fields`, non-null-guarded `record`, `allRecords`, `autosave`, `onSave`, `onOpenNote`, and `onRenameNote` at [RecordCardView.svelte:167](src/ui/components/RecordCardView/RecordCardView.svelte:167). I did not run `svelte-check`; compilation is therefore unverified.
- Static reading cannot establish whether an external runtime consumer dynamically instantiates the legacy `DataGrid`, nor what any parent would do in `onRowEdit` / optional `onRowOpen`.
- Falsifiers: a source import of `DataGrid` or `RecordCardView`; a dynamic component registry outside the searched source; or a Svelte compile failure would respectively falsify the zero-importer and prop-compatibility observations.

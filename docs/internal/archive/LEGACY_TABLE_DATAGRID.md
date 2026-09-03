# Archived — the legacy Table / DataGrid tree (#183), deleted 2026-09-03

> Deleted from `src/ui/views/Table/` on 2026-09-03. The text is kept here because it was written
> deliberately and is not recoverable from a reader's memory, only from git.
>
> **Why it went.** `src/view.ts:14-17` registers four project views — Board, Calendar, Dashboard,
> Gallery. There is no Table view and there is no `TableView.svelte`; this tree's only root is the
> `DataGrid/index.ts` barrel, and no file outside the tree imports it. The Codex code-mapper traced
> every exported symbol and every one of the 22 components and reported NONE outside the tree, by
> any route: static import, `import()`, `require`, `jest.mock`, a path string, or a registry. The
> full map is `docs/internal/codex-reports/CX-MAP-183.md`.
>
> **Why the check was heavier than #178's.** Those were three type-only files, where `tsc` at zero
> and a byte-identical bundle were the proof. This is runtime code: it compiles, it would run, and
> a bundle comparison is part of the evidence rather than a formality.
>
> **What it was.** A generic data grid — rows, resizable columns, a header, a bulk-action bar and
> nine typed cell editors — superseded by the Dashboard's Table V2
> (`views/Dashboard/widgets/DatabaseCall/`), which shares not one file with it.
>
> **One thing worth carrying forward:** `GridRollupCell.svelte` mirrored `RollupCellRenderer`'s
> percent parsing, and both turned a null percentage into a visible `0%`. That renderer is itself
> unmounted today; when #180d gives the display layer units, it should not re-learn this habit.


## `src/ui/views/Table/helpers.test.ts`

```ts
import { describe, expect, it } from "@jest/globals";
import {
  DataFieldType,
  type DataField,
} from "../../../lib/dataframe/dataframe";
import { sortFields } from "./helpers";

describe("sortFields", () => {
  it("sort single field", () => {
    const fields = [
      {
        name: "foo",
        type: DataFieldType.String,
        repeated: false,
        identifier: false,
        derived: false,
      },
    ];
    const order = ["foo"];

    const sorted = sortFields(fields, order);

    expect(sorted).toStrictEqual(fields);
  });

  it("sort fields where all are specified", () => {
    const defaultField: Omit<DataField, "name"> = {
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    };

    const fields: DataField[] = [
      { name: "foo", ...defaultField },
      { name: "bar", ...defaultField },
      { name: "baz", ...defaultField },
    ];

    const want: DataField[] = [
      { name: "baz", ...defaultField },
      { name: "bar", ...defaultField },
      { name: "foo", ...defaultField },
    ];

    const order = ["baz", "bar", "foo"];

    const sorted = sortFields(fields, order);

    expect(sorted).toStrictEqual(want);
  });

  it("sorts unspecified fields last", () => {
    const defaultField: Omit<DataField, "name"> = {
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    };

    const fields: DataField[] = [
      { name: "foo", ...defaultField },
      { name: "bar", ...defaultField },
      { name: "baz", ...defaultField },
    ];

    const want: DataField[] = [
      { name: "baz", ...defaultField },
      { name: "foo", ...defaultField },
      { name: "bar", ...defaultField },
    ];

    const order = ["baz", "foo"];

    const sorted = sortFields(fields, order);

    expect(sorted).toStrictEqual(want);
  });

  it("doesn't sort fields if order is empty", () => {
    const defaultField: Omit<DataField, "name"> = {
      type: DataFieldType.String,
      repeated: false,
      identifier: false,
      derived: false,
    };

    const fields: DataField[] = [
      { name: "foo", ...defaultField },
      { name: "baz", ...defaultField },
      { name: "bar", ...defaultField },
    ];

    const want: DataField[] = [
      { name: "foo", ...defaultField },
      { name: "baz", ...defaultField },
      { name: "bar", ...defaultField },
    ];

    const order: string[] = [];

    const sorted = sortFields(fields, order);

    expect(sorted).toStrictEqual(want);
  });
});
```

## `src/ui/views/Table/helpers.ts`

```ts
import { produce } from "immer";
import type { DataField } from "src/lib/dataframe/dataframe";

export function sortFields(fields: DataField[], order: string[]) {
  if (!order.length) {
    return fields;
  }

  const test = produce(fields, (draft) => {
    draft.sort((left, right) => {
      if (!order.includes(left.name)) {
        return 1;
      }
      if (!order.includes(right.name)) {
        return -1;
      }
      return order.indexOf(left.name) - order.indexOf(right.name);
    });
  });

  return test;
}
```

## `src/ui/views/Table/components/DataGrid/BulkActionBar.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { GridRowId } from "./dataGrid";

  export let selectedIds: Set<GridRowId>;
  export let readonly: boolean = false;

  const dispatch = createEventDispatcher<{
    deleteSelected: void;
    clearSelection: void;
  }>();

  $: count = selectedIds.size;
</script>

{#if count > 0}
  <div class="ppp-bulk-bar" role="toolbar" aria-label="Bulk actions">
    <span class="ppp-bulk-count">{count} selected</span>
    <button
      class="ppp-bulk-btn ppp-bulk-btn--clear"
      on:click={() => dispatch("clearSelection")}
      aria-label="Deselect all"
    >✕ Deselect all</button>
    {#if !readonly}
      <button
        class="ppp-bulk-btn ppp-bulk-btn--danger"
        on:click={() => dispatch("deleteSelected")}
        aria-label="Delete selected"
      >Delete {count}</button>
    {/if}
  </div>
{/if}

<style>
  .ppp-bulk-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: var(--ppp-db-canvas-bg, var(--background-secondary));
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    font-size: var(--font-ui-small);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .ppp-bulk-count {
    font-weight: 600;
    color: var(--text-normal);
    margin-right: 0.25rem;
  }

  .ppp-bulk-btn {
    padding: 0.125rem 0.625rem;
    border-radius: 0.25rem;
    border: 0.0625rem solid var(--background-modifier-border);
    background: transparent;
    cursor: pointer;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    transition: background 100ms ease, color 100ms ease;
  }

  .ppp-bulk-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .ppp-bulk-btn--danger {
    color: var(--text-error);
    border-color: var(--text-error);
  }

  .ppp-bulk-btn--danger:hover {
    background: var(--text-error);
    color: var(--background-primary);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/DataGrid.svelte`

```svelte
<script lang="ts">
  import { produce } from "immer";

  import { i18n } from "src/lib/stores/i18n";

  import GridRow from "./GridRow.svelte";
  import BulkActionBar from "./BulkActionBar.svelte";

  import type {
    GridColDef,
    GridRowId,
    GridRowModel,
    GridRowProps,
  } from "./dataGrid";
  import GridCellGroup from "./GridCellGroup.svelte";
  import { Button, Icon } from "obsidian-svelte";
  import GridHeader from "./GridHeader/GridHeader.svelte";
  import {
    openContextMenu,
    openContextMenuDeferred,
    type ContextMenuEntry,
  } from "src/lib/contextMenu";

  export let columns: GridColDef[];
  export let rows: GridRowProps[];
  export let colorModel: (rowId: string) => string | null;

  export let readonly: boolean;

  export let onColumnResize: (field: string, width: number) => void;
  export let onColumnSort: (fields: string[]) => void;
  export let onDataSort: ((field: string, order: "asc" | "desc") => void) | undefined = undefined;
  export let onRowAdd: () => void;
  export let onRowChange: (rowId: GridRowId, row: GridRowModel) => void;
  export let onColumnConfigure: (column: GridColDef, editable: boolean) => void;
  export let onColumnDelete: (field: string) => void;
  export let onColumnHide: (column: GridColDef) => void;
  export let onColumnPin: (column: GridColDef) => void;
  export let onColumnInsert: (
    anchor: string, // anchor field name
    direction: number // 1 for right, 0 for left insert (keep the place and push back others)
  ) => void;
  export let onRowDelete: (rowId: GridRowId) => void;
  export let onRowEdit: (rowId: GridRowId, row: GridRowModel) => void;
  // v3.0.8: Direct click on row opens note with modifier-based navigation
  export let onRowOpen: ((rowId: GridRowId, openMode: false | 'tab' | 'window') => void) | undefined = undefined;
  /**
   * R2.1b — optional extension point for column-header context menus.
   * When provided, returned entries are appended after the legacy
   * configure / hide / pin / delete entries with a separator. Lets
   * the Database canvas inject property-type override and rollup
   * mode pickers without coupling to legacy Table internals.
   */
  export let getExtraColumnMenuEntries:
    | ((column: GridColDef) => ContextMenuEntry[])
    | undefined = undefined;
  /** S8 — callback for bulk delete; when provided, row checkboxes are enabled. */
  export let onBulkDelete: ((rowIds: GridRowId[]) => void) | undefined = undefined;
  /** When provided (and not readonly), double-clicking a column header enters inline rename. */
  export let onColumnRename: ((field: string, newName: string) => void) | undefined = undefined;
  /** NPLAN-D2 — name of the field whose value is rendered as a per-row page icon. */
  export let iconField: string | undefined = undefined;
  /**
   * Tab-insert (P3 Table UX): called when Tab is pressed at the last cell of
   * the last row and the grid is not readonly. The callback should create a
   * new record; DataGrid will move focus to the first cell of the new row once
   * `rows` updates reactively.
   */
  export let onRowAddSilent: (() => void) | undefined = undefined;
  /**
   * #044.3b — optional extension point for the row context menu. When provided
   * (i.e. DataTableWidget is mounted inside a DashboardCanvas with an active
   * selectionStore), `createRowMenu` appends one entry: either "Filter canvas
   * by this row" (when no own selection is active or active on a different
   * row) or "Clear canvas filter" (when this row is already the active
   * driver). `currentlyDrivingRowId` lets the menu pick the right label
   * without DataGrid having to know about selection-state shape.
   */
  export let onRowFilterCanvas: ((rowId: GridRowId, row: GridRowModel) => void) | undefined = undefined;
  /**
   * #044.3b — `rowId` whose context-menu should render "Clear canvas filter"
   * instead of "Filter canvas by this row". DataTableWidget computes this
   * from `isThisWidgetDriving(selection, widgetId)` + the driven path.
   * `null` (default) means the toggle is in the "Filter…" direction for
   * every row.
   */
  export let driverRowId: GridRowId | null = null;

  $: t = $i18n.t;

  $: visibleColumns = columns.filter((column) => !column.hide);
  $: sortedColumns = visibleColumns;

  // S8 — bulk selection state
  let selectedRowIds = new Set<GridRowId>();
  $: anySelected = selectedRowIds.size > 0;

  function toggleRowSelect(rowId: GridRowId) {
    const next = new Set(selectedRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    selectedRowIds = next;
  }

  function clearSelection() {
    selectedRowIds = new Set();
  }

  function handleBulkDelete() {
    const ids = [...selectedRowIds];
    clearSelection();
    onBulkDelete?.(ids);
  }

  // [column, row]
  let activeCell: [number, number] = [3, 3];

  // Tab-insert focus: when we trigger a silent row insert, record how many
  // rows we expect and move focus to the first cell of the new row as soon
  // as `rows` grows to that count.
  let tabInsertExpectedRows = -1;
  $: if (tabInsertExpectedRows >= 0 && rows.length === tabInsertExpectedRows) {
    activeCell = [2, rows.length + 3]; // minColIdx=2, rowOffset=3
    tabInsertExpectedRows = -1;
  }

  function createColumnMenu(column: GridColDef, event: MouseEvent) {
    const editable = !!column.editable && !readonly;
    const entries: ContextMenuEntry[] = [];

    if (onDataSort) {
      entries.push(
        { title: t("components.data-grid.sort.asc"), icon: "arrow-up", onClick: () => onDataSort!(column.field, "asc") },
        { title: t("components.data-grid.sort.desc"), icon: "arrow-down", onClick: () => onDataSort!(column.field, "desc") },
        { separator: true },
      );
    }

    entries.push(
      { title: t("components.data-grid.column.configure"), icon: "settings", onClick: () => onColumnConfigure(column, editable) },
    );

    if (!readonly) {
      entries.push(
        { title: t("components.data-grid.column.insert-left"), icon: "arrow-left", onClick: () => onColumnInsert(column.field, 0) },
        { title: t("components.data-grid.column.insert-right"), icon: "arrow-right", onClick: () => onColumnInsert(column.field, 1) },
      );
    }

    entries.push(
      { separator: true },
      {
        title: column.pinned ? t("components.data-grid.column.unpin") : t("components.data-grid.column.pin"),
        icon: column.pinned ? "pin-off" : "pin",
        onClick: () => onColumnPin(column),
      },
      { title: t("components.data-grid.column.hide"), icon: "eye-off", onClick: () => onColumnHide(column) },
    );

    if (editable) {
      entries.push({ title: t("components.data-grid.column.delete"), icon: "trash", danger: true, onClick: () => onColumnDelete(column.field) });
    }

    if (getExtraColumnMenuEntries) {
      const extras = getExtraColumnMenuEntries(column);
      if (extras.length > 0) {
        entries.push({ separator: true }, ...extras);
      }
    }

    openContextMenu(entries, event);
  }

  function createRowMenu(rowId: GridRowId, row: GridRowModel, event: MouseEvent) {
    const entries: ContextMenuEntry[] = [
      { title: t("components.data-grid.row.edit"), icon: "edit", onClick: () => onRowEdit(rowId, row) },
    ];

    // #044.3b — driver entry: only when the widget is wired into a
    // DashboardCanvas (callback supplied) and we have a non-empty row id.
    // The label flips between "Filter by this row" and "Clear canvas filter"
    // based on which row currently drives the selection, so the toggle
    // direction stays visible without forcing the user to open the menu
    // twice.
    if (onRowFilterCanvas) {
      const isThisRowActive = driverRowId !== null && rowId === driverRowId;
      entries.push(
        { separator: true },
        {
          title: isThisRowActive
            ? t("components.data-grid.row.clear-canvas-filter", { defaultValue: "Clear canvas filter" })
            : t("components.data-grid.row.filter-canvas", { defaultValue: "Filter canvas by this row" }),
          icon: isThisRowActive ? "filter-x" : "filter",
          onClick: () => onRowFilterCanvas?.(rowId, row),
        },
      );
    }

    if (!readonly) {
      entries.push(
        { separator: true },
        { title: t("components.data-grid.row.delete"), icon: "trash", danger: true, onClick: () => onRowDelete(rowId) },
      );
    }

    openContextMenuDeferred(entries, event);
  }

  function createCellMenu(
    rowId: GridRowId,
    row: GridRowModel,
    column: GridColDef,
    event: MouseEvent,
  ) {
    const entries: ContextMenuEntry[] = [];

    if (column.editable) {
      entries.push({
        title: t("components.data-grid.cell.clear"),
        icon: "x",
        onClick: () => {
          onRowChange(
            rowId,
            produce(row, (draft) => {
              draft[column.field] = null;
              return draft;
            })
          );
        },
      });
    }

    if (entries.length > 0) {
      openContextMenuDeferred(entries, event);
    }
  }

  function handleColumnOrder(columns: GridColDef[]) {
    onColumnSort(columns.map((col) => col.field));
  }

  const clamp = (num: number, min: number, max: number) =>
    Math.min(Math.max(num, min), max);
</script>

<div
  role="grid"
  aria-label={t("components.data-grid.grid-label")}
  aria-colcount={sortedColumns.length + 1}
  aria-rowcount={rows.length + 2}
>
  <!-- S8: bulk-action bar (shown when any rows selected) -->
  {#if anySelected}
    <BulkActionBar
      selectedIds={selectedRowIds}
      {readonly}
      on:deleteSelected={handleBulkDelete}
      on:clearSelection={clearSelection}
    />
  {/if}

  <GridHeader
    columns={sortedColumns
      .filter((col) => !col.hide)
      // svelte-dnd-action needs an `id` property.
      .map((col) => ({ ...col, id: col.field }))}
    onResize={(name, width) => {
      columns = columns.map((column) =>
        column.field === name ? { ...column, width } : column
      );
    }}
    onFinalizeResize={(name, width) => {
      onColumnResize(name, width);
    }}
    onColumnMenu={(field, event) => createColumnMenu(field, event)}
    onColumnOrder={handleColumnOrder}
    onAddColumn={readonly ? undefined : () => {
      const lastCol = sortedColumns.filter((c) => !c.hide).at(-1);
      if (lastCol) onColumnInsert(lastCol.field, 1);
    }}
    onColumnRename={readonly ? undefined : onColumnRename}
  />
  {#each rows as { rowId, row, cellStyles, highlighted, dimmed }, i (rowId)}
    <GridRow
      columns={sortedColumns}
      index={i + 2}
      {rowId}
      {row}
      {activeCell}
      {onRowChange}
      cellStyles={cellStyles ?? {}}
      color={colorModel(rowId)}
      iconValue={iconField ? row[iconField] : null}
      selected={selectedRowIds.has(rowId)}
      highlighted={highlighted ?? false}
      dimmed={dimmed ?? false}
      onToggleSelect={onBulkDelete ? toggleRowSelect : undefined}
      onRowMenu={(rowId, row, event) => createRowMenu(rowId, row, event)}
      onRowOpen={(rowId, openMode) => {
        if (onRowOpen && openMode) {
          onRowOpen(rowId, openMode);
        } else {
          onRowEdit(rowId, row);
        }
      }}
      onCellMenu={(rowId, column, value, event) => createCellMenu(rowId, row, column, event)}
      on:navigate={({ detail: navinfo }) => {
        const colOffset = 1;
        const rowOffset = 3;

        const minColIdx = 1 + colOffset;
        const maxColIdx = sortedColumns.length + colOffset;

        const minRowIdx = 1 + rowOffset;
        const maxRowIdx = rows.length + rowOffset;

        const [colIdx, rowIdx, wrap] = navinfo;

        const wrapPrev =
          wrap && colIdx < minColIdx && !(rowIdx - 1 < minRowIdx);
        const wrapNext =
          wrap && colIdx > maxColIdx && !(rowIdx + 1 > maxRowIdx);
        // Tab at very last cell of last row → silent insert
        const tabAtEnd =
          wrap && colIdx > maxColIdx && rowIdx + 1 > maxRowIdx;

        if (tabAtEnd && !readonly && onRowAddSilent) {
          tabInsertExpectedRows = rows.length + 1;
          onRowAddSilent();
        } else if (wrapPrev) {
          activeCell = [maxColIdx, rowIdx - 1];
        } else if (wrapNext) {
          activeCell = [minColIdx, rowIdx + 1];
        } else {
          activeCell = [
            clamp(colIdx, minColIdx, maxColIdx),
            clamp(rowIdx, minRowIdx, maxRowIdx),
          ];
        }
      }}
    />
  {/each}
  <GridCellGroup index={rows.length + 2} footer>
    <span
      class="width-provider"
      style={`width: ${60 + (sortedColumns[0]?.width ?? 0)}`}
    >
      <span class="focus-provider">
        <Button variant="plain" on:click={() => onRowAdd()}>
          <Icon name="plus" />
          {t("components.data-grid.row.add")}
        </Button>
      </span>
    </span>
  </GridCellGroup>
</div>

<style>
  div {
    display: inline-block;
  }

  .width-provider {
    padding: 0.25rem;
    position: sticky;
    left: 0;
  }

  .focus-provider {
    display: inline-flex;
    border-radius: var(--button-radius);
  }

  .focus-provider:focus-within {
    box-shadow: 0 0 0 0.125rem var(--background-modifier-border-focus);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCellGroup.svelte`

```svelte
<script lang="ts">
  export let index: number;
  export let header: boolean = false;
  export let footer: boolean = false;
  /** S8 — row is checked for bulk actions; provides accent-tint background. */
  export let selected: boolean = false;
  /**
   * #044.3a — row matches the canvas selection emitted by another widget.
   * Adds the `ppp-data-table-row--highlighted` class (spec §5.2). Default
   * `false` so standalone Table rows render unchanged.
   */
  export let highlighted: boolean = false;
  /**
   * #044.3a — row does NOT match an active external selection. Adds the
   * `ppp-data-table-row--dimmed` class so the row fades out while preserving
   * table geometry (spec §5.2). Default `false`.
   */
  export let dimmed: boolean = false;
</script>

<div
  role="row"
  aria-rowindex={index}
  aria-selected={selected || undefined}
  class:header
  class:footer
  class:selected
  class:ppp-data-table-row--highlighted={highlighted}
  class:ppp-data-table-row--dimmed={dimmed}
>
  <slot />
</div>

<style>
  div {
    display: flex;
    /*
     * R-phase Bug #3 — body-row hover highlight. Each `<GridCell>` reads
     * `--ppp-row-hover-bg` from its parent so the entire row tints in
     * sync without per-cell `mouseenter` bookkeeping. Headers and footers
     * opt out so sticky chrome stays calm.
     */
    --ppp-row-hover-bg: transparent;
    transition: background-color 120ms ease;
  }

  div:hover:not(.header):not(.footer) {
    --ppp-row-hover-bg: var(--background-modifier-hover);
  }

  /* R5-020: selected row — accent-tinted background so checked rows stand out */
  div.selected:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 10%, transparent);
  }

  div.selected:hover:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 16%, transparent);
  }

  /*
   * #044.3a cross-widget receiver decoration. The DataTableWidget sets these
   * classes when another widget (e.g. a Chart segment) drives a selection on
   * the same canvas. Hidden rows are NOT removed — geometry is preserved so
   * users see the cohort in situ (spec §5.2).
   */
  div.ppp-data-table-row--highlighted:not(.header):not(.footer) {
    --ppp-row-hover-bg: color-mix(in srgb, var(--interactive-accent) 12%, transparent);
    box-shadow: inset 0.1875rem 0 0 0 var(--interactive-accent);
  }

  div.ppp-data-table-row--dimmed:not(.header):not(.footer) {
    opacity: 0.35;
  }

  div.ppp-data-table-row--dimmed:not(.header):not(.footer):hover {
    /* Keep dimmed rows interactive — hover lifts the veil so users can still
       inspect / edit non-matching rows without clearing the selection. */
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    div { transition: none; }
  }

  .header {
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .footer {
    position: sticky;
    bottom: 0;
    z-index: 10;

    background-color: var(--background-primary-alt);
    border-bottom: 1px solid var(--background-modifier-border);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridRow.svelte`

```svelte
<script lang="ts">
  import { produce } from "immer";

  import { GridCell, GridTypedCell } from "./GridCell";
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import GridCellGroup from "./GridCellGroup.svelte";
  import { PageIcon } from "src/ui/components/PageIcon";

  import type { GridColDef, GridRowId, GridRowModel } from "./dataGrid";
  import { showMobileNavMenu } from "src/ui/views/helpers";
  import { app } from "src/lib/stores/obsidian";
  import { isTouchDevice } from "src/lib/stores/ui";

  import { setContext, onDestroy } from "svelte";
  import { writable } from "svelte/store";

  export let rowId: GridRowId;
  export let index: number;
  export let row: GridRowModel;
  export let columns: GridColDef[];
  export let activeCell: [number, number];
  export let color: string | null;
  /** Per-cell inline styles from conditional formatting (field → CSS). */
  export let cellStyles: Record<string, string> = {};

  setContext<string>("sourcePath", row["path"]);

  // Expose cell styles to GridCell via context
  const cellStyleStore = writable<Record<string, string>>({});
  setContext("ppp-cellStyles", cellStyleStore);
  $: $cellStyleStore = cellStyles;

  export let onRowChange: (rowId: GridRowId, row: GridRowModel) => void;
  export let onRowMenu: (rowId: GridRowId, row: GridRowModel, event: MouseEvent) => void;
  // v3.0.8: Row open handler with modifier-based navigation
  export let onRowOpen: (rowId: GridRowId, openMode: false | 'tab' | 'window') => void;
  export let onCellMenu: (
    rowId: GridRowId,
    column: GridColDef,
    value: Optional<DataValue>,
    event: MouseEvent,
  ) => void;
  /** S8 — whether this row is selected for bulk actions */
  export let selected: boolean = false;
  /** S8 — callback when row checkbox is toggled */
  export let onToggleSelect: ((rowId: GridRowId) => void) | undefined = undefined;
  /** NPLAN-D2 — page icon value pulled from `iconField` (emoji or lucide name). */
  export let iconValue: unknown = null;
  /**
   * #044.3a — cross-widget receiver flag: this row matches the canvas selection
   * emitted by another widget. Renders an accent tint. Defaults to `false` so
   * standalone Table (which never passes this) stays unaffected.
   */
  export let highlighted: boolean = false;
  /**
   * #044.3a — cross-widget receiver flag: this row does not match an active
   * external selection. Renders at reduced opacity. Default `false` keeps
   * standalone Table behaviour intact.
   */
  export let dimmed: boolean = false;

  function handleHeaderClick(): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      if (event.button === 2) {
        onRowMenu(rowId, row, event);
      } else if (event.button === 0) {
        // v3.0.8: Left click on row header — open note with modifier-based navigation
        const openMode = event.shiftKey ? 'window' as const : (event.ctrlKey || event.metaKey) ? 'tab' as const : false as const;
        onRowOpen(rowId, openMode);
      }
    };
  }

  // v3.0.10: Long-press detection for touch devices on row header
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let touchStartPos: { x: number; y: number } | null = null;
  const LONG_PRESS_MS = 500;
  const MOVE_THRESHOLD = 10;

  function handleRowTouchStart(e: TouchEvent) {
    if (!$isTouchDevice) return;
    longPressFired = false;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (navigator.vibrate) navigator.vibrate(30);
      const sourcePath = typeof row["path"] === "string" ? row["path"] : String(rowId);
      showMobileNavMenu($app, String(rowId), sourcePath, e, () => onRowOpen(rowId, false));
    }, LONG_PRESS_MS);
  }

  function handleRowTouchMove(e: TouchEvent) {
    if (!longPressTimer || !touchStartPos) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleRowTouchEnd(e: TouchEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (longPressFired) {
      e.preventDefault();
      longPressFired = false;
    }
  }

  onDestroy(() => {
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  function handleCellClick(
    column: GridColDef,
    value: Optional<DataValue>
  ): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      if (event.button === 2) {
        onCellMenu(rowId, column, value, event);
      }

      if (event.target instanceof HTMLTableCellElement) {
        if (event.target.firstChild instanceof HTMLInputElement) {
          event.target.firstChild.focus();
          event.preventDefault();
        }
      }
    };
  }
</script>

<GridCellGroup {index} {selected} {highlighted} {dimmed}>
  <GridCell
    rowindex={1}
    colindex={1}
    column={{ field: "", header: true, width: 60, editable: false }}
    rowHeader
    on:mousedown={handleHeaderClick()}
    on:touchstart={handleRowTouchStart}
    on:touchmove={handleRowTouchMove}
    on:touchend={handleRowTouchEnd}
    {color}
  >
    <div slot="read" class="ppp-row-header-cell">
      <!-- S8: six-dot drag handle (hover-only) -->
      <span class="ppp-drag-handle" aria-hidden="true" draggable="true" title="Drag to reorder">⠿</span>
      {#if iconValue}
        <PageIcon value={iconValue} size={0.875} />
      {/if}
      <!-- S8: bulk-select checkbox -->
      {#if onToggleSelect}
        <input
          class="ppp-row-checkbox"
          type="checkbox"
          checked={selected}
          aria-label="Select row"
          on:change|stopPropagation={() => onToggleSelect?.(rowId)}
          on:mousedown|stopPropagation
        />
      {:else}
        <span class="ppp-row-num">{(index - 1).toString()}</span>
      {/if}
    </div>
  </GridCell>

  {#each columns as column, i (column.field)}
    <GridTypedCell
      selected={activeCell[0] === i + 2 && activeCell[1] === index + 2}
      rowindex={index + 2}
      colindex={i + 2}
      value={row[column.field]}
      {column}
      onChange={(value) => {
        onRowChange(
          rowId,
          produce(row, (draft) => {
            draft[column.field] = value;
            return draft;
          })
        );
      }}
      on:mousedown={handleCellClick(column, row[column.field])}
      on:navigate
    />
  {/each}
</GridCellGroup>

<style>
  .ppp-row-header-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    width: 100%;
    height: 100%;
  }

  .ppp-drag-handle {
    cursor: grab;
    color: var(--text-faint);
    font-size: 0.75rem;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 100ms ease;
    user-select: none;
  }

  /* Show drag handle only when row is hovered — parent GridCellGroup provides :hover context */
  :global(.ppp-cell-group:hover) .ppp-drag-handle {
    opacity: 0.6;
  }

  .ppp-drag-handle:hover {
    opacity: 1 !important;
    color: var(--text-muted);
  }

  .ppp-row-num {
    font-size: var(--font-ui-smaller);
    color: var(--text-faint);
    text-align: center;
    flex: 1;
  }

  .ppp-row-checkbox {
    cursor: pointer;
    width: 0.875rem;
    height: 0.875rem;
    flex-shrink: 0;
    accent-color: var(--interactive-accent);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/dataGrid.ts`

```ts
import type { DataFieldType, DataField } from "src/lib/dataframe/dataframe";

 
export type GridValidRowModel = { [key: string]: any };
export type GridRowModel<R extends GridValidRowModel = GridValidRowModel> = R;
export type GridColType = DataFieldType;

export interface GridColDef extends DataField {
  readonly field: string;
  readonly width?: number;
  readonly hide?: boolean;
  readonly editable?: boolean;
  readonly header?: boolean;
  readonly pinned?: boolean;
}

export type GridRowId = string;

export interface GridRowProps {
  readonly rowId: GridRowId;
  readonly row: GridRowModel;
  /** Optional per-cell inline styles (field name → CSS string). */
  readonly cellStyles?: Record<string, string>;
  /**
   * #044.3a cross-widget receiver flag: row matches the canvas-level selection
   * emitted by another widget. Additive/optional so standalone Table consumers
   * — which never set this — keep their existing un-styled appearance.
   */
  readonly highlighted?: boolean;
  /**
   * #044.3a cross-widget receiver flag: row does NOT match an active selection
   * from another widget. Renders at reduced opacity. Additive/optional for the
   * same backwards-compat reason as `highlighted`.
   */
  readonly dimmed?: boolean;
}
```

## `src/ui/views/Table/components/DataGrid/index.ts`

```ts
export { default as DataGrid } from "./DataGrid.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridCell.svelte`

```svelte
<script lang="ts">
  import { useClickOutside } from "obsidian-svelte";
  import { createEventDispatcher, getContext } from "svelte";
  import type { Writable } from "svelte/store";
  import type { GridColDef } from "../dataGrid";

  import Resizer from "./Resizer.svelte";

  // Read per-cell conditional format styles from GridRow context
  const cellStyleStore = getContext<Writable<Record<string, string>> | undefined>("ppp-cellStyles");
  $: extraStyle = (column?.field && cellStyleStore) ? ($cellStyleStore?.[column.field] ?? "") : "";

  export let selected: boolean = false;
  export let edit: boolean = false;
  export let resizable: boolean = false;
  export let onResize: (width: number) => void = () => {};
  export let onFinalizeResize: (width: number) => void = () => {};
  export let column: Partial<GridColDef>;
  export let rowindex: number;
  export let colindex: number;
  export let columnHeader: boolean = false;
  export let rowHeader: boolean = false;
  export let error: boolean = false;
  export let onEditChange: (value: boolean) => void = (value: boolean) => {
    edit = value;
  };
  export let color: string | null = null;
  export let onCopy: () => void = () => {};
  export let onCut: () => void = () => {};
  export let onPaste: () => void = () => {};
  /** Dynamic left offset for pinned columns (px). If set, overrides CSS left. */
  export let pinnedLeft: number | undefined = undefined;

  const dispatch = createEventDispatcher<{
    navigate: [number, number, boolean?];
  }>();

  let hover: boolean = false;

  let ref: HTMLDivElement;

  $: if (selected && ref) {
    ref.focus();
    ref.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }

  function handleClick() {
    if (!column.header && !columnHeader && !rowHeader) {
      selected = true;
    }
  }
  function handleDoubleClick() {
    if (!column.header && !columnHeader && !rowHeader && column.editable) {
      onEditChange(true);
    }
  }
  function handleKeyDown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case "c":
          onCopy();
          break;
        case "x":
          onCut();
          break;
        case "v":
          onPaste();
          break;
      }
    }
    switch (event.key) {
      case "Enter":
        if (edit) {
          onEditChange(false);
          ref.focus();
        } else {
          if (column.editable) onEditChange(true);
        }
        break;
      case "Escape":
        onEditChange(false);
        ref.focus();
        break;
      case "ArrowLeft":
        if (!edit) {
          dispatch("navigate", [colindex - 1, rowindex]);
          event.preventDefault();
        }
        break;
      case "ArrowRight":
        if (!edit) {
          dispatch("navigate", [colindex + 1, rowindex]);
          event.preventDefault();
        }
        break;
      case "ArrowUp":
        if (!edit) {
          dispatch("navigate", [colindex, rowindex - 1]);
          event.preventDefault();
        }
        break;
      case "ArrowDown":
        if (!edit) {
          dispatch("navigate", [colindex, rowindex + 1]);
          event.preventDefault();
        }
        break;
      case "Tab":
        if (event.shiftKey) {
          dispatch("navigate", [colindex - 1, rowindex, true]);
        } else {
          dispatch("navigate", [colindex + 1, rowindex, true]);
        }
        event.preventDefault();
        break;
    }
  }

  function handleBlur(event: FocusEvent) {
    hover = false;

    if (
      event.currentTarget instanceof HTMLDivElement &&
      event.relatedTarget instanceof HTMLElement &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      selected = false;
      onEditChange(false);
    }
  }

  function role() {
    if (columnHeader) {
      return "columnheader";
    } else if (rowHeader) {
      return "rowheader";
    } else {
      return "gridcell";
    }
  }
</script>

{#if rowHeader}
  <div
    bind:this={ref}
    role={role()}
    class:rowHeader
    aria-rowindex={rowindex}
    style={`width: ${column.width}px`}
    on:mouseenter={() => (hover = true)}
    on:mouseleave={() => (hover = false)}
    on:mousedown
    on:touchstart
    on:touchmove
    on:touchend
  >
    {#if $$slots.hover && hover}
      <slot name="hover" />
    {:else}
      <slot name="read" />
    {/if}

    <span
      class="color-bar"
      style="background-color: {color ? color : 'transparent'};"
    />
  </div>
{:else}
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <div
    bind:this={ref}
    role={role()}
    aria-selected={rowHeader || columnHeader ? undefined : selected}
    aria-colindex={colindex}
    aria-rowindex={rowindex}
    class:header={column.header}
    class:selected
    class:rowHeader
    class:columnHeader
    class:pinned={column.pinned}
    class:editable={column.editable && !columnHeader && !rowHeader}
    class:error
    style={`width: ${column.width}px${column.pinned && pinnedLeft != null ? `; left: ${pinnedLeft}px` : ''}${extraStyle ? '; ' + extraStyle : ''}`}
    tabindex={!columnHeader && !rowHeader ? -1 : undefined}
    on:click={handleClick}
    on:dblclick={handleDoubleClick}
    on:mousedown
    on:mouseenter={() => (hover = true)}
    on:mouseleave={() => (hover = false)}
    on:focus={() => {
      hover = true;
      selected = true;
    }}
    on:blur={handleBlur}
    on:keydown={handleKeyDown}
    use:useClickOutside={() => {
      onEditChange(false);
      selected = false;
    }}
  >
    {#if $$slots.edit && edit}
      {#if column.editable}
        <slot name="edit" />
      {:else}
        <slot name="read" />
      {/if}
    {:else if $$slots.selected && selected}
      <slot name="selected" />
    {:else if $$slots.hover && hover}
      <slot name="hover" />
    {:else}
      <slot name="read" />
    {/if}

    {#if resizable}
      <Resizer
        width={column.width ?? 180}
        min={100}
        onChange={onResize}
        onFinalize={onFinalizeResize}
      />
    {/if}
  </div>
{/if}

<style>
  div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;

    background-color: var(--ppp-row-hover-bg, var(--background-primary));
    border-right: 1px solid var(--background-modifier-border);
    border-left-color: var(--background-modifier-border);
    border-bottom: 1px solid var(--background-modifier-border);

    width: 100%;
    min-height: 1.875rem;
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease,
      transform 80ms ease;
  }

  /* v4.0.0: Mobile - larger touch targets */
  @media (max-width: 30rem) {
    div {
      min-height: 2.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    div { transition: none; }
  }

  .selected {
    box-shadow: 0 0 0 0.125rem inset var(--interactive-accent);
    border-radius: var(--radius-s);
    padding: 0;
  }

  /* Affordance for editable cells */
  .editable {
    cursor: text;
  }
  .editable:hover {
    box-shadow: 0 0 0 0.0625rem inset var(--background-modifier-border-focus);
    background-color: var(--background-primary-alt);
  }
  /* Mouse-press feedback — subtle inset to confirm click registered */
  .editable:active {
    background-color: var(--background-modifier-active-hover, var(--background-modifier-hover));
  }
  .editable:focus-within {
    box-shadow: 0 0 0 0.125rem inset var(--interactive-accent);
    background-color: var(--background-primary);
  }
  /* Distinguish keyboard navigation from mouse focus */
  .editable:focus-visible:not(.selected) {
    outline: none;
    box-shadow: 0 0 0 0.125rem inset var(--interactive-accent-hover, var(--interactive-accent));
  }

  .columnHeader {
    background-color: var(--background-primary-alt);
    font-weight: 500;
    text-align: center;
    justify-content: space-between;
    padding: 0 var(--ppp-spacing-2xs, 0.25rem);
  }
  .columnHeader:hover {
    background-color: var(--background-modifier-hover);
  }

  .header {
    background-color: var(--background-primary-alt);
    position: sticky;
    left: var(--ppp-row-header-width, 3.75rem);
  }

  .rowHeader {
    left: 0;
    justify-content: center;
    z-index: 5;
    background-color: var(--background-primary-alt);
    font-weight: 500;
    padding: var(--ppp-spacing-3xs, 0.1875rem);
    gap: var(--ppp-spacing-2xs, 0.25rem);
    position: sticky;
    cursor: pointer;
  }
  .rowHeader:hover {
    background-color: var(--background-modifier-hover);
  }
  .rowHeader:active {
    background-color: var(--background-modifier-active-hover, var(--background-modifier-hover));
  }

  .pinned {
    /* Dynamic left offset set via inline style for multi-pin support */
    background-color: var(--background-primary-alt);
    position: sticky;
    border-right: 1px solid var(--background-modifier-border-focus);
    z-index: 4;
  }

  .error {
    background-color: rgba(var(--color-red-rgb, 255, 82, 82), 0.2) !important;
    border: 0.125rem solid var(--text-error) !important;
    color: var(--text-error);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridTypedCell.svelte`

```svelte
<script lang="ts">
  import {
    isOptionalBoolean,
    isOptionalDate,
    isOptionalList,
    isOptionalNumber,
    isOptionalString,
    type Optional,
    type DataValue,
  } from "src/lib/dataframe/dataframe";

  import GridCell from "./GridCell.svelte";

  import type { GridColDef } from "../dataGrid";
  import { GridBooleanCell } from "./GridBooleanCell";
  import { GridDateCell } from "./GridDateCell";
  import { GridDatetimeCell } from "./GridDatetimeCell";
  import { GridNumberCell } from "./GridNumberCell";
  import { GridTextCell } from "./GridTextCell";
  import { GridFileCell } from "./GridFileCell";
  import { GridListCell } from "./GridListCell";
  import { GridSelectCell } from "./GridSelectCell";
  import { GridRelationCell } from "./GridRelationCell";
  import { GridRollupCell } from "./GridRollupCell";

  export let value: Optional<DataValue>;
  export let onChange: (value: Optional<DataValue>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
</script>

{#if column.repeated && isOptionalList(value)}
  <GridListCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "string" && column.typeConfig?.fileLinks && isOptionalString(value)}
  <GridFileCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "string" && isOptionalString(value)}
  <GridTextCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "boolean" && isOptionalBoolean(value)}
  <GridBooleanCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "number" && isOptionalNumber(value)}
  <GridNumberCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "date" || column.type === "autotime"}
  {#if column.typeConfig?.time}
    <GridDatetimeCell
      {selected}
      {rowindex}
      {colindex}
      value={isOptionalDate(value) ? value : null}
      rawValue={!isOptionalDate(value) ? value : null}
      onChange={column.type === "autotime" ? () => undefined : onChange}
      {column}
      on:mousedown
      on:navigate
    />
  {:else}
    <GridDateCell
      {selected}
      {rowindex}
      {colindex}
      value={isOptionalDate(value) ? value : null}
      rawValue={!isOptionalDate(value) ? value : null}
      onChange={column.type === "autotime" ? () => undefined : onChange}
      {column}
      on:mousedown
      on:navigate
    />
  {/if}
{:else if (column.type === "select" || column.type === "status") && isOptionalString(value)}
  <GridSelectCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {onChange}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "relation"}
  <GridRelationCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {column}
    onChange={column.editable ? (v) => onChange(v) : undefined}
    on:mousedown
    on:navigate
  />
{:else if column.type === "rollup"}
  <GridRollupCell
    {selected}
    {rowindex}
    {colindex}
    {value}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "unique_id"}
  <GridTextCell
    {selected}
    {rowindex}
    {colindex}
    value={isOptionalString(value) ? value : null}
    onChange={() => undefined}
    {column}
    on:mousedown
    on:navigate
  />
{:else if column.type === "formula"}
  {#if typeof value === "boolean"}
    <GridBooleanCell {selected} {rowindex} {colindex} value={value} onChange={() => undefined} {column} on:mousedown on:navigate />
  {:else if typeof value === "number"}
    <GridNumberCell {selected} {rowindex} {colindex} value={value} onChange={() => undefined} {column} on:mousedown on:navigate />
  {:else if value instanceof Date}
    <GridDateCell {selected} {rowindex} {colindex} value={value} rawValue={null} onChange={() => undefined} {column} on:mousedown on:navigate />
  {:else}
    <GridTextCell {selected} {rowindex} {colindex} value={value != null ? String(value) : null} onChange={() => undefined} {column} on:mousedown on:navigate />
  {/if}
{:else}
  <GridCell
    {rowindex}
    {selected}
    {colindex}
    {column}
    on:mousedown
    on:navigate
  />
{/if}
```

## `src/ui/views/Table/components/DataGrid/GridCell/Resizer.svelte`

```svelte
<script lang="ts">
  export let width: number;
  export let onChange: (width: number) => void;
  export let onFinalize: (width: number) => void;
  export let min: number;

  let start: number | null;
  let initial: number | null;
  let rafId: number | null = null;

  function startResize(event: MouseEvent) {
    // Unless we stop propagation, resizing will also drag the column.
    event.stopPropagation();

    start = event.pageX;
    initial = width;
  }

  function stopResize(event: MouseEvent) {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (start && initial) {
      const delta = event.pageX - start;
      const newWidth = initial + delta;

      if (newWidth >= min) {
        onFinalize(width);
      }
    }

    start = null;
    initial = null;
  }

  function resize(event: MouseEvent) {
    if (start && initial) {
      const pageX = event.pageX;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (start !== null && initial !== null) {
          const delta = pageX - start;
          const newWidth = initial + delta;
          if (newWidth >= min) {
            onChange(newWidth);
          }
        }
      });
    }
  }
</script>

<svelte:window on:mouseup={stopResize} on:mousemove={resize} />

<span class="handle" class:visible={start} on:mousedown={startResize} />

<style>
  .handle {
    position: absolute;
    right: -0.1875rem;
    width: 0.375rem;
    min-width: 0.375rem;
    height: 100%;
    border-radius: 0.0625rem;
    z-index: 1;
  }
  .handle:hover {
    background-color: var(--interactive-accent);
    cursor: ew-resize;
  }
  .visible {
    background-color: var(--interactive-accent);
    cursor: ew-resize;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/index.ts`

```ts
export { default as GridCell } from "./GridCell.svelte";
export { default as GridTypedCell } from "./GridTypedCell.svelte";
export { default as TextLabel } from "./GridTextCell/TextLabel.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridBooleanCell/GridBooleanCell.svelte`

```svelte
<script lang="ts">
  import { isBoolean, type Optional } from "src/lib/dataframe/dataframe";
  import { Switch } from "obsidian-svelte";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<boolean>;
  export let onChange: (value: boolean) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
</script>

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <svelte:fragment slot="read">
    {#if isBoolean(value)}
      <Switch
        checked={value}
        on:check={({ detail: checked }) => onChange(checked)}
        disabled={!column.editable}
      />
    {/if}
  </svelte:fragment>
  <Switch
    slot="edit"
    checked={value ?? false}
    on:check={({ detail: checked }) => onChange(checked)}
  />
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridBooleanCell/index.ts`

```ts
export { default as GridBooleanCell } from "./GridBooleanCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridDateCell/GridDateCell.svelte`

```svelte
<script lang="ts">
  // import { DateInput } from "obsidian-svelte";
  import { isDate, type DataValue } from "src/lib/dataframe/dataframe";
  import DateInput from "src/ui/components/DateInput.svelte";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import dayjs from "dayjs";
  import { getContext } from "svelte";
  import { formatDateForDisplay } from "src/lib/helpers";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { Writable } from "svelte/store";

  import { GridCell } from "..";
  import { TextLabel } from "..";
  import type { GridColDef } from "../../dataGrid";

  import { copyToClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<Date>;
  // Raw value for displaying invalid non-date values (e.g., string "2" in a date field)
  export let rawValue: Optional<DataValue> = null;
  let cachedValue: Optional<Date> = value; // store the proposing value
  export let onChange: (value: Optional<Date>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit = false;
  
  // Get project store from context for date formatting (reactive)
  const projectStore = getContext<Writable<ProjectDefinition>>("project");
  
  // Check if we have an invalid raw value (non-date value in a date field)
  $: hasInvalidRawValue = rawValue !== null && rawValue !== undefined;
  
  // Validate date - check if the raw value can be parsed as a valid date
  $: isValidDate = (() => {
    // If we have a raw value that couldn't be parsed as Date, it's invalid
    if (hasInvalidRawValue) return false;
    if (!value) return true; // Empty is valid
    // If it's not a proper Date object or dayjs can't parse it, it's invalid
    const date = dayjs(value);
    return date.isValid();
  })();
  
  // Format date according to project settings (reactive via store subscription)
  $: formattedDate = (() => {
    // If we have invalid raw value, show it as-is
    if (hasInvalidRawValue) return String(rawValue);
    if (!value) return "";
    const date = dayjs(value);
    if (!date.isValid()) {
      return String(value); // Show raw invalid value
    }
    const project = $projectStore;
    if (!project) {
      return date.format('YYYY-MM-DD');
    }
    return formatDateForDisplay(date, project) ?? date.format('YYYY-MM-DD');
  })();
</script>

<GridCell
  {selected}
  {rowindex}
  {colindex}
  {edit}
  error={!isValidDate}
  onEditChange={(mode) => {
    edit = mode;
  }}
  {column}
  on:mousedown
  on:navigate
  onCopy={() => {
    if (value || hasInvalidRawValue) {
      copyToClipboard(formattedDate);
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value || hasInvalidRawValue}
      <TextLabel value={formattedDate} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <DateInput
      value={value ?? null}
      on:change={({ detail }) => (cachedValue = detail)}
      on:blur={() => {
        edit = false;
        if (!cachedValue || !isDate(value)) {
          onChange(cachedValue);
          return;
        }
        const cachedDate = dayjs(cachedValue);
        const newDatetime = dayjs(value)
          .set("year", cachedDate.year())
          .set("month", cachedDate.month())
          .set("date", cachedDate.date());
        onChange(newDatetime.toDate());
      }}
      embed
    />
  </svelte:fragment>
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridDateCell/index.ts`

```ts
export { default as GridDateCell } from "./GridDateCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridDatetimeCell/GridDatetimeCell.svelte`

```svelte
<script lang="ts">
  import DatetimeInput from "src/ui/components/DatetimeInput.svelte";
  // import { DatetimeInput } from "obsidian-svelte";
  import type { Optional, DataValue } from "src/lib/dataframe/dataframe";
  import dayjs from "dayjs";
  import { getContext } from "svelte";
  import { formatDateForDisplay } from "src/lib/helpers";
  import type { ProjectDefinition } from "src/settings/settings";
  import type { Writable } from "svelte/store";

  import { GridCell } from "..";
  import { TextLabel } from "..";
  import type { GridColDef } from "../../dataGrid";

  import { copyToClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<Date>;
  // Raw value for displaying invalid non-date values (e.g., string "2" in a date field)
  export let rawValue: Optional<DataValue> = null;
  let cachedValue: Optional<Date> = value; // store the proposing value
  export let onChange: (value: Optional<Date>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit = false;
  
  // Get project store from context for date formatting (reactive)
  const projectStore = getContext<Writable<ProjectDefinition>>("project");
  
  // Check if we have an invalid raw value (non-date value in a date field)
  $: hasInvalidRawValue = rawValue !== null && rawValue !== undefined;
  
  // Validate date - check if the raw value can be parsed as a valid date
  $: isValidDate = (() => {
    // If we have a raw value that couldn't be parsed as Date, it's invalid
    if (hasInvalidRawValue) return false;
    if (!value) return true; // Empty is valid
    // If it's not a proper Date object or dayjs can't parse it, it's invalid
    const date = dayjs(value);
    return date.isValid();
  })();
  
  // Format datetime according to project settings
  $: formattedDatetime = (() => {
    // If we have invalid raw value, show it as-is
    if (hasInvalidRawValue) return String(rawValue);
    if (!value) return "";
    const date = dayjs(value);
    if (!date.isValid()) {
      return String(value);
    }
    const project = $projectStore;
    const dateFormatted = project 
      ? (formatDateForDisplay(date, project) ?? date.format('YYYY-MM-DD'))
      : date.format('YYYY-MM-DD');
    const timeFormatted = date.format('HH:mm');
    return `${dateFormatted} ${timeFormatted}`;
  })();
</script>

<GridCell
  {selected}
  {rowindex}
  {colindex}
  {edit}
  error={!isValidDate}
  onEditChange={(mode) => {
    edit = mode;
  }}
  {column}
  on:mousedown
  on:navigate
  onCopy={() => {
    if (value || hasInvalidRawValue) {
      copyToClipboard(formattedDatetime);
    }
  }}
>
  <svelte:fragment slot="read">
    {#if value || hasInvalidRawValue}
      <TextLabel value={formattedDatetime} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <DatetimeInput
      value={value ?? null}
      on:input={({ detail }) => (cachedValue = detail)}
      on:blur={() => {
        edit = false;
        onChange(cachedValue);
      }}
      embed
    />
  </svelte:fragment>
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridDatetimeCell/index.ts`

```ts
export { default as GridDatetimeCell } from "./GridDatetimeCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/GridFileCell.svelte`

```svelte
<script lang="ts">
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import { TextInput } from "obsidian-svelte";
  import { app } from "src/lib/stores/obsidian";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import { getContext } from "svelte";
  import { copyToClipboard, readFromClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<string>;
  export let onChange: (value: Optional<string>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  const sourcePath = getContext<string>("sourcePath") ?? "";

  let edit = false;
  let isDragOver = false;

  interface WikiLink { target: string; display: string; raw: string; }

  function parseWikiLinks(str: string): WikiLink[] {
    const re = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
    const out: WikiLink[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
      out.push({ target: m[1]!.trim(), display: (m[2] ?? m[1]!).trim(), raw: m[0]! });
    }
    return out;
  }

  $: chips = parseWikiLinks(value ?? "");

  function openLink(target: string) {
    $app.workspace.openLinkText(target, sourcePath, false);
  }

  function removeLink(raw: string) {
    const next = (value ?? "").replace(raw, "").replace(/\s{2,}/g, " ").trim() || null;
    onChange(next);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "link";
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    const text = e.dataTransfer?.getData("text/plain") ?? "";
    if (!text.trim()) return;
    // Strip .md extension and wrap as wiki-link
    const target = text.trim().replace(/\.md$/, "");
    const link = `[[${target}]]`;
    const next = value ? `${value} ${link}` : link;
    onChange(next);
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  {rowindex}
  {colindex}
  on:mousedown
  on:navigate
  onCopy={() => copyToClipboard(value ?? "")}
  onCut={() => { copyToClipboard(value ?? ""); onChange(null); }}
  onPaste={async () => { onChange(await readFromClipboard()); }}
>
  <svelte:fragment slot="read">
    <div
      class="ppp-file-chips"
      class:ppp-file-chips--dragover={isDragOver}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
    >
      {#if chips.length > 0}
        {#each chips as chip}
          <span class="ppp-file-chip">
            <span
              class="ppp-file-chip__label"
              role="button"
              tabindex="-1"
              on:click|stopPropagation={() => openLink(chip.target)}
              on:keydown={(e) => { if (e.key === "Enter") { e.stopPropagation(); openLink(chip.target); } }}
            >{chip.display}</span>
            <button
              class="ppp-file-chip__remove"
              tabindex="-1"
              aria-label="Remove link"
              on:click|stopPropagation={() => removeLink(chip.raw)}
            >×</button>
          </span>
        {/each}
      {:else}
        <span class="ppp-file-chips__empty">{value ?? ""}</span>
      {/if}
    </div>
  </svelte:fragment>
  <svelte:fragment slot="edit">
    <TextInput
      autoFocus
      value={value || ""}
      embed
      width="100%"
      on:input={({ detail }) => (value = detail)}
      on:blur={(event) => {
        if (
          event.currentTarget instanceof HTMLInputElement &&
          event.relatedTarget instanceof HTMLDivElement &&
          !event.relatedTarget.contains(event.currentTarget)
        ) {
          selected = false;
          edit = false;
        }
        onChange(value);
      }}
    />
  </svelte:fragment>
</GridCell>

<style>
  .ppp-file-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.25rem 0.375rem;
    width: 100%;
    align-items: center;
  }

  .ppp-file-chip {
    display: inline-flex;
    align-items: center;
    background: var(--background-modifier-hover);
    border: 0.0625rem solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
    max-width: 10rem;
    overflow: hidden;
    flex-shrink: 0;
  }

  .ppp-file-chip__label {
    padding: 0.125rem 0.25rem;
    cursor: pointer;
    color: var(--link-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    user-select: none;
  }

  .ppp-file-chip__label:hover {
    text-decoration: underline;
  }

  .ppp-file-chip__remove {
    padding: 0 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.4;
    flex-shrink: 0;
  }

  .ppp-file-chip__remove:hover {
    color: var(--text-error);
  }

  .ppp-file-chips__empty {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ppp-file-chips--dragover {
    outline: 0.125rem dashed var(--interactive-accent);
    outline-offset: -0.0625rem;
    background: rgba(var(--interactive-accent-rgb, 122, 104, 238), 0.06);
    border-radius: var(--radius-s, 0.25rem);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridFileCell/index.ts`

```ts
export { default as GridFileCell } from "./GridFileCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridListCell/GridListCell.svelte`

```svelte
<script lang="ts">
  import { TagList } from "src/ui/components/TagList";
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<Optional<DataValue>[]>;
  export let onChange: (values: Optional<DataValue>[]) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
</script>

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <TagList
    slot="read"
    edit={false}
    values={value || []}
    richText={column.typeConfig?.richText ?? false}
  />
  <TagList slot="edit" edit={true} values={value || []} {onChange} />
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridListCell/index.ts`

```ts
export { default as GridListCell } from "./GridListCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridNumberCell/GridNumberCell.svelte`

```svelte
<script lang="ts">
  import GridCell from "../GridCell.svelte";
  import NumberLabel from "./NumberLabel.svelte";
  import NumberInput from "./NumberInput.svelte";
  import { isNumber, type Optional } from "src/lib/dataframe/dataframe";
  import type { GridColDef } from "../../dataGrid";

  import { copyToClipboard, readFromClipboard } from "src/lib/helpers/clipboard";
  import { parseCellInput } from "src/lib/database/cellEditor";
  import { Notice } from "obsidian";
  import { i18n } from "src/lib/stores/i18n";

  export let value: Optional<number>;
  export let onChange: (value: Optional<number>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit: boolean = false;

  // R2.1c — route paste through cellEditor.parseCellInput so pasting
  // garbage text no longer silently writes `NaN` to frontmatter.
  // Empty / whitespace clears the cell, parity with Visualizer.
  async function handlePaste() {
    const text = await readFromClipboard();
    const result = parseCellInput(text, "number");
    if (!result.ok) {
      new Notice($i18n.t(result.error.i18nKey));
      return;
    }
    onChange(result.value as Optional<number>);
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  on:mousedown
  on:navigate
  {rowindex}
  {colindex}
  onCopy={() => {
    copyToClipboard(value?.toString() || "");
  }}
  onCut={() => {
    copyToClipboard(value?.toString() || "");
    onChange(null);
  }}
  onPaste={handlePaste}
>
  <svelte:fragment slot="read">
    {#if isNumber(value)}
      <NumberLabel {value} />
    {/if}
  </svelte:fragment>
  <NumberInput
    slot="edit"
    on:blur={(event) => {
      if (
        event.currentTarget instanceof HTMLInputElement &&
        event.relatedTarget instanceof HTMLDivElement &&
        !event.relatedTarget.contains(event.currentTarget)
      ) {
        selected = false;
        edit = false;
      }
    }}
    value={value ?? 0}
    onChange={(value) => {
      onChange(value);
    }}
  />
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridNumberCell/NumberInput.svelte`

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  export let value: number;
  export let onChange: (value: number) => void;

  let ref: HTMLInputElement;

  function handleInput(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      value = event.currentTarget.valueAsNumber;
      onChange(value);
    }
  }

  function handleKeyup(event: Event) {
    if (event.currentTarget instanceof HTMLInputElement) {
      value = event.currentTarget.valueAsNumber;
    }
  }

  onMount(() => {
    ref.focus();
  });
</script>

<input
  tabindex={-1}
  type="number"
  bind:this={ref}
  {value}
  on:change={handleInput}
  on:keypress={handleKeyup}
  on:blur
/>

<style>
  input {
    all: unset;
    background-color: var(--background-primary);
    box-sizing: border-box;
    width: 100%;
    padding: 0.375rem;
    font-weight: 400;
    font-family: var(--font-default);
    color: var(--text-normal);
    text-align: right;
  }

  input:focus {
    box-shadow: none !important;
  }

  input:hover {
    background-color: transparent;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridNumberCell/NumberLabel.svelte`

```svelte
<script lang="ts">
  export let value: number;
</script>

<div>
  {new Intl.NumberFormat().format(value)}
</div>

<style>
  div {
    width: 100%;
    padding: 0.375rem;
    text-align: right;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridNumberCell/index.ts`

```ts
export { default as GridNumberCell } from "./GridNumberCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/GridRelationCell.svelte`

```svelte
<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import RelationListView from "src/ui/views/YamlVisualizer/RelationListView.svelte";
  import RelationPopover from "src/ui/components/RelationPicker/RelationPicker.svelte";
  import { parseRelationLinks } from "src/lib/relations/parseRelationLinks";
  import { getContext } from "svelte";
  import type { Readable } from "svelte/store";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;
  /** When provided, cell becomes editable and opens inline popover on click. */
  export let onChange: ((value: string[]) => void) | undefined = undefined;
  /**
   * Optional resolved label per link body. When present (Stage A enrichment
   * surfaced `__resolved__<field>` and the consumer extracted the
   * `displayField` value into a string map), labels override the raw link
   * body for visible text. Click target stays the link body so navigation
   * uses the canonical wiki-link path.
   *
   * Anchored in: docs/IMPLEMENTATION_BLUEPRINT.md §A.5b.
   */
  export let resolvedLabels: ReadonlyMap<string, string> | undefined = undefined;

  // NPLAN-S4.1: relation options provided via Svelte context from DataTableWidget
  const relationOptionsStore = getContext<Readable<Map<string, string[]>> | undefined>("ppp-relationOptions");

  $: options = ($relationOptionsStore ?? new Map<string, string[]>()).get(column.field) ?? [];

  // #045.3 — Route through the shared canonical parser so DataTable cells,
  // DataList rows, and SubBaseCanvas rows derive identical link lists.
  $: links = parseRelationLinks(value);
  $: items = links.map<string | { label: string; link: string }>((link) => {
    const label = resolvedLabels?.get(link);
    return label ? { label, link } : link;
  });

  let popoverOpen = false;

  function handleCellClick(e: MouseEvent) {
    if (onChange && e.button === 0) {
      e.stopPropagation();
      popoverOpen = !popoverOpen;
    }
  }

  function handleAdd(name: string) {
    if (!onChange) return;
    const bare = name.replace(/^\[\[(.+?)(?:\|.+?)?\]\]$/, "$1");
    if (!links.includes(bare)) {
      onChange([...links, bare].map((l) => `[[${l}]]`));
    }
  }

  function handleRemove(name: string) {
    if (!onChange) return;
    onChange(links.filter((l) => l !== name).map((l) => `[[${l}]]`));
  }

  // (parseLinks removed — replaced by canonical parseRelationLinks from
  //  src/lib/relations/parseRelationLinks.ts. The new helper handles
  //  `[[link|alias]]` aliases correctly, which the legacy implementation
  //  did not.)
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="ppp-relation-cell-wrap">
  <GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
    <span slot="read" class="ppp-relation-cell" on:click={handleCellClick}>
      <RelationListView {items} maxVisible={3} />
      {#if onChange && links.length === 0}
        <span class="ppp-relation-placeholder">Select…</span>
      {/if}
    </span>
  </GridCell>

  {#if popoverOpen && onChange}
    <RelationPopover
      {options}
      selected={links}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onClose={() => (popoverOpen = false)}
    />
  {/if}
</div>

<style>
  .ppp-relation-cell-wrap {
    position: relative;
    display: contents;
  }

  .ppp-relation-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: center;
    padding: 0 0.25rem;
    cursor: pointer;
    width: 100%;
    min-height: 1.5rem;
  }

  .ppp-relation-placeholder {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    font-style: italic;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridRelationCell/index.ts`

```ts
export { default as GridRelationCell } from "./GridRelationCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridRollupCell/GridRollupCell.svelte`

```svelte
<script lang="ts">
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import { GridCell } from "..";
  import { toNumber } from "src/lib/engine/numeric";
  import type { GridColDef } from "../../dataGrid";

  export let value: Optional<DataValue>;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  $: fn = column.typeConfig?.rollup?.function ?? "";
  $: isPercentFn = fn.startsWith("percent_") || fn === "percent_true";
  $: isListFn = fn === "show_original" || fn === "show_unique" || fn === "concat" || fn === "concat_unique";

  $: percentValue = isPercentFn ? parsePercent(value) : null;
  $: chips = isListFn ? splitChips(value) : null;
  $: plainText = !isPercentFn && !isListFn ? formatPlain(value) : "";

  function parsePercent(val: Optional<DataValue>): number {
    if (val == null) return 0;
    // Same contract as RollupCellRenderer's parsePercent (#180a).
    const n = toNumber(String(val).replace("%", ""));
    return n === null ? 0 : Math.min(100, Math.max(0, n));
  }

  function splitChips(val: Optional<DataValue>): string[] {
    if (val == null || val === "") return [];
    return String(val).split(",").map((s) => s.trim()).filter(Boolean);
  }

  function formatPlain(val: Optional<DataValue>): string {
    if (val == null) return "—";
    if (Array.isArray(val)) return val.map(String).join(", ");
    if (typeof val === "number") {
      return Number.isInteger(val) ? val.toString() : val.toFixed(2);
    }
    return String(val);
  }
</script>

<GridCell {selected} {rowindex} {colindex} {column} on:mousedown on:navigate>
  <span slot="read" class="ppp-rollup-cell">
    {#if isPercentFn && percentValue !== null}
      <span class="ppp-rollup-bar-wrap" title="{percentValue}%">
        <span class="ppp-rollup-bar" style="width: {percentValue}%"></span>
        <span class="ppp-rollup-bar-label">{Math.round(percentValue)}%</span>
      </span>
    {:else if chips !== null}
      {#if chips.length === 0}
        <span class="ppp-rollup-empty">—</span>
      {:else}
        <span class="ppp-rollup-chips">
          {#each chips as chip}
            <span class="ppp-rollup-chip">{chip}</span>
          {/each}
        </span>
      {/if}
    {:else}
      {plainText}
    {/if}
  </span>
</GridCell>

<style>
  .ppp-rollup-cell {
    display: flex;
    align-items: center;
    padding: 0 0.25rem;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    width: 100%;
  }

  .ppp-rollup-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
  }

  .ppp-rollup-bar {
    display: block;
    height: 0.375rem;
    border-radius: 0.1875rem;
    background: var(--interactive-accent);
    opacity: 0.7;
    min-width: 0.125rem;
    flex-shrink: 0;
    transition: width 150ms ease;
  }

  .ppp-rollup-bar-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .ppp-rollup-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1875rem;
    align-items: center;
  }

  .ppp-rollup-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.75rem;
    background: var(--background-modifier-hover);
    font-size: var(--font-ui-smaller);
    color: var(--text-normal);
    white-space: nowrap;
  }

  .ppp-rollup-empty {
    color: var(--text-faint);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridRollupCell/index.ts`

```ts
export { default as GridRollupCell } from "./GridRollupCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridSelectCell/GridSelectCell.svelte`

```svelte
<script lang="ts">
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";
  import type { Optional } from "src/lib/dataframe/dataframe";
  import {
    getOptionColor,
    isSelectConfig,
    isStatusConfig,
    type ExtendedFieldTypeConfig,
    type SelectOption,
  } from "src/ui/views/Dashboard/fieldTypes";

  import { copyToClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<string>;
  export let onChange: (value: Optional<string>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit: boolean = false;

  $: extConfig = column.typeConfig as unknown as ExtendedFieldTypeConfig | undefined;
  $: options = getOptions(extConfig);
  $: color = value && extConfig ? getOptionColor(extConfig, value) : null;

  function getOptions(cfg: ExtendedFieldTypeConfig | undefined): SelectOption[] {
    if (!cfg) return [];
    if (isSelectConfig(cfg)) return cfg.options;
    if (isStatusConfig(cfg)) return cfg.groups.map((g) => ({ name: g.name, color: g.color }));
    return [];
  }
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  {rowindex}
  {colindex}
  on:mousedown
  on:navigate
  onCopy={() => {
    copyToClipboard(value?.toString() || "");
  }}
>
  <span
    slot="read"
    class="ppp-select-badge"
    class:ppp-select-badge--empty={!value}
    style:--badge-color={color || "var(--text-muted)"}
  >
    {#if color}
      <span class="ppp-select-dot" style:background-color={color}></span>
    {/if}
    {value || ""}
  </span>

  <svelte:fragment slot="edit">
    <select
      class="ppp-select-dropdown"
      value={value || ""}
      on:change={(e) => {
        const target = e.currentTarget;
        if (target instanceof HTMLSelectElement) {
          onChange(target.value || null);
          edit = false;
        }
      }}
      on:blur={() => { edit = false; }}
    >
      <option value="">—</option>
      {#each options as opt}
        <option value={opt.name}>
          {opt.name}
        </option>
      {/each}
    </select>
  </svelte:fragment>
</GridCell>

<style>
  .ppp-select-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-s, 0.25rem);
    font-size: var(--font-ui-small);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .ppp-select-badge--empty {
    color: var(--text-faint);
  }

  .ppp-select-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .ppp-select-dropdown {
    width: 100%;
    padding: 0.25rem;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridSelectCell/index.ts`

```ts
export { default as GridSelectCell } from "./GridSelectCell.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridTextCell/GridTextCell.svelte`

```svelte
<script lang="ts">
  import { GridCell } from "..";
  import type { GridColDef } from "../../dataGrid";

  import { Autocomplete, TextInput } from "obsidian-svelte";
  import TextLabel from "./TextLabel.svelte";
  import type { Optional } from "src/lib/dataframe/dataframe";

  import { copyToClipboard, readFromClipboard } from "src/lib/helpers/clipboard";

  export let value: Optional<string>;
  export let onChange: (value: Optional<string>) => void;
  export let column: GridColDef;
  export let rowindex: number;
  export let colindex: number;
  export let selected: boolean;

  let edit: boolean = false;

  $: options =
    column.typeConfig?.options?.map((option) => ({
      label: option,
      description: "",
    })) ?? [];
</script>

<GridCell
  bind:edit
  bind:selected
  {column}
  {rowindex}
  {colindex}
  on:mousedown
  on:navigate
  onCopy={() => {
    copyToClipboard(value?.toString() || "");
  }}
  onCut={() => {
    copyToClipboard(value?.toString() || "");
    onChange(null);
  }}
  onPaste={async () => {
    onChange(await readFromClipboard());
  }}
>
  <TextLabel
    slot="read"
    richText={column.typeConfig?.richText ?? false}
    value={value || ""}
  />
  <svelte:fragment slot="edit">
    {#if options.length > 0}
      <Autocomplete
        value={value || ""}
        {options}
        embed
        autoFocus
        on:change={({ detail }) => (value = detail)}
        on:blur={({ detail: event }) => {
          if (
            event.currentTarget instanceof HTMLInputElement &&
            event.relatedTarget instanceof HTMLDivElement &&
            !event.relatedTarget.contains(event.currentTarget)
          ) {
            selected = false;
            edit = false;
          }

          onChange(value);
        }}
      />
    {:else}
      <TextInput
        autoFocus
        value={value || ""}
        embed
        width="100%"
        on:input={({ detail }) => (value = detail)}
        on:blur={(event) => {
          if (
            event.currentTarget instanceof HTMLInputElement &&
            event.relatedTarget instanceof HTMLDivElement &&
            !event.relatedTarget.contains(event.currentTarget)
          ) {
            selected = false;
            edit = false;
          }

          onChange(value);
        }}
      />
    {/if}
  </svelte:fragment>
</GridCell>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridTextCell/TextLabel.svelte`

```svelte
<script lang="ts">
  import { MarkdownRenderer } from "obsidian";
  import { app, view } from "src/lib/stores/obsidian";
  import { handleHoverLink } from "src/ui/views/helpers";
  import { getContext } from "svelte";
  import { detectLinkable } from "src/lib/helpers/linkable";

  export let value: string;
  export let richText: boolean = false;

  const sourcePath = getContext<string>("sourcePath") ?? "";

  $: linkable = !richText ? detectLinkable(value) : null;

  function useMarkdown(node: HTMLElement, value: string) {
    MarkdownRenderer.render($app, value, node, sourcePath, $view);

    return {
      update(newValue: string) {
        node.empty();
        MarkdownRenderer.render($app, newValue, node, sourcePath, $view);
      },
    };
  }

  function handleClick(event: MouseEvent) {
    const targetEl = event.target as HTMLElement;
    const closestAnchor =
      targetEl.tagName === "A" ? targetEl : targetEl.closest("a");

    if (!closestAnchor) {
      return;
    }

    event.stopPropagation();

    if (closestAnchor.hasClass("internal-link")) {
      event.preventDefault();

      const href = closestAnchor.getAttr("href");
      const newLeaf = false;

      if (href) {
        $app.workspace.openLinkText(href, sourcePath, newLeaf);
      }
    }
  }
</script>

{#if richText}
  <div
    use:useMarkdown={value}
    on:click={handleClick}
    on:mouseover={(event) => {
      handleHoverLink(event, sourcePath);
    }}
    on:focus
    on:keypress
  />
{:else if linkable}
  <div>
    <a
      class="ppp-linkable"
      href={linkable.href}
      target={linkable.kind === "url" ? "_blank" : undefined}
      rel={linkable.kind === "url" ? "noopener noreferrer" : undefined}
      on:click|stopPropagation
      on:mousedown|stopPropagation
    >
      {value}
    </a>
  </div>
{:else}
  <div>
    {value}
  </div>
{/if}

<style>
  div {
    padding: 0.375rem;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  div :global(p:first-child) {
    margin-top: 0;
  }

  div :global(p:last-child) {
    margin-bottom: 0;
  }

  .ppp-linkable {
    color: var(--link-color);
    text-decoration: none;
  }
  .ppp-linkable:hover {
    text-decoration: underline;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridCell/GridTextCell/index.ts`

```ts
export { default as GridTextCell } from "./GridTextCell.svelte";
export { default as TextLabel } from "./TextLabel.svelte";
```

## `src/ui/views/Table/components/DataGrid/GridHeader/GridColumnHeader.svelte`

```svelte
<script lang="ts">
  import { Icon, IconButton } from "obsidian-svelte";
  import { i18n } from "src/lib/stores/i18n";
  import { fieldIcon, fieldDisplayText } from "src/ui/views/helpers";
  import type { GridColDef } from "../dataGrid";
  import { TextLabel } from "../GridCell";

  type GridColDefWithId = GridColDef & { readonly id: string };

  export let column: GridColDefWithId;
  export let colindex: number;
  export let onColumnMenu: (column: GridColDef, event: MouseEvent) => void;
  /** When provided, double-clicking the header enters inline rename mode. */
  export let onColumnRename: ((field: string, newName: string) => void) | undefined = undefined;

  // Inline rename state
  let editing = false;
  let editName = "";
  let inputEl: HTMLInputElement | undefined;

  function startEdit() {
    if (!onColumnRename) return;
    editName = column.field;
    editing = true;
    setTimeout(() => { inputEl?.select(); }, 0);
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const trimmed = editName.trim();
    if (trimmed && trimmed !== column.field) {
      onColumnRename?.(column.field, trimmed);
    }
  }

  function cancelEdit() {
    editing = false;
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
  }

  function handleFieldClick(column: GridColDef): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      onColumnMenu(column, event);
    };
  }

  // Optional sort info if provided by upstream column
  $: sortInfo = (column as unknown as any)?.sort;
</script>

<div
  role="columnheader"
  aria-colindex={colindex}
  tabindex={onColumnRename ? 0 : -1}
  style:width={`${column.width}px`}
  class:pinned={column.pinned}
  on:dblclick={startEdit}
>
  {#if editing}
    <input
      bind:this={inputEl}
      class="ppp-col-rename-input"
      type="text"
      bind:value={editName}
      on:blur={commitEdit}
      on:keydown={handleInputKeydown}
    />
  {:else}
    <div class="left">
      <Icon name={fieldIcon(column)} tooltip={fieldDisplayText(column)} />
      <TextLabel value={column.field} />
    </div>

    <div class="right">
      {#if sortInfo}
        <Icon
          name={sortInfo?.direction === "desc" ? "arrow-down" : "arrow-up"}
          tooltip={sortInfo?.direction === "desc" ? $i18n.t('components.data-grid.sort.desc') : $i18n.t('components.data-grid.sort.asc')}
        />
      {/if}

      <IconButton
        size="sm"
        icon="vertical-three-dots"
        onClick={handleFieldClick(column)}
      />
    </div>
  {/if}
</div>

<style>
  div {
    position: sticky;

    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: center;

    background-color: var(--background-primary-alt);
    border-right: var(--ppp-border-width) solid var(--background-modifier-border);
    border-left-color: var(--background-modifier-border);
    border-bottom: var(--ppp-border-width) solid var(--background-modifier-border);

    width: 100%;
    height: var(--ppp-table-header-height);
    min-height: var(--ppp-table-header-height);
    max-height: var(--ppp-table-header-height);

    font-weight: var(--ppp-weight-medium);
    padding: 0 var(--ppp-padding-tight);

    cursor: default;
  }
  
  /* Touch devices - увеличиваем touch targets */
  @media (pointer: coarse) {
    div {
      height: var(--ppp-touch-min);
      min-height: var(--ppp-touch-min);
      max-height: var(--ppp-touch-min);
      padding: 0 var(--ppp-padding-normal);
    }
  }

  .left {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .right {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  div.pinned {
    border-right: 1px solid var(--background-modifier-border-focus);
  }

  .ppp-col-rename-input {
    width: 100%;
    height: 1.5rem;
    padding: 0 0.375rem;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: var(--ppp-weight-medium, 500);
    outline: none;
    box-sizing: border-box;
  }
</style>
```

## `src/ui/views/Table/components/DataGrid/GridHeader/GridHeader.svelte`

```svelte
<script lang="ts">
  import { GridCell } from "../GridCell";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import type { GridColDef } from "../dataGrid";
  import Resizer from "../GridCell/Resizer.svelte";
  import GridColumnHeader from "./GridColumnHeader.svelte";

  type GridColDefWithId = GridColDef & { readonly id: string };

  export let columns: GridColDefWithId[];
  export let onResize: (name: string, width: number) => void;
  export let onFinalizeResize: (name: string, width: number) => void;
  export let onColumnMenu: (column: GridColDef, event: MouseEvent) => void;
  export let onColumnOrder: (columns: GridColDefWithId[]) => void;
  /** When provided, shows an inline "+" button at the end of headers. */
  export let onAddColumn: (() => void) | undefined = undefined;
  /** When provided, double-clicking a header enters inline rename mode. */
  export let onColumnRename: ((field: string, newName: string) => void) | undefined = undefined;

  const flipDurationMs = 150;

  function handleDndConsider(e: CustomEvent<DndEvent<GridColDefWithId>>) {
    columns = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<GridColDefWithId>>) {
    columns = e.detail.items;
    onColumnOrder(columns);
  }
</script>

<div class="flex container">
  <GridCell
    colindex={1}
    rowindex={1}
    column={{ field: "", width: 60, header: true, editable: false }}
    columnHeader
    rowHeader
  />
  <div
    class="flex"
    use:dndzone={{
      items: columns,
      flipDurationMs,
      morphDisabled: true,
      dropTargetStyle: {
        outline: "none",
        background: "hsla(var(--interactive-accent-hsl), 0.3)",
      },
    }}
    on:consider={handleDndConsider}
    on:finalize={handleDndFinalize}
  >
    {#each columns as column, columnIdx (column.id)}
      <div
        class={`flex relative`}
        animate:flip={{ duration: flipDurationMs }}
        class:pinned={column.pinned}
      >
        <GridColumnHeader {column} {onColumnMenu} {onColumnRename} colindex={columnIdx} />
        <Resizer
          width={column.width ?? 180}
          min={100}
          onChange={(width) => {
            onResize(column.field, width);
          }}
          onFinalize={(width) => {
            onFinalizeResize(column.field, width);
          }}
        />
      </div>
    {/each}
  </div>
  {#if onAddColumn}
    <button
      class="ppp-add-column-btn clickable-icon"
      type="button"
      on:click={onAddColumn}
      aria-label="Add column"
      title="Add column"
    >+</button>
  {/if}
</div>

<style>
  div.container {
    position: sticky;
    top: 0;
    z-index: 6;
  }

  div.flex {
    display: flex;
  }

  div.relative {
    position: relative;
  }

  div.pinned {
    left: var(--ppp-row-header-width, 3.75rem);
    z-index: 7;
    position: sticky;
  }

  .ppp-add-column-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 100%;
    min-height: 1.75rem;
    border: none;
    background: transparent;
    color: var(--text-faint);
    font-size: 1rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease, background 120ms ease;
    flex-shrink: 0;
    border-left: 0.0625rem solid var(--background-modifier-border);
    border-radius: 0;
  }

  div.container:hover .ppp-add-column-btn,
  .ppp-add-column-btn:focus-visible {
    opacity: 1;
  }

  .ppp-add-column-btn:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }
</style>
```

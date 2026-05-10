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
  {#each rows as { rowId, row, cellStyles }, i (rowId)}
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

        if (wrapPrev) {
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

<script lang="ts">
  import { produce } from "immer";
  import { Menu } from "obsidian";

  import { GridCell, GridTypedCell } from "./GridCell";
  import type { DataValue, Optional } from "src/lib/dataframe/dataframe";
  import GridCellGroup from "./GridCellGroup.svelte";

  import type { GridColDef, GridRowId, GridRowModel } from "./dataGrid";
  import { menuOnContextMenu, showMobileNavMenu } from "src/ui/views/helpers";
  import { app } from "src/lib/stores/obsidian";
  import { isTouchDevice } from "src/lib/stores/ui";

  import { setContext, onDestroy } from "svelte";

  export let rowId: GridRowId;
  export let index: number;
  export let row: GridRowModel;
  export let columns: GridColDef[];
  export let activeCell: [number, number];
  export let color: string | null;

  setContext<string>("sourcePath", row["path"]);

  export let onRowChange: (rowId: GridRowId, row: GridRowModel) => void;
  export let onRowMenu: (rowId: GridRowId, row: GridRowModel) => Menu;
  // v3.0.8: Row open handler with modifier-based navigation
  export let onRowOpen: (rowId: GridRowId, openMode: false | 'tab' | 'window') => void;
  export let onCellMenu: (
    rowId: GridRowId,
    column: GridColDef,
    value: Optional<DataValue>
  ) => Menu;

  function handleHeaderClick(): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      if (event.button === 2) {
        menuOnContextMenu(event, onRowMenu(rowId, row));
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
        menuOnContextMenu(event, onCellMenu(rowId, column, value));
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

<GridCellGroup {index}>
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
    <div slot="read" style="text-align: center;">
      {(index - 1).toString()}
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

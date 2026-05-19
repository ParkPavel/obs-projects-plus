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

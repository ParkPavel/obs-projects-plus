<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import GridRow from "./GridRow.svelte";
  import type { GridColDef, GridRowId, GridRowModel, GridRowProps } from "./dataGrid";
  
  export let columns: GridColDef[];
  export let rows: GridRowProps[];
  export let colorModel: (rowId: string) => string | null;
  export let readonly: boolean;
  export let activeCell: [number, number];
  
  // Row management handlers
  export let onRowChange: (rowId: GridRowId, row: GridRowModel) => void;
  export let onRowDelete: (rowId: GridRowId) => void;
  export let onRowEdit: (rowId: GridRowId, row: GridRowModel) => void;
  export let onRowMenu: (rowId: GridRowId, row: GridRowModel) => any;
  export let onCellMenu: (rowId: GridRowId, column: GridColDef) => any;
  export let onNavigate: (navinfo: [number, number, boolean]) => void;

  // Virtual scrolling configuration
  export let rowHeight: number = 40; // Standard row height in pixels
  export let bufferSize: number = 5; // Number of rows to render above/below viewport
  export let containerHeight: number = 600; // Container height for scrolling
  
  let scrollElement: HTMLElement;
  let startIndex = 0;
  let endIndex = 0;
  let totalHeight = 0;
  let scrollTop = 0;
  
  // Performance monitoring
  let renderTime = 0;
  let lastRenderTime = 0;
  
  /**
   * VirtualGrid - handles efficient rendering of large datasets
   * Only renders visible rows plus buffer to maintain performance
   */
  export class VirtualGrid {
    /**
     * Calculates the range of rows to render based on scroll position
     */
    static calculateVisibleRange(
      scrollTop: number,
      containerHeight: number,
      rowHeight: number,
      bufferSize: number,
      totalRows: number
    ): { startIndex: number; endIndex: number; totalHeight: number } {
      const startRow = Math.floor(scrollTop / rowHeight);
      const endRow = Math.min(
        startRow + Math.ceil(containerHeight / rowHeight) + bufferSize,
        totalRows
      );
      
      const adjustedStartRow = Math.max(0, startRow - bufferSize);
      
      return {
        startIndex: adjustedStartRow,
        endIndex: endRow,
        totalHeight: totalRows * rowHeight
      };
    }
    
    /**
     * Handles scroll events and updates visible range
     */
    static handleScroll(event: Event) {
      const target = event.target as HTMLElement;
      const newScrollTop = target.scrollTop;
      
      return newScrollTop;
    }
  }
  
  // Reactive statements for virtual scrolling
  $: {
    if (rows && rows.length > 0) {
      const visibleRange = VirtualGrid.calculateVisibleRange(
        scrollTop,
        containerHeight,
        rowHeight,
        bufferSize,
        rows.length
      );
      
      startIndex = visibleRange.startIndex;
      endIndex = visibleRange.endIndex;
      totalHeight = visibleRange.totalHeight;
    }
  }
  
  // Handle scroll events
  function handleScroll(event: Event) {
    const newScrollTop = VirtualGrid.handleScroll(event);
    if (newScrollTop !== scrollTop) {
      scrollTop = newScrollTop;
    }
  }
  
  // Performance optimization: memoize visible rows
  $: visibleRows = rows.slice(startIndex, endIndex);
  $: visibleRowProps = visibleRows.map((row, index) => ({
    ...row,
    virtualIndex: startIndex + index
  }));
  
  onMount(() => {
    // Initialize scroll position
    if (scrollElement) {
      scrollTop = scrollElement.scrollTop;
    }
    
    // Performance monitoring
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          renderTime = entry.duration;
          lastRenderTime = Date.now();
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['measure'] });
    } catch (e) {
      // Performance observer not supported, continue without monitoring
    }
  });
  
  onDestroy(() => {
    // Cleanup performance observer
  });
</script>

<div 
  class="virtual-grid-container"
  style={`height: ${containerHeight}px;`}
>
  <div 
    class="virtual-grid-scroll"
    bind:this={scrollElement}
    on:scroll={handleScroll}
    role="grid"
    aria-colcount={columns.length + 1}
    aria-rowcount={rows.length + 2}
  >
    <!-- Spacer for total height -->
    <div style={`height: ${totalHeight}px;`} class="height-spacer"></div>
    
    <!-- Visible rows only -->
    <div 
      class="visible-rows"
      style={`transform: translateY(${startIndex * rowHeight}px);`}
    >
      {#each visibleRowProps as { rowId, row, virtualIndex }, i (rowId)}
        <GridRow
          columns={columns}
          index={virtualIndex + 2}
          {rowId}
          {row}
          {activeCell}
          {onRowChange}
          color={colorModel(rowId)}
          onRowMenu={(rowId, row) => onRowMenu(rowId, row)}
          onCellMenu={(rowId, column) => onCellMenu(rowId, column)}
          on:navigate={({ detail: navinfo }) => {
            const colOffset = 1;
            const rowOffset = 3;
            
            const minColIdx = 1 + colOffset;
            const maxColIdx = columns.length + colOffset;
            
            const minRowIdx = 1 + rowOffset;
            const maxRowIdx = rows.length + rowOffset;
            
            const [colIdx, rowIdx, wrap] = navinfo;
            
            const wrapPrev =
              wrap && colIdx < minColIdx && !(rowIdx - 1 < minRowIdx);
            const wrapNext =
              wrap && colIdx > maxColIdx && !(rowIdx + 1 > maxRowIdx);
            
            if (wrapPrev) {
              // Handle navigation logic
              onNavigate([maxColIdx, rowIdx - 1, wrap]);
            } else if (wrapNext) {
              onNavigate([minColIdx, rowIdx + 1, wrap]);
            } else {
              onNavigate([
                Math.min(Math.max(colIdx, minColIdx), maxColIdx),
                Math.min(Math.max(rowIdx, minRowIdx), maxRowIdx),
                wrap
              ]);
            }
          }}
        />
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-grid-container {
    position: relative;
    overflow: hidden;
  }
  
  .virtual-grid-scroll {
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }
  
  .height-spacer {
    /* Creates the scrollable area */
  }
  
  .visible-rows {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  }
</style>
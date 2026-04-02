<script lang="ts">
  /**
   * MultiDayEventStrip - Horizontal strip for multi-day events in day header
   * Per ROADMAP_V3.0.0 §2.8 - Многодневные события в шапке
   * 
   * Each day renders its own segment of the multi-day event strip.
   * The strip spans across multiple day columns in the header area.
   * 
   * v8.0: Unified height system - STRIP_HEIGHT + STRIP_GAP must match TimelineView/HeaderStripsSection
   */
  
  import type { TimelineDragManager } from '../../dnd/TimelineDragManager';
  import type { ProcessedRecord } from '../../types';
  import type { DragMode } from '../../dnd/types';

  export let title: string;
  export let color: string = 'var(--text-accent)';
  export let rowIndex: number = 0;       // Vertical position in header (for stacking)
  export let isFirstDay: boolean = false; // First day of the event
  export let isLastDay: boolean = false;  // Last day of the event
  export let onClick: ((openMode?: false | 'tab' | 'window') => void) | undefined = undefined;
  export let isMobile: boolean = false;

  /** v3.2.0 Iteration 5: DnD support */
  export let dragManager: TimelineDragManager | undefined = undefined;
  export let processedRecord: ProcessedRecord | undefined = undefined;
  export let isDragging: boolean = false;
  /** v4.0.4: Hide resize handles when resize is impossible (e.g. day view) */
  export let canResize: boolean = true;
  
  // v8.0: Unified constants - MUST match TimelineView.svelte
  const STRIP_HEIGHT_DESKTOP = 1.25;  // rem
  const STRIP_HEIGHT_MOBILE = 1.125;  // rem  
  const STRIP_GAP_REM = 0.125;        // gap between strips
  
  // Reactive height based on device
  $: STRIP_HEIGHT_REM = isMobile ? STRIP_HEIGHT_MOBILE : STRIP_HEIGHT_DESKTOP;
  // Row height = strip height + gap
  $: ROW_HEIGHT_REM = STRIP_HEIGHT_REM + STRIP_GAP_REM;
  // Top position for this strip
  $: topPosition = rowIndex * ROW_HEIGHT_REM;
  
  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    if (onClick) {
      // v3.0.8: Unified navigation — Shift → window, Ctrl → tab, else → default
      const openMode: false | 'tab' | 'window' = e.shiftKey ? 'window' : (e.ctrlKey || e.metaKey) ? 'tab' : false;
      onClick(openMode);
    }
  }

  let stripElement: HTMLElement;

  /** v3.2.0 Iteration 5: Detect mode from target and initiate drag */
  function handleMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    if (!dragManager || !processedRecord) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target as HTMLElement;
    let mode: DragMode = 'strip-move';
    if (target.classList.contains('resize-handle-start')) {
      mode = 'strip-resize-start';
    } else if (target.classList.contains('resize-handle-end')) {
      mode = 'strip-resize-end';
    }

    event.preventDefault();
    dragManager.initiate(processedRecord.record, processedRecord, event, mode, stripElement);
  }

  function handleTouchStart(event: TouchEvent) {
    if (!dragManager || !processedRecord) return;
    if (!event.touches[0]) return;

    const target = event.target as HTMLElement;
    let mode: DragMode = 'strip-move';
    if (target.classList.contains('resize-handle-start')) {
      mode = 'strip-resize-start';
    } else if (target.classList.contains('resize-handle-end')) {
      mode = 'strip-resize-end';
    }

    dragManager.initiate(processedRecord.record, processedRecord, event, mode, stripElement);
  }
</script>

{#if onClick}
  <button
    class="projects-calendar-multiday-strip"
    class:first={isFirstDay}
    class:last={isLastDay}
    class:mobile={isMobile}
    class:dnd-dragging={isDragging}
    class:dnd-grab={!!dragManager}
    style="
      --strip-color: {color};
      --strip-height: {STRIP_HEIGHT_REM}rem;
      height: {STRIP_HEIGHT_REM}rem;
      top: {topPosition}rem;
      line-height: {STRIP_HEIGHT_REM}rem;
    "
    on:click={handleClick}
    on:mousedown={handleMouseDown}
    on:touchstart|passive={handleTouchStart}
    bind:this={stripElement}
    title={title}
    type="button"
  >
    {#if isFirstDay && dragManager && canResize}
      <div class="resize-handle-start" aria-hidden="true"></div>
    {/if}
    {#if isFirstDay}
      <span class="strip-title">{title}</span>
    {/if}
    {#if isLastDay && dragManager && canResize}
      <div class="resize-handle-end" aria-hidden="true"></div>
    {/if}
  </button>
{:else}
  <div
    class="projects-calendar-multiday-strip"
    class:first={isFirstDay}
    class:last={isLastDay}
    class:mobile={isMobile}
    style="
      --strip-color: {color};
      --strip-height: {STRIP_HEIGHT_REM}rem;
      height: {STRIP_HEIGHT_REM}rem;
      top: {topPosition}rem;
      line-height: {STRIP_HEIGHT_REM}rem;
    "
    title={title}
  >
    {#if isFirstDay}
      <span class="strip-title">{title}</span>
    {/if}
  </div>
{/if}

<style>
  .projects-calendar-multiday-strip {
    position: absolute;
    left: 0;
    right: 0;
    /* v8.0: Height from CSS variable - ensures sync with container */
    height: var(--strip-height, 1.25rem);
    max-height: var(--strip-height, 1.25rem);
    /* v8.3.1: Explicit line-height to prevent inheritance from parent */
    line-height: var(--strip-height, 1.25rem);
    /* v9.1: Top border accent for multi-day events */
    background: color-mix(in srgb, var(--strip-color) 15%, var(--background-primary));
    border-top: var(--ppp-border-width-thick, 2px) solid var(--strip-color);
    border-radius: 0;
    color: var(--text-normal);
    font-size: var(--ppp-font-size-xs, 0.6875rem);
    padding: 0 0.375rem;
    display: flex;
    align-items: center;
    gap: var(--ppp-space-2, 0.25rem);
    overflow: hidden;
    cursor: default;
    transition: 
      background var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease),
      box-shadow var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease);
    z-index: 2;
    /* v9.0: Ensure strip stays within bounds */
    box-sizing: border-box;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  
  /* v9.0: First/last day styling - subtle visual indication */
  .projects-calendar-multiday-strip.first {
    left: 0;
  }
  
  .projects-calendar-multiday-strip.last {
    right: 0;
  }
  
  button.projects-calendar-multiday-strip {
    cursor: pointer;
    border: none;
    border-top: var(--ppp-border-width-thick, 2px) solid var(--strip-color);
    font-family: inherit;
    /* v9.1: Ensure button respects height - browsers may override */
    height: var(--strip-height, 1.25rem) !important;
    max-height: var(--strip-height, 1.25rem) !important;
    min-height: 0 !important;
    padding-top: 0;
    padding-bottom: 0;
  }
  
  button.projects-calendar-multiday-strip:hover {
    background: color-mix(in srgb, var(--strip-color) 25%, var(--background-primary));
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    z-index: 3;
  }
  
  button.projects-calendar-multiday-strip:active {
    background: color-mix(in srgb, var(--strip-color) 35%, var(--background-primary));
    box-shadow: none;
  }
  
  .strip-title {
    flex: 1;
    font-size: var(--ppp-font-size-xs, 0.6875rem);
    font-weight: 500;
    color: var(--text-normal);
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Mobile styles */
  .projects-calendar-multiday-strip.mobile {
    font-size: 0.5625rem;
    padding: 0 0.25rem;
  }
  
  .projects-calendar-multiday-strip.mobile .strip-title {
    font-size: 0.5625rem;
  }

  /* ── v3.2.0 Iteration 5: DnD states ── */
  .projects-calendar-multiday-strip.dnd-grab {
    cursor: grab;
  }
  .projects-calendar-multiday-strip.dnd-dragging {
    opacity: 0.4;
    pointer-events: none;
  }

  /* Reset browser/theme focus outline — use outline only for keyboard navigation */
  button.projects-calendar-multiday-strip:focus {
    outline: none;
  }
  button.projects-calendar-multiday-strip:focus-visible {
    outline: 2px solid var(--strip-color);
    outline-offset: 1px;
    z-index: 3;
  }

  /* Show resize handles on hover */
  button.projects-calendar-multiday-strip:hover .resize-handle-start,
  button.projects-calendar-multiday-strip:hover .resize-handle-end {
    opacity: 1;
  }

  /* Left triangle — startDate edge */
  .resize-handle-start {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-left: 8px solid var(--strip-color);
    border-bottom: 8px solid transparent;
    cursor: ew-resize;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
    z-index: 2;
    pointer-events: auto;
  }

  /* Right triangle — endDate edge */
  .resize-handle-end {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-right: 8px solid var(--strip-color);
    border-top: 8px solid transparent;
    cursor: ew-resize;
    opacity: 0;
    transition: opacity var(--ppp-duration-normal, 0.15s) var(--ppp-ease-out, ease);
    z-index: 2;
    pointer-events: auto;
  }

  /* Touch zone 44px around handles */
  .resize-handle-start::before,
  .resize-handle-end::before {
    content: '';
    position: absolute;
    width: 44px;
    height: 44px;
  }
  .resize-handle-start::before {
    top: -12px;
    left: -12px;
  }
  .resize-handle-end::before {
    bottom: -12px;
    right: -12px;
  }

  @media (pointer: coarse) {
    .resize-handle-start {
      border-left-width: 12px;
      border-bottom-width: 12px;
    }
    .resize-handle-end {
      border-right-width: 12px;
      border-top-width: 12px;
    }
    .resize-handle-start::before {
      top: -18px;
      left: -18px;
    }
    .resize-handle-end::before {
      bottom: -18px;
      right: -18px;
    }
  }
</style>

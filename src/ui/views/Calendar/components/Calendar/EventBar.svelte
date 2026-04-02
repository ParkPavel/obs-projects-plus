<script lang="ts">
  import type { DataRecord } from '../../../../../lib/dataframe/dataframe';
  import type { ProcessedRecord } from '../../types';
  import type { TimelineDragManager } from '../../dnd/TimelineDragManager';
  import type { DragMode } from '../../dnd/types';
  import { getDisplayName, cleanWikiLink } from "src/ui/views/Board/components/Board/boardHelpers";
  import dayjs from 'dayjs';
  
  /**
   * EventBar - Positioned event bar for timeline views
   * Displays event as colored bar with time-based positioning
   * 
   * v3.1.0 "Matryoshka" principle:
   * - Uses rem-based positioning for predictable scrolling
   * - hourHeightRem defines height per hour (default 3rem = 48px)
   * - Position calculated as hours * hourHeightRem (in rem)
   */
  
  export let record: DataRecord;
  export let startDate: dayjs.Dayjs;
  export let endDate: dayjs.Dayjs | null;
  export let startHour: number = 0;
  /** Reserved - event bars use visual clipping instead of endHour clamp */
  export const endHour: number = 24;
  export let color: string = 'var(--text-accent)';
  export let column: number = 0;
  export let totalColumns: number = 1;
  export let hourHeightRem: number = 3; // Height per hour in rem
  export let onClick: ((event: MouseEvent) => void) | undefined = undefined;
  
  /** Color filter indicators (ROADMAP §2.5) */
  export let colorFilters: string[] = [];

  /** v3.2.0 DnD: ProcessedRecord for drag context */
  export let processedRecord: ProcessedRecord | undefined = undefined;
  /** v3.2.0 DnD: TimelineDragManager instance */
  export let dragManager: TimelineDragManager | undefined = undefined;
  /** v3.2.0 DnD: Whether drag is currently active on this bar */
  export let isDragging: boolean = false;
  
  /** v3.2.6: Whether mobile long-press DnD mode is active (show handles) */
  import { onDestroy } from 'svelte';
  let longPressActiveValue = false;
  let unsubLongPress: (() => void) | undefined;
  // Use a function call to break Svelte's dependency tracking on unsubLongPress.
  // A $: block that both reads and writes the same variable creates an infinite
  // reactive loop (Svelte flush do...while never terminates). The function body
  // is NOT analyzed for $: dependencies — only `dragManager` is tracked.
  $: updateLongPressSubscription(dragManager);
  function updateLongPressSubscription(dm: typeof dragManager) {
    unsubLongPress?.();
    if (dm) {
      unsubLongPress = dm.longPressActive.subscribe(v => { longPressActiveValue = v; });
    } else {
      longPressActiveValue = false;
      unsubLongPress = undefined;
    }
  }
  onDestroy(() => { unsubLongPress?.(); });
  
  // Calculate position and height in REM (Matryoshka principle)
  $: {
    const startMinutes = startDate.hour() * 60 + startDate.minute();
    const startFromBeginning = startMinutes - (startHour * 60);
    
    // If no end date, default to 1 hour duration
    const effectiveEndDate = endDate || startDate.add(1, 'hour');
    const endMinutes = effectiveEndDate.hour() * 60 + effectiveEndDate.minute();
    const endFromBeginning = endMinutes - (startHour * 60);
    
    // Convert minutes to rem (hourHeightRem per 60 minutes)
    const minuteHeightRem = hourHeightRem / 60;
    topRem = Math.max(0, startFromBeginning * minuteHeightRem);
    // v8.2: Min visual height = 20 minutes (hourHeightRem * 20/60 = hourHeightRem/3)
    // This MUST match MIN_VISUAL_DURATION_MINUTES in EventBarContainer for collision sync
    const MIN_VISUAL_MINUTES = 20;
    heightRem = Math.max(hourHeightRem * MIN_VISUAL_MINUTES / 60, (endFromBeginning - startFromBeginning) * minuteHeightRem);
    
    // Column positioning for overlapping events (guard against division by zero)
    const safeTotalColumns = totalColumns > 0 ? totalColumns : 1;
    leftPercent = (column / safeTotalColumns) * 100;
    widthPercent = (1 / safeTotalColumns) * 100;
  }
  
  let topRem: number;
  let heightRem: number;
  let leftPercent: number;
  let widthPercent: number;
  
  // Get display title - use name/title fields, fallback to getDisplayName
  // cleanWikiLink handles [[path|name]] and [[path]] formats
  $: title = (() => {
    // Check for name field
    const name = record.values['name'];
    if (name && typeof name === 'string' && name.trim()) {
      return cleanWikiLink(name);
    }
    
    // Check for title field
    const titleVal = record.values['title'];
    if (titleVal && typeof titleVal === 'string' && titleVal.trim()) {
      return cleanWikiLink(titleVal);
    }
    
    // Check for file object with name
    const fileValue = record.values['file'];
    if (fileValue && typeof fileValue === 'object' && 'name' in fileValue) {
      return (fileValue as { name: string }).name;
    }
    
    // Fallback: extract display name from record ID
    return getDisplayName(record.id) || 'Untitled';
  })();
  
  function handleClick(event: MouseEvent) {
    if (onClick) {
      onClick(event);
    }
  }

  let barElement: HTMLElement;

  /**
   * v3.2.0: Initiate drag on mousedown.
   * Distinguishes between body drag (move) and handle drag (resize).
   */
  /**
   * v3.3.0: Position-based mode detection replaces class-based target detection.
   * The resize-handle ::before touch zones extend inward into the event bar body,
   * making it impossible to drag small events (move mode) via class detection.
   * Using clientY÷barHeight ratio gives exact control regardless of pseudo-element zones.
   */
  function getBarMode(clientY: number): DragMode {
    if (!barElement) return 'move';
    const rect = barElement.getBoundingClientRect();
    const relY = clientY - rect.top;
    const barH = rect.height;
    // v4.0.2: Resize zone: 1rem (desktop) / 1.25rem (touch) or 35% of bar height.
    // Larger zones make it easier to "catch" the resize edge on mobile.
    const remPx = parseFloat(getComputedStyle(barElement).fontSize) || 16;
    const isTouchDevice = 'ontouchstart' in window;
    const zoneRem = isTouchDevice ? 1.25 : 1;
    const zone = Math.min(zoneRem * remPx, barH * 0.35);
    if (relY <= zone) return 'resize-top';
    if (relY >= barH - zone) return 'resize-bottom';
    return 'move';
  }

  function handleMouseDown(event: MouseEvent) {
    // Only left button
    if (event.button !== 0) return;
    // Skip if no drag manager or processed record
    if (!dragManager || !processedRecord) return;
    // Don't interfere with modifier-key clicks (open in new tab etc.)
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;

    const mode = getBarMode(event.clientY);

    // Prevent default to avoid text selection
    event.preventDefault();
    dragManager.initiate(record, processedRecord, event, mode, barElement);
  }

  /**
   * v3.2.0 Iteration 3: Initiate drag on touchstart.
   * Long-press logic is handled inside TimelineDragManager.
   */
  function handleTouchStart(event: TouchEvent) {
    if (!dragManager || !processedRecord) return;

    const touch = event.touches[0];
    if (!touch) return;

    const mode = getBarMode(touch.clientY);

    // Do NOT preventDefault here — allow page scroll if long-press fails
    dragManager.initiate(record, processedRecord, event, mode, barElement);
  }
</script>

{#if onClick}
  <button 
    class="projects-calendar-event-bar projects-calendar-event-bar-clickable"
    class:dnd-dragging={isDragging}
    class:dnd-handles-visible={longPressActiveValue && isDragging}
    type="button"
    style="
      top: {topRem}rem; 
      height: {heightRem}rem; 
      --left-percent: {leftPercent}%;
      --width-percent: {widthPercent}%;
      --event-color: {color};
    "
    on:click={handleClick}
    on:mousedown={handleMouseDown}
    on:touchstart|passive={handleTouchStart}
    bind:this={barElement}
    title={title}
  >
    <!-- v3.2.0: Top resize handle (startTime) -->
    {#if dragManager}
      <div class="resize-handle-top" aria-hidden="true"></div>
    {/if}
    <div class="projects-calendar-event-bar-content">
      <div class="projects-calendar-event-title">{title}</div>
      {#if colorFilters.length > 0}
        <div class="color-indicators">
          {#each colorFilters as filterColor}
            <span class="indicator" style="background: {filterColor}"></span>
          {/each}
        </div>
      {/if}
    </div>
    <!-- v3.2.0: Bottom resize handle (endTime) -->
    {#if dragManager}
      <div class="resize-handle-bottom" aria-hidden="true"></div>
    {/if}
  </button>
{:else}
  <div 
    class="projects-calendar-event-bar"
    style="
      top: {topRem}rem; 
      height: {heightRem}rem; 
      --left-percent: {leftPercent}%;
      --width-percent: {widthPercent}%;
      --event-color: {color};
    "
    title={title}
  >
    <div class="projects-calendar-event-bar-content">
      <div class="projects-calendar-event-title">{title}</div>
      {#if colorFilters.length > 0}
        <div class="color-indicators">
          {#each colorFilters as filterColor}
            <span class="indicator" style="background: {filterColor}"></span>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .projects-calendar-event-bar {
    position: absolute;
    /* v3.3.4: Re-enable pointer events (container has pointer-events: none) */
    pointer-events: auto;
    background: color-mix(in srgb, var(--event-color) 15%, transparent);
    border-radius: var(--ppp-radius-md, 0.25rem);
    padding: 0.125rem 0.375rem;
    margin: 0;
    /* Reset button border first, then apply accent border */
    border: none;
    border-left: var(--ppp-border-width-thick, 0.125rem) solid var(--event-color);
    /* Add small inset to prevent touching column edges */
    left: calc(var(--left-percent, 0) + 0.0625rem);
    width: calc(var(--width-percent, 100%) - 0.125rem);
    /* v3.2.4: Prevent right edge overflow beyond column bounds */
    max-width: calc(100% - var(--left-percent, 0) - 0.125rem);
    /* v3.2.6: overflow removed from bar — content div handles text clipping.
       This allows resize handle ::before touch zones to extend outside the bar. */
    transition: background var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease),
                box-shadow var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease);
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
    /* v3.3.4: none prevents browser from committing to scroll on touchstart,
       keeping touchmove events cancelable so DnD drag can preventDefault */
    touch-action: none;
  }
  
  button.projects-calendar-event-bar {
    cursor: pointer;
  }
  
  button.projects-calendar-event-bar:hover {
    background: color-mix(in srgb, var(--event-color) 25%, transparent);
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.1);
    z-index: 10;
  }
  
  /* v3.2.0: Show resize handles on hover */
  button.projects-calendar-event-bar:hover .resize-handle-top,
  button.projects-calendar-event-bar:hover .resize-handle-bottom {
    opacity: 1;
  }

  /* v3.2.6: Show handles when mobile long-press DnD mode is active on THIS bar */
  button.projects-calendar-event-bar.dnd-handles-visible {
    box-shadow: 0 0 0 0.125rem var(--event-color);
    z-index: 20;
  }
  button.projects-calendar-event-bar.dnd-handles-visible .resize-handle-top,
  button.projects-calendar-event-bar.dnd-handles-visible .resize-handle-bottom {
    opacity: 1;
  }

  /* v3.2.0: Dragging state — dim original bar but keep handles visible */
  .projects-calendar-event-bar.dnd-dragging {
    opacity: 0.35;
    pointer-events: none;
  }

  /* v4.0.2: Keep resize handles prominent on the original bar during drag.
     The dimmed bar acts as an anchor showing where the event WAS. */
  .projects-calendar-event-bar.dnd-dragging.dnd-handles-visible .resize-handle-top,
  .projects-calendar-event-bar.dnd-dragging.dnd-handles-visible .resize-handle-bottom {
    opacity: 1;
    /* Override parent's 0.35 opacity — handles need to be clearly visible */
    filter: none;
    animation: none;
  }
  
  button.projects-calendar-event-bar:active {
    background: color-mix(in srgb, var(--event-color) 35%, transparent);
  }
  
  /* v3.3.1: Suppress outline on mouse-click; show only on keyboard navigation */
  button.projects-calendar-event-bar:focus {
    outline: none;
  }
  button.projects-calendar-event-bar:focus-visible {
    outline: 0.125rem solid var(--event-color);
    outline-offset: 0.125rem;
    z-index: 10;
  }
  
  .projects-calendar-event-bar-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    height: 100%;
    overflow: hidden;
    pointer-events: none; /* Let clicks pass through to button */
  }
  
  .projects-calendar-event-title {
    font-size: var(--ppp-font-size-sm, 0.75rem);
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Color filter indicators (ROADMAP §2.5) */
  .color-indicators {
    display: flex;
    gap: 0.125rem;
    margin-top: 0.125rem;
    flex-wrap: wrap;
  }
  
  .indicator {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    border: 0.0625rem solid rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }
  
  /* Mobile responsive */
  @media (max-width: 48rem) {
    .projects-calendar-event-bar {
      padding: 0.1875rem 0.25rem;
      /* v8.2: No margin - width is already calculated with gaps */
      margin: 0;
      border-left-width: var(--ppp-border-width-thick, 0.125rem);
    }
    
    .projects-calendar-event-title {
      font-size: var(--ppp-font-size-xs, 0.6875rem);
    }
    
    button.projects-calendar-event-bar:active {
      background: color-mix(in srgb, var(--event-color) 40%, transparent);
    }
  }

  /* Touch device: minimum touch target height */
  @media (pointer: coarse) {
    .projects-calendar-event-bar {
      min-height: 2.25rem;
      padding: 0.25rem 0.375rem;
    }

    /* v4.0.2: Larger, more visible triangle handles for touch */
    .resize-handle-top {
      border-top-width: 0.875rem;
      border-right-width: 0.875rem;
    }
    .resize-handle-bottom {
      border-bottom-width: 0.875rem;
      border-left-width: 0.875rem;
    }
    /* Larger touch zone */
    .resize-handle-top::before {
      width: 3rem;
      height: 3rem;
      top: -1.25rem;
      left: -1.25rem;
    }
    .resize-handle-bottom::before {
      width: 3rem;
      height: 3rem;
      bottom: -1.25rem;
      right: -1.25rem;
    }
  }

  /* ── v3.2.0 Resize Handles ── */

  /* Top-left triangle — startTime resize */
  .resize-handle-top {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-top: 0.5rem solid var(--event-color);
    border-right: 0.5rem solid transparent;
    cursor: n-resize;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 2;
    pointer-events: auto;
  }

  /* v3.2.6: Bottom-right triangle — endTime resize (mirrors top-left triangle) */
  .resize-handle-bottom {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-bottom: 0.5rem solid var(--event-color);
    border-left: 0.5rem solid transparent;
    cursor: s-resize;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 2;
    pointer-events: auto;
  }

  /* Invisible touch zone for top triangle */
  .resize-handle-top::before {
    content: '';
    position: absolute;
    width: 2.75rem;
    height: 2.75rem;
    top: -0.75rem;
    left: -0.75rem;
  }

  /* Invisible touch zone for bottom-right triangle */
  .resize-handle-bottom::before {
    content: '';
    position: absolute;
    width: 2.75rem;
    height: 2.75rem;
    bottom: -0.75rem;
    right: -0.75rem;
  }
</style>

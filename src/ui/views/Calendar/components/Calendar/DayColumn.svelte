<script lang="ts">
  import dayjs from 'dayjs';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import { EventRenderType, type ProcessedRecord } from '../../types';
  import EventBarContainer from './EventBarContainer.svelte';
  import EventIndicator from './EventIndicator.svelte';
  import type { TimelineDragManager } from '../../dnd/TimelineDragManager';
  import CreationPreview from '../../dnd/CreationPreview.svelte';
  import { DND_CONSTANTS } from '../../dnd/types';
  import { yPositionToMinutes } from '../../dnd/SnapEngine';
  
  /**
   * DayColumn - Single day column in timeline view
   * Displays event bars positioned by time
   * Uses ProcessedRecord from CalendarDataProcessor (v3.0.0)
   * 
   * v3.0.0: Auto-fill time when clicking on timeline
   */
  
  export let day: dayjs.Dayjs;
  export let processedRecords: ProcessedRecord[] = [];
  export let startHour: number = 0;
  export let endHour: number = 24;
  /** Timezone for date calculations */
  export let timezone: string = 'local';
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  /** Callback when user wants to add a record. Receives date and optional time (HH:mm) */
  export let onRecordAdd: ((date: dayjs.Dayjs, startTime?: string, endTime?: string) => void) | undefined;
  export let onDayTap: (() => void) | undefined;
  export let isMobile: boolean = false;
  export let isToday: boolean = false;
  export let hourHeightRem: number = 3; // Height per hour in rem (default: 3rem = 48px)

  /** v3.2.0 DnD: TimelineDragManager instance */
  export let dragManager: TimelineDragManager | undefined = undefined;
  /** v3.2.0 DnD: Record ID currently being dragged */
  export let draggingRecordId: string | null = null;
  /** v3.2.0 Iteration 2: Whether this column is the current drop target */
  export let isDragTarget: boolean = false;
  /** v3.2.0 DnD: Exposed DOM element for drag overlay positioning */
  export let columnElement: HTMLElement | undefined = undefined;
  
  interface BarEvent {
    record: DataRecord;
    startDate: dayjs.Dayjs;
    endDate: dayjs.Dayjs;
    color: string;
    overflowTop: boolean;    // Event starts before startHour
    overflowBottom: boolean; // Event ends after endHour
    isMultiDay: boolean;     // Event spans multiple days
  }
  
  let touchStartTime = 0;
  let touchStartY = 0;
  let hasMoved = false;
  
  /**
   * Calculate time (HH:mm) from click Y position on the column
   */
  function getTimeFromYPosition(clientY: number): string {
    if (!columnElement) return '09:00';
    
    const rect = columnElement.getBoundingClientRect();
    const relativeY = clientY - rect.top + columnElement.scrollTop;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const totalHeight = (endHour - startHour) * hourHeightRem * remPx;
    
    // Calculate hour from position
    const hourOffset = (relativeY / totalHeight) * (endHour - startHour);
    const hour = Math.floor(startHour + hourOffset);
    const minutes = Math.round((hourOffset % 1) * 60 / 15) * 15; // Round to 15 min
    
    // Clamp to valid range
    const clampedHour = Math.max(startHour, Math.min(endHour - 1, hour));
    const clampedMinutes = minutes >= 60 ? 0 : minutes;
    
    return `${clampedHour.toString().padStart(2, '0')}:${clampedMinutes.toString().padStart(2, '0')}`;
  }
  
  /**
   * Get time in the configured timezone
   */
  function getTimeInTimezone(date: dayjs.Dayjs): dayjs.Dayjs {
    if (timezone === 'local' || !timezone) {
      return date;
    }
    // Apply timezone conversion if dayjs.tz is available
    return date.tz?.(timezone) ?? date;
  }
  
  /**
   * Build event bars from ProcessedRecords (v3.0.0 unified approach)
   * All date/time parsing is done in CalendarDataProcessor
   * Timezone is applied here for correct positioning
   */
  function buildBarEvents(): BarEvent[] {
    const bars: BarEvent[] = [];
    const visibleStart = startHour * 60; // in minutes
    const visibleEnd = endHour * 60;     // in minutes
    
    for (const pRecord of processedRecords) {
      // Only process TIMED events for the timeline
      // (All-day events are handled by AllDayEventStrip in the header)
      if ((pRecord.renderType === EventRenderType.TIMED || pRecord.renderType === EventRenderType.MULTI_DAY_TIMED) && pRecord.timeInfo) {
         const { startTime, endTime } = pRecord.timeInfo;
         
         // Apply timezone for display
         const tzStartTime = getTimeInTimezone(startTime);
         const tzEndTime = getTimeInTimezone(endTime);
         
         // Detect overflow using timezone-adjusted times
         const eventStartMinutes = tzStartTime.hour() * 60 + tzStartTime.minute();
         const eventEndMinutes = tzEndTime.hour() * 60 + tzEndTime.minute();
         const overflowTop = eventStartMinutes < visibleStart;
         const overflowBottom = eventEndMinutes > visibleEnd;
         
         bars.push({
           record: pRecord.record,
           startDate: tzStartTime,
           endDate: tzEndTime,
           color: pRecord.color || '#808080',
           overflowTop,
           overflowBottom,
           isMultiDay: pRecord.renderType === EventRenderType.MULTI_DAY_TIMED
         });
      }
    }
    
    return bars;
  }
  
  // v10.1: dataFingerprint REMOVED — was O(N) string build per DayColumn (×35 instances!)
  // Reactivity now relies on processedRecords reference change from parent TimelineView.
  // timedRecordsByDay creates new array references when dataVersion changes.
  
  // Reactive: rebuild bars when processedRecords reference changes
  $: barEvents = (() => {
    void processedRecords; // Track reference change for reactivity
    return buildBarEvents();
  })();
  
  // Separate events with overflow indicators
  $: overflowTopEvents = barEvents.filter(e => e.overflowTop);
  $: overflowBottomEvents = barEvents.filter(e => e.overflowBottom);
  $: topIndicatorColor = overflowTopEvents.length > 0 ? overflowTopEvents[0]?.color ?? 'var(--text-accent)' : 'var(--text-accent)';
  $: bottomIndicatorColor = overflowBottomEvents.length > 0 ? overflowBottomEvents[0]?.color ?? 'var(--text-accent)' : 'var(--text-accent)';
  
  // Handle background click (add new event with time from click position)
  let suppressNextClick = false;
  function handleBackgroundClick(e: MouseEvent) {
    // v3.2.6: Suppress click if drag-to-create just completed
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    // Only trigger if clicking on background, not on event
    if (e.target === e.currentTarget && onRecordAdd) {
      const startTime = getTimeFromYPosition(e.clientY);
      onRecordAdd(day, startTime);
    }
  }
  
  // Mobile: Detect tap (not scroll)
  function handleTouchStart(e: TouchEvent) {
    if (!e.touches[0]) return;
    touchStartTime = Date.now();
    touchStartY = e.touches[0].clientY;
    hasMoved = false;
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!e.touches[0]) return;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (deltaY > 10) {
      hasMoved = true;
    }
  }
  
  function handleTouchEnd(e: TouchEvent) {
    const duration = Date.now() - touchStartTime;
    
    // Tap detected: short duration, no movement
    if (duration < 300 && !hasMoved) {
      if (onDayTap) {
        e.preventDefault();
        onDayTap();
      } else if (onRecordAdd && e.changedTouches[0]) {
        e.preventDefault();
        if (isMobile) {
          // v3.2.0 Iteration 4: Show creation preview instead of immediate creation
          showCreationPreview(e.changedTouches[0].clientY);
        } else {
          const startTime = getTimeFromYPosition(e.changedTouches[0].clientY);
          onRecordAdd(day, startTime);
        }
      }
    }
  }

  // ── v3.2.0 Iteration 4: Creation preview ──

  let previewVisible = false;
  let previewStartMinutes = 0;
  let previewEndMinutes = 0;

  function showCreationPreview(clientY: number): void {
    if (!columnElement) return;
    const rect = columnElement.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const tapMinutes = yPositionToMinutes(
      relativeY, startHour, endHour, hourHeightRem, 16,
      DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
    );
    previewStartMinutes = tapMinutes;
    previewEndMinutes = Math.min(tapMinutes + DND_CONSTANTS.CREATION_DEFAULT_DURATION, endHour * 60);
    previewVisible = true;
  }

  function handlePreviewConfirm(startTime: string, endTime: string): void {
    previewVisible = false;
    if (onRecordAdd) {
      onRecordAdd(day, startTime);
    }
  }

  function handlePreviewCancel(): void {
    previewVisible = false;
  }

  // ── v3.2.6: Desktop drag-to-create (Google Calendar style) ──

  let creationDrag = false;
  let creationDragStartY = 0;
  let creationDragStartMinutes = 0;
  let creationDragEndMinutes = 0;
  let creationDragActive = false;

  function getMinutesFromClientY(clientY: number): number {
    if (!columnElement) return startHour * 60;
    const rect = columnElement.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    return yPositionToMinutes(
      relativeY, startHour, endHour, hourHeightRem, 16,
      DND_CONSTANTS.SNAP_INTERVAL_DEFAULT
    );
  }

  function handleColumnMouseDown(e: MouseEvent): void {
    // Only handle left-click on the column background (not on events)
    if (e.button !== 0 || isMobile || !onRecordAdd) return;
    if (e.target !== e.currentTarget) return;

    creationDragStartY = e.clientY;
    creationDragStartMinutes = getMinutesFromClientY(e.clientY);
    creationDragEndMinutes = creationDragStartMinutes;
    creationDrag = true;
    creationDragActive = false;

    const doc = columnElement?.ownerDocument ?? document;
    doc.addEventListener('mousemove', handleCreationMouseMove);
    doc.addEventListener('mouseup', handleCreationMouseUp);
  }

  function handleCreationMouseMove(e: MouseEvent): void {
    if (!creationDrag) return;
    const delta = Math.abs(e.clientY - creationDragStartY);
    if (delta > 5) {
      creationDragActive = true;
    }
    if (creationDragActive) {
      e.preventDefault();
      const pointerMinutes = getMinutesFromClientY(e.clientY);
      // Allow dragging up or down from the start point
      if (pointerMinutes >= creationDragStartMinutes) {
        creationDragEndMinutes = Math.max(
          pointerMinutes,
          creationDragStartMinutes + DND_CONSTANTS.MIN_DURATION_MINUTES
        );
      } else {
        creationDragEndMinutes = creationDragStartMinutes + DND_CONSTANTS.MIN_DURATION_MINUTES;
        creationDragStartMinutes = pointerMinutes;
      }
    }
  }

  function handleCreationMouseUp(e: MouseEvent): void {
    const doc = columnElement?.ownerDocument ?? document;
    doc.removeEventListener('mousemove', handleCreationMouseMove);
    doc.removeEventListener('mouseup', handleCreationMouseUp);

    if (creationDragActive && onRecordAdd) {
      // Suppress the following click event
      suppressNextClick = true;
      // User dragged a range — create event with that range
      const finalStart = Math.min(creationDragStartMinutes, creationDragEndMinutes);
      const finalEnd = Math.max(creationDragStartMinutes, creationDragEndMinutes);
      const startTimeStr = `${Math.floor(finalStart / 60).toString().padStart(2, '0')}:${(finalStart % 60).toString().padStart(2, '0')}`;
      const endTimeStr = `${Math.floor(finalEnd / 60).toString().padStart(2, '0')}:${(finalEnd % 60).toString().padStart(2, '0')}`;
      onRecordAdd(day, startTimeStr, endTimeStr);
    }

    creationDrag = false;
    creationDragActive = false;
  }

  $: creationPreviewTopRem = (() => {
    const mins = Math.min(creationDragStartMinutes, creationDragEndMinutes);
    return ((mins - startHour * 60) / 60) * hourHeightRem;
  })();
  $: creationPreviewHeightRem = (() => {
    const s = Math.min(creationDragStartMinutes, creationDragEndMinutes);
    const e = Math.max(creationDragStartMinutes, creationDragEndMinutes);
    return ((e - s) / 60) * hourHeightRem;
  })();
  $: creationPreviewTimeLabel = (() => {
    const s = Math.min(creationDragStartMinutes, creationDragEndMinutes);
    const e = Math.max(creationDragStartMinutes, creationDragEndMinutes);
    const sh = Math.floor(s / 60).toString().padStart(2, '0');
    const sm = (s % 60).toString().padStart(2, '0');
    const eh = Math.floor(e / 60).toString().padStart(2, '0');
    const em = (e % 60).toString().padStart(2, '0');
    return `${sh}:${sm} – ${eh}:${em}`;
  })();
</script>

<div 
  class="projects-calendar-day-column"
  class:today={isToday}
  class:clickable={!!onRecordAdd || !!onDayTap}
  class:mobile={isMobile}
  class:dnd-drop-target={isDragTarget}
  data-date={day.format('YYYY-MM-DD')}
  style:--total-height="{(endHour - startHour) * hourHeightRem}rem"
  bind:this={columnElement}
  on:click={handleBackgroundClick}
  on:mousedown={handleColumnMouseDown}
  on:touchstart|passive={handleTouchStart}
  on:touchmove|passive={handleTouchMove}
  on:touchend={handleTouchEnd}
  on:keydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (onRecordAdd) {
        e.preventDefault();
        onRecordAdd(day, '09:00'); // Default time for keyboard
      }
    }
  }}
  role="button"
  tabindex="0"
>
  <!-- Overflow indicator for events starting before visible range -->
  {#if overflowTopEvents.length > 0}
    <EventIndicator 
      position="top" 
      color={topIndicatorColor} 
      count={overflowTopEvents.length}
      onClick={() => {
        if (overflowTopEvents[0] && onRecordClick) {
          onRecordClick(overflowTopEvents[0].record);
        }
      }}
    />
  {/if}
  
  {#if barEvents.length > 0}
    <EventBarContainer
      events={barEvents}
      {startHour}
      {endHour}
      {hourHeightRem}
      onEventClick={onRecordClick}
      {processedRecords}
      {dragManager}
      {draggingRecordId}
    />
  {/if}
  
  <!-- Overflow indicator for events ending after visible range -->
  {#if overflowBottomEvents.length > 0}
    <EventIndicator 
      position="bottom" 
      color={bottomIndicatorColor} 
      count={overflowBottomEvents.length}
      onClick={() => {
        if (overflowBottomEvents[0] && onRecordClick) {
          onRecordClick(overflowBottomEvents[0].record);
        }
      }}
    />
  {/if}

  <!-- v3.2.0 Iteration 4: Creation preview for mobile tap -->
  {#if previewVisible && columnElement}
    <CreationPreview
      startMinutes={previewStartMinutes}
      endMinutes={previewEndMinutes}
      {hourHeightRem}
      {startHour}
      {endHour}
      {columnElement}
      onConfirm={handlePreviewConfirm}
      onCancel={handlePreviewCancel}
    />
  {/if}

  <!-- v3.2.6: Desktop drag-to-create ghost -->
  {#if creationDragActive}
    <div
      class="creation-drag-ghost"
      style="top: {creationPreviewTopRem}rem; height: {creationPreviewHeightRem}rem;"
      aria-hidden="true"
    >
      <span class="creation-drag-time">{creationPreviewTimeLabel}</span>
    </div>
  {/if}
</div>

<style>
  .projects-calendar-day-column {
    flex: 1;
    position: relative;
    border-right: 0.0625rem solid var(--background-modifier-border);
    height: var(--total-height, 72rem); /* 24h × 3rem = 72rem */
    min-height: var(--total-height, 72rem);
    transition: background-color 0.15s ease;
    /* v8.2: Clip events to column bounds */
    overflow: hidden;
  }
  
  .projects-calendar-day-column:last-child {
    border-right: none;
  }
  
  .projects-calendar-day-column.clickable {
    cursor: pointer;
  }
  
  .projects-calendar-day-column.clickable:hover {
    background: var(--background-modifier-hover);
  }
  
  .projects-calendar-day-column.today {
    background: var(--background-modifier-hover);
  }
  
  .projects-calendar-day-column.mobile {
    -webkit-tap-highlight-color: transparent;
    /* v3.2.4: Use manipulation instead of pan-y to allow DnD horizontal drag on touch */
    touch-action: manipulation;
  }
  
  .projects-calendar-day-column.mobile.clickable:active {
    background: var(--background-modifier-active-hover);
  }

  /* v3.2.0 Iteration 2: Highlight column when it's the drop target during DnD */
  .projects-calendar-day-column.dnd-drop-target {
    background: color-mix(in srgb, var(--text-accent) 10%, transparent);
    box-shadow: inset 0 0 0 0.09375rem color-mix(in srgb, var(--text-accent) 30%, transparent);
  }
  /* v3.3.6: Stronger drop target highlight on touch devices for better visual feedback */
  @media (pointer: coarse) {
    .projects-calendar-day-column.dnd-drop-target {
      background: color-mix(in srgb, var(--text-accent) 18%, transparent);
      box-shadow: inset 0 0 0 0.125rem color-mix(in srgb, var(--text-accent) 50%, transparent);
    }
  }

  /* v3.2.6: Desktop drag-to-create ghost */
  .creation-drag-ghost {
    position: absolute;
    left: 0.25rem;
    right: 0.25rem;
    border: 0.125rem dashed var(--text-accent);
    background: color-mix(in srgb, var(--text-accent) 10%, transparent);
    border-radius: 0.25rem;
    z-index: 20;
    pointer-events: none;
    display: flex;
    align-items: flex-start;
    padding: 0.125rem 0.375rem;
  }

  .creation-drag-time {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-accent);
    white-space: nowrap;
  }
</style>

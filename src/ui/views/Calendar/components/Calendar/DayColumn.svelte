<script lang="ts">
  import dayjs from 'dayjs';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import { EventRenderType, type ProcessedRecord } from '../../types';
  import EventBarContainer from './EventBarContainer.svelte';
  import EventIndicator from './EventIndicator.svelte';
  
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
  export let onRecordAdd: ((date: dayjs.Dayjs, startTime?: string) => void) | undefined;
  export let onDayTap: (() => void) | undefined;
  export let isMobile: boolean = false;
  export let isToday: boolean = false;
  export let hourHeightRem: number = 3; // Height per hour in rem (default: 3rem = 48px)
  
  let columnElement: HTMLDivElement;
  
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
    const totalHeight = (endHour - startHour) * hourHeightRem * 16; // rem to px (16px base)
    
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
  
  // v7.1: Data fingerprint for reactivity - changes when processedRecords content changes
  $: dataFingerprint = processedRecords.length + 
    processedRecords.map(r => r.record.id + (r.timeInfo?.startTime?.valueOf() ?? 0)).join(',');
  
  // Reactive: rebuild bars when processedRecords changes
  // Touch dataFingerprint to ensure reactivity on deep changes
  $: barEvents = (() => {
    dataFingerprint; // Force re-evaluation
    return buildBarEvents();
  })();
  
  // Separate events with overflow indicators
  $: overflowTopEvents = barEvents.filter(e => e.overflowTop);
  $: overflowBottomEvents = barEvents.filter(e => e.overflowBottom);
  $: topIndicatorColor = overflowTopEvents.length > 0 ? overflowTopEvents[0]?.color ?? 'var(--text-accent)' : 'var(--text-accent)';
  $: bottomIndicatorColor = overflowBottomEvents.length > 0 ? overflowBottomEvents[0]?.color ?? 'var(--text-accent)' : 'var(--text-accent)';
  
  // Handle background click (add new event with time from click position)
  function handleBackgroundClick(e: MouseEvent) {
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
        const startTime = getTimeFromYPosition(e.changedTouches[0].clientY);
        onRecordAdd(day, startTime);
      }
    }
  }
</script>

<div 
  class="projects-calendar-day-column"
  class:today={isToday}
  class:clickable={!!onRecordAdd || !!onDayTap}
  class:mobile={isMobile}
  style:--total-height="{(endHour - startHour) * hourHeightRem}rem"
  bind:this={columnElement}
  on:click={handleBackgroundClick}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
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
</div>

<style>
  .projects-calendar-day-column {
    flex: 1;
    position: relative;
    border-right: 1px solid var(--background-modifier-border);
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
    touch-action: pan-y;
  }
  
  .projects-calendar-day-column.mobile.clickable:active {
    background: var(--background-modifier-active-hover);
  }
</style>

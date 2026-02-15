<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import dayjs from 'dayjs';
  import type { DataRecord } from '../../../../../lib/dataframe/dataframe';
  import { EventRenderType, type ProcessedRecord } from '../../types';
  import { getDisplayName, cleanWikiLink } from "src/ui/views/Board/components/Board/boardHelpers";
  import { app } from "src/lib/stores/obsidian";
  import EventTimeline from './EventTimeline.svelte';
  import CurrentTimeLine from './CurrentTimeLine.svelte';
  import DayColumn from './DayColumn.svelte';
  import AllDayEventStrip from './AllDayEventStrip.svelte';
  import MultiDayEventStrip from './MultiDayEventStrip.svelte';
  
  /**
   * TimelineView - Timeline layout for day/week views
   * Shows vertical time axis on left, day columns on right
   * Supports touch gestures, drag-to-scroll, mobile adaptivity
   * 
   * v6.0: Full 24h scrollable timeline
   * - Default viewport: 7:00-21:00 (business hours)
   * - Scroll up to access 0:00-7:00
   * - Scroll down to access 21:00-24:00
   * - Each hour = 3rem height for consistent sizing
   * 
   * v6.1: Navigation support
   * - Alt+Wheel: Navigate to previous/next period
   * - Dispatches navigate event for parent handling
   * 
   * v7.1: Reactivity fix
   * - Use reactive derivation for all data from processedGroupedRecords
   * - Force UI updates via tick() when data changes
   * 
   * Structure:
   * 1. Time axis (left, sticky)
   * 2. Days header (day names + dates, sticky)
   * 3. AllDay Section (all-day and multi-day events)
   * 4. Timeline content (timed events) - SCROLLABLE
   */
  
  const dispatch = createEventDispatcher<{
    navigate: 'prev' | 'next';
    scrollToHour: number;
  }>();
  
  export let days: dayjs.Dayjs[] = []; // Array of days to display
  export let processedGroupedRecords: Record<string, ProcessedRecord[]> = {};
  export let dataVersion: number = 0; // Force reactivity on data changes
  export let startHour: number = 0;  // Full day start (always 0 for scroll)
  export let endHour: number = 24;   // Full day end (always 24 for scroll)
  export let timeFormat: string = '24h';
  export let timezone: string = 'local';
  export let showCurrentTimeLine: boolean = true;
  export let fixedAllDayHeight: number | undefined = undefined; // v3.0.3: Sync with shared axis
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  /** Callback when user wants to add a record. Receives date and optional time (HH:mm) */
  export let onRecordAdd: ((date: dayjs.Dayjs, startTime?: string) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) => void) | undefined;
  export let isMobile: boolean = false;
  export let now: dayjs.Dayjs | null = null;
  /** Hide time axis (used when shared axis is rendered externally) */
  export let hideTimeAxis: boolean = false;
  
  // v7.1: Track data version for reactivity - computed from actual data content
  // This fingerprint changes when any record is added, removed, or modified (including time changes)
  $: dataFingerprint = (() => {
    let fp = String(dataVersion) + ':';
    for (const dateStr of Object.keys(processedGroupedRecords).sort()) {
      const records = processedGroupedRecords[dateStr] || [];
      for (const r of records) {
        // Include record id, time info, and render type in fingerprint
        fp += r.record.id + '|';
        fp += (r.timeInfo?.startTime?.valueOf() ?? 0) + '|';
        fp += (r.timeInfo?.endTime?.valueOf() ?? 0) + '|';
        fp += r.renderType + '|';
      }
    }
    return fp;
  })();
  
  /**
   * v7.1: Derive timedRecordsByDay reactively
   * Creates new array references when data changes, forcing child re-render
   */
  $: timedRecordsByDay = (() => {
    dataFingerprint; // Force reactivity
    const result: Record<string, ProcessedRecord[]> = {};
    for (const day of days) {
      const dateStr = day.format('YYYY-MM-DD');
      result[dateStr] = processedGroupedRecords[dateStr] || [];
    }
    return result;
  })();
  
  /**
   * v7.2: Per-day fingerprint for DayColumn reactivity
   * Ensures each DayColumn re-renders when its specific data changes
   * Includes dataVersion to force re-computation on any data update
   */
  $: dayFingerprints = (() => {
    const result: Record<string, string> = {};
    for (const day of days) {
      const dateStr = day.format('YYYY-MM-DD');
      const records = timedRecordsByDay[dateStr] || [];
      let fp = dataVersion + ':' + records.length + ':';
      for (const r of records) {
        // Include all time-relevant data in fingerprint
        fp += r.record.id + '|';
        fp += (r.timeInfo?.startTime?.valueOf() ?? 0) + '|';
        fp += (r.timeInfo?.endTime?.valueOf() ?? 0) + '|';
      }
      result[dateStr] = fp;
    }
    return result;
  })();
  
  // Fixed height per hour for consistent scrolling
  // v7.0: Mobile-adaptive heights - reduced scale for better mobile viewing
  const HOUR_HEIGHT_DESKTOP = 3;
  const HOUR_HEIGHT_MOBILE = 2; // Smaller height on mobile for better fit
  const TOTAL_HOURS = 24;
  
  // Reactive hour height based on device
  $: HOUR_HEIGHT_REM = isMobile ? HOUR_HEIGHT_MOBILE : HOUR_HEIGHT_DESKTOP;
  $: TOTAL_HEIGHT_REM = TOTAL_HOURS * HOUR_HEIGHT_REM; // 48rem mobile, 72rem desktop
  
  // Default viewport: business hours (7:00-21:00)
  const DEFAULT_SCROLL_HOUR = 7;
  
  let scrollContainer: HTMLDivElement | null = null;
  let isDragging = false;
  let startY = 0;
  let startScrollTop = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  
  // Constants for AllDay section sizing
  // IMPORTANT: Must match values in AllDayEventStrip and MultiDayEventStrip
  // v7.0: Responsive strip height
  const STRIP_HEIGHT_DESKTOP = 1.25;
  const STRIP_HEIGHT_MOBILE = 1.125;
  const STRIP_GAP_REM = 0.125;      // Gap between rows
  
  $: STRIP_HEIGHT_REM = isMobile ? STRIP_HEIGHT_MOBILE : STRIP_HEIGHT_DESKTOP;
  
  const MIN_ALLDAY_HEIGHT_REM = 0;  // Minimum height when no events
  // v6.4: Removed MAX cap - height is controlled globally by fixedAllDayHeight
  // v6.7: Unified STRIP_HEIGHT_REM=1.25 across all components to prevent overlap
  
  // Declare variables for reactive statements
  let maxLane: number;
  let hasAllDayEvents: boolean;
  
  /**
   * v7.1: Derive headerEventsByDay reactively
   * This creates a new object reference when data changes, forcing re-render
   */
  $: headerEventsByDay = (() => {
    // Touch dataFingerprint to force reactivity
    dataFingerprint;
    const result: Record<string, ProcessedRecord[]> = {};
    for (const day of days) {
      const dateStr = day.format('YYYY-MM-DD');
      const records = processedGroupedRecords[dateStr] || [];
      result[dateStr] = records.filter(r =>
        r.renderType === EventRenderType.ALL_DAY ||
        r.renderType === EventRenderType.MULTI_DAY_ALLDAY ||
        r.renderType === EventRenderType.MULTI_DAY_TIMED
      );
    }
    return result;
  })();
  
  /**
   * v7.1: Derive maxLane reactively from headerEventsByDay
   */
  $: {
    dataFingerprint; // Force reactivity on data changes
    let max = -1;
    for (const dateStr in headerEventsByDay) {
      const events = headerEventsByDay[dateStr] || [];
      for (const event of events) {
        if (event.lane !== undefined && event.lane > max) {
          max = event.lane;
        }
      }
    }
    maxLane = max;
  }
  
  $: localHeight = maxLane >= 0 
    ? (maxLane + 1) * STRIP_HEIGHT_REM + maxLane * STRIP_GAP_REM
    : MIN_ALLDAY_HEIGHT_REM;
  // Use fixedAllDayHeight for global sync, fallback to local calculation
  $: allDaySectionHeight = fixedAllDayHeight !== undefined && fixedAllDayHeight > 0
    ? fixedAllDayHeight
    : localHeight;
  // v7.1: Use headerEventsByDay for reactivity (already depends on dataFingerprint)
  $: hasAllDayEvents = maxLane >= 0 && 
    Object.values(headerEventsByDay).some(events => events && events.length > 0);
  // Show section if we have events locally OR globally (fixedAllDayHeight > 0)
  $: showAllDaySection = hasAllDayEvents || (fixedAllDayHeight !== undefined && fixedAllDayHeight > 0);
  
  /**
   * Check if event is first/last day of multi-day span
   */
  function isFirstDayOfSpan(event: ProcessedRecord, day: dayjs.Dayjs): boolean {
    if (!event.spanInfo) return true;
    return event.spanInfo.startDate.isSame(day, 'day');
  }
  
  function isLastDayOfSpan(event: ProcessedRecord, day: dayjs.Dayjs): boolean {
    if (!event.spanInfo) return true;
    return event.spanInfo.endDate.isSame(day, 'day');
  }
  
  /**
   * Get event title from record
   * Uses cleanWikiLink to handle [[path|name]] format
   * Uses getDisplayName for consistent display across all views
   */
  function getEventTitle(record: DataRecord): string {
    // Priority: name > title > displayName from id
    const name = record.values['name'] as string | undefined;
    const title = record.values['title'] as string | undefined;
    
    if (name && name.trim()) return cleanWikiLink(name);
    if (title && title.trim()) return cleanWikiLink(title);
    
    // Fallback: extract display name from record ID (file path)
    return getDisplayName(record.id) || 'Untitled';
  }
  
  /**
   * Handle click on all-day event with Ctrl+click support
   */
  function handleAllDayEventClick(recordId: string, newLeaf: boolean = false) {
    // Find the record in grouped records
    for (const dateStr in processedGroupedRecords) {
      const records = processedGroupedRecords[dateStr];
      if (!records) continue;
      const found = records.find(r => r.record.id === recordId);
      if (found) {
        if (newLeaf) {
          // Ctrl+click: open in new window
          $app.workspace.openLinkText(found.record.id, found.record.id, true);
        } else if (onRecordClick) {
          // Normal click
          onRecordClick(found.record);
        }
        return;
      }
    }
  }

  // Mobile: Detect tap on day column
  // Extracts DataRecord[] from ProcessedRecord[] for backwards compatibility
  function handleDayTap(day: dayjs.Dayjs) {
    if (isMobile && onDayTap) {
      const processed = processedGroupedRecords[day.format('YYYY-MM-DD')] || [];
      const records = processed.map(p => p.record);
      onDayTap(day, records);
    }
  }
  
  // Desktop: Drag-to-scroll
  function handleMouseDown(e: MouseEvent) {
    if (isMobile || !scrollContainer) return;
    isDragging = true;
    startY = e.clientY;
    startScrollTop = scrollContainer.scrollTop;
    scrollContainer.style.cursor = 'grabbing';
    scrollContainer.style.userSelect = 'none';
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !scrollContainer) return;
    e.preventDefault();
    const deltaY = e.clientY - startY;
    scrollContainer.scrollTop = startScrollTop - deltaY;
  }
  
  function handleMouseUp() {
    if (!scrollContainer) return;
    isDragging = false;
    scrollContainer.style.cursor = 'grab';
    scrollContainer.style.userSelect = '';
  }
  
  // Mobile: Touch gestures with momentum
  function handleTouchStart(e: TouchEvent) {
    if (!scrollContainer || !e.touches[0]) return;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }
  
  function handleTouchMove(e: TouchEvent) {
    if (!scrollContainer) return;
    // Allow native scrolling
  }
  
  function handleTouchEnd(e: TouchEvent) {
    if (!scrollContainer || !e.changedTouches[0]) return;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    const deltaY = touchStartY - touchEndY;
    const deltaTime = touchEndTime - touchStartTime;
    
    // Detect swipe (fast vertical movement)
    if (Math.abs(deltaY) > 50 && deltaTime < 300) {
      const velocity = deltaY / deltaTime;
      const momentum = velocity * 200; // Momentum scroll distance
      
      scrollContainer.scrollTo({
        top: scrollContainer.scrollTop + momentum,
        behavior: 'smooth'
      });
    }
  }
  
  /**
   * Handle wheel events with Alt modifier for horizontal navigation
   * Normal wheel: vertical time scroll
   * Alt+wheel: navigate to prev/next period
   */
  function handleWheel(e: WheelEvent) {
    // Alt+Wheel: Navigate between periods
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.deltaY > 0 || e.deltaX > 0) {
        dispatch('navigate', 'next');
      } else if (e.deltaY < 0 || e.deltaX < 0) {
        dispatch('navigate', 'prev');
      }
      return;
    }
    
    // Shift+Wheel: Also treat as horizontal navigation (for mice without Alt)
    if (e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.deltaY > 0) {
        dispatch('navigate', 'next');
      } else {
        dispatch('navigate', 'prev');
      }
      return;
    }
    
    // Normal wheel: let default vertical scroll happen
  }
  
  /**
   * Scroll to a specific hour (for initial positioning)
   */
  function scrollToHour(hour: number) {
    if (!scrollContainer) return;
    const targetScroll = hour * HOUR_HEIGHT_REM * 16; // Convert rem to px (assuming 16px base)
    scrollContainer.scrollTop = targetScroll;
  }
  
  onMount(() => {
    if (!scrollContainer) return;
    
    // Desktop drag-to-scroll
    scrollContainer.addEventListener('mousedown', handleMouseDown);
    activeDocument.addEventListener('mousemove', handleMouseMove);
    activeDocument.addEventListener('mouseup', handleMouseUp);
    
    // Wheel events for navigation (Alt+wheel)
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
    
    // Mobile touch gestures
    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: true });
    scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Initial scroll to business hours (7:00)
    // Using requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      scrollToHour(DEFAULT_SCROLL_HOUR);
    });
  });
  
  onDestroy(() => {
    if (!scrollContainer) return;
    scrollContainer.removeEventListener('mousedown', handleMouseDown);
    activeDocument.removeEventListener('mousemove', handleMouseMove);
    activeDocument.removeEventListener('mouseup', handleMouseUp);
    scrollContainer.removeEventListener('wheel', handleWheel);
    scrollContainer.removeEventListener('touchstart', handleTouchStart);
    scrollContainer.removeEventListener('touchmove', handleTouchMove);
    scrollContainer.removeEventListener('touchend', handleTouchEnd);
  });
  
  // Highlight current day
  function isToday(day: dayjs.Dayjs): boolean {
    return now ? day.isSame(now, 'day') : false;
  }
</script>

<div class="projects-calendar-timeline-view" class:mobile={isMobile} class:no-axis={hideTimeAxis}>
  <!-- Left: Vertical time axis (shared for all days) -->
  {#if !hideTimeAxis}
  <div class="projects-calendar-timeline-axis">
    <div 
      class="projects-calendar-timeline-axis-header"
      style:height="calc(3.75rem + {showAllDaySection ? allDaySectionHeight : 0}rem)"
    >
      <!-- Empty space above timeline for header + allday section -->
      {#if showAllDaySection}
        <div class="projects-calendar-allday-axis-label">
          All day
        </div>
      {/if}
    </div>
    <EventTimeline 
      {startHour} 
      {endHour} 
      timeFormat={timeFormat === '12h' ? '12h' : '24h'}
      userTimezone={timezone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : timezone}
      hourHeightRem={HOUR_HEIGHT_REM}
    />
  </div>
  {/if}
  
  <!-- Right: Day columns -->
  <div class="projects-calendar-timeline-days">
    <!-- v6.4: AllDay Section with GLOBAL height synchronization -->
    {#if showAllDaySection}
      <div 
        class="projects-calendar-allday-section"
        style:height="{allDaySectionHeight}rem"
      >
        <div class="projects-calendar-allday-columns">
          {#each days as day}
            {@const dateStr = day.format('YYYY-MM-DD')}
            {@const dayEvents = headerEventsByDay[dateStr] || []}
            <div class="projects-calendar-allday-column" class:today={isToday(day)}>
              {#each dayEvents as event (event.record.id + dateStr)}
                <!-- v8.1: Ensure lane is defined, default to 0 if undefined -->
                {@const safeLane = event.lane ?? 0}
                {#if event.renderType === EventRenderType.ALL_DAY}
                  <AllDayEventStrip
                    title={getEventTitle(event.record)}
                    color={event.color ?? 'var(--text-accent)'}
                    recordId={event.record.id}
                    rowIndex={safeLane}
                    onClick={handleAllDayEventClick}
                    {isMobile}
                  />
                {:else}
                  <MultiDayEventStrip
                    title={getEventTitle(event.record)}
                    color={event.color ?? 'var(--text-accent)'}
                    rowIndex={safeLane}
                    isFirstDay={isFirstDayOfSpan(event, day)}
                    isLastDay={isLastDayOfSpan(event, day)}
                    onClick={(newLeaf) => handleAllDayEventClick(event.record.id, newLeaf)}
                    {isMobile}
                  />
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Header row with day names (below AllDay section) -->
    <div class="projects-calendar-timeline-days-header" class:sticky-mobile={isMobile}>
      {#each days as day}
        <div 
          class="projects-calendar-day-header" 
          class:today={isToday(day)}
          class:weekend={day.day() === 0 || day.day() === 6}
        >
          <div class="projects-calendar-day-name">
            {day.format('ddd')}
          </div>
          <div class="projects-calendar-day-date">
            {day.format('D')}
          </div>
        </div>
      {/each}
    </div>
    
    <!-- Content area with event bars - Scrollable 24h container -->
    <div 
      class="projects-calendar-timeline-content" 
      class:draggable={!isMobile}
      bind:this={scrollContainer}
      style:--hour-height="{HOUR_HEIGHT_REM}rem"
      style:--total-height="{TOTAL_HEIGHT_REM}rem"
    >
      <div class="projects-calendar-timeline-inner" style:height="{TOTAL_HEIGHT_REM}rem">
        {#each days as day (day.format('YYYY-MM-DD') + '|' + dayFingerprints[day.format('YYYY-MM-DD')])}
          {@const dayDateStr = day.format('YYYY-MM-DD')}
          <DayColumn
            {day}
            processedRecords={timedRecordsByDay[dayDateStr] || []}
            {startHour}
            {endHour}
            {timezone}
            {onRecordClick}
            onRecordAdd={onRecordAdd ? (d, time) => onRecordAdd(d, time) : undefined}
            onDayTap={isMobile ? () => handleDayTap(day) : undefined}
            {isMobile}
            isToday={isToday(day)}
            hourHeightRem={HOUR_HEIGHT_REM}
          />
        {/each}
        
        <!-- Current time line (overlay) -->
        {#if showCurrentTimeLine && now}
          <CurrentTimeLine
            startHour={0}
            endHour={24}
            userTimezone={timezone}
            hourHeightRem={HOUR_HEIGHT_REM}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .projects-calendar-timeline-view {
    display: flex;
    height: 100%;
    background: var(--background-primary);
    position: relative;
    /* v6.2: Single scroll container architecture - remove internal scrolling */
    overflow: visible;
  }
  
  .projects-calendar-timeline-view.mobile {
    /* Mobile optimizations */
    touch-action: pan-y pan-x;
  }
  
  .projects-calendar-timeline-view.no-axis {
    /* When time axis is hidden, timeline takes full width */
    flex: 1;
  }
  
  .projects-calendar-timeline-view.no-axis .projects-calendar-timeline-days {
    /* Ensure full width when no axis */
    width: 100%;
  }
  
  .projects-calendar-timeline-axis {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-right: 2px solid var(--background-modifier-border);
    z-index: 10;
    background: var(--background-primary);
    /* v6.2: Sticky axis that follows vertical scroll */
    position: sticky;
    left: 0;
    height: fit-content;
  }
  
  .projects-calendar-timeline-axis-header {
    height: 3.75rem;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    /* Sticky header within axis */
    position: sticky;
    top: 0;
    background: var(--background-primary);
    z-index: 11;
  }
  
  .projects-calendar-timeline-days {
    display: flex;
    flex-direction: column;
    flex: 1;
    /* v6.2: No internal scrolling - handled by parent */
    overflow: visible;
    min-height: 0;
  }
  
  .projects-calendar-timeline-days-header {
    display: flex;
    height: 3.75rem;
    border-bottom: 2px solid var(--background-modifier-border);
    flex-shrink: 0;
    background: var(--background-primary);
    z-index: 1;
    /* v6.5: NOT sticky - scrolls with content to sync with time axis header */
  }
  
  .projects-calendar-timeline-days-header.sticky-mobile {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .projects-calendar-day-header {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    border-right: 1px solid var(--background-modifier-border);
    padding: 0.5rem;
    transition: background-color 0.2s ease;
  }
  
  .projects-calendar-day-header:last-child {
    border-right: none;
  }
  
  .projects-calendar-day-header.today {
    background: var(--background-modifier-hover);
    border-bottom: 3px solid var(--text-accent);
    animation: today-header-pulse 2s ease-out 1;
  }
  
  /* Today header pulse animation for visibility */
  @keyframes today-header-pulse {
    0% {
      box-shadow: 0 0 0 0 hsla(var(--interactive-accent-hsl), 0.5);
    }
    50% {
      box-shadow: 0 0 0 0.5rem hsla(var(--interactive-accent-hsl), 0);
    }
    100% {
      box-shadow: 0 0 0 0 hsla(var(--interactive-accent-hsl), 0);
    }
  }
  
  .projects-calendar-day-header.weekend {
    background: var(--background-secondary);
  }
  
  .projects-calendar-day-name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
  }
  
  .projects-calendar-day-header.today .projects-calendar-day-name {
    color: var(--text-accent);
  }
  
  .projects-calendar-day-date {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-normal);
  }
  
  .projects-calendar-day-header.today .projects-calendar-day-date {
    color: var(--text-accent);
    background: var(--text-accent);
    color: var(--text-on-accent);
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .projects-calendar-timeline-content {
    display: flex;
    flex: 1;
    position: relative;
    /* v6.2: No internal scrolling - full height display */
    overflow: visible;
    min-height: var(--total-height, 72rem);
  }
  
  .projects-calendar-timeline-inner {
    display: flex;
    position: relative;
    width: 100%;
    /* Height set via inline style from TOTAL_HEIGHT_REM */
    min-height: var(--total-height, 72rem);
  }
  
  .projects-calendar-timeline-content.draggable {
    cursor: default;
  }
  
  /* AllDay Section */
  .projects-calendar-allday-section {
    display: flex;
    border-bottom: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    min-height: 0;
    /* v7.5: Use overflow: hidden to prevent strips from escaping container on mobile */
    /* Height is still controlled by fixedAllDayHeight via inline style */
    overflow: hidden;
    flex-shrink: 0;
    /* v6.4: Non-sticky positioning to prevent timeline overlap */
    position: relative;
    z-index: 2;
  }
  
  .projects-calendar-allday-columns {
    display: flex;
    flex: 1;
    /* v7.5: Ensure columns respect parent container bounds */
    overflow: hidden;
  }
  
  .projects-calendar-allday-column {
    flex: 1;
    position: relative;
    border-right: 1px solid var(--background-modifier-border);
    min-height: 100%;
    /* v7.5: Clip event strips that might overflow on mobile */
    overflow: hidden;
  }
  
  .projects-calendar-allday-column:last-child {
    border-right: none;
  }
  
  .projects-calendar-allday-column.today {
    background: var(--background-modifier-hover);
  }
  
  .projects-calendar-allday-axis-label {
    position: absolute;
    bottom: 0.25rem;
    left: 0;
    right: 0;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    text-align: center;
  }

  /* Mobile adaptivity */
  @media (max-width: 48rem) {
    .projects-calendar-timeline-axis {
      /* Narrower axis on mobile */
      width: 3.125rem;
    }
    
    .projects-calendar-day-header {
      min-width: 3.75rem;
      padding: 0.25rem;
    }
    
    .projects-calendar-day-name {
      font-size: 0.625rem;
    }
    
    .projects-calendar-day-date {
      font-size: 1rem;
    }
    
    .projects-calendar-day-header.today .projects-calendar-day-date {
      width: 1.75rem;
      height: 1.75rem;
    }
    
    .projects-calendar-allday-axis-label {
      font-size: 0.5rem;
    }
  }
  
  /* v6.2: No internal scrollbar - handled by parent container */
</style>

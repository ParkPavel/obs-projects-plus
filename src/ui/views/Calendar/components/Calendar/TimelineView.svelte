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
  import { getScrollBehavior } from 'src/lib/helpers/animation';
  import DragOverlay from '../../dnd/DragOverlay.svelte';
  import { TimelineDragManager, type OnDragCommit } from '../../dnd/TimelineDragManager';

  // v3.2.5: Svelte action to portal element to document.body,
  // escaping all overflow:hidden / transform containing-block ancestors
  function portalToBody(node: HTMLElement) {
    activeDocument.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      },
    };
  }

  
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
  /** v3.2.0 DnD: Callback for record date/time change from drag operations */
  export let onRecordChange: OnDragCommit | undefined = undefined;
  /** v3.2.2: Horizontal scroll container for cross-week auto-scroll */
  export let horizontalScrollContainer: HTMLElement | null = null;
  
  // v9.1: Use dataVersion directly for reactivity instead of expensive fingerprint.
  // The previous dataFingerprint iterated ALL processedGroupedRecords keys (365+ for year-spanning events)
  // and built a huge concatenated string. dataVersion already increments on every data change.
  
  /**
   * v7.1: Derive timedRecordsByDay reactively
   * Creates new array references when data changes, forcing child re-render
   */
  $: timedRecordsByDay = (() => {
    void dataVersion; // Force reactivity via dataVersion
    const result: Record<string, ProcessedRecord[]> = {};
    for (const day of days) {
      const dateStr = day.format('YYYY-MM-DD');
      result[dateStr] = processedGroupedRecords[dateStr] || [];
    }
    return result;
  })();
  
  // v10.1: dayFingerprints REMOVED — was O(7×N) string build per period, ×5 periods.
  // DayColumn reactivity now relies on processedRecords reference change (via timedRecordsByDay)
  // and dataVersion tracking. No more destroy+recreate DayColumns on every data change.
  
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
    void dataVersion; // Force reactivity
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
    void dataVersion; // Force reactivity on data changes
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
  // v7.1: Use headerEventsByDay for reactivity (depends on dataVersion)
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
   * Handle click on all-day event with modifier key support
   * v3.0.8: Shift → new window, Ctrl → new tab, else → modal
   */
  function handleAllDayEventClick(recordId: string, openMode: false | 'tab' | 'window' = false) {
    // Find the record in grouped records
    for (const dateStr in processedGroupedRecords) {
      const records = processedGroupedRecords[dateStr];
      if (!records) continue;
      const found = records.find(r => r.record.id === recordId);
      if (found) {
        if (openMode) {
          // Ctrl/Shift+click: open in tab or window
          $app.workspace.openLinkText(found.record.id, found.record.id, openMode);
        } else if (onRecordClick) {
          // Normal click → modal
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
        behavior: getScrollBehavior()
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
  /** Cached root font size — computed once, used in scroll and DnD calculations */
  const rootFontSize = typeof document !== 'undefined'
    ? (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
    : 16;

  function scrollToHour(hour: number) {
    if (!scrollContainer) return;
    const targetScroll = hour * HOUR_HEIGHT_REM * rootFontSize;
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

  // ── v3.2.0 DnD: TimelineDragManager ──────────────────────────────────────
  const dragManager = new TimelineDragManager();
  let dayColumnElements: HTMLElement[] = [];
  let draggingRecordId: string | null = null;
  let dndTargetDayIndex: number = -1;
  let stripGhost: import('../../dnd/types').StripGhostPosition | null = null;
  let stripEdgeLabel: string | null = null;
  /** v3.2.9: Timed ghost for portal rendering on cross-period drag */
  let timedGhost: import('../../dnd/types').GhostPosition | null = null;
  let timedDragState: import('../../dnd/types').DragState = 'idle';

  // Subscribe to dragRecordId store for reactive CSS
  const unsubDragId = dragManager.dragRecordId.subscribe(id => {
    draggingRecordId = id;
  });

  // v3.2.0 Iteration 2: Subscribe to targetDayIndex for column highlight
  const unsubTargetDay = dragManager.targetDayIndex.subscribe(idx => {
    dndTargetDayIndex = idx;
  });

  // v3.2.1: Subscribe to stripGhostPosition for allday section ghost overlay
  const unsubStripGhost = dragManager.stripGhostPosition.subscribe(pos => {
    stripGhost = pos;
  });

  // v3.2.5: Subscribe to edgeDateLabel for cross-period strip drag badge
  const unsubStripEdge = dragManager.edgeDateLabel.subscribe(label => {
    stripEdgeLabel = label;
  });

  // v3.2.9: Subscribe to ghostPosition for cross-period portal rendering
  const unsubTimedGhost = dragManager.ghostPosition.subscribe(pos => {
    timedGhost = pos;
  });
  const unsubTimedState = dragManager.state.subscribe(s => {
    timedDragState = s;
  });
  /** v3.3.4: Snap time label for portal ghost rendering */
  let timedSnapLabel: string | null = null;
  const unsubTimedSnap = dragManager.snapTimeLabel.subscribe(label => {
    timedSnapLabel = label;
  });
  /** v3.3.4: Edge date label for cross-period portal ghost */
  let timedEdgeLabel: string | null = null;
  const unsubTimedEdge = dragManager.edgeDateLabel.subscribe(label => {
    timedEdgeLabel = label;
  });
  /** v4.0.2: Active drag mode for portal ghost handle highlighting */
  let timedActiveMode: import('../../dnd/types').DragMode | null = null;
  const unsubTimedMode = dragManager.activeMode.subscribe(m => {
    timedActiveMode = m;
  });

  // Configure DragManager when props change
  $: if (onRecordChange) {
    dragManager.configure(
      { startHour, endHour, hourHeightRem: HOUR_HEIGHT_REM, remPx: rootFontSize, isMobile },
      onRecordChange
    );
  }

  // v3.3.4: Wire ACTUAL scrollable ancestor for vertical auto-scroll.
  // scrollContainer (.projects-calendar-timeline-content) has overflow:visible —
  // the real scroller is the IHC wrapper ancestor with overflow-y:auto.
  // v4.0.1: Also check scrollHeight > clientHeight to skip elements where
  // computed overflow-y is 'auto' due to CSS spec (visible + non-visible axis → auto)
  // but that don't actually scroll (e.g. .infinite-horizontal-calendar with align-self:flex-start).
  $: if (scrollContainer && onRecordChange) {
    let verticalScroller: HTMLElement | null = scrollContainer;
    while (verticalScroller) {
      const style = window.getComputedStyle(verticalScroller);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          verticalScroller.scrollHeight > verticalScroller.clientHeight + 1) break;
      verticalScroller = verticalScroller.parentElement;
    }
    dragManager.setScrollContainer(verticalScroller ?? scrollContainer);
  }

  // v3.2.2: Wire horizontal scroll container for cross-week auto-scroll
  $: if (horizontalScrollContainer && onRecordChange) {
    dragManager.setHorizontalScrollContainer(horizontalScrollContainer);
  }

  // Register day columns for cross-day detection after each render
  $: if (dayColumnElements.length > 0 && days.length > 0) {
    const columnRefs = days.map((day, i) => ({
      day,
      element: dayColumnElements[i] as HTMLElement,
    })).filter(ref => ref.element);
    dragManager.setDayColumns(columnRefs);
  }

  onDestroy(() => {
    unsubDragId();
    unsubTargetDay();
    unsubStripGhost();
    unsubStripEdge();
    unsubTimedGhost();
    unsubTimedState();
    unsubTimedSnap();
    unsubTimedEdge();
    unsubTimedMode();
    dragManager.destroy();
  });
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
        <div class="projects-calendar-allday-columns" style:--col-count={days.length}>
          {#each days as day}
            {@const dateStr = day.format('YYYY-MM-DD')}
            {@const dayEvents = headerEventsByDay[dateStr] || []}
            <div class="projects-calendar-allday-column" class:today={isToday(day)} data-date={dateStr}>
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
                    dragManager={onRecordChange ? dragManager : undefined}
                    processedRecord={event}
                    isDragging={draggingRecordId === event.record.id}
                    canResize={days.length > 1}
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
                    dragManager={onRecordChange ? dragManager : undefined}
                    processedRecord={event}
                    isDragging={draggingRecordId === event.record.id}
                    canResize={days.length > 1}
                  />
                {/if}
              {/each}
            </div>
          {/each}
        </div>
        <!-- v3.2.1 DnD: Strip ghost overlay for allday section -->
        {#if stripGhost && !stripGhost.viewportRect}
          {@const colCount = days.length || 7}
          {@const ghostLeft = (stripGhost.startDayIndex / colCount) * 100}
          {@const ghostWidth = ((stripGhost.endDayIndex - stripGhost.startDayIndex + 1) / colCount) * 100}
          <div
            class="allday-strip-ghost"
            style="left: {ghostLeft}%; width: {ghostWidth}%;"
            aria-hidden="true"
          >
            {#if stripGhost.title}
              <span class="allday-strip-ghost-title">{stripGhost.title}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Header row with day names (below AllDay section) -->
    <div class="projects-calendar-timeline-days-header" class:sticky-mobile={isMobile}>
      {#each days as day}
        <div 
          class="projects-calendar-day-header" 
          class:today={isToday(day)}
          class:weekend={day.day() === 0 || day.day() === 6}
          data-date={day.format('YYYY-MM-DD')}
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
        {#each days as day, dayIndex (day.format('YYYY-MM-DD'))}
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
            dragManager={onRecordChange ? dragManager : undefined}
            {draggingRecordId}
            isDragTarget={draggingRecordId !== null && dndTargetDayIndex === dayIndex}
            bind:columnElement={dayColumnElements[dayIndex]}
          />
        {/each}
        
        <!-- v3.2.0 DnD: Ghost overlay -->
        {#if onRecordChange}
          <DragOverlay
            state={dragManager.state}
            ghostPosition={dragManager.ghostPosition}
            snapTimeLabel={dragManager.snapTimeLabel}
            edgeDateLabel={dragManager.edgeDateLabel}
            activeMode={dragManager.activeMode}
            {dayColumnElements}
          />
        {/if}
        
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

<!-- v3.2.5: Portal ghost for cross-period strip drag — rendered on document.body
     to escape all overflow:hidden / transform containing-block ancestors -->
{#if stripGhost?.viewportRect}
  {@const vr = stripGhost.viewportRect}
  <div
    use:portalToBody
    class="ppp-strip-ghost-portal"
    style="position:fixed; top:{vr.top}px; left:{vr.left}px; width:{vr.width}px; height:{vr.height}px; pointer-events:none; z-index:9999; border-radius:4px; background:color-mix(in srgb, var(--interactive-accent) 18%, var(--background-primary)); border:1.5px solid color-mix(in srgb, var(--interactive-accent) 50%, transparent); box-shadow:0 4px 12px rgba(0,0,0,0.12);"
    aria-hidden="true"
  >
    {#if stripGhost.title}
      <span
        style="position:absolute; left:0.375rem; top:50%; transform:translateY(-50%); font-size:0.6875rem; font-weight:500; color:var(--text-normal); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 0.75rem);"
      >{stripGhost.title}</span>
    {/if}
    {#if stripEdgeLabel}
      <span
        style="position:absolute; top:-1.5rem; right:0; background:var(--text-accent); color:var(--text-on-accent); font-size:0.6875rem; font-weight:600; padding:0.125rem 0.5rem; border-radius:4px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.2);"
      >{stripEdgeLabel}</span>
    {/if}
  </div>
{/if}

<!-- v3.2.9: Portal ghost for cross-period TIMED event drag -->
{#if timedDragState === 'dragging' && timedGhost?.viewportRect}
  {@const vr = timedGhost.viewportRect}
  <div
    use:portalToBody
    class="ppp-timed-ghost-portal"
    style="position:fixed; top:{vr.top}px; left:{vr.left}px; width:{vr.width}px; height:{vr.height}px; pointer-events:none; z-index:9999; border-left:3px solid var(--text-accent); border-radius:0.25rem; background:color-mix(in srgb, var(--text-accent) 20%, var(--background-primary)); opacity:0.85; box-shadow:0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px color-mix(in srgb, var(--text-accent) 20%, transparent); box-sizing:border-box; padding:0.125rem 0.375rem; overflow:hidden;"
    aria-hidden="true"
  >
    <!-- v4.0.2: Resize handle indicators on portal ghost -->
    <div style="position:absolute; top:0; left:0; width:0; height:0; border-top:{timedActiveMode === 'resize-top' ? '0.75rem' : '0.5rem'} solid var(--text-accent); border-right:{timedActiveMode === 'resize-top' ? '0.75rem' : '0.5rem'} solid transparent; opacity:{timedActiveMode === 'resize-top' ? 1 : 0.6};"></div>
    {#if timedGhost.title}
      <div style="font-size:0.75rem; font-weight:500; color:var(--text-normal); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{timedGhost.title}</div>
    {/if}
    <div style="font-size:var(--font-ui-smaller); color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">{timedGhost.time} – {timedGhost.endTime}</div>
    <div style="position:absolute; bottom:0; right:0; width:0; height:0; border-bottom:{timedActiveMode === 'resize-bottom' ? '0.75rem' : '0.5rem'} solid var(--text-accent); border-left:{timedActiveMode === 'resize-bottom' ? '0.75rem' : '0.5rem'} solid transparent; opacity:{timedActiveMode === 'resize-bottom' ? 1 : 0.6};"></div>
    <!-- v3.3.4: Snap time label for cross-period ghost -->
    {#if timedSnapLabel}
      <div style="position:absolute; top:-1.25rem; left:0; font-size:var(--font-ui-smaller); font-weight:600; color:var(--text-accent); background:var(--background-primary); padding:0 0.25rem; border-radius:0.125rem; white-space:nowrap;">{timedSnapLabel}</div>
    {/if}
    <!-- v3.3.4: Edge date label for cross-period ghost -->
    {#if timedEdgeLabel}
      <div style="position:absolute; top:-1.25rem; right:0; background:var(--text-accent); color:var(--text-on-accent); font-size:var(--font-ui-smaller); font-weight:600; padding:0.125rem 0.5rem; border-radius:0.25rem; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.2);">{timedEdgeLabel}</div>
    {/if}
  </div>
  <!-- v3.3.4: Snap line across the viewport at ghost top -->
  <div
    use:portalToBody
    style="position:fixed; top:{vr.top}px; left:{vr.left}px; width:{vr.width}px; height:1px; background:var(--text-accent); opacity:0.5; pointer-events:none; z-index:9998;"
    aria-hidden="true"
  ></div>
{/if}

<style>
  .projects-calendar-timeline-view {
    display: flex;
    height: 100%;
    background: var(--background-primary);
    position: relative;
    /* v6.2: Single scroll container architecture - remove internal scrolling */
    overflow: visible;
    /* v3.2.7: Allow proper flex shrinking when agenda sidebar constrains width */
    min-width: 0;
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
    /* v3.2.7: Allow flex shrinking in parent layout */
    min-width: 0;
    /* v3.2.5: Right border for single-day/last-column edge visibility */
    border-right: 1px solid var(--background-modifier-border);
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
    /* v3.2.8: position: relative kept for the strip ghost overlay (position: absolute child) */
    position: relative;
    z-index: 2;
  }
  
  .projects-calendar-allday-columns {
    /* v4.0.4: Grid instead of flex — flex distributes fractional pixels
     * per-row based on each child's border/padding, causing cumulative
     * column drift that misaligns the percentage-based strip ghost. */
    display: grid;
    grid-template-columns: repeat(var(--col-count, 7), 1fr);
    flex: 1;
    /* v7.5: Ensure columns respect parent container bounds */
    overflow: hidden;
  }
  
  .projects-calendar-allday-column {
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

  /* v3.2.1 DnD: Strip ghost overlay in allday section */
  .allday-strip-ghost {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: var(--radius-s, 0.25rem);
    background: color-mix(in srgb, var(--interactive-accent) 18%, var(--background-primary));
    border: 1.5px solid color-mix(in srgb, var(--interactive-accent) 50%, transparent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    z-index: 10;
    /* v4.0.3: Removed transition — instant ghost feedback prevents perceived
     * stalling during strip-resize drags where independent left/width
     * animations fight each other. */
    display: flex;
    align-items: center;
    overflow: hidden;
  }

  .allday-strip-ghost-title {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 0.375rem;
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

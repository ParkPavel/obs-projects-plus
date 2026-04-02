<script lang="ts">
  /**
   * HeaderStripsSection.svelte - v3.2.0
   * 
   * Renders multi-day event strips and all-day events ABOVE the week row.
   * This section belongs to the DATES BELOW it, not above.
   * 
   * Architecture (CALENDAR_ARCHITECTURE.md):
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ HeaderStrips FOR Week 2 (события дней 5-11!)                   │ ← THIS COMPONENT
   * │   • Multi-day strips (по lanes)                                │
   * │   • All-day pills                                               │
   * └─────────────────────────────────────────────────────────────────┘
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ WeekRow: Ячейки с датами 5-11 (ТОЛЬКО timed bars!)             │ ← Week component below
   * └─────────────────────────────────────────────────────────────────┘
   */
  
  import dayjs from "dayjs";
  import { onDestroy, tick } from "svelte";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { EventRenderType, type ProcessedCalendarData, type ProcessedRecord } from "../../types";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import { TimelineDragManager, type DayColumnRef, type OnDragCommit } from "../../dnd/TimelineDragManager";
  import type { DragMode, StripGhostPosition } from "../../dnd/types";

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
  
  /** Array of 7 dates for this week row */
  export let weekDates: dayjs.Dayjs[];
  
  /** Processed calendar data with grouped records */
  export let processedData: ProcessedCalendarData | null = null;
  
  /** First day of week setting (0=Sun, 1=Mon, etc.) - determines strip column alignment */
  export let firstDayOfWeek: number = 1;
  // Consumed here so Svelte doesn't warn about unused export property.
  // Currently the column order is determined by weekDates (constructed from firstDayOfWeek
  // in the parent). This prop is kept writable for future locale-aware ARIA annotations.
  $: void firstDayOfWeek;
  
  /** Callback when event is clicked */
  export let onRecordClick: ((record: DataRecord) => void) | undefined;

  /** v3.2.0 DnD: Callback to commit record changes (strip move/resize) */
  export let onRecordChange: OnDragCommit | undefined = undefined;

  /** v3.2.0 DnD: Whether device is mobile (enables haptic + long-press DnD) */
  export let isMobile: boolean = false;

  /** v3.2.2: Horizontal scroll container for cross-week auto-scroll */
  export let horizontalScrollContainer: HTMLElement | null = null;

  // ── Local DnD state ──
  const dragManager = new TimelineDragManager();
  let draggingRecordId: string | null = null;
  let stripGhost: StripGhostPosition | null = null;
  /** v9.4: Long-press active — visual feedback for mobile drag initiation */
  let isLongPressActive = false;

  // Container element for collecting day column refs
  let sectionElement: HTMLElement | undefined;

  // Subscribe to dragRecordId for visual dimming
  const unsubDragId = dragManager.dragRecordId.subscribe((id) => {
    draggingRecordId = id;
  });

  // v3.2.1: Subscribe to stripGhostPosition for ghost overlay rendering
  const unsubStripGhost = dragManager.stripGhostPosition.subscribe((pos) => {
    stripGhost = pos;
  });

  // v3.2.4: Subscribe to edgeDateLabel for cross-week drag indicator
  let edgeLabel: string | null = null;
  const unsubEdgeLabel = dragManager.edgeDateLabel.subscribe((label) => {
    edgeLabel = label;
  });

  // v9.4: Subscribe to longPressActive for mobile drag visual feedback
  const unsubLongPress = dragManager.longPressActive.subscribe((active) => {
    isLongPressActive = active;
  });

  // Configure manager when onRecordChange is available
  $: if (onRecordChange) {
    dragManager.configure(
      { startHour: 0, endHour: 24, hourHeightRem: 0, isMobile },
      onRecordChange
    );
  }

  // v3.2.2: Wire horizontal scroll container for cross-week auto-scroll
  $: if (horizontalScrollContainer && onRecordChange) {
    dragManager.setHorizontalScrollContainer(horizontalScrollContainer);
  }

  /**
   * v3.2.1 DnD: Build DayColumnRef[] from the flex-grid.
   * Uses any lane's children (strip-segment + strip-empty) since all lanes
   * have identical flex: 1 1 0 children matching Day cell widths.
   * Falls back to direct .multiday-lane children if available.
   */
  function registerDayColumns(): void {
    if (!sectionElement) return;
    
    // Try any lane (all have identical flex children)
    const anyLane = sectionElement.querySelector('.multiday-lane');
    if (!anyLane) return;
    
    const children = Array.from(anyLane.children) as HTMLElement[];
    const refs: DayColumnRef[] = [];
    
    for (let i = 0; i < children.length && i < weekDates.length; i++) {
      const el = children[i];
      const date = weekDates[i];
      if (el && date) {
        refs.push({ day: date, element: el });
      }
    }
    
    dragManager.setDayColumns(refs);
  }

  // Re-register day columns when weekDates change (scrolling)
  $: if (weekDates && sectionElement) {
    // v3.2.5: Auto-detect vertical scroll container for DnD auto-scroll in month/2weeks
    dragManager.autoDetectScrollContainer(sectionElement);
    // Wait for Svelte DOM update before querying column rects
    void tick().then(registerDayColumns);
  }

  onDestroy(() => {
    unsubDragId();
    unsubStripGhost();
    unsubEdgeLabel();
    unsubLongPress();
    dragManager.destroy();
  });

  /**
   * v3.2.0 DnD: Find ProcessedRecord by record ID from processedData index
   */
  function findProcessedRecord(recordId: string): ProcessedRecord | undefined {
    return processedData?.index.get(recordId);
  }

  /**
   * v3.2.0 DnD: Determine drag mode from event target
   */
  function getDragMode(target: EventTarget | null): DragMode {
    if (target instanceof HTMLElement) {
      if (target.classList.contains('resize-handle-start')) return 'strip-resize-start';
      if (target.classList.contains('resize-handle-end')) return 'strip-resize-end';
    }
    return 'strip-move';
  }

  /**
   * v3.2.0 DnD: Handle mousedown on a strip segment
   */
  function handleSegmentMouseDown(event: MouseEvent, segment: MultiDaySegment, segmentEl: HTMLButtonElement): void {
    if (!onRecordChange) return;
    registerDayColumns();
    const pr = findProcessedRecord(segment.record.id);
    if (!pr) return;
    const mode = getDragMode(event.target);
    dragManager.initiate(segment.record, pr, event, mode, segmentEl);
  }

  /**
   * v3.2.0 DnD: Handle touchstart on a strip segment
   */
  function handleSegmentTouchStart(event: TouchEvent, segment: MultiDaySegment, segmentEl: HTMLButtonElement): void {
    if (!onRecordChange) return;
    registerDayColumns();
    const pr = findProcessedRecord(segment.record.id);
    if (!pr) return;
    const mode = getDragMode(event.target);
    dragManager.initiate(segment.record, pr, event, mode, segmentEl);
  }
  
  // Types for segment calculation
  interface MultiDaySegment {
    record: DataRecord;
    lane: number;
    isStart: boolean;
    isEnd: boolean;
    color: string | null;
    label: string;
  }
  
  interface LaneData {
    lane: number;
    segments: Map<string, MultiDaySegment>; // dateKey -> segment
  }
  
  /**
   * Get all multi-day and all-day events that span this week
   * v3.3.0: COMPLETE REWRITE - iterate ALL processed events and check span intersection
   * This fixes the bug where events starting after week start weren't showing continuation
   */
  function getEventsForWeek(
    dates: dayjs.Dayjs[],
    data: ProcessedCalendarData | null
  ): { multiDayByLane: LaneData[] } {
    const multiDayByLane: LaneData[] = [];
    
    if (!data || !data.processed || dates.length === 0) {
      return { multiDayByLane };
    }
    
    const weekStart = dates[0];
    const weekEnd = dates[dates.length - 1];
    
    // Track lanes we've seen
    const laneMap = new Map<number, Map<string, MultiDaySegment>>();
    const processedEvents = new Set<string>(); // Track by record ID to avoid duplicates
    
    // CRITICAL: Iterate ALL processed events, not just grouped by date
    for (const pr of data.processed) {
      // Only process multi-day and all-day events
      if (pr.renderType !== EventRenderType.MULTI_DAY_ALLDAY &&
          pr.renderType !== EventRenderType.MULTI_DAY_TIMED &&
          pr.renderType !== EventRenderType.ALL_DAY) {
        continue;
      }
      
      // Skip if already processed
      if (processedEvents.has(pr.record.id)) {
        continue;
      }
      
      // Get event's actual span
      const eventStart = pr.spanInfo?.startDate || pr.startDate;
      const eventEnd = pr.spanInfo?.endDate || pr.endDate;
      
      if (!eventStart) continue;
      
      const effectiveEnd = eventEnd || eventStart;
      
      // Check if event span intersects with this week
      // Event intersects if: eventStart <= weekEnd AND eventEnd >= weekStart
      const intersects = 
        (eventStart.isSame(weekEnd, 'day') || eventStart.isBefore(weekEnd, 'day')) &&
        (effectiveEnd.isSame(weekStart, 'day') || effectiveEnd.isAfter(weekStart, 'day'));
      
      if (!intersects) {
        continue;
      }
      
      processedEvents.add(pr.record.id);
      
      const lane = pr.lane ?? 0;
      const label = getDisplayName(pr.record.id) ?? pr.record.id;
      
      if (!laneMap.has(lane)) {
        laneMap.set(lane, new Map());
      }
      
      const laneSegments = laneMap.get(lane)!;
      
      // Create segments for ALL days this event spans within this week
      for (const weekDate of dates) {
        const isWithinSpan = 
          (weekDate.isSame(eventStart, 'day') || weekDate.isAfter(eventStart, 'day')) &&
          (weekDate.isSame(effectiveEnd, 'day') || weekDate.isBefore(effectiveEnd, 'day'));
        
        if (isWithinSpan) {
          const segmentDateKey = weekDate.format('YYYY-MM-DD');
          const isStart = eventStart.isSame(weekDate, 'day');
          const isEnd = effectiveEnd.isSame(weekDate, 'day');
          
          laneSegments.set(segmentDateKey, {
            record: pr.record,
            lane,
            isStart,
            isEnd,
            color: pr.color,
            label,
          });
        }
      }
    }
    
    // CRITICAL: Renumber lanes locally to remove gaps
    // If global lanes are [0, 2, 5], renumber to [0, 1, 2] for compact display
    const usedLanes = Array.from(laneMap.keys()).sort((a, b) => a - b);
    const compactLanes: LaneData[] = usedLanes.map((globalLane, localIndex) => ({
      lane: localIndex, // Renumbered for display
      segments: laneMap.get(globalLane)!
    }));
    
    return { multiDayByLane: compactLanes };
  }
  
  // Reactive: compute events for this week
  $: weekEvents = getEventsForWeek(weekDates, processedData);
  $: hasAnyEvents = weekEvents.multiDayByLane.length > 0;
  
  // Maximum lanes for calculating header height
  $: maxLane = weekEvents.multiDayByLane.length > 0 
    ? Math.max(...weekEvents.multiDayByLane.map(l => l.lane)) + 1 
    : 0;

  // Reverse so lane 0 is closest to date cells (bottom), higher lanes at top.
  $: allLanes = weekEvents.multiDayByLane.slice().reverse();
</script>

{#if hasAnyEvents}
  <div 
    class="header-strips-section"
    bind:this={sectionElement}
    style:--lane-count={maxLane}
    role="rowgroup"
    aria-label="Multi-day and all-day events"
  >
    <!-- v3.2.1 DnD: Strip ghost overlay showing target position during drag -->
    {#if stripGhost}
      {#if stripGhost.viewportRect}
        <!-- v3.2.5: Cross-period/cross-week ghost rendered via portal (see bottom of file) -->
      {:else}
        {@const colCount = weekDates.length || 7}
        {@const ghostLeft = (stripGhost.startDayIndex / colCount) * 100}
        {@const ghostWidth = ((stripGhost.endDayIndex - stripGhost.startDayIndex + 1) / colCount) * 100}
        <div
          class="strip-ghost-overlay"
          style="left: {ghostLeft}%; width: {ghostWidth}%;"
          aria-hidden="true"
        ></div>
      {/if}

      <!-- v3.2.4: Edge date label for cross-week strip drag (only inline; portal ghost has its own) -->
      {#if edgeLabel && !stripGhost.viewportRect}
        <div class="strip-edge-label" aria-hidden="true">
          <span class="strip-edge-label-text">{edgeLabel}</span>
        </div>
      {/if}
    {/if}

    <!-- Multi-day lanes: rendered bottom-to-top so lane 0 is visually closest to date cells -->
    {#each allLanes as laneData (laneData.lane)}
      <div class="multiday-lane" role="row">
        {#each weekDates as date, dayIdx (date.format('YYYY-MM-DD'))}
          {@const dateKey = date.format('YYYY-MM-DD')}
          {@const segment = laneData.segments.get(dateKey)}
          {@const isDropTarget = stripGhost != null && dayIdx >= stripGhost.startDayIndex && dayIdx <= stripGhost.endDayIndex}
          {#if segment}
            {@const isDragging = draggingRecordId === segment.record.id}
            <button
              class="strip-segment"
              class:is-start={segment.isStart}
              class:is-end={segment.isEnd}
              class:is-only={segment.isStart && segment.isEnd}
              class:is-mid={!segment.isStart && !segment.isEnd}
              class:dnd-grab={!!onRecordChange && !isDragging}
              class:dnd-dragging={isDragging}
              class:dnd-drop-target={isDropTarget && !isDragging}
              class:dnd-long-press={isLongPressActive && isDragging}
              data-date={date.format('YYYY-MM-DD')}
              type="button"
              style:--strip-color={segment.color ?? 'var(--interactive-accent)'}
              on:click={() => onRecordClick?.(segment.record)}
              on:mousedown={(e) => {
                const btn = e.currentTarget;
                if (btn instanceof HTMLButtonElement) handleSegmentMouseDown(e, segment, btn);
              }}
              on:touchstart|passive={(e) => {
                const btn = e.currentTarget;
                if (btn instanceof HTMLButtonElement) handleSegmentTouchStart(e, segment, btn);
              }}
              title={segment.label}
              aria-label={segment.label}
            >
              {#if segment.isStart || (segment.isStart && segment.isEnd)}
                <!-- v3.2.0 DnD: Resize handle on left edge (multi-day only, not single-day) -->
                {#if onRecordChange && !(segment.isStart && segment.isEnd)}
                  <div class="resize-handle-start" aria-hidden="true"></div>
                {/if}
                <span class="strip-dot"></span>
                <span class="strip-label">{segment.label}</span>
              {:else}
                <span class="strip-continuation"></span>
              {/if}
              {#if segment.isEnd && onRecordChange}
                <!-- v3.2.0 DnD: Resize handle on right edge (incl. single-day to allow extending) -->
                <div class="resize-handle-end" aria-hidden="true"></div>
              {/if}
            </button>
          {:else}
            <div class="strip-empty" class:dnd-drop-target={isDropTarget} data-date={date.format('YYYY-MM-DD')} aria-hidden="true"></div>
          {/if}
        {/each}
      </div>
    {/each}
  </div>
{/if}

<!-- v3.2.5: Portal ghost for cross-week strip drag in month/2weeks -->
{#if stripGhost?.viewportRect}
  {@const vr = stripGhost.viewportRect}
  <div
    use:portalToBody
    class="ppp-strip-ghost-portal"
    style="position:fixed; top:{vr.top}px; left:{vr.left}px; width:{vr.width}px; height:{vr.height}px; pointer-events:none; z-index:9999; border-radius:0.25rem; background:color-mix(in srgb, var(--interactive-accent) 30%, transparent); border:0.125rem solid var(--interactive-accent); box-shadow: 0 0.125rem 0.75rem rgba(0,0,0,0.15);"
    aria-hidden="true"
  >
    {#if stripGhost.title}
      <span
        style="position:absolute; left:0.375rem; top:50%; transform:translateY(-50%); font-size:0.6875rem; font-weight:500; color:var(--text-normal); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:calc(100% - 0.75rem);"
      >{stripGhost.title}</span>
    {/if}
    {#if edgeLabel}
      <span
        style="position:absolute; top:-1.5rem; right:0; background:var(--text-accent); color:var(--text-on-accent); font-size:0.6875rem; font-weight:600; padding:0.125rem 0.5rem; border-radius:0.25rem; white-space:nowrap; box-shadow:0 0.125rem 0.5rem rgba(0,0,0,0.2);"
      >{edgeLabel}</span>
    {/if}
  </div>
{/if}

<style>
  /* ═══════════════════════════════════════════════════════════════
     HEADER STRIPS SECTION
     Contains multi-day lanes + all-day row ABOVE the week dates
     v6.2: Fixed alignment with Day cells using consistent width calc
     v6.3: Added background isolation to prevent timeline overlap
     ═══════════════════════════════════════════════════════════════ */
  .header-strips-section {
    display: flex;
    flex-direction: column;
    border-bottom: 0.0625rem solid var(--background-modifier-border);
    background: var(--background-primary);
    /* Ensure section takes full width like Week component */
    width: 100%;
    /* Create isolated stacking context with backdrop */
    position: relative;
    z-index: 2;
    /* Ensure background blocks timeline content below */
    isolation: isolate;
    /* v3.2.4: Allow strip ghost to extend beyond section for cross-period drag */
    overflow: visible;
  }

  /* ═══════════════════════════════════════════════════════════════
     MULTI-DAY LANES
     Each lane contains strip segments across 7 days
     Using flex with equal width children to match Day cells
     v7.0: Converted to rem units + responsive heights
     ═══════════════════════════════════════════════════════════════ */
  .multiday-lane {
    /* v9.2: CSS Grid guarantees identical column tracks across ALL row types
     * (multiday-lane, calendar-week, calendar-week-header). Flex distributes
     * fractional pixels independently per row based on border/padding of children,
     * which CAN cause sub-pixel drift. Grid shares one column-sizing pass. */
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    height: var(--ppp-event-strip-height, 1.25rem);
    min-height: var(--ppp-event-strip-height, 1.25rem);
    max-height: var(--ppp-event-strip-height, 1.25rem);
    width: 100%;
    /* Solid background prevents timeline bleedthrough */
    background: var(--background-primary);
    position: relative;
    /* Add margin between lanes to prevent overlap */
    margin-bottom: var(--ppp-space-1, 0.125rem);
    /* v7.5: Prevent content overflow within lane */
    overflow: hidden;
  }
  
  .multiday-lane:last-child {
    margin-bottom: 0;
  }

  .strip-segment {
    --strip-color: var(--interactive-accent);
    /* v9.0: Full button reset — eliminates all user-agent / Obsidian button quirks */
    appearance: none;
    -webkit-appearance: none;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: start;
    text-decoration: none;
    letter-spacing: inherit;
    word-spacing: inherit;
    /* v9.3: flex: 1 1 0 removed — parent .multiday-lane is now CSS Grid repeat(7, 1fr);
     * grid track sizing makes flex properties irrelevant. */
    min-width: 0; /* Allow shrinking below content width */
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--ppp-space-2, 0.25rem);
    height: 100%;
    padding: 0 var(--ppp-space-2, 0.25rem);
    /* Fallback for browsers without color-mix() (e.g. iOS <16.2) */
    background: var(--background-primary);
    /* Semi-transparent background matching EventBar gold standard (15% base) */
    background: color-mix(in srgb, var(--strip-color) 15%, var(--background-primary));
    border-top: var(--ppp-border-width-thick, 0.125rem) solid var(--strip-color);
    border-bottom: none;
    border-left: none;
    /* v9.0: Real border-right — MUST match day-cell + strip-empty border model.
     * Previously used ::after pseudo-element (position: absolute), which placed
     * the separator OUTSIDE the box model, causing sub-pixel misalignment vs
     * day-cell / strip-empty that use real border-right inside box-sizing. */
    border-right: 0.0625rem solid var(--background-modifier-border);
    font-size: var(--ppp-font-size-xs, 0.6875rem);
    line-height: 1;
    cursor: pointer;
    overflow: hidden;
    transition: background var(--ppp-duration-fast, 0.1s) var(--ppp-ease-out, ease);
    /* v3.2.0 DnD: Position context for resize handles */
    position: relative;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .strip-segment:last-child {
    border-right: 0;
  }

  /* v9.0: Removed ::after pseudo-element separator.
   * Now using real border-right (set in .strip-segment base) to match
   * day-cell and strip-empty border model exactly. This eliminates
   * sub-pixel alignment drift between rows with different border approaches. */

  .strip-segment:hover {
    background: color-mix(in srgb, var(--strip-color) 25%, var(--background-primary));
    /* v8.1: Preserve the inset start/end indicator (if any) alongside the hover shadow */
    box-shadow: var(--_strip-inset-shadow, none), 0 0.0625rem 0.25rem rgba(0, 0, 0, 0.08);
  }

  .strip-segment:focus {
    outline: none;
  }
  .strip-segment:focus-visible {
    outline: 0.125rem solid var(--strip-color);
    outline-offset: -0.125rem;
    z-index: 1;
  }

  /* Segment positioning styles - contain within cell bounds */
  /* NOTE: is-start = first day of event span (rounded LEFT edge) */
  /* NOTE: is-end = last day of event span (rounded RIGHT edge) */
  /* v3.1.0 / v9.3: Use PADDING instead of MARGIN for visual inset.
   * Grid items get equal width from repeat(7, 1fr). Padding stays
   * inside box-sizing: border-box, keeping each segment the same width as
   * the Day cell below it. */
  /* v8.1: Use box-shadow instead of border-left/right for start/end indicators.
   * border-left: 0.125rem reduces the available content box by 0.125rem, creating a subtle
   * 0.125rem content-start offset vs adjacent strip-empty cells (which have no left border).
   * box-shadow: inset paints visually in the same pixel area WITHOUT shrinking content,
   * keeping the strip-start cell exactly the same width as a strip-empty or Day cell. */
  .strip-segment.is-start {
    --_strip-inset-shadow: inset 0.125rem 0 0 var(--strip-color);
    box-shadow: var(--_strip-inset-shadow);
    border-top-left-radius: var(--ppp-radius-md, 0.25rem);
    border-bottom-left-radius: var(--ppp-radius-md, 0.25rem);
    padding-left: var(--ppp-space-2, 0.25rem);
    /* v9.0: Keep border-right (inherits 0.0625rem solid from base) for alignment.
     * Use transparent color so there's no visible line within the event span,
     * but the 0.0625rem space is consumed matching day-cell below. */
    border-right-color: transparent;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    padding-right: 0;
  }

  .strip-segment.is-end {
    --_strip-inset-shadow: inset -0.125rem 0 0 var(--strip-color);
    box-shadow: var(--_strip-inset-shadow);
    border-top-right-radius: var(--ppp-radius-md, 0.25rem);
    border-bottom-right-radius: var(--ppp-radius-md, 0.25rem);
    padding-right: var(--ppp-space-2, 0.25rem);
    /* Reset any left side styling */
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    padding-left: 0;
  }

  /* Combined is-start AND is-end (single day multi-day event) */
  .strip-segment.is-start.is-end {
    --_strip-inset-shadow: inset 0.125rem 0 0 var(--strip-color), inset -0.125rem 0 0 var(--strip-color);
    box-shadow: var(--_strip-inset-shadow);
    border-radius: var(--ppp-radius-md, 0.25rem);
    padding-left: var(--ppp-space-2, 0.25rem);
    padding-right: var(--ppp-space-2, 0.25rem);
    /* v9.0: Restore visible separator (overrides is-start's transparent) */
    border-right-color: var(--background-modifier-border);
  }

  .strip-segment.is-only {
    --_strip-inset-shadow: inset 0.125rem 0 0 var(--strip-color), inset -0.125rem 0 0 var(--strip-color);
    box-shadow: var(--_strip-inset-shadow);
    border-radius: var(--ppp-radius-md, 0.25rem);
    padding-left: var(--ppp-space-2, 0.25rem);
    padding-right: var(--ppp-space-2, 0.25rem);
    /* v9.0: Restore visible separator (overrides is-start's transparent) */
    border-right-color: var(--background-modifier-border);
  }

  .strip-segment.is-mid {
    border-radius: 0;
    border-left: none;
    /* v9.0: Keep 0.0625rem border-right space (transparent) for alignment with day-cell */
    border-right-color: transparent;
    border-bottom: none;
    /* Mid segments seamlessly connect - no extra padding */
    padding-left: 0;
    padding-right: 0;
  }

  .strip-dot {
    width: var(--ppp-space-2, 0.25rem);
    height: var(--ppp-space-2, 0.25rem);
    border-radius: var(--ppp-radius-full, 9999px);
    background: var(--strip-color);
    flex-shrink: 0;
  }

  .strip-label {
    color: var(--text-normal);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .strip-continuation {
    /* v3.3.4: Hidden — mid/end segments now show only the semi-transparent background
       with border-top for a clean, consistent strip appearance matching week view */
    display: none;
  }

  .strip-empty {
    /* v9.3: flex: 1 1 0 removed — parent .multiday-lane is now CSS Grid. */
    min-width: 0;
    box-sizing: border-box;
    /* v3.3.4: Solid background blocks day cell border-right lines showing through */
    background: var(--background-primary);
    /* v3.3.5: Column separator matching Day cells and Weekday headers */
    border-right: 0.0625rem solid var(--background-modifier-border);
    position: relative;
  }

  .strip-empty:last-child {
    border-right: 0;
  }



  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE - v9.4 MOBILE VISUAL PARITY
     Match PC appearance: dots visible, labels readable, same tone.
     Only reduce padding/gap — keep all decorations and colors intact.
     ═══════════════════════════════════════════════════════════════ */

  /* Mobile portrait (panel width < 30rem) */
  @container view-content (max-width: 30rem) {
    .multiday-lane {
      height: var(--ppp-event-strip-height, 1.25rem);
      min-height: var(--ppp-event-strip-height, 1.25rem);
      max-height: var(--ppp-event-strip-height, 1.25rem);
      margin-bottom: var(--ppp-event-strip-gap, var(--ppp-space-1, 0.125rem));
      overflow: hidden;
    }

    .strip-segment {
      padding: 0 var(--ppp-space-1, 0.125rem);
      font-size: var(--ppp-font-size-xs, 0.6875rem);
    }

    /* v9.4: Keep dot visible — reduced size for compact columns */
    .strip-dot {
      width: 0.1875rem;
      height: 0.1875rem;
    }

    /* v9.4: Labels use same font as desktop for readability */
    .strip-segment.is-start .strip-label,
    .strip-segment.is-only .strip-label {
      display: block;
      font-size: var(--ppp-font-size-xs, 0.6875rem);
    }

    /* v9.4: Tighter inset indicator + radius on narrow mobile columns
     * to avoid perceived left-shift from disproportionate 2px shadow */
    .strip-segment.is-start {
      --_strip-inset-shadow: inset 0.0625rem 0 0 var(--strip-color);
      border-top-left-radius: var(--ppp-radius-sm, 0.125rem);
      border-bottom-left-radius: var(--ppp-radius-sm, 0.125rem);
    }
    .strip-segment.is-end {
      --_strip-inset-shadow: inset -0.0625rem 0 0 var(--strip-color);
      border-top-right-radius: var(--ppp-radius-sm, 0.125rem);
      border-bottom-right-radius: var(--ppp-radius-sm, 0.125rem);
    }
    .strip-segment.is-start.is-end,
    .strip-segment.is-only {
      --_strip-inset-shadow: inset 0.0625rem 0 0 var(--strip-color), inset -0.0625rem 0 0 var(--strip-color);
      border-radius: var(--ppp-radius-sm, 0.125rem);
    }
  }
  @media (max-height: 30rem) and (orientation: landscape) {
    .multiday-lane {
      height: var(--ppp-event-strip-height, 1.25rem);
      min-height: var(--ppp-event-strip-height, 1.25rem);
      max-height: var(--ppp-event-strip-height, 1.25rem);
      margin-bottom: var(--ppp-event-strip-gap, var(--ppp-space-1, 0.125rem));
      overflow: hidden;
    }
    .strip-segment {
      padding: 0 var(--ppp-space-1, 0.125rem);
      font-size: var(--ppp-font-size-xs, 0.6875rem);
    }
    .strip-dot {
      width: 0.1875rem;
      height: 0.1875rem;
    }
    .strip-segment.is-start .strip-label,
    .strip-segment.is-only .strip-label {
      display: block;
      font-size: var(--ppp-font-size-xs, 0.6875rem);
    }
    .strip-segment.is-start {
      --_strip-inset-shadow: inset 0.0625rem 0 0 var(--strip-color);
      border-top-left-radius: var(--ppp-radius-sm, 0.125rem);
      border-bottom-left-radius: var(--ppp-radius-sm, 0.125rem);
    }
    .strip-segment.is-end {
      --_strip-inset-shadow: inset -0.0625rem 0 0 var(--strip-color);
      border-top-right-radius: var(--ppp-radius-sm, 0.125rem);
      border-bottom-right-radius: var(--ppp-radius-sm, 0.125rem);
    }
    .strip-segment.is-start.is-end,
    .strip-segment.is-only {
      --_strip-inset-shadow: inset 0.0625rem 0 0 var(--strip-color), inset -0.0625rem 0 0 var(--strip-color);
      border-radius: var(--ppp-radius-sm, 0.125rem);
    }
  }

  /* Tablet sizing (above mobile, but below desktop) */
  /* v8.2: @container view-content for panel-aware breakpoint */
  @container view-content (min-width: 30.1rem) and (max-width: 48rem) {
    .multiday-lane {
      height: 1.5rem;
      min-height: 1.5rem;
      margin-bottom: var(--ppp-space-1, 0.125rem);
    }

    .strip-segment {
      padding: 0 var(--ppp-space-2, 0.25rem);
      font-size: var(--ppp-font-size-xs, 0.6875rem);
      /* use token — same as base class border-top-width */
      border-top-width: var(--ppp-border-width-thick, 0.125rem);
    }
    
    .strip-segment.is-start,
    .strip-segment.is-end,
    .strip-segment.is-only {
      padding-left: var(--ppp-space-2, 0.25rem);
      padding-right: var(--ppp-space-2, 0.25rem);
    }
    
    .strip-dot {
      width: var(--ppp-space-2, 0.25rem);
      height: var(--ppp-space-2, 0.25rem);
    }
  }

  /* Tablet landscape (height-based — not available in @container) */
  @media (min-height: 30.1rem) and (max-height: 48rem) and (orientation: landscape) {
    .multiday-lane {
      height: 1.5rem;
      min-height: 1.5rem;
      margin-bottom: var(--ppp-event-strip-gap, var(--ppp-space-1, 0.125rem));
    }
    .strip-segment {
      padding: 0 var(--ppp-space-2, 0.25rem);
      font-size: var(--ppp-font-size-xs, 0.6875rem);
      border-top-width: var(--ppp-border-width-thick, 0.125rem);
    }
    .strip-segment.is-start,
    .strip-segment.is-end,
    .strip-segment.is-only {
      padding-left: var(--ppp-space-2, 0.25rem);
      padding-right: var(--ppp-space-2, 0.25rem);
    }
    .strip-dot {
      width: var(--ppp-space-2, 0.25rem);
      height: var(--ppp-space-2, 0.25rem);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TOUCH OVERRIDE — v9.3
     styles.css sets button { min-height: 2.75rem; min-width: 2.75rem }
     for @media (pointer: coarse). Strip-segment is a <button> but its
     height is governed by --ppp-event-strip-height via the .multiday-lane
     parent. Without this override, strips balloon to 2.75rem on touch.
     ═══════════════════════════════════════════════════════════════ */
  @media (pointer: coarse) {
    .strip-segment {
      min-height: 0;
      min-width: 0;
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     DnD STYLES — v3.2.0 Iteration 6
     Strip drag state, resize handles, cursor feedback
     ═══════════════════════════════════════════════════════════════ */

  .strip-segment.dnd-grab {
    cursor: grab;
    /* v9.4: Prevent browser from intercepting touch for scrolling/panning.
     * Without this, the UA recognises a pan gesture during the 500ms long-press
     * window and stops delivering touchmove events, making drag impossible.
     * Scrolling still works via empty cells, day cells, and header area. */
    touch-action: none;
  }

  .strip-segment.dnd-grab:active {
    cursor: grabbing;
  }

  .strip-segment.dnd-dragging {
    opacity: 0.4;
    pointer-events: none;
  }

  /* v9.4: Long-press confirmed — lift strip for visual feedback before drag threshold */
  .strip-segment.dnd-long-press {
    transform: scale(1.08);
    box-shadow: 0 0.125rem 0.75rem rgba(0, 0, 0, 0.25);
    z-index: 5;
    opacity: 0.85;
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }

  /* v3.2.1 DnD: Drop target highlight on cells within ghost range */
  .strip-segment.dnd-drop-target,
  .strip-empty.dnd-drop-target {
    background: color-mix(in srgb, var(--interactive-accent) 12%, var(--background-primary));
  }
  /* v3.3.6: Stronger highlight on touch devices */
  @media (pointer: coarse) {
    .strip-segment.dnd-drop-target,
    .strip-empty.dnd-drop-target {
      background: color-mix(in srgb, var(--interactive-accent) 22%, var(--background-primary));
      box-shadow: inset 0 0 0 0.09375rem color-mix(in srgb, var(--interactive-accent) 40%, transparent);
    }
  }

  /* v3.2.1 DnD: Floating ghost overlay showing projected strip position */
  .strip-ghost-overlay {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: var(--ppp-radius-md, 0.25rem);
    background: color-mix(in srgb, var(--interactive-accent) 15%, transparent);
    border: 0.09375rem solid color-mix(in srgb, var(--interactive-accent) 50%, transparent);
    pointer-events: none;
    z-index: 10;
    /* v4.0.3: Removed transition — instant ghost feedback prevents perceived
     * "stalling" during fast strip-resize-start / strip-resize-end drags where
     * independent left/width animations could create sub-pixel wobble. */
  }

  /* v3.2.4: Edge date label badge for cross-week strip drag */
  .strip-edge-label {
    position: absolute;
    top: -1.5rem;
    right: 0;
    z-index: 11;
    pointer-events: none;
  }

  .strip-edge-label-text {
    background: var(--text-accent);
    color: var(--text-on-accent);
    font-size: var(--ppp-font-size-xs, 0.6875rem);
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--ppp-radius-md, 0.25rem);
    white-space: nowrap;
    box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.2);
  }

  /* Horizontal resize handles (◤ left / ◢ right) */
  .resize-handle-start,
  .resize-handle-end {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: col-resize;
    opacity: 0;
    transition: opacity var(--ppp-duration-fast) var(--ppp-ease-out);
    z-index: 2;
  }

  .resize-handle-start {
    left: 0;
  }

  .resize-handle-end {
    right: 0;
  }

  /* Triangle indicators */
  .resize-handle-start::after,
  .resize-handle-end::after {
    content: '';
    display: block;
    width: 0;
    height: 0;
    border: 0.1875rem solid transparent;
  }

  .resize-handle-start::after {
    border-right-color: var(--strip-color);
    border-right-width: 0.25rem;
  }

  .resize-handle-end::after {
    border-left-color: var(--strip-color);
    border-left-width: 0.25rem;
  }

  /* Show handles on hover (desktop) */
  .strip-segment:hover .resize-handle-start,
  .strip-segment:hover .resize-handle-end {
    opacity: 1;
  }

  /* Mobile: always show resize handles, enlarge touch zone */
  /* v8.2: @container view-content for panel-aware breakpoint */
  @container view-content (max-width: 30rem) {
    .resize-handle-start,
    .resize-handle-end {
      opacity: 1;
      width: 0.75rem;
      /* 44px minimum touch target */
      min-width: 2.75rem;
      margin: 0 -1rem;
    }
  }
  @media (max-height: 30rem) and (orientation: landscape) {
    .resize-handle-start,
    .resize-handle-end {
      opacity: 1;
      width: 0.75rem;
      min-width: 2.75rem;
      margin: 0 -1rem;
    }
  }
</style>

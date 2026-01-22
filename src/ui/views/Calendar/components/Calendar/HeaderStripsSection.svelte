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
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { EventRenderType, type ProcessedCalendarData } from "../../types";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  
  /** Array of 7 dates for this week row */
  export let weekDates: dayjs.Dayjs[];
  
  /** Processed calendar data with grouped records */
  export let processedData: ProcessedCalendarData | null = null;
  
  /** First day of week setting (0=Sun, 1=Mon, etc.) - reserved for future use */
  export const firstDayOfWeek: number = 1;
  
  /** Callback when event is clicked */
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  
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
</script>

{#if hasAnyEvents}
  <div 
    class="header-strips-section"
    style:--lane-count={maxLane}
    role="rowgroup"
    aria-label="Multi-day and all-day events"
  >
    <!-- Multi-day lanes (rendered top to bottom, lane 0 closest to dates) -->
    {#each weekEvents.multiDayByLane.slice().reverse() as laneData (laneData.lane)}
      <div class="multiday-lane" role="row">
        {#each weekDates as date (date.format('YYYY-MM-DD'))}
          {@const dateKey = date.format('YYYY-MM-DD')}
          {@const segment = laneData.segments.get(dateKey)}
          {#if segment}
            <button
              class="strip-segment"
              class:is-start={segment.isStart}
              class:is-end={segment.isEnd}
              class:is-only={segment.isStart && segment.isEnd}
              class:is-mid={!segment.isStart && !segment.isEnd}
              type="button"
              style:--strip-color={segment.color ?? 'var(--interactive-accent)'}
              on:click={() => onRecordClick?.(segment.record)}
              title={segment.label}
              aria-label={segment.label}
            >
              {#if segment.isStart || (segment.isStart && segment.isEnd)}
                <span class="strip-dot"></span>
                <span class="strip-label">{segment.label}</span>
              {:else}
                <span class="strip-continuation"></span>
              {/if}
            </button>
          {:else}
            <div class="strip-empty" aria-hidden="true"></div>
          {/if}
        {/each}
      </div>
    {/each}
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
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    /* Ensure section takes full width like Week component */
    width: 100%;
    /* Create isolated stacking context with backdrop */
    position: relative;
    z-index: 2;
    /* Ensure background blocks timeline content below */
    isolation: isolate;
    /* v7.5: Prevent strips from overflowing container on mobile */
    overflow: hidden;
  }

  /* ═══════════════════════════════════════════════════════════════
     MULTI-DAY LANES
     Each lane contains strip segments across 7 days
     Using flex with equal width children to match Day cells
     v7.0: Converted to rem units + responsive heights
     ═══════════════════════════════════════════════════════════════ */
  .multiday-lane {
    display: flex;
    height: var(--ppp-event-strip-height, 1.25rem);
    min-height: var(--ppp-event-strip-height, 1.25rem);
    max-height: var(--ppp-event-strip-height, 1.25rem);
    width: 100%;
    /* Solid background prevents timeline bleedthrough */
    background: var(--background-primary);
    position: relative;
    /* Add margin between lanes to prevent overlap */
    margin-bottom: var(--ppp-spacing-xs, 0.125rem);
    /* v7.5: Prevent content overflow within lane */
    overflow: hidden;
  }
  
  .multiday-lane:last-child {
    margin-bottom: 0;
  }

  .strip-segment {
    --strip-color: var(--interactive-accent);
    /* Use flex: 1 for equal distribution matching Day cells */
    flex: 1 1 0;
    min-width: 0; /* Allow shrinking below content width */
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--ppp-spacing-xs);
    height: 100%;
    padding: 0 var(--ppp-spacing-xs);
    /* Fallback for browsers without color-mix support */
    background: var(--background-primary);
    /* Modern browsers: transparent overlay */
    background: color-mix(in srgb, var(--strip-color) 18%, var(--background-primary));
    border-top: var(--ppp-border-width-thick) solid var(--strip-color);
    border-bottom: var(--ppp-border-width) solid color-mix(in srgb, var(--strip-color) 25%, transparent);
    font-size: var(--ppp-font-size-xs);
    line-height: 1;
    cursor: pointer;
    overflow: hidden;
    transition: background var(--ppp-duration-fast) var(--ppp-ease-out);
    border-left: none;
    border-right: none;
  }

  .strip-segment:hover {
    background: color-mix(in srgb, var(--strip-color) 28%, var(--background-primary));
  }

  .strip-segment:focus {
    outline: none;
    box-shadow: inset 0 0 0 var(--ppp-border-width-thick) var(--strip-color);
    z-index: 1;
  }

  /* Segment positioning styles - contain within cell bounds */
  /* NOTE: is-start = first day of event span (rounded LEFT edge) */
  /* NOTE: is-end = last day of event span (rounded RIGHT edge) */
  .strip-segment.is-start {
    border-left: var(--ppp-border-width-thick) solid var(--strip-color);
    border-top-left-radius: var(--ppp-radius-sm);
    border-bottom-left-radius: var(--ppp-radius-sm);
    margin-left: var(--ppp-spacing-xs);
    /* Reset any right side styling */
    border-right: none;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    margin-right: 0;
  }

  .strip-segment.is-end {
    border-right: var(--ppp-border-width-thick) solid var(--strip-color);
    border-top-right-radius: var(--ppp-radius-sm);
    border-bottom-right-radius: var(--ppp-radius-sm);
    margin-right: var(--ppp-spacing-xs);
    /* Reset any left side styling */
    border-left: none;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    margin-left: 0;
  }

  /* Combined is-start AND is-end (single day multi-day event - shouldn't happen often) */
  .strip-segment.is-start.is-end {
    border: var(--ppp-border-width-thick) solid var(--strip-color);
    border-radius: var(--ppp-radius-sm);
    margin-left: var(--ppp-spacing-xs);
    margin-right: var(--ppp-spacing-xs);
  }

  .strip-segment.is-only {
    border: var(--ppp-border-width-thick) solid var(--strip-color);
    border-radius: var(--ppp-radius-sm);
    margin-left: var(--ppp-spacing-xs);
    margin-right: var(--ppp-spacing-xs);
  }

  .strip-segment.is-mid {
    border-radius: 0;
    border-left: none;
    border-right: none;
    /* Mid segments seamlessly connect - no margins */
    margin-left: 0;
    margin-right: 0;
  }

  .strip-dot {
    width: var(--ppp-spacing-sm);
    height: var(--ppp-spacing-sm);
    border-radius: var(--ppp-radius-full);
    background: var(--strip-color);
    flex-shrink: 0;
  }

  .strip-label {
    color: var(--text-normal);
    font-weight: var(--ppp-weight-medium);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .strip-continuation {
    /* Visual indicator that this continues from previous cell */
    width: 100%;
    height: var(--ppp-border-width-thick);
    background: var(--strip-color);
    opacity: 0.4;
  }

  .strip-empty {
    /* Use flex: 1 to match strip-segment width */
    flex: 1 1 0;
    min-width: 0;
    box-sizing: border-box;
    /* Empty space where no event spans */
  }

  /* ═══════════════════════════════════════════════════════════════
     RESPONSIVE - v8.0 UNIFIED mobile strips using CSS variables
     ═══════════════════════════════════════════════════════════════ */
  
  /* Mobile ALL orientations: Use CSS variable for consistent height */
  @media (max-width: 30rem), (max-height: 30rem) and (orientation: landscape) {
    .multiday-lane {
      /* v8.0: Use CSS variable which is updated in tokens.css for mobile */
      height: var(--ppp-event-strip-height, 1.125rem);
      min-height: var(--ppp-event-strip-height, 1.125rem);
      max-height: var(--ppp-event-strip-height, 1.125rem);
      margin-bottom: 2px;
      overflow: hidden;
    }
    
    .strip-segment {
      /* Keep mobile font adjustments but preserve layout */
      padding: 0 var(--ppp-spacing-2xs, 0.25rem);
      font-size: 0.625rem;
    }
    
    /* Hide decorations on mobile to save space, but keep height consistent */
    .strip-dot {
      display: none;
    }
    
    .strip-continuation {
      display: none;
    }
    
    /* Show ONLY text label on start segments */
    .strip-segment.is-start .strip-label,
    .strip-segment.is-only .strip-label {
      display: block;
      font-size: 0.5625rem;
    }
    
    /* Hide text on mid/end segments */
    .strip-segment.is-mid .strip-label,
    .strip-segment.is-end .strip-label {
      display: none;
    }
  }
  
  /* Tablet sizing (above mobile, but below desktop) */
  @media (min-width: 30.1rem) and (max-width: 48rem) and (orientation: portrait),
         (min-height: 30.1rem) and (max-height: 48rem) and (orientation: landscape) {
    .multiday-lane {
      height: 1.5rem;
      min-height: 1.5rem;
      margin-bottom: var(--ppp-spacing-xs);
    }

    .strip-segment {
      padding: 0 var(--ppp-spacing-xs);
      font-size: 0.6875rem;
      border-top-width: 1.5px;
    }
    
    .strip-segment.is-start,
    .strip-segment.is-end,
    .strip-segment.is-only {
      margin-left: var(--ppp-spacing-xs);
      margin-right: var(--ppp-spacing-xs);
    }
    
    .strip-dot {
      width: var(--ppp-spacing-xs);
      height: var(--ppp-spacing-xs);
    }
  }
</style>

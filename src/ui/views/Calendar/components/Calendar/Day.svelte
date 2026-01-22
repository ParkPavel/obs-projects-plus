<script lang="ts">
  import dayjs from "dayjs";
  import { Menu } from "obsidian";
  import type { DataRecord } from "src/lib/dataframe/dataframe";
  import { EventRenderType, type ProcessedRecord } from "../../types";
  import { i18n } from "src/lib/stores/i18n";
  import { app } from "src/lib/stores/obsidian";
  import { createEventDispatcher, onMount } from "svelte";
  import DateDisplay from "./Date.svelte";
  import EventList from "./EventList.svelte";
  import { getDisplayName } from "src/ui/views/Board/components/Board/boardHelpers";
  import { parseDateInTimezone } from "src/ui/views/Calendar/calendar";
  import { menuOnContextMenu } from "src/ui/views/helpers";

  /**
   * Specifies the date of the day.
   */
  export let date: dayjs.Dayjs;

  /**
   * Whether this day is outside the current month (for grid alignment).
   */
  export let isOutsideMonth: boolean = false;

  /**
   * @deprecated Width is now controlled via flex
   * Kept for backward compatibility but not used internally
   */
  export const width: number = 14.28;

  /**
   * Specifies the records representing the calendar events.
   */
  export let records: DataRecord[];

  /**
   * Pre-processed records from CalendarDataProcessor (v3.0.0)
   * Contains renderType, lanes, colors computed once
   */
  export let processedRecords: ProcessedRecord[] = [];

  /**
   * Specifies the field to use for determining checkbox state.
   */
  export let checkField: string | undefined;

  /**
   * onRecordClick runs when the user clicks a calendar event.
   */
  export let onRecordClick: ((record: DataRecord) => void) | undefined;

  /**
   * onRecordCheck runs when the user Checks / Unchecks a calendar event.
   */
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;

  /**
   * onRecordChange runs when the user changes the record (e.g. date).
   */
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;

  /**
   * onRecordAdd runs when the user creates a new calendar event on this day.
   */
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  
  /**
   * Whether mobile mode is enabled (disables drag, enables tap interactions)
   */
  export let isMobile: boolean = false;
  
  /**
   * Date field used for time parsing.
   */
  export let dateFieldName: string | undefined;
  
  /**
   * Optional end date field for multi-day spans.
   */
  export let endDateFieldName: string | undefined;
  
  /**
   * Calendar timezone (IANA name or "local").
   */
  export let timezone: string = "local";
  
  /**
   * Callback when day is tapped on mobile (opens popup)
   * Third parameter is optional event for positioning
   */
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[], event?: MouseEvent | TouchEvent) => void) | undefined;
  
  /**
   * Display mode for events in month view:
   * - 'list': Traditional EventList (default)
   * - 'bars': Relative time bars (7:00-21:00 scale)
   */
  export let displayMode: 'list' | 'bars' = 'list';
  
  /**
   * Start hour for the visible time range in bars mode (0-23).
   * Events starting before this hour will be clamped to this hour.
   */
  export let startHourConfig: number = 7;
  
  /**
   * End hour for the visible time range in bars mode (0-23).
   * Events ending after this hour will be clamped to this hour.
   */
  export let endHourConfig: number = 21;

  const dispatch = createEventDispatcher<{
    dayTap: { date: dayjs.Dayjs; records: DataRecord[] };
  }>();

  let eventListOnRecordChange: ((record: DataRecord) => void) | undefined = undefined;
  let zonedDate: dayjs.Dayjs;
  let isVisible = false; // Start invisible, IntersectionObserver will set to true
  // NOTE: allDayRecords moved to HeaderStripsSection.svelte

  $: eventListOnRecordChange = date && onRecordChange && !isOutsideMonth && !isMobile 
    ? (r => onRecordChange!(date, r)) 
    : undefined;

  // NOTE: getRecordColor now used only in HeaderStripsSection for multi-day/all-day events

  function dayInZone(d: dayjs.Dayjs) {
    return timezone !== "local" ? dayjs.tz(d.format("YYYY-MM-DD"), timezone) : d;
  }

  $: zonedDate = dayInZone(date);

  $: weekend = zonedDate.day() === 0 || zonedDate.day() === 6;
  $: today = zonedDate.startOf("day").isSame(dayjs().startOf("day"));

  // Filter to only show timed events in the cell (multi-day are in header strips)
  $: cellRecords = processedRecords.length > 0
    ? records.filter(r => {
        const pr = processedRecords.find(p => p.record.id === r.id);
        // Only show TIMED (single day) in the cell
        // Multi-day and All-day are handled by HeaderStripsSection
        return pr?.renderType === EventRenderType.TIMED;
      })
    : records; // Fallback if no processed data

  // Limit visible events to prevent overflow
  const MAX_VISIBLE_EVENTS = 4;
  $: visibleRecords = cellRecords.slice(0, MAX_VISIBLE_EVENTS);
  $: hiddenCount = Math.max(0, cellRecords.length - MAX_VISIBLE_EVENTS);

  // NOTE: Multi-day and All-day events are now handled by HeaderStripsSection.svelte
  // Day.svelte only renders TIMED events (bars or list mode)
  
  // Timed events for relative bars (Month view with bars mode)
  // Time range is configurable via props (default: 7:00-21:00)
  $: START_HOUR = startHourConfig;
  $: END_HOUR = endHourConfig;
  $: HOUR_RANGE = END_HOUR - START_HOUR;
  
  interface TimedBar {
    record: DataRecord;
    color: string | null;
    label: string;
    topPercent: number;    // Position from top (0-100%)
    heightPercent: number; // Height as percentage (min 10%)
    startTime: string;     // For tooltip
    endTime: string;       // For tooltip
    startMinutes: number;  // For overlap calculation
    endMinutes: number;    // For overlap calculation
    column: number;        // Column index for overlapping (0-based)
    totalColumns: number;  // Total columns in overlap group
  }
  
  /**
   * Calculate overlapping groups and assign columns to events
   * v3.3.0: GREEDY column assignment - reuse columns when possible
   * Events that don't overlap in time can share the same column
   */
  function calculateOverlapLayout(bars: Omit<TimedBar, 'column' | 'totalColumns'>[]): TimedBar[] {
    if (bars.length === 0) return [];
    if (bars.length === 1) {
      const bar = bars[0];
      if (!bar) return [];
      return [{ ...bar, column: 0, totalColumns: 1 }];
    }
    
    // v8.1: No buffer needed - adjacent events can share column
    // Only truly overlapping events (start < previousEnd) need separate columns
    
    // Sort by start time, then by duration (longer first for better visual layout)
    const sorted = [...bars].sort((a, b) => 
      a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
    );
    
    // GREEDY column assignment: each event gets first available column
    // columnEndTimes[col] = when that column becomes free
    const columnEndTimes: number[] = [];
    const assignments: { bar: typeof sorted[0], column: number }[] = [];
    
    for (const bar of sorted) {
      if (!bar) continue;
      
      // Find first column that's free when this event starts
      // v8.1.3: Use strict > instead of >= because endMinutes includes visual height
      // If event A visually ends at 10:30 (due to min-height) and B starts at 10:00,
      // they should NOT share a column even though real times don't overlap
      let assignedColumn = -1;
      for (let col = 0; col < columnEndTimes.length; col++) {
        const colEndTime = columnEndTimes[col] ?? 0;
        // Column is free ONLY if this event starts AFTER the visual end of previous
        if (bar.startMinutes > colEndTime) {
          assignedColumn = col;
          break;
        }
      }
      
      // No free column found - create new one
      if (assignedColumn === -1) {
        assignedColumn = columnEndTimes.length;
        columnEndTimes.push(0);
      }
      
      // Update column end time
      columnEndTimes[assignedColumn] = bar.endMinutes;
      
      assignments.push({ bar, column: assignedColumn });
    }
    
    const totalColumns = columnEndTimes.length;
    
    return assignments.map(({ bar, column }) => ({
      ...bar,
      column,
      totalColumns,
    }));
  }
  
  // Get timed events with calculated positions for relative bars
  $: timedBars = (() => {
    if (!isVisible) return [];
    
    const rawBars = processedRecords
      .filter(pr => pr.renderType === EventRenderType.TIMED && pr.timeInfo)
      .map(pr => {
        const { startTime, endTime } = pr.timeInfo!;
        
        // Calculate position relative to configurable time range
        const startHourVal = startTime.hour() + startTime.minute() / 60;
        const endHourVal = endTime.hour() + endTime.minute() / 60;
        
        // Calculate minutes for overlap detection
        const startMinutes = startTime.hour() * 60 + startTime.minute();
        const realEndMinutes = endTime.hour() * 60 + endTime.minute();
        
        // Clamp to visible range
        const clampedStart = Math.max(startHourVal, START_HOUR);
        const clampedEnd = Math.min(endHourVal, END_HOUR);
        
        // Calculate percentages
        const topPercent = ((clampedStart - START_HOUR) / HOUR_RANGE) * 100;
        // v8.1: Reduced min height from 10% to 5% to prevent overlap of adjacent short events
        // 5% of 14h range = ~42min visual minimum, still visible but less overlap
        const MIN_HEIGHT_PERCENT = 5;
        const actualHeightPercent = ((clampedEnd - clampedStart) / HOUR_RANGE) * 100;
        const heightPercent = Math.max(MIN_HEIGHT_PERCENT, actualHeightPercent);
        
        // v8.1.2: For collision detection, use VISUAL end time, not real end time
        // If min-height makes bar visually taller, collision must account for that
        const visualDurationMinutes = (heightPercent / 100) * HOUR_RANGE * 60;
        const endMinutes = startMinutes + Math.max(realEndMinutes - startMinutes, visualDurationMinutes);
        
        return {
          record: pr.record,
          color: pr.color,
          label: getDisplayName(pr.record.id) ?? pr.record.id,
          topPercent,
          heightPercent,
          startTime: startTime.format('HH:mm'),
          endTime: endTime.format('HH:mm'),
          startMinutes,
          endMinutes,
        };
      });
    
    // Calculate layout with overlap handling
    return calculateOverlapLayout(rawBars);
  })();

  // Mobile tap handling
  let tapTimeout: ReturnType<typeof setTimeout> | null = null;
  let tapCount = 0;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchHandled = false; // Prevent click after touch
  const TAP_THRESHOLD = 10; // Max movement for a tap
  const DOUBLE_TAP_DELAY = 300;
  let intersectionObserver: IntersectionObserver | null = null;

  /**
   * Navigate to adjacent cell with keyboard
   */
  function navigateGrid(direction: 'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'pageup' | 'pagedown', shiftKey: boolean = false) {
    if (!rootEl) return;
    
    const grid = rootEl.closest('[role=\"grid\"]');
    if (!grid) return;
    
    const selector = '[role=\"gridcell\"]:not([aria-disabled=\"true\"])';
    
    if (direction === 'home' || direction === 'end') {
      const row = rootEl.closest('[role=\"row\"]');
      if (!row) return;
      const cellsInRow = Array.from(row.querySelectorAll(selector));
      const target = direction === 'home' ? cellsInRow[0] : cellsInRow[cellsInRow.length - 1];
      if (target instanceof HTMLElement) target.focus();
      return;
    }
    
    const cells = Array.from(grid.querySelectorAll(selector));
    const currentIndex = cells.indexOf(rootEl);
    if (currentIndex === -1) return;
    
    let targetIndex = currentIndex;
    
    switch (direction) {
      case 'left':
        targetIndex = currentIndex - 1;
        break;
      case 'right':
        targetIndex = currentIndex + 1;
        break;
      case 'up':
        targetIndex = currentIndex - 7;
        break;
      case 'down':
        targetIndex = currentIndex + 7;
        break;
      case 'pageup':
        targetIndex = currentIndex - (7 * (shiftKey ? 4 : 1));
        break;
      case 'pagedown':
        targetIndex = currentIndex + (7 * (shiftKey ? 4 : 1));
        break;
    }
    
    if (targetIndex >= 0 && targetIndex < cells.length) {
      const target = cells[targetIndex];
      if (target instanceof HTMLElement) target.focus();
    }
  }

  function handleTouchStart(event: TouchEvent) {
    if (isOutsideMonth) return;
    if (!isMobile) return;
    
    touchHandled = false;
    const touch = event.touches[0];
    if (touch) {
      touchStartTime = Date.now();
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (isOutsideMonth) return;
    if (!isMobile) return;
    
    const touch = event.changedTouches[0];
    if (!touch) return;
    
    // Check if it was a tap (not a scroll/swipe)
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const touchDuration = Date.now() - touchStartTime;
    
    if (deltaX > TAP_THRESHOLD || deltaY > TAP_THRESHOLD || touchDuration > 500) {
      // This was a scroll/swipe, ignore
      return;
    }
    
    // Mark touch as handled to prevent subsequent click
    touchHandled = true;
    event.preventDefault();
    event.stopPropagation();
    
    tapCount++;
    
    if (tapTimeout) {
      clearTimeout(tapTimeout);
    }
    
    tapTimeout = setTimeout(() => {
      if (tapCount === 1) {
        // Single tap - open day popup
        onDayTap?.(date, records, event);
        dispatch('dayTap', { date, records });
      } else if (tapCount >= 2) {
        // Double tap - create new note
        onRecordAdd?.(date);
      }
      tapCount = 0;
    }, DOUBLE_TAP_DELAY);
  }
  
  /**
   * Handle click on timed bar with Ctrl+click support for new window
   */
  function handleBarClick(event: MouseEvent, record: DataRecord) {
    event.stopPropagation();
    
    if (event.ctrlKey || event.metaKey) {
      // Ctrl+click: open in new window
      $app.workspace.openLinkText(record.id, record.id, true);
    } else {
      // Normal click
      onRecordClick?.(record);
    }
  }

  function handleBackgroundClick(event: MouseEvent) {
    if (isOutsideMonth) return;
    
    // v7.0.1: Skip if this click follows a touch event (prevent double popup on touch devices)
    if (touchHandled) {
      touchHandled = false;
      return;
    }
    
    // Ignore if clicking on interactive elements
    if ((event.target as HTMLElement).closest('button, a, .internal-link, .event-link, .more-events-btn')) {
      return;
    }
    
    // Ignore double clicks (handled by dblclick)
    if (event.detail > 1) return;

    // v7.0.1: Always handle click for popup - works on desktop with any window size
    onDayTap?.(date, records, event);
  }

  function handleDblClick(event: MouseEvent) {
    if (isOutsideMonth) return;
    if (isMobile) return; // Handled by tap
    onRecordAdd?.(date);
  }

  function handleMouseDown(event: MouseEvent) {
    if (isOutsideMonth) return;
    if (isMobile) return;
    if (event.button === 2) {
      const menu = new Menu().addItem((item) => {
        item
          .setTitle($i18n.t("views.calendar.new-note"))
          .setIcon("file-plus")
          .onClick(() => onRecordAdd?.(date!));
      });
      menuOnContextMenu(event, menu);
    }
  }

  let rootEl: HTMLDivElement | null = null;

  function handleDndFinalize(detail: DndEvent<DataRecord>) {
    if (!dateFieldName || !onRecordChange) return;
    
    // Only process actual drops into this zone
    const validTriggers = ['droppedIntoZone', 'dragStopped'];
    if (!validTriggers.includes(detail.info.trigger)) return;

    const movedId = detail.info.id;
    const movedRecord = detail.items.find((r) => r.id === movedId);
    if (!movedRecord) return;

    const start = parseDateInTimezone(movedRecord.values[dateFieldName], timezone);
    if (!start) return; // Skip records without valid start date
    
    const newDate = date.startOf('day');
    const startDay = start?.startOf('day');
    
    // Prevent no-op drag (dropped on same day)
    if (startDay && startDay.isSame(newDate, 'day')) {
      return;
    }
    
    const deltaDays = startDay ? newDate.diff(startDay, 'day') : 0;

    // Update end date field in record before propagating change
    if (endDateFieldName && deltaDays !== 0) {
      const endRaw = movedRecord.values[endDateFieldName];
      const endParsed = parseDateInTimezone(endRaw, timezone);
      if (endParsed) {
        const newEnd = endParsed.add(deltaDays, 'day');
        movedRecord.values[endDateFieldName] = newEnd.toISOString();
      }
    }

    // Propagate to parent with full validation/persistence
    onRecordChange(newDate, movedRecord);
  }

  function setupIntersectionObserver() {
    if (typeof IntersectionObserver === "undefined") {
      isVisible = true; // Fallback if no IntersectionObserver
      return;
    }
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === rootEl) {
          isVisible = entry.isIntersecting;
        }
      }
    }, {
      root: null,
      rootMargin: '200px', // Pre-load items 200px before they become visible
      threshold: 0,
    });
    if (rootEl) {
      intersectionObserver.observe(rootEl);
    }
  }

  onMount(() => {
    setupIntersectionObserver();
    return () => {
      if (intersectionObserver && rootEl) {
        intersectionObserver.unobserve(rootEl);
      }
      intersectionObserver?.disconnect();
    };
  });
</script>

<div
  bind:this={rootEl}
  class="day-cell"
  class:weekend
  class:today
  class:outside-month={isOutsideMonth}
  class:mobile={isMobile}
  data-date={date.format('YYYY-MM-DD')}
  on:click={handleBackgroundClick}
  on:dblclick={handleDblClick}
  on:mousedown={handleMouseDown}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  role="gridcell"
  aria-selected={today}
  aria-disabled={isOutsideMonth}
  tabindex={isOutsideMonth ? -1 : 0}
  on:keydown={(e) => {
    if (isOutsideMonth) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isMobile) {
        onDayTap?.(date, records);
      } else {
        handleDblClick(new MouseEvent('dblclick', { bubbles: true }));
      }
      return;
    }
    
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : 'down';
      navigateGrid(dir);
      return;
    }
    
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const dir = e.key === 'Home' ? 'home' : 'end';
      navigateGrid(dir);
      return;
    }
    
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      navigateGrid(e.key === 'PageUp' ? 'pageup' : 'pagedown', e.shiftKey);
    }
  }}
>
  <DateDisplay {today} outsideMonth={isOutsideMonth}>{date.date()}</DateDisplay>
  {#if !isOutsideMonth}
    <!-- NOTE: Multi-day and All-day events are now in HeaderStripsSection above the week row -->
    
    <!-- CONTENT ZONE: Only TIMED events -->
    <!-- BARS MODE: Relative time bars (7:00-21:00 scale) -->
    {#if displayMode === 'bars' && timedBars.length > 0}
      <div class="timed-bars-container" aria-label="Timed events">
        {#each timedBars as bar (bar.record.id)}
          {@const gapPx = bar.totalColumns > 1 ? 4 : 0}
          {@const leftPercent = (bar.column / bar.totalColumns) * 100}
          {@const widthPercent = 100 / bar.totalColumns}
          {@const isNarrow = bar.totalColumns > 1}
          {@const isLastColumn = bar.column === bar.totalColumns - 1}
          <button
            class="timed-bar"
            class:narrow={isNarrow}
            class:last-column={isLastColumn}
            type="button"
            style={`
              top: ${bar.topPercent}%;
              height: ${bar.heightPercent}%;
              left: ${leftPercent}%;
              width: calc(${widthPercent}% - ${isLastColumn ? 0 : gapPx}px);
              --bar-color: ${bar.color ?? 'var(--interactive-accent)'};
            `}
            on:click={(e) => handleBarClick(e, bar.record)}
            title={`${bar.label}\n${bar.startTime} - ${bar.endTime}`}
          >
            <span class="bar-label">{bar.label}</span>
          </button>
        {/each}
      </div>
    {:else if displayMode === 'list'}
      <!-- LIST MODE: Traditional EventList (includes all events for legacy support) -->
      <EventList
        {checkField}
        records={visibleRecords}
        {onRecordClick}
        {onRecordCheck}
        onRecordChange={eventListOnRecordChange}
        disableDrag={isMobile}
        on:dndFinalize={({ detail }) => handleDndFinalize(detail)}
      />
      {#if hiddenCount > 0}
        <button class="more-events-btn" on:click|stopPropagation={() => onDayTap?.(date, records)}>
          {hiddenCount} more...
        </button>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .day-cell {
    position: relative;
    border-right: 1px solid var(--background-modifier-border);
    padding: 0.375rem;
    font-size: var(--font-ui-small);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    outline: none;
    min-height: 6.5625rem;
    height: 100%;
    overflow: clip;
    transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--background-primary);
    border-radius: 0;
    box-sizing: border-box; /* Ensure borders don't affect width calculation */
    /* v4.0.1: Equal width distribution matching HeaderStripsSection */
    flex: 1 1 0;
    min-width: 0; /* Allow shrinking below content width */
  }

  .more-events-btn {
    background: none;
    border: none;
    padding: var(--ppp-spacing-3xs, 0.125rem) var(--ppp-spacing-2xs, 0.25rem);
    font-size: 0.7em;
    color: var(--text-muted);
    cursor: pointer;
    text-align: left;
    width: 100%;
    border-radius: 4px;
  }

  .more-events-btn:hover {
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* NOTE: Multi-day and All-day styles moved to HeaderStripsSection.svelte */

  .day-cell:not(.outside-month):hover {
    background: var(--background-secondary);
  }

  .day-cell:not(.outside-month):focus {
    box-shadow: inset 0 0 0 0.125rem var(--interactive-accent);
    z-index: 1;
  }

  .day-cell:last-child {
    border-right: 0;
  }

  /* Today highlight - border instead of ellipse */
  .day-cell.today {
    background: hsla(var(--interactive-accent-hsl), 0.08);
    box-shadow: inset 0 0 0 0.125rem var(--interactive-accent);
    border-radius: 0.5rem;
    animation: today-pulse 2s ease-out 1;
  }

  .day-cell.today:hover {
    background: hsla(var(--interactive-accent-hsl), 0.12);
  }
  
  /* Today pulse animation for edge centering visibility */
  @keyframes today-pulse {
    0% {
      box-shadow: inset 0 0 0 0.125rem var(--interactive-accent),
                  0 0 0 0 hsla(var(--interactive-accent-hsl), 0.5);
    }
    50% {
      box-shadow: inset 0 0 0 0.125rem var(--interactive-accent),
                  0 0 0 0.5rem hsla(var(--interactive-accent-hsl), 0);
    }
    100% {
      box-shadow: inset 0 0 0 0.125rem var(--interactive-accent),
                  0 0 0 0 hsla(var(--interactive-accent-hsl), 0);
    }
  }

  /* Weekend styling */
  .day-cell.weekend:not(.outside-month):not(.today) {
    background: var(--background-primary-alt);
  }

  .day-cell.weekend:not(.outside-month):not(.today):hover {
    background: var(--background-modifier-hover);
  }

  /* Outside month (inactive days) */
  .day-cell.outside-month {
    background: var(--background-secondary);
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }

  .day-cell.outside-month:hover {
    background: var(--background-secondary);
  }

  /* Mobile responsive styles - v7.0 revised */
  @media (max-width: 48rem) {
    .day-cell {
      padding: 0.1875rem;
      min-height: 4.5rem;
      gap: 0.125rem;
      font-size: 0.6875rem;
    }
  }

  @media (max-width: 30rem) {
    .day-cell {
      padding: 0.125rem;
      min-height: 3.75rem;
      gap: 0.0625rem;
      font-size: 0.625rem;
    }
    
    .more-events-btn {
      font-size: 0.5625rem;
      padding: var(--ppp-spacing-4xs, 0.0625rem) var(--ppp-spacing-3xs, 0.125rem);
    }
  }

  /* Mobile mode specific */
  .day-cell.mobile {
    min-height: 4rem;
    cursor: pointer;
  }

  .day-cell.mobile:active {
    background: var(--background-modifier-hover);
    transform: scale(0.98);
  }

  /* Touch device optimizations - v7.0 revised for smaller cells */
  @media (pointer: coarse) {
    .day-cell {
      min-height: 4rem;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }

    .day-cell:active:not(.outside-month) {
      background: var(--background-modifier-hover);
    }
  }
  
  /* Timed Bars Container (for bars display mode) */
  .timed-bars-container {
    position: relative;
    flex: 1;
    /* v8.0: Minimum height ensures percentage positioning works correctly */
    /* Height must be non-zero for percentages to calculate properly */
    min-height: 3rem;
    margin-top: 0.125rem;
    /* CRITICAL: Prevent overflow beyond cell bounds */
    overflow: hidden;
    contain: layout style;
    /* v8.0: Ensure container has reference height for percentage calculations */
    /* Using aspect-ratio as fallback when flex height isn't stable */
    /* aspect-ratio: 1 / 2; — disabled, flex works better */
  }
  
  .timed-bar {
    --bar-color: var(--interactive-accent);
    position: absolute;
    /* left and width are set via inline style for column layout */
    box-sizing: border-box;
    background: hsla(var(--interactive-accent-hsl), 0.2);
    background: color-mix(in srgb, var(--bar-color) 20%, transparent);
    border-left: 3px solid var(--bar-color);
    border-radius: 0 0.25rem 0.25rem 0;
    padding: 0.125rem 0.25rem;
    font-size: 0.625rem;
    line-height: 1.2;
    overflow: hidden;
    cursor: pointer;
    transition: background 0.15s ease;
    /* v8.0: Minimum height ensures bar is always visible */
    min-height: 0.75rem;
    /* NO default margins - controlled via gap in width calculation */
    margin: 0;
  }
  
  .timed-bar:hover {
    background: color-mix(in srgb, var(--bar-color) 35%, transparent);
    z-index: 5;
  }
  
  .timed-bar:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--bar-color);
    z-index: 6;
  }
  
  /* Narrow bars (when multiple columns) - hide label if too narrow */
  .timed-bar.narrow {
    padding: 0.0625rem 0.125rem;
  }
  
  .timed-bar.narrow .bar-label {
    /* Hide text when bar is very narrow, show only colored bar */
    font-size: 0.5rem;
    line-height: 1;
  }
  
  /* When there are 3+ columns, hide label completely */
  @container (max-width: 2.5rem) {
    .bar-label {
      display: none;
    }
  }
  
  .bar-label {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-normal);
    font-weight: 500;
    /* Clamp to single line, hide if doesn't fit */
    max-height: 1.2em;
  }
</style>

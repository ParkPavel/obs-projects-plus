<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import dayjs from 'dayjs';
  import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
  import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
  import type { DataRecord } from 'src/lib/dataframe/dataframe';
  import { i18n } from "src/lib/stores/i18n";
  import Day from './Day.svelte';
  import Week from './Week.svelte';
  import WeekHeader from './WeekHeader.svelte';
  import Weekday from './Weekday.svelte';
  import type { CalendarInterval } from '../../calendar';

  dayjs.extend(isSameOrAfter);
  dayjs.extend(isSameOrBefore);

  export let groupedRecords: Record<string, DataRecord[]>;
  export let firstDayOfWeek: number;
  export let interval: CalendarInterval;
  export let checkField: string | undefined;
  export let onRecordClick: ((record: DataRecord) => void) | undefined;
  export let onRecordChange: ((date: dayjs.Dayjs, record: DataRecord) => void) | undefined;
  export let onRecordCheck: ((record: DataRecord, checked: boolean) => void) | undefined;
  export let onRecordAdd: ((date: dayjs.Dayjs) => void) | undefined;
  export let onDayTap: ((date: dayjs.Dayjs, records: DataRecord[]) => void) | undefined;
  export let onScrollToCurrent: ((callback: () => void) => void) | undefined;
  export let onScrollToDate: ((callback: (date: dayjs.Dayjs) => void) => void) | undefined;
  export let targetDate: dayjs.Dayjs | null = null;

  let container: HTMLDivElement | null = null;
  
  const INITIAL_BUFFER = 8; // periods before and after
  const LOAD_THRESHOLD = 2; // periods from edge to trigger load
  const LOAD_BATCH = 4; // periods to add at once
  
  // Each "period" is a set of dates based on the interval
  type Period = {
    id: string;
    startDate: dayjs.Dayjs;
    dates: dayjs.Dayjs[];
    weeks: dayjs.Dayjs[][];
    weekDays: dayjs.Dayjs[];
  };
  
  let periods: Period[] = [];
  let periodElements: (HTMLElement | null)[] = [];
  let isLoadingPrev = false;
  let isLoadingNext = false;
  let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentPeriodIndex = INITIAL_BUFFER;

  function getDaysInPeriod(baseDate: dayjs.Dayjs): number {
    switch (interval) {
      case 'day': return 1;
      case '3days': return 3;
      case 'week': return 7;
      case '2weeks': return 14;
      default: return 7;
    }
  }

  function getPeriodStep(): { unit: dayjs.ManipulateType; amount: number } {
    switch (interval) {
      case 'day': return { unit: 'day', amount: 1 };
      case '3days': return { unit: 'day', amount: 3 };
      case 'week': return { unit: 'week', amount: 1 };
      case '2weeks': return { unit: 'week', amount: 2 };
      default: return { unit: 'week', amount: 1 };
    }
  }

  function startOfWeek(date: dayjs.Dayjs): dayjs.Dayjs {
    const day = date.day();
    const diff = (day - firstDayOfWeek + 7) % 7;
    return date.subtract(diff, 'day').startOf('day');
  }

  function createPeriod(baseDate: dayjs.Dayjs): Period {
    const daysCount = getDaysInPeriod(baseDate);
    const dates: dayjs.Dayjs[] = [];
    
    let startDate: dayjs.Dayjs;
    
    if (interval === 'week' || interval === '2weeks') {
      startDate = startOfWeek(baseDate);
    } else {
      startDate = baseDate.startOf('day');
    }
    
    for (let i = 0; i < daysCount; i++) {
      dates.push(startDate.add(i, 'day'));
    }
    
    // Group dates into weeks (rows)
    const weeks: dayjs.Dayjs[][] = [];
    if (interval === '2weeks') {
      weeks.push(dates.slice(0, 7));
      weeks.push(dates.slice(7, 14));
    } else {
      weeks.push(dates);
    }
    
    // Weekday headers
    const weekDays = dates.slice(0, interval === '2weeks' ? 7 : daysCount);
    
    return {
      id: startDate.format('YYYY-MM-DD'),
      startDate,
      dates,
      weeks,
      weekDays
    };
  }

  function initializePeriods() {
    const now = dayjs().startOf('day');
    periods = [];
    
    const step = getPeriodStep();
    
    // Create periods from -BUFFER to +BUFFER
    for (let i = -INITIAL_BUFFER; i <= INITIAL_BUFFER; i++) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = startOfWeek(now).add(i * step.amount, 'week');
      } else {
        baseDate = now.add(i * step.amount, 'day');
      }
      periods.push(createPeriod(baseDate));
    }
    
    currentPeriodIndex = INITIAL_BUFFER;
  }

  function prependPeriods() {
    if (isLoadingPrev || periods.length === 0) return;
    isLoadingPrev = true;
    
    const step = getPeriodStep();
    const firstPeriod = periods[0];
    if (!firstPeriod) {
      isLoadingPrev = false;
      return;
    }
    const newPeriods: Period[] = [];
    
    for (let i = LOAD_BATCH; i >= 1; i--) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = firstPeriod.startDate.subtract(i * step.amount, 'week');
      } else {
        baseDate = firstPeriod.startDate.subtract(i * step.amount, 'day');
      }
      newPeriods.push(createPeriod(baseDate));
    }
    
    const oldScrollLeft = container?.scrollLeft ?? 0;
    const firstEl = periodElements[0];
    const firstElWidth = firstEl?.offsetWidth ?? 0;
    
    periods = [...newPeriods, ...periods];
    currentPeriodIndex += LOAD_BATCH;
    
    requestAnimationFrame(() => {
      if (container) {
        // Maintain scroll position
        const addedWidth = LOAD_BATCH * firstElWidth;
        container.scrollLeft = oldScrollLeft + addedWidth;
      }
      isLoadingPrev = false;
    });
  }

  function appendPeriods() {
    if (isLoadingNext || periods.length === 0) return;
    isLoadingNext = true;
    
    const step = getPeriodStep();
    const lastPeriod = periods[periods.length - 1];
    if (!lastPeriod) {
      isLoadingNext = false;
      return;
    }
    const newPeriods: Period[] = [];
    
    for (let i = 1; i <= LOAD_BATCH; i++) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = lastPeriod.startDate.add((i) * step.amount, 'week');
      } else {
        baseDate = lastPeriod.startDate.add(i * step.amount, 'day');
      }
      newPeriods.push(createPeriod(baseDate));
    }
    
    periods = [...periods, ...newPeriods];
    
    requestAnimationFrame(() => {
      isLoadingNext = false;
    });
  }

  function getCurrentPeriodIndex(): number {
    if (!container) return currentPeriodIndex;
    
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    let accumulatedWidth = 0;
    
    for (let i = 0; i < periods.length; i++) {
      const el = periodElements[i];
      const width = el?.offsetWidth ?? containerWidth;
      if (accumulatedWidth + width > scrollLeft + containerWidth / 2) {
        return i;
      }
      accumulatedWidth += width;
    }
    return periods.length - 1;
  }

  function handleScroll() {
    if (!container) return;
    
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    scrollDebounceTimer = setTimeout(() => {
      checkAndLoadMore();
    }, 50);
  }

  function checkAndLoadMore() {
    if (!container) return;
    
    const idx = getCurrentPeriodIndex();
    currentPeriodIndex = idx;
    
    // Load more at edges
    if (idx <= LOAD_THRESHOLD && !isLoadingPrev) {
      prependPeriods();
    }
    
    if (idx >= periods.length - LOAD_THRESHOLD - 1 && !isLoadingNext) {
      appendPeriods();
    }
  }

  function scrollToCurrent() {
    scrollToDate(dayjs());
  }
  
  function scrollToDate(date: dayjs.Dayjs) {
    if (!container) {
      setTimeout(() => scrollToDate(date), 100);
      return;
    }
    
    const targetDay = date.startOf('day');
    
    // Find the period containing the target date
    const periodIndex = periods.findIndex(p => {
      const endDate = p.dates[p.dates.length - 1];
      return targetDay.isSameOrAfter(p.startDate, 'day') && targetDay.isSameOrBefore(endDate, 'day');
    });
    
    if (periodIndex === -1) {
      // Target date not in range - reinitialize around target date
      initializePeriodsAroundDate(date);
      requestAnimationFrame(() => scrollToDate(date));
      return;
    }
    
    requestAnimationFrame(() => {
      const targetEl = periodElements[periodIndex];
      if (targetEl && container) {
        const scrollLeft = targetEl.offsetLeft - (container.clientWidth - targetEl.offsetWidth) / 2;
        container.scrollTo({
          left: Math.max(0, scrollLeft),
          behavior: 'smooth'
        });
      }
    });
  }
  
  function initializePeriodsAroundDate(date: dayjs.Dayjs) {
    const targetDay = date.startOf('day');
    periods = [];
    
    const step = getPeriodStep();
    
    // Create periods centered around the target date
    for (let i = -INITIAL_BUFFER; i <= INITIAL_BUFFER; i++) {
      let baseDate: dayjs.Dayjs;
      if (step.unit === 'week') {
        baseDate = startOfWeek(targetDay).add(i * step.amount, 'week');
      } else {
        baseDate = targetDay.add(i * step.amount, 'day');
      }
      periods.push(createPeriod(baseDate));
    }
    
    currentPeriodIndex = INITIAL_BUFFER;
  }

  // Convert vertical scroll (wheel) to horizontal scroll
  function handleWheel(event: WheelEvent) {
    if (!container) return;
    
    // Don't handle Ctrl+wheel - let it bubble up for zoom handling
    if (event.ctrlKey || event.metaKey) return;
    
    // Only handle vertical scrolling (deltaY) - convert to horizontal
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate scroll amount - amplify for better UX
      const scrollAmount = event.deltaY * 2;
      
      // Use scrollBy for smoother behavior
      container.scrollBy({
        left: scrollAmount,
        behavior: 'auto' // instant, не 'smooth' для responsive feel
      });
      
      // Trigger scroll handler for infinite loading after scroll
      requestAnimationFrame(() => handleScroll());
    }
  }

  onMount(() => {
    // Initialize periods based on targetDate
    if (targetDate) {
      initializePeriodsAroundDate(targetDate);
    } else {
      initializePeriods();
    }
    
    // Setup wheel listener for mouse/trackpad horizontal scroll
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    
    // Auto-scroll to target date or current date after mount
    setTimeout(() => {
      if (targetDate) {
        scrollToDate(targetDate);
      } else {
        scrollToCurrent();
      }
    }, 150);
    
    if (onScrollToCurrent) {
      onScrollToCurrent(() => {
        setTimeout(() => scrollToCurrent(), 50);
      });
    }
    
    if (onScrollToDate) {
      onScrollToDate((date: dayjs.Dayjs) => {
        setTimeout(() => scrollToDate(date), 50);
      });
    }
  });

  onDestroy(() => {
    if (scrollDebounceTimer) {
      clearTimeout(scrollDebounceTimer);
    }
    
    // Remove wheel event listener
    if (container) {
      container.removeEventListener('wheel', handleWheel);
    }
  });
</script>

<div class="infinite-horizontal-calendar" bind:this={container} on:scroll={handleScroll}>
  {#if isLoadingPrev}
    <div class="loading-indicator left">...</div>
  {/if}
  
  {#each periods as period, index (period.id)}
    <div class="period-container" bind:this={periodElements[index]}>
      <div class="period-header">
        <WeekHeader>
          {#each period.weekDays as weekDay}
            <Weekday
              width={100 / period.weekDays.length}
              weekend={weekDay.day() === 0 || weekDay.day() === 6}
            >
              <span class="weekday-name">
                {$i18n.t("views.calendar.weekday", {
                  value: weekDay.toDate(),
                  formatParams: {
                    value: { weekday: "short" },
                  },
                })}
              </span>
              <span class="weekday-date">
                {weekDay.format('D')}
              </span>
            </Weekday>
          {/each}
        </WeekHeader>
      </div>
      
      <div class="period-content">
        {#each period.weeks as week}
          <Week height={100 / period.weeks.length}>
            {#each week as date}
              <Day
                width={100 / week.length}
                {date}
                {checkField}
                records={groupedRecords[date.format("YYYY-MM-DD")] || []}
                {onRecordClick}
                {onRecordChange}
                onRecordCheck={onRecordCheck}
                onRecordAdd={() => onRecordAdd?.(date)}
                {onDayTap}
              />
            {/each}
          </Week>
        {/each}
      </div>
    </div>
  {/each}
  
  {#if isLoadingNext}
    <div class="loading-indicator right">
      <span class="loading-dot"></span>
    </div>
  {/if}
</div>

<style>
  .infinite-horizontal-calendar {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scroll-behavior: smooth;
  }

  .period-container {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-width: 100%;
    height: 100%;
    border-right: 1px solid var(--background-modifier-border);
    animation: periodSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes periodSlideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .period-container:last-child {
    border-right: none;
  }

  .period-header {
    flex-shrink: 0;
  }

  .period-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  /* Ensure weeks fill available height */
  .period-content :global(.calendar-week) {
    flex: 1 1 auto;
    min-height: 100px;
  }

  .weekday-name {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .weekday-date {
    display: block;
    font-size: 18px;
    font-weight: 500;
    color: var(--text-normal);
    margin-top: 2px;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    flex-shrink: 0;
  }

  .loading-indicator.left {
    order: -1;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    background: var(--interactive-accent);
    border-radius: 50%;
    animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(0.8);
    }
  }

  /* Apple-style scrollbar */
  .infinite-horizontal-calendar::-webkit-scrollbar {
    height: 8px;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-track {
    background: transparent;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 4px;
  }

  .infinite-horizontal-calendar::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-active-thumb-bg);
  }

  /* Hide scrollbar until hover (Apple style) */
  .infinite-horizontal-calendar {
    scrollbar-color: transparent transparent;
  }

  .infinite-horizontal-calendar:hover {
    scrollbar-color: var(--scrollbar-thumb-bg) transparent;
  }
</style>
